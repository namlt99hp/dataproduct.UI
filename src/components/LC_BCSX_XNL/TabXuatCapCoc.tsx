import { useEffect, useMemo, useState } from "react";
import { Button, Card, DatePicker, Empty, Input, InputNumber, Select, Space, Table, Tag, Tooltip, Typography, message } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { LcXuatCapApi } from "../../services/LcXuatCapApi";
import { thanhPhamToScope, type ThanhPham } from "./lcTabsConfig";

/**
 * Vùng "Xuất / Cấp cốc" (tab `xuatCapCoc`) — TP1 "C. Cốc xuất đi" / TP2 "3. Cấp cốc", xem
 * .claude/LuyenCoc/PhanTich_TabCapCoc.md §9. Layout (TenCan/NoiNhan/ChiTietLo/LoaiCoc) là CỐ
 * ĐỊNH theo Scope, do backend (Utils/LcXuatCapLayoutSeed.cs) sinh lúc tạo phiếu — FE KHÔNG cho
 * thêm/xoá dòng, chỉ nhập giá trị.
 *
 * KHÔNG auto-map nguồn BBGN vào ô — người dùng bấm "Làm mới" để liệt kê các dòng "chấm chuyến"
 * (Tbl_ChiTiet_BienBanGiaoNhan) trong ngày/ca/kíp, rồi TỰ CHỌN ô cần gán cho từng dòng (chốt
 * 2026-10-23, xem PhanTich_TabCapCoc.md §9.0 mục 4). Khối lượng ẩm/Độ ẩm của ô có nguồn đã gán
 * do BE tự tính (SUM/trung bình trọng số) — chỉ ô KHÔNG có nguồn nào (ca trước/xả ôtô/CSR62%...)
 * mới cho nhập tay trực tiếp.
 *
 * Gán/bỏ gán ghi DB NGAY (không đợi "Lưu phiếu") vì cần kiểm tra trùng lặp (1 chấm chuyến chỉ
 * gán 1 ô) và tính lại Trong ca/Lũy kế cho cả nhóm liên quan. Các ô nhập tay khác (Tỷ khối/Ghi
 * chú/giá trị của ô không có nguồn) vẫn theo đúng quy ước các tab khác — giữ ở state cha, lưu
 * khi bấm "Lưu phiếu" — nhưng tab này có thêm nút "Lưu & tính lại" riêng để xem kết quả ngay.
 *
 * Nguồn BBGN lọc theo Ngày (`Tbl_BienBanGiaoNhan.ThoiGianXuLyBG`) + Ca (`Tbl_BienBanGiaoNhan.Ca`,
 * CÙNG quy ước 1=ngày/2=đêm với Ca của phiếu BCSX_XNL này) — Ca lấy mặc định từ phiếu, không cần
 * nhập lại; KHÔNG còn lọc theo Kíp (chốt 2026-10-23, lượt 4).
 *
 * "Gán vào ô" là lựa chọn 2 CẤP (chốt 2026-10-23, lượt 6): chọn CỤM (cha, vd 'LG1-CDQ') trước —
 * vì nguồn BBGN nhiều khi chỉ biết tới mức thô (vd chỉ biết 'LG1'), người dùng phải tự quyết định
 * đúng Cụm — rồi mới chọn CON (chi tiết, vd 'LC1') trong đúng Cụm đó. Bảng hiển thị dưới cũng
 * nhóm theo Cụm (`idDanhMucCum`) trong mỗi Card theo Tên cân, y hệt cách Excel gộp nhóm.
 */

export interface XuatCapNguon {
  id: number;
  idBbgn: number;
  idCtBbgn: number;
  khoiLuongGan: number | null;
  doAmGan: number | null;
}

export interface XuatCapSlot {
  id: number;
  thuTu: number;
  tenCan: string;
  noiNhan: string;
  chiTietLo: string | null;
  loaiCoc: string;
  nhomTongHop: string;
  idPhongBan: number | null;
  tenPhongBan: string | null;
  idDanhMucCum: number | null;
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
  const [pickCumByCtBbgn, setPickCumByCtBbgn] = useState<Record<number, number>>({});
  const [pickSlotByCtBbgn, setPickSlotByCtBbgn] = useState<Record<number, number>>({});

