import { useEffect, useMemo, useState } from "react";
import { Button, Card, DatePicker, Empty, Input, InputNumber, Select, Space, Table, Tag, Tooltip, Typography, message } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { LcXuatCapApi } from "../../services/LcXuatCapApi";
import { LcXuatCapDanhMucApi } from "../../services/LcXuatCapDanhMucApi";
import type { LcXuatCapCumOption, LcXuatCapLoaiOption } from "../../models/LcXuatCapDanhMucModel";
import { thanhPhamToScope, type ThanhPham } from "./lcTabsConfig";

/**
 * Vùng "Xuất / Cấp cốc" (tab `xuatCapCoc`) — TP1 "C. Cốc xuất đi" / TP2 "3. Cấp cốc", xem
 * .claude/LuyenCoc/PhanTich_TabCapCoc.md §9-§11. Layout (Cụm/NoiNhan/ChiTietLo/LoaiCoc) là CỐ
 * ĐỊNH theo Scope, quản lý qua trang /lc-xuatcapdanhmuc — FE KHÔNG cho thêm/xoá dòng ở đây, chỉ
 * nhập giá trị/gán nguồn.
 *
 * SỬA 2026-10-26 (2 thay đổi lớn, xem §10/§11):
 * 1. "Cụm" là tầng THẬT trong Excel (Cụm 1,2,3,4/5 cho TP1, Cụm 6-7 cho TP2) — render ngoài cùng
 *    theo Cụm → Loại cốc → Nơi nhận (kèm caption Tên cân) → Chi tiết, KHÔNG còn nhóm theo "Cân"
 *    (TenCan) như trước — 1 Cân có thể xuất hiện ở NHIỀU Cụm khác nhau nên nhóm theo Cân là sai.
 * 2. KHÔNG còn Initializer sinh sẵn slot lúc tạo phiếu — BE trả FULL layout (ghép danh mục + dữ
 *    liệu đã có), slot chưa ai nhập/gán có `id=0` (ảo). Khoá để Lưu/Gán là `idDanhMucChiTiet`
 *    (ổn định), KHÔNG dùng `id` (có thể trùng 0 giữa nhiều slot ảo).
 *
 * SỬA 2026-10-27: bảng hiển thị CHỈ render các slot ĐÃ CÓ DỮ LIỆU THẬT (`id>0` — đã gán nguồn
 * hoặc đã lưu tay) hoặc đã bấm "+ Thêm dòng" để nhập tay — KHÔNG còn hiện toàn bộ ~95 dòng rỗng
 * của layout (quá rối mắt). Render thành 1 bảng DUY NHẤT với rowSpan merge cột Cụm/Loại cốc/Nơi
 * nhận/Trong ca-Lũy kế, đúng kiểu merge cell của template Excel gốc (xem `activeRows`).
 *
 * KHÔNG auto-map nguồn BBGN vào ô — người dùng bấm "Làm mới" để liệt kê các dòng "chấm chuyến"
 * (Tbl_ChiTiet_BienBanGiaoNhan) trong ngày/ca/kíp, rồi chọn Cụm (bắt buộc — không suy được từ
 * BBGN) + Phòng ban/Loại nhận (gợi ý sẵn, có thể đổi) + Chi tiết rồi "Gán". Gán/bỏ gán ghi DB
 * NGAY (không đợi "Lưu phiếu") vì cần kiểm tra trùng lặp và tính lại Trong ca/Lũy kế.
 */

export interface XuatCapNguon {
  id: number;
  idBbgn: number;
  idCtBbgn: number;
  khoiLuongGan: number | null;
  doAmGan: number | null;
}

export interface XuatCapSlot {
  id: number; // 0 = slot ẢO (chưa ai nhập/gán gì cho phiếu này)
  idDanhMucChiTiet: number; // khoá slot ổn định — dùng để Lưu/Gán
  thuTu: number;
  tenCan: string;
  noiNhan: string;
  chiTietLo: string | null;
  loaiCoc: string;
  nhomTongHop: string;
  idPhongBan: number | null;
  tenPhongBan: string | null;
  idDanhMucCum: number | null;
  idCum: number | null;
  maCum: string | null;
  tenCum: string | null;
  idLoaiNhan: number | null;
  tenLoaiNhan: string | null;
  khoiLuongAm: number | null;
  doAm: number | null;
  tyKhoi: number | null;
  klQuyKho: number | null;
  trongCa: number | null;
  luyKe: number | null;
  ghiChu: string | null;
  nguon: XuatCapNguon[];
}

