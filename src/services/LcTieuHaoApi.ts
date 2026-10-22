import apiService from "./ApiService";
import type { TieuHaoRow } from "../components/LC_BCSX_XNL/TabTieuHao";

// Đọc/lưu trực tiếp bảng quan hệ LC_TP_TieuHao cho tab Tiêu hao — KHÔNG qua BmPhieu.DataJson,
// cùng nguyên tắc với LcCapLieuSiloApi / LcPhoiTronApi. Xem LC_ThanhPhamController (mục 6).

const BASE = "/api/LC_ThanhPham";

export interface DanhMucTieuHaoDto {
  id: number;
  ten: string;
  nhomId?: number | null;
  tenNhom?: string | null;
  donVi?: string | null;
  donViTieuHao?: string | null;
  thuTu?: number | null;
}

interface TieuHaoDto {
  hangMucId: number;
  chiSoDauCa?: number | null;
  chiSoCuoiCa?: number | null;
  trongCa?: number | null;
  tongNhaMay?: number | null;
  luyKe?: number | null;
  tieuHaoTrenTan?: number | null;
}

const toNumberOrNull = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const LcTieuHaoApi = {
  getDanhMuc: async (): Promise<DanhMucTieuHaoDto[]> =>
    ((await apiService.get(`${BASE}/danh-muc-tieu-hao`)) as DanhMucTieuHaoDto[]) ?? [],

  /** scope: 1 = TP1, 2 = TP2 (xem thanhPhamToScope) */
  getByPhieu: async (phieuId: string, scope: number): Promise<TieuHaoRow[]> => {
    const list =
      ((await apiService.get(`${BASE}/tieu-hao`, { params: { phieuId, scope } })) as TieuHaoDto[]) ?? [];
    return list.map((x) => ({
      key: `hm-${x.hangMucId}`,
      hangMucId: x.hangMucId,
      chiSoDauCa: x.chiSoDauCa ?? null,
      chiSoCuoiCa: x.chiSoCuoiCa ?? null,
      trongCa: x.trongCa ?? null,
      tongNhaMay: x.tongNhaMay ?? null,
      luyKe: x.luyKe ?? null,
      tieuHaoTrenTan: x.tieuHaoTrenTan ?? null,
    }));
  },

  /** Thay toàn bộ tiêu hao của phiếu + scope. Chỉ gửi các dòng đã nhập ít nhất 1 số liệu. */
  save: async (phieuId: string, scope: number, rows: TieuHaoRow[]): Promise<void> => {
    const items = rows
      .map((r) => ({
        hangMucId: r.hangMucId,
        chiSoDauCa: toNumberOrNull(r.chiSoDauCa),
        chiSoCuoiCa: toNumberOrNull(r.chiSoCuoiCa),
        trongCa: toNumberOrNull(r.trongCa),
        tongNhaMay: toNumberOrNull(r.tongNhaMay),
        luyKe: toNumberOrNull(r.luyKe),
        tieuHaoTrenTan: toNumberOrNull(r.tieuHaoTrenTan),
      }))
      .filter((x) => Object.entries(x).some(([k, v]) => k !== "hangMucId" && v !== null));
    await apiService.put(`${BASE}/tieu-hao`, items, { params: { phieuId, scope } });
  },
};
