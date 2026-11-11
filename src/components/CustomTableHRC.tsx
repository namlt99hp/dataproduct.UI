import React, { useState, useEffect, useMemo, useCallback, useRef, forwardRef, useImperativeHandle } from "react";
import type { ReactNode } from "react";
import { Table, Input, Button, Space, Spin, message, Tooltip, Popconfirm } from "antd";
import type { ColumnsType } from "antd/es/table";
import { ArrowLeftOutlined, ArrowRightOutlined} from "@ant-design/icons";
import type { HeaderMappingRecord } from "./HeaderMapping";
import { dlnmHRC2Api } from "../services/DLNMHRC2Api";
import type { ChuyenMeThoiRequest } from "../models/DLMN_HRC2Model";
import dayjs from "dayjs";
import { formatByKind } from "../utils/formatters/numberFormat";
import { CommonAutocomplete, type AutocompleteSearchApi } from "./CommonAutocomplete";
import "../styles/customTableHrc.css";

/** Option cho autocomplete meThoi/macThep — value/label đều là chuỗi (không phải id như các autocomplete khác). */
export interface HRCTextAutocompleteOption {
  value: string;
  label: string;
}

type MappingPayload = HeaderMappingRecord;

export interface CustomTableHRCHandle {
  validate: () => boolean;
}

// ─── EditableCellInput ───────────────────────────────────────────────────────
// Component tách biệt để cô lập state nhập liệu, tránh parent re-render
// khi đang gõ dẫn đến mất con trỏ chuột.
// Giá trị chỉ sync lên parent khi blur (onCommit).
interface EditableCellInputProps {
  initialValue: string;
  onCommit: (value: string) => void;
  style?: React.CSSProperties;
  placeholder?: string;
}

type HRCRowWithManualFlags = HRCTableRow & Record<string, unknown>;

const EditableCellInput = ({ initialValue, onCommit, style, placeholder }: EditableCellInputProps) => {
  const [localValue, setLocalValue] = useState(initialValue);

  // Sync khi giá trị bên ngoài thay đổi (ví dụ: load dữ liệu mới, reset form)
  useEffect(() => {
    setLocalValue(initialValue);
  }, [initialValue]);

  return (
    <Input
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={() => onCommit(localValue)}
      onDoubleClick={(e) => {
        const target = e.target as HTMLInputElement;
        target.focus();
        target.select();
      }}
      style={style}
      placeholder={placeholder}
    />
  );
};
// ────────────────────────────────────────────────────────────────────────────

export interface HRCChildColumn {
  title: ReactNode;
  dataIndex: string;
  width?: number;
  placeholder?: string;
  highlight?: boolean;
  editable?: boolean;
  format?: string; // ví dụ: "number-group"
  align?: "left" | "center" | "right";
  metaLabel?: string;
  metaGroup?: string;
  allowMapping?: boolean;
  mappingPayload?: MappingPayload | null;
  variant?: "source" | "adjust" | "default";
  headerKeyId?: number | null;
  thuTu?: number | null; // Thứ tự để sắp xếp
  sum?: boolean; // true: tính tổng cột này trong dòng summary
  readonly?: boolean; // true: không cho sửa, bất kể editable của bảng
  // true: khoá cứng, không cho sửa dù dòng là IsNM=false (isManualRow) — khác `readonly` (vốn vẫn
  // cho sửa ở dòng thêm tay/manual). Dùng cho các cột như meThoi/macThep ở LF, nơi MỌI dòng đều bị
  // ép IsNM=false nên `readonly` thường bị "mở khoá" nhầm bởi điều kiện isManualRow.
  alwaysReadonly?: boolean;
  // true: cột "không phải phụ liệu" (không có __orig/__IsManual per-cell) nhưng BE có lưu cờ
  // Hrc1TieuHao.IsEdited ở cấp dòng khi field này thực sự đổi giá trị lúc Lưu — bật cờ này để ô được
  // tô vàng "đã chỉnh sửa" theo record.IsEdited, thay vì so __orig (vốn không tồn tại cho các cột này).
  trackRowEdited?: boolean;
}

export interface HRCParentColumn {
  title: string;
  dataIndex?: string;
  isLabel?: boolean;
  width?: number;
  children?: HRCChildColumn[];
  editable?: boolean;
  highlight?: boolean;
  format?: string; // ví dụ: "number-group"
  align?: "left" | "center" | "right";
  metaLabel?: string;
  allowMapping?: boolean;
  mappingPayload?: MappingPayload | null;
  variant?: "source" | "adjust" | "default";
  sum?: boolean; // true: tính tổng cột này trong dòng summary
  readonly?: boolean; // true: không cho sửa, bất kể editable của bảng
  alwaysReadonly?: boolean; // xem giải thích ở HRCChildColumn
  trackRowEdited?: boolean; // xem giải thích ở HRCChildColumn
}

export interface HRCTableRow {
  key: string | number;
  IsNM?: boolean; // Flag để đánh dấu dòng từ NM (true) hay thêm tay (false)
  _isNewRow?: boolean; // Flag UI: dòng thêm mới bằng button (highlight cả hàng + xếp cuối)
  id?: number; // ID bản ghi DLNM_HRC2 (nếu có)
  isTrungMeThoi?: boolean; // Flag để đánh dấu mẻ thổi bị trùng
  // Cờ BE Hrc1TieuHao.IsEdited — true nếu dòng đã từng bị sửa tay ở 1 trong các cột "không phải phụ
  // liệu" (o2/n2/ar/queLayMau/queDoNhiet/ghiChu...), dùng để tô vàng lại các ô đó sau khi Lưu + tải lại
  // (khác cột phụ liệu vốn tự có __orig/__IsManual theo từng ô). Xem HRC1_BB_TieuHao_*.json:
  // trackRowEdited đánh dấu cột nào tham gia cờ này.
  IsEdited?: boolean;
  // Cho phép null để biểu diễn các trường FE cần gửi lên BE (vd __orig khi nền tự động = null).
  [key: string]: string | number | boolean | null | undefined;
}

