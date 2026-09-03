import type {
  STD_NXT_HRC1_GetDetailResponse,
  STD_NXT_HRC1_KhongPhanBoDto,
  STD_NXT_HRC1_NhapXuatTonRow,
  STD_NXT_HRC1_NhapXuatTonSearchRequest,
  STD_NXT_HRC1_PhanBoDto,
  STD_NXT_HRC1_UpsertDto,
} from "../models/STD_NXT_HRC1_Model";
import type {
  STD_NXT_RelatedPhieuStatusRequest,
  STD_NXT_RelatedPhieuStatusResponse,
} from "../models/STD_NXT_Model";
import apiService from "./ApiService";

export const STD_NXT_HRC1ServiceApi = {
  upsert: (data: STD_NXT_HRC1_UpsertDto) => apiService.post("/api/STD_NXT_HRC1/upsert", data),
  getDetail: (phieuId: string) => apiService.get<{ data: STD_NXT_HRC1_GetDetailResponse }>(`/api/STD_NXT_HRC1/get-by-phieu-id/${phieuId}`),
  phanBo: (data: STD_NXT_HRC1_PhanBoDto) =>
    apiService.post<{ data: boolean }>("/api/STD_NXT_HRC1/phan-bo", data),
  thuHoiPhanBo: (data: STD_NXT_HRC1_PhanBoDto) =>
    apiService.post<{ data: boolean }>("/api/STD_NXT_HRC1/thu-hoi-phan-bo", data),
  getRelatedPhieuStatuses: (data: STD_NXT_RelatedPhieuStatusRequest) =>
    apiService.post<{ data: STD_NXT_RelatedPhieuStatusResponse }>("/api/STD_NXT_HRC1/related-phieu-statuses", data),
  khongPhanBo: (data: STD_NXT_HRC1_KhongPhanBoDto) =>
    apiService.post<{ data: boolean }>("/api/STD_NXT_HRC1/khong-phan-bo", data),
  searchNhapXuatTon: (data: STD_NXT_HRC1_NhapXuatTonSearchRequest) =>
    apiService.post<{ data: STD_NXT_HRC1_NhapXuatTonRow[] }>(
      "/api/STD_NXT_HRC1/search-nhapxuatton",
      data
    ),
};
