// Tra cứu Vật tư (than) + Mã lô đang active theo vật tư — PRODUCTDATA.dbo.Tbl_VatTu /
// Tbl_MaLo / Tbl_VatTuMaLo (chỉ đọc). Dùng cho autocomplete ở tab Cấp liệu & Silo.

export interface LcVatTuLookup {
  idVatTu: number;
  tenVatTu?: string | null;
  maVatTuSap?: string | null;
  tenVatTuSap?: string | null;
  donViTinh?: string | null;
}

export interface LcMaLoLookup {
  idMaLo: number;
  tenMaLo?: string | null;
  phongBan?: string | null;
}

export interface LcMaLoByVatTuGroup {
  idVatTu: number;
  maLoList: LcMaLoLookup[];
}
