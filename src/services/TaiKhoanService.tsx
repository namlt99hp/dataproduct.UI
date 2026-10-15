import apiService from "./ApiService";

export const TaiKhoanApi = {
  getData: (params?: any) =>
    apiService.get("/api/TaiKhoan/nguoiky", { params }),

  getListKyDuyet: (maBm: string, loaiQuyen: number, scope?: number | string | null) =>
    apiService.get("/api/TaiKhoan/list-ky-duyet", {
      params: { maBm, loaiQuyen, scope: scope ?? undefined },
    }),

  postLogin: (data: any) => apiService.post("/api/TaiKhoan/login", data),
  getSession: (params?: any) =>
    apiService.get("/api/TaiKhoan/me", { withCredentials: true }),
  getDetail: (tenTaiKhoan: string) =>
    apiService.get(`/api/TaiKhoan/info/${tenTaiKhoan}`),
  getQuyen: (tenTaiKhoan: string) =>
    apiService.get(`/api/TaiKhoan/quyen/${tenTaiKhoan}`),

  getNguoiKyByScope: (scope: number) =>
    apiService.get("/api/TaiKhoan/nguoiky-by-scope", { params: { scope } }),
};
