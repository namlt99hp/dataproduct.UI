import apiService from "./ApiService";
import type { LcVatTuLookup, LcMaLoLookup } from "../models/LcVatTuMaLoLookupModel";

// Backend trả PascalCase hoặc camelCase tùy serializer — map linh hoạt cả hai.
interface BackendVatTuLookup {
  idVatTu?: number; IdVatTu?: number;
  tenVatTu?: string | null; TenVatTu?: string | null;
  maVatTuSap?: string | null; MaVatTuSap?: string | null;
  tenVatTuSap?: string | null; TenVatTuSap?: string | null;
  donViTinh?: string | null; DonViTinh?: string | null;
}

interface BackendMaLoLookup {
  idMaLo?: number; IdMaLo?: number;
  tenMaLo?: string | null; TenMaLo?: string | null;
  phongBan?: string | null; PhongBan?: string | null;
}

interface BackendMaLoByVatTuGroup {
  idVatTu?: number; IdVatTu?: number;
  maLoList?: BackendMaLoLookup[]; MaLoList?: BackendMaLoLookup[];
}

const toVatTuModel = (x: BackendVatTuLookup): LcVatTuLookup => ({
  idVatTu: x.idVatTu ?? x.IdVatTu ?? 0,
  tenVatTu: x.tenVatTu ?? x.TenVatTu ?? null,
  maVatTuSap: x.maVatTuSap ?? x.MaVatTuSap ?? null,
  tenVatTuSap: x.tenVatTuSap ?? x.TenVatTuSap ?? null,
  donViTinh: x.donViTinh ?? x.DonViTinh ?? null,
});

const toMaLoModel = (x: BackendMaLoLookup): LcMaLoLookup => ({
  idMaLo: x.idMaLo ?? x.IdMaLo ?? 0,
  tenMaLo: x.tenMaLo ?? x.TenMaLo ?? null,
  phongBan: x.phongBan ?? x.PhongBan ?? null,
});

export const LcVatTuMaLoLookupApi = {
  searchVatTu: async (searchKey?: string): Promise<LcVatTuLookup[]> => {
    const response = (await apiService.get("/api/LC_VatTuMaLoLookup/vattu-search", {
      params: searchKey ? { searchKey } : undefined,
    })) as BackendVatTuLookup[];
    return Array.isArray(response) ? response.map(toVatTuModel) : [];
  },
  getMaLoByVatTu: async (idVatTu: number): Promise<LcMaLoLookup[]> => {
    const response = (await apiService.get("/api/LC_VatTuMaLoLookup/malo-by-vattu", {
      params: { idVatTu },
    })) as BackendMaLoLookup[];
    return Array.isArray(response) ? response.map(toMaLoModel) : [];
  },
  /** 1 request cho nhiều idVatTu — dùng khi load phiếu đã có sẵn nhiều dòng đã chọn than,
   *  tránh gọi getMaLoByVatTu riêng lẻ từng dòng (N+1). Trả về map idVatTu -> list lô. */
  getMaLoByVatTuBatch: async (idVatTuList: number[]): Promise<Record<number, LcMaLoLookup[]>> => {
    if (idVatTuList.length === 0) return {};
    const response = (await apiService.post(
      "/api/LC_VatTuMaLoLookup/malo-by-vattu-batch",
      idVatTuList
    )) as BackendMaLoByVatTuGroup[];
    const result: Record<number, LcMaLoLookup[]> = {};
    if (Array.isArray(response)) {
      for (const g of response) {
        const idVatTu = g.idVatTu ?? g.IdVatTu;
        if (idVatTu == null) continue;
        const list = g.maLoList ?? g.MaLoList ?? [];
        result[idVatTu] = list.map(toMaLoModel);
      }
    }
    return result;
  },
};
