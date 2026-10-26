// Danh mục "Cụm nhận" (CHA) + "Chi tiết" (CON) vùng Cấp cốc (LcTabXuatCap) — trang quản lý
// /lc-xuatcapdanhmuc. Xem .claude/LuyenCoc/PhanTich_TabCapCoc.md §9,
// Models/NMLC/LC_XuatCapDanhMucCum.cs + LC_XuatCapDanhMucChiTiet.cs.
//
// 1 Cụm (vd 'LG1-CDQ') = 1 đơn vị GÁN + 1 đơn vị tính Trong ca/Lũy kế chính, có N Chi tiết con
// (vd 'LC1'..'LC4'). ID_PhongBan là field tham khảo phụ, KHÔNG dùng để nhóm chính.

export interface LcXuatCapDanhMucChiTiet {
  id: number;
  idCum: number;
  thuTu: number;
  chiTietLo?: string | null;
}

export interface LcXuatCapDanhMucCum {
  id: number;
  scope: number; // 1 = TP1, 2 = TP2
  thuTu: number;
  tenCan: string;
  tenCum: string;
  loaiCoc: string;
  nhomTongHop: string;
  idPhongBan?: number | null;
  tenPhongBan?: string | null; // resolved từ PRODUCTDATA.Tbl_PhongBan, chỉ hiển thị
  ngayTao?: string | null;
  chiTiet: LcXuatCapDanhMucChiTiet[];
}

export interface LcXuatCapDanhMucCumPayload {
  scope: number;
  thuTu: number;
  tenCan: string;
  tenCum: string;
  loaiCoc: string;
  nhomTongHop: string;
  idPhongBan?: number | null;
}

export interface LcXuatCapDanhMucChiTietCreatePayload {
  idCum: number;
  thuTu: number;
  chiTietLo?: string | null;
}

export interface LcXuatCapDanhMucChiTietUpdatePayload {
  thuTu: number;
  chiTietLo?: string | null;
}

export interface LcPhongBanOption {
  idPhongBan: number;
  tenPhongBan?: string | null;
  tenNgan?: string | null;
}
