export const ThanhPhamEnum = {
  TP1: 1,
  TP2: 2,
} as const;
export type ThanhPhamEnum = (typeof ThanhPhamEnum)[keyof typeof ThanhPhamEnum];

// ─── LC_Silo ─────────────────────────────────────────────────────────────

export interface LcSilo {
  id: number;
  scope: number; // 1 = TP1, 2 = TP2
  siloSo: number;
  tenSilo?: string | null;
  loaiSilo: string; // 'THAN' | 'COC_*'
  thuTu?: number | null;
  ngayTao?: string | null;
}

export interface LcSiloPayload {
  scope: number;
  siloSo: number;
  tenSilo?: string | null;
  loaiSilo: string;
  thuTu?: number | null;
}

// ─── LC_CumThap ──────────────────────────────────────────────────────────

export interface LcCumThap {
  id: number;
  scope: number; // 1 = TP1, 2 = TP2
  ma: string;
  ten?: string | null;
  thuTu?: number | null;
  ngayTao?: string | null;
}

export interface LcCumThapPayload {
  scope: number;
  ma: string;
  ten?: string | null;
  thuTu?: number | null;
}

// ─── LC_SiloTon ──────────────────────────────────────────────────────────
// Danh mục "Silo Tồn" (trang quản lý độc lập, theo Scope) — mỗi silo khai báo 1 lần, có
// công thức tính khối lượng (biểu thức dạng Excel, biến H = giá trị nhập), dùng lại cho mọi
// phiếu sau qua autocomplete ở tab TabCocTonSilo (sẽ nối ở lượt sau).

export const LoaiLieuSiloTonEnum = {
  MM_10_80: "MM_10_80",
  MM_DUOI_10: "MM_DUOI_10",
} as const;
export type LoaiLieuSiloTonEnum = (typeof LoaiLieuSiloTonEnum)[keyof typeof LoaiLieuSiloTonEnum];

export interface LcSiloTon {
  id: number;
  scope: number; // 1 = TP1, 2 = TP2
  tenSilo: string;
  loaiLieu: LoaiLieuSiloTonEnum;
  tenNhapLieu: string;
  congThuc: string;
  ngayTao?: string | null;
}

export interface LcSiloTonPayload {
  scope: number;
  tenSilo: string;
  loaiLieu: LoaiLieuSiloTonEnum;
  tenNhapLieu?: string | null;
  congThuc: string;
}

export interface TestCongThucResult {
  ketQua: number | null;
  loi: string | null;
}
