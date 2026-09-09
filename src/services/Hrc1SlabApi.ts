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

export interface Hrc1SlabSearchRequest {
  tuNgay?: string | null;
  denNgay?: string | null;
  caSX?: string | null;
  kipSX?: string | null;
  mayDuc?: string | null;
  maMe?: string | null;
  idSlab?: string | null;
  macThep?: string | null;
  isChot?: boolean | null;
  trangThaiDuc?: number | null;
  trangThaiCan?: number | null;
  trangThaiC4?: boolean | null;
  trangThaiPKH?: number | null;
  page?: number;
  pageSize?: number;
}

export interface Hrc1SlabItem {
  id: number;
  idSlab: string;
  idPiece?: string | null;
  maMe?: string | null;
  macThep?: string | null;
  ngaySX?: string | null;
  caSX?: string | null;
  kipSX?: string | null;
  mayDuc?: string | null;
  cutDate?: string | null;
  chieuDay?: number | null;
  chieuRong?: number | null;
  chieuDai?: number | null;
  khoiLuong?: number | null;
  ngayTao: string;
  ngayCapNhat?: string | null;
  ghiChu?: string | null;
  maVatTu?: string | null;
  tenVatTu?: string | null;
  // Đã qua "Sửa slab thủ công" (tồn tại record Hrc1SlabEdit) — dùng để highlight dòng ở FE.
  isManualEdited: boolean;
  // Workflow
  isChuyenCa: boolean;
  idPhieuGoc?: string | null;
  trangThaiDuc: number;
  trangThaiCan: number;
  trangThaiC4: boolean;
  trangThaiPKH: number;
  idPhieuBBSL?: string | null;
  soPhieuBBSL?: string | null;
  ngayXuLy?: string | null;
  caBBSL?: number | null;
  kipBBSL?: string | null;
}

export interface Hrc1TongHopGhiChuItem {
  macThep?: string | null;
  maVatTu?: string | null;
  ghiChu?: string | null;
}

