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
