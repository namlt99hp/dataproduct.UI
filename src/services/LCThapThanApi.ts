import apiService from "./ApiService";

const BASE = "/api/LC_ThanhPham";

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

export const lcThapThanApi = {
  getNhom: async (scope?: number, searchKey?: string): Promise<NhomThapThanDto[]> =>
    ((await apiService.get(`${BASE}/nhom-thap-than`, { params: { scope, searchKey } })) as NhomThapThanDto[]) ?? [],

  getPheu: async (thapThanId?: number, searchKey?: string, scope?: number): Promise<PheuDto[]> =>
    ((await apiService.get(`${BASE}/pheu`, { params: { thapThanId, searchKey, scope } })) as PheuDto[]) ?? [],
};