export interface Hrc1SlabSearchResponse {
  data: Hrc1SlabItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface Hrc1PhieuBBSLItem {
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

export interface Hrc1SlabTongHopItem {
  maMe?: string | null;
  macThep?: string | null;
  chieuDay?: number | null;
  chieuRong?: number | null;
  chieuDai?: number | null;
  mayDuc?: string | null;
  soLuong: number;
  tongKhoiLuong?: number | null;
}

export interface Hrc1SlabSyncResult {
  success: boolean;
  totalFromApi: number;
  rowsUpserted: number;
  macThepFilled: number;
  message: string;
}

export interface WorkflowResult {
  success: boolean;
  message: string;
  affectedRows: number;
}

// NgaySX/CaSX/KipSX KHÔNG gửi từ client — BE tự lấy từ phiếu (idPhieu) để slab mới luôn
// khớp đúng phiếu đang xem.
export interface Hrc1SlabCreateRequest {
  idPhieu: string;
  idSlab: string;
  idPiece?: string | null;
  maMe?: string | null;
  macThep?: string | null;
  mayDuc?: string | null;
  cutDate?: string | null;
  chieuDay?: number | null;
  chieuRong?: number | null;
  chieuDai?: number | null;
  khoiLuong?: number | null;
}

// Cùng bộ field với Hrc1SlabCreateRequest — dùng cho popup "Sửa" (PUT, full-replace), khác
// updateSlab (PATCH, chỉ ghiChu/maVatTu, dùng cho inline-edit).
export interface Hrc1SlabEditRequest {
  idSlab: string;
  idPiece?: string | null;
  maMe?: string | null;
  macThep?: string | null;
  mayDuc?: string | null;
  cutDate?: string | null;
  chieuDay?: number | null;
  chieuRong?: number | null;
  chieuDai?: number | null;
  khoiLuong?: number | null;
}

const BASE = "/api/hrc1-slab";

export const Hrc1SlabApi = {
  search: async (req: Hrc1SlabSearchRequest): Promise<Hrc1SlabSearchResponse> => {
    const res = (await apiService.post(`${BASE}/search`, req)) as Hrc1SlabSearchResponse;
    return { data: res.data ?? [], totalCount: res.totalCount ?? 0, page: res.page ?? 1, pageSize: res.pageSize ?? 50 };
  },

  getTongHop: async (params: { tuNgay?: string; denNgay?: string; ca?: string; kip?: string }): Promise<Hrc1SlabTongHopItem[]> => {
    const qs = new URLSearchParams();
    if (params.tuNgay)  qs.set("tuNgay", params.tuNgay);
    if (params.denNgay) qs.set("denNgay", params.denNgay);
    if (params.ca)  qs.set("ca", params.ca);
    if (params.kip) qs.set("kip", params.kip);
    return (await apiService.get(`${BASE}/tong-hop?${qs}`)) as Hrc1SlabTongHopItem[];
  },

  getPhieuBBSL: async (kip?: string | null, ca?: number | null): Promise<Hrc1PhieuBBSLItem[]> => {
    const qs = new URLSearchParams();
    if (kip) qs.set("kip", kip);
    if (ca != null) qs.set("ca", String(ca));
    return (await apiService.get(`${BASE}/phieu-bbsl?${qs}`)) as Hrc1PhieuBBSLItem[];
  },

  getRuotPhieu: async (idPhieu: string): Promise<Hrc1SlabTongHopItem[]> => {
    return (await apiService.get(`${BASE}/ruot-phieu/${idPhieu}`)) as Hrc1SlabTongHopItem[];
  },

  getSlabsByPhieu: async (idPhieu: string): Promise<Hrc1SlabItem[]> => {
    return (await apiService.get(`${BASE}/slabs-by-phieu/${idPhieu}`)) as Hrc1SlabItem[];
  },

  chuyenPhoi: async (
    idSlabs: number[],
    idPhieuNguon: string,
    huong: "truoc" | "sau",
    nguoiChuyen: number
  ): Promise<WorkflowResult> => {
    return (await apiService.post(`${BASE}/chuyen-phoi`, { idSlabs, idPhieuNguon, huong, nguoiChuyen })) as WorkflowResult;
  },

  xacNhan: async (idSlabs: number[], loaiXacNhan: "Duc" | "Can" | "C4" | "PKH", nguoiThucHien: number): Promise<WorkflowResult> => {
    return (await apiService.post(`${BASE}/xac-nhan`, { idSlabs, loaiXacNhan, nguoiThucHien })) as WorkflowResult;
  },

  huyXacNhan: async (idSlabs: number[], loaiXacNhan: "Duc" | "Can" | "C4" | "PKH", nguoiThucHien: number): Promise<WorkflowResult> => {
    return (await apiService.post(`${BASE}/huy-xac-nhan`, { idSlabs, loaiXacNhan, nguoiThucHien })) as WorkflowResult;
  },

  chotPhieu: async (idPhieu: string, nguoiThucHien: number): Promise<WorkflowResult> => {
    return (await apiService.post(`${BASE}/chot-phieu`, { idPhieu, nguoiThucHien })) as WorkflowResult;
  },

  huyChotPhieu: async (idPhieu: string, nguoiThucHien: number): Promise<WorkflowResult> => {
    return (await apiService.post(`${BASE}/huy-chot-phieu`, { idPhieu, nguoiThucHien })) as WorkflowResult;
  },

  sync: async (ngaySX: string, caSX: number): Promise<Hrc1SlabSyncResult> => {
    return (await apiService.post(`${BASE}/sync`, { ngaySX, caSX })) as Hrc1SlabSyncResult;
  },

  fillMacThep: async (): Promise<WorkflowResult> => {
    return (await apiService.post(`${BASE}/fill-mac-thep`, {})) as WorkflowResult;
  },

  updateSlab: async (id: number, payload: { ghiChu?: string | null; maVatTu?: string | null }): Promise<WorkflowResult> => {
    return (await apiService.patch(`${BASE}/${id}`, payload)) as WorkflowResult;
  },

  createSlab: async (payload: Hrc1SlabCreateRequest): Promise<Hrc1SlabItem> => {
    return (await apiService.post(`${BASE}/create`, payload)) as Hrc1SlabItem;
  },

  editSlab: async (id: number, payload: Hrc1SlabEditRequest): Promise<WorkflowResult> => {
    return (await apiService.put(`${BASE}/${id}`, payload)) as WorkflowResult;
  },

  deleteSlabs: async (idSlabs: number[], nguoiThucHien: number): Promise<WorkflowResult> => {
    return (await apiService.post(`${BASE}/xoa`, { idSlabs, nguoiThucHien })) as WorkflowResult;
  },

  restoreSlabs: async (idSlabs: number[], nguoiThucHien: number): Promise<WorkflowResult> => {
    return (await apiService.post(`${BASE}/khoi-phuc`, { idSlabs, nguoiThucHien })) as WorkflowResult;
  },

  getTongHopGhiChu: async (idPhieu: string): Promise<Hrc1TongHopGhiChuItem[]> => {
    return (await apiService.get(`${BASE}/tonghop-ghi-chu/${idPhieu}`)) as Hrc1TongHopGhiChuItem[];
  },

  saveTongHopGhiChu: async (req: { idPhieuBBSL: string; macThep?: string | null; maVatTu?: string | null; ghiChu?: string | null }): Promise<WorkflowResult> => {
    return (await apiService.post(`${BASE}/tonghop-ghi-chu`, req)) as WorkflowResult;
  },

  exportExcel: async (idPhieu: string, tab: "chitiet" | "tonghop", ngay: string, ca: number, kip?: string | null): Promise<void> => {
    const token = localStorage.getItem("token");
    const apiUrl = (import.meta.env.VITE_API_URL as string).replace(/\/$/, "");
    const res = await fetch(
      `${apiUrl}${BASE}/export/excel?idPhieu=${encodeURIComponent(idPhieu)}&tab=${tab}&ngay=${encodeURIComponent(ngay)}&ca=${ca}${kip ? `&kip=${encodeURIComponent(kip)}` : ""}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );
    if (!res.ok) throw new Error("Lỗi xuất Excel");
    await downloadBlob(res, `HRC1_PhoiTam_${tab}_${ngay}_${ca}${kip}.xlsx`);
  },

  exportPdf: async (idPhieu: string, ngay: string, ca: number, kip?: string | null): Promise<void> => {
    const token = localStorage.getItem("token");
    const apiUrl = (import.meta.env.VITE_API_URL as string).replace(/\/$/, "");
    const res = await fetch(
      `${apiUrl}${BASE}/export/pdf?idPhieu=${encodeURIComponent(idPhieu)}&ngay=${encodeURIComponent(ngay)}&ca=${ca}${kip ? `&kip=${encodeURIComponent(kip)}` : ""}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );
    if (!res.ok) throw new Error("Lỗi xuất PDF");
    await downloadBlob(res, `HRC1_BBXNSL_PhoiTam_${ngay}_${ca}${kip}.pdf`);
  },
};
