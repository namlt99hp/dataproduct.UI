/* eslint-disable @typescript-eslint/no-explicit-any */
// CustomFormNLTable — phiên bản dành riêng cho Nạp Liệu Lò Cao.
// Khác với CustomFormTable gốc ở chỗ:
//   - Ô nhập tay (_manual_) được tô cam + viền cam.
//   - Hover hiển thị Tooltip "Giá trị gốc: X" (giá trị SCADA trước khi sửa tay).
//   - handleCellChange: _goc_ chỉ được ghi đúng một lần (double-condition guard).
//   - isEmpty = true → ô xám, không cho nhập (slot rỗng từ BE).

import React, { useState, useEffect } from "react";
import {
  Table,
  Button,
  Input,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
  TimePicker,
  Tooltip,
} from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

interface ColumnChild {
  title: string;
  dataIndex: string | number;
  format?: string;
  type?: "text" | "number" | "float" | any;
  options?: Array<{ label: string; value: string | number }>;
  isEmpty?: boolean; // ← slot rỗng từ BE
  width?: number | string;
}

interface CustomFormNLTableProps {
  columns: Array<{
    title: string;
    dataIndex?: string;
    isLabel?: boolean;
    width?: number | string;
    fixed?: "left" | "right";
    format?: string;
    type?: "text" | "number" | "float" | any;
    isEmpty?: boolean; // ← slot rỗng từ BE (cột đơn không có children)
    children?: ColumnChild[];
    options?: Array<{ label: string; value: string | number }>;
  }>;
  initialData?: any[];
  onDataChange?: (data: any[]) => void;
  className?: string;
  addRowButtonText?: string;
  showAddButton?: boolean;
  showDeleteButton?: boolean;
  minRows?: number;
  editable?: boolean;
  loading?: boolean;
  onRefresh?: () => void;
  selectionEnabled?: boolean;
  selectedRowKeys?: Array<string | number>;
  onSelectionChange?: (keys: Array<string | number>, rows: any[]) => void;
  isRowSelectable?: (row: any) => boolean;
  showStatus?: boolean;
  readonlyFields?: string[];
  scrollY?: number;
  stickyHeader?: boolean;
  onCellChange?: (rowIndex: number, dataIndex: string, value: any, row: any) => void;
  compactWhenEmpty?: boolean;
  summary?: (data: readonly any[]) => React.ReactNode;
  manualTrackPattern?: RegExp;
  onRow?: (record: any, index?: number) => any;
}

// ── Style cho ô slot rỗng (không có NVL tương ứng) ──────────────────────────
const EMPTY_SLOT_STYLE: React.CSSProperties = {
  backgroundColor: "#f0f0f0",
  border: "1px solid #d9d9d9",
  cursor: "not-allowed",
  textAlign: "right",
};

