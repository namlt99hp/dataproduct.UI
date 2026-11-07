/* eslint-disable @typescript-eslint/no-explicit-any */
import type { HRCChildColumn, HRCTableRow, HRCParentColumn } from "../components/CustomTableHRC";
import { dlnmHRC1Api } from "./DLNMHRC1Api";
import { Hrc1PhuLieuNmServiceApi } from "./Hrc1PhuLieuNmServiceApi";
import { hrc1TableService, type AdjustColumnMeta } from "./HRC1TableService";

export interface FetchHrc1PhuLieusParams {
  NgaySX?: string | null;
  Ca?: number | null;
  Scope?: number | null;
}

type Hrc1RawItem = Record<string, unknown>;

export interface ProcessedHrc1PhuLieusResult {
  phuGiaColumns: HRCChildColumn[];
  phanBoColumns: HRCChildColumn[];
  adjustColumns: HRCChildColumn[];
  tableData: HRCTableRow[];
}

export interface ProcessHrc1PhuLieusOptions {
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

/** Giá trị thực tế sẽ được render cho 1 dòng phụ liệu — cùng logic dùng khi gán vào ô bảng. */
const getPhuLieuEffectiveValue = (pl: Hrc1RawItem): number | null => {
  const isManual = getVal<boolean>(pl, "isManual", "IsManual") === true;
  if (isManual) return getVal<number>(pl, "klPhuGia_Manual", "KLPhuGia_Manual");
  return (
    getVal<number>(pl, "klPhuGiaTotal", "KLPhuGiaTotal") ??
    getVal<number>(pl, "klPhuGia", "KLPhuGia")
  );
};

/**
 * Service xử lý dữ liệu phụ liệu HRC1 (Lò thổi BOF) từ API filter.
 * Khác hrc2PhuLieuService: HRC1_PhuLieuNM là danh mục cố định 13 dòng (không cần Header_Mapping),
 * nên không tách mapped/unmapped — toàn bộ phụ liệu build 1 nhóm cột duy nhất theo PhuLieuID.
 * Cột "Phân bổ" và "Điều chỉnh tự do" (manual_col_*, dựa trên Header_Key dùng chung với HRC2) vẫn giữ.
 * Cột phụ liệu (phuGiaColumns) LUÔN lấy đủ từ danh mục (dangSuDung:true, thuTu_Excel_BOF khác NULL),
 * mirror hrc1LFPhuLieuService — KHÔNG lọc theo "đã có dữ liệu" nữa: phụ liệu nào chưa có mẻ nào dùng
 * tới (hoặc Lò thổi này không dùng tới) vẫn hiện cột, chỉ là render rỗng.
 */
export const hrc1PhuLieuService = {
  async fetchAndProcessPhuLieus(
    params: FetchHrc1PhuLieusParams,
    options: ProcessHrc1PhuLieusOptions = {}
  ): Promise<ProcessedHrc1PhuLieusResult> {
    const { baseColumns = [] } = options;

    const [res, catalog] = await Promise.all([
      dlnmHRC1Api.filter({
        NgaySX: params.NgaySX,
        Ca: params.Ca,
        Scope: params.Scope,
      }),
      Hrc1PhuLieuNmServiceApi.getAll({ dangSuDung: true }),
    ]);

    const rawData = (Array.isArray(res) ? res : res ? [res] : []) as Hrc1RawItem[];

    const allPhanBoMeta: Record<number, Hrc1RawItem> = {};
    const allManualMeta: Record<number, Hrc1RawItem> = {};

    rawData.forEach((item) => {
      const phanBo = (getVal<Hrc1RawItem[]>(item, "phanBoPhulieus", "PhanBoPhulieus") ?? []) as Hrc1RawItem[];
      phanBo.forEach((pb) => {
        const id = getVal<number>(pb, "idPhuLieu", "iD_PhuLieu", "ID_PhuLieu");
        if (id != null && !allPhanBoMeta[id]) allPhanBoMeta[id] = pb;
      });

      const manual = (getVal<Hrc1RawItem[]>(item, "manualAdjustPhulieus", "ManualAdjustPhulieus") ?? []) as Hrc1RawItem[];
      manual.forEach((m) => {
        const id = getVal<number>(m, "idHeaderKey", "iD_HeaderKey", "ID_HeaderKey");
        if (id != null && !allManualMeta[id]) allManualMeta[id] = m;
      });
    });

    const phuGiaColumns: HRCChildColumn[] = catalog
      .filter((pl) => pl.thuTu_Excel_BOF != null)
      .sort((a, b) => {
        const ta = a.thuTu_Excel_BOF ?? Number.MAX_SAFE_INTEGER;
        const tb = b.thuTu_Excel_BOF ?? Number.MAX_SAFE_INTEGER;
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
        metaGroup: "BOF_PhuGia",
        editable: false,
        variant: "source" as const,
        headerKeyId: pl.id,
      }));

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

    const adjustColumns: HRCChildColumn[] = Object.entries(allManualMeta).map(([idStr, m]) => {
      const id = Number(idStr);
      const label = getVal<string>(m, "tenHienThi", "TenHienThi") ?? `Điều chỉnh #${id}`;
      return {
        title: label,
        dataIndex: `manual_col_${id}`,
        width: 150,
        metaLabel: label,
        editable: true,
        variant: "default" as const,
        headerKeyId: id,
      };
    });

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
      const isNM = getVal<boolean>(data, "isNM", "IsNM");
      const isEdited = getVal<boolean>(data, "isEdited", "IsEdited") === true;

      const row: HRCTableRow = {
        // Luôn kèm index — 2 mẻ trùng số (IsTrungMeThoi) có cùng meThoi sẽ đụng key nếu chỉ dùng
        // meThoi, khiến STT (resolveSttText tra theo key) và các thao tác sửa/xoá theo key bị lẫn dòng.
        key: `row-${index}-${meThoi ?? "empty"}`,
        id: getVal<number>(data, "id", "ID") ?? undefined,
        IsNM: isNM ?? true,
        IsEdited: isEdited,
        isTrungMeThoi: isTrungMe,
        IsTrungMeThoi: isTrungMe,
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

      // MacThep/KLThepPhe: BE lưu snapshot giá trị NM gốc vào MacThepOrig/KLThepPheOrig + cờ
      // MacThepIsManual/KLThepPheIsManual khi user sửa tay lần đầu (mirror KLPhuGia/KLPhuGia_Manual/
      // IsManual của phụ liệu) — map vào `${dataIndex}__orig`/`${dataIndex}__IsManual` mà
      // CustomTableHRC đã dùng sẵn để so sánh + highlight per-cell. Dựa vào cờ IsManual (không suy
      // luận từ Orig != null) vì Orig tự nó có thể null hợp lệ — vd MacThep chưa sync được lần đầu,
      // Orig gốc lúc sửa vốn null — vẫn phải nhận biết đúng là "đã sửa" để giữ highlight.
      const macThepIsManual = getVal<boolean>(data, "macThepIsManual", "MacThepIsManual") === true;
      if (macThepIsManual) {
        row["macThep__IsManual"] = true;
        row["macThep__orig"] = getVal<string>(data, "macThepOrig", "MacThepOrig");
      }
      const klThepPheIsManual = getVal<boolean>(data, "klThepPheIsManual", "KLThepPheIsManual") === true;
      if (klThepPheIsManual) {
        row["klThepPhe__IsManual"] = true;
        row["klThepPhe__orig"] = getVal<number>(data, "klThepPheOrig", "KLThepPheOrig");
      }

      const phuLieus = (getVal<Hrc1RawItem[]>(item, "phuLieus", "PhuLieus") ?? []) as Hrc1RawItem[];
      phuLieus.forEach((pl) => {
        const id = getVal<number>(pl, "idPhuLieu", "iD_PhuLieu", "ID_PhuLieu");
        if (id == null) return;
        const dataIndex = `phuLieu_${id}`;
        const isManual = getVal<boolean>(pl, "isManual", "IsManual") === true;
        if (isManual) {
          const manualVal = getVal<number>(pl, "klPhuGia_Manual", "KLPhuGia_Manual");
          const origVal = getVal<number>(pl, "klPhuGia", "KLPhuGia");
          row[dataIndex] = manualVal ?? "";
          (row as any)[`${dataIndex}__IsManual`] = true;
          (row as any)[`${dataIndex}__orig`] = origVal;
        } else {
          row[dataIndex] = getPhuLieuEffectiveValue(pl) ?? "";
        }
      });

      const phanBo = (getVal<Hrc1RawItem[]>(item, "phanBoPhulieus", "PhanBoPhulieus") ?? []) as Hrc1RawItem[];
      phanBo.forEach((pb) => {
        const id = getVal<number>(pb, "idPhuLieu", "iD_PhuLieu", "ID_PhuLieu");
        if (id == null) return;
        row[`phanBo_${id}`] =
          getVal<number>(pb, "klPhuGiaTotal", "KLPhuGiaTotal") ??
          getVal<number>(pb, "klPhuGia", "KLPhuGia") ??
          "";
      });

      const manual = (getVal<Hrc1RawItem[]>(item, "manualAdjustPhulieus", "ManualAdjustPhulieus") ?? []) as Hrc1RawItem[];
      manual.forEach((m) => {
        const id = getVal<number>(m, "idHeaderKey", "iD_HeaderKey", "ID_HeaderKey");
        if (id == null) return;
        const val = getVal<number>(m, "klPhuGia_Manual", "KLPhuGia_Manual");
        if (val == null) return;
        row[`manual_col_${id}`] = val;
      });

      return row;
    });

