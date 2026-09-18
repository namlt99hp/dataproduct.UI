// routes.tsx
import MainLayout from "../layouts/MainLayout";
import {
  Home,
  Dashboard,
  Reports,
  Settings,
  DemoForm,
  TaoYeuCau,
  BienBanPhoiNong,
  BienBanPhoiNguoi,
  ChatboxPage,
} from "../pages";
import LoginPage from "../pages/Login/LoginPage";
import NotFound from "../pages/NotFound/NotFound";
import RequireAuth from "./RequireAuth";
import { Navigate } from "react-router-dom";
import RequireRole from "./RequireRole";
import TaoPhieuPhoiNong from "../pages/NMCTD/BienBanPhoiNong/TaoPhieuPhoiNong";
import TaoPhieuPhoiNguoi from "../pages/NMCTD/BienBanPhoiNguoi/TaoPhieuPhoiNguoi";
import NhatKyQuangTH from "../pages/NM.NL/NhatKyQuangTH/NhatKyQuangTH";
import TaoPhieuNhatKyQuang from "../pages/NM.NL/NhatKyQuangTH/TaoNhatKyQuangTH";
import BangTheoDoiBenPhe from "../pages/NM.NL/BangTheoDoiBenPhe/BangTheoDoiBenPhe";
import TaoBangTheoDoiBenPhe from "../pages/NM.NL/BangTheoDoiBenPhe/TaoBangTheoDoiBenPhe";
import ChiTietBangTheoDoiBenPhe from "../pages/NM.NL/BangTheoDoiBenPhe/ChiTietBangTheoDoiBenPhe";
import TieuHaoLoThoi from "../pages/NM.HRC1/TieuHaoLoThoi/TieuHaoLoThoi";
import TaoTieuHaoLoThoi from "../pages/NM.HRC1/TieuHaoLoThoi/TaoTieuHaoLoThoi";
import ChiTietTieuHaoLoThoi_BOF from "../pages/NM.HRC1/TieuHaoLoThoi/ChiTietBOF";
import TieuHaoTinhLuyenLF from "../pages/NM.HRC1/TieuHaoTinhLuyenLF/TieuHaoTinhLuyenLF";
import TaoTieuHaoTinhLuyenLF from "../pages/NM.HRC1/TieuHaoTinhLuyenLF/TaoTieuHaoTinhLuyenLF";
import ChiTietTieuHaoTinhLuyenLF from "../pages/NM.HRC1/TieuHaoTinhLuyenLF/ChiTietLF";
import ChiTietPhieuPhoiNong from "../pages/NMCTD/BienBanPhoiNong/ChiTietPhieuPhoiNong";
import SanLuongPhoi from "../pages/KhoDuLieu/NM.CTD/SanLuongPhoi";
import BKNguyenLieu from "../pages/KhoDuLieu/NM.NL/BKNguyenLieu";
import TieuHaoNauLuyen_LF from "../pages/NM.HRC2/Tieu Hao NauLuyen_LF/TieuHaoNauLuyen_LF";
import ChiTietTieuHaoNauLuyen_LF from "../pages/NM.HRC2/Tieu Hao NauLuyen_LF/ChiTietLF";
import TaoPhieuTieuHaoNauLuyen_LF from "../pages/NM.HRC2/Tieu Hao NauLuyen_LF/TaoPhieuLF";
import TieuHaoNauLuyen_RH from "../pages/NM.HRC2/Tieu Hao NauLuyen_RH/TieuHaoNauLuyen_RH";
import TaoPhieuTieuHaoNauLuyen_RH from "../pages/NM.HRC2/Tieu Hao NauLuyen_RH/TaoPhieuRH";
import ChiTietTieuHaoNauLuyen_RH from "../pages/NM.HRC2/Tieu Hao NauLuyen_RH/ChiTietRH";
import BienBanGiaoNhanPhoiTam from "../pages/NM.HRC2/BienBanGiaoNhanPhoiTam/BienBanGiaoNhanPhoiTam";
import TaoBienBanGiaoNhanPhoiTam from "../pages/NM.HRC2/BienBanGiaoNhanPhoiTam/TaoBienBanGiaoNhanPhoiTam";
import ChiTietBienBanGiaoNhanPhoiTam from "../pages/NM.HRC2/BienBanGiaoNhanPhoiTam/ChiTietBienBanGiaoNhanPhoiTam";
import DLNMHRC2LuyenThep from "../pages/KhoDuLieu/NM.HRC2/DLNMHRC2LuyenThep";
import DLNMHRC2ChiTiet from "../pages/KhoDuLieu/NM.HRC2/DLNMHRC2ChiTiet";
import HeaderMapping from "../pages/KhoDuLieu/NM.HRC2/HeaderMapping";
import TieuHaoNauLuyen_BOF from "../pages/NM.HRC2/Tieu Hao NauLuyen_BOF/TieuHaoNauLuyen_BOF";
import TaoPhieuTieuHaoNauLuyen_BOF from "../pages/NM.HRC2/Tieu Hao NauLuyen_BOF/TaoPhieuBOF";
import ChiTietTieuHaoNauLuyen_BOF from "../pages/NM.HRC2/Tieu Hao NauLuyen_BOF/ChiTietBOF";
import STD_NhapXuatTon from "../pages/NM.HRC2/STD_NhapXuatTon/STD_NhapXuatTon";
import Tao_STD from "../pages/NM.HRC2/STD_NhapXuatTon/Tao_STD";
import ChiTiet_STD from "../pages/NM.HRC2/STD_NhapXuatTon/ChiTiet_STD";
import STD_NhapXuatTon_HRC1 from "../pages/NM.HRC1/STD_NhapXuatTon/STD_NhapXuatTon";
import Tao_STD_HRC1 from "../pages/NM.HRC1/STD_NhapXuatTon/Tao_STD";
import ChiTiet_STD_HRC1 from "../pages/NM.HRC1/STD_NhapXuatTon/ChiTiet_STD";
import ChiTietPhieuPhoiNguoi from "../pages/NMCTD/BienBanPhoiNguoi/ChiTietPhieuPhoiNguoi";
import PhanQuyenBieuMau from "../pages/Settings/PhanQuyenBieuMau";
import ChiTietPhoiNhapKho from "../pages/NMCTD/BienBanPhoiNhapKho/ChiTietPhoiNhapKho";
import TaoPhieuPhoiNhapKho from "../pages/NMCTD/BienBanPhoiNhapKho/TaoPhieuPhoiNhapKho";
import BienBanPhoiNhapKho from "../pages/NMCTD/BienBanPhoiNhapKho/BienBanPhoiNhapKho";
import ChiTietSanLuongPhoi from "../pages/NMCTD/BienBanSanLuongPhoi/ChiTietSanLuongPhoi";
import TaoPhieuSanLuongPhoi from "../pages/NMCTD/BienBanSanLuongPhoi/TaoPhieuSanLuongPhoi";
import BienBanSanLuongPhoi from "../pages/NMCTD/BienBanSanLuongPhoi/BienBanSanLuongPhoi";
import BienBanPhoiNapNguoi from "../pages/NMCTD/BienBanPhoiNapNguoi/BienBanPhoiNapNguoi";
import TaoPhieuPhoiNapNguoi from "../pages/NMCTD/BienBanPhoiNapNguoi/TaoPhieuPhoiNapNguoi";
import ChiTietPhoiNapNguoi from "../pages/NMCTD/BienBanPhoiNapNguoi/ChiTietPhoiNapNguoi";
import BienBanGiaoNhanPhoi from "../pages/NMCTD/BienBanGiaoNhanPhoi/BienBanGiaoNhanPhoi";
import TaoPhieuGiaoNhanPhoi from "../pages/NMCTD/BienBanGiaoNhanPhoi/TaoPhieuGiaoNhanPhoi";
import ChiTietGiaoNhanPhoi from "../pages/NMCTD/BienBanGiaoNhanPhoi/ChiTietGiaoNhanPhoi";
import SoTheoDoiSanXuat from "../pages/NMCTD/SoTheoDoiSanXuat/SoTheoDoiSanXuat";
import TaoSoTheoDoiSanXuat from "../pages/NMCTD/SoTheoDoiSanXuat/TaoSoTheoDoiSanXuat";
import ChiTietSoTheoDoiSanXuat from "../pages/NMCTD/SoTheoDoiSanXuat/ChiTietSoTheoDoiSanXuat";
import PhieuXuLyKPH from "../pages/NMCTD/PhieuXuLyKPH/PhieuXuLyKPH";
import TaoPhieuXuLyKPH from "../pages/NMCTD/PhieuXuLyKPH/TaoPhieuXuLyKPH";
import ChiTietPhieuXuLyKPH from "../pages/NMCTD/PhieuXuLyKPH/ChiTietPhieuXuLyKPH";
import BienBanSanLuongKCS from "../pages/NMCTD/BienBanSanLuongKCS/BienBanSanLuongKCS";
import TaoPhieuBienBanSanLuongKCS from "../pages/NMCTD/BienBanSanLuongKCS/TaoPhieuBienBanSanLuongKCS";
import ChiTietBienBanSanLuongKCS from "../pages/NMCTD/BienBanSanLuongKCS/ChiTietBienBanSanLuongKCS";
import QuanLySilo from "../pages/KhoDuLieu/NM.HRC2/Silo";
import ThongKeHRC2 from "../pages/NM.HRC2/ThongKe/ThongKeHRC2";
import NapLieuLoCao from "../pages/NMLG/NapLieuLoCao/NapLieuLoCao";
import TaoPhieuNapLieuLoCao from "../pages/NMLG/NapLieuLoCao/TaoPhieuNapLieuLoCao";
import ChiTietNapLieuLoCao from "../pages/NMLG/NapLieuLoCao/ChiTietNapLieuLoCao";
import TonSiloLoCao from "../pages/NMLG/TonSiloLoCao/TonSiloLoCao";
import TaoPhieuTonSiLo from "../pages/NMLG/TonSiloLoCao/TaoPhieuTonSiLo";
import ChiTietTonSiLo from "../pages/NMLG/TonSiloLoCao/ChiTietTonSiLo";
import QuanLySiLoNVL from "../pages/NMLG/QuanLySiLoNVL/QuanLySiLoNVL";
import QuanLyTonSiLoNVL from "../pages/NMLG/QuanLyTonSiLoNVL/QuanLyTonSiLoNVL";
import NKVHThanPhunLoCao from "../pages/NMLG/NKVHThanPhunLoCao/NKVHThanPhunLoCao";
import TaoPhieuNKVHThanPhunLoCao from "../pages/NMLG/NKVHThanPhunLoCao/TaoPhieuNKVHThanPhunLoCao";
import ChiTietNKVHThanPhunLoCao from "../pages/NMLG/NKVHThanPhunLoCao/ChiTietNKVHThanPhunLoCao";
import GiaoNhanThepLong from "../pages/NM.HRC2/GiaoNhanThepLong/GiaoNhanThepLong";
import TaoPhieuGN from "../pages/NM.HRC2/GiaoNhanThepLong/TaoPhieuGN";
import ChiTietGN from "../pages/NM.HRC2/GiaoNhanThepLong/ChiTietGN";
import GiaoNhanThepLong_HRC1 from "../pages/NM.HRC1/GiaoNhanThepLong/GiaoNhanThepLong";
import TaoPhieuGN_HRC1 from "../pages/NM.HRC1/GiaoNhanThepLong/TaoPhieuGN";
import ChiTietGN_HRC1 from "../pages/NM.HRC1/GiaoNhanThepLong/ChiTietGN";
import HRC1_BienBanGiaoNhanPhoiTam from "../pages/NM.HRC1/HRC1_BienBanGiaoNhanPhoiTam/HRC1_BienBanGiaoNhanPhoiTam";
import ChiTietBienBanGiaoNhanPhoiTam_HRC1 from "../pages/NM.HRC1/HRC1_BienBanGiaoNhanPhoiTam/ChiTietBienBanGiaoNhanPhoiTam_HRC1";
import ThongKePhieuHRC2 from "../pages/NM.HRC2/ThongKe/ThongKePhieuHRC2";
import ThongKeHRC1 from "../pages/NM.HRC1/ThongKe/ThongKeHRC1";
import ThongKePhieuHRC1 from "../pages/NM.HRC1/ThongKe/ThongKePhieuHRC1";
import QuanLyMayDuc from "../pages/Settings/MayDuc";
import QuanLyMacThep from "../pages/Settings/MacThep";
import QuanLyMaVatTuHRC1 from "../pages/Settings/QuanLyMaVatTu";
import QuanLyTaiKhoan from "../pages/Settings/QuanLyTaiKhoan";
import ThongKePhieuCTD from "../pages/NMCTD/ThongKe/ThongKePhieuCTD";
import ThongKePhieuLG from "../pages/NMLG/ThongKe/ThongKePhieuLG";
import PhanBoDuLieuPage from "../pages/NMLG/PhanBoDuLieu/PhanBoDuLieuPage";
import PhuLieuHRC1 from "../pages/KhoDuLieu/NM.HRC1/PhuLieuHRC1";

