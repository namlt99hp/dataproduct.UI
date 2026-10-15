import apiService from "./ApiService";

export interface DonTrongPhoi {
  id: number;
  macPhoi: string;
  donTrong: number;
  mac?: string | null;
  kichThuoc?: string | null;
  isXacNhan?: number | null;
  maVatTu?: string | null;
  tenVatTu?: string | null;
  isSync?: number | null;
  isLock?: number | null;
}

export interface DonTrongPhoiPayload {
  macPhoi: string;
  donTrong: number;
  mac?: string | null;
  kichThuoc?: string | null;
  isXacNhan?: number | null;
}

export interface DonTrongPhoiSearchResponse {
  data: DonTrongPhoi[];
  totalRecords: number;
  page: number;
  pageSize: number;
}

export interface ImportDonTrongPhoiResult {
  created: number;
  updated: number;
  errors: string[];
}

export const DonTrongPhoiServiceApi = {
  search: async (params: {
    searchKey?: string;
    mac?: string;
    kichThuoc?: string;
    isXacNhan?: number | null;
    maVatTu?: string;
    page?: number;
    pageSize?: number;
  }): Promise<DonTrongPhoiSearchResponse> => {
    const q: Record<string, string | number> = {};
    if (params.searchKey) q.searchKey = params.searchKey;
    if (params.mac) q.mac = params.mac;
    if (params.kichThuoc) q.kichThuoc = params.kichThuoc;
    if (params.isXacNhan != null) q.isXacNhan = params.isXacNhan;
    if (params.maVatTu) q.maVatTu = params.maVatTu;
    if (params.page) q.page = params.page;
    if (params.pageSize) q.pageSize = params.pageSize;
    const res = (await apiService.get("/api/DonTrongPhoi/search", { params: q })) as DonTrongPhoiSearchResponse;
    return {
      data: res.data ?? [],
      totalRecords: res.totalRecords ?? 0,
      page: res.page ?? 1,
      pageSize: res.pageSize ?? 30,
    };
  },

  getAll: async (options?: { excludeLocked?: boolean }): Promise<DonTrongPhoi[]> => {
    const params: Record<string, string> = {};
    if (options?.excludeLocked) params.excludeLocked = "true";
    return (await apiService.get("/api/DonTrongPhoi", { params })) as DonTrongPhoi[];
  },

  toggleLock: async (id: number): Promise<void> => {
    await apiService.put(`/api/DonTrongPhoi/${id}/toggle-lock`, {});
  },

  create: async (payload: DonTrongPhoiPayload): Promise<DonTrongPhoi> => {
    return (await apiService.post("/api/DonTrongPhoi", payload)) as DonTrongPhoi;
  },

  update: async (id: number, payload: DonTrongPhoiPayload): Promise<void> => {
    await apiService.put(`/api/DonTrongPhoi/${id}`, payload);
  },

  delete: async (id: number): Promise<void> => {
    await apiService.delete(`/api/DonTrongPhoi/${id}`);
  },

  exportExcel: async (): Promise<void> => {
    const blob = (await apiService.get("/api/DonTrongPhoi/export-excel", {
      responseType: "blob",
    })) as unknown as Blob;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    a.href = url;
    a.download = `DonTrongPhoi_${ts}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importExcel: async (file: File): Promise<ImportDonTrongPhoiResult> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = (await apiService.post("/api/DonTrongPhoi/import-excel", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })) as ImportDonTrongPhoiResult;
    return res;
  },

  syncMaVatTu: async (): Promise<void> => {
    await apiService.post("/api/DonTrongPhoi/sync-ma-vat-tu", {});
  },
};
