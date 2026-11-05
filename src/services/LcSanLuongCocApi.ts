import apiService from "./ApiService";
import type { DapCocRow, CocChuyenNhaSangRow, SanLuongCocRow } from "../components/LC_BCSX_XNL/TabSanLuongCoc";

const BASE = "/api/LC_SanLuongCoc";

// Đọc/lưu trực tiếp bảng quan hệ (LC_TP_DapCoc/LC_TP_CocChuyenNhaSang) cho tab Sản lượng cốc
// — KHÔNG qua BmPhieu.DataJson, cùng nguyên tắc với LCThapThanApi. Xem
// Repositories/NM.LC/LC_SanLuongCocRepository.cs (GetTabAsync/SaveTabAsync).

const toNumberOrNull = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

interface BackendDapCocRow {
  idViTri?: number; ID_ViTri?: number;
  idCumSanXuat?: number; ID_CumSanXuat?: number;
  cumSanXuatTen?: string; CumSanXuatTen?: string;
  loai?: string; Loai?: string;
  ten?: string; Ten?: string;
  banhCocTiepNhan?: number | null; BanhCocTiepNhan?: number | null;
  luyKeBanhCocTiepNhan?: number | null; LuyKeBanhCocTiepNhan?: number | null;
  khoiLuongCocTrongCa?: number | null; KhoiLuongCocTrongCa?: number | null;
  luyKeKhoiLuongCocTrongCa?: number | null; LuyKeKhoiLuongCocTrongCa?: number | null;
}

interface BackendCocChuyenRow {
  nhaSang?: string; NhaSang?: string;
  tonCuoi?: number | null; TonCuoi?: number | null;
  tonDau?: number | null; TonDau?: number | null;
  luyKe?: number | null; LuyKe?: number | null;
}

interface BackendSanLuongCumDto {
  idCumSanXuat?: number; ID_CumSanXuat?: number;
  cumSanXuatTen?: string; CumSanXuatTen?: string;
  trongCa?: number | null; TrongCa?: number | null;
  luyKe?: number | null; LuyKe?: number | null;
}

interface BackendSanLuongRow {
  loaiCoc?: string; LoaiCoc?: string;
  tongTrongCa?: number | null; TongTrongCa?: number | null;
  luyKeTong?: number | null; LuyKeTong?: number | null;
  theoCum?: BackendSanLuongCumDto[]; TheoCum?: BackendSanLuongCumDto[];
}

interface BackendSanLuongCocTab {
  dapCoc?: BackendDapCocRow[]; DapCoc?: BackendDapCocRow[];
  cocChuyenNhaSang?: BackendCocChuyenRow[]; CocChuyenNhaSang?: BackendCocChuyenRow[];
  sanLuong?: BackendSanLuongRow[]; SanLuong?: BackendSanLuongRow[];
}

const toDapCocRow = (x: BackendDapCocRow): DapCocRow => {
  const idViTri = x.idViTri ?? x.ID_ViTri ?? 0;
  return {
    key: `vitri-${idViTri}`,
    idViTri,
    idCumSanXuat: x.idCumSanXuat ?? x.ID_CumSanXuat ?? null,
    cumSanXuatTen: x.cumSanXuatTen ?? x.CumSanXuatTen ?? null,
    loai: x.loai ?? x.Loai ?? null,
    ten: x.ten ?? x.Ten ?? null,
    banhCocTiepNhan: x.banhCocTiepNhan ?? x.BanhCocTiepNhan ?? null,
    luyKeBanhCocTiepNhan: x.luyKeBanhCocTiepNhan ?? x.LuyKeBanhCocTiepNhan ?? null,
    khoiLuongCocTrongCa: x.khoiLuongCocTrongCa ?? x.KhoiLuongCocTrongCa ?? null,
    luyKeKhoiLuongCocTrongCa: x.luyKeKhoiLuongCocTrongCa ?? x.LuyKeKhoiLuongCocTrongCa ?? null,
  };
};

const toCocChuyenRow = (x: BackendCocChuyenRow): CocChuyenNhaSangRow => {
  const nhaSang = x.nhaSang ?? x.NhaSang ?? "";
  return {
    key: `chuyen-${nhaSang}`,
    nhaSang,
    tonCuoi: x.tonCuoi ?? x.TonCuoi ?? null,
    tonDau: x.tonDau ?? x.TonDau ?? null,
    luyKe: x.luyKe ?? x.LuyKe ?? null,
  };
};

