/* eslint-disable @typescript-eslint/no-explicit-any */
// Fork của SummaryTableSTD.tsx cho Sổ Xuất-Nhập-Tồn HRC1 — đổi Id_HeaderKey -> PhuLieuID, bỏ hẳn
// cột/logic tyLeRH + KLPB_RH (HRC1 không có công đoạn RH, chỉ BOF/LF). Xem .claude/hrc1_xnt.md mục 2.3.
import React, { useMemo, useState, useCallback, memo, useEffect } from "react";
import { Table, Input, Button, InputNumber, message, Tag, Tooltip, Popconfirm } from "antd";
import type { STD_NXT_HRC1_PhanBoDto } from "../models/STD_NXT_HRC1_Model";

type STD_NXT_HRC1_ResetRow = STD_NXT_HRC1_PhanBoDto & { IsPhanBo: boolean };

// Cột tổng hợp tính toán (readOnly) cần chặn/cảnh báo khi ra giá trị âm — mirror GroupedTableSTD_HRC1.
const NEGATIVE_HIGHLIGHT_COLS = ["totalTonDauCa", "totalNhapTrongCa", "totalTonCuoiCa", "totalSuDung"];

const isNegativeNumber = (val: any) =>
  val != null && val !== "" && !Number.isNaN(Number(val)) && Number(val) < 0;

const formatVi = (val: any): string => {
  if (val === null || val === undefined || val === "") return "";
  const num = parseFloat(String(val));
  if (isNaN(num)) return String(val);
  return num.toLocaleString("fr-FR", { maximumFractionDigits: 10 });
};

