import apiService from "./ApiService";

// "Chốt lũy kế" — xem Repositories/NM.LC/LC_ChotLuyKeRepository.cs. Từ phiên NGAY SAU phiếu
// được chốt, lũy kế của cả 8 chuỗi trong module LC bắt đầu lại — cascade tính lại (và lưu lại)
// mọi phiếu cùng Scope sau mốc đó. Chặn hẳn (không chốt phần nào) nếu có phiếu Hoàn thành/Đã
// chốt trong vùng ảnh hưởng — lỗi trả về ở `message` nêu rõ phiếu nào đang chặn.

export interface LcChotLuyKeResult {
  ngayChot: string;
  caChot: number;
  soPhieuDaTinhLai: number;
}

interface BackendChotLuyKeResult {
  ngayChot?: string; NgayChot?: string;
  caChot?: number; CaChot?: number;
  soPhieuDaTinhLai?: number; SoPhieuDaTinhLai?: number;
}

export const LcChotLuyKeApi = {
  chotLuyKe: async (idPhieu: string, nguoiChot?: string | null): Promise<LcChotLuyKeResult> => {
    const query = nguoiChot ? `?nguoiChot=${encodeURIComponent(nguoiChot)}` : "";
    const res = (await apiService.post(`/api/LC_ChotLuyKe/by-phieu/${idPhieu}${query}`, {})) as BackendChotLuyKeResult;
    return {
      ngayChot: res.ngayChot ?? res.NgayChot ?? "",
      caChot: res.caChot ?? res.CaChot ?? 0,
      soPhieuDaTinhLai: res.soPhieuDaTinhLai ?? res.SoPhieuDaTinhLai ?? 0,
    };
  },
};
