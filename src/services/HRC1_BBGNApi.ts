import apiService from "./ApiService";
import { getThongTinUser } from "../utils/constants/GetThongTinLocalStore";

const userHeaders = () => {
  const u = getThongTinUser();
  return { "X-User-Id": String(u.iD_TaiKhoan ?? 0) };
};

// ── Response types ──────────────────────────────────────────────────────────

export interface HRC1_MeThepVm {
  id: number;
  mePhanCongId?: number | null;
  thuTuTL?: number | null;
  maMe?: string | null;
  thungSo?: string | null;
  loSo?: number | null;
  thoiGian?: string | null;       // TL nhập
  kllfSauThep?: number | null;    // LT nhập
  klLan1?: number | null;         // TL nhập (disabled nếu dichChuyen=len_thang)
  klLan2?: number | null;         // TL nhập
  klLan3?: number | null;         // LT nhập
  klThepLong?: number | null;     // Auto-tính (len_thang: KLLF-klLan2; tinh_luyen: klLan1-klLan2)
  klThepLongChot?: number | null;
  klThepLongPhanBo?: number | null;
  dichChuyen?: string | null;
  tlDichSo?: number | null;
  idMayDucDich?: number | null;
  tenMayDucDich?: string | null;
  isThuNghiem?: boolean | null;
  isTrungMeThoi?: boolean | null;
  isGhost?: boolean | null;
  isChot?: boolean | null;
  isManualTL?: boolean | null;
  ghiChuLo?: string | null;
  phanLoai?: string | null;
  macThep?: string | null;
  macThepBKMIS?: string | null;
  idMacThep?: number | null;
  ghiChuTL?: string | null;
  ghiChuDuc?: string | null;
  ghiChuPCN?: string | null;
  // Trạng thái
  trangThaiLo?: number | null;
  trangThaiTL?: number | null;
  trangThaiDuc?: number | null;
  trangThaiPCN?: boolean | null;
  trangThaiChotPCN?: boolean | null;
  // Lò thổi: TL đã nhận (scope TL; null = chưa nhận)
  soTinhLuyenNhan?: number | null;
  // Audit
  capNhatBoi?: number | null;
  capNhatLuc?: string | null;
  xacNhanBoi?: number | null;
  xacNhanLuc?: string | null;
  // Chuyển mẻ (Tinh luyện)
  chuyenVeMeId?: number | null;
  chuyenVeMaMe?: string | null;
  tenMayDucChuyen?: string | null;
  // Chuyển ca Đúc (routing sang phiếu Đúc ca sau) — không đổi Ca của chính công đoạn TL
  isChuyenCaDuc?: boolean | null;
  // Ca/Ngày của phiếu Đúc mà mẻ này đang thuộc về (đã áp dụng Chuyển ca nếu có)
  ngayDuc?: string | null;
  caDuc?: number | null;
}

export interface HRC1_ChoNhanMeVm {
  meId: number;
  maMe?: string | null;
  thungSo?: string | null;
  loSo?: number | null;
  thoiGian?: string | null;
  klThepLong?: number | null;
  tlDichSo?: number | null;
  dichChuyen?: string | null;       // tinh_luyen | len_thang
  soTinhLuyenNhan?: number | null;  // scope TL đã nhận; null = chưa nhận
  trangThaiTL?: number | null;      // 0/null=chờ nhận, 1=đã nhận
  tenNguoiNhan?: string | null;
  ngayTao?: string | null;
  ngayNhanTL?: string | null;
  tenMayDuc?: string | null;
}

export interface HRC1_MeChoNhanQuery {
  tuNgay?: string | null;
  denNgay?: string | null;
  ca?: number | null;
  maMe?: string | null;
  thungSo?: string | null;
  loSo?: number | null;
  page?: number;
  pageSize?: number;
}

export interface HRC1_MayDucOptionVm {
  id: number;
  tenMayDuc: string;
  isLock: boolean;
}

export interface HRC1_PhieuDataVm {
  idPhieu: string;
  soPhieu?: string | null;
  maBm?: string | null;
  congDoan?: string | null;
  scope?: number | null;
  tenScope?: string | null;
  ngaySX?: string | null;
  ca?: number | null;
  kip?: string | null;
  tinhTrang?: number | null;
  danhSachMe: HRC1_MeThepVm[];
  choNhan: HRC1_ChoNhanMeVm[];
  danhSachMayDuc: HRC1_MayDucOptionVm[];
}

