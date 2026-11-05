import apiService from "./ApiService";
import type { PheuRow, ThapRow, BuiCocRow, BuiCocXuatRow } from "../components/LC_BCSX_XNL/TabThapPheu";

const BASE = "/api/LC_ThanhPham";

export interface BuiCocNoiNhanDto {
  id: number;
  ten: string;
  thuTu?: number | null;
}

export interface BuiCocNoiNhanPayload {
  ten: string;
  thuTu?: number | null;
}

export interface NhomThapThanDto {
  id: number;
  /** Xưởng: 1 = Thành phẩm 1, 2 = Thành phẩm 2 */
  scope: number;
  ma: string;
  ten?: string | null;
  thuTu?: number | null;
}

export interface PheuDto {
  id: number;
  thapThanId: number;
  tenThapThan?: string | null;
  tenPheu?: string | null;
  thuTu?: number | null;
}

// Đọc/lưu trực tiếp bảng quan hệ (LC_TP_TonPheu/LC_TP_CapThap) cho tab Tháp/Phễu — KHÔNG qua
// BmPhieu.DataJson, cùng nguyên tắc với LcPhoiTronApi/LcCapLieuSiloApi. Xem
// Repositories/NM.LC/LC_ThanhPhamRepository.cs (GetThapPheuTabAsync/SaveThapPheuTabAsync).

interface BackendTonPheu {
  pheuId?: number; PheuId?: number;
  thapThanId?: number; ThapThanId?: number;
  tenPheu?: string | null; TenPheu?: string | null;
  klTonDauQuyKho?: number | null; KLTonDauQuyKho?: number | null;
  mucRadar?: number | null; MucRadar?: number | null;
  klAmTonCuoi?: number | null; KLAmTonCuoi?: number | null;
  klTonCuoiQuyKho?: number | null; KLTonCuoiQuyKho?: number | null;
  ghiChu?: string | null; GhiChu?: string | null;
}

interface BackendCapThap {
  cumThapId?: number; CumThapId?: number;
  cumThapMa?: string; CumThapMa?: string;
  doAmThap?: number | null; DoAmThap?: number | null;
  capLenThapQuyKho?: number | null; CapLenThapQuyKho?: number | null;
  luyKeCapLenThap?: number | null; LuyKeCapLenThap?: number | null;
  napLoQuyKho?: number | null; NapLoQuyKho?: number | null;
  luyKeNapLo?: number | null; LuyKeNapLo?: number | null;
  ghiChu?: string | null; GhiChu?: string | null;
}

interface BackendThapPheuTab {
  pheu?: BackendTonPheu[]; Pheu?: BackendTonPheu[];
  thap?: BackendCapThap[]; Thap?: BackendCapThap[];
}

const toNumberOrNull = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const toPheuRow = (x: BackendTonPheu): PheuRow => {
  const pheuId = x.pheuId ?? x.PheuId ?? 0;
  const thapThanId = x.thapThanId ?? x.ThapThanId ?? 0;
  return {
    key: `pheu-${pheuId}`,
    cumThapMa: String(thapThanId),
    pheuMa: String(pheuId),
    klTonDauQuyKho: x.klTonDauQuyKho ?? x.KLTonDauQuyKho ?? null,
    mucRadar: x.mucRadar ?? x.MucRadar ?? null,
    klAmTonCuoi: x.klAmTonCuoi ?? x.KLAmTonCuoi ?? null,
    klTonCuoiQuyKho: x.klTonCuoiQuyKho ?? x.KLTonCuoiQuyKho ?? null,
    ghiChu: x.ghiChu ?? x.GhiChu ?? null,
  };
};

const toThapRow = (x: BackendCapThap): ThapRow => {
  const cumThapId = x.cumThapId ?? x.CumThapId ?? 0;
  return {
    key: `thap-${cumThapId}`,
    cumThapMa: String(cumThapId),
    doAmThap: x.doAmThap ?? x.DoAmThap ?? null,
    capLenThapQuyKho: x.capLenThapQuyKho ?? x.CapLenThapQuyKho ?? null,
    luyKeCapLenThap: x.luyKeCapLenThap ?? x.LuyKeCapLenThap ?? null,
    napLoQuyKho: x.napLoQuyKho ?? x.NapLoQuyKho ?? null,
    luyKeNapLo: x.luyKeNapLo ?? x.LuyKeNapLo ?? null,
    ghiChu: x.ghiChu ?? x.GhiChu ?? null,
  };
};