export interface XuatCapNguonBbgn {
  idBbgn: number;
  idCtBbgn: number;
  soPhieu: string | null;
  ngay: string | null;
  ca: string | null;
  kip: string | null;
  idXuongBn: number | null;
  idPhongBanBn: number | null;
  tenXuongBn: string | null;
  tenPhongBanBn: string | null;
  idVatTu: number | null;
  tenVatTu: string | null;
  maLo: string | null;
  khoiLuongBg: number | null;
  doAmW: number | null;
  klQuyKhoBg: number | null;
  idTrangThaiBbgn: number | null;
  ghiChu: string | null;
}

interface TabXuatCapCocProps {
  editable: boolean;
  thanhPham: ThanhPham | null | undefined;
  idPhieu: string | undefined;
  ngaySX?: string | null;
  /** Ca của phiếu (1 = ngày, 2 = đêm) — cùng quy ước với Tbl_BienBanGiaoNhan.Ca, dùng làm mặc định
   *  cho bộ lọc Nguồn BBGN, người dùng không cần nhập lại. */
  caPhieu?: number | null;
  slots: XuatCapSlot[];
  onChange: (slots: XuatCapSlot[]) => void;
}

const CA_LABELS: Record<number, string> = { 1: "Ca ngày", 2: "Ca đêm" };

const slotLabel = (s: XuatCapSlot) => `${s.noiNhan}${s.chiTietLo ? " – " + s.chiTietLo : ""} (${s.tenCan})`;

const getErrMsg = (err: unknown, fallback: string): string =>
  (typeof err === "object" && err != null && "message" in err && typeof (err as { message?: unknown }).message === "string"
    ? (err as { message: string }).message
    : fallback);

