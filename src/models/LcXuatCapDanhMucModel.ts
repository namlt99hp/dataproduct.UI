// Danh mục "Nơi nhận" (CHA) + "Chi tiết" (CON) vùng Cấp cốc (LcTabXuatCap) — trang quản lý
// /lc-xuatcapdanhmuc. Xem .claude/LuyenCoc/PhanTich_TabCapCoc.md §10/§11,
// Models/NMLC/LC_XuatCapDanhMucCum.cs + LC_XuatCapDanhMucChiTiet.cs.
//
// SỬA 2026-10-26: "Cụm nhận" cũ thực chất là "Nơi nhận" (vd 'LG1-CDQ') — "Cụm" THẬT (Cụm
// 1,2,3,4/5/6-7, header thật trong Excel) nằm ở LcXuatCapCum riêng. 1 Nơi nhận thuộc đúng 1 Cụm
// + 1 Loại cốc (FK, không còn text tự do), có N Chi tiết con (vd 'LC1'..'LC4'); Loại nhận
// (CDQ/ƯỚT/TN/Xả bãi/Cốc ướt/Xả ôtô) đặt ở cấp CHI TIẾT (không phải Nơi nhận cha).

export interface LcXuatCapDanhMucChiTiet {
  id: number;
  idNoiNhan: number;
  thuTu: number;
  chiTietLo?: string | null;
  idLoaiNhan?: number | null;
  tenLoaiNhan?: string | null;
}

export interface LcXuatCapDanhMucCum {
  id: number;
  scope: number; // 1 = TP1, 2 = TP2
  idCum: number;
  maCum: string;
  tenCumThat: string; // vd 'Cụm 1,2,3,4'
  thuTu: number;
  tenCan: string;
  noiNhan: string;
  idLoaiCoc: number;
  tenLoaiCoc: string;
  nhomTongHop: string;
  idPhongBan?: number | null;
  tenPhongBan?: string | null; // resolved từ PRODUCTDATA.Tbl_PhongBan, chỉ hiển thị
  ngayTao?: string | null;
  chiTiet: LcXuatCapDanhMucChiTiet[];
}

export interface LcXuatCapDanhMucCumPayload {
  scope: number;
  idCum: number;
  thuTu: number;
  tenCan: string;
  noiNhan: string;
  idLoaiCoc: number;
  nhomTongHop: string;
  idPhongBan?: number | null;
}

export interface LcXuatCapDanhMucChiTietCreatePayload {
  idNoiNhan: number;
  thuTu: number;
  chiTietLo?: string | null;
  idLoaiNhan?: number | null;
}

export interface LcXuatCapDanhMucChiTietUpdatePayload {
  thuTu: number;
  chiTietLo?: string | null;
  idLoaiNhan?: number | null;
}

export interface LcPhongBanOption {
  idPhongBan: number;
  tenPhongBan?: string | null;
  tenNgan?: string | null;
}

// Cụm THẬT (vd 'Cụm 1,2,3,4') — danh mục riêng theo Scope, mở rộng được.
export interface LcXuatCapCumOption {
  id: number;
  scope: number;
  ma: string;
  ten: string;
  thuTu: number;
}

// Loại cốc / Loại nhận — danh mục dùng chung 2 Scope.
export interface LcXuatCapLoaiOption {
  id: number;
  ten: string;
  thuTu: number;
}
