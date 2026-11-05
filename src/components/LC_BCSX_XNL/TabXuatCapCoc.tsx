import { useEffect, useMemo, useState } from "react";
import { Button, Card, DatePicker, Empty, Select, Space, Table, Tag, Tooltip, Typography, message } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { LcXuatCapApi } from "../../services/LcXuatCapApi";
import { LcXuatCapDanhMucApi } from "../../services/LcXuatCapDanhMucApi";
import type { LcXuatCapCumOption, LcXuatCapLoaiOption } from "../../models/LcXuatCapDanhMucModel";
import { thanhPhamToScope, type ThanhPham } from "./lcTabsConfig";
import { NumberCell, TextCell } from "./LcExcelGridCells";
import { round3 } from "./lcExcelFormat";

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
 * của layout (quá rối mắt). rowSpan merge cột Loại cốc/Nơi nhận/Trong ca-Lũy kế, đúng kiểu merge
 * cell của template Excel gốc (xem `activeRows`).
 *
 * SỬA 2026-11-02: Cụm tách RA KHỎI bảng, render thành 1 Card/section riêng PHÍA TRÊN mỗi bảng con
 * (khớp đúng layout Excel thật — "C1. Cụm 1,2,3,4"/"C.2 Cụm 5" (TP1), "1. Cụm 6-7" (TP2) là dòng
 * merge A:R/A:W NẰM TRÊN bảng dữ liệu, không phải 1 cột lặp lại trong bảng). Gom `activeRows`
 * (đã sort theo ThuTu, cùng Cụm luôn liền kề — xem phân tích NhomTongHop) thành từng khối liên
 * tiếp theo `idCum` (xem `cumGroups`); cột "Cụm" KHÔNG còn trong `columns` của bảng con.
 *
 * SỬA 2026-11-02 (tiếp — bỏ decision 2026-10-27): hiện LẠI TOÀN BỘ layout (mọi Nơi nhận×Chi tiết
 * của Scope, kể cả slot ảo `id===0` chưa ai gán/nhập) — KHÔNG còn ẩn chờ gán xong mới hiện, vì cần
 * theo dõi Lũy kế liên tục theo từng ca cho MỌI nhóm, không chỉ nhóm đã có dữ liệu. BE
 * (`LC_XuatCapRepository.GetByPhieuAsync`) đã bổ sung: nhóm chưa có dòng nào trong phiếu vẫn trả
 * Lũy kế KẾ THỪA từ ca/phiếu liền trước (Trong ca để `null` vì đúng là chưa có số của ca này). Bỏ
 * hẳn `manualPicks`/"+ Thêm dòng" (dư thừa — mọi Chi tiết đã luôn hiện sẵn để nhập tay).
 *
 * KHÔNG auto-map nguồn BBGN vào ô — người dùng bấm "Làm mới" để liệt kê các dòng "chấm chuyến"
 * (Tbl_ChiTiet_BienBanGiaoNhan) trong ngày/ca/kíp, rồi chọn Cụm (bắt buộc — không suy được từ
 * BBGN) + Phòng ban/Loại nhận (gợi ý sẵn, có thể đổi) + Chi tiết rồi "Gán". Gán/bỏ gán ghi DB
 * NGAY (không đợi "Lưu phiếu") vì cần kiểm tra trùng lặp và tính lại Trong ca/Lũy kế.
 *
 * SỬA 2026-11-02 (tiếp — preview Quy khô/Trong ca): trước đây gõ KL ẩm/Độ ẩm xong KHÔNG thấy Quy
 * khô/Trong ca đổi số ngay — 2 cột này chỉ được BE tính lại (`RecomputeDerivedAsync`) lúc bấm "Lưu
 * & tính lại"/Gán. Nay `activeRows` tính thêm `klQuyKhoPreview` (công thức `computeKlQuyKhoPreview`
 * — KHỚP HỆT `ComputeKlQuyKho` ở BE) và `trongCaPreview` (SUM theo NhomTongHop, khớp
 * `RecomputeDerivedAsync`) ngay ở FE từ `s.khoiLuongAm`/`s.doAm` hiện tại — nhảy số ngay khi blur ô
 * nhập (KHÔNG cần đợi gọi API). CHỈ preview 2 cột này — Lũy kế KHÔNG preview vì công thức thật cần
 * dữ liệu liên-ca từ BE (kế thừa ca trước + mốc reset ngày 1/ca 1), vẫn hiển thị `s.luyKe` nguyên
 * như BE trả, chỉ cập nhật đúng sau khi "Lưu & tính lại"/Gán.
 *
 * SỬA 2026-11-02 (tiếp — bỏ AntD Table/InputNumber cho LƯỚI dữ liệu, theo yêu cầu người dùng "trải
 * ra quá, nhập bị đơ"): bảng Cụm→Loại cốc→Nơi nhận→Chi tiết giờ render bằng `<table>`/`<input>`
 * HTML thường + Tailwind (đã có sẵn trong project, xem tailwind.config.js) thay vì AntD `Table`/
 * `InputNumber` — cho layout sát Excel hơn (border/padding tự quyết, không bị AntD cộng thêm
 * spacing). Vẫn giữ AntD cho Select/DatePicker/Button/Card/Table ở panel "Nguồn BBGN" phía trên
 * (không phải nơi gây đơ — không có ô nhập liệu theo từng keystroke).
 *
 * Nguyên nhân thật của độ "đơ" khi nhập KHÔNG phải do AntD mà do kiến trúc state: mỗi keystroke cũ
 * gọi `updateSlotField` → `onChange(slots.map(...))` NGAY, bắn ngược lên cha → re-render lại TOÀN
 * BỘ bảng (nhiều dòng/nhiều Cụm). Nay `NumberCell`/`TextCell` (định nghĩa ở module-level, KHÔNG
 * lồng trong component — nếu lồng sẽ bị định nghĩa lại mỗi render, làm input mất focus) giữ state
 * cục bộ bằng `useState`, CHỈ gọi `onCommit` (→ `updateSlotField`) khi blur — gõ nhanh không còn
 * làm re-render cả bảng mỗi ký tự.
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

// F16 "Quy khô" = KL ẩm - KL ẩm × Độ ẩm/100 — KHỚP HỆT `ComputeKlQuyKho` ở
// LC_XuatCapRepository.cs (BE) để preview FE không bao giờ lệch số với giá trị BE trả về sau khi
// "Lưu & tính lại"/Gán (xem SỬA 2026-11-02 cuối file).
const computeKlQuyKhoPreview = (khoiLuongAm: number | null, doAm: number | null): number | null => {
  if (khoiLuongAm == null || doAm == null) return null;
  return round3(khoiLuongAm - (khoiLuongAm * doAm) / 100);
};

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

  // Bảng hiển thị TOÀN BỘ layout (mọi Nơi nhận×Chi tiết của Scope, kể cả slot ảo `id===0` chưa ai
  // nhập/gán) để theo dõi Lũy kế liên tục theo ca (xem SỬA 2026-11-02 tiếp, đầu file — BE đã trả
  // Lũy kế kế thừa cho nhóm chưa có dữ liệu). `slots` đã được BE sắp đúng thứ tự Cụm→Loại cốc→Nơi
  // nhận→Chi tiết (ThuTu danh mục) nên giữ nguyên thứ tự này — tính luôn rowSpan để RENDER MERGE
  // CELL giống template Excel (cột A "Loại cốc" merge dọc cả khối, cột B "Nơi nhận" merge theo
  // nhóm, cột Trong ca/Lũy kế merge theo NhomTongHop — xem PhanTich_TabCapCoc.md §10/§11).
  const activeRows = useMemo(() => {
    const withSpan = slots.map((s) => ({
      ...s,
      loaiCocSpan: 0,
      noiNhanSpan: 0,
      nhomSpan: 0,
      klQuyKhoPreview: computeKlQuyKhoPreview(s.khoiLuongAm, s.doAm),
      trongCaPreview: null as number | null,
    }));

    for (let i = 0; i < withSpan.length; i++) {
      const cur = withSpan[i];
      const prev = i > 0 ? withSpan[i - 1] : null;

      // Cụm không còn là cột/span hiển thị (xem cumGroups) nhưng ranh giới Cụm vẫn phải mở span
      // mới cho Loại cốc — không được gộp 2 Cụm khác nhau vào cùng 1 ô Loại cốc.
      const newCum = !prev || prev.idCum !== cur.idCum;
      const newLoaiCoc = newCum || prev!.loaiCoc !== cur.loaiCoc;
      const newNoiNhan = newLoaiCoc || prev!.idDanhMucCum !== cur.idDanhMucCum;
      const newNhom = !prev || prev.nhomTongHop !== cur.nhomTongHop;

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

        // Preview "Trong ca" = SUM Quy khô (preview) của cả nhóm NhomTongHop — KHỚP logic
        // RecomputeDerivedAsync ở BE (SUM nếu có ít nhất 1 dòng có KLQuyKho, ngược lại null). Tính
        // NGAY ở FE để cột nhảy số liền khi blur, không cần đợi "Lưu & tính lại"/Gán (số thật vẫn
        // do BE trả về sau khi gọi API — xem SỬA 2026-11-02 cuối file).
        const block = withSpan.slice(i, i + span);
        const anyData = block.some((r) => r.klQuyKhoPreview != null);
        const sum = anyData ? round3(block.reduce((acc, r) => acc + (r.klQuyKhoPreview ?? 0), 0)) : null;
        for (const r of block) r.trongCaPreview = sum;
      }
    }
    return withSpan;
  }, [slots]);
  type MergedRow = (typeof activeRows)[number];

  // Cụm tách RA KHỎI bảng, render thành 1 Card/section riêng PHÍA TRÊN mỗi bảng con — đúng layout
  // Excel thật (xem comment đầu file). activeRows đã sort theo ThuTu nên các dòng cùng Cụm luôn
  // liền kề nhau — chỉ cần gom thành từng khối liên tiếp theo idCum, KHÔNG cần group-by rồi sort lại.
  const cumGroups = useMemo(() => {
    const groups: { idCum: number | null; maCum: string | null; tenCum: string | null; rows: MergedRow[] }[] = [];
    for (const r of activeRows) {
      const last = groups[groups.length - 1];
      if (last && last.idCum === r.idCum) last.rows.push(r);
      else groups.push({ idCum: r.idCum, maCum: r.maCum, tenCum: r.tenCum, rows: [r] });
    }
    return groups;
  }, [activeRows]);

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

      {cumGroups.length === 0 ? (
        <Empty description="Thành phẩm này chưa khai báo danh mục Nơi nhận — vào trang Danh mục Cấp cốc (/lc-xuatcapdanhmuc) để khai báo trước." />
      ) : (
        cumGroups.map((group) => (
          <Card
            key={group.idCum ?? "none"}
            size="small"
            style={{ marginBottom: 16 }}
            styles={{ header: { background: "#eaf7e5" } }}
            title={`${group.maCum ? group.maCum + " · " : ""}${group.tenCum ?? "Chưa gán Cụm"}`}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th style={{ width: 110 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">Loại cốc</th>
                    <th style={{ width: 130 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">Nơi nhận</th>
                    <th style={{ width: 110 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">Chi tiết</th>
                    <th style={{ width: 150 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">Khối lượng ẩm</th>
                    <th style={{ width: 100 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">Độ ẩm (%)</th>
                    <th style={{ width: 90 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">Tỷ khối</th>
                    <th style={{ width: 90 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">Quy khô</th>
                    <th style={{ width: 90 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">Trong ca</th>
                    <th style={{ width: 90 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">Lũy kế</th>
                    <th style={{ width: 150 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((s) => (
                    <tr key={s.idDanhMucChiTiet} className="hover:bg-blue-50/50">
                      {s.loaiCocSpan > 0 && (
                        <td rowSpan={s.loaiCocSpan} className="border border-gray-300 px-2 py-1 text-center align-middle">
                          {s.loaiCoc}
                        </td>
                      )}
                      {s.noiNhanSpan > 0 && (
                        <td rowSpan={s.noiNhanSpan} className="border border-gray-300 px-2 py-1 text-center align-middle">
                          {s.noiNhan}
                        </td>
                      )}
                      <td className="border border-gray-300 px-2 py-1 text-center">{s.chiTietLo ?? "-"}</td>
                      <td className="border border-gray-300 p-0">
                        {s.nguon.length > 0 ? (
                          <span
                            className="block px-1 py-0.5 text-right text-blue-700 bg-blue-50"
                            title={`Tổng từ ${s.nguon.length} chấm chuyến đã gán`}
                          >
                            {s.khoiLuongAm ?? 0}
                          </span>
                        ) : (
                          <NumberCell
                            value={s.khoiLuongAm}
                            disabled={!editable}
                            onCommit={(v) => updateSlotField(s.idDanhMucChiTiet, { khoiLuongAm: v })}
                          />
                        )}
                      </td>
                      <td className="border border-gray-300 p-0">
                        {s.nguon.length > 0 ? (
                          <span className="block px-1 py-0.5 text-right">{s.doAm ?? "-"}</span>
                        ) : (
                          <NumberCell
                            value={s.doAm}
                            disabled={!editable}
                            onCommit={(v) => updateSlotField(s.idDanhMucChiTiet, { doAm: v })}
                          />
                        )}
                      </td>
                      <td className="border border-gray-300 p-0">
                        <NumberCell
                          value={s.tyKhoi}
                          disabled={!editable}
                          onCommit={(v) => updateSlotField(s.idDanhMucChiTiet, { tyKhoi: v })}
                        />
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-right">{s.klQuyKhoPreview ?? "-"}</td>
                      {s.nhomSpan > 0 && (
                        <td rowSpan={s.nhomSpan} className="border border-gray-300 px-2 py-1 text-right align-middle">
                          {s.trongCaPreview ?? "-"}
                        </td>
                      )}
                      {s.nhomSpan > 0 && (
                        <td rowSpan={s.nhomSpan} className="border border-gray-300 px-2 py-1 text-right align-middle">
                          {s.luyKe ?? "-"}
                        </td>
                      )}
                      <td className="border border-gray-300 p-0">
                        <TextCell
                          value={s.ghiChu}
                          disabled={!editable}
                          onCommit={(v) => updateSlotField(s.idDanhMucChiTiet, { ghiChu: v })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))
      )}
    </div>
  );
};

export default TabXuatCapCoc;
