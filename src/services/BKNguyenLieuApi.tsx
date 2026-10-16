import apiService from "./ApiService";

export const nguyenlieuApi = {
  getData: (params?: any) => apiService.get("/api/BKNguyenLieu", { params }),

  getCanBangTai: (ngaySX: string) =>
    apiService.get("/api/BKNguyenLieu/can-bang-tai", { params: { NgaySX: ngaySX } }),
};

