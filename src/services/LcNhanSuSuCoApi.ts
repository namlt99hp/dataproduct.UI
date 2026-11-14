import apiService from "./ApiService";
import type { NhanSuRow, SuCoRow, GhiChuCaRow } from "../components/LC_BCSX_XNL/TabSuCo";

// Đọc/lưu trực tiếp bảng quan hệ LC_TP_NhanSu / LC_TP_SuCoTrongCa / LC_TP_GhiChuCa cho tab
// "Nhân sự / Sự cố" — KHÔNG qua BmPhieu.DataJson (cùng nguyên tắc với LcTieuHaoApi/
// LcChatLuongCocApi). Xem LC_ThanhPhamController (mục 5, 8, 9).

const BASE = "/api/LC_ThanhPham";

interface NhanSuDto {
  stt: number;
  tenToNhom?: string | null;
  soLuongDinhBien?: string | null;
  soLuongHienCoDinhBien?: string | null;
  soLuongTrongCa?: string | null;
  dienGiai?: string | null;
  noiDungTuDo?: string | null;
}

interface SuCoDto {
  stt: number;
  tinhTrangSuCo?: string | null;
  tgPhatHienSuCo?: string | null;
  cachKhacPhuc?: string | null;
  tgBatDau?: string | null;
  tgKetThuc?: string | null;
  nhanLuc?: string | null;
}

interface GhiChuCaDto {
  loai: "5S" | "BAN_GIAO";
  stt: number;
  noiDung?: string | null;
}

export const LcNhanSuSuCoApi = {
  getNhanSu: async (phieuId: string, scope: number): Promise<NhanSuRow[]> => {
    const list = ((await apiService.get(`${BASE}/nhan-su`, { params: { phieuId, scope } })) as NhanSuDto[]) ?? [];
    return list.map((x) => ({
      key: `ns-${x.stt}`,
      tenToNhom: x.tenToNhom ?? null,
      soLuongDinhBien: x.soLuongDinhBien ?? null,
      soLuongHienCoDinhBien: x.soLuongHienCoDinhBien ?? null,
      soLuongTrongCa: x.soLuongTrongCa ?? null,
      dienGiai: x.dienGiai ?? null,
      noiDungTuDo: x.noiDungTuDo ?? null,
    }));
  },

  saveNhanSu: async (phieuId: string, scope: number, rows: NhanSuRow[]): Promise<void> => {
    const items = rows.map((r) => ({
      tenToNhom: r.tenToNhom || null,
      soLuongDinhBien: r.soLuongDinhBien || null,
      soLuongHienCoDinhBien: r.soLuongHienCoDinhBien || null,
      soLuongTrongCa: r.soLuongTrongCa || null,
      dienGiai: r.dienGiai || null,
      noiDungTuDo: r.noiDungTuDo || null,
    }));
    await apiService.put(`${BASE}/nhan-su`, items, { params: { phieuId, scope } });
  },

  getSuCo: async (phieuId: string, scope: number): Promise<SuCoRow[]> => {
    const list = ((await apiService.get(`${BASE}/su-co`, { params: { phieuId, scope } })) as SuCoDto[]) ?? [];
    return list.map((x) => ({
      key: `sc-${x.stt}`,
      tinhTrangSuCo: x.tinhTrangSuCo ?? null,
      thoiGianPhatHien: x.tgPhatHienSuCo ?? null,
      cachKhacPhuc: x.cachKhacPhuc ?? null,
      thoiGianBatDau: x.tgBatDau ?? null,
      thoiGianKetThuc: x.tgKetThuc ?? null,
      nhanLuc: x.nhanLuc ?? null,
    }));
  },

  saveSuCo: async (phieuId: string, scope: number, rows: SuCoRow[]): Promise<void> => {
    const items = rows.map((r) => ({
      tinhTrangSuCo: r.tinhTrangSuCo || null,
      tgPhatHienSuCo: r.thoiGianPhatHien || null,
      cachKhacPhuc: r.cachKhacPhuc || null,
      tgBatDau: r.thoiGianBatDau || null,
      tgKetThuc: r.thoiGianKetThuc || null,
      nhanLuc: r.nhanLuc || null,
    }));
    await apiService.put(`${BASE}/su-co`, items, { params: { phieuId, scope } });
  },

  // scope luôn = 1 (TP1 only) — xem ghi chú SECTION 33 lc_bcxs_xnl_tp.sql
  getGhiChuCa: async (phieuId: string, scope: number): Promise<GhiChuCaRow[]> => {
    const list = ((await apiService.get(`${BASE}/ghi-chu-ca`, { params: { phieuId, scope } })) as GhiChuCaDto[]) ?? [];
    return list.map((x) => ({
      key: `gc-${x.loai}-${x.stt}`,
      loai: x.loai,
      noiDung: x.noiDung ?? null,
    }));
  },

  saveGhiChuCa: async (phieuId: string, scope: number, rows: GhiChuCaRow[]): Promise<void> => {
    const items = rows.map((r) => ({
      loai: r.loai,
      noiDung: r.noiDung || null,
    }));
    await apiService.put(`${BASE}/ghi-chu-ca`, items, { params: { phieuId, scope } });
  },
};