interface CustomTableHRCProps {
  isHasExistingPhieu?: boolean;
  columns: HRCParentColumn[];
  initialData?: HRCTableRow[];
  onDataChange?: (data: HRCTableRow[]) => void;
  className?: string;
  addRowButtonText?: string;
  showAddButton?: boolean;
  showDeleteButton?: boolean;
  minRows?: number;
  editable?: boolean;
  loading?: boolean;
  // onRefresh?: () => void; // hiện tại không dùng
  scrollX?: number | string;
  scrollY?: number;
  stickyHeaders?: boolean;
  stickyFirstColumn?: boolean;
  stickyColumnKeys?: string[];
  /** Tắt hiệu ứng hover đổi màu dòng — dùng khi màu hover mặc định đè lên các màu highlight riêng của ô/dòng. */
  disableRowHover?: boolean;
  /**
   * true: sắp xếp toàn bộ dòng theo meThoi tăng dần (không phân biệt NM/thêm tay) — dùng cho các trang
   * HRC1 Tiêu hao BOF/LF nơi mẻ thêm tay có thể xen giữa các mẻ NM theo đúng thứ tự mẻ thổi.
   * false (mặc định, giữ hành vi cũ cho HRC2): nhóm dòng thêm tay (IsNM===false) xuống cuối, không
   * sắp xếp theo giá trị để tránh dòng NM nhảy vị trí khi đang sửa ô.
   */
  sortByMeThoi?: boolean;
  /**
   * true: cho phép sửa cột macThep kể cả trên dòng từ NM (IsNM===true) — mặc định các dòng NM luôn
   * khoá cứng meThoi/macThep (xem isMeThoiColumn/isMacThepColumn bên dưới). Không ảnh hưởng meThoi
   * (vẫn luôn khoá — đó là khoá dùng để match dữ liệu giữa các lần tải).
   */
  allowEditMacThepOnNMRow?: boolean;
  /**
   * API tìm kiếm autocomplete cho ô meThoi trên dòng thêm tay (IsNM===false). Chưa truyền (mặc định
   * undefined) → vẫn dùng ô nhập tay thường như hiện tại, không đổi hành vi các trang chưa cần.
   */
  meThoiSearchApi?: AutocompleteSearchApi<HRCTextAutocompleteOption>;
  /** API tìm kiếm autocomplete cho ô macThep trên dòng thêm tay (IsNM===false) — cùng cơ chế với meThoiSearchApi. */
  macThepSearchApi?: AutocompleteSearchApi<HRCTextAutocompleteOption>;
  /**
   * false: bỏ bắt buộc Mẻ thổi + Mác thép khi validate() (mặc định true — giữ hành vi cũ, bắt buộc cho
   * mọi trang có meThoiSearchApi, vd BOF TaoTieuHaoLoThoi.tsx). Dùng khi 1 trang cụ thể (vd LF
   * TaoTieuHaoTinhLuyenLF.tsx) muốn cho lưu thoải mái mà không ràng buộc 2 cột này.
   */
  requireMeThoiMacThep?: boolean;
  maBm?: string;
  ngaySX?: Date;
  ca?: number;
  scope?: number;
  bieuMau?: string;
  lyDoLabel?: string;       // Nếu có → render textbox lý do bên dưới bảng
  lyDoValue?: string;
  onLyDoChange?: (value: string) => void;
  onSave?: () => Promise<void>;
  /** API xóa dòng — mặc định dùng dlnmHRC2Api (giữ hành vi cũ cho các trang HRC2 chưa truyền prop này). */
  deleteApi?: {
    deleteRowByKey: (rowKey: number) => Promise<unknown>;
    deleteRowNM: (rowKey: number) => Promise<unknown>;
  };
  /** API chuyển mẻ sang ca khác — mặc định dùng dlnmHRC2Api (giữ hành vi cũ cho các trang HRC2 chưa truyền prop này). */
  chuyenMeThoiApi?: {
    chuyenMeThoi: (payload: ChuyenMeThoiRequest) => Promise<{ data: { message?: string } }>;
  };
}

const CHUYEN_TOI_CA = {
  CATRUOC: 1,
  CASAU: 2,
};

/** Cột số thứ tự từ JSON (thường là cột đầu) — không dùng làm cột ghi nhãn "Tổng" ở summary */
const isSttDataIndex = (dataIndex: string) =>
  dataIndex === "stt" || dataIndex === "STT";

/** Cột dạng text (định danh/ghi chú, không phải số liệu) — loại khỏi kiểm tra giá trị âm (tránh báo
 * nhầm, vd meThoi/macThep có thể bắt đầu bằng ký tự trông giống dấu trừ khi parseFloat) VÀ khỏi chuẩn
 * hoá dấu thập phân "," -> "." ở applyAndEmitCellChange (ghiChu là ghi chú tự do, có thể chứa dấu phẩy
 * thật trong câu — không phải số). Mọi cột số liệu còn lại (kể cả KLThepLong, KLGangLongCCT, KLThepPhe,
 * KLThepPheGang, O2, N2, AR, ...) đều bị kiểm tra/chuẩn hoá.
 */
const isTextDataIndex = (dataIndex: string) =>
  isSttDataIndex(dataIndex) || dataIndex === "meThoi" || dataIndex === "macThep" || dataIndex === "ghiChu";

/**
 * Sort theo meThoi tăng dần (numeric-aware) — chỉ dùng để sắp lại đúng thứ tự MỘT LẦN khi nhận
 * initialData mới từ ngoài (API/DB, sau khi Lưu + tải lại), KHÔNG dùng cho sortedRows (mỗi lần rows
 * đổi do gõ/chọn ô) — nếu không, dòng đang thao tác sẽ nhảy vị trí ngay khi giá trị meThoi thay đổi,
 * gây khó chịu vì người dùng không biết nó nhảy đi đâu. Xem useEffect sync initialData bên dưới.
 */
const sortRowsByMeThoi = (rows: HRCTableRow[]): HRCTableRow[] => {
  return [...rows].sort((a, b) => {
    const rawA = a.meThoi;
    const rawB = b.meThoi;
    const sa = rawA === undefined || rawA === null || rawA === "" ? null : String(rawA);
    const sb = rawB === undefined || rawB === null || rawB === "" ? null : String(rawB);
    if (sa === null && sb === null) return 0;
    if (sa === null) return 1;
    if (sb === null) return -1;
    return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: "base" });
  });
};

/** STT luôn theo thứ tự dòng đang hiển thị (sortedRows), 1…n — không đọc từ record/response */
const resolveSttText = (rows: HRCTableRow[], record: HRCTableRow): string => {
  const i = rows.findIndex((r) => r.key === record.key);
  return i >= 0 ? String(i + 1) : "";
};

/** Chuẩn hoá số nhập tay về 1 kiểu duy nhất (dấu chấm thập phân) — người dùng có thể gõ "12.23" hoặc
 * "12,23" tuỳ thói quen (VN dùng dấu phẩy, số khác dùng dấu chấm). App không dùng "."/"," để nhóm
 * hàng nghìn ở đâu cả (hiển thị nhóm bằng khoảng trắng, xem formatSum) nên chỉ 1 dấu xuất hiện luôn
 * được hiểu là dấu thập phân. Nếu cả 2 cùng xuất hiện (paste từ nguồn khác, vd "1.234,56" hoặc
 * "1,234.56"), dấu đứng SAU CÙNG là thập phân, dấu còn lại là phân tách hàng nghìn nên bị loại bỏ. */
