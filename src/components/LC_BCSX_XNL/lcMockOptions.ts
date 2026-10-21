import type { ThanhPham } from "./lcTabsConfig";

/**
 * Danh mục PLACEHOLDER dùng để có UI thao tác được trước khi có API Master thật.
 * TODO khi có backend — thay từng hàm bằng gọi API tương ứng:
 *  - Silo     -> LC_Silo = PRODUCT_FORM.dbo.SiLo, chỉ đọc (LC_03_Prompt_ThietKe_CSDL.md mục 1.3)
 *  - Cụm tháp -> LC_CumThap (LC_03 mục 3.1 #2)
 *  - Phễu     -> LC_Pheu (LC_03 mục 3.1 #3), phụ thuộc Cụm tháp đã chọn
 * Số lượng/ký hiệu lấy theo LC_01_PhanTich_ThietKe_TP1_TP2.md mục 1.2 và 2.2 (TP1: 16 silo,
 * 3 cụm tháp x 8 phễu; TP2: 20 silo, 2 cụm tháp x 8 phễu).
 */

// Danh mục than (Tên than) + Số hiệu lô: KHÔNG còn mock — dùng autocomplete thật qua
// LcVatTuMaLoLookupApi (PRODUCTDATA.dbo.Tbl_VatTu / Tbl_MaLo / Tbl_VatTuMaLo), xem
// LcVatTuMaLoCells.tsx (VatTuAutoCompleteCell/MaLoAutoCompleteCell) dùng trong TabCapLieuSilo.

/** "Cỡ hạt sau nghiền 1" — đúng 2 dòng cố định (≤1mm, ≤3mm) theo workbook (xem
 *  PhanTichLayout.md mục 2, dòng 34–38 TP1 / 36–38 TP2). */
export function buildDefaultCoHatNghien1Rows() {
  return [
    { key: "co-hat-1mm", kichCo: "≤1mm" },
    { key: "co-hat-3mm", kichCo: "≤3mm" },
  ];
}

const CUM_THAP_TP1 = ["1-2", "3-4", "5-6"];
const CUM_THAP_TP2 = ["7-8", "9-10"];

export function buildCumThapOptions(thanhPham: ThanhPham | null | undefined) {
  const list = thanhPham === "TP2" ? CUM_THAP_TP2 : CUM_THAP_TP1;
  return list.map((ma) => ({ label: `Tháp ${ma}`, value: ma }));
}

/** Mỗi cụm tháp có 8 phễu (LC_01 mục 1.2) */
export function buildPheuOptions(cumThapMa: string | null | undefined) {
  if (!cumThapMa) return [];
  return Array.from({ length: 8 }, (_, i) => ({
    label: `Phễu ${cumThapMa}-${i + 1}`,
    value: `${cumThapMa}#${i + 1}`,
  }));
}

export const LOAI_PHOI_TRON_OPTIONS = [
  { label: "Sản xuất", value: "SAN_XUAT" },
  { label: "Thử nghiệm", value: "THU_NGHIEM" },
];

/** Nhóm chỉ tiêu phân tích — LC_01_PhanTich_ThietKe_TP1_TP2.md mục 2.2 Vùng 5 */
export const NHOM_PHAN_TICH_OPTIONS = [
  { label: "Cỡ hạt sau nghiền ≤1mm (%)", value: "CO_HAT_1MM" },
  { label: "Cỡ hạt sau nghiền ≤3mm (%)", value: "CO_HAT_3MM" },
  { label: "Độ ẩm than phối trộn (%)", value: "DO_AM_PHOI_TRON" },
];
