import { SIDEBAR_CONST } from "../constants/sidebarConstant";
import { BM_CONFIG } from "./BieuMauConst";

export interface KhuVucQuyenItem {
  maKhuVuc: string;
  tenKhuVuc: string;
}

export interface KhuVucPhuItem {
  khuVucPhu: string;
  tenKhuVuc: string;
  /** Nếu set: khi lưu phân quyền sẽ tạo record riêng với maBm=targetMaBm, maKhuVuc=targetScope */
  targetMaBm?: string;
  targetScope?: string;
}

export interface ExtraQuyenChucNangItem {
  value: number;
  label: string;
  vung: number;
}

/**
 * Nguồn scope động thay cho mảng `scope` tĩnh.
 * - "mayDuc": scope = MayDuc.Id của nhà máy `nhaMay` (bảng MayDuc) — thêm máy đúc mới không cần sửa code.
 * Đọc scope qua useBmScopes().getScope(maBm), không đọc trực tiếp `bm.scope`.
 */
export type BmScopeSource = { type: "mayDuc"; nhaMay: number };

export interface BieuMauQuyenItem {
  maBm: string;
  tenBm: string;
  nhom: string;
  scope?: KhuVucQuyenItem[];
  scopeSource?: BmScopeSource;
  khuVucPhus?: KhuVucPhuItem[];
  /** Quyền chức năng riêng của BM này (value >= 6), chỉ hiện khi đang chọn đúng BM — không dùng chung với BM khác */
  extraQuyens?: ExtraQuyenChucNangItem[];
}

