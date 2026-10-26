import apiService from "./ApiService";
import type {
  LcXuatCapDanhMucCum,
  LcXuatCapDanhMucCumPayload,
  LcXuatCapDanhMucChiTiet,
  LcXuatCapDanhMucChiTietCreatePayload,
  LcXuatCapDanhMucChiTietUpdatePayload,
  LcPhongBanOption,
} from "../models/LcXuatCapDanhMucModel";

// Backend trả PascalCase hoặc camelCase tùy serializer — map linh hoạt cả hai.
interface BackendChiTiet {
  id?: number; Id?: number;
  idCum?: number; IdCum?: number;
  thuTu?: number; ThuTu?: number;
  chiTietLo?: string | null; ChiTietLo?: string | null;
}

interface BackendCum {
  id?: number; Id?: number;
  scope?: number; Scope?: number;
  thuTu?: number; ThuTu?: number;
  tenCan?: string; TenCan?: string;
  tenCum?: string; TenCum?: string;
  loaiCoc?: string; LoaiCoc?: string;
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

const toChiTiet = (x: BackendChiTiet): LcXuatCapDanhMucChiTiet => ({
  id: x.id ?? x.Id ?? 0,
  idCum: x.idCum ?? x.IdCum ?? 0,
  thuTu: x.thuTu ?? x.ThuTu ?? 0,
  chiTietLo: x.chiTietLo ?? x.ChiTietLo ?? null,
});

const toCum = (x: BackendCum): LcXuatCapDanhMucCum => ({
  id: x.id ?? x.Id ?? 0,
  scope: x.scope ?? x.Scope ?? 0,
  thuTu: x.thuTu ?? x.ThuTu ?? 0,
  tenCan: x.tenCan ?? x.TenCan ?? "",
  tenCum: x.tenCum ?? x.TenCum ?? "",
  loaiCoc: x.loaiCoc ?? x.LoaiCoc ?? "",
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
};
