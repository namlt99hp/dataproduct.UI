import apiService from "./ApiService";
import type { PhoiTronCard, PhoiTronChiTietRow } from "../components/LC_BCSX_XNL/TabPhoiTron";

// Đọc/lưu trực tiếp bảng quan hệ (LC_PhoiTron/LC_PhoiTronChiTiet) cho tab Phối trộn —
// KHÔNG qua BmPhieu.DataJson, cùng nguyên tắc với LcCapLieuSiloApi. Xem
// Repositories/NM.LC/LC_PhoiTronRepository.cs.

interface BackendChiTietRow {
  siloSo?: number; SiloSo?: number;
  stt?: number; Stt?: number;
  vatLieuTen?: string | null; VatLieuTen?: string | null;
  tyLeKeHoach?: number | null; TyLeKeHoach?: number | null;
  tyLeThucTe?: number | null; TyLeThucTe?: number | null;
  klQuyKho?: number | null; KLQuyKho?: number | null;
  luyKeQuyKho?: number | null; LuyKeQuyKho?: number | null;
  ghiChu?: string | null; GhiChu?: string | null;
}

interface BackendCard {
  id?: number; Id?: number;
  cumThapMa?: string; CumThapMa?: string;
  loaiPhoiTron?: string; LoaiPhoiTron?: string;
  thuTu?: number; ThuTu?: number;
  soPhieuYeuCau?: string | null; SoPhieuYeuCau?: string | null;
  maMauThuNghiem?: string | null; MaMauThuNghiem?: string | null;
  ghiChuPhoi?: string | null; GhiChuPhoi?: string | null;
  klCanAm?: number | null; KLCanAm?: number | null;
  doAm?: number | null; DoAm?: number | null;
  klQuyKhoCan?: number | null; KLQuyKhoCan?: number | null;
  chiTiet?: BackendChiTietRow[]; ChiTiet?: BackendChiTietRow[];
}

const toNumberOrNull = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const toChiTietRow = (x: BackendChiTietRow, idx: number): PhoiTronChiTietRow => ({
  siloSo: x.siloSo ?? x.SiloSo ?? idx + 1,
  stt: x.stt ?? x.Stt ?? 1,
  vatLieuTen: x.vatLieuTen ?? x.VatLieuTen ?? null,
  tyLeKeHoach: x.tyLeKeHoach ?? x.TyLeKeHoach ?? null,
  tyLeThucTe: x.tyLeThucTe ?? x.TyLeThucTe ?? null,
  klQuyKho: x.klQuyKho ?? x.KLQuyKho ?? null,
  luyKeQuyKho: x.luyKeQuyKho ?? x.LuyKeQuyKho ?? null,
  ghiChu: x.ghiChu ?? x.GhiChu ?? null,
});

const toCard = (x: BackendCard, idx: number): PhoiTronCard => {
  const chiTiet = x.chiTiet ?? x.ChiTiet ?? [];
  return {
    id: x.id ?? x.Id ?? 0,
    cumThapMa: x.cumThapMa ?? x.CumThapMa ?? "",
    loaiPhoiTron: x.loaiPhoiTron ?? x.LoaiPhoiTron ?? "SAN_XUAT",
    thuTu: x.thuTu ?? x.ThuTu ?? idx + 1,
    soPhieuYeuCau: x.soPhieuYeuCau ?? x.SoPhieuYeuCau ?? null,
    maMauThuNghiem: x.maMauThuNghiem ?? x.MaMauThuNghiem ?? null,
    ghiChuPhoi: x.ghiChuPhoi ?? x.GhiChuPhoi ?? null,
    klCanAm: x.klCanAm ?? x.KLCanAm ?? null,
    doAm: x.doAm ?? x.DoAm ?? null,
    klQuyKhoCan: x.klQuyKhoCan ?? x.KLQuyKhoCan ?? null,
    chiTiet: chiTiet.map(toChiTietRow),
  };
};

export const LcPhoiTronApi = {
  getByPhieu: async (idPhieu: string): Promise<PhoiTronCard[]> => {
    const res = (await apiService.get(`/api/LC_PhoiTron/by-phieu/${idPhieu}`)) as BackendCard[];
    return Array.isArray(res) ? res.map(toCard) : [];
  },

  save: async (idPhieu: string, cards: PhoiTronCard[]): Promise<PhoiTronCard[]> => {
    const body = cards.map((c) => ({
      id: c.id ?? 0,
      cumThapMa: c.cumThapMa,
      loaiPhoiTron: c.loaiPhoiTron,
      thuTu: c.thuTu,
      soPhieuYeuCau: c.soPhieuYeuCau ?? null,
      maMauThuNghiem: c.maMauThuNghiem ?? null,
      ghiChuPhoi: c.ghiChuPhoi ?? null,
      klCanAm: toNumberOrNull(c.klCanAm),
      doAm: toNumberOrNull(c.doAm),
      chiTiet: c.chiTiet.map((r) => ({
        siloSo: r.siloSo,
        stt: r.stt ?? 1,
        tyLeKeHoach: toNumberOrNull(r.tyLeKeHoach),
        tyLeThucTe: toNumberOrNull(r.tyLeThucTe),
        ghiChu: r.ghiChu ?? null,
      })),
    }));
    const res = (await apiService.put(`/api/LC_PhoiTron/by-phieu/${idPhieu}`, body)) as BackendCard[];
    return Array.isArray(res) ? res.map(toCard) : [];
  },

  /** "Làm mới" — tính lại Lũy kế quy khô theo dữ liệu MỚI NHẤT của kíp liền trước (không
   *  gửi dữ liệu đang nhập của FE lên, không đổi KL cân/tỷ lệ/cấu trúc thẻ). */
  refreshTuCaTruoc: async (idPhieu: string): Promise<PhoiTronCard[]> => {
    const res = (await apiService.post(`/api/LC_PhoiTron/by-phieu/${idPhieu}/lam-moi`, {})) as BackendCard[];
    return Array.isArray(res) ? res.map(toCard) : [];
  },
};