export default function CustomFormNLTable({
  columns,
  initialData = [{ key: 1 }],
  onDataChange,
  className = "",
  addRowButtonText = "+ Thêm dòng",
  showAddButton = true,
  showDeleteButton = true,
  minRows = 1,
  editable = true,
  loading = false,
  onRefresh,
  selectionEnabled = false,
  selectedRowKeys,
  onSelectionChange,
  isRowSelectable,
  showStatus = false,
  readonlyFields = [],
  scrollY,
  stickyHeader = false,
  onCellChange,
  compactWhenEmpty = false,
  summary,
  manualTrackPattern,
  onRow,
}: CustomFormNLTableProps) {

  const validateAndFormatInput = (value: string, type?: "text" | "number" | "float"): string => {
    if (!type || type === "text") return value;
    if (type === "number") {
      return value.replace(/[^0-9-]/g, "").replace(/^-+/, (m) => (m.length === 1 ? "-" : "-"));
    }
    if (type === "float") {
      const normalized = value.replace(/\s+/g, "");
      const match = normalized.match(/^-?[\d.]*$/);
      if (!match) return normalized.replace(/[^0-9.-]/g, "");
      const parts = normalized.split(".");
      if (parts.length > 2) return (parts[0] || "0") + "." + parts.slice(1).join("");
      return normalized;
    }
    return value;
  };

  const formatNumberGroup = (value: unknown): string => {
    if (value === null || value === undefined || value === "") return "";
    const raw = String(value).trim();
    if (!raw) return "";
    const normalized = raw.replace(/\s+/g, "").replace(",", ".");
    const n = Number(normalized);
    if (!Number.isFinite(n)) return raw;
    const sign = n < 0 ? "-" : "";
    const abs = Math.abs(n);
    const [intPartRaw, fracRaw] = String(abs).split(".");
    const intPart = intPartRaw.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return fracRaw ? `${sign}${intPart}.${fracRaw}` : `${sign}${intPart}`;
  };

  const formatIfNeeded = (format: unknown, value: unknown): string => {
    if (format === "number-group") return formatNumberGroup(value);
    return value === null || value === undefined ? "" : String(value);
  };

  const [rows, setRows] = useState(initialData);

  // ── Render ô slot rỗng ───────────────────────────────────────────────────────
  const renderEmptySlot = () => (
    <Input value="" readOnly style={EMPTY_SLOT_STYLE} />
  );

  // ── NL-specific: tô cam cho ô nhập tay, vàng cho readonly ──────────────────
  const getCellStyle = (dataIndex: string | number, value: any, row?: any, readonly?: boolean) => {
    const style: any = {};
    style.textAlign = "right";

    const key = String(dataIndex || "");
    const isManual = row?.[`_manual_${key}`] === true;

    if (isManual) {
      style.backgroundColor = "#fff7e6";
      style.borderColor = "#fa8c16";
    } else if (readonly || !editable) {
      style.backgroundColor = "#fffbe6";
    }

    if (String(dataIndex) === "stChuaChuyen" && Number(value) > 0) {
      style.backgroundColor = "#fff1f0";
      style.borderColor = "#ff4d4f";
    }

    if (key.toLowerCase().startsWith("stdachuyen")) {
      const suffix = key.substring("stDachuyen".length);
      const sourceKey = `st${suffix}`;
      const sourceVal = Number(row?.[sourceKey] ?? 0);
      const transferredVal = Number(value ?? 0);
      if (!Number.isNaN(sourceVal) && !Number.isNaN(transferredVal) && sourceVal !== transferredVal) {
        style.backgroundColor = "#fff1f0";
        style.borderColor = "#ff4d4f";
      }
    }

    return style;
  };

  // ── NL-specific: Tooltip giá trị gốc (SCADA) khi ô đã được nhập tay ────────
  const wrapManualCell = (node: React.ReactNode, dataIndex: string | number, record: any) => {
    const key = String(dataIndex || "");
    const isManual = record?.[`_manual_${key}`] === true;
    const goc = record?.[`_goc_${key}`];
    // Luôn bọc bằng Tooltip (title rỗng thì không hiện) để cấu trúc cây React không đổi khi ô
    // chuyển sang nhập tay. Trước đây ô được bọc Fragment, sau lần gõ đầu tiên đổi sang Tooltip
    // → Input bị unmount/mount lại → mất focus, người dùng gõ 1 ký tự là bị văng ra khỏi ô.
    const tooltipTitle = isManual && goc != null ? `Giá trị gốc: ${goc}` : "";
    return (
      <Tooltip title={tooltipTitle} color="orange">
        {node}
      </Tooltip>
    );
  };

  useEffect(() => { setRows(initialData || []); }, [initialData]);

  const handleAddRow = () => {
    const fieldKeys = getAllFieldKeys(columns);
    // _isNewRow: đánh dấu dòng người dùng tự thêm tay, để nơi gọi (vd: "Tải dữ liệu")
    // biết cần giữ lại dòng này khi làm mới bảng từ SCADA/DB thay vì ghi đè mất.
    const newRow: any = { key: Date.now(), _isNewRow: true };
    fieldKeys.forEach((k: any) => { newRow[k] = ""; });
    const newRows = [...rows, newRow];
    setRows(newRows);
    onDataChange?.(newRows);
  };

  const handleDeleteRow = (rowIndex: number) => {
    if (rows.length <= minRows) return;
    const newRows = rows.filter((_, idx) => idx !== rowIndex);
    setRows(newRows);
    onDataChange?.(newRows);
  };

  const getAllFieldKeys = (cols: any[]): string[] => {
    const keys: string[] = [];
    cols.forEach((col) => {
      if (col.dataIndex && !col.isEmpty) keys.push(col.dataIndex);
      if (col.children) col.children.forEach((child: any) => {
        if (child.dataIndex && !child.isEmpty) keys.push(child.dataIndex);
      });
    });
    return keys;
  };

  // ── _goc_ chỉ được ghi lần đầu tiên (double-condition guard) ────────────────
  const handleCellChange = (value: string, rowIndex: number, dataIndex: string) => {
    const newData = rows.map((r, i) => (i === rowIndex ? { ...r } : r));
    if (manualTrackPattern?.test(dataIndex)) {
      const manualKey = `_manual_${dataIndex}`;
      const gocKey = `_goc_${dataIndex}`;
      if (!newData[rowIndex][manualKey] && newData[rowIndex][gocKey] == null) {
        newData[rowIndex][gocKey] = newData[rowIndex][dataIndex] ?? null;
      }
      newData[rowIndex][manualKey] = true;
    }
    newData[rowIndex][dataIndex] = value;
    setRows(newData);
    onDataChange?.(newData);
    onCellChange?.(rowIndex, dataIndex, value, newData[rowIndex]);
  };

  // ── Render 1 child column (dùng chung cho cả có/không isEmpty) ──────────────
  const renderChildColumn = (child: ColumnChild, record: any, idx: number) => {
    // Không có SCADA data (tagKey null hoặc không có data tự động):
    // - Khi editable → vẫn cho nhập tay, nền xám nhạt để phân biệt
    // - Khi readonly → ô xám không cho nhập (xem phiếu)
    if (child.isEmpty) {
      if (!editable) return renderEmptySlot();
      return (
        <Input
          value={record[child.dataIndex] ?? ""}
          onChange={(e) => {
            const validated = validateAndFormatInput(e.target.value, child.type);
            handleCellChange(validated, idx, child.dataIndex as string);
          }}
          style={{ backgroundColor: "#f5f5f5", textAlign: "right" }}
          placeholder="-"
        />
      );
    }

    // Readonly field
    if (readonlyFields.includes(String(child.dataIndex))) {
      return wrapManualCell(
        <Input
          placeholder={child.title}
          value={formatIfNeeded(child.format, record[child.dataIndex])}
          readOnly
          style={getCellStyle(child.dataIndex, record[child.dataIndex], record, true)}
        />,
        child.dataIndex,
        record
      );
    }

    // Select
    if (child.options) {
      return (
        <Select
          placeholder={child.title}
          value={record[child.dataIndex] ?? undefined}
          onChange={(value) => handleCellChange(value, idx, child.dataIndex as string)}
          options={child.options}
          disabled={!editable}
          style={{ width: "100%" }}
        />
      );
    }

    // Normal editable input
    return wrapManualCell(
      <Input
        placeholder={child.title}
        value={record[child.dataIndex] ?? ""}
        onChange={(e) => {
          const validated = validateAndFormatInput(e.target.value, child.type);
          handleCellChange(validated, idx, child.dataIndex as string);
        }}
        disabled={!editable}
        style={getCellStyle(child.dataIndex, record[child.dataIndex], record, false)}
      />,
      child.dataIndex,
      record
    );
  };

  // ── Render 1 cột đơn (không có children) ────────────────────────────────────
  const renderSingleColumn = (col: any, record: any, idx: number) => {
    // Không có SCADA data: editable → cho nhập tay, readonly → ô xám
    if (col.isEmpty) {
      if (!editable) return renderEmptySlot();
      return (
        <Input
          value={record[col.dataIndex ?? ""] ?? ""}
          onChange={(e) => {
            const validated = validateAndFormatInput(e.target.value, col.type);
            handleCellChange(validated, idx, col.dataIndex as string);
          }}
          style={{ backgroundColor: "#f5f5f5", textAlign: "right" }}
          placeholder="-"
        />
      );
    }

    if (readonlyFields.includes(String(col.dataIndex))) {
      return wrapManualCell(
        <Input
          placeholder={col.title}
          value={formatIfNeeded(col.format, record[col.dataIndex || ""])}
          readOnly
          style={getCellStyle(col.dataIndex as string, record[col.dataIndex || ""], record, true)}
        />,
        col.dataIndex as string,
        record
      );
    }

    // Cột giờ: chọn qua TimePicker thay vì gõ tay, tránh sai định dạng
    if (col.type === "time") {
      const timeValue = record[col.dataIndex ?? ""];
      return wrapManualCell(
        <TimePicker
          style={{ width: "100%" }}
          format="HH:mm:ss"
          value={timeValue ? dayjs(timeValue, "HH:mm:ss") : null}
          onChange={(_, timeString) =>
            handleCellChange(typeof timeString === "string" ? timeString : "", idx, col.dataIndex as string)
          }
          disabled={!editable}
          allowClear
          placeholder={col.title}
        />,
        col.dataIndex as string,
        record
      );
    }

    if (col.options) {
      return (
        <Select
          placeholder={col.title}
          value={record[col.dataIndex ?? ""] ?? undefined}
          onChange={(value) => handleCellChange(value, idx, col.dataIndex as string)}
          options={col.options}
          disabled={!editable}
          style={{ width: "100%" }}
        />
      );
    }

    return wrapManualCell(
      <Input
        placeholder={col.title}
        value={record[col.dataIndex ?? ""] ?? ""}
        onChange={(e) => {
          const validated = validateAndFormatInput(e.target.value, col.type);
          handleCellChange(validated, idx, col.dataIndex as string);
        }}
        disabled={!editable}
        style={getCellStyle(col.dataIndex as string, record[col.dataIndex ?? ""], record, false)}
      />,
      col.dataIndex as string,
      record
    );
  };

  const tableColumns = [
    ...columns.map((col) => {
      // Có children → nhóm cột
      if (col.children) {
        return {
          title: col.title,
          width: col.width,
          fixed: col.fixed,
          children: col.children.map((child) => ({
            title: child.title,
            dataIndex: child.dataIndex,
            width: child.width,
            render: (_: any, record: any, idx: number) =>
              renderChildColumn(child, record, idx),
          })),
        };
      }

      // Label column
      if (col.isLabel) {
        return {
          title: col.title,
          dataIndex: col.dataIndex,
          width: col.width,
          render: (_: any, record: any) => (
            <div style={{ paddingLeft: 8, backgroundColor: !editable ? "#fffbe6" : undefined }}>
              {record[col.dataIndex || ""]}
            </div>
          ),
        };
      }

      // Index column
      if ((col as any).type === "index") {
        return {
          title: col.title,
          dataIndex: col.dataIndex,
          width: col.width,
          fixed: col.fixed,
          render: (col as any).render,
        };
      }

      // Cột đơn thông thường (hoặc isEmpty)
      return {
        title: col.title,
        dataIndex: col.dataIndex,
        width: col.width,
        fixed: col.fixed,
        render: (_: any, record: any, idx: number) =>
          renderSingleColumn(col, record, idx),
      };
    }),

    ...(showStatus ? [{
      title: "Tình trạng",
      key: "status",
      width: 160,
      render: (_: any, record: any) => {
        const t = record.tinhTrang;
        const text = t === 1 ? "Đã chuyển hết" : t === 2 ? "Đã chuyển 1 phần" : "Chưa chuyển";
        const color = t === 1 ? "green" : t === 2 ? "orange" : "default";
        return <Tag color={color}>{text}</Tag>;
      },
    }] : []),

    ...(showDeleteButton ? [{
      title: "Thao tác",
      key: "action",
      width: 80,
      render: (_: any, _record: any, rowIndex: number) => (
        <Space>
          <Popconfirm
            title="Bạn có chắc chắn muốn xóa dòng này?"
            okText="Xóa"
            cancelText="Hủy"
            onConfirm={() => handleDeleteRow(rowIndex)}
            disabled={rows.length <= minRows}
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              size="small"
              disabled={rows.length <= minRows}
            />
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ];

  return (
    <div>
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "200px" }}>
          <Spin size="large" tip="Đang tải dữ liệu từ API..." />
        </div>
      ) : (
        <>
          {!(compactWhenEmpty && (!rows || rows.length === 0)) && (
            <Table
              bordered
              pagination={false}
              className={className}
              size="small"
              columns={tableColumns}
              dataSource={rows}
              rowKey={(record, index) => record?.key ?? record?.id ?? index}
              style={{ marginTop: 12 }}
              scroll={{ x: "max-content", y: scrollY }}
              sticky={stickyHeader}
              summary={summary}
              onRow={onRow}
              rowSelection={
                selectionEnabled ? {
                  selectedRowKeys: selectedRowKeys as any,
                  onChange: (keys, selected) => {
                    const typedKeys = (selected as any[]).map((record, idx) =>
                      record?.key ?? record?.id ?? keys[idx]
                    );
                    onSelectionChange?.(typedKeys as any, selected as any);
                  },
                  getCheckboxProps: (record: any) => ({
                    disabled: isRowSelectable ? !isRowSelectable(record) : false,
                  }),
                } : undefined
              }
            />
          )}
          {showAddButton && editable && (
            <Button onClick={handleAddRow} type="dashed" className="my-2">
              {addRowButtonText}
            </Button>
          )}
          {onRefresh && (
            <Button onClick={onRefresh} style={{ marginLeft: 8 }} loading={loading}>
              Tải lại dữ liệu
            </Button>
          )}
        </>
      )}
    </div>
  );
}