const EditableCell = memo(({ value, disabled, onChange }: { value: any; disabled: boolean; onChange: (v: string) => void }) => {
  const [focused, setFocused] = useState(false);
  const [local, setLocal] = useState(value ?? "");

  useEffect(() => {
    setLocal(value ?? "");
  }, [value]);

  return (
    <Input
      value={focused ? local : formatVi(local)}
      disabled={disabled}
      style={{ border: "none", padding: 0, textAlign: "right" }}
      onChange={(e) => { setLocal(e.target.value); onChange(e.target.value); }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
});

interface SummaryTableSTD_HRC1Props {
  columns: Array<{
    title: string;
    dataIndex?: string;
    isLabel?: boolean;
    readOnly?: boolean;
    width?: number | string;
  }>;
  table1Data: any[]; // Dữ liệu từ bảng 1
  initialData?: any[]; // Dữ liệu summary từ BE (có HasPhanBo, PhuLieuID, NgaySX, Ca...)
  onDataChange?: (data: any[]) => void;
  onPhanBo?: (data: STD_NXT_HRC1_PhanBoDto) => void;
  onThuHoi?: (data: STD_NXT_HRC1_PhanBoDto) => void;
  onKhongPhanBo?: (data: STD_NXT_HRC1_PhanBoDto) => void;
  /** Reset toàn bộ phụ liệu đang Đã phân bổ/Không phân bổ về lại Chưa xử lý (nút ở header cột Thao tác) */
  onResetAll?: (rows: STD_NXT_HRC1_ResetRow[]) => void | Promise<void>;
  /** Chỉ cho phép bấm "Phân bổ" khi tất cả phiếu tiêu hao BOF/LF liên quan đã Hoàn thành */
  canPhanBo?: boolean;
  idPhieu?: string | null;
  editable?: boolean;
  loading?: boolean;
  className?: string;
  lockedTooltip?: string;
}

export default function SummaryTableSTD_HRC1({
  columns,
  table1Data = [],
  initialData = [],
  onDataChange,
  onPhanBo,
  onThuHoi,
  onKhongPhanBo,
  onResetAll,
  canPhanBo = true,
  idPhieu,
  editable = true,
  loading = false,
  className = "",
  lockedTooltip,
}: SummaryTableSTD_HRC1Props) {
  // Tính tổng theo nguyên nhiên liệu duy nhất (theo thứ tự xuất hiện ở bảng trên)
  const summaryData = useMemo(() => {
    if (!table1Data || table1Data.length === 0) return [];
    const materialOrder: string[] = [];
    const grouped: Record<string, any[]> = {};

    table1Data.forEach((row) => {
      const material = row.nguyenNhienLieu || "";
      if (!material) return;
      if (!grouped[material]) {
        grouped[material] = [];
        materialOrder.push(material);
      }
      grouped[material].push(row);
    });

    const summaryRows: any[] = [];
    materialOrder.forEach((material, index) => {
      const rows = grouped[material] || [];

      const totalTonDauCa = rows.reduce((sum, r) => sum + (parseFloat(String(r.tonDauCa || 0)) || 0), 0);
      const totalNhapTrongCa = rows.reduce((sum, r) => sum + (parseFloat(String(r.nhapTrongCa || 0)) || 0), 0);
      const totalTonCuoiCa = rows.reduce((sum, r) => sum + (parseFloat(String(r.tonCuoiCa || 0)) || 0), 0);
      const totalSDTrongSoSach = rows.reduce((sum, r) => sum + (parseFloat(String(r.tongThucTe || 0)) || 0), 0);
      const totalSuDung = totalTonDauCa + totalNhapTrongCa - totalTonCuoiCa;
      const totalChenhLech = Math.abs(totalSuDung - totalSDTrongSoSach);

      // Lấy PhuLieuID từ bảng 1 (giả định mỗi nguyên liệu chỉ có 1 PhuLieuID)
      const anyWithId = rows.find((r) => r.idPhuLieu != null);
      const phuLieuID = anyWithId?.idPhuLieu ?? null;

      const baseRow: any = {
        key: `summary_${material}`,
        totalText: index === 0 ? "Tổng cộng (cả trong và ngoài silo)" : "",
        totalNguyenNhienLieu: material,
        totalTonDauCa: totalTonDauCa,
        totalNhapTrongCa: totalNhapTrongCa,
        totalTonCuoiCa: totalTonCuoiCa,
        totalSuDung: totalSuDung,
        totalSDTrongSoSach: totalSDTrongSoSach,
        totalChenhLech: totalChenhLech,
        PhuLieuID: phuLieuID,
        _isFirstMaterialRow: index === 0,
        _materialRowCount: materialOrder.length,
      };

      const meta = Array.isArray(initialData)
        ? initialData.find((x: any) => {
            const name =
              x.tenNguyenLieu ??
              x.TenNguyenLieu ??
              x.totalNguyenNhienLieu ??
              x.TotalNguyenNhienLieu ??
              "";
            return String(name).trim().toLowerCase() === material.toLowerCase();
          })
        : undefined;
      if (meta) {
        baseRow.IsPhanBo = meta.isPhanBo ?? meta.IsPhanBo ?? meta.hasPhanBo ?? meta.HasPhanBo ?? null;
        baseRow.NgaySX = meta.ngaySX ?? meta.NgaySX ?? undefined;
        baseRow.Ca = meta.ca ?? meta.Ca ?? undefined;
        baseRow.tyLeBOF = meta.tyLeBOF ?? meta.TyLeBOF ?? null;
        baseRow.tyLeLF = meta.tyLeLF ?? meta.TyLeLF ?? null;
        baseRow.KLPB_BOF = meta.klpB_BOF ?? meta.klpb_BOF ?? meta.KLPB_BOF ?? null;
        baseRow.KLPB_LF = meta.klpB_LF ?? meta.klpb_LF ?? meta.KLPB_LF ?? null;

        const chenhLechFromServer =
          meta.totalChenhLech ??
          meta.TotalChenhLech ??
          meta.chenhLech ??
          meta.ChenhLech ??
          null;
        if (chenhLechFromServer !== null && chenhLechFromServer !== undefined && chenhLechFromServer !== "") {
          baseRow.totalChenhLech = chenhLechFromServer;
          baseRow._chenhLechFromServer = true;
        }
      }

      summaryRows.push(baseRow);
    });

    return summaryRows;
  }, [table1Data, initialData]);

  const dataWithChenhLech = useMemo(() => {
    return summaryData.map((row) => {
      if (row._isTotalRow) return row;
      if (row._chenhLechFromServer === true) {
        const num = parseFloat(String(row.totalChenhLech ?? 0)) || 0;
        return { ...row, totalChenhLech: Math.abs(num) };
      }

      const suDung = typeof row.totalSuDung === "number" ? row.totalSuDung : parseFloat(String(row.totalSuDung || 0));
      const sdTrongSoSach = parseFloat(String(row.totalSDTrongSoSach || 0)) || 0;
      const chenhLech = suDung - sdTrongSoSach;

      return {
        ...row,
        totalChenhLech: Math.abs(chenhLech),
      };
    });
  }, [summaryData]);

  // State riêng cho tyLeBOF / tyLeLF vì không derive từ table1Data
  const [tyLeMap, setTyLeMap] = useState<Record<string, { tyLeBOF?: number | null; tyLeLF?: number | null }>>({});

  const handleTyLeChange = useCallback((key: string, field: "tyLeBOF" | "tyLeLF", value: number | null) => {
    setTyLeMap((prev) => {
      const currentRow = { ...prev[key] };
      const nextRow = { ...currentRow, [field]: value };
      const next = { ...prev, [key]: nextRow };
      const updatedRows = dataWithChenhLech.map((row) =>
        row.key === key ? { ...row, ...next[key] } : row
      );
      onDataChange?.(updatedRows);
      return next;
    });
  }, [dataWithChenhLech, onDataChange]);

  const [phanBoMap, setPhanBoMap] = useState<Record<string, boolean | null>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, string | null>>({});

  useEffect(() => {
    setPhanBoMap({});
  }, [initialData]);

  const getIsPhanBo = useCallback((record: any): boolean | null => {
    if (Object.prototype.hasOwnProperty.call(phanBoMap, record.key)) return phanBoMap[record.key];
    return record.IsPhanBo ?? null;
  }, [phanBoMap]);

  const mockApiCall = useCallback((_action: string): Promise<boolean | null> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (_action === 'phan-bo') resolve(true);
        else if (_action === 'khong-phan-bo') resolve(false);
        else resolve(null);
      }, 600);
    });
  }, []);

  const handlePhanBoClick = useCallback(async (record: any) => {
    const current = getIsPhanBo(record);
    const action = current === true ? 'huy-phan-bo' : 'phan-bo';
    setLoadingMap(prev => ({ ...prev, [record.key]: action }));
    try {
      const next = await mockApiCall(action);
      setPhanBoMap(prev => ({ ...prev, [record.key]: next }));
      if (action === 'phan-bo') {
        const rowTyLe = tyLeMap[record.key] ?? {};
        const tyLeBOF = rowTyLe.tyLeBOF ?? record.tyLeBOF ?? 0;
        const tyLeLF = rowTyLe.tyLeLF ?? record.tyLeLF ?? 0;
        onPhanBo?.({ NgaySX: record.NgaySX, Ca: record.Ca, PhuLieuID: record.PhuLieuID, ChenhLech: Number(record.totalChenhLech ?? 0), IdPhieu: idPhieu ?? "", TyLeBOF: tyLeBOF, TyLeLF: tyLeLF });
      } else {
        onThuHoi?.({ NgaySX: record.NgaySX, Ca: record.Ca, PhuLieuID: record.PhuLieuID, ChenhLech: Number(record.totalChenhLech ?? 0), IdPhieu: idPhieu ?? "", TyLeBOF: 0, TyLeLF: 0 });
      }
    } catch {
      message.error("Có lỗi xảy ra");
    } finally {
      setLoadingMap(prev => ({ ...prev, [record.key]: null }));
    }
  }, [getIsPhanBo, mockApiCall, tyLeMap, idPhieu, onPhanBo, onThuHoi]);

  const handleThuHoiClick = useCallback(async (record: any) => {
    setLoadingMap(prev => ({ ...prev, [record.key]: 'thu-hoi' }));
    try {
      await mockApiCall('thu-hoi');
      setPhanBoMap(prev => ({ ...prev, [record.key]: null }));
      onThuHoi?.({ NgaySX: record.NgaySX, Ca: record.Ca, PhuLieuID: record.PhuLieuID, ChenhLech: Number(record.totalChenhLech ?? 0), IdPhieu: idPhieu ?? "", TyLeBOF: 0, TyLeLF: 0 });
    } catch {
      message.error("Có lỗi xảy ra");
    } finally {
      setLoadingMap(prev => ({ ...prev, [record.key]: null }));
    }
  }, [mockApiCall, idPhieu, onThuHoi]);

  const handleKhongPhanBoClick = useCallback(async (record: any) => {
    const current = getIsPhanBo(record);
    const action = current === false ? 'huy-khong-phan-bo' : 'khong-phan-bo';
    setLoadingMap(prev => ({ ...prev, [record.key]: action }));
    try {
      const next = await mockApiCall(action);
      setPhanBoMap(prev => ({ ...prev, [record.key]: next }));
      onKhongPhanBo?.({ NgaySX: record.NgaySX, Ca: record.Ca, PhuLieuID: record.PhuLieuID, ChenhLech: Number(record.totalChenhLech ?? 0), IdPhieu: idPhieu ?? "" });
    } catch {
      message.error("Có lỗi xảy ra");
    } finally {
      setLoadingMap(prev => ({ ...prev, [record.key]: null }));
    }
  }, [getIsPhanBo, mockApiCall, idPhieu, onKhongPhanBo]);

  const [resetAllLoading, setResetAllLoading] = useState(false);

  const handleResetAllClick = useCallback(async () => {
    const rowsToReset: STD_NXT_HRC1_ResetRow[] = dataWithChenhLech
      .filter((r) => !r._isTotalRow && getIsPhanBo(r) !== null)
      .map((r) => ({
        NgaySX: r.NgaySX,
        Ca: r.Ca,
        PhuLieuID: r.PhuLieuID,
        ChenhLech: Number(r.totalChenhLech ?? 0),
        IdPhieu: idPhieu ?? "",
        IsPhanBo: getIsPhanBo(r) as boolean,
      }));

    if (rowsToReset.length === 0) {
      message.info("Không có phụ liệu nào đã phân bổ hoặc không phân bổ để reset.");
      return;
    }

    setResetAllLoading(true);
    try {
      // Không cần tự set phanBoMap ở đây — onResetAll (BE) xong sẽ gọi refreshSummaryAndStatus ở component
      // cha, đổi initialData, và useEffect ở trên đã tự reset phanBoMap = {} khi initialData đổi.
      await onResetAll?.(rowsToReset);
    } finally {
      setResetAllLoading(false);
    }
  }, [dataWithChenhLech, getIsPhanBo, idPhieu, onResetAll]);

  const handleCellChange = (key: string, dataIndex: string, value: any) => {
    const updatedData = dataWithChenhLech.map((row) => {
      if (row.key === key) {
        const updated = { ...row, [dataIndex]: value };
        if (dataIndex === "totalSDTrongSoSach") {
          const suDung = typeof updated.totalSuDung === "number"
            ? updated.totalSuDung
            : parseFloat(String(updated.totalSuDung || 0));
          const sdTrongSoSach = parseFloat(String(value || 0)) || 0;
          updated.totalChenhLech = suDung - sdTrongSoSach;
        }
        return updated;
      }
      return row;
    });
    onDataChange?.(updatedData);
  };

  const formatNumber = (value: string | number, showNegativeInParentheses = false) => {
    const formatted = formatVi(value);
    if (!formatted) return "";
    if (showNegativeInParentheses && String(value).startsWith("-")) {
      return `(${formatted.replace("-", "")})`;
    }
    return formatted;
  };

  const renderCell = (record: any, col: any) => {
    const dataIndex = col.dataIndex;
    const isReadonly = col.readOnly === true || col.isLabel === true;
    const value = record[dataIndex] ?? "";
    const isNumberColumn = ["totalTonDauCa", "totalNhapTrongCa", "totalTonCuoiCa", "totalSuDung", "totalSDTrongSoSach", "totalChenhLech", "KLPB_BOF", "KLPB_LF"].includes(dataIndex);
    const isTyLeColumn = dataIndex === "tyLeBOF" || dataIndex === "tyLeLF";

    if (isTyLeColumn && !record._isTotalRow) {
      const hasPhanBo = getIsPhanBo(record) === true;
      const tyLeVal = tyLeMap[record.key]?.[dataIndex as "tyLeBOF" | "tyLeLF"] ?? (record[dataIndex] ?? null);
      return (
        <InputNumber
          value={tyLeVal}
          min={0}
          max={100}
          disabled={!editable || hasPhanBo}
          style={{ width: "100%" }}
          onChange={(v) => handleTyLeChange(record.key, dataIndex as "tyLeBOF" | "tyLeLF", v)}
        />
      );
    }
    const isChenhLechColumn = dataIndex === "totalChenhLech";
    const isTotalTextColumn = dataIndex === "totalText";

    if (isTotalTextColumn) {
      if (record._isFirstMaterialRow) {
        return {
          children: <span>{record.totalText || ""}</span>,
          props: {
            rowSpan: record._materialRowCount || 1,
          },
        };
      }
      if (!record._isTotalRow && record.totalText === "") {
        return {
          children: null,
          props: {
            rowSpan: 0,
          },
        };
      }
    }

    if (isReadonly) {
      if (isNumberColumn && (value || value === 0)) {
        const formatted = formatNumber(value, isChenhLechColumn);
        const isNeg = NEGATIVE_HIGHLIGHT_COLS.includes(dataIndex) && isNegativeNumber(value);
        return (
          <span
            style={{
              textAlign: "right",
              display: "block",
              ...(isNeg ? { color: "#ff4d4f", fontWeight: 600 } : undefined),
            }}
          >
            {formatted}
          </span>
        );
      }
      return <span>{value}</span>;
    }

    return (
      <EditableCell
        value={value}
        disabled={!editable}
        onChange={(v) => handleCellChange(record.key, dataIndex, v)}
      />
    );
  };

  const tableColumns = columns.map((col) => {
    const isNumberColumn = ["totalTonDauCa", "totalNhapTrongCa", "totalTonCuoiCa", "totalSuDung", "totalSDTrongSoSach", "totalChenhLech", "KLPB_BOF", "KLPB_LF"].includes(col.dataIndex || "");
    const isTotalTextColumn = col.dataIndex === "totalText";
    const isTyLeCol = col.dataIndex === "tyLeBOF" || col.dataIndex === "tyLeLF";
    const isMaterialCol = col.dataIndex === "totalNguyenNhienLieu";
    return {
      title: col.title,
      dataIndex: col.dataIndex,
      ...(col.width && { width: col.width }),
      onHeaderCell: () => ({
        style: {
          whiteSpace: "normal" as const,
          wordBreak: "break-word" as const,
          minWidth: isTotalTextColumn ? 80 : isMaterialCol ? 80 : isTyLeCol ? 60 : isNumberColumn ? 70 : 70,
        },
      }),
      onCell: (record: any) => {
        const minW = isTotalTextColumn ? 80 : isMaterialCol ? 80 : isTyLeCol ? 60 : isNumberColumn ? 70 : 70;
        if (isTyLeCol && !record._isTotalRow) {
          const rowTyLe = tyLeMap[record.key] ?? {};
          const bof = rowTyLe.tyLeBOF ?? record.tyLeBOF ?? null;
          const lf = rowTyLe.tyLeLF ?? record.tyLeLF ?? null;
          const allFilled = bof !== null && lf !== null;
          const total = allFilled ? Number(bof) + Number(lf) : null;
          const isInvalid = allFilled && Math.abs(total! - 100) > 0.001;
          return { style: { minWidth: minW, ...(isInvalid && { backgroundColor: "#fff1f0" }) } };
        }
        if (NEGATIVE_HIGHLIGHT_COLS.includes(col.dataIndex || "") && isNegativeNumber(record[col.dataIndex || ""])) {
          return { style: { minWidth: minW, backgroundColor: "#fff2f0" } };
        }
        return { style: { minWidth: minW } };
      },
      align: isNumberColumn ? "right" as const : (isTotalTextColumn ? "left" as const : "center" as const),
      render: (value: any, record: any) => renderCell(record, col),
    };
  });

  tableColumns.push(
    {
      title: "KL PB Lò thổi",
      dataIndex: "KLPB_BOF",
      align: "right" as const,
      render: (_: any, record: any) => {
        if (record._isTotalRow) return null;
        const v =
          record.KLPB_BOF ??
          (record as any).klpB_BOF ??
          (record as any).klpb_BOF ??
          (record as any).KLPB_BOF ??
          "";
        return <span style={{ textAlign: "right", display: "block" }}>{v === "" ? "" : formatNumber(v)}</span>;
      },
    } as any,
    {
      title: "KL PB TL",
      dataIndex: "KLPB_LF",
      align: "right" as const,
      render: (_: any, record: any) => {
        if (record._isTotalRow) return null;
        const v =
          record.KLPB_LF ??
          (record as any).klpB_LF ??
          (record as any).klpb_LF ??
          (record as any).KLPB_LF ??
          "";
        return <span style={{ textAlign: "right", display: "block" }}>{v === "" ? "" : formatNumber(v)}</span>;
      },
    } as any
  );

  // Cột "Tình trạng"
  tableColumns.push({
    title: "Tình trạng",
    dataIndex: "tinhTrang",
    align: "center" as const,
    render: (_: any, record: any) => {
      if (record._isTotalRow) return null;
      const isPhanBo = getIsPhanBo(record);
      if (isPhanBo === true) return <Tag color="success">Đã phân bổ</Tag>;
      if (isPhanBo === false) return <Tag color="error">Không phân bổ</Tag>;
      return <Tag color="default">Chưa xử lý</Tag>;
    },
  } as any);

  // Cột "Thao tác" — gộp Phân bổ + Không phân bổ, header có nút Reset tất cả
  tableColumns.push({
    title: (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <span>Thao tác</span>
        {onResetAll && (
          <Popconfirm
            title="Reset tất cả phân bổ?"
            description="Toàn bộ phụ liệu đang Đã phân bổ / Không phân bổ sẽ được đưa về Chưa xử lý. Không thể hoàn tác."
            okText="Reset tất cả"
            cancelText="Hủy"
            onConfirm={handleResetAllClick}
            disabled={!editable || !!lockedTooltip}
          >
            <Button
              size="small"
              danger
              loading={resetAllLoading}
              disabled={!editable || !!lockedTooltip}
            >
              Reset tất cả
            </Button>
          </Popconfirm>
        )}
      </div>
    ),
    width: 180,
    dataIndex: "thaotac",
    align: "center" as const,
    render: (_: any, record: any) => {
      if (record._isTotalRow) return null;
      const isPhanBo = getIsPhanBo(record);
      const isLoading = loadingMap[record.key];
      const isLocked = !!lockedTooltip;
      // Chặn Phân bổ/Không PB khi các cột tổng hợp tính toán (xem NEGATIVE_HIGHLIGHT_COLS) đang âm —
      // dữ liệu chưa hợp lệ thì không nên cho xử lý phân bổ chênh lệch dựa trên số sai.
      const hasNegativeSummary = NEGATIVE_HIGHLIGHT_COLS.some((col) => isNegativeNumber(record[col]));
      const negativeTooltip = "Số liệu tổng hợp (tồn đầu/nhập/tồn cuối/tổng sử dụng) đang âm — vui lòng kiểm tra lại trước khi phân bổ.";

      const wrapLocked = (btn: React.ReactNode) =>
        isLocked ? <Tooltip title={lockedTooltip}><span style={{ display: "inline-block" }}>{btn}</span></Tooltip> : btn;
      const wrapNegative = (btn: React.ReactNode) =>
        hasNegativeSummary ? <Tooltip title={negativeTooltip}><span style={{ display: "inline-block" }}>{btn}</span></Tooltip> : btn;

      let btnPhanBo: React.ReactNode;
      if (isPhanBo === true) {
        btnPhanBo = wrapLocked(
          <Button
            size="small"
            loading={isLoading === 'thu-hoi'}
            disabled={!editable || isLocked}
            onClick={() => handleThuHoiClick(record)}
          >
            Thu hồi
          </Button>
        );
      } else {
        btnPhanBo = wrapLocked(wrapNegative(
          <Button
            type="primary"
            size="small"
            loading={isLoading === 'phan-bo'}
            disabled={isPhanBo === false || !editable || isLocked || hasNegativeSummary || (canPhanBo === false && isPhanBo === null)}
            onClick={() => {
              if (hasNegativeSummary) {
                message.warning(negativeTooltip);
                return;
              }
              const rowTyLe = tyLeMap[record.key] ?? {};
              const tyLeBOF = rowTyLe.tyLeBOF ?? record.tyLeBOF ?? null;
              const tyLeLF = rowTyLe.tyLeLF ?? record.tyLeLF ?? null;
              if (tyLeBOF === null || tyLeBOF === undefined || tyLeLF === null || tyLeLF === undefined) {
                message.warning("Vui lòng nhập đủ tỷ lệ phân bổ BOF và LF trước khi thực hiện phân bổ.");
                return;
              }
              const total = Number(tyLeBOF) + Number(tyLeLF);
              if (Math.abs(total - 100) > 0.001) {
                message.warning(`Tổng tỷ lệ phân bổ phải bằng 100% (hiện tại: ${total.toFixed(2)}%).`);
                return;
              }
              handlePhanBoClick(record);
            }}
          >
            Phân bổ
          </Button>
        ));
      }

      const btnKhongPhanBo = isPhanBo === false
        ? wrapLocked(
            <Button
              danger
              type="primary"
              size="small"
              loading={isLoading === 'huy-khong-phan-bo'}
              disabled={!editable || isLocked}
              onClick={() => handleKhongPhanBoClick(record)}
            >
              Reset
            </Button>
          )
        : wrapLocked(wrapNegative(
            <Button
              danger
              type="default"
              size="small"
              loading={isLoading === 'khong-phan-bo'}
              disabled={!editable || isLocked || isPhanBo === true || hasNegativeSummary || (canPhanBo === false && isPhanBo === null)}
              onClick={() => {
                if (hasNegativeSummary) {
                  message.warning(negativeTooltip);
                  return;
                }
                handleKhongPhanBoClick(record);
              }}
            >
              Không PB
            </Button>
          ));

      return (
        <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap" }}>
          {btnPhanBo}
          {btnKhongPhanBo}
        </div>
      );
    },
  } as any);

  if (loading) {
    return <div>Đang tải...</div>;
  }

  return (
    <div className={className} style={{ width: "100%", overflowX: "auto" }}>
      <Table
        bordered
        size="small"
        columns={tableColumns}
        dataSource={dataWithChenhLech}
        pagination={false}
        rowKey="key"
        style={{ width: "100%" }}
      />
    </div>
  );
}