export interface HRC1_TrungMeInfo {
  soPhieu: string;
  tenTinhLuyen: string;
}

export interface HRC1_ThemMeTayResult {
  trungVoi: HRC1_TrungMeInfo[];
  daThemVao: boolean;
}

export interface HRC1_MeThepSearchVm {
  meId: number;
  maMe: string;
  thungSo?: string | null;
  loSo?: number | null;
}

export interface HRC1_ChotPhieuBatchThatBai {
  idPhieu: string;
  soPhieu: string;
  lyDo: string[];
}

export interface HRC1_ChotPhieuBatchResult {
  thanhCong: string[];
  thatBai: HRC1_ChotPhieuBatchThatBai[];
}

// Mẻ không xác nhận đúc được vì BE re-check thấy thiếu dữ liệu (LT/TL vừa xóa field bắt buộc)
export interface HRC1_DucXacNhanThatBai {
  meId: number;
  maMe: string;
  lyDo: string[];
}

export interface HRC1_DucXacNhanResult {
  thanhCong: number[];
  thatBai: HRC1_DucXacNhanThatBai[];
}

// ── Thống kê types ──────────────────────────────────────────────────────────

export interface HRC1_ExportQuery {
  tuNgay?: string | null;
  denNgay?: string | null;
  ca?: number | null;
  kip?: string | null;
  maMe?: string | null;
  loSo?: number | null;
  tlSo?: number | null;
  idMayDuc?: number | null;
  trangThaiLo?: number | null;
  trangThaiTL?: number | null;
  trangThaiDuc?: number | null;
  thungSo?: string | null;
  phanLoai?: string | null;
  isChot?: boolean | null;
  isManualTL?: boolean | null;
  chuaCoNhomPhanLoai?: boolean | null;
  idNhomPhanLoai?: number | null;
  tuNgayLoThoi?: string | null;
  denNgayLoThoi?: string | null;
  maMeChuyenVe?: string | null;
  isThuNghiem?: boolean | null;
  trangThaiPCN?: boolean | null;
  isLenThang?: boolean | null;
  chuaLenDuc?: boolean | null;
}

export interface HRC1_ThongKeQuery extends HRC1_ExportQuery {
  isTrungMeThoi?: boolean | null;
  isChuyenMe?: boolean | null;
  page?: number;
  pageSize?: number;
}

export interface HRC1_ThongKeRow {
  meId: number;
  maMe?: string | null;
  thungSo?: string | null;
  thoiGian?: string | null;
  kllfSauThep?: number | null;
  klLan1?: number | null;
  klLan2?: number | null;
  klLan3?: number | null;
  klThepLong?: number | null;
  klThepLongChot?: number | null;
  klThepLongPhanBo?: number | null;
  ghiChuLo?: string | null;
  ghiChuTL?: string | null;
  ghiChuDuc?: string | null;
  ghiChuPCN?: string | null;
  isThuNghiem?: boolean | null;
  trangThaiPCN?: boolean | null;
  trangThaiChotPCN?: boolean | null;
  tenMayDuc?: string | null;
  macThep?: string | null;
  phanLoai?: string | null;
  macThepBKMIS?: string | null;
  tinhLuyenLenThang?: string | null;
  soTinhLuyenNhan?: number | null;
  isTrungMeThoi?: boolean | null;
  trangThaiLo?: number | null;
  trangThaiTL?: number | null;
  trangThaiDuc?: number | null;
  isChot?: boolean | null;
  ngayTao?: string | null;
  ca?: number | null;
  kip?: string | null;
  ngayNhanTL?: string | null;
  caTinhLuyen?: number | null;
  kipTinhLuyen?: string | null;
  tenNhomPhanLoai?: string | null;
  tenCapNhatBoiLo?: string | null;
  tenCapNhatBoiTL?: string | null;
  tenCapNhatBoiDuc?: string | null;
  isManualTL?: boolean | null;
  chuyenVeMaMe?: string | null;
  tenMayDucChuyen?: string | null;
  // Ngày/Ca của phiếu Đúc chứa mẻ này (đã áp dụng NgaySXDucChuyen/CaDucChuyen nếu TL đã "Chuyển ca")
  ngayDuc?: string | null;
  caDuc?: number | null;
}

export interface HRC1_ThongKeResult {
  items: HRC1_ThongKeRow[];
  totalRecords: number;
  totalKlThepLong: number | null;
  totalKlThepLongChot?: number | null;
  totalKlThepLongPhanBo?: number | null;
  page: number;
  pageSize: number;
}