export const bmQuyenConfig = {
  danhSachQuyenChucNang: [
    { value: 1, label: "Xử lý " },
    { value: 2, label: "Phê duyệt " },
    { value: 3, label: "Chốt" },
    { value: 4, label: "Xử lý + Phê duyệt", disabled: true }, // không cho chọn mới, chỉ để hiển thị dữ liệu cũ
    { value: 5, label: "Xem " },
  ],
  danhSachBieuMau: [
    {
      maBm: BM_CONFIG.CTD.CTD_STD_Sanxuat,
      tenBm: "Sổ theo dõi sản xuất hàng ngày",
      nhom: "NM.CTD"
    },
    {
      maBm: BM_CONFIG.CTD.CTD_BB_Phoinong,
      tenBm: "Biên bản phôi nóng",
      nhom: "NM.CTD",
      scope: [
        { maKhuVuc: "1", tenKhuVuc: "Xưởng cán 1" },
        { maKhuVuc: "2", tenKhuVuc: "Xưởng cán 2" },
        { maKhuVuc: "3", tenKhuVuc: "Xưởng cán 3" },
        { maKhuVuc: "4", tenKhuVuc: "Xưởng cán 4" },
      ]
    },
    {
      maBm: BM_CONFIG.CTD.CTD_KPH_Sanxuat,
      tenBm: "Phiếu xử lý sản phẩm không phù hợp",
      nhom: "NM.CTD",
    },
    {
      maBm: BM_CONFIG.CTD.CTD_BB_SanLuong_KCS,
      tenBm: "Biên bản xác nhận sản lượng",
      nhom: "NM.CTD",
    },
    {
      maBm: BM_CONFIG.CTD.CTD_BB_PhoiNapnguoi,
      tenBm: "Biên bản phôi nạp nguội",
      nhom: "NM.CTD",
    },
    {
      maBm: BM_CONFIG.CTD.CTD_BB_GiaoNhanPhoi,
      tenBm: "Biên bản giao nhận phôi",
      nhom: "NM.CTD",
    },
    {
      maBm: BM_CONFIG.HRC2.HRC2_BBSL_PhoiTam,
      tenBm: "Biên bản sản lượng phôi tấm",
      nhom: "NM.HRC2",
      // Không có scope vùng máy — workflow thống nhất 1 bảng
      // khuVucPhus tạo record BM_QuyenXL riêng cho từng bộ phận
      // PKH được cấp quyền Chốt (3) trực tiếp trên maBm HRC2_BBSL_PhoiTam
      khuVucPhus: [
        { khuVucPhu: "KCS", tenKhuVuc: "Bộ phận KCS" },
        { khuVucPhu: "Duc", tenKhuVuc: "Bộ phận Đúc" },
        { khuVucPhu: "Kho", tenKhuVuc: "Bộ phận Kho" },
      ]
    },
    {
      maBm: BM_CONFIG.HRC2.HRC2_STD_NXT,
      tenBm: "STD - Nhập xuất tồn",
      nhom: "NM.HRC2",
    },
    {
      maBm: BM_CONFIG.HRC2.HRC2_BB_NauLuyen_BOF,
      tenBm: "Biên bản tiêu hao nấu luyện lò thổi BOF",
      nhom: "NM.HRC2",
      scope: [
        { maKhuVuc: "6", tenKhuVuc: "Lò thổi 6" },
        { maKhuVuc: "7", tenKhuVuc: "Lò thổi 7" },
      ]
    },
    {
      maBm: BM_CONFIG.HRC2.HRC2_BB_NauLuyen_LF,
      tenBm: "Biên bản tiêu hao nấu luyện lò tinh luyện LF",
      nhom: "NM.HRC2",
      scope: [
        { maKhuVuc: "6", tenKhuVuc: "Tinh luyện 6" },
      ]
    },
    {
      maBm: BM_CONFIG.HRC2.HRC2_BB_NauLuyen_RH,
      tenBm: "Biên bản tiêu hao nấu luyện lò tinh luyện RH",
      nhom: "NM.HRC2",
      scope: [
        { maKhuVuc: "1", tenKhuVuc: "RH 1" },
        { maKhuVuc: "2", tenKhuVuc: "RH 2" },
      ]
    },
    {
      maBm: BM_CONFIG.HRC1.HRC1_BB_GiaoNhanPhoiNhapKho,
      tenBm: "Biên bản giao nhận phôi nhập kho",
      nhom: "NM.HRC1",
    },
    {
      maBm: BM_CONFIG.HRC1.HRC1_BB_Sanluongphoi,
      tenBm: "Biên bản sản lượng phôi",
      nhom: "NM.HRC1",
    },
    {
      maBm: BM_CONFIG.HRC1.HRC1_BB_TieuHao_BOF,
      tenBm: "Biên bản tiêu hao nấu luyện lò thổi BOF",
      nhom: "NM.HRC1",
      scope: [
        { maKhuVuc: "1", tenKhuVuc: "Lò thổi 1" },
        { maKhuVuc: "2", tenKhuVuc: "Lò thổi 2" },
        { maKhuVuc: "3", tenKhuVuc: "Lò thổi 3" },
        { maKhuVuc: "4", tenKhuVuc: "Lò thổi 4" },
        { maKhuVuc: "5", tenKhuVuc: "Lò thổi 5" },
      ]
    },
    {
      maBm: BM_CONFIG.HRC1.HRC1_BB_TieuHao_LF,
      tenBm: "Biên bản tiêu hao nấu luyện tinh luyện LF",
      nhom: "NM.HRC1",
      scope: [
        { maKhuVuc: "1", tenKhuVuc: "Tinh luyện 1" },
        { maKhuVuc: "2", tenKhuVuc: "Tinh luyện 2" },
        { maKhuVuc: "3", tenKhuVuc: "Tinh luyện 3" },
        { maKhuVuc: "4", tenKhuVuc: "Tinh luyện 4" },
        { maKhuVuc: "5", tenKhuVuc: "Tinh luyện 5" },
      ]
    },
    {
      maBm: BM_CONFIG.HRC2.HRC2_BBGN_ThepLong,
      tenBm: "Biên bản giao nhận thép lỏng",
      nhom: "NM.HRC2",
      // Scope = MayDuc.Id (NhaMay = HRC2) — lấy động từ bảng MayDuc
      scopeSource: { type: "mayDuc", nhaMay: 2 },
      khuVucPhus: [
        { khuVucPhu: "6", tenKhuVuc: "Lò thổi 6" },
        { khuVucPhu: "7", tenKhuVuc: "Lò thổi 7" },
        { khuVucPhu: "TL", tenKhuVuc: "Tinh luyện" }
      ]
    },
    {
      maBm: BM_CONFIG.HRC1.HRC1_BBGN_ThepLong,
      tenBm: "Biên bản giao nhận thép lỏng",
      nhom: "NM.HRC1",
      // Scope = MayDuc.Id (NhaMay = HRC1) — lấy động từ bảng MayDuc
      scopeSource: { type: "mayDuc", nhaMay: 1 },
      khuVucPhus: [
        { khuVucPhu: "1", tenKhuVuc: "Lò thổi 1", targetMaBm: "HRC1_LoThoi", targetScope: "1" },
        { khuVucPhu: "2", tenKhuVuc: "Lò thổi 2", targetMaBm: "HRC1_LoThoi", targetScope: "2" },
        { khuVucPhu: "3", tenKhuVuc: "Lò thổi 3", targetMaBm: "HRC1_LoThoi", targetScope: "3" },
        { khuVucPhu: "4", tenKhuVuc: "Lò thổi 4", targetMaBm: "HRC1_LoThoi", targetScope: "4" },
        { khuVucPhu: "5", tenKhuVuc: "Lò thổi 5", targetMaBm: "HRC1_LoThoi", targetScope: "5" },
        { khuVucPhu: "TL1", tenKhuVuc: "Tinh luyện 1", targetMaBm: "HRC1_TinhLuyen", targetScope: "1" },
        { khuVucPhu: "TL2", tenKhuVuc: "Tinh luyện 2", targetMaBm: "HRC1_TinhLuyen", targetScope: "2" },
        { khuVucPhu: "TL3", tenKhuVuc: "Tinh luyện 3", targetMaBm: "HRC1_TinhLuyen", targetScope: "3" },
        { khuVucPhu: "TL4", tenKhuVuc: "Tinh luyện 4", targetMaBm: "HRC1_TinhLuyen", targetScope: "4" },
        { khuVucPhu: "TL5", tenKhuVuc: "Tinh luyện 5", targetMaBm: "HRC1_TinhLuyen", targetScope: "5" },
      ],
    },
    {
      maBm: BM_CONFIG.NL.NL_BB_TheoDoiBenPhe,
      tenBm: "Biên bản theo dõi ben phế",
      nhom: "NM.NL",
    },
    {
      maBm: BM_CONFIG.NMLG.NMLG_BM_TonSiloLoCao,
      tenBm: "Biên bản tồn silo lò cao",
      nhom: "NM.NMLG",
      scope: [
        { maKhuVuc: "1", tenKhuVuc: "Lò Cao 1" },
        { maKhuVuc: "2", tenKhuVuc: "Lò Cao 2" },
        { maKhuVuc: "3", tenKhuVuc: "Lò Cao 3" },
        { maKhuVuc: "4", tenKhuVuc: "Lò Cao 4" },
        { maKhuVuc: "5", tenKhuVuc: "Lò Cao 5" },
        { maKhuVuc: "6", tenKhuVuc: "Lò Cao 6" },
      ]
    },
    {
      maBm: BM_CONFIG.NMLG.NMLG_BM_NapLieuLoCao,
      tenBm: "Biên bản nạp liệu lò cao",
      nhom: "NM.NMLG",
      scope: [
        { maKhuVuc: "1", tenKhuVuc: "Lò Cao 1" },
        { maKhuVuc: "2", tenKhuVuc: "Lò Cao 2" },
        { maKhuVuc: "3", tenKhuVuc: "Lò Cao 3" },
        { maKhuVuc: "4", tenKhuVuc: "Lò Cao 4" },
        { maKhuVuc: "5", tenKhuVuc: "Lò Cao 5" },
        { maKhuVuc: "6", tenKhuVuc: "Lò Cao 6" },
      ]
    }, {
      maBm: BM_CONFIG.NMLG.NMLG_NK_VHPTLC,
      tenBm: "Nhật ký vận hành phun than lò cao",
      nhom: "NM.NMLG",
      scope: [
        { maKhuVuc: "1", tenKhuVuc: "Lò Cao 1" },
        { maKhuVuc: "2", tenKhuVuc: "Lò Cao 2" },
        { maKhuVuc: "3", tenKhuVuc: "Lò Cao 3" },
        { maKhuVuc: "4", tenKhuVuc: "Lò Cao 4" },
        { maKhuVuc: "5", tenKhuVuc: "Lò Cao 5" },
        { maKhuVuc: "6", tenKhuVuc: "Lò Cao 6" },
      ]
    },
    {
      maBm: BM_CONFIG.HRC1.THONGKE_HRC1,
      tenBm: "Thống kê dữ liệu HRC1 ",
      nhom: "NM.HRC1",
      scope: [
        { maKhuVuc: "TIEUHAO", tenKhuVuc: "Tab: Thống kê tiêu hao HRC1" },
        { maKhuVuc: "BBGN", tenKhuVuc: "Tab: Thống kê BBGN thép lỏng" },
      ],
      extraQuyens: [
        { value: 6, label: "Xác nhận PCN" , vung: SIDEBAR_CONST.VUNG_3 },
      ]
    },
    {
      maBm: BM_CONFIG.HRC2.THONGKE_HRC2,
      tenBm: "Thống kê dữ liệu HRC2 ",
      nhom: "NM.HRC2",
      scope: [
        { maKhuVuc: "TIEUHAO", tenKhuVuc: "Tab: Thống kê tiêu hao HRC2" },
        { maKhuVuc: "BBGN", tenKhuVuc: "Tab: Thống kê BBGN thép lỏng" },
      ]
    },
    {
      maBm: BM_CONFIG.HRC1.HRC1_BBSL_PhoiTam,
      tenBm: "Biên bản sản lượng phôi tấm",
      nhom: "NM.HRC1",
      khuVucPhus: [
        { khuVucPhu: "Duc", tenKhuVuc: "Bộ phận Đúc" },
        { khuVucPhu: "Can", tenKhuVuc: "Bộ phận Cán Tấm" },
        // "C4" (GĐ/PGĐ NM) đã bỏ khỏi luồng — không cấp mới; user đã được cấp C4 trước đó vẫn giữ
        // quyền (BM_QuyenXL không xóa) để xử lý tiếp các phiếu cũ còn dính luồng C4.
      ]
    },
    {
      maBm: BM_CONFIG.TKVV.TKVV_BB_SanLuong,
      tenBm: "Biên bản sản lượng",
      nhom: "NM.TKVV",
      scope: [
        { maKhuVuc: "1", tenKhuVuc: "Thiêu kết 1" },
        { maKhuVuc: "2", tenKhuVuc: "Thiêu kết 2" },
        { maKhuVuc: "3", tenKhuVuc: "Thiêu kết 3" },
        { maKhuVuc: "4", tenKhuVuc: "Thiêu kết 4" },
        { maKhuVuc: "5", tenKhuVuc: "Vê viên 1" },
        { maKhuVuc: "6", tenKhuVuc: "Vê viên 2" },
      ]
    },
    {
      maBm: BM_CONFIG.TKVV.TKVV_BC_SanLuongChiPhi,
      tenBm: "Báo cáo sản lượng & chi phí",
      nhom: "NM.TKVV",
      scope: [
        { maKhuVuc: "1", tenKhuVuc: "Thiêu kết 1" },
        { maKhuVuc: "2", tenKhuVuc: "Thiêu kết 2" },
        { maKhuVuc: "3", tenKhuVuc: "Thiêu kết 3" },
        { maKhuVuc: "4", tenKhuVuc: "Thiêu kết 4" },
        { maKhuVuc: "5", tenKhuVuc: "Vê viên 1" },
        { maKhuVuc: "6", tenKhuVuc: "Vê viên 2" },
      ]
    },
    {
      maBm: BM_CONFIG.TKVV.TKVV_TonSilo,
      tenBm: "Sổ theo dõi Xuất Nhập Tồn Silo",
      nhom: "NM.TKVV",
      scope: [
        { maKhuVuc: "1", tenKhuVuc: "Thiêu kết 1" },
        { maKhuVuc: "2", tenKhuVuc: "Thiêu kết 2" },
        { maKhuVuc: "3", tenKhuVuc: "Thiêu kết 3" },
        { maKhuVuc: "4", tenKhuVuc: "Thiêu kết 4" },
        { maKhuVuc: "5", tenKhuVuc: "Vê viên 1" },
        { maKhuVuc: "6", tenKhuVuc: "Vê viên 2" },
      ]
    },
    {
      maBm: BM_CONFIG.HRC1.HRC1_STD_NXT,
      tenBm: "STD - Nhập xuất tồn HRC1",
      nhom: "NM.HRC1",
    },

  ] as BieuMauQuyenItem[],
};