  const assignedCtBbgnIds = useMemo(() => new Set(slots.flatMap((s) => s.nguon.map((n) => n.idCtBbgn))), [slots]);

  // Nhóm 2 cấp cho bảng hiển thị: Tên cân (Card) → Cụm (idDanhMucCum, sub-block) → Con (dòng).
  // Mirror y hệt layout Excel (1 Cụm = 1 nhóm Trong ca/Lũy kế).
  const tenCanGroups = useMemo(() => {
    const byTenCan = new Map<string, XuatCapSlot[]>();
    for (const s of slots) {
      if (!byTenCan.has(s.tenCan)) byTenCan.set(s.tenCan, []);
      byTenCan.get(s.tenCan)!.push(s);
    }
    return Array.from(byTenCan.entries()).map(([tenCan, rows]) => {
      const byCum = new Map<string, XuatCapSlot[]>();
      for (const s of rows) {
        const key = s.idDanhMucCum != null ? `cum:${s.idDanhMucCum}` : `noiNhan:${s.noiNhan}:${s.thuTu}`;
        if (!byCum.has(key)) byCum.set(key, []);
        byCum.get(key)!.push(s);
      }
      const cumGroups = Array.from(byCum.values())
        .map((r) => r.sort((a, b) => a.thuTu - b.thuTu))
        .sort((a, b) => a[0].thuTu - b[0].thuTu);
      return { tenCan, cumGroups };
    });
  }, [slots]);

  // "Gán vào ô" 2 cấp: Cụm (cha, nhóm theo idDanhMucCum) → Con (chi tiết trong đúng Cụm đó).
  const cumSelectOptions = useMemo(() => {
    const byCum = new Map<number, string>();
    for (const s of slots) {
      if (s.idDanhMucCum == null || byCum.has(s.idDanhMucCum)) continue;
      byCum.set(s.idDanhMucCum, `${s.noiNhan} (${s.tenCan})`);
    }
    return Array.from(byCum.entries()).map(([value, label]) => ({ value, label }));
  }, [slots]);

  const conSelectOptions = (idCum: number | undefined) => {
    if (idCum == null) return [];
    return slots
      .filter((s) => s.idDanhMucCum === idCum)
      .sort((a, b) => a.thuTu - b.thuTu)
      .map((s) => ({ value: s.id, label: s.chiTietLo ?? "(không tách con)" }));
  };