export interface HRC1_TongHopItem {
  label: string;
  klThepLong: number;
}

export interface HRC1_TongHopResult {
  phanLoai: HRC1_TongHopItem[];
  ca: HRC1_TongHopItem[];
  kip: HRC1_TongHopItem[];
  tinhLuyenLenThang: HRC1_TongHopItem[];
  ducVuong: HRC1_TongHopItem[];
  ducTam: HRC1_TongHopItem[];
  nhomPhanLoaiMacThep: HRC1_TongHopItem[];
}

// ── Request types ───────────────────────────────────────────────────────────

export interface HRC1_LoThoiUpdateRequest {
  thungSo?: string | null;
  kllfSauThep?: number | null;
  klLan3?: number | null;
  thoiGian?: string | null;      // chỉ dùng khi len_thang
  klLan2?: number | null;        // chỉ dùng khi len_thang
  klThepLong?: number | null;    // chỉ dùng khi len_thang
  klThepLongPhanBo?: number | null;
  dichChuyen?: string | null;
  tlDichSo?: number | null;
  idMayDucDich?: number | null;
  isThuNghiem?: boolean | null;
  isTrungMeThoi?: boolean | null;
  ghiChuLo?: string | null;
  chuyenVeMeId?: number | null;  // chỉ áp dụng khi len_thang; null = không chuyển
}

export interface HRC1_TinhLuyenUpdateRequest {
  thoiGian?: string | null;
  klLan1?: number | null;
  klLan2?: number | null;
  klLan3?: number | null;
  klThepLong?: number | null;   // FE tự tính, gửi kèm để persist
  idMayDucDich?: number | null;
  // Chỉ gửi khi isManualTL (mẻ thêm tay bởi TinhLuyen, không có LoThoi nhập)
  thungSo?: string | null;
  kllfSauThep?: number | null;
  phanLoai?: string | null;
  macThep?: string | null;
  macThepBKMIS?: string | null;
  idMacThep?: number | null;
  ghiChuTL?: string | null;
  chuyenVeMeId?: number | null; // FK→HRC1_MeThep; null = không chuyển
}

// ── API ──────────────────────────────────────────────────────────────────────

