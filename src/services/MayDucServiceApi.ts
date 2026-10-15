import apiService from "./ApiService";
export { NhaMayEnum } from "../models/SiloModel";
import type { NhaMayEnum } from "../models/SiloModel";

export interface MayDuc {
  id: number;
  tenMayDuc: string;
  nhaMay: number;
  isLock?: boolean | null;
  loaiMayDuc?: string | null;
}

export interface MayDucPayload {
  tenMayDuc: string;
  nhaMay: NhaMayEnum;
  isLock?: boolean | null;
  loaiMayDuc?: string | null;
}

export interface MayDucSearchResponse {
  data: MayDuc[];
  totalRecords: number;
  page: number;
  pageSize: number;
}

export const MayDucServiceApi = {
  search: async (params: {
    searchKey?: string;
    nhaMay?: number;
    isLock?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<MayDucSearchResponse> => {
    const q: Record<string, string | number | boolean> = {};
    if (params.searchKey) q.searchKey = params.searchKey;
    if (params.nhaMay != null) q.nhaMay = params.nhaMay;
    if (params.isLock !== undefined) q.isLock = params.isLock;
    if (params.page) q.page = params.page;
    if (params.pageSize) q.pageSize = params.pageSize;
    const res = (await apiService.get("/api/MayDuc/search", { params: q })) as MayDucSearchResponse;
    return {
      data: res.data ?? [],
      totalRecords: res.totalRecords ?? 0,
      page: res.page ?? 1,
      pageSize: res.pageSize ?? 10,
    };
  },

  create: async (payload: MayDucPayload): Promise<MayDuc> => {
    return (await apiService.post("/api/MayDuc", payload)) as MayDuc;
  },

  update: async (id: number, payload: MayDucPayload): Promise<void> => {
    await apiService.put(`/api/MayDuc/${id}`, payload);
  },

  // Không có xóa cứng — Id máy đúc là scope của phiếu/quyền/mẻ, chỉ được khóa
  lock: async (id: number): Promise<void> => {
    await apiService.put(`/api/MayDuc/${id}/lock`);
  },
};
