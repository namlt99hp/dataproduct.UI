// ─── TKVV Scope (Xưởng) ───────────────────────────────────────────────────────
// Mã xưởng dùng chung cho toàn NM.TKVV: Thiêu kết 1-4 + Vê viên 1-2.
// - scope (number 1-6): giá trị lưu trong DB và truyền lên API
// - code  (string)    : mã ngắn dùng ở SP / EMS / backend mapping (TK1..VV2)
// - label (string)    : tên hiển thị trên UI

export interface TKVVScopeInfo {
  scope: number;
  code: string;
  label: string;
  labelNgan: string; // tên ngắn để hiển thị trong tag/badge nhỏ
}

export const TKVV_SCOPES: TKVVScopeInfo[] = [
  { scope: 1, code: "TK1", label: "TK1 - Thiêu kết 1", labelNgan: "TK1" },
  { scope: 2, code: "TK2", label: "TK2 - Thiêu kết 2", labelNgan: "TK2" },
  { scope: 3, code: "TK3", label: "TK3 - Thiêu kết 3", labelNgan: "TK3" },
  { scope: 4, code: "TK4", label: "TK4 - Thiêu kết 4", labelNgan: "TK4" },
  { scope: 5, code: "VV1", label: "VV1 - Vê viên 1",   labelNgan: "VV1" },
  { scope: 6, code: "VV2", label: "VV2 - Vê viên 2",   labelNgan: "VV2" },
];

// Dùng cho AntD Select options: <Select options={TKVV_SCOPE_OPTIONS} />
export const TKVV_SCOPE_OPTIONS = TKVV_SCOPES.map((s) => ({
  label: s.label,
  value: s.scope,
}));

// Tra cứu nhanh theo scope number (1-6)
const _byScope = new Map(TKVV_SCOPES.map((s) => [s.scope, s]));

// Tra cứu nhanh theo code string ("TK1", "VV2", ...)
const _byCode = new Map(TKVV_SCOPES.map((s) => [s.code, s]));

export const getTKVVScopeByNumber = (scope: number): TKVVScopeInfo | undefined =>
  _byScope.get(scope);

export const getTKVVScopeByCode = (code: string): TKVVScopeInfo | undefined =>
  _byCode.get(code);

/** Trả code string ("TK1"...) từ scope number. Nếu không tìm thấy trả scope.toString(). */
export const tkvvScopeToCode = (scope: number): string =>
  _byScope.get(scope)?.code ?? scope.toString();

/** Trả label hiển thị từ scope number. */
export const tkvvScopeToLabel = (scope: number): string =>
  _byScope.get(scope)?.label ?? `Scope ${scope}`;

// ─── TKVV Ca (Kíp) ────────────────────────────────────────────────────────────

export const TKVV_CA_OPTIONS = [
  { label: "Ca ngày (1)", value: 1 },
  { label: "Ca đêm (2)", value: 2 },
];

export type TKVVCa = 1 | 2;
