import type { ReactNode } from "react";
import type {
  HRCChildColumn,
  HRCParentColumn,
  HRCTableRow,
} from "../components/CustomTableHRC";
import type { HeaderMappingRecord } from "../components/HeaderMapping";
import { PhieuApi } from "./PhieuApi";
import { STD_NXT_HRC1ServiceApi } from "./STD_NXT_HRC1ServiceApi";

// Bản sao riêng cho HRC1 (BOF/LF), tách khỏi HRC2TableService.ts để sửa logic riêng cho HRC1
// (vd merge dữ liệu bảng) mà không ảnh hưởng tới các trang HRC2 đang dùng file gốc.
// KHÔNG import ngược từ HRC2TableService.ts — giữ 2 module hoàn toàn độc lập.

export type DynamicColumnMeta = {
  dataIndex: string;
  width?: number;
  label: string;
  allowMapping?: boolean;
  mappingPayload?: HeaderMappingRecord | null;
  metaGroup?: string;
  variant?: "source" | "adjust" | "default";
  highlight?: boolean;
  headerKeyId?: number | null;
  // true: cột này được tính vào dòng Tổng (Table.Summary) — phải lưu/khôi phục qua snapshot
  // table1DynamicColumns, nếu không dòng Tổng sẽ ngưng cộng cột này sau khi tải lại phiếu đã lưu.
  sum?: boolean;
};

export type AdjustColumnMeta = {
  key: string;
  dataIndex: string;
  headerKeyId?: number | null;
  headerKeyLabel?: string | null;
  width?: number;
  isManuallyAdded?: boolean; // true = thêm tay bằng button, cho phép chỉnh sửa
};

const DEFAULT_EXCLUDED_KEYS = ["meThoi", "macThep", "ghiChu", "stt", "STT"];

// Cột "thêm tay" qua nút Thêm cột điều chỉnh: manual_col_* (chưa resolve) hoặc phuLieu_* (đã chọn/tạo
// phụ liệu — xem TaoTieuHaoLoThoi.tsx/TaoTieuHaoTinhLuyenLF.tsx).
const isManuallyAddedAdjustDataIndex = (dataIndex?: string | null): boolean =>
  (dataIndex ?? "").startsWith("manual_col_") || (dataIndex ?? "").startsWith("phuLieu_");

const canCurrentUserMap = (): boolean => {
  try {
    if (typeof window === "undefined") return false;
    const raw = window.localStorage.getItem("userinfo");
    if (!raw) return false;
    const parsed = JSON.parse(raw) as {
      iD_Quyen?: number;
      tenNgan?: string;
    };
    if (!parsed) return false;
    return parsed.iD_Quyen === 1 || parsed.tenNgan === "P.KH";
  } catch {
    return false;
  }
};

const resolveLabel = (title: ReactNode, fallback?: string) => {
  if (typeof title === "string") return title;
  if (fallback) return fallback;
  return "";
};

const buildAdjustColumn = (
  source: { title: ReactNode; dataIndex?: string; width?: number; metaLabel?: string },
  excludedKeys: Set<string>,
  adjustColumns: HRCChildColumn[],
  showAdjustColumns: boolean
) => {
  if (!showAdjustColumns) return;
  const dataIndex = source.dataIndex;
  if (!dataIndex || excludedKeys.has(dataIndex)) {
    return;
  }
  const label = source.metaLabel ?? resolveLabel(source.title, dataIndex);
  adjustColumns.push({
    title: label,
    dataIndex: `${dataIndex}_adjust`,
    width: source.width,
    placeholder: typeof label === "string" ? `Điều chỉnh ${label}` : undefined,
    editable: true,
    variant: "adjust",
    format: "number-group",
  });
};

const mapChildWithAdjust = (
  child: HRCChildColumn,
  excludedKeys: Set<string>,
  adjustColumns: HRCChildColumn[],
  showAdjustColumns: boolean
): HRCChildColumn => {
  buildAdjustColumn(child, excludedKeys, adjustColumns, showAdjustColumns);
  return { ...child, editable: false };
};