const toTables = (res: BackendThapPheuTab | null | undefined): { pheu: PheuRow[]; thap: ThapRow[] } => {
  const pheu = res?.pheu ?? res?.Pheu ?? [];
  const thap = res?.thap ?? res?.Thap ?? [];
  return { pheu: pheu.map(toPheuRow), thap: thap.map(toThapRow) };
};

interface BackendBuiCocNoiNhan {
  id?: number; Id?: number;
  ten?: string; Ten?: string;
  thuTu?: number | null; ThuTu?: number | null;
}

const toNoiNhanModel = (x: BackendBuiCocNoiNhan): BuiCocNoiNhanDto => ({
  id: x.id ?? x.Id ?? 0,
  ten: x.ten ?? x.Ten ?? "",
  thuTu: x.thuTu ?? x.ThuTu ?? null,
});

interface BackendBuiCocXuat {
  noiNhanId?: number; NoiNhanId?: number;
  tenNoiNhan?: string | null; TenNoiNhan?: string | null;
  khoiLuong?: number | null; KhoiLuong?: number | null;
  luyKeQuyKho?: number | null; LuyKeQuyKho?: number | null;
}

interface BackendBuiCocTab {
  sanLuongTrongCa?: number | null; SanLuongTrongCa?: number | null;
  luyKeSanLuong?: number | null; LuyKeSanLuong?: number | null;
  tonDauKyQuyKho?: number | null; TonDauKyQuyKho?: number | null;
  tonCuoiKyQuyKho?: number | null; TonCuoiKyQuyKho?: number | null;
  xuat?: BackendBuiCocXuat[]; Xuat?: BackendBuiCocXuat[];
}

const toBuiCocXuatRow = (x: BackendBuiCocXuat): BuiCocXuatRow => {
  const noiNhanId = x.noiNhanId ?? x.NoiNhanId ?? 0;
  return {
    key: `bc-noinhan-${noiNhanId}`,
    noiNhanId,
    khoiLuong: x.khoiLuong ?? x.KhoiLuong ?? null,
    luyKeQuyKho: x.luyKeQuyKho ?? x.LuyKeQuyKho ?? null,
  };
};

const toBuiCocTables = (
  res: BackendBuiCocTab | null | undefined
): { buiCoc: BuiCocRow; buiCocXuat: BuiCocXuatRow[] } => {
  const xuat = res?.xuat ?? res?.Xuat ?? [];
  return {
    buiCoc: {
      sanLuongTrongCa: res?.sanLuongTrongCa ?? res?.SanLuongTrongCa ?? null,
      luyKeSanLuong: res?.luyKeSanLuong ?? res?.LuyKeSanLuong ?? null,
      tonDauKyQuyKho: res?.tonDauKyQuyKho ?? res?.TonDauKyQuyKho ?? null,
      tonCuoiKyQuyKho: res?.tonCuoiKyQuyKho ?? res?.TonCuoiKyQuyKho ?? null,
    },
    buiCocXuat: xuat.map(toBuiCocXuatRow),
  };
};