const normalizeDecimalInput = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  const lastComma = trimmed.lastIndexOf(",");
  const lastDot = trimmed.lastIndexOf(".");
  if (lastComma === -1 && lastDot === -1) return trimmed;
  if (lastComma !== -1 && lastDot !== -1) {
    return lastComma > lastDot
      ? trimmed.replace(/\./g, "").replace(",", ".")
      : trimmed.replace(/,/g, "");
  }
  if (lastComma !== -1) return trimmed.replace(",", ".");
  return trimmed;
};

const isNegativeValue = (value: unknown): boolean => {
  if (value === null || value === undefined || value === "") return false;
  const num = parseFloat(normalizeDecimalInput(String(value)).replace(/\s/g, ""));
  return !isNaN(num) && num < 0;
};

/** Format giá trị tổng: chẵn thì không có thập phân, lẻ thì fixed 2 chữ số. */
const formatSum = (value: number): string => {
  const rounded = Math.round(value * 100) / 100;
  const sign = rounded < 0 ? "-" : "";
  const abs = Math.abs(rounded);
  const isInteger = Number.isInteger(abs);
  const [intRaw, fracRaw] = (isInteger ? abs.toFixed(0) : abs.toFixed(2)).split(".");
  const intFormatted = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return isInteger ? `${sign}${intFormatted}` : `${sign}${intFormatted}.${fracRaw}`;
};

const getAllFieldKeys = (cols: HRCParentColumn[]): string[] => {
  const keys: string[] = [];
  cols.forEach((col) => {
    if (col.dataIndex) {
      keys.push(col.dataIndex);
    }
    if (col.children) {
      col.children.forEach((child) => {
        if (child.dataIndex) {
          keys.push(child.dataIndex);
        }
      });
    }
  });
  return keys;
};