export const routes = [
  {
    path: "/",
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: (
          <RequireAuth>
            <Home />
          </RequireAuth>
        ),
      },
      {
        path: "dashboard",
        element: (
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        ),
      },
      {
        path: "chatbox",
        element: (
          <RequireAuth>
            <ChatboxPage />
          </RequireAuth>
        ),
      },
      {
        path: "demo-form",
        element: (
          <RequireAuth>
            <DemoForm />
          </RequireAuth>
        ),
      },
      {
        path: "taoyeucau",
        element: (
          <RequireAuth>
            <TaoYeuCau />
          </RequireAuth>
        ),
      },
      {
        path: "yeu-cau/:id", // thêm param id
        element: (
          <RequireAuth>
            <TaoYeuCau />
          </RequireAuth>
        ),
      },
      {
        path: "reports",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <Reports />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "settings",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <Settings />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "phanquyenbieumau",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin"]}>
              <PhanQuyenBieuMau />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "sanluongphoi",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <SanLuongPhoi />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "nguyennhienlieu",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <BKNguyenLieu />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "bienbanphoinong",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <BienBanPhoiNong />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "viecdentoi/bienbanphoinong",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <BienBanPhoiNong type="viecdentoi" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "xemphieu/bienbanphoinong",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <BienBanPhoiNong type="viecdentoi" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "taophieuphoinong",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TaoPhieuPhoiNong />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "chitietphieuphoinong/:id",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <ChiTietPhieuPhoiNong />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "bienbanphoinguoi",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <BienBanPhoiNguoi />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "taophieuphoinguoi",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TaoPhieuPhoiNguoi />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "chitietphieuphoinguoi",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <ChiTietPhieuPhoiNguoi />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "nhatkyquangtrunghoa",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <NhatKyQuangTH />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "taophieunhatkyquang",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TaoPhieuNhatKyQuang />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "bangtheodoibenphe",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <BangTheoDoiBenPhe />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "taophieubangtheodoibenphe",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TaoBangTheoDoiBenPhe />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "chitietbangtheodoibenphe",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <ChiTietBangTheoDoiBenPhe />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "viecdentoi/bangtheodoibenphe",
        element: (
          <RequireAuth>
            <BangTheoDoiBenPhe type="viecdentoi" />
          </RequireAuth>
        ),
      },
      {
        path: "xemphieu/bangtheodoibenphe",
        element: (
          <RequireAuth>
            <BangTheoDoiBenPhe type="xemphieu" />
          </RequireAuth>
        ),
      },
      // {
      //   path: "bienbantheplong",
      //   element: (
      //     <RequireAuth>
      //       <RequireRole allowedRoles={["admin", "user"]}>
      //         <BienBanThepLong />
      //       </RequireRole>
      //     </RequireAuth>
      //   ),
      // },
      // {
      //   path: "taophieutheplong",
      //   element: (
      //     <RequireAuth>
      //       <RequireRole allowedRoles={["admin", "user"]}>
      //         <TaoPhieuThepLong />
      //       </RequireRole>
      //     </RequireAuth>
      //   ),
      // },
      {
        path: "dlnmhrc2luyenthep",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <DLNMHRC2LuyenThep />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "dlnmhrc2chitiet",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <DLNMHRC2ChiTiet />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "tieuhaonauluyen_bof",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TieuHaoNauLuyen_BOF />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "viecdentoi/tieuhaonauluyen_bof",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TieuHaoNauLuyen_BOF type="viecdentoi" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "xemphieu/tieuhaonauluyen_bof",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TieuHaoNauLuyen_BOF type="xemphieu" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "taophieutieuhaonauluyen_bof",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TaoPhieuTieuHaoNauLuyen_BOF />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "chitiettieuhaonauluyen_bof",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <ChiTietTieuHaoNauLuyen_BOF />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "tieuhaonauluyen_lf",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TieuHaoNauLuyen_LF />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "viecdentoi/tieuhaonauluyen_lf",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TieuHaoNauLuyen_LF type="viecdentoi" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "xemphieu/tieuhaonauluyen_lf",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TieuHaoNauLuyen_LF type="xemphieu" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "taophieutieuhaonauluyen_lf",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TaoPhieuTieuHaoNauLuyen_LF />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "chitiettieuhaonauluyen_lf",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <ChiTietTieuHaoNauLuyen_LF />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "tieuhaonauluyen_rh",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TieuHaoNauLuyen_RH />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "viecdentoi/tieuhaonauluyen_rh",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TieuHaoNauLuyen_RH type="viecdentoi" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "xemphieu/tieuhaonauluyen_rh",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TieuHaoNauLuyen_RH type="xemphieu" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "taophieutieuhaonauluyen_rh",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TaoPhieuTieuHaoNauLuyen_RH />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "chitiettieuhaonauluyen_rh",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <ChiTietTieuHaoNauLuyen_RH />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "hrc1_tieuhaolothoi",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TieuHaoLoThoi />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "hrc1_taotieuhaolothoi",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TaoTieuHaoLoThoi />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "hrc1_chitiettieuhaolothoi_bof",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <ChiTietTieuHaoLoThoi_BOF />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "viecdentoi/hrc1_tieuhaolothoi",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TieuHaoLoThoi type="viecdentoi" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "xemphieu/hrc1_tieuhaolothoi",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TieuHaoLoThoi type="xemphieu" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "hrc1_tieuhaotinhluyenlf",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TieuHaoTinhLuyenLF />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "hrc1_taotieuhaotinhluyenlf",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TaoTieuHaoTinhLuyenLF />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "hrc1_chitiettieuhaotinhluyenlf",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <ChiTietTieuHaoTinhLuyenLF />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "viecdentoi/hrc1_tieuhaotinhluyenlf",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TieuHaoTinhLuyenLF type="viecdentoi" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "xemphieu/hrc1_tieuhaotinhluyenlf",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TieuHaoTinhLuyenLF type="xemphieu" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "bbgnphoitam",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <BienBanGiaoNhanPhoiTam />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "viecdentoi/bbgnphoitam",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <BienBanGiaoNhanPhoiTam type="viecdentoi" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "xemphieu/bbgnphoitam",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <BienBanGiaoNhanPhoiTam type="xemphieu" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "form-bbgnphoitam",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TaoBienBanGiaoNhanPhoiTam />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "chitietbbgnphoitam",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <ChiTietBienBanGiaoNhanPhoiTam />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "xemphieu/chitietbbgnphoitam",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <ChiTietBienBanGiaoNhanPhoiTam readOnly />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "header-mapping",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <HeaderMapping />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "std_nhapxuatton",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <STD_NhapXuatTon />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "xemphieu/std_nhapxuatton",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <STD_NhapXuatTon type="xemphieu" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "tao_std",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <Tao_STD />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "chi_tiet_std",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <ChiTiet_STD />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "hrc1_std_nhapxuatton",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <STD_NhapXuatTon_HRC1 />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "xemphieu/hrc1_std_nhapxuatton",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <STD_NhapXuatTon_HRC1 type="xemphieu" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "tao_std_hrc1",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <Tao_STD_HRC1 />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "chi_tiet_std_hrc1",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <ChiTiet_STD_HRC1 />
            </RequireRole>
          </RequireAuth>
        ),
      },

      // sản lượng phôi
      {
        path: "bienbansanluongphoi",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <BienBanSanLuongPhoi />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "viecdentoi/bienbansanluongphoi",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <BienBanSanLuongPhoi type="viecdentoi" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "taophieubienbansanluongphoi",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TaoPhieuSanLuongPhoi />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "taophieubienbansanluongphoi/:id",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TaoPhieuSanLuongPhoi />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "chitietbienbansanluongphoi/:id",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <ChiTietSanLuongPhoi />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "bienbanphoinapnguoi",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <BienBanPhoiNapNguoi />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "viecdentoi/bienbanphoinapnguoi",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <BienBanPhoiNapNguoi type="viecdentoi" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "xemphieu/bienbanphoinapnguoi",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <BienBanPhoiNapNguoi type="xemphieu" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "taophieubienbanphoinapnguoi",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TaoPhieuPhoiNapNguoi />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "taophieubienbanphoinapnguoi/:id",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TaoPhieuPhoiNapNguoi />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "chitietbienbanphoinapnguoi/:id",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <ChiTietPhoiNapNguoi />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "bienbangiaoNhanphoi",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <BienBanGiaoNhanPhoi />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "viecdentoi/bienbangiaoNhanphoi",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <BienBanGiaoNhanPhoi type="viecdentoi" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "xemphieu/bienbangiaoNhanphoi",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <BienBanGiaoNhanPhoi type="xemphieu" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "taophieubienbangiaoNhanphoi",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TaoPhieuGiaoNhanPhoi />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "taophieubienbangiaoNhanphoi/:id",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TaoPhieuGiaoNhanPhoi />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "chitietbienbangiaoNhanphoi/:id",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <ChiTietGiaoNhanPhoi />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "sotheodoisanxuat",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <SoTheoDoiSanXuat />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "viecdentoi/sotheodoisanxuat",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <SoTheoDoiSanXuat type="viecdentoi" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "xemphieu/sotheodoisanxuat",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <SoTheoDoiSanXuat type="xemphieu" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "taophieusotheodoisanxuat",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TaoSoTheoDoiSanXuat />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "taophieusotheodoisanxuat/:id",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TaoSoTheoDoiSanXuat />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "chitietsotheodoisanxuat/:id",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <ChiTietSoTheoDoiSanXuat />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "phieuxulykph",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <PhieuXuLyKPH />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "viecdentoi/phieuxulykph",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <PhieuXuLyKPH type="viecdentoi" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "xemphieu/phieuxulykph",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <PhieuXuLyKPH type="xemphieu" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "taophieuxulykph",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TaoPhieuXuLyKPH />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "taophieuxulykph/:id",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TaoPhieuXuLyKPH />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "chitietphieuxulykph/:id",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <ChiTietPhieuXuLyKPH />
            </RequireRole>
          </RequireAuth>
        ),
      },
      // ========== ROUTES BIÊN BAN SẢN LƯỢNG KCS ==========
      {
        path: "sanluongkcs",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <BienBanSanLuongKCS />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "viecdentoi/sanluongkcs",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <BienBanSanLuongKCS type="viecdentoi" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "xemphieu/sanluongkcs",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <BienBanSanLuongKCS type="xemphieu" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "taophieusanluongkcs",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TaoPhieuBienBanSanLuongKCS />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "taophieusanluongkcs/:id",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TaoPhieuBienBanSanLuongKCS />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "chitietsanluongkcs/:id",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <ChiTietBienBanSanLuongKCS />
            </RequireRole>
          </RequireAuth>
        ),
      },
      // ========== HẾT ROUTES BIÊN BAN SẢN LƯỢNG KCS ==========
      {
        path: "bienbanphoinapkho",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <BienBanPhoiNhapKho />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "viecdentoi/bienbanphoinapkho",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <BienBanPhoiNhapKho type="viecdentoi" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "taophieubienbanphoinapkho",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TaoPhieuPhoiNhapKho />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "taophieubienbanphoinapkho/:id",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TaoPhieuPhoiNhapKho />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "chitietbienbanphoinapkho/:id",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <ChiTietPhoiNhapKho />
            </RequireRole>
          </RequireAuth>
        ),
      },

      {
        path: "silo",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <QuanLySilo />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "thongkehrc2",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <ThongKeHRC2 />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "naplieulocao",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <NapLieuLoCao />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "viecdentoi/naplieulocao",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <NapLieuLoCao type="viecdentoi" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "taophieubienbannaplieulocao",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TaoPhieuNapLieuLoCao />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "taophieubienbannaplieulocao/:id",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TaoPhieuNapLieuLoCao />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "chitietbienbannaplieulocao/:id",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <ChiTietNapLieuLoCao />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "tonsilolocao",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TonSiloLoCao />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "viecdentoi/tonsilolocao",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TonSiloLoCao type="viecdentoi" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "taophieutonsilolocao",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TaoPhieuTonSiLo />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "taophieutonsilolocao/:id",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TaoPhieuTonSiLo />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "chitiettonsilolocao/:id",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <ChiTietTonSiLo />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "nkvhthanphunlocao",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <NKVHThanPhunLoCao />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "viecdentoi/nkvhthanphunlocao",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <NKVHThanPhunLoCao type="viecdentoi" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "xemphieu/naplieulocao",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <NapLieuLoCao type="xemphieu" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "xemphieu/tonsilolocao",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TonSiloLoCao type="xemphieu" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "xemphieu/nkvhthanphunlocao",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <NKVHThanPhunLoCao type="xemphieu" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "taophieunkvhthanphunlocao",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TaoPhieuNKVHThanPhunLoCao />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "taophieunkvhthanphunlocao/:id",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TaoPhieuNKVHThanPhunLoCao />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "chitietnkvhthanphunlocao/:id",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <ChiTietNKVHThanPhunLoCao />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "silolocao",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <QuanLyTonSiLoNVL />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "quanlysilonvl",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <QuanLySiLoNVL />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "quanlytonsilonvl",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <QuanLyTonSiLoNVL />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "thongkephieuhrc2",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <ThongKePhieuHRC2 />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "thongkehrc1",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <ThongKeHRC1 />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "thongkephieuhrc1",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <ThongKePhieuHRC1 />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "thongkephieuCTD",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <ThongKePhieuCTD />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "thongkephieulg",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <ThongKePhieuLG />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "phanbodulieu",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <PhanBoDuLieuPage />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "giaonhantheplong",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <GiaoNhanThepLong />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "viecdentoi/giaonhantheplong",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <GiaoNhanThepLong type="viecdentoi" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "xemphieu/giaonhantheplong",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <GiaoNhanThepLong type="xemphieu" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "taophieugiaonhantheplong",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TaoPhieuGN />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "chitietgiaonhantheplong",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <ChiTietGN />
            </RequireRole>
          </RequireAuth>
        ),
      },
      // ========== GIAO NHẬN THÉP LỎNG - HRC1 ==========
      {
        path: "giaonhantheplong_hrc1",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <GiaoNhanThepLong_HRC1
                maBmFilter={["HRC1_LoThoi", "HRC1_TinhLuyen"]}
              />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "viecdentoi/giaonhantheplong_hrc1",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <GiaoNhanThepLong_HRC1
                type="viecdentoi"
                maBmFilter={["HRC1_BBGN_ThepLong"]}
              />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "xemphieu/giaonhantheplong_hrc1",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <GiaoNhanThepLong_HRC1 type="xemphieu" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "taophieugiaonhantheplong_hrc1",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <TaoPhieuGN_HRC1 />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "chitietgiaonhantheplong_hrc1",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <ChiTietGN_HRC1 />
            </RequireRole>
          </RequireAuth>
        ),
      },

      // ========== BB GIAO NHẬN PHÔI TẤM - HRC1 ==========
      {
        path: "bbgnphoitam_hrc1",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <HRC1_BienBanGiaoNhanPhoiTam />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "viecdentoi/bbgnphoitam_hrc1",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <HRC1_BienBanGiaoNhanPhoiTam type="viecdentoi" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "xemphieu/bbgnphoitam_hrc1",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <HRC1_BienBanGiaoNhanPhoiTam type="xemphieu" />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "chitietbbgnphoitam_hrc1",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <ChiTietBienBanGiaoNhanPhoiTam_HRC1 />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "xemphieu/chitietbbgnphoitam_hrc1",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <ChiTietBienBanGiaoNhanPhoiTam_HRC1 readOnly />
            </RequireRole>
          </RequireAuth>
        ),
      },

      {
        path: "mac-thep",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <QuanLyMacThep />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "may-duc",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <QuanLyMayDuc />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "ma-vat-tu-hrc1",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <QuanLyMaVatTuHRC1 />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "quan-ly-tai-khoan",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <QuanLyTaiKhoan />
            </RequireRole>
          </RequireAuth>
        ),
      },
      {
        path: "hrc1-phulieu",
        element: (
          <RequireAuth>
            <RequireRole allowedRoles={["admin", "user"]}>
              <PhuLieuHRC1 />
            </RequireRole>
          </RequireAuth>
        ),
      },
    ],
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/home",
    element: <Navigate to="/" replace />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
];
