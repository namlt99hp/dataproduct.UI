import apiService from "./ApiService";

async function downloadBlob(res: Response, fallbackName: string): Promise<void> {
  const blob = await res.blob();
  let fileName = fallbackName;
  const cd = res.headers.get("Content-Disposition");
  if (cd) {
    const m = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(cd);
    if (m?.[1]) fileName = decodeURIComponent(m[1].replace(/['"]/g, ""));
  }
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export interface HrcSlabSearchRequest {
  tuNgay?: string | null;
  denNgay?: string | null;
  tuNgayXL?: string | null;
  denNgayXL?: string | null;
  caSanXuat?: string | null;
  kip?: string | null;
  mayDuc?: number | null;
  meThep?: string | null;
  idSlabs?: string[] | null;
  macThep?: string | null;
  isChot?: boolean | null;
  isTrungIDSlab?: boolean | null;
  isDiffMacThep?: boolean | null;
  isSaiLotName?: boolean | null;
  trangThaiKCS?: number | null;
  trangThaiDuc?: number | null;
  trangThaiKho?: number | null;
  trangThaiPKH?: number | null;
  page?: number;
  pageSize?: number;
}

export interface HrcSlabItem {
  id: number;
  bkmisId?: number | null;
  ngaySanXuat?: string | null;
  ngaySXTheoCa?: string | null;
  shiftName?: string | null;
  caSanXuat?: string | null;
  kipSanXuat?: string | null;
  meThep?: string | null;
  idSlab?: string | null;
  macThep?: string | null;
  chatLuong?: string | null;
  chieuDay?: number | null;
  chieuRong?: number | null;
  chieuDai?: number | null;
  khoiLuong?: number | null;
  khoiLuongTinhToan?: number | null;
  chatLuongTPHH?: string | null;
  thongTinPhoi?: string | null;
  tpKhongDatGangLong?: string | null;
  ghiChu?: string | null;
  loaiPhoi?: string | null;
  sapCode?: string | null;
  sapDescription?: string | null;
  soLo?: string | null;
  orderId?: string | null;
  mayDuc?: number | null;
  isTrungIDSlab?: boolean | null;
  isDiffMacThep?: boolean | null;
  isSaiLotName: boolean;
  line?: number | null;
  sapLastTime?: string | null;
  isChot: boolean;
  ngayTao?: string | null;
  phanLoai?: string | null;
  // Thông tin phiếu BBSL (join từ BM_Phieu khi slab đã được chuyển)
  ngayXuLy?: string | null;
  caBBSL?: number | null;
  kipBBSL?: string | null;
  // Trạng thái workflow
  trangThaiKCS: number;
  trangThaiDuc: number;
  trangThaiKho: number;
  trangThaiPKH: number;
  idPhieuBBSL?: string | null;
  soPhieuBBSL?: string | null;
  // Thời điểm FE bắt được lúc người dùng xác nhận chuyển lên BBSL (khác ngày server ghi nhận)
  thoiDiemThaoTac?: string | null;
  // Người xử lý từng bước
  nguoiChuyenBBSL?: string | null;
  nguoiXacNhanDuc?: string | null;
  nguoiXacNhanKho?: string | null;
  nguoiXacNhanPKH?: string | null;
  // Đánh dấu "đã check" của riêng user đang đăng nhập — độc lập với workflow xác nhận
  daCheck: boolean;
}

export interface HrcSlabSearchResponse {
  data: HrcSlabItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface PhieuBBSLItem {
  idPhieu: string;
  soPhieu?: string | null;
  ngaySX?: string | null;
  ca?: number | null;
  kip?: string | null;
  tinhTrang?: number | null;
  soSlabDaChot: number;
  soSlabDuc: number;
  soSlabKho: number;
  soSlabPKH: number;
}

// ── Thống kê slab (ThongKeSlab.tsx) — API riêng, KHÔNG dùng chung với search. BE gom nhóm
// (pivot) sẵn theo (MayDuc, MacThep, MeThep, OrderId, NgayXuLy, KipBBSL) — chỉ tìm theo 1 ngày
// bắt buộc (+ ca tùy chọn) để lượng dữ liệu xử lý trong 1 lần gọi luôn nhỏ.
export interface ThongKeSlabRequest {
  ngay: string; // bắt buộc, "YYYY-MM-DD"
  ca?: number | null;
}

// 1 dòng đã gom nhóm — field pn_*/png_* khớp đúng dataIndex của bảng (xem THONGKE_SLAB_COLUMNS).
export interface ThongKeSlabRow {
  ca?: number | null;
  ngayLenBBSL?: string | null;
  kipLenBBSL?: string | null;
  mayDuc?: number | null;
  lo?: number | null;
  macThep?: string | null;
  meThep?: string | null;
  lsx?: string | null;
  tongSanLuongPhoi: number;
  hangCXL?: string | null;
  tyLeTieuHao?: number | null;
  [key: string]: unknown; // pn_kichThuoc, pn_loai1_kl, pn_loai1_st, png_loai1_kl, ...
}

export interface SlabTongHopItem {
  meThep?: string | null;
  macThep?: string | null;
  chieuDay?: number | null;
  chieuRong?: number | null;
  chieuDai?: number | null;
  loaiPhoi?: string | null;
  chatLuongTPHH?: string | null;
  phanLoai?: string | null;
  soLuong: number;
  tongKhoiLuong?: number | null;
}

export interface WorkflowResult {
  success: boolean;
  message: string;
  affectedRows: number;
}

export interface SyncStatusItem {
  id: number;
  trangThai?: string | null;
  ngayBatDau?: string | null;
  ngayKetThuc?: string | null;
  batDauLuc?: string | null;
  ketThucLuc?: string | null;
  soRecordSync?: number | null;
  ghiChu?: string | null;
}

const BASE = "/api/hrc2-slab";

export const Hrc2SlabApi = {
  search: async (request: HrcSlabSearchRequest): Promise<HrcSlabSearchResponse> => {
    const res = (await apiService.post(`${BASE}/search`, request)) as HrcSlabSearchResponse;
    return { data: res.data ?? [], totalCount: res.totalCount ?? 0, page: res.page ?? 1, pageSize: res.pageSize ?? 50 };
  },

  getTongHop: async (params: { tuNgay?: string; denNgay?: string; ca?: string; kip?: string }): Promise<SlabTongHopItem[]> => {
    const qs = new URLSearchParams();
    if (params.tuNgay) qs.set("tuNgay", params.tuNgay);
    if (params.denNgay) qs.set("denNgay", params.denNgay);
    if (params.ca) qs.set("ca", params.ca);
    if (params.kip) qs.set("kip", params.kip);
    return (await apiService.get(`${BASE}/tong-hop?${qs}`)) as SlabTongHopItem[];
  },

  // Không truyền "ca" lên: 1 ngày có 2 ca nhưng 3 kíp A/B/C, kíp A hôm nay có thể thuộc ca ngày
  // nhưng vài ngày sau lại thuộc ca đêm — lọc cứng theo ca sẽ bỏ sót phiếu cùng kíp hợp lệ.
  getPhieuBBSL: async (
    kip?: string | null,
    tuNgay?: string | null,
    denNgay?: string | null
  ): Promise<PhieuBBSLItem[]> => {
    const qs = new URLSearchParams();
    if (kip) qs.set("kip", kip);
    if (tuNgay) qs.set("tuNgay", tuNgay);
    if (denNgay) qs.set("denNgay", denNgay);
    return (await apiService.get(`${BASE}/phieu-bbsl?${qs}`)) as PhieuBBSLItem[];
  },

  getRuotPhieu: async (idPhieu: string): Promise<SlabTongHopItem[]> => {
    return (await apiService.get(`${BASE}/ruot-phieu/${idPhieu}`)) as SlabTongHopItem[];
  },

  getSlabsByPhieu: async (idPhieu: string, currentUserId?: number): Promise<HrcSlabItem[]> => {
    const qs = currentUserId != null ? `?currentUserId=${currentUserId}` : "";
    return (await apiService.get(`${BASE}/slabs-by-phieu/${idPhieu}${qs}`)) as HrcSlabItem[];
  },

  thongKeSlab: async (request: ThongKeSlabRequest): Promise<ThongKeSlabRow[]> => {
    return (await apiService.post(`${BASE}/thong-ke-slab`, request)) as ThongKeSlabRow[];
  },

  chuyenBBSL: async (
    idSlabs: number[],
    idPhieu: string,
    nguoiThucHien: number,
    thoiDiemThaoTac?: string
  ): Promise<WorkflowResult> => {
    return (await apiService.post(`${BASE}/chuyen-bbsl`, { idSlabs, idPhieu, nguoiThucHien, thoiDiemThaoTac })) as WorkflowResult;
  },

  thuHoi: async (idSlabs: number[], nguoiThucHien: number): Promise<WorkflowResult> => {
    return (await apiService.post(`${BASE}/thu-hoi`, { idSlabs, nguoiThucHien })) as WorkflowResult;
  },

  xacNhan: async (idSlabs: number[], loaiXacNhan: "KCS" | "Duc" | "Kho" | "PKH", nguoiThucHien: number): Promise<WorkflowResult> => {
    return (await apiService.post(`${BASE}/xac-nhan`, { idSlabs, loaiXacNhan, nguoiThucHien })) as WorkflowResult;
  },

  huyXacNhan: async (idSlabs: number[], loaiXacNhan: "KCS" | "Duc" | "Kho" | "PKH", nguoiThucHien: number): Promise<WorkflowResult> => {
    return (await apiService.post(`${BASE}/huy-xac-nhan`, { idSlabs, loaiXacNhan, nguoiThucHien })) as WorkflowResult;
  },

  chotPhieu: async (idPhieu: string, nguoiThucHien: number): Promise<WorkflowResult> => {
    return (await apiService.post(`${BASE}/chot-phieu`, { idPhieu, nguoiThucHien })) as WorkflowResult;
  },

  huyChotPhieu: async (idPhieu: string, nguoiThucHien: number): Promise<WorkflowResult> => {
    return (await apiService.post(`${BASE}/huy-chot-phieu`, { idPhieu, nguoiThucHien })) as WorkflowResult;
  },

  check: async (idSlabs: number[], nguoiThucHien: number): Promise<WorkflowResult> => {
    return (await apiService.post(`${BASE}/check`, { idSlabs, nguoiThucHien })) as WorkflowResult;
  },

  unCheck: async (idSlabs: number[], nguoiThucHien: number): Promise<WorkflowResult> => {
    return (await apiService.post(`${BASE}/un-check`, { idSlabs, nguoiThucHien })) as WorkflowResult;
  },

  sync: async (ngayBatDau?: string | null, ngayKetThuc?: string | null): Promise<SyncStatusItem> => {
    return (await apiService.post(`${BASE}/sync`, { ngayBatDau, ngayKetThuc })) as SyncStatusItem;
  },

  getSyncStatus: async (): Promise<SyncStatusItem | null> => {
    try {
      return (await apiService.get(`${BASE}/sync/status`)) as SyncStatusItem;
    } catch {
      return null;
    }
  },

  exportExcel: async (idPhieu: string, tab: "chitiet" | "tonghop", currentUserId?: number): Promise<void> => {
    const token = localStorage.getItem("token");
    const apiUrl = (import.meta.env.VITE_API_URL as string).replace(/\/$/, "");
    const userQs = currentUserId != null ? `&currentUserId=${currentUserId}` : "";
    const res = await fetch(
      `${apiUrl}${BASE}/export/excel?idPhieu=${encodeURIComponent(idPhieu)}&tab=${tab}${userQs}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );
    if (!res.ok) throw new Error("Lỗi xuất Excel");
    await downloadBlob(res, `HRC2_PhoiTam_${tab}_${idPhieu}.xlsx`);
  },

  exportPdf: async (idPhieu: string): Promise<void> => {
    const token = localStorage.getItem("token");
    const apiUrl = (import.meta.env.VITE_API_URL as string).replace(/\/$/, "");
    const res = await fetch(
      `${apiUrl}${BASE}/export/pdf?idPhieu=${encodeURIComponent(idPhieu)}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );
    if (!res.ok) throw new Error("Lỗi xuất PDF");
    await downloadBlob(res, `HRC2_BBXNSL_PhoiTam_${idPhieu}.pdf`);
  },
};