const CustomTableHRC = forwardRef(({
  isHasExistingPhieu = false,
  columns,
  initialData = [{ key: "1" } as HRCTableRow],
  onDataChange,
  className = "",
  addRowButtonText = "+ Thêm dòng",
  showAddButton = true,
  showDeleteButton = true,
  minRows = 1,
  editable = true,
  loading = false,
  // onRefresh,
  scrollX = "max-content",
  scrollY,
  stickyHeaders = true,
  stickyFirstColumn = false,
  stickyColumnKeys = [],
  disableRowHover = false,
  sortByMeThoi = false,
  allowEditMacThepOnNMRow = false,
  meThoiSearchApi,
  macThepSearchApi,
  requireMeThoiMacThep = true,
  maBm = "",
  ngaySX = new Date(),
  ca = 0,
  scope = 0,
  bieuMau = "",
  lyDoLabel,
  lyDoValue = "",
  onLyDoChange,
  onSave,
  deleteApi = dlnmHRC2Api,
  chuyenMeThoiApi = dlnmHRC2Api,
}: CustomTableHRCProps, ref: React.ForwardedRef<CustomTableHRCHandle>) => {
  const [rows, setRows] = useState<HRCTableRow[]>(initialData as HRCTableRow[]);
  const rowsRef = useRef<HRCTableRow[]>(rows);
  // Đánh dấu mảng vừa emit ra ngoài qua onDataChange (xem emitDataChange bên dưới) — dùng để nhận
  // biết initialData mới nhận được chỉ là "tiếng vọng" của chính thay đổi cục bộ vừa gửi lên (parent
  // set state bằng đúng reference này rồi truyền lại làm initialData), KHÔNG phải dữ liệu mới thật sự
  // từ API/DB. Xem useEffect sync initialData bên dưới.
  const lastEmittedDataRef = useRef<HRCTableRow[] | null>(null);

  // Tính toán chiều cao cho 10 dòng dữ liệu
  // Row height (size="small"): ~32px, Header: ~40px
  // 10 rows = 10 * 32 = 320px + header = ~360px
  const defaultScrollY = scrollY ?? 750;

  const [lyDoError, setLyDoError] = useState(false);

  // Kiểm tra có ô nào bị chỉnh sửa (tô vàng) không
  const hasCellChanges = useMemo(() => {
    return rows.some((row) =>
      Object.keys(row).some((key) => {
        if (key.endsWith("__IsManual")) return row[key] === true;
        if (key.endsWith("__orig")) {
          const dataIndex = key.slice(0, -6); // bỏ "__orig"
          return String(row[dataIndex] ?? "") !== String(row[key] ?? "");
        }
        return false;
      })
    );
  }, [rows]);

  useImperativeHandle(ref, () => ({
    validate: () => {
      const numericKeys = getAllFieldKeys(columns).filter((key) => !isTextDataIndex(key));
      const hasNegative = rows.some((row) =>
        numericKeys.some((key) => isNegativeValue(row[key]))
      );
      if (hasNegative) {
        message.error("Các cột số liệu không được nhập giá trị âm");
        return false;
      }
      if (lyDoLabel && hasCellChanges && !lyDoValue?.trim()) {
        message.error(`Vui lòng nhập "${lyDoLabel}" vì có dữ liệu đã bị chỉnh sửa`);
        setLyDoError(true);
        return false;
      }
      // Mọi dòng (kể cả IsNM === true từ NM, không chỉ dòng thêm tay) trên các trang có meThoiSearchApi
      // (BOF/LF tiêu hao) đều bắt buộc có Mẻ thổi + Mác thép — thiếu 1 trong 2 thì BE không match được
      // dữ liệu ở lượt lưu sau. requireMeThoiMacThep=false (vd LF) bỏ qua check này.
      if (meThoiSearchApi && requireMeThoiMacThep) {
        const hasInvalidRow = rows.some(
          (row) => !String(row.meThoi ?? "").trim() || !String(row.macThep ?? "").trim()
        );
        if (hasInvalidRow) {
          message.error("Vui lòng chọn Mẻ thổi và Mác thép cho tất cả các dòng trước khi lưu");
          return false;
        }
      }
      setLyDoError(false);
      return true;
    },
  }), [lyDoLabel, hasCellChanges, lyDoValue, rows, columns, meThoiSearchApi, requireMeThoiMacThep]);

  useEffect(() => {
    if (initialData) {
      // sortByMeThoi: chỉ sort khi initialData thực sự là dữ liệu MỚI từ ngoài (API/DB, sau khi Lưu +
      // tải lại) — nếu initialData chính là mảng vừa emit ra (parent set state bằng đúng reference đó
      // rồi truyền lại), đây chỉ là "tiếng vọng" của thao tác đang gõ/chọn ô, KHÔNG sort lại (nếu
      // không, dòng đang thao tác sẽ tự nhảy vị trí ngay khi giá trị meThoi vừa đổi).
      const isEchoOfOwnEmit = initialData === lastEmittedDataRef.current;
      setRows(sortByMeThoi && !isEchoOfOwnEmit ? sortRowsByMeThoi(initialData) : initialData);
    }
  }, [initialData, sortByMeThoi]);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  // Helper: emit thay đổi ra ngoài (được gọi từ các event handler / onBlur)
  const emitDataChange = useCallback(
    (data: HRCTableRow[]) => {
      lastEmittedDataRef.current = data;
      if (!onDataChange) return;
      onDataChange(data);
    },
    [onDataChange]
  );

  // Sắp xếp hiển thị: mặc định nhóm dòng nhập tay (IsNM === false) xuống cuối (không di chuyển dòng
  // NM khi đang sửa ô). Khi sortByMeThoi=true (HRC1 Tiêu hao BOF/LF): rows đã được sort đúng thứ tự
  // meThoi ngay khi nhận initialData mới (xem useEffect ở trên) — ở đây KHÔNG sort lại theo giá trị
  // nữa, chỉ trả nguyên rows, để dòng đang thao tác (vừa thêm/chọn meThoi) không tự nhảy vị trí giữa
  // chừng; thứ tự chỉ được áp dụng lại sau khi Lưu + tải lại dữ liệu từ server.
  // const buildMeSortKey = (
  //     thoiGian: string | null | undefined,
  //     ca: number | null | undefined,
  //     ngaySX: string | null | undefined,
  //   ): string => {
  //     if (!thoiGian) return "9999-12-31 99:99";
  //     const base = ngaySX ?? "2000-01-01";
  //     const isNextDay = ca === 2 && thoiGian < "20:00";
  //     const date = isNextDay ? dayjs(base).add(1, "day").format("YYYY-MM-DD") : base;
  //     return `${date} ${thoiGian}`;
  //   };

  const buildMeSortKey = (
  thoiGian: string | null | undefined,
  ca: number | null | undefined,
  ngaySX: Date | null | undefined,
): string => {
  if (!thoiGian || !ngaySX) {
    return "9999-12-31 99:99";
  }

  const isNextDay =
    ca === 2 && thoiGian < "20:00";

  const date = isNextDay
    ? dayjs(ngaySX).add(1, "day").format("YYYY-MM-DD")
    : dayjs(ngaySX).format("YYYY-MM-DD");

  return `${date} ${thoiGian}`;
};
 
  // const sortedRows = useMemo(() => {
  //   console.log('sortedRows useMemo called');
  //   if (sortByMeThoi) {
  //     console.log('sortByMeThoi is true');
  //     return rows;
  //   }
  //   if(maBm === "HRC1_BB_TieuHao_LF"){
  //     console.log('LF');
  //     return [...rows].sort((a, b) => buildMeSortKey(a.thoiGianLF as string, ca, ngaySX)
  //         .localeCompare(buildMeSortKey(b.thoiGianLF as string, ca, ngaySX)));
  //   }
  //   console.log('khac');
  //   const cloned = [...rows];
  //   cloned.sort((a, b) => {
  //     const aManual = a.IsNM === false;
  //     const bManual = b.IsNM === false;
  //     if (aManual === bManual) return 0;
  //     return aManual ? 1 : -1;
  //   });
  //   return cloned;
  // }, [rows, sortByMeThoi, maBm]);
  const sortedRows = useMemo(() => {
    if (sortByMeThoi) {
      return rows;
    }

    if (maBm === "HRC1_BB_TieuHao_LF") {
      return [...rows].sort((a, b) =>
        buildMeSortKey(a.thoiGianLF as string, ca, ngaySX).localeCompare(
          buildMeSortKey(b.thoiGianLF as string, ca, ngaySX)
        )
      );
    }

    const cloned = [...rows];
    cloned.sort((a, b) => {
      const aManual = a.IsNM === false;
      const bManual = b.IsNM === false;
      if (aManual === bManual) return 0;
      return aManual ? 1 : -1;
    });
    return cloned;
  }, [rows, sortByMeThoi, maBm, ca, ngaySX]);

  const handleAddRow = () => {
    const fieldKeys = getAllFieldKeys(columns);
    const newRow: HRCTableRow = {
      key: Date.now().toString(),
      IsNM: false,      // Đánh dấu cho BE: dòng nhập tay
      _isNewRow: true,  // Đánh dấu cho UI: dòng thêm mới bằng button (highlight cả hàng + xếp cuối)
    };
    fieldKeys
      .filter((key) => !isSttDataIndex(key))
      .forEach((key) => {
        newRow[key] = "";
      });
    const newRows = [...rows, newRow];
    setRows(newRows);
    emitDataChange(newRows);
  };

  // const handleDeleteRow = (key: string | number) => {
  //   if (rows.length <= minRows) return;
  //   const newRows = rows.filter((row) => row.key !== key);
  //   setRows(newRows);
  //   onDataChange?.(newRows);
  // };

  const handleChuyenMeThoi = async (chuyenToiCa: number, meThoi: string) => {
    if (!meThoi) return;
    try {
      const payload : ChuyenMeThoiRequest = {
        MaBM: maBm,
        NgaySX: dayjs(ngaySX).format("YYYY-MM-DD"),
        Ca: ca,
        Scope: scope,
        ChuyenToiCa: chuyenToiCa,
        MeThoi: meThoi,
        BieuMau: bieuMau,
      };
      const response = await chuyenMeThoiApi.chuyenMeThoi(payload);
      if(response.data.message){
        message.success(response.data.message);
        // Sau khi chuyển mẻ thành công, xóa luôn dòng tương ứng trong bảng
        const newRows = rows.filter((row) => row.meThoi !== meThoi);
        setRows(newRows);
        emitDataChange(newRows);
      }
    } catch (error: unknown) {
      console.error(error);
      const errMsg =
        typeof error === "object" &&
        error !== null &&
        "data" in error &&
        (error as { data?: { message?: string } }).data?.message
          ? (error as { data?: { message?: string } }).data!.message!
          : "Có lỗi xảy ra khi chuyển mẻ";
      message.error(errMsg);
    }
  };

  const handleDeleteRow = async (record: HRCTableRow) => {
    if (record.IsNM === true && lyDoLabel && !lyDoValue?.trim()) {
      message.error(`Vui lòng nhập "${lyDoLabel}" trước khi xóa dòng từ NM`);
      setLyDoError(true);
      return;
    }

    const id = record.id;
    if (typeof id === "number") {
      try {
        if(record.IsNM === false){
          await deleteApi.deleteRowByKey(id);
        }
        else{
          await deleteApi.deleteRowNM(id);
        }
        message.success("Xóa dòng thành công");
        setRows((prev) => {
          const newRows = prev.filter((row) => row.key !== record.key);
          emitDataChange(newRows);
          return newRows;
        });
        await onSave?.();
        return;
      } catch (error: any) {
        // 404 = dòng đã bị xóa từ nơi khác trước đó (vd HRC1 LF: mẻ TL hủy nhận đã tự xóa dòng
        // tiêu hao liên kết) — kết quả mong muốn (dòng biến mất) đã đúng, không nên báo lỗi.
        if (error?.status === 404 || error?.response?.status === 404) {
          message.info("Dòng này đã bị xóa từ trước, đang cập nhật lại bảng.");
          setRows((prev) => {
            const newRows = prev.filter((row) => row.key !== record.key);
            emitDataChange(newRows);
            return newRows;
          });
          return;
        }
        message.error("Không thể xóa dòng trên server");
        return;
      }
    }

    setRows((prev) => {
      const newRows = prev.filter((row) => row.key !== record.key);
      emitDataChange(newRows);
      return newRows;
    });
  };

  // Áp dụng thay đổi cell và emit ra ngoài - chỉ gọi khi blur (từ EditableCellInput.onCommit)
  const applyAndEmitCellChange = useCallback(
    (rawValue: string, rowKey: string | number, dataIndex: string) => {
      // Chuẩn hoá "12,23"/"12.23" về cùng 1 kiểu (dấu chấm) ngay khi chốt giá trị (blur) — giá trị lưu
      // vào state từ đây trở đi luôn sạch, nên tổng cột/kiểm tra âm/payload Lưu không cần tự xử lý lại.
      const value = isTextDataIndex(dataIndex) ? rawValue : normalizeDecimalInput(rawValue);
      const origKey = `${dataIndex}__orig`;
      const manualKey = `${dataIndex}__IsManual`;
      const newData = rowsRef.current.map((row) => {
        if (row.key !== rowKey) return row;
        const isManualAddedColumn = dataIndex.startsWith("manual_col_");
        const hasOrig = row[origKey] !== undefined;
        const prevValue = row[dataIndex];
        // Nếu FE chưa có __orig thì baseline của "tự động" chính là value hiện tại trên row (trước khi user sửa).
        // Nếu value hiện tại rỗng/không có => baseline = null.
        const prevValueNormalized =
          prevValue === "" || prevValue === null || prevValue === undefined ? null : prevValue;

        const rawOrigValue = hasOrig ? row[origKey] : undefined;
        const origValueForComparison = hasOrig
          ? rawOrigValue === ""
            ? null
            : rawOrigValue
          : prevValueNormalized;

        // manual_col_*: không tạo/gửi __orig. Giá trị nhập luôn được hiểu là manual.
        const next: HRCTableRow = isManualAddedColumn
          ? {
              ...row,
              [dataIndex]: value,
            }
          : {
              ...row,
              // Nếu __orig đang thiếu => tạo __orig theo đúng baseline hiện tại (không ép sang null nếu baseline có giá trị).
              ...(!hasOrig ? { [origKey]: prevValueNormalized } : null),
              [dataIndex]: value,
            };

        // IsNM = false chỉ cho dòng thêm bằng tay (Thêm dòng). Sửa ô phụ liệu trên dòng từ NM (IsNM = true) không đổi IsNM.
        // Set cờ __IsManual theo từng ô (không dùng IsManual ở cấp dòng) cho MỌI cột chỉnh sửa được
        // (phụ liệu, klThepPhe, klGangLong trên dòng thêm tay, ...). mergeServerRows chỉ preserve
        // đúng field gốc (không kèm __orig) khi merge lại dữ liệu NM, nên nếu không set __IsManual thì
        // applyManualOverrides sẽ không khôi phục lại __orig → mất highlight "giá trị cũ/mới" sau khi
        // lưu và reload, dù giá trị đã lưu đúng.
        if (isManualAddedColumn) {
          // manual_col_*: có giá trị thì coi là manual
          (next as HRCRowWithManualFlags)[manualKey] = String(value ?? "").trim() !== "";
        } else {
          const isManualCell = String(value ?? "") !== String(origValueForComparison ?? "");
          (next as HRCRowWithManualFlags)[manualKey] = isManualCell;
        }
        return next;
      });
      setRows(newData);
      emitDataChange(newData);
    },
    [emitDataChange]
  );

  const stickyKeysSet = useMemo(() => new Set(stickyColumnKeys), [stickyColumnKeys]);

  // Flatten tất cả leaf columns (kể cả children) theo đúng thứ tự render
  const leafColumns = useMemo(() => {
    const result: Array<{ dataIndex: string; sum?: boolean; align?: string; format?: string }> = [];
    columns.forEach((col) => {
      if (col.children) {
        col.children.forEach((child) => {
          result.push({ dataIndex: child.dataIndex, sum: child.sum, align: child.align, format: child.format });
        });
      } else if (col.dataIndex) {
        result.push({ dataIndex: col.dataIndex, sum: col.sum, align: col.align, format: col.format });
      }
    });
    return result;
  }, [columns]);

  /** Cột lá đầu tiên không phải STT — chỗ hiển thị "Tổng" (tránh chồng lên cột stt khi stt là cột đầu) */
  const summaryTongLabelIndex = useMemo(() => {
    const i = leafColumns.findIndex((c) => !isSttDataIndex(c.dataIndex));
    return i < 0 ? 0 : i;
  }, [leafColumns]);

  // Tính tổng các cột có sum=true
  const columnSums = useMemo(() => {
    const sums: Record<string, number> = {};
    leafColumns.forEach(({ dataIndex, sum }) => {
      if (!sum || isSttDataIndex(dataIndex)) return;
      sums[dataIndex] = sortedRows.reduce((acc, row) => {
        const val = parseFloat(normalizeDecimalInput(String(row[dataIndex] ?? "")));
        return acc + (isNaN(val) ? 0 : val);
      }, 0);
    });
    return sums;
  }, [leafColumns, sortedRows]);

  const tableColumns: ColumnsType<HRCTableRow> = [
    ...columns.map((col, colIndex) => {
      const baseTitle = col.title;
      const isStickyKey =
        !!col.dataIndex && stickyColumnKeys?.length
          ? stickyKeysSet.has(col.dataIndex)
          : false;
      const shouldStickyFirst =
        stickyFirstColumn && colIndex === 0 && !col.dataIndex;
      const baseFixed =
        stickyHeaders || stickyFirstColumn || stickyColumnKeys.length
          ? (isStickyKey || shouldStickyFirst ? ("left" as const) : undefined)
          : undefined;

      if (col.children) {
        let hasStickyChild = false;
        return {
          title: baseTitle,
          width: col.width,
          children: col.children.map((child) => {
            // bỏ logic disable theo config, chỉ giữ variant="adjust" là read-only
            const childSticky =
              (child.dataIndex && stickyKeysSet.has(child.dataIndex)) ||
              shouldStickyFirst;
            if (childSticky) {
              hasStickyChild = true;
            }

            return {
              title: child.title,
              dataIndex: child.dataIndex,
              width: child.width,
              align: child.align,
              fixed: childSticky ? ("left" as const) : undefined,
              render: (_: unknown, record: HRCTableRow) => {
                if (isSttDataIndex(child.dataIndex)) {
                  const text = resolveSttText(sortedRows, record);
                  return (
                    <Input
                      value={text}
                      readOnly
                      tabIndex={-1}
                      style={{
                        textAlign: child.align ?? "center",
                        backgroundColor: "#f5f5f5",
                        cursor: "default",
                      }}
                    />
                  );
                }
                // ⚠️ Cột phân bổ (variant="adjust") luôn read-only, không cho phép chỉnh sửa thủ công
                const isAdjustColumn = child.variant === "adjust";
                const isMeThoiColumn = child.dataIndex === "meThoi";
                const isMacThepColumn = child.dataIndex === "macThep";
                // Dòng từ NM (IsNM !== false): disable meThoi (mã mẻ khớp dữ liệu NM, không cho sửa
                // tay); macThep vẫn cho sửa vì NM có thể gán sai mác thép cần chỉnh lại thủ công.
                // Dòng thêm mới bằng button (IsNM === false): cho nhập tất cả các cột.
                const isNMRow = record.IsNM !== false;
                const isManualRow = !isNMRow;
                const macThepLocked = isMacThepColumn && !allowEditMacThepOnNMRow;
                const canEditThisCell =
                  !isAdjustColumn &&
                  !child.alwaysReadonly &&
                  (!child.readonly || isManualRow) &&
                  editable &&
                  (!isNMRow || (!isMeThoiColumn && !macThepLocked));

                const origKey = `${child.dataIndex}__orig`;
                const manualKey = `${child.dataIndex}__IsManual`;
                const origValue = record[origKey];
                const currentValue = record[child.dataIndex];
                const isManualFlag = (record as HRCRowWithManualFlags)[manualKey] === true;
                const isPerCellDiff =
                  isManualFlag ||
                  (origValue !== undefined && String(currentValue ?? "") !== String(origValue ?? ""));
                // Cột không có __orig per-cell (không phải phụ liệu) — dùng cờ IsEdited cấp dòng do BE
                // lưu lại (record.IsEdited) để highlight vẫn còn sau khi Lưu + tải lại dữ liệu.
                const isRowEditedCell = child.trackRowEdited === true && record.IsEdited === true;
                const isCellChanged = isPerCellDiff || isRowEditedCell;

                const cellValue = record[child.dataIndex];
                const displayValue = !canEditThisCell
                  ? formatByKind(child.format, cellValue)
                  : cellValue !== undefined && cellValue !== null
                    ? String(cellValue)
                    : "";
                const isTrungMeThoi =
                  record.isTrungMeThoi === true ||
                  (record as Record<string, unknown>).IsTrungMeThoi === true;
                const isNegative = !isTextDataIndex(child.dataIndex) && isNegativeValue(currentValue);

                const tooltipTitle = isNegative
                  ? "Không được âm"
                  : isPerCellDiff
                    ? `Tự động: ${origValue === null ? "0" : String(origValue ?? "")} | Chỉnh sửa: ${String(currentValue ?? "")}`
                    : isRowEditedCell
                      ? "Đã chỉnh sửa thủ công"
                      : undefined;

                const isKeyColumn = isMeThoiColumn || isMacThepColumn;

                // Style chung cho ô editable (highlight vàng sau khi blur)
                const editableStyle: React.CSSProperties = {
                  textAlign: child.align ?? "right",
                  width: "100%",
                  ...(isKeyColumn && record.IsNM === false ? { backgroundColor: "#fffbe6" } : {}),
                  ...(!(isMeThoiColumn && isTrungMeThoi) && child.highlight
                    ? { backgroundColor: "#fff1f0" }
                    : {}),
                  ...(isMeThoiColumn && isTrungMeThoi ? { backgroundColor: "tomato" } : {}),
                  ...(!(isMeThoiColumn && isTrungMeThoi) && isCellChanged
                    ? { backgroundColor: "#fff7b3" }
                    : {}),
                  ...(isNegative ? { backgroundColor: "tomato" } : {}),
                };

                const activeTextAutocompleteApi = isManualRow
                  ? isMeThoiColumn
                    ? meThoiSearchApi
                    : isMacThepColumn
                      ? macThepSearchApi
                      : undefined
                  : undefined;

                const inputNode = canEditThisCell && activeTextAutocompleteApi ? (
                  <CommonAutocomplete<HRCTextAutocompleteOption>
                    value={cellValue !== undefined && cellValue !== null && cellValue !== "" ? String(cellValue) : null}
                    onChange={(v) => applyAndEmitCellChange(v !== null ? String(v) : "", record.key, child.dataIndex)}
                    searchApi={activeTextAutocompleteApi}
                    mapOption={(item) => ({ value: item.value, label: item.label })}
                    fallbackLabelBuilder={(v) => String(v)}
                    size="small"
                    allowClear={false}
                    style={editableStyle}
                    selectProps={{
                      className: [
                        "hrc-select-key-column",
                        isMeThoiColumn && isTrungMeThoi ? "hrc-select-trung-me-thoi" : "",
                      ].filter(Boolean).join(" "),
                    }}
                    placeholder={
                      child.placeholder ??
                      (typeof child.title === "string" ? child.title : undefined)
                    }
                  />
                ) : canEditThisCell ? (
                  <EditableCellInput
                    initialValue={displayValue}
                    onCommit={(v) => applyAndEmitCellChange(v, record.key, child.dataIndex)}
                    style={editableStyle}
                    placeholder={
                      child.placeholder ??
                      (typeof child.title === "string" ? child.title : undefined)
                    }
                  />
                ) : (
                  <Input
                    value={displayValue}
                    readOnly
                    disabled={isAdjustColumn}
                    style={{
                      textAlign: child.align ?? "right",
                      backgroundColor:
                        isMeThoiColumn && isTrungMeThoi
                          ? "tomato"
                          : (isCellChanged ? "#fff7b3" : "#f5f5f5"),
                      cursor: "not-allowed",
                    }}
                  />
                );

                return tooltipTitle ? (
                  <Tooltip title={tooltipTitle}>
                    <span style={{ display: "block" }}>{inputNode}</span>
                  </Tooltip>
                ) : (
                  inputNode
                );
              },
            };
          }),
          fixed: baseFixed || (hasStickyChild ? ("left" as const) : undefined),
        };
      }

      if (col.isLabel) {
        return {
          title: baseTitle,
          dataIndex: col.dataIndex,
          width: col.width,
          fixed: baseFixed,
          render: (_: unknown, record: HRCTableRow) => {
            return (
              <div
                style={{
                  paddingLeft: 8,
                  // Cột label luôn không chỉnh sửa → highlight xám nhạt
                  backgroundColor: "#f5f5f5",
                }}
              >
                {record[col.dataIndex || ""]}
              </div>
            );
          },
        };
      }

      // bỏ logic disable theo config, chỉ giữ variant="adjust" là read-only

      return {
        title: baseTitle,
        dataIndex: col.dataIndex,
        width: col.width,
        align: col.align,
        fixed: baseFixed,
        render: (_: unknown, record: HRCTableRow) => {
          if (col.dataIndex && isSttDataIndex(col.dataIndex)) {
            const text = resolveSttText(sortedRows, record);
            return (
              <Input
                value={text}
                readOnly
                tabIndex={-1}
                style={{
                  textAlign: col.align ?? "center",
                  backgroundColor: "#f5f5f5",
                  cursor: "default",
                }}
              />
            );
          }
          // ⚠️ Cột phân bổ (variant="adjust") luôn read-only, không cho phép chỉnh sửa thủ công
          const isAdjustColumn = col.variant === "adjust";
          const isMeThoiColumn = col.dataIndex === "meThoi";
          const isMacThepColumn = col.dataIndex === "macThep";
          // Dòng từ NM (IsNM !== false): disable meThoi (mã mẻ khớp dữ liệu NM, không cho sửa
          // tay); macThep vẫn cho sửa vì NM có thể gán sai mác thép cần chỉnh lại thủ công.
          // Dòng thêm mới bằng button (IsNM === false): cho nhập tất cả các cột.
          const isNMRow = record.IsNM !== false;
          const isManualRow = !isNMRow;
          const macThepLocked = isMacThepColumn && !allowEditMacThepOnNMRow;
          const canEditThisCell =
            !isAdjustColumn &&
            !col.alwaysReadonly &&
            (!col.readonly || isManualRow) &&
            editable &&
            (!isNMRow || (!isMeThoiColumn && !macThepLocked));
          const dataIndex = col.dataIndex || "";
          const origKey = `${dataIndex}__orig`;
          const manualKey = `${dataIndex}__IsManual`;
          const origValue = record[origKey];
          const currentValue = record[dataIndex];
          const isManualFlag = (record as HRCRowWithManualFlags)[manualKey] === true;
          const isPerCellDiff =
            isManualFlag ||
            (origValue !== undefined && String(currentValue ?? "") !== String(origValue ?? ""));
          // Cột không có __orig per-cell (không phải phụ liệu) — dùng cờ IsEdited cấp dòng do BE
          // lưu lại (record.IsEdited) để highlight vẫn còn sau khi Lưu + tải lại dữ liệu.
          const isRowEditedCell = col.trackRowEdited === true && record.IsEdited === true;
          const isCellChanged = isPerCellDiff || isRowEditedCell;

          const cellValue = record[dataIndex];
          const displayValue = !canEditThisCell
            ? formatByKind(col.format, cellValue)
            : cellValue !== undefined && cellValue !== null
              ? String(cellValue)
              : "";
          const isTrungMeThoi =
            record.isTrungMeThoi === true ||
            (record as Record<string, unknown>).IsTrungMeThoi === true;
          const isNegative = !isTextDataIndex(dataIndex) && isNegativeValue(currentValue);

          const isKeyColumn = isMeThoiColumn || isMacThepColumn;
          // Mác thép của dòng NM (sync tự động) về null ngay lần đầu — tô đỏ nhạt để user để ý bổ sung.
          // Hết đỏ ngay khi có giá trị (kể cả giá trị rỗng do gõ tay xoá lại thì lại đỏ tiếp — đúng ý
          // nghĩa "đang thiếu"). Không áp dụng dòng thêm tay (isManualRow đã luôn cho autocomplete rồi).
          const isMacThepMissing =
            isMacThepColumn && isNMRow &&
            (currentValue === null || currentValue === undefined || currentValue === "");

          const editableStyle: React.CSSProperties = {
            textAlign: col.align ?? "right",
            width: "100%",
            ...(isKeyColumn && record.IsNM === false ? { backgroundColor: "#fffbe6" } : {}),
            ...(!(isMeThoiColumn && isTrungMeThoi) && col.highlight
              ? { backgroundColor: "#fff1f0" }
              : {}),
            ...(isMacThepMissing ? { backgroundColor: "#fff1f0" } : {}),
            ...(isMeThoiColumn && isTrungMeThoi ? { backgroundColor: "tomato" } : {}),
            ...(!(isMeThoiColumn && isTrungMeThoi) && isCellChanged
              ? { backgroundColor: "#fff7b3" }
              : {}),
            ...(isNegative ? { backgroundColor: "tomato" } : {}),
          };

          // Autocomplete cho meThoi/macThep trên dòng thêm tay — chỉ bật khi đã truyền searchApi tương
          // ứng (mặc định chưa có API thật, giữ nguyên ô nhập tay). Value/onChange đều làm việc trên
          // chuỗi (giống EditableCellInput), tái dùng applyAndEmitCellChange sẵn có. Mác thép còn bật
          // thêm cho dòng NM khi đang null — cho user chọn/tạo ngay từ danh mục thay vì gõ tay tự do.
          const activeTextAutocompleteApi = isMeThoiColumn
            ? (isManualRow ? meThoiSearchApi : undefined)
            : isMacThepColumn && (isManualRow || isMacThepMissing)
              ? macThepSearchApi
              : undefined;

          const inputNode = canEditThisCell && activeTextAutocompleteApi ? (
            <CommonAutocomplete<HRCTextAutocompleteOption>
              value={cellValue !== undefined && cellValue !== null && cellValue !== "" ? String(cellValue) : null}
              onChange={(v) => applyAndEmitCellChange(v !== null ? String(v) : "", record.key, dataIndex)}
              searchApi={activeTextAutocompleteApi}
              mapOption={(item) => ({ value: item.value, label: item.label })}
              fallbackLabelBuilder={(v) => String(v)}
              size="small"
              allowClear={false}
              style={editableStyle}
              selectProps={{
                className: [
                  "hrc-select-key-column",
                  isMeThoiColumn && isTrungMeThoi ? "hrc-select-trung-me-thoi" : "",
                ].filter(Boolean).join(" "),
              }}
              placeholder={typeof baseTitle === "string" ? baseTitle : undefined}
            />
          ) : canEditThisCell ? (
            <EditableCellInput
              initialValue={displayValue}
              onCommit={(v) => applyAndEmitCellChange(v, record.key, dataIndex)}
              style={editableStyle}
              placeholder={typeof baseTitle === "string" ? baseTitle : undefined}
            />
          ) : (
            <Input
              value={displayValue}
              readOnly
              disabled={isAdjustColumn}
              style={{
                textAlign: col.align ?? "right",
                backgroundColor:
                  isMeThoiColumn && isTrungMeThoi
                    ? "tomato"
                    : isCellChanged
                      ? "#fff7b3"
                      : isMacThepMissing
                        ? "#fff1f0"
                        : "#f5f5f5",
                cursor: "not-allowed",
              }}
            />
          );

          const flatTooltip = isNegative
            ? "Không được âm"
            : isPerCellDiff
              ? `Cũ: ${origValue === null ? (isTextDataIndex(dataIndex) ? "(trống)" : "0") : String(origValue ?? "")} | Mới: ${String(currentValue ?? "")}`
              : isRowEditedCell
                ? "Đã chỉnh sửa thủ công"
                : isMacThepMissing
                  ? "Mác thép đang trống — vui lòng chọn hoặc nhập"
                  : undefined;

          return flatTooltip ? (
            <Tooltip title={flatTooltip}>
              <span style={{ display: "block" }}>{inputNode}</span>
            </Tooltip>
          ) : (
            inputNode
          );
        },
      };
    }),
    ...(showDeleteButton
      ? [
          {
            title: "Chuyển / Xóa mẻ",
            key: "action",
            width: 140,
            render: (_: unknown, record: HRCTableRow) => (
              <Space>
                {isHasExistingPhieu ? (
                  <div className="flex gap-2">
                    <Tooltip title="Chuyển mẻ sang ca trước">
                      <Popconfirm
                        title="Xác nhận chuyển mẻ"
                        description={`Bạn có chắc muốn chuyển mẻ ${record.meThoi} sang ca TRƯỚC không?`}
                        okText="Đồng ý"
                        cancelText="Hủy"
                        onConfirm={() =>
                          handleChuyenMeThoi(
                            CHUYEN_TOI_CA.CATRUOC,
                            record.meThoi as string
                          )
                        }
                      >
                        <Button
                          type="text"
                          icon={<ArrowLeftOutlined />}
                          size="small"
                          disabled={rows.length <= minRows}
                        />
                      </Popconfirm>
                    </Tooltip>
                    <Tooltip title="Chuyển mẻ sang ca sau">
                      <Popconfirm
                        title="Xác nhận chuyển mẻ"
                        description={`Bạn có chắc muốn chuyển mẻ ${record.meThoi} sang ca SAU không?`}
                        okText="Đồng ý"
                        cancelText="Hủy"
                        onConfirm={() =>
                          handleChuyenMeThoi(
                            CHUYEN_TOI_CA.CASAU,
                            record.meThoi as string
                          )
                        }
                      >
                        <Button
                          type="text"
                          icon={<ArrowRightOutlined />}
                          size="small"
                          disabled={rows.length <= minRows}
                        />
                      </Popconfirm>
                    </Tooltip>
                  </div>
                ) : null}
                { (
                  <Popconfirm
                    title="Xác nhận xóa dòng"
                    description={`Bạn có chắc muốn xóa dòng mẻ ${record.meThoi || ""}?`}
                    okText="Đồng ý"
                    cancelText="Hủy"
                    onConfirm={() => handleDeleteRow(record)}
                  >
                    <Tooltip title="Xóa dòng">
                      <Button
                        type="text"
                        danger
                        size="small"
                      >
                        Xóa
                      </Button>
                    </Tooltip>
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      {loading ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "200px",
          }}
        >
          <Spin size="large">
            <div style={{ minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
              Đang tải dữ liệu từ API...
            </div>
          </Spin>
        </div>
      ) : (
        <>
          <Table
            bordered
            pagination={false}
            className={`hrc-table ${className} ${disableRowHover ? "hrc-table-no-hover" : ""}`.trim()}
            size="small"
            columns={tableColumns}
            dataSource={sortedRows}
            rowKey={(record) => String(record?.key ?? record?.id ?? Math.random())}
            style={{ marginTop: 20 }}
            scroll={{ x: scrollX, y: defaultScrollY }}
            sticky={stickyHeaders ? { offsetHeader: 0 } : undefined}
            summary={() => {
              const hasSumColumn = leafColumns.some((c) => c.sum);
              if (!hasSumColumn) return null;
              return (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    {leafColumns.map(({ dataIndex, sum, align }, idx) => (
                      <Table.Summary.Cell
                        key={dataIndex}
                        index={idx}
                        align={(align as "left" | "center" | "right") ?? "right"}
                      >
                        {idx === summaryTongLabelIndex ? (
                          <strong>Tổng</strong>
                        ) : sum && columnSums[dataIndex] !== undefined ? (
                          <strong>{formatSum(columnSums[dataIndex])}</strong>
                        ) : null}
                      </Table.Summary.Cell>
                    ))}
                    {showDeleteButton && <Table.Summary.Cell index={leafColumns.length} />}
                  </Table.Summary.Row>
                </Table.Summary>
              );
            }}
            // Highlight cả dòng nhập tay (IsNM === false) — cả dòng thêm mới lẫn load từ backend
            onRow={(record) => ({
              style:
                record.IsNM === false
                  ? { backgroundColor: "#fffbe6" } // vàng nhạt
                  : {},
            })}
          />
          {showAddButton && editable && (
            <Button onClick={handleAddRow} type="dashed" className="my-2">
              {addRowButtonText}
            </Button>
          )}
          {lyDoLabel && (
            <div style={{ marginTop: 12, display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ whiteSpace: "nowrap", fontWeight: 500, paddingTop: 4 }}>
                {lyDoLabel}:
                {lyDoError && (
                  <span style={{ color: "red", marginLeft: 4, fontSize: 12 }}>
                    (bắt buộc nhập)
                  </span>
                )}
              </span>
              <Input.TextArea
                value={lyDoValue}
                onChange={(e) => {
                  onLyDoChange?.(e.target.value);
                  if (e.target.value.trim()) setLyDoError(false);
                }}
                autoSize={{ minRows: 1, maxRows: 4 }}
                style={{
                  maxWidth: 500,
                  ...(lyDoError ? { borderColor: "red", boxShadow: "0 0 0 2px rgba(255,0,0,0.1)" } : {}),
                }}
                disabled={!editable}
              />
            </div>
          )}
          {/* {onRefresh && (
            <Button onClick={onRefresh} style={{ marginLeft: 8 }} loading={loading}>
              Tải lại dữ liệu
            </Button>
          )} */}
        </>
      )}
    </div>
  );
});

export default CustomTableHRC;