  const updateSlotField = (id: number, patch: Partial<XuatCapSlot>) => {
    onChange(slots.map((s) => (s.id === id ? { ...s, ...patch } : s)));
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
    const idXuatCap = pickSlotByCtBbgn[row.idCtBbgn];
    if (!idPhieu || !idXuatCap) return;
    setGanKey(row.idCtBbgn);
    try {
      await LcXuatCapApi.gan({
        idXuatCap,
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
        id: s.id,
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
    { title: "Số phiếu BBGN", dataIndex: "soPhieu", key: "soPhieu", width: 140 },
    { title: "Xưởng/Phòng ban nhận", key: "noiNhan", render: (_: unknown, r: XuatCapNguonBbgn) => [r.tenXuongBn, r.tenPhongBanBn].filter(Boolean).join(" / ") || "-" },
    { title: "Vật tư", dataIndex: "tenVatTu", key: "tenVatTu" },
    { title: "Mã lô", dataIndex: "maLo", key: "maLo", width: 100 },
    { title: "Khối lượng ẩm (BG)", dataIndex: "khoiLuongBg", key: "khoiLuongBg", width: 120 },
    { title: "Độ ẩm", dataIndex: "doAmW", key: "doAmW", width: 90 },
    { title: "Quy khô (BG)", dataIndex: "klQuyKhoBg", key: "klQuyKhoBg", width: 110 },
    {
      title: "Gán vào ô",
      key: "gan",
      width: 340,
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
        const chosenCum = pickCumByCtBbgn[row.idCtBbgn];
        return (
          <Space>
            <Select
              size="small"
              showSearch
              style={{ width: 160 }}
              placeholder="Chọn Cụm..."
              options={cumSelectOptions}
              disabled={!editable}
              filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
              value={chosenCum}
              onChange={(v) => {
                setPickCumByCtBbgn((prev) => ({ ...prev, [row.idCtBbgn]: v }));
                setPickSlotByCtBbgn((prev) => {
                  const next = { ...prev };
                  delete next[row.idCtBbgn];
                  return next;
                });
              }}
            />
            <Select
              size="small"
              showSearch
              style={{ width: 140 }}
              placeholder="Chọn Con..."
              options={conSelectOptions(chosenCum)}
              disabled={!editable || chosenCum == null}
              filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
              value={pickSlotByCtBbgn[row.idCtBbgn]}
              onChange={(v) => setPickSlotByCtBbgn((prev) => ({ ...prev, [row.idCtBbgn]: v }))}
            />
            <Button
              size="small"
              type="primary"
              disabled={!editable || !pickSlotByCtBbgn[row.idCtBbgn]}
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
          <Typography.Text type="secondary">Ca lấy mặc định theo Ca của phiếu.</Typography.Text>
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

      {tenCanGroups.length === 0 && <Empty description="Chưa có dữ liệu — layout sẽ được sinh khi tạo phiếu." />}

      <Space direction="vertical" style={{ width: "100%" }} size={16}>
        {tenCanGroups.map(({ tenCan, cumGroups }) => {
          const columns = [
            { title: "Nơi nhận", dataIndex: "noiNhan", key: "noiNhan", width: 130 },
            { title: "Chi tiết", dataIndex: "chiTietLo", key: "chiTietLo", width: 120, render: (v: string | null) => v ?? "-" },
            { title: "Loại cốc", dataIndex: "loaiCoc", key: "loaiCoc", width: 90 },
            {
              title: "Khối lượng ẩm",
              key: "khoiLuongAm",
              width: 160,
              render: (_: unknown, s: XuatCapSlot) =>
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
                    onChange={(v) => updateSlotField(s.id, { khoiLuongAm: v })}
                  />
                ),
            },
            {
              title: "Độ ẩm (%)",
              key: "doAm",
              width: 110,
              render: (_: unknown, s: XuatCapSlot) =>
                s.nguon.length > 0 ? (
                  s.doAm ?? "-"
                ) : (
                  <InputNumber
                    size="small"
                    style={{ width: "100%" }}
                    value={s.doAm ?? undefined}
                    disabled={!editable}
                    onChange={(v) => updateSlotField(s.id, { doAm: v })}
                  />
                ),
            },
            {
              title: "Tỷ khối",
              key: "tyKhoi",
              width: 100,
              render: (_: unknown, s: XuatCapSlot) => (
                <InputNumber
                  size="small"
                  style={{ width: "100%" }}
                  value={s.tyKhoi ?? undefined}
                  disabled={!editable}
                  onChange={(v) => updateSlotField(s.id, { tyKhoi: v })}
                />
              ),
            },
            { title: "Quy khô", dataIndex: "klQuyKho", key: "klQuyKho", width: 100, render: (v: number | null) => v ?? "-" },
            { title: "Trong ca", dataIndex: "trongCa", key: "trongCa", width: 100, render: (v: number | null) => v ?? "-" },
            { title: "Lũy kế", dataIndex: "luyKe", key: "luyKe", width: 100, render: (v: number | null) => v ?? "-" },
            {
              title: "Ghi chú",
              key: "ghiChu",
              width: 160,
              render: (_: unknown, s: XuatCapSlot) => (
                <Input
                  size="small"
                  value={s.ghiChu ?? ""}
                  disabled={!editable}
                  onChange={(e) => updateSlotField(s.id, { ghiChu: e.target.value })}
                />
              ),
            },
          ];

          return (
            <Card key={tenCan} size="small" title={tenCan}>
              <Space direction="vertical" style={{ width: "100%" }} size={12}>
                {cumGroups.map((rows) => (
                  <div key={rows[0].id}>
                    <Typography.Text strong>{rows[0].noiNhan}</Typography.Text>
                    <Table rowKey="id" columns={columns} dataSource={rows} pagination={false} size="small" bordered scroll={{ x: true }} />
                  </div>
                ))}
              </Space>
            </Card>
          );
        })}
      </Space>
    </div>
  );
};

export default TabXuatCapCoc;
