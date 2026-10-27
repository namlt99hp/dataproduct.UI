import apiService from "./ApiService";
import type {
  LcXuatCapDanhMucCum,
  LcXuatCapDanhMucCumPayload,
  LcXuatCapDanhMucChiTiet,
  LcXuatCapDanhMucChiTietCreatePayload,
  LcXuatCapDanhMucChiTietUpdatePayload,
  LcPhongBanOption,
  LcXuatCapCumOption,
  LcXuatCapLoaiOption,
} from "../models/LcXuatCapDanhMucModel";

// Backend trả PascalCase hoặc camelCase tùy serializer — map linh hoạt cả hai.
interface BackendChiTiet {
  id?: number; Id?: number;
  idNoiNhan?: number; IdNoiNhan?: number;
  thuTu?: number; ThuTu?: number;
  chiTietLo?: string | null; ChiTietLo?: string | null;
  idLoaiNhan?: number | null; IdLoaiNhan?: number | null;
  tenLoaiNhan?: string | null; TenLoaiNhan?: string | null;
}

interface BackendCum {
  id?: number; Id?: number;
  scope?: number; Scope?: number;
  idCum?: number; IdCum?: number;
  maCum?: string; MaCum?: string;
  tenCumThat?: string; TenCumThat?: string;
  thuTu?: number; ThuTu?: number;
  tenCan?: string; TenCan?: string;
  noiNhan?: string; NoiNhan?: string;
  idLoaiCoc?: number; IdLoaiCoc?: number;
  tenLoaiCoc?: string; TenLoaiCoc?: string;
  nhomTongHop?: string; NhomTongHop?: string;
  idPhongBan?: number | null; IdPhongBan?: number | null;
  tenPhongBan?: string | null; TenPhongBan?: string | null;
  ngayTao?: string | null; NgayTao?: string | null;
  chiTiet?: BackendChiTiet[]; ChiTiet?: BackendChiTiet[];
}

interface BackendPhongBanOption {
  idPhongBan?: number; IdPhongBan?: number;
  tenPhongBan?: string | null; TenPhongBan?: string | null;
  tenNgan?: string | null; TenNgan?: string | null;
}

interface BackendCumOption {
  id?: number; Id?: number;
  scope?: number; Scope?: number;
  ma?: string; Ma?: string;
  ten?: string; Ten?: string;
  thuTu?: number; ThuTu?: number;
}

interface BackendLoaiOption {
  id?: number; Id?: number;
  ten?: string; Ten?: string;
  thuTu?: number; ThuTu?: number;
}

const toChiTiet = (x: BackendChiTiet): LcXuatCapDanhMucChiTiet => ({
  id: x.id ?? x.Id ?? 0,
  idNoiNhan: x.idNoiNhan ?? x.IdNoiNhan ?? 0,
  thuTu: x.thuTu ?? x.ThuTu ?? 0,
  chiTietLo: x.chiTietLo ?? x.ChiTietLo ?? null,
  idLoaiNhan: x.idLoaiNhan ?? x.IdLoaiNhan ?? null,
  tenLoaiNhan: x.tenLoaiNhan ?? x.TenLoaiNhan ?? null,
});

const toCum = (x: BackendCum): LcXuatCapDanhMucCum => ({
  id: x.id ?? x.Id ?? 0,
  scope: x.scope ?? x.Scope ?? 0,
  idCum: x.idCum ?? x.IdCum ?? 0,
  maCum: x.maCum ?? x.MaCum ?? "",
  tenCumThat: x.tenCumThat ?? x.TenCumThat ?? "",
  thuTu: x.thuTu ?? x.ThuTu ?? 0,
  tenCan: x.tenCan ?? x.TenCan ?? "",
  noiNhan: x.noiNhan ?? x.NoiNhan ?? "",
  idLoaiCoc: x.idLoaiCoc ?? x.IdLoaiCoc ?? 0,
  tenLoaiCoc: x.tenLoaiCoc ?? x.TenLoaiCoc ?? "",
  nhomTongHop: x.nhomTongHop ?? x.NhomTongHop ?? "",
  idPhongBan: x.idPhongBan ?? x.IdPhongBan ?? null,
  tenPhongBan: x.tenPhongBan ?? x.TenPhongBan ?? null,
  ngayTao: x.ngayTao ?? x.NgayTao ?? null,
  chiTiet: (x.chiTiet ?? x.ChiTiet ?? []).map(toChiTiet),
});

