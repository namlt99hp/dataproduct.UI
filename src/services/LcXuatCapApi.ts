import apiService from "./ApiService";
import type { XuatCapNguonBbgn, XuatCapSlot } from "../components/LC_BCSX_XNL/TabXuatCapCoc";

// Đọc/lưu trực tiếp bảng quan hệ LC_XuatCap (+ LC_XuatCapNguon) cho tab "Xuất/Cấp cốc"
// (`xuatCapCoc`, TabXuatCapCoc.tsx) — KHÔNG qua BmPhieu.DataJson, cùng nguyên tắc với
// LcSiloCocTonApi/LcPhoiTronApi. Xem Repositories/NM.LC/LC_XuatCapRepository.cs,
// .claude/LuyenCoc/PhanTich_TabCapCoc.md §10/§11.
//
// SỬA 2026-10-26: KHÔNG còn Initializer — `GetByPhieu` trả FULL layout (mọi Nơi nhận×Chi tiết
// của Scope) ghép với dữ liệu đã có của phiếu; slot chưa ai nhập/gán có `id=0` (ảo). Khoá dùng để
// Lưu/Gán là `idDanhMucChiTiet` (ổn định), KHÔNG còn dùng `id`.

interface BackendNguon {
  id?: number; Id?: number;
  idBbgn?: number; IdBbgn?: number;
  idCtBbgn?: number; IdCtBbgn?: number;
  khoiLuongGan?: number | null; KhoiLuongGan?: number | null;
  doAmGan?: number | null; DoAmGan?: number | null;
}

interface BackendSlot {
  id?: number; Id?: number;
  idDanhMucChiTiet?: number; IdDanhMucChiTiet?: number;
  thuTu?: number; ThuTu?: number;
  tenCan?: string; TenCan?: string;
  noiNhan?: string; NoiNhan?: string;
  chiTietLo?: string | null; ChiTietLo?: string | null;
  loaiCoc?: string; LoaiCoc?: string;
  nhomTongHop?: string; NhomTongHop?: string;
  idPhongBan?: number | null; IdPhongBan?: number | null;
  tenPhongBan?: string | null; TenPhongBan?: string | null;
  idDanhMucCum?: number | null; IdDanhMucCum?: number | null;
  idCum?: number | null; IdCum?: number | null;
  maCum?: string | null; MaCum?: string | null;
  tenCum?: string | null; TenCum?: string | null;
  idLoaiNhan?: number | null; IdLoaiNhan?: number | null;
  tenLoaiNhan?: string | null; TenLoaiNhan?: string | null;
  khoiLuongAm?: number | null; KhoiLuongAm?: number | null;
  doAm?: number | null; DoAm?: number | null;
  tyKhoi?: number | null; TyKhoi?: number | null;
  klQuyKho?: number | null; KLQuyKho?: number | null;
  trongCa?: number | null; TrongCa?: number | null;
  luyKe?: number | null; LuyKe?: number | null;
  ghiChu?: string | null; GhiChu?: string | null;
  nguon?: BackendNguon[]; Nguon?: BackendNguon[];
}

interface BackendNguonBbgn {
  idBbgn?: number; IdBbgn?: number;
  idCtBbgn?: number; IdCtBbgn?: number;
  soPhieu?: string | null; SoPhieu?: string | null;
  ngay?: string | null; Ngay?: string | null;
  ca?: string | null; Ca?: string | null;
  kip?: string | null; Kip?: string | null;
  idXuongBg?: number | null; IdXuongBg?: number | null;
  idXuongBn?: number | null; IdXuongBn?: number | null;
  idPhongBanBn?: number | null; IdPhongBanBn?: number | null;
  tenXuongBn?: string | null; TenXuongBn?: string | null;
  tenPhongBanBn?: string | null; TenPhongBanBn?: string | null;
  idVatTu?: number | null; IdVatTu?: number | null;
  tenVatTu?: string | null; TenVatTu?: string | null;
  maLo?: string | null; MaLo?: string | null;
  khoiLuongBg?: number | null; KhoiLuongBg?: number | null;
  doAmW?: number | null; DoAmW?: number | null;
  klQuyKhoBg?: number | null; KlQuyKhoBg?: number | null;
  idTrangThaiBbgn?: number | null; IdTrangThaiBbgn?: number | null;
  ghiChu?: string | null; GhiChu?: string | null;
}

const toNguon = (x: BackendNguon) => ({
  id: x.id ?? x.Id ?? 0,
  idBbgn: x.idBbgn ?? x.IdBbgn ?? 0,
  idCtBbgn: x.idCtBbgn ?? x.IdCtBbgn ?? 0,
  khoiLuongGan: x.khoiLuongGan ?? x.KhoiLuongGan ?? null,
  doAmGan: x.doAmGan ?? x.DoAmGan ?? null,
});

