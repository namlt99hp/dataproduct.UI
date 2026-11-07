/* eslint-disable @typescript-eslint/no-explicit-any */
import type { HRCChildColumn, HRCTableRow, HRCParentColumn } from "../components/CustomTableHRC";
import { dlnmHRC1Api } from "./DLNMHRC1Api";
import { Hrc1PhuLieuNmServiceApi, LoaiPhuLieuLF } from "./Hrc1PhuLieuNmServiceApi";

export interface FetchHrc1LFPhuLieusParams {
  NgaySX?: string | null;
  Ca?: number | null;
  Scope?: number | null;
}

type Hrc1RawItem = Record<string, unknown>;

export interface ProcessedHrc1LFPhuLieusResult {
  // Tách 2 nhóm cột đúng 2 nhóm trên biểu mẫu giấy BM.14/QT.05.10 ("Chất hợp kim hóa" / "Phụ gia &
  // chất khử oxy") — phân biệt theo Hrc1PhuLieuNm.LoaiPL (xem Models/Hrc1PhuLieuNm.cs). Phụ liệu có
  // thuTu_Excel_LF nhưng chưa gán LoaiPL (vd danh mục cũ trước khi có field này) sẽ KHÔNG hiện ở cả
  // 2 nhóm — phải vào trang quản lý PhuLieuHRC1.tsx gán nhóm trước.
  phuGiaColumnsKimLoai: HRCChildColumn[];
  phuGiaColumnsPhuGia: HRCChildColumn[];
  phanBoColumns: HRCChildColumn[];
  tableData: HRCTableRow[];
}

export interface ProcessHrc1LFPhuLieusOptions {
  baseColumns?: HRCParentColumn[];
}

/** BE trả camelCase (System.Text.Json mặc định) — thử thêm biến thể PascalCase để phòng ngừa. */
const getVal = <T,>(item: Hrc1RawItem, ...keys: string[]): T | null => {
  for (const key of keys) {
    const val = item[key];
    if (val !== undefined && val !== null) return val as T;
  }
  return null;
};

/**
 * Service xử lý dữ liệu phụ liệu HRC1 Tinh luyện LF — khác hrc1PhuLieuService (BOF): LF không có
 * nguồn NM nào để đồng bộ, mọi mẻ + phụ liệu đều nhập tay 100%. Vì vậy:
 * - Không có khái niệm "auto vs manual" / baseline để so sánh (không __orig, không __IsManual).
 * - Cột phụ liệu KHÔNG lọc theo "đã có dữ liệu" như BOF (LF chưa có nguồn NM để tự biết loại nào
 *   "đã dùng"). Thay vào đó lấy đúng những phụ liệu đã được cấu hình `thuTu_Excel_LF` (khác NULL) trên
 *   danh mục HRC1_PhuLieuNM (trang quản lý PhuLieuHRC1.tsx) — loại nào được cấu hình cột này mới hiện
 *   ra để nhập tay, sắp theo đúng giá trị đó. Xem Models/Hrc1PhuLieuNm.cs.
 * - Tách thành 2 nhóm cột theo `LoaiPL` (Kim loại/Chất hợp kim hóa vs Phụ gia & chất khử oxy), mirror
 *   đúng 2 nhóm trên biểu mẫu giấy BM.14/QT.05.10 — phụ liệu có `thuTu_Excel_LF` nhưng chưa gán
 *   `loaiPL` sẽ không hiện ở nhóm nào cho tới khi được gán ở trang quản lý.
 * - Mọi dòng trả về đều ép IsNM=false (bắt buộc để CustomTableHRC cho sửa meThoi/macThep).
 */