const toPhongBanOption = (x: BackendPhongBanOption): LcPhongBanOption => ({
  idPhongBan: x.idPhongBan ?? x.IdPhongBan ?? 0,
  tenPhongBan: x.tenPhongBan ?? x.TenPhongBan ?? null,
  tenNgan: x.tenNgan ?? x.TenNgan ?? null,
});

const toCumOption = (x: BackendCumOption): LcXuatCapCumOption => ({
  id: x.id ?? x.Id ?? 0,
  scope: x.scope ?? x.Scope ?? 0,
  ma: x.ma ?? x.Ma ?? "",
  ten: x.ten ?? x.Ten ?? "",
  thuTu: x.thuTu ?? x.ThuTu ?? 0,
});

const toLoaiOption = (x: BackendLoaiOption): LcXuatCapLoaiOption => ({
  id: x.id ?? x.Id ?? 0,
  ten: x.ten ?? x.Ten ?? "",
  thuTu: x.thuTu ?? x.ThuTu ?? 0,
});

export const LcXuatCapDanhMucApi = {
  searchCum: async (scope?: number | null): Promise<LcXuatCapDanhMucCum[]> => {
    const params = scope != null ? { scope } : undefined;
    const response = (await apiService.get("/api/LC_XuatCapDanhMuc/cum", { params })) as BackendCum[];
    return Array.isArray(response) ? response.map(toCum) : [];
  },
  createCum: async (payload: LcXuatCapDanhMucCumPayload): Promise<LcXuatCapDanhMucCum> => {
    const response = (await apiService.post("/api/LC_XuatCapDanhMuc/cum", payload)) as BackendCum;
    return toCum(response);
  },
  updateCum: async (id: number, payload: LcXuatCapDanhMucCumPayload): Promise<void> => {
    await apiService.put(`/api/LC_XuatCapDanhMuc/cum/${id}`, payload);
  },
  deleteCum: async (id: number): Promise<void> => {
    await apiService.delete(`/api/LC_XuatCapDanhMuc/cum/${id}`);
  },
  createChiTiet: async (payload: LcXuatCapDanhMucChiTietCreatePayload): Promise<LcXuatCapDanhMucChiTiet> => {
    const response = (await apiService.post("/api/LC_XuatCapDanhMuc/chitiet", payload)) as BackendChiTiet;
    return toChiTiet(response);
  },
  updateChiTiet: async (id: number, payload: LcXuatCapDanhMucChiTietUpdatePayload): Promise<void> => {
    await apiService.put(`/api/LC_XuatCapDanhMuc/chitiet/${id}`, payload);
  },
  deleteChiTiet: async (id: number): Promise<void> => {
    await apiService.delete(`/api/LC_XuatCapDanhMuc/chitiet/${id}`);
  },
  getPhongBanOptions: async (): Promise<LcPhongBanOption[]> => {
    const response = (await apiService.get("/api/LC_XuatCapDanhMuc/phongban-options")) as BackendPhongBanOption[];
    return Array.isArray(response) ? response.map(toPhongBanOption) : [];
  },
  getCumOptions: async (scope?: number | null): Promise<LcXuatCapCumOption[]> => {
    const params = scope != null ? { scope } : undefined;
    const response = (await apiService.get("/api/LC_XuatCapDanhMuc/cum-options", { params })) as BackendCumOption[];
    return Array.isArray(response) ? response.map(toCumOption) : [];
  },
  getLoaiCocOptions: async (): Promise<LcXuatCapLoaiOption[]> => {
    const response = (await apiService.get("/api/LC_XuatCapDanhMuc/loaicoc-options")) as BackendLoaiOption[];
    return Array.isArray(response) ? response.map(toLoaiOption) : [];
  },
  getLoaiNhanOptions: async (): Promise<LcXuatCapLoaiOption[]> => {
    const response = (await apiService.get("/api/LC_XuatCapDanhMuc/loainhan-options")) as BackendLoaiOption[];
    return Array.isArray(response) ? response.map(toLoaiOption) : [];
  },
};
