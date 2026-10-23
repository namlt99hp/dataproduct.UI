/**
 * Registry các vùng (tab) của phiếu Báo cáo sản xuất Xưởng Nguyên liệu (TP1/TP2).
 * Đây là "lc-tab.json" nói ở LC_02_Prompt_Vibecoding_V5.md mục 2.2 — quyết định tab nào
 * hiện/ẩn cho TP nào, không tạo component/entity riêng theo TP (mục 2.1).
 *
 * `implemented = false` → tab render TabPlaceholder (chờ lát cắt sau, xem LC_02 mục 3).
 */
export type ThanhPham = "TP1" | "TP2";

export interface LcTabDef {
  key: string;
  label: string;
  implemented: boolean;
  /** Không khai báo = hiện cho cả TP1 và TP2 */
  appliesTo?: ThanhPham[];
  note?: string;
}

export const LC_BCSX_XNL_TABS: LcTabDef[] = [
  { key: "capLieuSilo", label: "Cấp liệu & Silo", implemented: true },
  { key: "phoiTron", label: "Phối trộn", implemented: true },
  { key: "thapPheu", label: "Tháp / Phễu", implemented: true },
  { key: "phanTich", label: "Phân tích", implemented: true },
  { key: "buiCoc", label: "Bụi cốc", implemented: false },
  { key: "dapCoc", label: "Sản lượng cốc", implemented: false },
  { key: "tonCoc", label: "Tồn cốc", implemented: false },
  {
    key: "xuatCapCoc",
    label: "Xuất / Cấp cốc",
    implemented: false,
    note: "Ngoài phạm vi hiện tại — chờ cấu trúc BBGN NVL (xem LC_02 mục 1.2 và 11).",
  },
  { key: "chatLuongCoc", label: "Cỡ hạt / Chất lượng cốc", implemented: true },
  { key: "tieuHao", label: "Tiêu hao", implemented: true },
  { key: "suCo", label: "Sự cố", implemented: true },
  {
    key: "ghiChuCa",
    label: "5S & Bàn giao",
    implemented: false,
    appliesTo: ["TP1"],
    note: "TP2 có áp dụng 5S & Bàn giao hay không đang chờ xác nhận (OQ-14, LC_01 mục 7).",
  },
  { key: "kpi", label: "KPI", implemented: false },
];

export interface LcPhieuTables {
  /** 1 dòng = 1 silo, gộp cấp liệu + tồn silo (khớp 1 bảng duy nhất trong workbook —
   *  xem .claude/LuyenCoc/PhanTichLayout.md mục 2–3). */
  capLieu: import("./TabCapLieuSilo").CapLieuRow[];
  /** Cỡ hạt sau nghiền 1 — đúng 2 dòng cố định (≤1mm, ≤3mm). */
  coHatNghien1: import("./TabCapLieuSilo").CoHatNghien1Row[];
  phoiTron: import("./TabPhoiTron").PhoiTronCard[];
  pheu: import("./TabThapPheu").PheuRow[];
  thap: import("./TabThapPheu").ThapRow[];
  phanTich: import("./TabPhanTich").PhanTichRow[];
  suCo: import("./TabSuCo").SuCoRow[];
  /** Lưu ở bảng quan hệ LC_TP_TieuHao (LcTieuHaoApi), không qua DataJson. */
  tieuHao: import("./TabTieuHao").TieuHaoRow[];
  /** Lưu ở bảng quan hệ LC_TP_ChatLuongCocCa (LcChatLuongCocApi), không qua DataJson. */
  chatLuongCoc: import("./TabChatLuongCoc").ChatLuongCocRow[];
}

export const EMPTY_LC_PHIEU_TABLES: LcPhieuTables = {
  capLieu: [],
  coHatNghien1: [],
  phoiTron: [],
  pheu: [],
  thap: [],
  phanTich: [],
  suCo: [],
  tieuHao: [],
  chatLuongCoc: [],
};

export function getTabsForThanhPham(thanhPham: ThanhPham | null | undefined): LcTabDef[] {
  return LC_BCSX_XNL_TABS.filter(
    (tab) => !tab.appliesTo || (thanhPham != null && tab.appliesTo.includes(thanhPham))
  );
}

/** Thành phẩm chọn trên header field "scope" (y hệt cách BOF dùng scope = số Lò thổi):
 *  scope 1 = TP1, scope 2 = TP2. Backend khi hiện thực LC_PhieuCa (ThanhPham VARCHAR(3))
 *  sẽ map lại 1↔"TP1", 2↔"TP2" — xem LC_03_Prompt_ThietKe_CSDL.md mục 1.4. */
export const THANH_PHAM_SCOPE_OPTIONS = [
  { label: "TP1", value: 1 },
  { label: "TP2", value: 2 },
];

export function scopeToThanhPham(scope: number | string | null | undefined): ThanhPham | undefined {
  const n = Number(scope);
  if (n === 1) return "TP1";
  if (n === 2) return "TP2";
  return undefined;
}

export function thanhPhamToScope(thanhPham: ThanhPham | null | undefined): number | undefined {
  if (thanhPham === "TP1") return 1;
  if (thanhPham === "TP2") return 2;
  return undefined;
}