const toSlot = (x: BackendSlot): XuatCapSlot => ({
  id: x.id ?? x.Id ?? 0,
  idDanhMucChiTiet: x.idDanhMucChiTiet ?? x.IdDanhMucChiTiet ?? 0,
  thuTu: x.thuTu ?? x.ThuTu ?? 0,
  tenCan: x.tenCan ?? x.TenCan ?? "",
  noiNhan: x.noiNhan ?? x.NoiNhan ?? "",
  chiTietLo: x.chiTietLo ?? x.ChiTietLo ?? null,
  loaiCoc: x.loaiCoc ?? x.LoaiCoc ?? "",
  nhomTongHop: x.nhomTongHop ?? x.NhomTongHop ?? "",
  idPhongBan: x.idPhongBan ?? x.IdPhongBan ?? null,
  tenPhongBan: x.tenPhongBan ?? x.TenPhongBan ?? null,
  idDanhMucCum: x.idDanhMucCum ?? x.IdDanhMucCum ?? null,
  idCum: x.idCum ?? x.IdCum ?? null,
  maCum: x.maCum ?? x.MaCum ?? null,
  tenCum: x.tenCum ?? x.TenCum ?? null,
  idLoaiNhan: x.idLoaiNhan ?? x.IdLoaiNhan ?? null,
  tenLoaiNhan: x.tenLoaiNhan ?? x.TenLoaiNhan ?? null,
  khoiLuongAm: x.khoiLuongAm ?? x.KhoiLuongAm ?? null,
  doAm: x.doAm ?? x.DoAm ?? null,
  tyKhoi: x.tyKhoi ?? x.TyKhoi ?? null,
  klQuyKho: x.klQuyKho ?? x.KLQuyKho ?? null,
  trongCa: x.trongCa ?? x.TrongCa ?? null,
  luyKe: x.luyKe ?? x.LuyKe ?? null,
  ghiChu: x.ghiChu ?? x.GhiChu ?? null,
  nguon: (x.nguon ?? x.Nguon ?? []).map(toNguon),
});

const toNguonBbgn = (x: BackendNguonBbgn): XuatCapNguonBbgn => ({
  idBbgn: x.idBbgn ?? x.IdBbgn ?? 0,
  idCtBbgn: x.idCtBbgn ?? x.IdCtBbgn ?? 0,
  soPhieu: x.soPhieu ?? x.SoPhieu ?? null,
  ngay: x.ngay ?? x.Ngay ?? null,
  ca: x.ca ?? x.Ca ?? null,
  kip: x.kip ?? x.Kip ?? null,
  idXuongBn: x.idXuongBn ?? x.IdXuongBn ?? null,
  idPhongBanBn: x.idPhongBanBn ?? x.IdPhongBanBn ?? null,
  tenXuongBn: x.tenXuongBn ?? x.TenXuongBn ?? null,
  tenPhongBanBn: x.tenPhongBanBn ?? x.TenPhongBanBn ?? null,
  idVatTu: x.idVatTu ?? x.IdVatTu ?? null,
  tenVatTu: x.tenVatTu ?? x.TenVatTu ?? null,
  maLo: x.maLo ?? x.MaLo ?? null,
  khoiLuongBg: x.khoiLuongBg ?? x.KhoiLuongBg ?? null,
  doAmW: x.doAmW ?? x.DoAmW ?? null,
  klQuyKhoBg: x.klQuyKhoBg ?? x.KlQuyKhoBg ?? null,
  idTrangThaiBbgn: x.idTrangThaiBbgn ?? x.IdTrangThaiBbgn ?? null,
  ghiChu: x.ghiChu ?? x.GhiChu ?? null,
});

export interface LcXuatCapSaveSlotBody {
  idDanhMucChiTiet: number;
  khoiLuongAm: number | null;
  doAm: number | null;
  tyKhoi: number | null;
  ghiChu: string | null;
}

export const LcXuatCapApi = {
  getByPhieu: async (idPhieu: string): Promise<XuatCapSlot[]> => {
    const res = (await apiService.get(`/api/LC_XuatCap/by-phieu/${idPhieu}`)) as BackendSlot[];
    return Array.isArray(res) ? res.map(toSlot) : [];
  },

  save: async (idPhieu: string, slots: LcXuatCapSaveSlotBody[]): Promise<XuatCapSlot[]> => {
    const res = (await apiService.put(`/api/LC_XuatCap/by-phieu/${idPhieu}`, slots)) as BackendSlot[];
    return Array.isArray(res) ? res.map(toSlot) : [];
  },

  getNguonBbgn: async (ngay: string, ca: string, scope: number): Promise<XuatCapNguonBbgn[]> => {
    const res = (await apiService.get(
      `/api/LC_XuatCap/nguon-bbgn?ngay=${encodeURIComponent(ngay)}&ca=${encodeURIComponent(ca)}&scope=${scope}`
    )) as BackendNguonBbgn[];
    return Array.isArray(res) ? res.map(toNguonBbgn) : [];
  },

  gan: async (req: {
    idPhieu: string;
    idDanhMucChiTiet: number;
    idBbgn: number;
    idCtBbgn: number;
    khoiLuongGan: number | null;
    doAmGan: number | null;
  }): Promise<XuatCapSlot> => {
    const res = (await apiService.post(`/api/LC_XuatCap/gan`, req)) as BackendSlot;
    return toSlot(res);
  },

  boGan: async (idXuatCapNguon: number): Promise<XuatCapSlot> => {
    const res = (await apiService.delete(`/api/LC_XuatCap/gan/${idXuatCapNguon}`)) as BackendSlot;
    return toSlot(res);
  },
};
