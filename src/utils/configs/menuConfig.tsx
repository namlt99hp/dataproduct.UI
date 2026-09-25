// src/config/menuConfig.ts
import {
  UserOutlined,
  UploadOutlined,
  AppstoreOutlined,
  AppstoreAddOutlined,
  DeliveredProcedureOutlined,
  ProfileOutlined,
  SettingOutlined,
  SafetyCertificateOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { Tooltip } from "antd";
import { NavLink } from "react-router-dom";
import { BM_CONFIG } from "./BieuMauConst";

/** Trường maBM dùng để so khớp với MaBM trong bảng BM_QuyenXL khi lọc menu theo quyền (XULY / PHEDUYET). */
export type MenuItemWithMaBM = {
  key: string;
  maBM?: string;
  /** true → không bypass cho admin/P.KH, luôn kiểm tra đúng quyền thật (dùng khi item đã có đường vào không giới hạn khác, vd bản gốc ở vùng khác). */
  strictMaBM?: boolean;
  label: React.ReactNode;
  vung?: number;
  children?: MenuItemWithMaBM[];
  [key: string]: unknown;
};

export const menuConfig = [
  {
    key: "1",
    icon: <UserOutlined />,
    label: <NavLink to="/">Trang chủ</NavLink>,
    // roles: ["admin"], // chỉ admin mới thấy
  },
  {
    key: "sub1",
    label: "Kho dữ liệu",
    roles: ["admin", "PKH"],
    icon: <AppstoreOutlined />,
    children: [
      {
        key: "sub1-1",
        label: "NM.HRC1",
        children: [
          {
            key: "sub1-1.1",
            label: (
              <Tooltip title="Phôi thép">
                <NavLink to="/sanluongphoi">Sản lượng phôi</NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub1-1.2",
            label: (
              <Tooltip title="Quản lý danh mục phụ liệu HRC1">
                <NavLink to="/hrc1-phulieu">Phụ liệu HRC1</NavLink>
              </Tooltip>
            ),
          },
        ],
      },
      // {
      //   key: "sub1-2",
      //   label: "NM.NL",
      //   children: [
      //     {
      //       key: "sub1-1.2",
      //       label: (
      //         <Tooltip title="Nguyên Vật liệu">
      //           <NavLink to="/nguyennhienlieu">Nguyên vật liệu</NavLink>
      //         </Tooltip>
      //       ),
      //     },
      //     // { key: "6", label: "Option 6" },
      //   ],
      // },
      // {
      //   key: "sub1-3",
      //   label: "NM.HRC2",
      //   children: [
      //     {
      //       key: "sub1-1.3",
      //       label: (
      //         <Tooltip title="HRC2 - Dữ liệu luyện thép">
      //           <NavLink to="/dlnmhrc2luyenthep">
      //             HRC2 - Dữ liệu luyện thép
      //           </NavLink>
      //         </Tooltip>
      //       ),
      //     },
      //     {
      //       key: "sub1-1.4",
      //       label: (
      //         <Tooltip title="HRC2 - Header Mapping">
      //           <NavLink to="/header-mapping">HRC2 - Header Mapping</NavLink>
      //         </Tooltip>
      //       ),
      //     },
      //   ],
      // },
      {
        key: "sub1-2",
        label: "NM.NL",
        children: [
          {
            key: "sub1-1.2",
            label: (
              <Tooltip title="Nguyên Vật liệu">
                <NavLink to="/nguyennhienlieu">Nguyên vật liệu</NavLink>
              </Tooltip>
            ),
          },
          // { key: "6", label: "Option 6" },
        ],
      },
      {
        key: "sub1-3",
        label: "NM.HRC2",
        children: [
          {
            key: "sub1-1.3",
            label: (
              <Tooltip title="HRC2 - Dữ liệu luyện thép">
                <NavLink to="/dlnmhrc2luyenthep">
                  HRC2 - Dữ liệu luyện thép
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub1-1.4",
            label: (
              <Tooltip title="HRC2 - Phụ Liệu">
                <NavLink to="/header-mapping">HRC2 - Phụ Liệu</NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub1-1.5",
            label: (
              <Tooltip title="HRC2 - Silo Nguyên liệu">
                <NavLink to="/silo">HRC2 - Silo Nguyên liệu</NavLink>
              </Tooltip>
            ),
          },
        ],
      },
      {
        key: "sub1-4",
        label: "NM.LG",
        children: [
          {
            key: "sub1-4-0",
            label: (
              <Tooltip title="Quản lý biểu mẫu tồn silo">
                <NavLink to="/silolocao">Quản lý biểu mẫu tồn silo</NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub1-4-2",
            label: (
              <Tooltip title="Quản lý biểu mẫu nạp liệu lò cao">
                <NavLink to="/quanlysilonvl">Quản lý biểu mẫu nạp liệu</NavLink>
              </Tooltip>
            ),
          },
        ],
      }
    ],
  },
  {
    key: "taoyeucau",
    icon: <UploadOutlined />,
    label: <NavLink to="/taoyeucau">Tạo yêu cầu</NavLink>,
    // roles: ["admin"], // chỉ admin mới thấy
  },
  {
    key: "sub2",
    label: "Việc tôi bắt đầu",
    vung: 1,
    icon: <AppstoreAddOutlined />,
    children: [
      // { key: "3", label: <NavLink to="/dashboard">Tạo yêu cầu</NavLink> },
      // { key: "4", label: "Option 4" },
      // {
      //   key: "sub2-2",
      //   label: "NM.NL",
      //   children: [
      //     {
      //       key: "4",
      //       label: (
      //         <Tooltip title="BM.06/QT.05.01 (Nhật ký thao tác phối trộn quặng trung hòa)">
      //           <NavLink to="/nhatkyquangtrunghoa">
      //             BM.06/QT.05.01 (Nhật ký thao tác phối trộn quặng trung hòa)
      //           </NavLink>
      //         </Tooltip>
      //       ),
      //     },
      //     // { key: "6", label: "Option 6" },
      //   ],
      // },
      // {
      //   key: "sub2-3",
      //   label: "NM.HRC1",
      //   children: [
      //     {
      //       key: "5",
      //       label: (
      //         <Tooltip title="BM.16/QT.05.10 (Biên bản giao nhận thép lỏng)">
      //           <NavLink to="/bienbantheplong">
      //             BM.16/QT.05.10 (Biên bản giao nhận thép lỏng)
      //           </NavLink>
      //         </Tooltip>
      //       ),
      //     },
      //     {
      //       key: "sub2-3-1",
      //       label: (
      //         <Tooltip title="BM.08/QT.05.15 (Biên bản tiêu hao nấu luyện lò thổi)">
      //           <NavLink to="/tieuhaolothoi">
      //             BM.08/QT.05.15 (Biên bản tiêu hao nấu luyện lò thổi)
      //           </NavLink>
      //         </Tooltip>
      //       ),
      //     },
      //   ],
      // },
      {
        key: "sub2-4",
        label: "NM.CTD",
        children: [
          {
            key: "sub2-4-1",
            maBM: BM_CONFIG.CTD.CTD_STD_Sanxuat,
            label: (
              <Tooltip title="BM.09/QT.05.13 (Sổ theo dõi sản xuất hàng ngày)">
                <NavLink to="/sotheodoisanxuat">
                  BM.09/QT.05.13 Sổ theo dõi sản xuất hàng ngày
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub2-4-2",
            maBM: BM_CONFIG.CTD.CTD_BB_Phoinong,
            label: (
              <Tooltip title="BM.06/QT.05.10 (Biên bản giao nhận phôi nóng)">
                <NavLink to="/bienbanphoinong">
                  BM.06/QT.05.10 Biên bản giao nhận phôi nóng (Nhận phôi)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub2-4-3",
            maBM: BM_CONFIG.CTD.CTD_BB_GiaoNhanPhoi,
            label: (
              <Tooltip title="BM.05/QT.05.13 (Biên bản giao nhận phôi)">
                <NavLink to="/bienbangiaoNhanphoi">
                  BM.05/QT.05.13 (Biên bản giao nhận phôi)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub2-4-4",
            maBM: BM_CONFIG.CTD.CTD_BB_PhoiNapnguoi,
            label: (
              <Tooltip title="BM.02/QT.05.13 (Biên bản giao nhận phôi nạp nguội)">
                <NavLink to="/bienbanphoinapnguoi">
                  BM.02/QT.05.13 (Biên bản giao nhận phôi nạp nguội)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub2-4-5",
            maBM: BM_CONFIG.CTD.CTD_KPH_Sanxuat,
            label: (
              <Tooltip title="BM.01C/QT.11 (Phiếu xử lý sản phẩm không phù hợp)">
                <NavLink to="/phieuxulykph">
                  BM.01C/QT.11 Phiếu xử lý sản phẩm không phù hợp
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub2-4-6",
            maBM: BM_CONFIG.CTD.CTD_BB_SanLuong_KCS,
            label: (
              <Tooltip title="BM.08/QT.05.13 (Biên bản xác nhận sản lượng)">
                <NavLink to="/sanluongkcs">
                  BM.08/QT.05.13 Biên bản xác nhận sản lượng
                </NavLink>
              </Tooltip>
            ),
          },
        ],
      },
      {
        key: "sub2-nl",
        label: "NM.NL",
        children: [
          {
            key: "sub2-nl-1",
            maBM: BM_CONFIG.NL.NL_BB_TheoDoiBenPhe,
            label: (
              <Tooltip title="BM.18/HD.25.08 (Bảng theo dõi ben phế)">
                <NavLink to="/bangtheodoibenphe">
                  BM.18/HD.25.08 Bảng theo dõi ben phế
                </NavLink>
              </Tooltip>
            ),
          },
        ],
      },
      // {
      //   key: "sub2-5",
      //   label: "NM.LG",
      //   children: [
      //     {
      //       key: "sub2-5-1",
      //       label: (
      //         <Tooltip title="BM.05/QT.05.09 (Sổ theo dõi nạp liệu lò cao)">
      //           <NavLink to="/naplieulocao">
      //             BM.05/QT.05.09 (Sổ theo dõi nạp liệu lò cao)
      //           </NavLink>
      //         </Tooltip>
      //       ),
      //     },
      //     {
      //       key: "sub2-5-2",
      //       label: (
      //         <Tooltip title="BM.07/QT.05.09 (Chốt khối lượng silo lò cao)">
      //           <NavLink to="/khoiluongsilo">
      //             BM.07/QT.05.09 (Chốt khối lượng silo lò cao)
      //           </NavLink>
      //         </Tooltip>
      //       ),
      //     },
      //     {
      //       key: "sub2-5-3",
      //       label: (
      //         <Tooltip title="BM.10/QT.05.09 (Nhật ký vận hành than phun lò cao)">
      //           <NavLink to="/vanhanhthanphun">
      //             BM.10/QT.05.09 (Nhật ký vận hành than phun lò cao)
      //           </NavLink>
      //         </Tooltip>
      //       ),
      //     },
      //     // { key: "6", label: "Option 6" },
      //   ],
      // },
      {
        key: "sub2-6",
        label: "NM.HRC2",
        children: [
          {
            key: "sub2-6-0",
            maBM: BM_CONFIG.HRC2.HRC2_STD_NXT,
            label: (
              <Tooltip title="STD - Nhập xuất tồn">
                <NavLink to="/std_nhapxuatton">STD - Nhập xuất tồn</NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub2-6-1",
            maBM: BM_CONFIG.HRC2.HRC2_BB_NauLuyen_BOF,
            label: (
              <Tooltip title="BM.08/QT.05.15 (Biên bản tiêu hao nấu luyện lò thổi BOF)">
                <NavLink to="/tieuhaonauluyen_bof">
                  BM.08/QT.05.15 (Biên bản tiêu hao nấu luyện lò thổi BOF)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub2-6-2",
            maBM: BM_CONFIG.HRC2.HRC2_BB_NauLuyen_LF,
            label: (
              <Tooltip title="BM.14/QT.05.15 (Bảng tiêu hao nấu luyện lò tinh luyện LF)">
                <NavLink to="/tieuhaonauluyen_lf">
                  BM.14/QT.05.15 (Bảng tiêu hao nấu luyện lò tinh luyện LF)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub2-6-3",
            maBM: BM_CONFIG.HRC2.HRC2_BB_NauLuyen_RH,
            label: (
              <Tooltip title="BM.16/QT.05.15 (Bảng tiêu hao nấu luyện lò tinh luyện RH)">
                <NavLink to="/tieuhaonauluyen_rh">
                  BM.16/QT.05.15 (Bảng tiêu hao nấu luyện lò tinh luyện RH)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub2-6-4",
            maBM: BM_CONFIG.HRC2.HRC2_BBSL_PhoiTam,
            label: (
              <Tooltip title="BM.36/QT.05.15 (Biên bản giao nhận phôi tấm)">
                <NavLink to="/bbgnphoitam">
                  BM.36/QT.05.15 (Biên bản giao nhận phôi tấm)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub2-6-5",
            maBM: BM_CONFIG.HRC2.HRC2_BBGN_ThepLong,
            label: (
              <Tooltip title="BM.16/QT.05.10 (Bảng giao nhận thép lỏng)">
                <NavLink to="/giaonhantheplong">
                  BM.16/QT.05.10 (Bảng giao nhận thép lỏng)
                </NavLink>
              </Tooltip>
            ),
          },
        ],
      },
      {
        key: "sub2-7",
        label: "NM.HRC1",
        children: [
          
          {
            key: "sub2-7-1",
            maBM: BM_CONFIG.HRC1.HRC1_BB_Sanluongphoi,
            label: (
              <Tooltip title="BM.11/QT.05.11 (Biên bản xác nhận sản lượng phôi thép)">
                <NavLink to="/bienbansanluongphoi">
                  BM.11/QT.05.11 (Biên bản xác nhận sản lượng phôi thép)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub2-7-2",
            maBM: BM_CONFIG.HRC1.HRC1_BB_GiaoNhanPhoiNhapKho,
            label: (
              <Tooltip title="BM.12/QT.05.11 (Biên bản giao nhận phôi nhập kho)">
                <NavLink to="/bienbanphoinapkho">
                  BM.12/QT.05.11 (Biên bản giao nhận phôi nhập kho)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub2-7-3",
            maBM: BM_CONFIG.HRC1.HRC1_BBGN_ThepLong,
            label: (
              <Tooltip title="BM.16/QT.05.10 (Bảng giao nhận thép lỏng)">
                <NavLink to="/giaonhantheplong_hrc1">
                  BM.16/QT.05.10 (Bảng giao nhận thép lỏng)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub2-7-4",
            maBM: BM_CONFIG.HRC1.HRC1_BBSL_PhoiTam,
            label: (
              <Tooltip title="BM.30/QT.05.12 (BB giao nhận phôi tấm HRC1)">
                <NavLink to="/bbgnphoitam_hrc1">
                  BM.30/QT.05.12 (BB giao nhận phôi tấm HRC1)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub2-7-5",
            maBM: BM_CONFIG.HRC1.HRC1_BB_TieuHao_BOF,
            label: (
              <Tooltip title="BM.07/QT.05.10 (BB Tiêu hao lò thổi BOF)">
                <NavLink to="/hrc1_tieuhaolothoi">
                  BM.07/QT.05.10 (BB Tiêu hao lò thổi BOF)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub2-7-6",
            maBM: BM_CONFIG.HRC1.HRC1_BB_TieuHao_LF,
            label: (
              <Tooltip title="BM.14/QT.05.10 (BB Tiêu hao tinh luyện LF)">
                <NavLink to="/hrc1_tieuhaotinhluyenlf">
                  BM.14/QT.05.10 (BB Tiêu hao tinh luyện LF)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub2-7-7",
            maBM: BM_CONFIG.HRC1.HRC1_STD_NXT,
            label: (
              <Tooltip title="STD Nhập xuất tồn HRC1">
                <NavLink to="/hrc1_std_nhapxuatton">
                  STD Nhập xuất tồn HRC1
                </NavLink>
              </Tooltip>
            ),
          },
        ],
      },
      {
        key: "sub2-8",
        label: "NM.LG",
        children: [
          {
            key: "sub2-8-1",
            maBM: BM_CONFIG.NMLG.NMLG_BM_NapLieuLoCao,
            label: (
              <Tooltip title="BM.05/QT.05.09 (Sổ theo dõi nạp liệu lò cao)">
                <NavLink to="/naplieulocao">
                  BM.05/QT.05.09 (Sổ theo dõi nạp liệu lò cao)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub2-8-2",
            maBM: BM_CONFIG.NMLG.NMLG_BM_TonSiloLoCao,
            label: (
              <Tooltip title="BM.07/QT.05.09 (Sổ theo dõi tồn silo lò cao)">
                <NavLink to="/tonsilolocao">
                  BM.07/QT.05.09 (Sổ theo dõi tồn silo lò cao)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub2-8-3",
            maBM: BM_CONFIG.NMLG.NMLG_NK_VHPTLC,
            label: (
              <Tooltip title="BM.10/QT.05.09 (Nhật ký vận hành phun than lò cao)">
                <NavLink to="/nkvhthanphunlocao">
                  BM.10/QT.05.09 (Nhật ký vận hành phun than lò cao)
                </NavLink>
              </Tooltip>
            ),
          },
        ]
      }
    ],
  },
  {
    key: "sub3",
    label: "Việc đến tôi",
    vung: 2,
    icon: <DeliveredProcedureOutlined />,
    children: [
      // { key: "3", label: <NavLink to="/dashboard">Tạo yêu cầu</NavLink> },
      // { key: "4", label: "Option 4" },
      // {
      //   key: "sub3-2",
      //   label: "NM.NL",
      //   children: [
      //     {
      //       key: "sub3-2-1",
      //       label: <NavLink to="/dashboard">BM.06/QT.05.10</NavLink>,
      //     },
      //     // { key: "6", label: "Option 6" },
      //   ],
      // },
      // {
      //   key: "sub3-3",
      //   label: "NM.HRC2",
      //   children: [
      //     {
      //       key: "sub3-3-1",
      //       label: <NavLink to="/dashboard">BM.06/QT.05.10</NavLink>,
      //     },
      //     // { key: "6", label: "Option 6" },
      //   ],
      // },
      {
        key: "sub3-4",
        label: "NM.CTD",
        children: [
          {
            key: "3-4-1",
            maBM: BM_CONFIG.CTD.CTD_STD_Sanxuat,
            label: (
              <Tooltip title="BM.09/QT.05.13 (Sổ theo dõi sản xuất hàng ngày)">
                <NavLink to="/viecdentoi/sotheodoisanxuat">
                  BM.09/QT.05.13 Sổ theo dõi sản xuất hàng ngày
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "3-4-2",
            maBM: BM_CONFIG.CTD.CTD_BB_GiaoNhanPhoi,
            label: (
              <Tooltip title="BM.05/QT.05.13 (Biên bản giao nhận phôi)">
                <NavLink to="/viecdentoi/bienbangiaoNhanphoi">
                  BM.05/QT.05.13 (Biên bản giao nhận phôi)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "3-4-3",
            maBM: BM_CONFIG.CTD.CTD_BB_PhoiNapnguoi,
            label: (
              <Tooltip title="BM.02/QT.05.13 (Biên bản giao nhận phôi nạp nguội)">
                <NavLink to="/viecdentoi/bienbanphoinapnguoi">
                  BM.02/QT.05.13 (Biên bản giao nhận phôi nạp nguội)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "3-4-4",
            maBM: BM_CONFIG.CTD.CTD_KPH_Sanxuat,
            label: (
              <Tooltip title="BM.01C/QT.11 (Phiếu xử lý sản phẩm không phù hợp)">
                <NavLink to="/viecdentoi/phieuxulykph">
                  BM.01C/QT.11 Phiếu xử lý sản phẩm không phù hợp
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub3-4-5",
            maBM: BM_CONFIG.CTD.CTD_BB_SanLuong_KCS,
            label: (
              <Tooltip title="BM.08/QT.05.13 (Biên bản xác nhận sản lượng)">
                <NavLink to="/viecdentoi/sanluongkcs">
                  BM.08/QT.05.13 Biên bản xác nhận sản lượng
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub3-4-6",
            maBM: BM_CONFIG.CTD.CTD_BB_Phoinong,
            label: (
              <Tooltip title="BM.06/QT.05.10 (Biên bản giao nhận phôi nóng)">
                <NavLink to="/viecdentoi/bienbanphoinong">
                  BM.06/QT.05.10 Biên bản giao nhận phôi nóng (Nhận phôi)
                </NavLink>
              </Tooltip>
            ),
          },
        ],
      },
      {
        key: "sub3-nl",
        label: "NM.NL",
        children: [
          {
            key: "sub3-nl-1",
            maBM: BM_CONFIG.NL.NL_BB_TheoDoiBenPhe,
            label: (
              <Tooltip title="BM.18/HD.25.08 (Bảng theo dõi ben phế)">
                <NavLink to="/viecdentoi/bangtheodoibenphe">
                  BM.18/HD.25.08 Bảng theo dõi ben phế
                </NavLink>
              </Tooltip>
            ),
          },
        ],
      },
      {
        key: "sub3-5",
        label: "NM.HRC2",
        children: [
          {
            key: "sub4-5-0",
            maBM: BM_CONFIG.HRC2.HRC2_STD_NXT,
            label: (
              <Tooltip title="STD - Nhập xuất tồn">
                <NavLink to="/std_nhapxuatton">STD - Nhập xuất tồn</NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub4-5-1",
            maBM: BM_CONFIG.HRC2.HRC2_BB_NauLuyen_BOF,
            label: (
              <Tooltip title="BM.08/QT.05.15 (Biên bản tiêu hao nấu luyện lò thổi)">
                <NavLink to="/viecdentoi/tieuhaonauluyen_bof">
                  BM.08/QT.05.15 (Biên bản tiêu hao nấu luyện lò thổi)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub4-5-2",
            maBM: BM_CONFIG.HRC2.HRC2_BB_NauLuyen_LF,
            label: (
              <Tooltip title="BM.14/QT.05.15 (Bảng tiêu hao nấu luyện lò tinh luyện LF)">
                <NavLink to="/viecdentoi/tieuhaonauluyen_lf">
                  BM.14/QT.05.15 (Bảng tiêu hao nấu luyện lò tinh luyện LF)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub4-5-3",
            maBM: BM_CONFIG.HRC2.HRC2_BB_NauLuyen_RH,
            label: (
              <Tooltip title="BM.16/QT.05.15 (Bảng tiêu hao nấu luyện lò tinh luyện RH)">
                <NavLink to="/viecdentoi/tieuhaonauluyen_rh">
                  BM.16/QT.05.15 (Bảng tiêu hao nấu luyện lò tinh luyện RH)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub4-5-4",
            maBM: BM_CONFIG.HRC2.HRC2_BBSL_PhoiTam,
            label: (
              <Tooltip title="BM.36/QT.05.15 (Biên bản giao nhận phôi tấm)">
                <NavLink to="/viecdentoi/bbgnphoitam">
                  BM.36/QT.05.15 (Biên bản giao nhận phôi tấm)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub4-5-5",
            maBM: BM_CONFIG.HRC2.HRC2_BBGN_ThepLong,
            label: (
              <Tooltip title="BM.16/QT.05.10 (Bảng giao nhận thép lỏng)">
                <NavLink to="/viecdentoi/giaonhantheplong">
                  BM.16/QT.05.10 (Bảng giao nhận thép lỏng)
                </NavLink>
              </Tooltip>
            ),
          },
        ],
      },
      {
        key: "sub3-8",
        label: "NM.LG",
        children: [
          {
            key: "sub3-8-1",
            maBM: BM_CONFIG.NMLG.NMLG_BM_NapLieuLoCao,
            label: (
              <Tooltip title="BM.05/QT.05.09 (Sổ theo dõi nạp liệu lò cao)">
                <NavLink to="/viecdentoi/naplieulocao">
                  BM.05/QT.05.09 (Sổ theo dõi nạp liệu lò cao)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub3-8-2",
            maBM: BM_CONFIG.NMLG.NMLG_BM_TonSiloLoCao,
            label: (
              <Tooltip title="BM.07/QT.05.09 (Sổ theo dõi tồn silo lò cao)">
                <NavLink to="/viecdentoi/tonsilolocao">
                  BM.07/QT.05.09 (Sổ theo dõi tồn silo lò cao)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub3-8-3",
            maBM: BM_CONFIG.NMLG.NMLG_NK_VHPTLC,
            label: (
              <Tooltip title="BM.10/QT.05.09 (Nhật ký vận hành phun than lò cao)">
                <NavLink to="/viecdentoi/nkvhthanphunlocao">
                  BM.10/QT.05.09 (Nhật ký vận hành phun than lò cao)
                </NavLink>
              </Tooltip>
            ),
          },
        ],
      },
      {
        key: "sub3-6",
        label: "NM.HRC1",
        children: [
          {
            key: "sub3-6-1",
            maBM: BM_CONFIG.HRC1.HRC1_BB_Sanluongphoi,
            label: (
              <Tooltip title="BM.11/QT.05.11 (Biên bản xác nhận sản lượng phôi thép)">
                <NavLink to="/viecdentoi/bienbansanluongphoi">
                  BM.11/QT.05.11 (Biên bản xác nhận sản lượng phôi thép)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub3-6-2",
            maBM: BM_CONFIG.HRC1.HRC1_BB_GiaoNhanPhoiNhapKho,
            label: (
              <Tooltip title="BM.12/QT.05.11 (Biên bản giao nhận phôi nhập kho)">
                <NavLink to="/viecdentoi/bienbanphoinapkho">
                  BM.12/QT.05.11 (Biên bản giao nhận phôi nhập kho)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub3-6-3",
            maBM: BM_CONFIG.HRC1.HRC1_BBGN_ThepLong,
            label: (
              <Tooltip title="BM.16/QT.05.10 (Bảng giao nhận thép lỏng)">
                <NavLink to="/viecdentoi/giaonhantheplong_hrc1">
                  BM.16/QT.05.10 (Bảng giao nhận thép lỏng)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub3-6-4",
            maBM: BM_CONFIG.HRC1.HRC1_BBSL_PhoiTam,
            label: (
              <Tooltip title="BM.30/QT.05.12 (BB giao nhận phôi tấm HRC1)">
                <NavLink to="/viecdentoi/bbgnphoitam_hrc1">
                  BM.30/QT.05.12 (BB giao nhận phôi tấm HRC1)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub3-6-5",
            maBM: BM_CONFIG.HRC1.HRC1_BB_TieuHao_BOF,
            label: (
              <Tooltip title="BM.07/QT.05.10 (BB Tiêu hao lò thổi BOF)">
                <NavLink to="/viecdentoi/hrc1_tieuhaolothoi">
                  BM.07/QT.05.10 (BB Tiêu hao lò thổi BOF)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub3-6-6",
            maBM: BM_CONFIG.HRC1.HRC1_BB_TieuHao_LF,
            label: (
              <Tooltip title="BM.14/QT.05.10 (BB Tiêu hao tinh luyện LF)">
                <NavLink to="/viecdentoi/hrc1_tieuhaotinhluyenlf">
                  BM.14/QT.05.10 (BB Tiêu hao tinh luyện LF)
                </NavLink>
              </Tooltip>
            ),
          },
        ],
      },
    ],
  },
  {
    key: "sub4",
    label: "Xem",
    vung: 3,
    icon: <EyeOutlined />,
    children: [
      {
        key: "sub4-nl",
        label: "NM.NL",
        children: [
          {
            key: "sub4-nl-1",
            maBM: BM_CONFIG.NL.NL_BB_TheoDoiBenPhe,
            label: (
              <Tooltip title="BM.18/HD.25.08 (Bảng theo dõi ben phế)">
                <NavLink to="/xemphieu/bangtheodoibenphe">
                  BM.18/HD.25.08 Bảng theo dõi ben phế
                </NavLink>
              </Tooltip>
            ),
          },
        ],
      },
      {
        key: "sub4-ctd",
        label: "NM.CTD",
        children: [
          {
            key: "sub4-ctd-1",
            maBM: BM_CONFIG.CTD.CTD_STD_Sanxuat,
            label: (
              <Tooltip title="BM.09/QT.05.13 (Sổ theo dõi sản xuất hàng ngày)">
                <NavLink to="/xemphieu/sotheodoisanxuat">
                  BM.09/QT.05.13 Sổ theo dõi sản xuất hàng ngày
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub4-ctd-2",
            maBM: BM_CONFIG.CTD.CTD_BB_GiaoNhanPhoi,
            label: (
              <Tooltip title="BM.05/QT.05.13 (Biên bản giao nhận phôi)">
                <NavLink to="/xemphieu/bienbangiaoNhanphoi">
                  BM.05/QT.05.13 (Biên bản giao nhận phôi)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub4-ctd-3",
            maBM: BM_CONFIG.CTD.CTD_BB_PhoiNapnguoi,
            label: (
              <Tooltip title="BM.02/QT.05.13 (Biên bản giao nhận phôi nạp nguội)">
                <NavLink to="/xemphieu/bienbanphoinapnguoi">
                  BM.02/QT.05.13 (Biên bản giao nhận phôi nạp nguội)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub4-ctd-4",
            maBM: BM_CONFIG.CTD.CTD_KPH_Sanxuat,
            label: (
              <Tooltip title="BM.01C/QT.11 (Phiếu xử lý sản phẩm không phù hợp)">
                <NavLink to="/xemphieu/phieuxulykph">
                  BM.01C/QT.11 Phiếu xử lý sản phẩm không phù hợp
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub4-ctd-5",
            maBM: BM_CONFIG.CTD.CTD_BB_SanLuong_KCS,
            label: (
              <Tooltip title="BM.08/QT.05.13 (Biên bản xác nhận sản lượng)">
                <NavLink to="/xemphieu/sanluongkcs">
                  BM.08/QT.05.13 Biên bản xác nhận sản lượng
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub4-ctd-6",
            maBM: BM_CONFIG.CTD.CTD_BB_Phoinong,
            label: (
              <Tooltip title="BM.06/QT.05.10 (Biên bản giao nhận phôi nóng)">
                <NavLink to="/xemphieu/bienbanphoinong">
                  BM.06/QT.05.10 Biên bản giao nhận phôi nóng (Nhận phôi)
                </NavLink>
              </Tooltip>
            ),
          },
        ],
      },
      {
        key: "sub4-1",
        label: "NM.HRC1",
        children: [
          {
            key: "sub4-1-1",
            maBM: BM_CONFIG.HRC1.HRC1_BBGN_ThepLong,
            label: (
              <Tooltip title="BM.16/QT.05.10 (Biên bản giao nhận thép lỏng)">
                <NavLink to="/xemphieu/giaonhantheplong_hrc1">
                  BM.16/QT.05.10 (Biên bản giao nhận thép lỏng)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub4-1-2",
            maBM: BM_CONFIG.HRC1.HRC1_BBSL_PhoiTam,
            label: (
              <Tooltip title="BM.30/QT.05.12 (BB giao nhận phôi tấm HRC1)">
                <NavLink to="/xemphieu/bbgnphoitam_hrc1">
                  BM.30/QT.05.12 (BB giao nhận phôi tấm HRC1)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub4-1-3",
            maBM: BM_CONFIG.HRC1.HRC1_BB_TieuHao_BOF,
            label: (
              <Tooltip title="BM.07/QT.05.10 (BB Tiêu hao lò thổi BOF)">
                <NavLink to="/xemphieu/hrc1_tieuhaolothoi">
                  BM.07/QT.05.10 (BB Tiêu hao lò thổi BOF)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub4-1-4",
            maBM: BM_CONFIG.HRC1.HRC1_BB_TieuHao_LF,
            label: (
              <Tooltip title="BM.14/QT.05.10 (BB Tiêu hao tinh luyện LF)">
                <NavLink to="/xemphieu/hrc1_tieuhaotinhluyenlf">
                  BM.14/QT.05.10 (BB Tiêu hao tinh luyện LF)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub4-1-5",
            maBM: BM_CONFIG.HRC1.THONGKE_HRC1,
            strictMaBM: true,
            label: (
              <Tooltip title="Thống kê Dữ liệu HRC1">
                <NavLink to="/thongkehrc1">Thống kê dữ liệu HRC1</NavLink>
              </Tooltip>
            ),
          },
        ],
      },
      {
        key: "sub4-2",
        label: "NM.HRC2",
        children: [
          {
            key: "sub4-2-0",
            maBM: BM_CONFIG.HRC2.HRC2_STD_NXT,
            label: (
              <Tooltip title="STD - Nhập xuất tồn">
                <NavLink to="/xemphieu/std_nhapxuatton">
                  STD - Nhập xuất tồn
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub4-22-1",
            maBM: BM_CONFIG.HRC2.HRC2_BB_NauLuyen_BOF,
            label: (
              <Tooltip title="BM.08/QT.05.15 (Biên bản tiêu hao nấu luyện lò thổi)">
                <NavLink to="/xemphieu/tieuhaonauluyen_bof">
                  BM.08/QT.05.15 (Biên bản tiêu hao nấu luyện lò thổi)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub4-22-2",
            maBM: BM_CONFIG.HRC2.HRC2_BB_NauLuyen_LF,
            label: (
              <Tooltip title="BM.14/QT.05.15 (Bảng tiêu hao nấu luyện lò tinh luyện LF)">
                <NavLink to="/xemphieu/tieuhaonauluyen_lf">
                  BM.14/QT.05.15 (Bảng tiêu hao nấu luyện lò tinh luyện LF)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub4-22-3",
            maBM: BM_CONFIG.HRC2.HRC2_BB_NauLuyen_RH,
            label: (
              <Tooltip title="BM.16/QT.05.15 (Bảng tiêu hao nấu luyện lò tinh luyện RH)">
                <NavLink to="/xemphieu/tieuhaonauluyen_rh">
                  BM.16/QT.05.15 (Bảng tiêu hao nấu luyện lò tinh luyện RH)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub4-22-4",
            maBM: BM_CONFIG.HRC2.HRC2_BBSL_PhoiTam,
            label: (
              <Tooltip title="BM.36/QT.05.15 (Biên bản giao nhận phôi tấm)">
                <NavLink to="/xemphieu/bbgnphoitam">
                  BM.36/QT.05.15 (Biên bản giao nhận phôi tấm)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub4-2-5",
            maBM: BM_CONFIG.HRC2.HRC2_BBGN_ThepLong,
            label: (
              <Tooltip title="BM.16/QT.05.10 (Bảng giao nhận thép lỏng)">
                <NavLink to="/xemphieu/giaonhantheplong">
                  BM.16/QT.05.10 (Bảng giao nhận thép lỏng)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub4-2-6",
            maBM: BM_CONFIG.HRC2.THONGKE_HRC2,
            strictMaBM: true,
            label: (
              <Tooltip title="Thống kê Dữ liệu HRC2">
                <NavLink to="/thongkehrc2">Thống kê dữ liệu HRC2</NavLink>
              </Tooltip>
            ),
          },
        ],
      },
      {
        key: "sub4-7",
        label: "NM.LG",
        children: [
          {
            key: "sub4-7-1",
            maBM: BM_CONFIG.NMLG.NMLG_BM_NapLieuLoCao,
            label: (
              <Tooltip title="BM.05/QT.05.09 (Sổ theo dõi nạp liệu lò cao)">
                <NavLink to="/xemphieu/naplieulocao">
                  BM.05/QT.05.09 (Sổ theo dõi nạp liệu lò cao)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub4-7-2",
            maBM: BM_CONFIG.NMLG.NMLG_BM_TonSiloLoCao,
            label: (
              <Tooltip title="BM.07/QT.05.09 (Sổ theo dõi tồn silo lò cao)">
                <NavLink to="/xemphieu/tonsilolocao">
                  BM.07/QT.05.09 (Sổ theo dõi tồn silo lò cao)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub4-7-3",
            maBM: BM_CONFIG.NMLG.NMLG_NK_VHPTLC,
            label: (
              <Tooltip title="BM.10/QT.05.09 (Nhật ký vận hành phun than lò cao)">
                <NavLink to="/xemphieu/nkvhthanphunlocao">
                  BM.10/QT.05.09 (Nhật ký vận hành phun than lò cao)
                </NavLink>
              </Tooltip>
            ),
          },
        ],
      },
    ],
  },
  {
    key: "sub5",
    label: "Xử lý phiếu",
    vung: 4,
    icon: <ProfileOutlined />,
    roles: ["PKH", "admin"], // chỉ P.KH mới xử lý phiếu
    children: [
      // { key: "3", label: <NavLink to="/dashboard">Tạo yêu cầu</NavLink> },
      // { key: "4", label: "Option 4" },

      {
        key: "sub5-1",
        label: "NM.CTD",
        children: [
          {
            key: "sub5-1-0",
            maBM: BM_CONFIG.CTD.CTD_BB_Phoinong,
            label: (
              <Tooltip title="BM.06/QT.05.10 (Biên bản giao nhận phôi nóng)">
                <NavLink to="/viecdentoi/bienbanphoinong">
                  BM.06/QT.05.10 Biên bản giao nhận phôi nóng (Nhận phôi)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "5-1-1",
            maBM: BM_CONFIG.CTD.CTD_STD_Sanxuat,
            label: (
              <Tooltip title="BM.09/QT.05.13 (Sổ theo dõi sản xuất hàng ngày)">
                <NavLink to="/viecdentoi/sotheodoisanxuat">
                  BM.09/QT.05.13 Sổ theo dõi sản xuất hàng ngày
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "5-1-2",
            maBM: BM_CONFIG.CTD.CTD_BB_GiaoNhanPhoi,
            label: (
              <Tooltip title="BM.05/QT.05.13 (Biên bản giao nhận phôi)">
                <NavLink to="/viecdentoi/bienbangiaoNhanphoi">
                  BM.05/QT.05.13 (Biên bản giao nhận phôi)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "5-1-3",
            maBM: BM_CONFIG.CTD.CTD_BB_PhoiNapnguoi,
            label: (
              <Tooltip title="BM.02/QT.05.13 (Biên bản giao nhận phôi nạp nguội)">
                <NavLink to="/viecdentoi/bienbanphoinapnguoi">
                  BM.02/QT.05.13 (Biên bản giao nhận phôi nạp nguội)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "5-1-4",
            maBM: BM_CONFIG.CTD.CTD_KPH_Sanxuat,
            label: (
              <Tooltip title="BM.01C/QT.11 (Phiếu xử lý sản phẩm không phù hợp)">
                <NavLink to="/viecdentoi/phieuxulykph">
                  BM.01C/QT.11 Phiếu xử lý sản phẩm không phù hợp
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "sub5-5",
            maBM: BM_CONFIG.CTD.CTD_BB_SanLuong_KCS,
            label: (
              <Tooltip title="BM.08/QT.05.13 (Biên bản xác nhận sản lượng)">
                <NavLink to="/sanluongkcs">
                  BM.08/QT.05.13 Biên bản xác nhận sản lượng
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "5-1-tk",
            label: (
              <Tooltip title="Thống kê Phiếu CTD">
                <NavLink to="/thongkephieuCTD">Thống kê Phiếu CTD</NavLink>
              </Tooltip>
            ),
          },
        ],
      },
      {
        key: "sub5-2",
        label: "NM.HRC1",
        children: [
          {
            key: "5-2-1",
            maBM: BM_CONFIG.HRC1.HRC1_BB_Sanluongphoi,
            label: (
              <Tooltip title="BM.11/QT.05.11 (Biên bản xác nhận sản lượng phôi thép)">
                <NavLink to="/viecdentoi/bienbansanluongphoi">
                  BM.11/QT.05.11 (Biên bản xác nhận sản lượng phôi thép)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "5-2-2",
            maBM: BM_CONFIG.HRC1.HRC1_BB_GiaoNhanPhoiNhapKho,
            label: (
              <Tooltip title="BM.12/QT.05.11 (Biên bản giao nhận phôi nhập kho)">
                <NavLink to="/viecdentoi/bienbanphoinapkho">
                  BM.12/QT.05.11 (Biên bản giao nhận phôi nhập kho)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "5-2-3",
            label: (
              <Tooltip title="Thống kê Phiếu HRC1">
                <NavLink to="/thongkephieuhrc1">Thống kê Phiếu HRC1</NavLink>
              </Tooltip>
            ),
          },
          {
            key: "5-2-44",
            label: (
              <Tooltip title="Thống kê Dữ liệu HRC1">
                <NavLink to="/thongkehrc1">Thống kê dữ liệu HRC1</NavLink>
              </Tooltip>
            ),
          },
        ],
      },
      {
        key: "sub5-3",
        label: "NM.HRC2",
        children: [
          {
            key: "5-3-1",
            label: (
              <Tooltip title="Thống kê Phiếu HRC2">
                <NavLink to="/thongkephieuhrc2">Thống kê Phiếu HRC2</NavLink>
              </Tooltip>
            ),
          },
          {
            key: "5-3-2",
            label: (
              <Tooltip title="Thống kê Dữ liệu HRC2">
                <NavLink to="/thongkehrc2">Thống kê dữ liệu HRC2</NavLink>
              </Tooltip>
            ),
          },
        ],
      },
      {
        key: "sub5-lg",
        label: "NM.LG",
        children: [
          {
            key: "5-lg-1",
            maBM: BM_CONFIG.NMLG.NMLG_BM_NapLieuLoCao,
            label: (
              <Tooltip title="BM.05/QT.05.09 (Sổ theo dõi nạp liệu lò cao)">
                <NavLink to="/naplieulocao">
                  BM.05/QT.05.09 (Sổ theo dõi nạp liệu lò cao)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "5-lg-2",
            maBM: BM_CONFIG.NMLG.NMLG_BM_TonSiloLoCao,
            label: (
              <Tooltip title="BM.07/QT.05.09 (Sổ theo dõi tồn silo lò cao)">
                <NavLink to="/tonsilolocao">
                  BM.07/QT.05.09 (Sổ theo dõi tồn silo lò cao)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "5-lg-3",
            maBM: BM_CONFIG.NMLG.NMLG_NK_VHPTLC,
            label: (
              <Tooltip title="BM.10/QT.05.09 (Nhật ký vận hành phun than lò cao)">
                <NavLink to="/nkvhthanphunlocao">
                  BM.10/QT.05.09 (Nhật ký vận hành phun than lò cao)
                </NavLink>
              </Tooltip>
            ),
          },
          {
            key: "5-lg-tk",
            label: (
              <Tooltip title="Thống kê Phiếu LG">
                <NavLink to="/thongkephieulg">Thống kê Phiếu LG</NavLink>
              </Tooltip>
            ),
          },
          {
            key: "5-lg-phanbo",
            maBM: BM_CONFIG.NMLG.NMLG_BM_PhanBoDuLieu,
            label: (
              <Tooltip title="Phân bổ dữ liệu (QHLC / CVH / Than cốc <10mm)">
                <NavLink to="/phanbodulieu">Phân bổ dữ liệu</NavLink>
              </Tooltip>
            ),
          },
        ],
      },
    ],
  },
  // {
  //   key: "4",
  //   icon: <VideoCameraOutlined />,
  //   label: <NavLink to="/reports">Báo cáo</NavLink>,
  //   roles: ["admin"], // chỉ admin mới thấy
  // },
  {
    key: "sub-admin",
    label: "Quản trị",
    icon: <SettingOutlined />,
    roles: ["admin"],
    children: [
      {
        key: "admin-1",
        icon: <SafetyCertificateOutlined />,
        label: (
          <Tooltip title="Phân quyền xử lý biểu mẫu theo khu vực">
            <NavLink to="/phanquyenbieumau">Phân quyền biểu mẫu</NavLink>
          </Tooltip>
        ),
      },
      {
        key: "admin-2",
        icon: <SettingOutlined />,
        label: (
          <Tooltip title="Quản lý mác thép">
            <NavLink to="/mac-thep">Mác thép</NavLink>
          </Tooltip>
        ),
      },
      {
        key: "admin-3",
        icon: <SettingOutlined />,
        label: (
          <Tooltip title="Quản lý máy đúc">
            <NavLink to="/may-duc">Máy đúc</NavLink>
          </Tooltip>
        ),
      },
      {
        key: "admin-4",
        icon: <SettingOutlined />,
        label: (
          <Tooltip title="Quản lý mã vật tư">
            <NavLink to="/ma-vat-tu-hrc1">Mã vật tư</NavLink>
          </Tooltip>
        ),
      },
      // {
      //   key: "admin-5",
      //   icon: <UserOutlined />,
      //   label: (
      //     <Tooltip title="Quản lý tài khoản">
      //       <NavLink to="/quan-ly-tai-khoan">Quản lý tài khoản</NavLink>
      //     </Tooltip>
      //   ),
      // },
    ],
  },
  // {
  //   key: "5",
  //   icon: <UploadOutlined />,
  //   label: <NavLink to="/settings">Cài đặt</NavLink>,
  //   roles: ["admin"], // chỉ admin mới thấy
  // },
  // {
  //   key: "6",
  //   icon: <UserOutlined />,
  //   label: <NavLink to="/users">Quản lý tài khoản</NavLink>,
  //   roles: ["admin"],
  // },
];
