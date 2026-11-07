import apiService from "./ApiService";

export interface Hrc1PhuLieuNm {
  id: number;
  tenPhuLieu: string;
  tenPhuLieuNM?: string | null;
  dangSuDung: boolean;
  isNM: boolean;
  isUsedNXT?: boolean | null;
  // Thứ tự hiển thị cột phụ liệu trên trang Thống kê / khi xuất Excel — tách riêng BOF/LF
  // vì 2 biểu mẫu dùng bộ phụ liệu khác nhau (BOF 13, LF theo cấu hình thuTu_Excel_LF).
  thuTu_TK_BOF?: number | null;
  thuTu_TK_LF?: number | null;
  thuTu_Excel_BOF?: number | null;
  thuTu_Excel_LF?: number | null;
  maVatTuChiPhi?: string | null;
  // Nhóm cột phụ liệu trên bảng Tiêu hao Tinh luyện LF (1=Kim loại/Chất hợp kim hóa, 2=Phụ gia &
  // chất khử oxy), mirror LoaiPhuLieuLF (BE). BOF chỉ có 1 nhóm cột nên không dùng field này.
  loaiPL?: number | null;
  ngayTao?: string;
  nguoiTao?: string | null;
}

export const LoaiPhuLieuLF = {
  KimLoai: 1,
  PhuGia: 2,
} as const;

export interface Hrc1PhuLieuNmPayload {
  tenPhuLieu: string;
  thuTu_TK_BOF?: number | null;
  thuTu_TK_LF?: number | null;
  thuTu_Excel_BOF?: number | null;
  thuTu_Excel_LF?: number | null;
  maVatTuChiPhi?: string | null;
  loaiPL?: number | null;
}

export const Hrc1PhuLieuNmServiceApi = {
  getAll: async (params?: { dangSuDung?: boolean; searchKey?: string }): Promise<Hrc1PhuLieuNm[]> => {
    return (await apiService.get("/api/Hrc1PhuLieuNm", { params })) as Hrc1PhuLieuNm[];
  },

  getById: async (id: number): Promise<Hrc1PhuLieuNm> => {
    return (await apiService.get(`/api/Hrc1PhuLieuNm/${id}`)) as Hrc1PhuLieuNm;
  },

  create: async (payload: Hrc1PhuLieuNmPayload): Promise<Hrc1PhuLieuNm> => {
    return (await apiService.post("/api/Hrc1PhuLieuNm", payload)) as Hrc1PhuLieuNm;
  },

  update: async (id: number, payload: Hrc1PhuLieuNmPayload): Promise<void> => {
    await apiService.put(`/api/Hrc1PhuLieuNm/${id}`, payload);
  },

  toggleXacNhan: async (id: number): Promise<{ id: number; dangSuDung: boolean }> => {
    return (await apiService.patch(`/api/Hrc1PhuLieuNm/${id}/xac-nhan`)) as { id: number; dangSuDung: boolean };
  },

  /** Bật/tắt danh sách mặc định cho Sổ Xuất-Nhập-Tồn HRC1 (dùng khi khởi tạo phiếu đầu tiên). */
  toggleIsUsedNXT: async (id: number): Promise<{ id: number; isUsedNXT: boolean }> => {
    return (await apiService.patch(`/api/Hrc1PhuLieuNm/${id}/toggle-isusednxt`)) as { id: number; isUsedNXT: boolean };
  },

  /** Xóa phụ liệu — BE trả lỗi 400 kèm message nếu phụ liệu đã được dùng (mẻ tiêu hao / Sổ Xuất-Nhập-Tồn). */
  delete: async (id: number): Promise<void> => {
    await apiService.delete(`/api/Hrc1PhuLieuNm/${id}`);
  },
};