    if (tableData.length === 0) {
      tableData.push({ key: "row-empty" });
    }

    return { phuGiaColumns, phanBoColumns, adjustColumns, tableData };
  },

  /**
   * Chuẩn hóa table rows trước khi gửi payload — cùng logic hrc2PhuLieuService (thuần, dùng chung được).
   * @param manuallyAddedPhuLieuDataIndexes Các dataIndex `phuLieu_{id}` đang được quản lý qua nút "Thêm cột điều chỉnh"
   * (adjustColumnMetas.isManuallyAdded === true). Đánh dấu tường minh `${dataIndex}__IsAddManual = true` cho BE —
   * KHÔNG được suy luận từ việc có __orig hay không, vì 13 phụ liệu mặc định luôn có baseline (KLPhuGia = 0, không NULL)
   * dù đang bị ẩn khỏi cột tự động, nên baseline "có tồn tại nhưng = 0" dễ bị hiểu lầm là "sửa tay 1 giá trị NM có sẵn".
   */
  sanitizeRowsBeforeSubmit(
    rows: HRCTableRow[],
    manuallyAddedPhuLieuDataIndexes?: Set<string>
  ): HRCTableRow[] {
    return rows.map((row) => {
      const processedRow: Record<string, unknown> = { ...row };
      if (processedRow.IsNM === undefined) {
        processedRow.IsNM = true;
      }
      delete processedRow._isNewRow;
      delete processedRow.__fromFilterAPI;

      manuallyAddedPhuLieuDataIndexes?.forEach((dataIndex) => {
        processedRow[`${dataIndex}__IsAddManual`] = true;
      });

      Object.keys(processedRow).forEach((key) => {
        if (key.startsWith("manual_col_")) {
          delete processedRow[key];
          return;
        }
        if (!key.endsWith("__orig")) return;
        const baseKey = key.slice(0, -6);
        const origVal = processedRow[key];
        const curVal = processedRow[baseKey];
        const curNum = curVal === null || curVal === undefined || curVal === "" ? null : Number(curVal);
        const origNum = origVal === null || origVal === undefined || origVal === "" ? null : Number(origVal);

        const isSame =
          (curNum === null && origNum === null) ||
          (curNum !== null &&
            origNum !== null &&
            Number.isFinite(curNum) &&
            Number.isFinite(origNum) &&
            Math.abs(curNum - origNum) < 0.000001);

        if (isSame) {
          delete processedRow[key];
          delete processedRow[`${baseKey}__IsManual`];
        }
      });

      return processedRow as HRCTableRow;
    });
  },

  /** Build metadata cho adjust columns kèm giá trị theo từng dòng — cùng logic hrc2PhuLieuService. */
  buildAdjustDynamicWithValues(
    adjustMetas: AdjustColumnMeta[],
    rows: HRCTableRow[]
  ) {
    const dynamic = hrc1TableService.adjustMetaToDynamic(adjustMetas);
    return dynamic.map((meta) => {
      const values = rows
        .map((row) => ({
          rowId: typeof row.id === "number" ? row.id : null,
          meThoi: typeof row.meThoi === "string" ? row.meThoi : null,
          value:
            row[meta.dataIndex] === undefined || row[meta.dataIndex] === ""
              ? null
              : (row[meta.dataIndex] as string | number | null),
        }))
        .filter((v) => v.value !== null);
      return {
        ...meta,
        values,
      };
    });
  },
};