export const HRC1Api = {
  getPhieu: (
    idPhieu: string,
    params?: { loSo?: number | null; scopePhieu?: number | null; idMayDuc?: number | null }
  ): Promise<HRC1_PhieuDataVm> =>
    apiService.get(`/api/hrc1/phieu/${idPhieu}`, { params }) as Promise<HRC1_PhieuDataVm>,

  // Lò thổi
  updateLoThoi: (meId: number, req: HRC1_LoThoiUpdateRequest) =>
    apiService.put(`/api/hrc1/lo-thoi/${meId}`, req, { headers: userHeaders() }),
  xacNhanLoThoi: (meId: number) =>
    apiService.post(`/api/hrc1/lo-thoi/${meId}/xac-nhan`, null, { headers: userHeaders() }),
  boXacNhanLoThoi: (meId: number) =>
    apiService.post(`/api/hrc1/lo-thoi/${meId}/bo-xac-nhan`, null, { headers: userHeaders() }),
  lamMoiLoThoi: (meId: number) =>
    apiService.post(`/api/hrc1/lo-thoi/${meId}/lam-moi`, null, { headers: userHeaders() }),
  // Mẻ lên thẳng: chuyển/hủy chuyển routing mẻ sang phiếu Đúc ca trước/sau (ca lò thổi giữ nguyên)
  chuyenCaDucLoThoi: (meId: number, huong: "truoc" | "sau") =>
    apiService.post("/api/hrc1/lo-thoi/chuyen-ca-duc", { meId, huong }, { headers: userHeaders() }),
  huyChuyenCaDucLoThoi: (meId: number) =>
    apiService.post("/api/hrc1/lo-thoi/huy-chuyen-ca-duc", { meId }, { headers: userHeaders() }),

  // Tinh luyện
  getChoNhan: (): Promise<HRC1_ChoNhanMeVm[]> =>
    apiService.get("/api/hrc1/tinh-luyen/cho-nhan") as Promise<HRC1_ChoNhanMeVm[]>,
  getMeChoNhan: (q: HRC1_MeChoNhanQuery): Promise<{ items: HRC1_ChoNhanMeVm[]; total: number }> =>
    apiService.get("/api/hrc1/tinh-luyen/me-cho-nhan", { params: q }) as Promise<{ items: HRC1_ChoNhanMeVm[]; total: number }>,
  nhanMe: (meId: number, idPhieu: string, scopePhieu?: number | null) =>
    apiService.post("/api/hrc1/tinh-luyen/nhan-me", { meId, idPhieu, scopePhieu }, { headers: userHeaders() }),
  updateTinhLuyen: (mePhanCongId: number, req: HRC1_TinhLuyenUpdateRequest) =>
    apiService.put(`/api/hrc1/tinh-luyen/${mePhanCongId}`, req, { headers: userHeaders() }),
  themDong: (meId: number, idPhieu: string) =>
    apiService.post("/api/hrc1/tinh-luyen/them-dong", { meId, idPhieu }, { headers: userHeaders() }),
  huyNhanMe: (meId: number, idPhieu: string, scopePhieu?: number | null) =>
    apiService.post("/api/hrc1/tinh-luyen/huy-nhan-me", { meId, idPhieu, scopePhieu }, { headers: userHeaders() }),
  // Chuyển routing mẻ sang phiếu Đúc ca trước/sau (mẻ luyện xong sát ranh giới ca, đúc rơi vào ca khác).
  // Không đổi Ca của chính công đoạn TL/Tiêu hao LF.
  chuyenCaDuc: (meId: number, huong: "truoc" | "sau") =>
    apiService.post("/api/hrc1/tinh-luyen/chuyen-ca-duc", { meId, huong }, { headers: userHeaders() }),
  huyChuyenCaDuc: (meId: number) =>
    apiService.post("/api/hrc1/tinh-luyen/huy-chuyen-ca-duc", { meId }, { headers: userHeaders() }),

  // Máy đúc
  xacNhanDuc: (meIds: number[]): Promise<HRC1_DucXacNhanResult> =>
    apiService.post("/api/hrc1/duc/xac-nhan", { meIds }, { headers: userHeaders() }) as Promise<HRC1_DucXacNhanResult>,
  boXacNhanDuc: (meIds: number[]) =>
    apiService.post("/api/hrc1/duc/bo-xac-nhan", { meIds }, { headers: userHeaders() }),
  xacNhanPCN: (meIds: number[]) =>
    apiService.post("/api/hrc1/duc/xac-nhan-pcn", { meIds }, { headers: userHeaders() }),
  khongXacNhanPCN: (meIds: number[]) =>
    apiService.post("/api/hrc1/duc/khong-xac-nhan-pcn", { meIds }, { headers: userHeaders() }),
  resetXacNhanPCN: (meIds: number[]) =>
    apiService.post("/api/hrc1/duc/reset-xac-nhan-pcn", { meIds }, { headers: userHeaders() }),
  chotMe: (req: { meIds: number[]; idPhieu: string; idMayDuc: number }) =>
    apiService.post("/api/hrc1/duc/chot-me", req, { headers: userHeaders() }),
  boChotMe: (req: { meIds: number[]; idPhieu: string; idMayDuc: number }) =>
    apiService.post("/api/hrc1/duc/bo-chot-me", req, { headers: userHeaders() }),
  chotPCN: (meIds: number[]) =>
    apiService.post("/api/hrc1/duc/chot-pcn", { meIds }, { headers: userHeaders() }),
  boChotPCN: (meIds: number[]) =>
    apiService.post("/api/hrc1/duc/bo-chot-pcn", { meIds }, { headers: userHeaders() }),

  // Đồng bộ mẻ thổi từ gang lỏng → trả về phiếu cập nhật
  syncLoThoi: (idPhieu: string, loSo: number): Promise<HRC1_PhieuDataVm> =>
    apiService.post(`/api/hrc1/phieu/${idPhieu}/sync-lo-thoi`, { loSo }) as Promise<HRC1_PhieuDataVm>,

  // Đồng bộ phân loại & mác BKMIS từ Linked Server vào HRC1_MeThep
  syncPhanLoaiMeThep: (maMes: string[]): Promise<{ totalFromMySQL: number; totalUpdated: number }> =>
    apiService.post("/api/hrc1/sync-phan-loai-me-thep", { maMes }) as Promise<{ totalFromMySQL: number; totalUpdated: number }>,

  // Xóa cứng mẻ ghost (user chủ động xóa thủ công)
  xoaMeGhost: (meId: number) =>
    apiService.delete(`/api/hrc1/lo-thoi/me/${meId}`, { headers: userHeaders() }),

  // Thêm/xóa mẻ tay (Tinh luyện thêm thủ công)
  searchMeThep: (q: string): Promise<HRC1_MeThepSearchVm[]> =>
    apiService.get("/api/hrc1/tinh-luyen/search-me", { params: { q } }) as Promise<HRC1_MeThepSearchVm[]>,

  themMeTay: (req: { maMe: string; idPhieu: string; xacNhanTrung: boolean; scopePhieu?: number | null }): Promise<HRC1_ThemMeTayResult> =>
    apiService.post("/api/hrc1/tinh-luyen/them-me-tay", req, { headers: userHeaders() }) as Promise<HRC1_ThemMeTayResult>,

  xoaMeTay: (mePhanCongId: number): Promise<void> =>
    apiService.delete(`/api/hrc1/tinh-luyen/me-tay/${mePhanCongId}`, { headers: userHeaders() }),

  // Ghi chú — auto-save on blur; field: "lo" | "tl" | "duc" | "pcn"
  updateGhiChu: (meId: number, ghiChu: string | null, field: "lo" | "tl" | "duc" | "pcn") =>
    apiService.put(`/api/hrc1/me/${meId}/ghi-chu`, { ghiChu, field }, { headers: userHeaders() }),

  // Chốt / hủy chốt phiếu HRC1_BBGN_ThepLong theo batch (từ ThongKe P.KH)
  chotPhieuBatch: (idPhieuList: string[]): Promise<HRC1_ChotPhieuBatchResult> =>
    apiService.post("/api/hrc1/duc/chot-phieu-batch", { idPhieuList }, { headers: userHeaders() }) as Promise<HRC1_ChotPhieuBatchResult>,
  huyChotPhieuBatch: (idPhieuList: string[]): Promise<HRC1_ChotPhieuBatchResult> =>
    apiService.post("/api/hrc1/duc/huy-chot-phieu-batch", { idPhieuList }, { headers: userHeaders() }) as Promise<HRC1_ChotPhieuBatchResult>,

  // Thống kê — dữ liệu từ HRC1_MeThep (thay thế BBGN_ThepLong cũ)
  searchThongKe: (q: HRC1_ThongKeQuery): Promise<HRC1_ThongKeResult> =>
    apiService.get("/api/hrc1/thong-ke", { params: q }) as Promise<HRC1_ThongKeResult>,

  tongHopThongKe: (q: HRC1_ThongKeQuery): Promise<HRC1_TongHopResult> =>
    apiService.get("/api/hrc1/thong-ke/tong-hop", { params: q }) as Promise<HRC1_TongHopResult>,

  exportBulkExcel: async (idPhieuList: string[]): Promise<void> => {
    const baseUrl = import.meta.env.VITE_API_URL as string;
    const token = localStorage.getItem("token");
    const res = await fetch(`${baseUrl}api/hrc1/export/excel/bulk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(idPhieuList),
    });
    if (!res.ok) { const t = await res.text(); throw new Error(t || "Xuất Excel thất bại."); }
    const blob = await res.blob();
    let fileName = `BBGN_ThepLong_${new Date().toISOString().split('T')[0]}.xlsx`;
    const cd = res.headers.get("Content-Disposition");
    if (cd) {
      const m = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(cd);
      if (m?.[1]) fileName = decodeURIComponent(m[1].replace(/['"]/g, ""));
    }
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    window.URL.revokeObjectURL(url);
  },

  exportThongKe: async (q: HRC1_ExportQuery): Promise<void> => {
    const baseUrl = import.meta.env.VITE_API_URL as string;
    const token = localStorage.getItem("token");
    const params = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => { if (v != null) params.append(k, String(v)); });
    const res = await fetch(`${baseUrl}api/hrc1/export/excel?${params.toString()}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) { const t = await res.text(); throw new Error(t || "Xuất Excel thất bại."); }
    const blob = await res.blob();
    let fileName = `HRC1_BBGN_ThepLong_${new Date().toISOString().split('T')[0]}.xlsx`;
    const cd = res.headers.get("Content-Disposition");
    if (cd) {
      const m = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(cd);
      if (m?.[1]) fileName = decodeURIComponent(m[1].replace(/['"]/g, ""));
    }
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    window.URL.revokeObjectURL(url);
  },
};
