import apiService from "./ApiService";
import type { LcSilo, LcSiloPayload, LcCumThap, LcCumThapPayload } from "../models/LcDanhMucModel";

// Backend trả PascalCase hoặc camelCase tùy serializer — map linh hoạt cả hai.
interface BackendLcSilo {
  id?: number; Id?: number;
  scope?: number; Scope?: number;
  siloSo?: number; SiloSo?: number;
  tenSilo?: string | null; TenSilo?: string | null;
  loaiSilo?: string; LoaiSilo?: string;
  thuTu?: number | null; ThuTu?: number | null;
  ngayTao?: string | null; NgayTao?: string | null;
}

interface BackendLcCumThap {
  id?: number; Id?: number;
  scope?: number; Scope?: number;
  ma?: string; Ma?: string;
  ten?: string | null; Ten?: string | null;
  thuTu?: number | null; ThuTu?: number | null;
  ngayTao?: string | null; NgayTao?: string | null;
}

const toSiloModel = (x: BackendLcSilo): LcSilo => ({
  id: x.id ?? x.Id ?? 0,
  scope: x.scope ?? x.Scope ?? 0,
  siloSo: x.siloSo ?? x.SiloSo ?? 0,
  tenSilo: x.tenSilo ?? x.TenSilo ?? null,
  loaiSilo: x.loaiSilo ?? x.LoaiSilo ?? "THAN",
  thuTu: x.thuTu ?? x.ThuTu ?? null,
  ngayTao: x.ngayTao ?? x.NgayTao ?? null,
});

const toCumThapModel = (x: BackendLcCumThap): LcCumThap => ({
  id: x.id ?? x.Id ?? 0,
  scope: x.scope ?? x.Scope ?? 0,
  ma: x.ma ?? x.Ma ?? "",
  ten: x.ten ?? x.Ten ?? null,
  thuTu: x.thuTu ?? x.ThuTu ?? null,
  ngayTao: x.ngayTao ?? x.NgayTao ?? null,
});

export const LcSiloApi = {
  search: async (scope?: number | null): Promise<LcSilo[]> => {
    const params = scope != null ? { scope } : undefined;
    const response = (await apiService.get("/api/LC_Silo", { params })) as BackendLcSilo[];
    return Array.isArray(response) ? response.map(toSiloModel) : [];
  },
  create: async (payload: LcSiloPayload): Promise<LcSilo> => {
    const response = (await apiService.post("/api/LC_Silo", payload)) as BackendLcSilo;
    return toSiloModel(response);
  },
  update: async (id: number, payload: LcSiloPayload): Promise<void> => {
    await apiService.put(`/api/LC_Silo/${id}`, payload);
  },
  delete: async (id: number): Promise<void> => {
    await apiService.delete(`/api/LC_Silo/${id}`);
  },
};

export const LcCumThapApi = {
  search: async (scope?: number | null): Promise<LcCumThap[]> => {
    const params = scope != null ? { scope } : undefined;
    const response = (await apiService.get("/api/LC_CumThap", { params })) as BackendLcCumThap[];
    return Array.isArray(response) ? response.map(toCumThapModel) : [];
  },
  create: async (payload: LcCumThapPayload): Promise<LcCumThap> => {
    const response = (await apiService.post("/api/LC_CumThap", payload)) as BackendLcCumThap;
    return toCumThapModel(response);
  },
  update: async (id: number, payload: LcCumThapPayload): Promise<void> => {
    await apiService.put(`/api/LC_CumThap/${id}`, payload);
  },
  delete: async (id: number): Promise<void> => {
    await apiService.delete(`/api/LC_CumThap/${id}`);
  },
};