const TabXuatCapCoc = ({ editable, thanhPham, idPhieu, ngaySX, caPhieu, slots, onChange }: TabXuatCapCocProps) => {
  const scope = thanhPhamToScope(thanhPham);
  const [ngay, setNgay] = useState<Dayjs | null>(ngaySX ? dayjs(ngaySX) : null);
  useEffect(() => {
    if (ngaySX) setNgay((prev) => prev ?? dayjs(ngaySX));
  }, [ngaySX]);
  const [nguonBbgn, setNguonBbgn] = useState<XuatCapNguonBbgn[]>([]);
  const [loadingNguon, setLoadingNguon] = useState(false);
  const [savingTab, setSavingTab] = useState(false);
  const [ganKey, setGanKey] = useState<number | null>(null);

  const [cumOptions, setCumOptions] = useState<LcXuatCapCumOption[]>([]);
  const [phongBanOptions, setPhongBanOptions] = useState<{ value: number; label: string }[]>([]);
  const [loaiNhanOptions, setLoaiNhanOptions] = useState<LcXuatCapLoaiOption[]>([]);

  const [pickCumByCtBbgn, setPickCumByCtBbgn] = useState<Record<number, number>>({});
  const [pickPhongBanByCtBbgn, setPickPhongBanByCtBbgn] = useState<Record<number, number>>({});
  const [pickLoaiNhanByCtBbgn, setPickLoaiNhanByCtBbgn] = useState<Record<number, number>>({});
  const [pickChiTietByCtBbgn, setPickChiTietByCtBbgn] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!scope) return;
    LcXuatCapDanhMucApi.getCumOptions(scope)
      .then(setCumOptions)
      .catch((err) => console.error("Không thể tải danh sách Cụm:", err));
    LcXuatCapDanhMucApi.getPhongBanOptions()
      .then((opts) => setPhongBanOptions(opts.map((p) => ({ value: p.idPhongBan, label: p.tenNgan || p.tenPhongBan || `#${p.idPhongBan}` }))))
      .catch((err) => console.error("Không thể tải danh sách Phòng ban:", err));
    LcXuatCapDanhMucApi.getLoaiNhanOptions()
      .then(setLoaiNhanOptions)
      .catch((err) => console.error("Không thể tải danh sách Loại nhận:", err));
  }, [scope]);

  const cumSelectOptions = useMemo(() => cumOptions.map((c) => ({ value: c.id, label: `${c.ten} (${c.ma})` })), [cumOptions]);
  const loaiNhanSelectOptions = useMemo(() => loaiNhanOptions.map((l) => ({ value: l.id, label: l.ten })), [loaiNhanOptions]);

  const assignedCtBbgnIds = useMemo(() => new Set(slots.flatMap((s) => s.nguon.map((n) => n.idCtBbgn))), [slots]);

  // Chỉ những slot nào đã gán được chọn thêm thủ công (chưa có dữ liệu thật — `id===0`) mới hiện
  // trong bảng, để cho phép nhập tay các ô KHÔNG có nguồn BBGN tương ứng (vd "ca trước", TKVV...).
  const [manualPicks, setManualPicks] = useState<Set<number>>(new Set());
  const [addPick, setAddPick] = useState<number | undefined>(undefined);

  // Bảng hiển thị CHỈ gồm slot ĐÃ CÓ DỮ LIỆU THẬT (`id > 0` — đã nhập tay/lưu hoặc đã gán nguồn)
  // hoặc đã được người dùng bấm "+ Thêm dòng" để nhập tay lần đầu — KHÔNG còn hiện toàn bộ ~95
  // dòng rỗng của layout (quá rối mắt). `slots` đã được BE sắp đúng thứ tự Cụm→Loại cốc→Nơi
  // nhận→Chi tiết (ThuTu danh mục) nên lọc giữ nguyên thứ tự này — tính luôn rowSpan để RENDER
  // MERGE CELL giống template Excel (cột A "Loại cốc" merge dọc cả khối, cột B "Nơi nhận" merge
  // theo nhóm, cột Trong ca/Lũy kế merge theo NhomTongHop — xem PhanTich_TabCapCoc.md §10/§11).
  const activeRows = useMemo(() => {
    const rows = slots.filter((s) => s.id > 0 || manualPicks.has(s.idDanhMucChiTiet));
    const withSpan = rows.map((s) => ({ ...s, cumSpan: 0, loaiCocSpan: 0, noiNhanSpan: 0, nhomSpan: 0 }));

    for (let i = 0; i < withSpan.length; i++) {
      const cur = withSpan[i];
      const prev = i > 0 ? withSpan[i - 1] : null;

      const newCum = !prev || prev.idCum !== cur.idCum;
      const newLoaiCoc = newCum || prev!.loaiCoc !== cur.loaiCoc;
      const newNoiNhan = newLoaiCoc || prev!.idDanhMucCum !== cur.idDanhMucCum;
      const newNhom = !prev || prev.nhomTongHop !== cur.nhomTongHop;

      if (newCum) {
        let span = 1;
        while (i + span < withSpan.length && withSpan[i + span].idCum === cur.idCum) span++;
        cur.cumSpan = span;
      }
      if (newLoaiCoc) {
        let span = 1;
        while (i + span < withSpan.length && withSpan[i + span].idCum === cur.idCum && withSpan[i + span].loaiCoc === cur.loaiCoc) span++;
        cur.loaiCocSpan = span;
      }
      if (newNoiNhan) {
        let span = 1;
        while (
          i + span < withSpan.length &&
          withSpan[i + span].idCum === cur.idCum &&
          withSpan[i + span].loaiCoc === cur.loaiCoc &&
          withSpan[i + span].idDanhMucCum === cur.idDanhMucCum
        )
          span++;
        cur.noiNhanSpan = span;
      }
      if (newNhom) {
        let span = 1;
        while (i + span < withSpan.length && withSpan[i + span].nhomTongHop === cur.nhomTongHop) span++;
        cur.nhomSpan = span;
      }
    }
    return withSpan;
  }, [slots, manualPicks]);
  type MergedRow = (typeof activeRows)[number];

  // Danh sách Nơi nhận/Chi tiết CHƯA hiện trong bảng — cho "+ Thêm dòng nhập tay" (slot không có
  // nguồn BBGN tương ứng, vd "ca trước"/"CSR62%"/TKVV..., vẫn cần 1 dòng để gõ tay Tỷ khối/Ghi chú).
  const activeKeySet = useMemo(() => new Set(activeRows.map((r) => r.idDanhMucChiTiet)), [activeRows]);
  const addableOptions = useMemo(
    () =>
      slots
        .filter((s) => !activeKeySet.has(s.idDanhMucChiTiet))
        .map((s) => ({
          value: s.idDanhMucChiTiet,
          label: `${s.tenCum ?? "?"} · ${s.loaiCoc} · ${s.noiNhan}${s.chiTietLo ? " – " + s.chiTietLo : ""}`,
        })),
    [slots, activeKeySet]
  );
  const handleAddManualRow = () => {
    if (addPick == null) return;
    setManualPicks((prev) => new Set(prev).add(addPick));
    setAddPick(undefined);
  };

  // Options "Chi tiết" cuối cùng cho panel Gán — lọc theo Cụm (bắt buộc) + Phòng ban/Loại nhận
  // (GỢI Ý MỀM: chỉ áp dụng nếu gợi ý đó thực sự khớp ít nhất 1 Chi tiết trong Cụm đã chọn, nếu
  // không thì TỰ BỎ QUA bộ lọc đó — tránh rỗng hết lựa chọn vì phần lớn Nơi nhận hiện CHƯA được
  // gán ID_PhongBan trong danh mục, xem PhanTich_TabCapCoc.md §9.7/§11.3: chỉ LG1-*/LG2-* có sẵn
  // 87/88, các Nơi nhận khác (NM.HRC1, NM.NL, Xuất bán, TKVV...) còn NULL cho tới khi khai báo tay
  // ở trang /lc-xuatcapdanhmuc).
  const chiTietOptionsFor = (idCum: number | undefined, idPhongBan: number | undefined, idLoaiNhan: number | undefined) => {
    if (idCum == null) return [];
    const byCum = slots.filter((s) => s.idCum === idCum);

    const phongBanApplicable = idPhongBan != null && byCum.some((s) => s.idPhongBan === idPhongBan);
    const byPhongBan = phongBanApplicable ? byCum.filter((s) => s.idPhongBan === idPhongBan) : byCum;

    const loaiNhanApplicable = idLoaiNhan != null && byPhongBan.some((s) => s.idLoaiNhan === idLoaiNhan);
    const final = loaiNhanApplicable ? byPhongBan.filter((s) => s.idLoaiNhan === idLoaiNhan) : byPhongBan;

    return final.map((s) => ({ value: s.idDanhMucChiTiet, label: `${s.noiNhan}${s.chiTietLo ? " – " + s.chiTietLo : ""}` }));
  };

  const updateSlotField = (idDanhMucChiTiet: number, patch: Partial<XuatCapSlot>) => {
    onChange(slots.map((s) => (s.idDanhMucChiTiet === idDanhMucChiTiet ? { ...s, ...patch } : s)));
  };

  const handleLamMoiNguon = async () => {
    if (!scope) {
      message.warning("Vui lòng chọn Thành phẩm (TP1/TP2) ở phần đầu phiếu trước.");
      return;
    }
    if (!ngay) {
      message.warning("Vui lòng chọn Ngày.");
      return;
    }
    if (!caPhieu) {
      message.warning("Phiếu chưa chọn Ca — vui lòng chọn Ca ở phần đầu phiếu trước.");
      return;
    }
    setLoadingNguon(true);
    try {
      const res = await LcXuatCapApi.getNguonBbgn(ngay.format("YYYY-MM-DD"), String(caPhieu), scope);
      setNguonBbgn(res);
    } catch (err) {
      console.error("Không thể tải danh sách chấm chuyến BBGN:", err);
      message.error("Không thể tải danh sách chấm chuyến BBGN.");
    } finally {
      setLoadingNguon(false);
    }
  };

  const handleGan = async (row: XuatCapNguonBbgn) => {
    const idDanhMucChiTiet = pickChiTietByCtBbgn[row.idCtBbgn];
    if (!idPhieu || !idDanhMucChiTiet) return;
    setGanKey(row.idCtBbgn);
    try {
      await LcXuatCapApi.gan({
        idPhieu,
        idDanhMucChiTiet,
        idBbgn: row.idBbgn,
        idCtBbgn: row.idCtBbgn,
        khoiLuongGan: row.khoiLuongBg,
        doAmGan: row.doAmW,
      });
      const fresh = await LcXuatCapApi.getByPhieu(idPhieu);
      onChange(fresh);
      message.success("Đã gán chấm chuyến vào ô.");
    } catch (err: unknown) {
      console.error("Gán nguồn thất bại:", err);
      message.error(getErrMsg(err, "Không thể gán chấm chuyến này."));
    } finally {
      setGanKey(null);
    }
  };

  const handleBoGan = async (nguon: XuatCapNguon) => {
    if (!idPhieu) return;
    setGanKey(nguon.idCtBbgn);
    try {
      await LcXuatCapApi.boGan(nguon.id);
      const fresh = await LcXuatCapApi.getByPhieu(idPhieu);
      onChange(fresh);
      message.success("Đã bỏ gán.");
    } catch (err: unknown) {
      console.error("Bỏ gán thất bại:", err);
      message.error(getErrMsg(err, "Không thể bỏ gán."));
    } finally {
      setGanKey(null);
    }
  };

  const handleLuuTab = async () => {
    if (!idPhieu) {
      message.warning("Vui lòng lưu phiếu trước khi lưu dữ liệu Cấp cốc.");
      return;
    }
    setSavingTab(true);
    try {
      const body = slots.map((s) => ({
        idDanhMucChiTiet: s.idDanhMucChiTiet,
        khoiLuongAm: s.khoiLuongAm,
        doAm: s.doAm,
        tyKhoi: s.tyKhoi,
        ghiChu: s.ghiChu,
      }));
      const fresh = await LcXuatCapApi.save(idPhieu, body);
      onChange(fresh);
      message.success("Đã lưu và tính lại Khối lượng quy khô / Trong ca / Lũy kế.");
    } catch (err: unknown) {
      console.error("Lưu tab Cấp cốc thất bại:", err);
      message.error(getErrMsg(err, "Không thể lưu dữ liệu Cấp cốc."));
    } finally {
      setSavingTab(false);
    }
  };

  const nguonColumns = [
    // { title: "Số phiếu BBGN", dataIndex: "soPhieu", key: "soPhieu", width: 130 },
    { title: "Xưởng/Phòng ban nhận", key: "noiNhan", width: 170, render: (_: unknown, r: XuatCapNguonBbgn) => [r.tenXuongBn, r.tenPhongBanBn].filter(Boolean).join(" / ") || "-" },
    { title: "Vật tư", dataIndex: "tenVatTu", key: "tenVatTu" },
    { title: "Mã lô", dataIndex: "maLo", key: "maLo", width: 100 },
    { title: "Khối lượng ẩm (BG)", dataIndex: "khoiLuongBg", key: "khoiLuongBg", width: 120 },
    { title: "Độ ẩm", dataIndex: "doAmW", key: "doAmW", width: 90 },
    { title: "Quy khô (BG)", dataIndex: "klQuyKhoBg", key: "klQuyKhoBg", width: 110 },
    {
      title: "Ghi chú (BBGN)",
      dataIndex: "ghiChu",
      key: "ghiChu",
      width: 200,
      render: (v: string | null) =>
        v ? (
          <Tooltip title={v}>
            <span>{v}</span>
          </Tooltip>
        ) : (
          "-"
        ),
    },
    {
      title: "Gán vào ô",
      key: "gan",
      width: 460,
      render: (_: unknown, row: XuatCapNguonBbgn) => {
        const da = assignedCtBbgnIds.has(row.idCtBbgn);
        if (da) {
          const slot = slots.find((s) => s.nguon.some((n) => n.idCtBbgn === row.idCtBbgn));
          const nguonRow = slot?.nguon.find((n) => n.idCtBbgn === row.idCtBbgn);
          return (
            <Space>
              <Tag color="green">{slot ? slotLabel(slot) : "Đã gán"}</Tag>
              {editable && nguonRow && (
                <Button size="small" danger loading={ganKey === row.idCtBbgn} onClick={() => handleBoGan(nguonRow)}>
                  Bỏ gán
                </Button>
              )}
            </Space>
          );
        }

        const chosenCum = pickCumByCtBbgn[row.idCtBbgn] ?? (cumSelectOptions.length === 1 ? cumSelectOptions[0].value : undefined);
        const chosenPhongBan = pickPhongBanByCtBbgn[row.idCtBbgn] ?? row.idPhongBanBn ?? undefined;
        const chosenLoaiNhan = pickLoaiNhanByCtBbgn[row.idCtBbgn];
        const chiTietOpts = chiTietOptionsFor(chosenCum, chosenPhongBan, chosenLoaiNhan);

        return (
          <Space wrap>
            <Select
              size="small"
              style={{ width: 120 }}
              placeholder="Cụm..."
              options={cumSelectOptions}
              disabled={!editable}
              value={chosenCum}
              onChange={(v) => {
                setPickCumByCtBbgn((prev) => ({ ...prev, [row.idCtBbgn]: v }));
                setPickChiTietByCtBbgn((prev) => ({ ...prev, [row.idCtBbgn]: 0 }));
              }}
            />
            <Select
              size="small"
              showSearch
              allowClear
              style={{ width: 130 }}
              placeholder="Phòng ban (gợi ý)"
              options={phongBanOptions}
              disabled={!editable}
              filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
              value={chosenPhongBan}
              onChange={(v) => {
                setPickPhongBanByCtBbgn((prev) => ({ ...prev, [row.idCtBbgn]: v }));
                setPickChiTietByCtBbgn((prev) => ({ ...prev, [row.idCtBbgn]: 0 }));
              }}
            />
            <Select
              size="small"
              allowClear
              style={{ width: 100 }}
              placeholder="Loại nhận"
              options={loaiNhanSelectOptions}
              disabled={!editable}
              value={chosenLoaiNhan}
              onChange={(v) => {
                setPickLoaiNhanByCtBbgn((prev) => ({ ...prev, [row.idCtBbgn]: v }));
                setPickChiTietByCtBbgn((prev) => ({ ...prev, [row.idCtBbgn]: 0 }));
              }}
            />
            <Select
              size="small"
              showSearch
              style={{ width: 150 }}
              placeholder="Chi tiết..."
              options={chiTietOpts}
              disabled={!editable || chosenCum == null}
              filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
              value={pickChiTietByCtBbgn[row.idCtBbgn] || undefined}
              onChange={(v) => setPickChiTietByCtBbgn((prev) => ({ ...prev, [row.idCtBbgn]: v }))}
            />
            <Button
              size="small"
              type="primary"
              disabled={!editable || !pickChiTietByCtBbgn[row.idCtBbgn]}
              loading={ganKey === row.idCtBbgn}
              onClick={() => handleGan(row)}
            >
              Gán
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <Card size="small" title="Nguồn BBGN (chấm chuyến) — liệt kê để tự gán tay" style={{ marginBottom: 16 }}>
        <Space wrap style={{ marginBottom: 12 }}>
          <DatePicker value={ngay} onChange={setNgay} placeholder="Ngày" format="DD/MM/YYYY" />
          <Tag>{caPhieu ? CA_LABELS[caPhieu] ?? `Ca ${caPhieu}` : "Chưa chọn Ca"}</Tag>
          <Button icon={<ReloadOutlined />} onClick={handleLamMoiNguon} loading={loadingNguon}>
            Làm mới
          </Button>
          <Typography.Text type="secondary">Ca lấy mặc định theo Ca của phiếu. Phòng ban đã gợi ý sẵn theo nơi nhận BBGN.</Typography.Text>
        </Space>
        {nguonBbgn.length === 0 ? (
          <Empty description="Chưa tải danh sách chấm chuyến — bấm &quot;Làm mới&quot;" />
        ) : (
          <Table
            rowKey="idCtBbgn"
            size="small"
            bordered
            pagination={false}
            scroll={{ x: true }}
            columns={nguonColumns}
            dataSource={nguonBbgn}
          />
        )}
      </Card>

      {editable && (
        <Button type="primary" onClick={handleLuuTab} loading={savingTab} style={{ marginBottom: 16 }} disabled={!idPhieu}>
          Lưu & tính lại (Khối lượng quy khô / Trong ca / Lũy kế)
        </Button>
      )}

      <Space wrap style={{ marginBottom: 12 }}>
        <Select
          showSearch
          style={{ width: 360 }}
          placeholder="Chọn Nơi nhận/Chi tiết để nhập tay (ô không có nguồn BBGN, vd 'ca trước', TKVV...)"
          options={addableOptions}
          disabled={!editable}
          filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
          value={addPick}
          onChange={setAddPick}
        />
        <Button disabled={!editable || addPick == null} onClick={handleAddManualRow}>
          + Thêm dòng
        </Button>
      </Space>

      {activeRows.length === 0 ? (
        <Empty description="Chưa có dữ liệu nào được gán/nhập — dùng bảng Nguồn BBGN phía trên hoặc chọn Nơi nhận/Chi tiết ở trên để nhập tay." />
      ) : (
        <Table
          rowKey="idDanhMucChiTiet"
          columns={[
            { title: "Cụm", dataIndex: "tenCum", key: "tenCum", width: 110, onCell: (r: MergedRow) => ({ rowSpan: r.cumSpan }), render: (v: string | null) => v ?? "-" },
            { title: "Loại cốc", dataIndex: "loaiCoc", key: "loaiCoc", width: 110, onCell: (r: MergedRow) => ({ rowSpan: r.loaiCocSpan }) },
            { title: "Nơi nhận", dataIndex: "noiNhan", key: "noiNhan", width: 130, onCell: (r: MergedRow) => ({ rowSpan: r.noiNhanSpan }) },
            { title: "Chi tiết", dataIndex: "chiTietLo", key: "chiTietLo", width: 110, render: (v: string | null) => v ?? "-" },
            {
              title: "Khối lượng ẩm",
              key: "khoiLuongAm",
              width: 150,
              render: (_: unknown, s: MergedRow) =>
                s.nguon.length > 0 ? (
                  <Tooltip title={`Tổng từ ${s.nguon.length} chấm chuyến đã gán`}>
                    <Tag color="blue">{s.khoiLuongAm ?? 0}</Tag>
                  </Tooltip>
                ) : (
                  <InputNumber
                    size="small"
                    style={{ width: "100%" }}
                    value={s.khoiLuongAm ?? undefined}
                    disabled={!editable}
                    onChange={(v) => updateSlotField(s.idDanhMucChiTiet, { khoiLuongAm: v })}
                  />
                ),
            },
            {
              title: "Độ ẩm (%)",
              key: "doAm",
              width: 100,
              render: (_: unknown, s: MergedRow) =>
                s.nguon.length > 0 ? (
                  s.doAm ?? "-"
                ) : (
                  <InputNumber
                    size="small"
                    style={{ width: "100%" }}
                    value={s.doAm ?? undefined}
                    disabled={!editable}
                    onChange={(v) => updateSlotField(s.idDanhMucChiTiet, { doAm: v })}
                  />
                ),
            },
            {
              title: "Tỷ khối",
              key: "tyKhoi",
              width: 90,
              render: (_: unknown, s: MergedRow) => (
                <InputNumber
                  size="small"
                  style={{ width: "100%" }}
                  value={s.tyKhoi ?? undefined}
                  disabled={!editable}
                  onChange={(v) => updateSlotField(s.idDanhMucChiTiet, { tyKhoi: v })}
                />
              ),
            },
            { title: "Quy khô", dataIndex: "klQuyKho", key: "klQuyKho", width: 90, render: (v: number | null) => v ?? "-" },
            { title: "Trong ca", dataIndex: "trongCa", key: "trongCa", width: 90, onCell: (r: MergedRow) => ({ rowSpan: r.nhomSpan }), render: (v: number | null) => v ?? "-" },
            { title: "Lũy kế", dataIndex: "luyKe", key: "luyKe", width: 90, onCell: (r: MergedRow) => ({ rowSpan: r.nhomSpan }), render: (v: number | null) => v ?? "-" },
            {
              title: "Ghi chú",
              key: "ghiChu",
              width: 150,
              render: (_: unknown, s: MergedRow) => (
                <Input
                  size="small"
                  value={s.ghiChu ?? ""}
                  disabled={!editable}
                  onChange={(e) => updateSlotField(s.idDanhMucChiTiet, { ghiChu: e.target.value })}
                />
              ),
            },
          ]}
          dataSource={activeRows}
          pagination={false}
          size="small"
          bordered
          scroll={{ x: true }}
        />
      )}
    </div>
  );
};

export default TabXuatCapCoc;