export const lcThapThanApi = {
  getNhom: async (scope?: number, searchKey?: string): Promise<NhomThapThanDto[]> =>
    ((await apiService.get(`${BASE}/nhom-thap-than`, { params: { scope, searchKey } })) as NhomThapThanDto[]) ?? [],

  getPheu: async (thapThanId?: number, searchKey?: string, scope?: number): Promise<PheuDto[]> =>
    ((await apiService.get(`${BASE}/pheu`, { params: { thapThanId, searchKey, scope } })) as PheuDto[]) ?? [],

  getByPhieu: async (idPhieu: string): Promise<{ pheu: PheuRow[]; thap: ThapRow[] }> => {
    const res = (await apiService.get(`${BASE}/thap-pheu/by-phieu/${idPhieu}`)) as BackendThapPheuTab;
    return toTables(res);
  },

  save: async (
    idPhieu: string,
    tables: { pheu: PheuRow[]; thap: ThapRow[] }
  ): Promise<{ pheu: PheuRow[]; thap: ThapRow[] }> => {
    const body = {
      pheu: tables.pheu.map((r) => ({
        pheuId: Number(r.pheuMa),
        mucRadar: toNumberOrNull(r.mucRadar),
        ghiChu: r.ghiChu ?? null,
      })),
      thap: tables.thap.map((r) => ({
        cumThapId: Number(r.cumThapMa),
        doAmThap: toNumberOrNull(r.doAmThap),
        napLoQuyKho: toNumberOrNull(r.napLoQuyKho),
        ghiChu: r.ghiChu ?? null,
      })),
    };
    const res = (await apiService.put(`${BASE}/thap-pheu/by-phieu/${idPhieu}`, body)) as BackendThapPheuTab;
    return toTables(res);
  },

  /** "Làm mới" — tính lại Tồn đầu (Phễu) + Lũy kế cấp lên tháp/nạp lò (Tháp) theo dữ liệu MỚI
   *  NHẤT của kíp liền trước (không gửi dữ liệu đang nhập ở FE lên). */
  refreshTuCaTruoc: async (idPhieu: string): Promise<{ pheu: PheuRow[]; thap: ThapRow[] }> => {
    const res = (await apiService.post(`${BASE}/thap-pheu/by-phieu/${idPhieu}/lam-moi`, {})) as BackendThapPheuTab;
    return toTables(res);
  },

  // ─── Bụi cốc (Sản lượng/Tồn/Xuất) — gộp vào tab Tháp/Phễu, TP1 only ───

  getNoiNhanBuiCoc: async (): Promise<BuiCocNoiNhanDto[]> => {
    const res = (await apiService.get(`${BASE}/bui-coc-noi-nhan`)) as BackendBuiCocNoiNhan[];
    return Array.isArray(res) ? res.map(toNoiNhanModel) : [];
  },

  getBuiCocByPhieu: async (idPhieu: string): Promise<{ buiCoc: BuiCocRow; buiCocXuat: BuiCocXuatRow[] }> => {
    const res = (await apiService.get(`${BASE}/bui-coc/by-phieu/${idPhieu}`)) as BackendBuiCocTab;
    return toBuiCocTables(res);
  },

  saveBuiCoc: async (
    idPhieu: string,
    tables: { buiCoc: BuiCocRow; buiCocXuat: BuiCocXuatRow[] }
  ): Promise<{ buiCoc: BuiCocRow; buiCocXuat: BuiCocXuatRow[] }> => {
    const body = {
      sanLuongTrongCa: toNumberOrNull(tables.buiCoc.sanLuongTrongCa),
      xuat: tables.buiCocXuat
        .filter((r) => r.noiNhanId != null)
        .map((r) => ({
          noiNhanId: r.noiNhanId,
          khoiLuong: toNumberOrNull(r.khoiLuong),
        })),
    };
    const res = (await apiService.put(`${BASE}/bui-coc/by-phieu/${idPhieu}`, body)) as BackendBuiCocTab;
    return toBuiCocTables(res);
  },

  /** "Làm mới" — tính lại Tồn đầu + Lũy kế theo dữ liệu MỚI NHẤT của kíp liền trước. */
  refreshBuiCocTuCaTruoc: async (idPhieu: string): Promise<{ buiCoc: BuiCocRow; buiCocXuat: BuiCocXuatRow[] }> => {
    const res = (await apiService.post(`${BASE}/bui-coc/by-phieu/${idPhieu}/lam-moi`, {})) as BackendBuiCocTab;
    return toBuiCocTables(res);
  },
};

// Danh mục Nơi nhận Bụi cốc — CRUD riêng cho trang quản lý (mirror LcCumThapApi).
export const LcBuiCocNoiNhanApi = {
  search: async (): Promise<BuiCocNoiNhanDto[]> => {
    const res = (await apiService.get(`${BASE}/bui-coc-noi-nhan`)) as BackendBuiCocNoiNhan[];
    return Array.isArray(res) ? res.map(toNoiNhanModel) : [];
  },
  create: async (payload: BuiCocNoiNhanPayload): Promise<BuiCocNoiNhanDto> => {
    const res = (await apiService.post(`${BASE}/bui-coc-noi-nhan`, payload)) as BackendBuiCocNoiNhan;
    return toNoiNhanModel(res);
  },
  update: async (id: number, payload: BuiCocNoiNhanPayload): Promise<void> => {
    await apiService.put(`${BASE}/bui-coc-noi-nhan/${id}`, payload);
  },
  delete: async (id: number): Promise<void> => {
    await apiService.delete(`${BASE}/bui-coc-noi-nhan/${id}`);
  },
};
