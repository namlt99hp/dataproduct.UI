import apiService from "./ApiService";
import type { CocTonCum, CocTonSiloCol } from "../components/LC_BCSX_XNL/TabCocTonSilo";

// Đọc/lưu trực tiếp bảng quan hệ LC_SiloCocTon cho tab "Tồn cốc silo" (`tonCoc`,
// TabCocTonSilo.tsx) — KHÔNG qua BmPhieu.DataJson, cùng nguyên tắc với LcCapLieuSiloApi/
// LcPhoiTronApi. Xem Repositories/NM.LC/LC_SiloCocTonRepository.cs.

interface BackendSiloCol {
  id?: number; Id?: number;
  idSiloTon?: number; IdSiloTon?: number;
  tenSilo?: string; TenSilo?: string;
  loaiLieu?: string; LoaiLieu?: string;
  tenNhapLieu?: string; TenNhapLieu?: string;
  giaTriTonCuoiCa?: number | null; GiaTriTonCuoiCa?: number | null;
  khoiLuongTonCuoiCa?: number | null; KhoiLuongTonCuoiCa?: number | null;
  giaTriTonDauCa?: number | null; GiaTriTonDauCa?: number | null;
  khoiLuongTonDauCa?: number | null; KhoiLuongTonDauCa?: number | null;
  chenhLech1080?: number | null; ChenhLech1080?: number | null;
  chenhLechDuoi10?: number | null; ChenhLechDuoi10?: number | null;
}

interface BackendCum {
  tenCum?: string; TenCum?: string;
  silos?: BackendSiloCol[]; Silos?: BackendSiloCol[];
}

let localKeySeq = 0;
const genKey = () => `loaded-${Date.now()}-${localKeySeq++}`;

const toSiloCol = (x: BackendSiloCol): CocTonSiloCol => ({
  key: genKey(),
  id: x.id ?? x.Id ?? 0,
  idSiloTon: x.idSiloTon ?? x.IdSiloTon ?? 0,
  tenSilo: x.tenSilo ?? x.TenSilo ?? "",
  loaiLieu: x.loaiLieu ?? x.LoaiLieu ?? "MM_10_80",
  tenNhapLieu: x.tenNhapLieu ?? x.TenNhapLieu ?? "Chiều cao",
  giaTriTonCuoiCa: x.giaTriTonCuoiCa ?? x.GiaTriTonCuoiCa ?? null,
  khoiLuongTonCuoiCa: x.khoiLuongTonCuoiCa ?? x.KhoiLuongTonCuoiCa ?? null,
  giaTriTonDauCa: x.giaTriTonDauCa ?? x.GiaTriTonDauCa ?? null,
  khoiLuongTonDauCa: x.khoiLuongTonDauCa ?? x.KhoiLuongTonDauCa ?? null,
  chenhLech1080: x.chenhLech1080 ?? x.ChenhLech1080 ?? null,
  chenhLechDuoi10: x.chenhLechDuoi10 ?? x.ChenhLechDuoi10 ?? null,
});

const toCum = (x: BackendCum): CocTonCum => ({
  key: genKey(),
  tenCum: x.tenCum ?? x.TenCum ?? "",
  silos: (x.silos ?? x.Silos ?? []).map(toSiloCol),
});

export const LcSiloCocTonApi = {
  getByPhieu: async (idPhieu: string): Promise<CocTonCum[]> => {
    const res = (await apiService.get(`/api/LC_SiloCocTon/by-phieu/${idPhieu}`)) as BackendCum[];
    return Array.isArray(res) ? res.map(toCum) : [];
  },

  save: async (idPhieu: string, cums: CocTonCum[]): Promise<CocTonCum[]> => {
    const body = cums.map((c) => ({
      tenCum: c.tenCum,
      silos: c.silos.map((s) => ({
        id: s.id ?? 0,
        idSiloTon: s.idSiloTon,
        giaTriTonCuoiCa: s.giaTriTonCuoiCa ?? null,
        giaTriTonDauCa: s.giaTriTonDauCa ?? null,
      })),
    }));
    const res = (await apiService.put(`/api/LC_SiloCocTon/by-phieu/${idPhieu}`, body)) as BackendCum[];
    return Array.isArray(res) ? res.map(toCum) : [];
  },
};