export const hrc1LFPhuLieuService = {
  async fetchAndProcessPhuLieus(
    params: FetchHrc1LFPhuLieusParams,
    options: ProcessHrc1LFPhuLieusOptions = {}
  ): Promise<ProcessedHrc1LFPhuLieusResult> {
    const { baseColumns = [] } = options;

    const [res, catalog] = await Promise.all([
      dlnmHRC1Api.filter({
        NgaySX: params.NgaySX,
        Ca: params.Ca,
        Scope: params.Scope,
        BieuMau: "LF",
      }),
      // Danh mục HRC1_PhuLieuNM dùng chung cho cả BOF và LF, không phân biệt theo BieuMau.
      Hrc1PhuLieuNmServiceApi.getAll({ dangSuDung: true }),
    ]);

    const rawData = (Array.isArray(res) ? res : res ? [res] : []) as Hrc1RawItem[];

    // Cột "Phân bổ" — gom từ phanBoPhulieus (record IsPhanBo=true riêng, ghi bởi
    // STD_XNT_HRC1Repository.PhanBoAsync) trả về theo từng mẻ. Phải tách riêng khỏi phuLieus (record
    // đo thật, IsPhanBo=false) — nếu gộp chung, giá trị phân bổ sẽ đè lên giá trị đo thật vì cùng
    // PhuLieuID. Mirror hrc1PhuLieuService (BOF) — xem TaoTieuHaoLoThoi.tsx phanBoChildColumns.
    const allPhanBoMeta: Record<number, Hrc1RawItem> = {};
    rawData.forEach((item) => {
      const phanBo = (getVal<Hrc1RawItem[]>(item, "phanBoPhulieus", "PhanBoPhulieus") ?? []) as Hrc1RawItem[];
      phanBo.forEach((pb) => {
        const id = getVal<number>(pb, "idPhuLieu", "iD_PhuLieu", "ID_PhuLieu");
        if (id != null && !allPhanBoMeta[id]) allPhanBoMeta[id] = pb;
      });
    });
    const phanBoColumns: HRCChildColumn[] = Object.entries(allPhanBoMeta).map(([idStr, pb]) => {
      const id = Number(idStr);
      const label = getVal<string>(pb, "tenPhuLieu", "TenPhuLieu") ?? `PB-${id}`;
      return {
        title: label,
        dataIndex: `phanBo_${id}`,
        width: 100,
        editable: false,
        variant: "adjust" as const,
        metaLabel: label,
        headerKeyId: id,
      };
    });

    const buildPhuGiaGroup = (loaiPL: number, metaGroup: string): HRCChildColumn[] =>
      catalog
        .filter((pl) => pl.thuTu_Excel_LF != null && pl.loaiPL === loaiPL)
        .sort((a, b) => {
          const ta = a.thuTu_Excel_LF ?? Number.MAX_SAFE_INTEGER;
          const tb = b.thuTu_Excel_LF ?? Number.MAX_SAFE_INTEGER;
          if (ta !== tb) return ta - tb;
          return a.id - b.id;
        })
        .map((pl) => ({
          title: pl.tenPhuLieu,
          dataIndex: `phuLieu_${pl.id}`,
          width: 100,
          format: "number-group",
          sum: true,
          metaLabel: pl.tenPhuLieu,
          metaGroup,
          editable: true,
          variant: "default" as const,
          headerKeyId: pl.id,
        }));

    const phuGiaColumnsKimLoai = buildPhuGiaGroup(LoaiPhuLieuLF.KimLoai, "LF_PhuGia_KimLoai");
    const phuGiaColumnsPhuGia = buildPhuGiaGroup(LoaiPhuLieuLF.PhuGia, "LF_PhuGia_PhuGia");

    const assignRowValue = (target: HRCTableRow, key: string, value: unknown) => {
      if (typeof value === "number" || typeof value === "string") {
        target[key] = value;
        return;
      }
      if (value instanceof Date) {
        target[key] = value.toISOString();
        return;
      }
      if (value !== null && value !== undefined) {
        target[key] = String(value);
      }
    };

    const tableData: HRCTableRow[] = rawData.map((item, index) => {
      const data = (getVal<Hrc1RawItem>(item, "data", "Data") ?? {}) as Hrc1RawItem;
      const meThoi = getVal<string>(data, "meThoi", "MeThoi");
      const isTrungMe = getVal<boolean>(data, "isTrungMeThoi", "IsTrungMeThoi") === true;
      const thoiGianLF = getVal<string>(data, "thoiGianLF", "ThoiGianLF");
      const isEdited = getVal<boolean>(data, "isEdited", "IsEdited") === true;

      const row: HRCTableRow = {
        // Luôn kèm index — 2 mẻ trùng số (IsTrungMeThoi) có cùng meThoi sẽ đụng key nếu chỉ dùng
        // meThoi, khiến STT (resolveSttText tra theo key) và các thao tác sửa/xoá theo key bị lẫn dòng.
        key: `row-${index}-${meThoi ?? "empty"}`,
        id: getVal<number>(data, "id", "ID") ?? undefined,
        // LF không có mẻ từ NM — luôn ép false để CustomTableHRC cho sửa mọi ô (meThoi/macThep...).
        IsNM: false,
        IsEdited: isEdited,
        isTrungMeThoi: isTrungMe,
        IsTrungMeThoi: isTrungMe,
        // thoiGianLF không phải cột hiển thị trong config JSON (baseColumns) nên mapField() bên dưới
        // không bao giờ gán nó — phải gán tường minh ở đây để CustomTableHRC.sortedRows (sort theo
        // thời gian LF thực tế cho maBm HRC1_BB_TieuHao_LF) và các nơi sort theo thoiGianLF khác có
        // dữ liệu để dùng.
        ...(thoiGianLF !== null ? { thoiGianLF } : {}),
        __fromFilterAPI: true,
      };

      const mapField = (dataIndex?: string) => {
        if (!dataIndex) return;
        const pascal = dataIndex.charAt(0).toUpperCase() + dataIndex.slice(1);
        const val = getVal<unknown>(data, dataIndex, pascal);
        if (val !== undefined && val !== null) assignRowValue(row, dataIndex, val);
      };

      baseColumns.forEach((col: any) => {
        if (col.dataIndex && !col.children) mapField(col.dataIndex);
        if (Array.isArray(col.children)) {
          col.children.forEach((c: any) => mapField(c.dataIndex));
        }
      });

      const phuLieus = (getVal<Hrc1RawItem[]>(item, "phuLieus", "PhuLieus") ?? []) as Hrc1RawItem[];
      phuLieus.forEach((pl) => {
        const id = getVal<number>(pl, "idPhuLieu", "iD_PhuLieu", "ID_PhuLieu");
        if (id == null) return;
        const value = getVal<number>(pl, "klPhuGia", "KLPhuGia");
        row[`phuLieu_${id}`] = value ?? "";
      });

      const phanBo = (getVal<Hrc1RawItem[]>(item, "phanBoPhulieus", "PhanBoPhulieus") ?? []) as Hrc1RawItem[];
      phanBo.forEach((pb) => {
        const id = getVal<number>(pb, "idPhuLieu", "iD_PhuLieu", "ID_PhuLieu");
        if (id == null) return;
        const value = getVal<number>(pb, "klPhuGiaTotal", "KLPhuGiaTotal") ?? getVal<number>(pb, "klPhuGia", "KLPhuGia");
        row[`phanBo_${id}`] = value ?? "";
      });

      return row;
    });

    if (tableData.length === 0) {
      tableData.push({ key: "row-empty" });
    }

    return { phuGiaColumnsKimLoai, phuGiaColumnsPhuGia, phanBoColumns, tableData };
  },

  /** Chuẩn hóa table rows trước khi gửi payload — LF không cần dọn __orig/manual_col_* vì không dùng. */
  sanitizeRowsBeforeSubmit(rows: HRCTableRow[]): HRCTableRow[] {
    return rows.map((row) => {
      const processedRow: Record<string, unknown> = { ...row };
      processedRow.IsNM = false;
      delete processedRow._isNewRow;
      delete processedRow.__fromFilterAPI;
      return processedRow as HRCTableRow;
    });
  },
};
