/**
 * Model cho dữ liệu bảng 1 - Số liệu kiểm kê (Sổ Xuất-Nhập-Tồn HRC1)
 * Mirror STD_NXT_Table1Row của HRC2, đổi idNguyenNhienLieu -> idPhuLieu (HRC1_PhuLieuNM.ID).
 */
export interface STD_NXT_HRC1_Table1Row {
  key?: string;
  khuVuc: string; // Khu vực (Lò thổi 1-5, Tinh luyện 1-5)
  viTri: number; // Vị trí (Trong silo, Ngoài silo)
  nguyenNhienLieu: string; // Tên phụ liệu (từ HRC1_PhuLieuNM.tenPhuLieu)
  idPhuLieu?: number | null; // ID của HRC1_PhuLieuNM
  siloId?: number | null;
  tenSilo?: string | null;
  tonDauCa?: string | number;
  tuongQuanDauCa?: string;
  nhapTrongCa?: string | number;
  mucLieu?: string | number;
  theTich?: string | number;
  tyTrong?: string | number;
  tonCuoiCa?: string | number;
  tuongQuanCuoiCa?: string;
  tongThucTe?: string | number;
  luongSuDungKiemKe?: string | number;
}

/**
 * Model cho dữ liệu bảng 2 - Tổng hợp số liệu kiểm kê (Sổ Xuất-Nhập-Tồn HRC1)
 * Mirror STD_NXT_Table2Row của HRC2 nhưng bỏ tyLeRH/KLPB_RH (HRC1 không có công đoạn RH).
 */
export interface STD_NXT_HRC1_Table2Row {
  key?: string;
  totalText?: string;
  totalNguyenNhienLieu?: string;
  totalTonDauCa?: string | number;
  totalNhapTrongCa?: string | number;
  totalTonCuoiCa?: string | number;
  totalSuDung?: string | number;
  totalSDTrongSoSach?: string | number;
  totalChenhLech?: string | number;
  tyLeBOF?: string | number | null;
  tyLeLF?: string | number | null;
  /** Từ BE: đã phân bổ chênh lệch hay chưa (để hiển thị nút Thu hồi/Phân bổ) */
  HasPhanBo?: boolean | null;
  PhuLieuID?: number | null;
  /** Ngày sản xuất (YYYY-MM-DD) — dùng cho payload phân bổ/thu hồi */
  NgaySX?: string;
  /** Ca (1/2) — dùng cho payload phân bổ/thu hồi */
  Ca?: number;
  /** Khối lượng phân bổ theo 1 mẻ (từ BE) */
  KLPB_BOF?: string | number | null;
  KLPB_LF?: string | number | null;
}

/**
 * Model cho chi tiết nguyên liệu trong payload NXT Upsert (HRC1)
 */
export interface NXTDetailDto_HRC1 {
  Scope: number; // Giá trị enum ToHopSTDNXT_HRC1 (1-10): 1-5=Lò thổi 1-5, 6-10=Tinh luyện 1-5
  ViTri: number; // Vị trí (Trong silo = 1, Ngoài silo = 2)
  PhuLieuID: number; // ID của HRC1_PhuLieuNM
  IDSilo?: number | null;
  TenNguyenLieu: string;
  TonDauCa: number;
  MucLieu: number;
  TheTich: number;
  TyTrong: number;
  TuongQuanDauCa: string;
  NhapVaoTrongCa: number;
  TonCuoiCa: number;
  TuongQuanCuoiCa: string;
  TongThucTe: number;
  LuongSuDungKiemKe?: number | null;
  ThuTu?: number | null; // Thứ tự hiển thị dòng trong bảng (theo Scope), do người dùng sắp xếp trên UI
}

/**
 * Model cho tổng hợp nguyên liệu trong payload NXT Upsert (HRC1)
 */
export interface NXTSummaryDto_HRC1 {
  PhuLieuID: number;
  TenNguyenLieu: string;
  TongTonDauCa: number;
  TongNhapTrongCa: number;
  TongTonCuoiCa: number;
  TongSuDung: number;
  TongSDTrenSoSach: number;
  ChenhLech: number;
  HasPhanBo?: boolean | null;
  KLPB_BOF?: number | null;
  KLPB_LF?: number | null;
}

/**
 * Model payload gửi lên API Upsert cho STD_NXT_HRC1
 */
export interface STD_NXT_HRC1_UpsertDto {
  IdPhieu: string | null;
  NgaySX: string | null;
  Ca: number;
  BieuMau: string; // Mã biểu mẫu ("HRC1_STD_NXT")
  Details: NXTDetailDto_HRC1[];
  Summary: NXTSummaryDto_HRC1[];
}

export interface STD_NXT_HRC1_GetDetailResponse {
  Id_Phieu: string;
  BieuMau: string;
  NgaySX: string;
  Ca: number;
  Details: NXTDetailDto_HRC1[];
  Summary: NXTSummaryDto_HRC1[];
}

export interface STD_NXT_HRC1_PhanBoDto {
  NgaySX: string;
  Ca: number;
  PhuLieuID: number;
  ChenhLech: number;
  IdPhieu: string;
  TyLeBOF?: number | null;
  TyLeLF?: number | null;
}

export interface STD_NXT_HRC1_KhongPhanBoDto {
  NgaySX: string;
  Ca: number;
  IdPhieu: string;
  PhuLieuID: number;
}

/**
 * Payload lọc "Nhập Xuất Tồn" (đối chiếu tồn cuối ca trước / tồn đầu ca sau) theo khoảng ngày.
 */
export interface STD_NXT_HRC1_NhapXuatTonSearchRequest {
  TuNgay: string;
  DenNgay: string;
}

/**
 * 1 dòng đối chiếu: bên trái là Tồn cuối của phiếu ca trước, bên phải là Tồn đầu của phiếu ca sau
 * (cùng Scope + Phụ liệu, ghép theo 2 bản ghi liên tiếp trong thời gian).
 * Field camelCase — khớp System.Text.Json (mặc định lowercase ký tự đầu) của BE.
 */
export interface STD_NXT_HRC1_NhapXuatTonRow {
  ngaySXTruoc?: string | null;
  caTruoc?: number | null;
  phuLieuTruoc?: string | null;
  tonCuoiTruoc?: number | null;

  ngaySXSau?: string | null;
  caSau?: number | null;
  phuLieuSau?: string | null;
  tonDauSau?: number | null;
}
