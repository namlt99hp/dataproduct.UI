import type {
  STD_NXT_HRC2_GetDetailResponse,
  STD_NXT_HRC2_KhongPhanBoDto,
  STD_NXT_HRC2_NhapXuatTonRow,
  STD_NXT_HRC2_NhapXuatTonSearchRequest,
  STD_NXT_HRC2_PhanBoDto,
  STD_NXT_HRC2_UpsertDto,
  STD_NXT_RelatedPhieuStatusRequest,
  STD_NXT_RelatedPhieuStatusResponse,
} from "../models/STD_NXT_Model";
import apiService from "./ApiService";

export const STD_NXT_HRC2ServiceApi = {
  upsert: (data: STD_NXT_HRC2_UpsertDto) => apiService.post("/api/STD_NXT_HRC2/upsert", data),
  getDetail: (phieuId: string) => apiService.get<{ data: STD_NXT_HRC2_GetDetailResponse }>(`/api/STD_NXT_HRC2/get-by-phieu-id/${phieuId}`),
  phanBo: (data: STD_NXT_HRC2_PhanBoDto) =>
    apiService.post<{ data: boolean }>("/api/STD_NXT_HRC2/phan-bo", data),
  thuHoiPhanBo: (data: STD_NXT_HRC2_PhanBoDto) =>
    apiService.post<{ data: boolean }>("/api/STD_NXT_HRC2/thu-hoi-phan-bo", data),
  getRelatedPhieuStatuses: (data: STD_NXT_RelatedPhieuStatusRequest) =>
    apiService.post<{ data: STD_NXT_RelatedPhieuStatusResponse }>("/api/STD_NXT_HRC2/related-phieu-statuses", data),
  khongPhanBo: (data: STD_NXT_HRC2_KhongPhanBoDto) =>
    apiService.post<{ data: boolean }>("/api/STD_NXT_HRC2/khong-phan-bo", data),
  searchNhapXuatTon: (data: STD_NXT_HRC2_NhapXuatTonSearchRequest) =>
    apiService.post<{ data: STD_NXT_HRC2_NhapXuatTonRow[] }>(
      "/api/STD_NXT_HRC2/search-nhapxuatton",
      data
    ),
};