const toSanLuongRow = (x: BackendSanLuongRow): SanLuongCocRow => ({
  loaiCoc: x.loaiCoc ?? x.LoaiCoc ?? null,
  tongTrongCa: x.tongTrongCa ?? x.TongTrongCa ?? null,
  luyKeTong: x.luyKeTong ?? x.LuyKeTong ?? null,
  theoCum: (x.theoCum ?? x.TheoCum ?? []).map((c) => ({
    idCumSanXuat: c.idCumSanXuat ?? c.ID_CumSanXuat ?? null,
    cumSanXuatTen: c.cumSanXuatTen ?? c.CumSanXuatTen ?? null,
    trongCa: c.trongCa ?? c.TrongCa ?? null,
    luyKe: c.luyKe ?? c.LuyKe ?? null,
  })),
});

const toTables = (
  res: BackendSanLuongCocTab | null | undefined
): { dapCoc: DapCocRow[]; cocChuyenNhaSang: CocChuyenNhaSangRow[]; sanLuong: SanLuongCocRow[] } => {
  const dapCoc = res?.dapCoc ?? res?.DapCoc ?? [];
  const cocChuyen = res?.cocChuyenNhaSang ?? res?.CocChuyenNhaSang ?? [];
  const sanLuong = res?.sanLuong ?? res?.SanLuong ?? [];
  return {
    dapCoc: dapCoc.map(toDapCocRow),
    cocChuyenNhaSang: cocChuyen.map(toCocChuyenRow),
    sanLuong: sanLuong.map(toSanLuongRow),
  };
};

export interface LcCumSanXuat {
  id: number;
  scope: number;
  ma: string;
  ten: string;
  thuTu?: number | null;
}

interface BackendCumSanXuat {
  id?: number; Id?: number;
  scope?: number; Scope?: number;
  ma?: string; Ma?: string;
  ten?: string; Ten?: string;
  thuTu?: number | null; ThuTu?: number | null;
}

const toCumSanXuat = (x: BackendCumSanXuat): LcCumSanXuat => ({
  id: x.id ?? x.Id ?? 0,
  scope: x.scope ?? x.Scope ?? 0,
  ma: x.ma ?? x.Ma ?? "",
  ten: x.ten ?? x.Ten ?? "",
  thuTu: x.thuTu ?? x.ThuTu ?? null,
});

export const LcSanLuongCocApi = {
  // Danh mục "Cụm sản xuất" (LC_TP_CumSanXuat) — dùng cho Select ở trang quản lý Silo tồn /
  // Nơi nhận Cấp cốc (gán 1 silo/nơi nhận vào đúng cụm, NULL = dùng chung 2 cụm).
  getCumSanXuat: async (scope?: number | null): Promise<LcCumSanXuat[]> => {
    const params = scope != null ? { scope } : undefined;
    const res = (await apiService.get(`${BASE}/cum-san-xuat`, { params })) as BackendCumSanXuat[];
    return Array.isArray(res) ? res.map(toCumSanXuat) : [];
  },

  getByPhieu: async (
    idPhieu: string
  ): Promise<{ dapCoc: DapCocRow[]; cocChuyenNhaSang: CocChuyenNhaSangRow[]; sanLuong: SanLuongCocRow[] }> => {
    const res = (await apiService.get(`${BASE}/by-phieu/${idPhieu}`)) as BackendSanLuongCocTab;
    return toTables(res);
  },

  save: async (
    idPhieu: string,
    tables: { dapCoc: DapCocRow[]; cocChuyenNhaSang: CocChuyenNhaSangRow[] }
  ): Promise<{ dapCoc: DapCocRow[]; cocChuyenNhaSang: CocChuyenNhaSangRow[]; sanLuong: SanLuongCocRow[] }> => {
    const body = {
      dapCoc: tables.dapCoc
        .filter((r) => r.idViTri != null)
        .map((r) => ({
          idViTri: r.idViTri,
          banhCocTiepNhan: toNumberOrNull(r.banhCocTiepNhan),
          khoiLuongCocTrongCa: toNumberOrNull(r.khoiLuongCocTrongCa),
        })),
      cocChuyenNhaSang: tables.cocChuyenNhaSang
        .filter((r) => r.nhaSang)
        .map((r) => ({
          nhaSang: r.nhaSang,
          tonCuoi: toNumberOrNull(r.tonCuoi),
          tonDau: toNumberOrNull(r.tonDau),
        })),
    };
    const res = (await apiService.put(`${BASE}/by-phieu/${idPhieu}`, body)) as BackendSanLuongCocTab;
    return toTables(res);
  },
};
