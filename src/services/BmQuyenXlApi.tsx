import apiService from "./ApiService";

export interface BmQuyenXlModel {
  id?: number;
  idTaiKhoan: number;
  maBm: string;
  maKhuVuc: string;
  quyenChucNang?: number;
  khuVucPhu?: string | null;
  ngayTao?: string;
  nguoiTao?: string;
}

/** 1 quyền mở rộng riêng theo BM (value >= 6, xem `bmQuyenConfig.ts` field `extraQuyens`). */
export interface ExtraQuyenMenuItem {
  maBm: string;
  quyenChucNang: number;
}

/** Quyền menu: Việc tôi bắt đầu (chỉnh sửa) và Việc đến tôi (duyệt). */
export interface MenuPermissionsResponse {
  processingForms: string[];
  approvingForms: string[];
  viewingForms: string[];
  chotPhieuForms?: string[];
  /** Raw quyền mở rộng (>= 6) — FE tự tra `bmQuyenConfig.ts` để biết thuộc vùng nào. */
  extraQuyens?: ExtraQuyenMenuItem[];
  /** Kho dữ liệu (vung 5): mã KDL_* có quyền XEM. */
  kdlForms?: string[];
  /** Quản trị (vung 6): mã QTRI_* có quyền XULY. */
  qtriForms?: string[];
}

export const BmQuyenXlApi = {
  // Lấy danh sách quyền xử lý của tài khoản
  getByTaiKhoan: (idTaiKhoan: number) =>
    apiService.get(`/api/BmQuyenXl?idTaiKhoan=${idTaiKhoan}`),

  /** Lấy MaBM cho menu: processingForms = XULY/CHOT, approvingForms = PHEDUYET */
  getMenuPermissions: async (
    idTaiKhoan: number,
  ): Promise<MenuPermissionsResponse> => {
    const res = await apiService.get<
      MenuPermissionsResponse & {
        ProcessingForms?: string[];
        ApprovingForms?: string[];
        ViewingForms?: string[];
        chotPhieuForms?: string[];
        ExtraQuyens?: { MaBm?: string; QuyenChucNang?: number }[];
      }
    >(`/api/BmQuyenXl/menu-permissions?idTaiKhoan=${idTaiKhoan}`);

    // Axios trả về AxiosResponse; cần unwrap .data trước khi đọc trường business
    const data = (res as { data?: unknown })?.data ?? res;
    const d = data as Record<string, unknown>;
    const rawExtra = (d?.extraQuyens ?? d?.ExtraQuyens ?? []) as Array<
      Record<string, unknown>
    >;

    return {
      processingForms: (d?.processingForms ?? d?.ProcessingForms ?? []) as string[],
      approvingForms: (d?.approvingForms ?? d?.ApprovingForms ?? []) as string[],
      viewingForms: (d?.viewingForms ?? d?.ViewingForms ?? []) as string[],
      chotPhieuForms: (d?.chotPhieuForms ?? d?.ChotPhieuForms ?? []) as string[],
      extraQuyens: rawExtra.map((r) => ({
        maBm: (r.maBm ?? r.MaBm ?? "") as string,
        quyenChucNang: Number(r.quyenChucNang ?? r.QuyenChucNang ?? 0),
      })),
      kdlForms: (d?.kdlForms ?? d?.KdlForms ?? []) as string[],
      qtriForms: (d?.qtriForms ?? d?.QtriForms ?? []) as string[],
    };
  },

  // Lấy tất cả quyền
  getAll: () => apiService.get("/api/BmQuyenXl"),

  // Thêm quyền mới
  create: (data: BmQuyenXlModel) => apiService.post("/api/BmQuyenXl", data),

  // Cập nhật quyền (gửi idTaiKhoan, maBm, maKhuVuc, quyenChucNang)
  update: (
    id: number,
    data: Pick<
      BmQuyenXlModel,
      "idTaiKhoan" | "maBm" | "maKhuVuc" | "quyenChucNang"
    >,
  ) => apiService.put(`/api/BmQuyenXl/${id}`, data),

  // Xóa quyền
  delete: (id: number) => apiService.delete(`/api/BmQuyenXl/${id}`),

  // Thêm nhiều quyền cùng lúc
  createBulk: (data: BmQuyenXlModel[]) =>
    apiService.post("/api/BmQuyenXl/bulk", data),

  // Lưu hàng loạt: tích Descartes (maBm × maKhuVuc × quyenChucNang) → mỗi tổ hợp = 1 dòng.
  // idsToDelete: danh sách ID cũ cần xóa trước khi tạo mới (khi cập nhật toàn bộ quyền user).
  bulkSave: (data: {
    idTaiKhoan: number;
    idsToDelete: number[];
    items: {
      maBm: string;
      maKhuVucs: string[];
      quyenChucNangs: number[];
      khuVucPhus?: string[];
    }[];
  }) => apiService.post("/api/BmQuyenXl/save", data),

  // Xóa toàn bộ quyền của tài khoản
  deleteByTaiKhoan: (idTaiKhoan: number) =>
    apiService.delete(`/api/BmQuyenXl/tai-khoan/${idTaiKhoan}`),
};