export const hrc1TableService = {
  canCurrentUserMap,
  mergeAdjustMetas(
    prev: AdjustColumnMeta[] = [],
    incoming: AdjustColumnMeta[] = []
  ): AdjustColumnMeta[] {
    // Chuẩn hoá: cột thêm tay luôn xem như vậy để được editable (render autocomplete)
    const normalize = (m: AdjustColumnMeta): AdjustColumnMeta => ({
      ...m,
      isManuallyAdded: m.isManuallyAdded === true || isManuallyAddedAdjustDataIndex(m.dataIndex),
    });

    const byDataIndex = new Map<string, AdjustColumnMeta>();
    prev.forEach((m) => {
      if (!m?.dataIndex) return;
      byDataIndex.set(m.dataIndex, normalize(m));
    });
    incoming.forEach((m) => {
      if (!m?.dataIndex) return;
      const norm = normalize(m);
      const existing = byDataIndex.get(norm.dataIndex);
      // Ưu tiên label/headerKeyId từ prev nếu có
      byDataIndex.set(norm.dataIndex, existing ? { ...norm, ...existing } : norm);
    });

    return hrc1TableService.dedupeAdjustMetas(Array.from(byDataIndex.values()));
  },
  renameRowColumnKey(
    row: HRCTableRow,
    oldDataIndex: string,
    newDataIndex: string
  ): HRCTableRow {
    if (!row || oldDataIndex === newDataIndex) return row;
    if (!(oldDataIndex in row)) return row;

    const next: HRCTableRow = { ...row };
    next[newDataIndex] = row[oldDataIndex];

    const oldOrigKey = `${oldDataIndex}__orig`;
    const newOrigKey = `${newDataIndex}__orig`;
    if (oldOrigKey in row) {
      (next as unknown as Record<string, unknown>)[newOrigKey] =
        (row as unknown as Record<string, unknown>)[oldOrigKey];
    }

    const oldManualFlagKey = `${oldDataIndex}__IsManual`;
    const newManualFlagKey = `${newDataIndex}__IsManual`;
    if (oldManualFlagKey in row) {
      (next as unknown as Record<string, unknown>)[newManualFlagKey] =
        (row as unknown as Record<string, unknown>)[oldManualFlagKey];
    }

    delete (next as unknown as Record<string, unknown>)[oldDataIndex];
    delete (next as unknown as Record<string, unknown>)[oldOrigKey];
    delete (next as unknown as Record<string, unknown>)[oldManualFlagKey];

    return next;
  },

  removeRowColumnKey(row: HRCTableRow, dataIndex: string): HRCTableRow {
    if (!row) return row;
    if (!(dataIndex in row)) return row;
    const next: HRCTableRow = { ...row };
    delete (next as unknown as Record<string, unknown>)[dataIndex];
    delete (next as unknown as Record<string, unknown>)[`${dataIndex}__orig`];
    delete (next as unknown as Record<string, unknown>)[`${dataIndex}__IsManual`];
    return next;
  },
  dedupeAdjustMetas(metas: AdjustColumnMeta[] = []): AdjustColumnMeta[] {
    if (!metas.length) return metas;

    const manualHeaderKeyIds = new Set<number>();
    metas.forEach((m) => {
      const isManualCol = (m.dataIndex ?? "").startsWith("manual_col_");
      const hk = m.headerKeyId;
      if (isManualCol && typeof hk === "number") {
        manualHeaderKeyIds.add(hk);
      }
    });

    if (!manualHeaderKeyIds.size) return metas;

    // Nếu đã có manual_col_{hk} thì bỏ adjust_{hk}_adjust để tránh render dư cột
    return metas.filter((m) => {
      const hk = m.headerKeyId;
      if (typeof hk !== "number") return true;
      const isAutoAdjust = (m.dataIndex ?? "").startsWith(`adjust_${hk}_`);
      return !(manualHeaderKeyIds.has(hk) && isAutoAdjust);
    });
  },
  buildDynamicColumnMap(
    groups: Record<string, HRCChildColumn[]>
  ): Record<string, DynamicColumnMeta[]> {
    const result: Record<string, DynamicColumnMeta[]> = {};
    Object.entries(groups).forEach(([key, cols]) => {
      if (!cols || !cols.length) {
        return;
      }
      result[key] = cols.map((col) => ({
        dataIndex: col.dataIndex,
        width: col.width,
        label:
          col.metaLabel ??
          (typeof col.title === "string" ? col.title : "") ??
          "",
        allowMapping: col.allowMapping,
        mappingPayload: col.mappingPayload ?? null,
        metaGroup: col.metaGroup,
        variant: col.variant,
        highlight: col.highlight,
        headerKeyId: (col as { headerKeyId?: number | null })?.headerKeyId ?? null,
        sum: col.sum,
      }));
    });
    return result;
  },

  columnsFromMeta(
    items: DynamicColumnMeta[] | undefined,
    renderTitle: (label: string, meta?: DynamicColumnMeta) => ReactNode
  ): HRCChildColumn[] {
    if (!items?.length) {
      return [];
    }
    const canMap = canCurrentUserMap();
    return items.map((item) => ({
      title: renderTitle(item.label, item),
      dataIndex: item.dataIndex,
      width: item.width,
      highlight: item.highlight ?? item.metaGroup === "others",
      metaLabel: item.label,
      editable: false,
      // Chỉ cho phép mapping khi user có quyền và meta cho phép
      allowMapping: canMap && (item.allowMapping ?? true),
      mappingPayload: item.mappingPayload,
      metaGroup: item.metaGroup,
      variant: item.variant ?? "source",
      headerKeyId: item.headerKeyId ?? undefined,
      // Mặc định true nếu snapshot cũ (lưu trước khi field `sum` được thêm vào DynamicColumnMeta)
      // không có field này — mọi cột phụ liệu BOF_PhuGia/LF_PhuGia phục hồi qua columnsFromMeta
      // luôn phải được cộng vào dòng Tổng, không có trường hợp nào cố tình để false.
      sum: item.sum ?? true,
    }));
  },

  restoreDynamicGroups(
    metaMap: Record<string, DynamicColumnMeta[]> | undefined,
    renderTitle: (label: string, meta?: DynamicColumnMeta) => ReactNode
  ): Record<string, HRCChildColumn[]> {
    if (!metaMap) {
      return {};
    }
    const result: Record<string, HRCChildColumn[]> = {};
    Object.entries(metaMap).forEach(([key, items]) => {
      result[key] = hrc1TableService.columnsFromMeta(items, renderTitle);
    });
    return result;
  },

  adjustMetaFromDynamic(items?: DynamicColumnMeta[]): AdjustColumnMeta[] {
    if (!items?.length) {
      return [];
    }
    return items.map((item, index) => ({
      key: item.dataIndex || `adjust_${index}`,
      dataIndex: item.dataIndex || `adjust_${index}`,
      headerKeyId: item.headerKeyId ?? null,
      headerKeyLabel: item.label,
      width: item.width,
      isManuallyAdded: isManuallyAddedAdjustDataIndex(item.dataIndex),
    }));
  },

  adjustMetaToDynamic(metas: AdjustColumnMeta[]): DynamicColumnMeta[] {
    if (!metas?.length) {
      return [];
    }
    return metas.map((meta) => ({
      dataIndex: meta.dataIndex,
      width: meta.width,
      label: meta.headerKeyLabel ?? "",
      metaGroup: "adjust",
      variant: "adjust",
      highlight: false,
      allowMapping: false,
      mappingPayload: null,
      headerKeyId: meta.headerKeyId ?? null,
    }));
  },

  /**
   * Sắp xếp lại toàn bộ dòng theo MeThoi tăng dần — áp dụng ở bước render cuối cùng, sau mọi merge
   * (mergeServerRows/applyManualOverrides chỉ nối [...merged, ...manualRows]/[...result, ...unsavedNewRows],
   * KHÔNG tự sắp xếp lại), để mẻ thêm tay (IsNM=false) không bị dồn thành khối riêng ở cuối bảng dù
   * MeThoi của nó nhỏ hơn các mẻ tự động. Dùng localeCompare numeric để đúng thứ tự cả khi MeThoi lẫn
   * chữ (vd "B10" > "B9"), không chỉ so sánh chuỗi thuần (sẽ sai "10" < "9"). Dòng thiếu MeThoi (mới
   * thêm, chưa nhập) luôn rơi xuống cuối thay vì chen vào giữa.
   */
  sortRowsByMeThoi(rows: HRCTableRow[], keyField = "meThoi"): HRCTableRow[] {
    return [...rows].sort((a, b) => {
      const rawA = a[keyField];
      const rawB = b[keyField];
      const sa = rawA === undefined || rawA === null || rawA === "" ? null : String(rawA);
      const sb = rawB === undefined || rawB === null || rawB === "" ? null : String(rawB);
      if (sa === null && sb === null) return 0;
      if (sa === null) return 1;
      if (sb === null) return -1;
      return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: "base" });
    });
  },

  mergeServerRows(
    serverRows: HRCTableRow[] = [],
    previousRows: HRCTableRow[] = [],
    keyField = "meThoi",
    preserveFields?: string[],
    idField = "id"
  ): HRCTableRow[] {
    if (!previousRows.length) {
      return serverRows;
    }

    // Ưu tiên khoá theo id (duy nhất per-dòng) — meThoi chỉ dùng fallback cho dòng chưa có id (mới
    // thêm tay, chưa lưu). Nếu khoá thẳng theo meThoi, 2 dòng khác nhau CÙNG meThoi (vd 1 dòng NM +
    // 1 dòng thêm tay trùng Mẻ thổi) sẽ đụng độ trong Map — dòng sau ghi đè dòng trước, khiến field
    // editable (macThep, klThepPhe...) của dòng NM bị "ăn theo" giá trị của dòng thêm tay khi merge.
    const rowKey = (row: HRCTableRow): string | number | undefined => {
      const idVal = row[idField] as string | number | undefined;
      if (idVal !== undefined && idVal !== null && idVal !== "") return idVal;
      return row[keyField] as string | number | undefined;
    };

    const prevMap = new Map<string | number, HRCTableRow>();
    previousRows.forEach((row) => {
      const keyValue = rowKey(row);
      if (keyValue !== undefined && keyValue !== null) {
        prevMap.set(keyValue, row);
      }
    });

    const preserveSet = preserveFields && preserveFields.length
      ? new Set(preserveFields)
      : null;

    const serverKeySet = new Set<string | number>();
    const merged = serverRows.map((serverRow) => {
      const keyValue = rowKey(serverRow);
      if (keyValue !== undefined && keyValue !== null) {
        serverKeySet.add(keyValue);
      }
      if (keyValue === undefined || keyValue === null) {
        return serverRow;
      }
      const prevRow = prevMap.get(keyValue);
      if (!prevRow) {
        return serverRow;
      }
      const mergedRow: HRCTableRow = { ...serverRow };
      Object.keys(prevRow).forEach((field) => {
        const shouldPreserve =
          preserveSet !== null ? preserveSet.has(field) : field.endsWith("_adjust");
        if (shouldPreserve) {
          mergedRow[field] = prevRow[field];
        }
      });
      return mergedRow;
    });

    // Giữ lại các dòng nhập tay (IsNM=false) từ prev không có trong server rows
    const manualRows = previousRows.filter((row) => {
      if (row.IsNM !== false) return false;
      const keyValue = row[keyField] as string | number | undefined;
      return keyValue === undefined || keyValue === null || !serverKeySet.has(keyValue);
    });

    return [...merged, ...manualRows];
  },

  applyManualOverrides(
    serverRows: HRCTableRow[] = [],
    previousRows: HRCTableRow[] = [],
    options?: {
      rowIdField?: string;
      fallbackKeyField?: string;
    }
  ): HRCTableRow[] {
    if (!previousRows.length || !serverRows.length) {
      return serverRows;
    }

    const rowIdField = options?.rowIdField ?? "id";
    const fallbackKeyField = options?.fallbackKeyField ?? "meThoi";

    const prevMap = new Map<string | number, HRCTableRow>();
    previousRows.forEach((row) => {
      const idVal = row[rowIdField] as string | number | undefined;
      const fallbackVal = row[fallbackKeyField] as string | number | undefined;
      const keyValue =
        idVal !== undefined && idVal !== null && idVal !== "" ? idVal : fallbackVal;
      if (keyValue !== undefined && keyValue !== null) {
        prevMap.set(keyValue, row);
      }
    });

    const MANUAL_SUFFIX = "__IsManual";
    const ORIG_SUFFIX = "__orig";

    return serverRows.map((serverRow) => {
      const idVal = serverRow[rowIdField] as string | number | undefined;
      const fallbackVal = serverRow[fallbackKeyField] as string | number | undefined;
      const keyValue =
        idVal !== undefined && idVal !== null && idVal !== "" ? idVal : fallbackVal;
      if (keyValue === undefined || keyValue === null) {
        const cleaned = { ...serverRow };
        delete (cleaned as Record<string, unknown>).__fromFilterAPI;
        return cleaned;
      }
      const prevRow = prevMap.get(keyValue);
      if (!prevRow) {
        const cleaned = { ...serverRow };
        delete (cleaned as Record<string, unknown>).__fromFilterAPI;
        return cleaned;
      }

      const merged: HRCTableRow = { ...serverRow };

      // Dòng nhập tay (IsNM=false) đến từ filter API: dữ liệu DB là nguồn sự thật.
      // Không cho JSON override ngược lại vì JSON có thể lưu sai (bug save).
      const isFilterAPIManualRow =
        merged.__fromFilterAPI === true && merged.IsNM === false;

      Object.keys(prevRow).forEach((k) => {
        if (!k.endsWith(MANUAL_SUFFIX)) return;
        if (prevRow[k] !== true) return;

        const baseKey = k.slice(0, -MANUAL_SUFFIX.length);
        const isManualCol = baseKey.startsWith("manual_col_");
        const serverAuto = (baseKey in merged) ? merged[baseKey] : undefined;
        const manualValue = prevRow[baseKey];
        const origKey = `${baseKey}${ORIG_SUFFIX}`;

        if (isManualCol) {
          // manual_col_*: luôn giữ manualValue, không dựa __orig/serverAuto
          merged[baseKey] = manualValue;
          merged[k] = String(manualValue ?? "").trim() !== "";
          return;
        }

        // Dòng IsNM=false từ filter API: giá trị filter là đúng, không override bằng JSON
        if (isFilterAPIManualRow && serverAuto !== null && serverAuto !== undefined) {
          if (merged[origKey] === undefined) merged[origKey] = serverAuto;
          merged[k] = true;
          return;
        }

        // Nếu API đã set __orig (= giá trị NM gốc thực sự), dùng nó làm baseline thay vì
        // merged[baseKey] (có thể đã là manualVal do fetchAndProcessPhuLieus set khi isManual=true).
        const existingOrig = (merged as Record<string, unknown>)[origKey] as
          | string | number | boolean | null | undefined;
        const serverAutoResolved = existingOrig !== undefined ? existingOrig : serverAuto;

        // Chỉ ghi __orig nếu API chưa set (không overwrite giá trị NM gốc chính xác).
        if (existingOrig === undefined && serverAuto !== undefined) {
          merged[origKey] = serverAuto;
        }

        const isStillManual = String(manualValue ?? "") !== String(serverAutoResolved ?? "");

        if (isStillManual) {
          merged[baseKey] = manualValue;
          merged[k] = true;
        } else {
          merged[k] = false;
        }
      });

      // Dọn marker nội bộ trước khi trả về
      delete (merged as Record<string, unknown>).__fromFilterAPI;

      return merged;
    });
  },

  buildColumnsWithAdjust({
    baseColumns,
    slotColumns = {},
    excludedAdjustKeys = DEFAULT_EXCLUDED_KEYS,
    adjustGroupTitle = "Điều chỉnh số liệu",
    showAdjustColumns = true,
    manualAdjustColumns,
    phanBoColumns,
    generateAdjustColumnsFromBase = true,
  }: {
    baseColumns: HRCParentColumn[];
    slotColumns?: Record<string, HRCChildColumn[] | undefined>;
    excludedAdjustKeys?: string[];
    adjustGroupTitle?: string;
    showAdjustColumns?: boolean;
    manualAdjustColumns?: HRCChildColumn[];
    phanBoColumns?: HRCChildColumn[];
    generateAdjustColumnsFromBase?: boolean;
  }): HRCParentColumn[] {
    const adjustChildColumns: HRCChildColumn[] = manualAdjustColumns
      ? [...manualAdjustColumns]
      : [];
    const excluded = new Set(excludedAdjustKeys);
    const shouldAutoGenerate = generateAdjustColumnsFromBase !== false;

    const processColumn = (col: HRCParentColumn): HRCParentColumn => {
      const dataIndex = col.dataIndex ?? "";
      const replacement = dataIndex ? slotColumns[dataIndex] : undefined;

      // Slot "dieuChinh" trong config: nơi render group điều chỉnh số liệu.
      // Nếu không có cột điều chỉnh thì ẩn hẳn slot này (không render cuối bảng).
      if (dataIndex === "dieuChinh") {
        if (!showAdjustColumns || adjustChildColumns.length === 0) {
          return { ...col, children: [] };
        }
        return {
          title: adjustGroupTitle,
          dataIndex: "dieuChinh",
          children: adjustChildColumns,
        };
      }

      // Cột slot động (vd BOF_PhuGia/LF_PhuGia): nếu là dataIndex có đăng ký slot nhưng không có
      // phụ liệu nào (vd Lò thổi 5 chưa có dữ liệu NM), ẩn hẳn cột thay vì render placeholder gốc
      // từ config JSON (cột đó không có tác dụng gì vì không map tới dữ liệu nào).
      if (dataIndex && dataIndex in slotColumns) {
        if (!replacement || replacement.length === 0) {
          return { ...col, children: [] };
        }
        return {
          ...col,
          children: replacement.map((child) =>
            shouldAutoGenerate
              ? mapChildWithAdjust(child, excluded, adjustChildColumns, showAdjustColumns)
              : { ...child, editable: false }
          ),
          // editable: false,
        };
      }

      if (col.children && col.children.length > 0) {
        return {
          ...col,
          children: col.children.map((child) =>
            shouldAutoGenerate
              ? mapChildWithAdjust(child, excluded, adjustChildColumns, showAdjustColumns)
              : { ...child, editable: false }
          ),
          // editable: false,
        };
      }

      if (col.dataIndex) {
        if (shouldAutoGenerate) {
          buildAdjustColumn(col, excluded, adjustChildColumns, showAdjustColumns);
        }
        return {
          ...col,
        };
      }

      return col;
    };

    const processedColumns = baseColumns
      .map(processColumn)
      .filter(
        (c) =>
          !(
            (c.dataIndex === "dieuChinh" || (c.dataIndex && c.dataIndex in slotColumns)) &&
            (!c.children || c.children.length === 0)
          )
      );

    // Append group "Phân bổ" riêng nếu có phanBoColumns
    if (phanBoColumns && phanBoColumns.length > 0) {
      processedColumns.push({
        title: "Phân bổ",
        dataIndex: "phanBoGroup",
        children: phanBoColumns,
      } as HRCParentColumn);
    }

    return processedColumns;
  },

  checkChotPhieuTieuHao: async (ngaySX: string, ca: number): Promise<boolean> => {
    const res = await PhieuApi.checkChotPhieuTieuHao(ngaySX, ca);
    return res.data === 2 ? true : false;
  },

  /**
   * Chặn "Chốt" phiếu Tiêu hao (BOF/LF) nếu "Thống kê" (phụ liệu thực tế + phân bổ) của bất kỳ phụ
   * liệu nào đang âm cho đúng công đoạn + Ngày/Ca của phiếu — xem cột Chênh lệch ở Sổ Xuất-Nhập-Tồn
   * (SummaryTableSTD_HRC1.tsx) giờ cho phép phân bổ ra số âm. Mirror hrc2TableService.
   */
  checkNoNegativeThongKe: async (
    ngaySX: string,
    ca: number,
    bieuMau: "BOF" | "LF"
  ): Promise<{ ok: boolean; negativePhuLieus: string[] }> => {
    const res = await STD_NXT_HRC1ServiceApi.checkNegativeThongKe({ NgaySX: ngaySX, Ca: ca, BieuMau: bieuMau });
    const negativePhuLieus = (res as any)?.data ?? [];
    return { ok: negativePhuLieus.length === 0, negativePhuLieus };
  },
};
