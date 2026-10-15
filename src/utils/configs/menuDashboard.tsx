import { BM_CONFIG } from "./BieuMauConst";

export const MenuDataDashboard = [
  {
    category: "NM.NL",
    icon: "nmnl",
    color: "#1890ff",
    items: [
      // {
      //   code: "nhatkyquangtrunghoa",
      //   title: "BM.06/QT.05.01 NHẬT KÝ THAO TÁC PHỐI TRỘN QUẶNG TRUNG HÒA",
      //   maBm: "NL_BB_Quangtrunghoa",
      // },
      {
        code: "bangtheodoibenphe",
        title: "BM.18/HD.25.08 BẢNG THEO DÕI BEN PHẾ",
        maBm: BM_CONFIG.NL.NL_BB_TheoDoiBenPhe,
      },
    ],
  },
  {
    category: "NM.HRC1",
    icon: "hrc1",
    color: "#720101ff",
    items: [
      // {
      //   code: "bienbantheplong",
      //   title: "BM.16/QT.05.10 BIÊN BẢN GIAO NHẬN THÉP LỎNG",
      //   maBm: BM_CONFIG.HRC1.HRC1_BB_Theplong,
      // },
      // {
      //   code: "tieuhaolothoi",
      //   title: "BM.08/QT.05.15 BIÊN BẢN TIÊU HAO NẤU LUYỆN LÒ THỔI",
      //   maBm: BM_CONFIG.HRC1.HRC1_BB_Lothoi,
      // },
      {
        code: "bienbanphoinong",
        title: "BM.06/QT.05.10 BIÊN BẢN GIAO NHẬN PHÔI NÓNG (GIAO PHÔI)",
        maBm: BM_CONFIG.CTD.CTD_BB_Phoinong,
      },
      {
        code: "bienbanphoinapnguoi",
        title: "BM.02/QT.05.13 BIÊN BẢN GIAO NHẬN PHÔI NẠP NGUỘI (GIAO PHÔI)",
        maBm: BM_CONFIG.CTD.CTD_BB_PhoiNapnguoi,
      },
      {
        code: "bienbansanluongphoi",
        title: "BM.11/QT.05.11 BIÊN BẢN XÁC NHẬN SẢN LƯỢNG PHÔI THÉP",
        maBm: BM_CONFIG.HRC1.HRC1_BB_Sanluongphoi,
      },
      {
        code: "bienbanphoinapkho",
        title: "BM.12/QT.05.11 BIÊN BẢN GIAO NHẬN PHÔI NHẬP KHO",
        maBm: BM_CONFIG.HRC1.HRC1_BB_GiaoNhanPhoiNhapKho,
      },
      {
        code: "giaonhantheplong_hrc1",
        title: "BM.16/QT.05.10 BIÊN BẢN GIAO NHẬN THÉP LỎNG",
        maBm: BM_CONFIG.HRC1.HRC1_BBGN_ThepLong,
      },
      {
        code: "bbgnphoitam_hrc1",
        title: "BM.29/QT.05.12 BIÊN BẢN SẢN LƯỢNG PHÔI TẤM",
        maBm: BM_CONFIG.HRC1.HRC1_BBSL_PhoiTam,
      },
      {
        code: "hrc1_tieuhaolothoi",
        title: "BM.07/QT.05.10 BIÊN BẢN TIÊU HAO NẤU LUYỆN LÒ THỔI BOF",
        maBm: BM_CONFIG.HRC1.HRC1_BB_TieuHao_BOF,
      },
      {
        code: "hrc1_tieuhaotinhluyenlf",
        title: "BM.14/QT.05.10 BIÊN BẢN TIÊU HAO NẤU LUYỆN TINH LUYỆN LF",
        maBm: BM_CONFIG.HRC1.HRC1_BB_TieuHao_LF,
      },
    ],
  },
  {
    category: "NM.HRC2",
    icon: "nmhrc2",
    color: "#019221ff",
    items: [
      {
        code: "tieuhaonauluyen_lf",
        title: "BM.14/QT.05.15 BẢNG TIÊU HAO NẤU LUYỆN LÒ TINH LUYỆN LF",
        maBm: BM_CONFIG.HRC2.HRC2_BB_NauLuyen_LF,
      },
      {
        code: "tieuhaonauluyen_bof",
        title: "BM.08/QT.05.15 BIÊN BẢN TIÊU HAO NẤU LUYỆN LÒ THỔI",
        maBm: BM_CONFIG.HRC2.HRC2_BB_NauLuyen_BOF,
      },
      {
        code: "tieuhaonauluyen_rh",
        title: "BM.16/QT.05.15 BẢNG TIÊU HAO NẤU LUYỆN LÒ TINH LUYỆN RH",
        maBm: BM_CONFIG.HRC2.HRC2_BB_NauLuyen_RH,
      },
      {
        code: "giaonhantheplong",
        title: "BM.28/QT.05.15 BIÊN BẢN GIAO NHẬN THÉP LỎNG",
        maBm: BM_CONFIG.HRC2.HRC2_BBGN_ThepLong,
      },
      {
        code: "bbgnphoitam",
        title: "BM.40/QT.05.15 BIÊN BẢN SẢN LƯỢNG PHÔI TẤM",
        maBm: BM_CONFIG.HRC2.HRC2_BBSL_PhoiTam,
      }
    ],
  },
  {
    category: "NM.CTD",
    icon: "nmctd",
    color: "#722ed1",
    items: [
      {
        code: "sotheodoisanxuat",
        title: "BM.09/QT.05.13 SỔ THEO DÕI SẢN XUẤT HÀNG NGÀY",
        maBm: BM_CONFIG.CTD.CTD_STD_Sanxuat,
      },
      {
        code: "viecdentoi/bienbanphoinong",
        title: "BM.06/QT.05.10 BIÊN BẢN GIAO NHẬN PHÔI NÓNG (NHẬN PHÔI)",
        maBm: BM_CONFIG.CTD.CTD_BB_Phoinong,
      },
      {
        code: "viecdentoi/bienbangiaoNhanphoi",
        title: "BM.05/QT.05.13 BIÊN BẢN GIAO NHẬN PHÔI",
        maBm: BM_CONFIG.CTD.CTD_BB_GiaoNhanPhoi,
      },
      {
        code: "bienbanphoinapnguoi",
        title: "BM.02/QT.05.13 BIÊN BẢN GIAO NHẬN PHÔI NẠP NGUỘI (NHẬN PHÔI)",
        maBm: BM_CONFIG.CTD.CTD_BB_PhoiNapnguoi,
      },
      {
        code: "phieuxulykph",
        title: "BM.01C/QT.11 PHIẾU XỬ LÝ THÀNH PHẨM/ SẢN PHẨM KHÔNG PHÙ HỢP",
        maBm: BM_CONFIG.CTD.CTD_KPH_Sanxuat,
      },
      {
        code: "sanluongkcs",
        title: "BM.08/QT.05.13 BIÊN BẢN XÁC NHẬN SẢN LƯỢNG",
        maBm: BM_CONFIG.CTD.CTD_BB_SanLuong_KCS,
      },
    ],
  },
  {
    category: "NM.LG",
    icon: "nmlg",
    color: "#019221ff",
    items: [
      {
        code: "naplieulocao",
        title: "BM.05/QT.05.09 SỔ THEO DÕI NẠP LIỆU LÒ CAO",
        maBm: BM_CONFIG.NMLG.NMLG_BM_NapLieuLoCao,
      },
      {
        code: "tonsilolocao",
        title: "BM.07/QT.05.09 CHỐT KHỐI LƯỢNG SILO LÒ CAO",
        maBm: BM_CONFIG.NMLG.NMLG_BM_TonSiloLoCao,
      },
      {
        code: "nkvhthanphunlocao",
        title: "BM.10/QT.05.09 NHẬT KÝ VẬN HÀNH PHUN THAN LÒ CAO",
        maBm: BM_CONFIG.NMLG.NMLG_NK_VHPTLC,
      },
    ],
  },
  {
    category: "NM.TKVV",
    icon: "nmtkvv",
    color: "#019221ff",
    items: [
      {
        code: "sanluongtkvv",
        title: "BIÊN BẢN SẢN LƯỢNG",
        maBm: BM_CONFIG.TKVV.TKVV_BB_SanLuong,
      },
      {
        code: "baocaoslcptkvv",
        title: "BÁO CÁO SẢN LƯỢNG & CHI PHÍ",
        maBm: BM_CONFIG.TKVV.TKVV_BC_SanLuongChiPhi,
      },
      {
        code: "tonsilotkvv",
        title: "BM.05/QT.05.03 SỔ THEO DÕI XUẤT NHẬP TỒN SILO",
        maBm: BM_CONFIG.TKVV.TKVV_TonSilo,
      },
    ],
  },
];
