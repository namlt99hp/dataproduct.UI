import React, { useState, useEffect, type ReactNode } from "react";
import {
  Table,
  Button,
  Input,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
  Tooltip,
} from "antd";
import { DeleteOutlined, CopyOutlined } from "@ant-design/icons";

export interface FormColumnDef {
  title: string;
  dataIndex?: string;
  isLabel?: boolean;
  width?: number | string;
  fixed?: "left" | "right";
  format?: string;
  type?: "text" | "number" | "float" | "index" | string;
  min?: number;
  readonly?: boolean;
  editable?: boolean;
  sum?: boolean;
  align?: "left" | "center" | "right";
  options?: Array<{ label: string; value: string | number }>;
  /** Nested header groups — hỗ trợ đệ quy nhiều cấp */
  children?: FormColumnDef[];
  /** Override toàn bộ cell render cho cột này */
  renderCell?: (
    record: any,
    idx: number,
    onChange: (val: any) => void,
    disabled: boolean,
  ) => ReactNode;
}

interface CustomFormTableProps {
  columns: FormColumnDef[];
  initialData?: any[];
  onDataChange?: (data: any[]) => void;
  className?: string;
  addRowButtonText?: string;
  showAddButton?: boolean;
  showDeleteButton?: boolean;
  minRows?: number; // Số dòng tối thiểu
  editable?: boolean; // Cho phép nhập tay hay không
  // Parent control
  loading?: boolean; // Loading state từ parent
  onRefresh?: () => void; // Callback để refresh data từ parent
  selectionEnabled?: boolean;
  selectedRowKeys?: Array<string | number>;
  onSelectionChange?: (keys: Array<string | number>, rows: any[]) => void;
  isRowSelectable?: (row: any) => boolean;
  showStatus?: boolean;
  readonlyFields?: string[];
  scrollY?: number;
  stickyHeader?: boolean;
  onCellChange?: (
    rowIndex: number,
    dataIndex: string,
    value: any,
    row: any,
  ) => void;
  compactWhenEmpty?: boolean; // Nếu true, khi không có dòng sẽ không chiếm nhiều chiều cao
  summary?: (data: readonly any[]) => React.ReactNode;
  // Nếu dataIndex khớp pattern này → tự động lưu _manual_{di}=true + _goc_{di}=oldVal khi người dùng sửa
  manualTrackPattern?: RegExp;
  onRow?: (record: any, index?: number) => any;
  showCloneButton?: boolean;
  cloneRowButtonText?: string;
  showRowCloneButton?: boolean;
  /** Trả về style bổ sung và tooltip cho một ô cụ thể. */
  cellDecorator?: (
    dataIndex: string,
    record: any,
  ) =>
    | { style?: React.CSSProperties; tooltip?: string | null }
    | null
    | undefined;
  /** Render nút hành động tùy chỉnh per-row, hiển thị ở cột "Thao tác" cuối bảng. */
  rowActions?: (record: any, rowIndex: number) => React.ReactNode;
  /** Trả về true nếu ô (dataIndex, record) là readonly — ưu tiên cao hơn col.readonly. */
  readonlyCellGetter?: (dataIndex: string, record: any) => boolean;
}

export default function CustomFormTable({
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
  showCloneButton = false,
  cloneRowButtonText = "+ Nhân dòng trên",
  showRowCloneButton = false,
  cellDecorator,
  rowActions,
  readonlyCellGetter,
}: CustomFormTableProps) {
  // Validate và filter input theo type
  const validateAndFormatInput = (
    value: string,
    type?: "text" | "number" | "float",
    min?: number,
  ): string => {
    if (!type || type === "text") return value;

    if (type === "number") {
      // Chỉ cho phép số nguyên dương, dấu âm ở đầu, không cho dấu thập phân
      return value
        .replace(/[^0-9-]/g, "")
        .replace(/^-+/, (m) => (m.length === 1 ? "-" : "-"));
    }

    if (type === "float") {
      const allowNegative = min === undefined || min < 0;
      const normalized = allowNegative
        ? value.replace(/\s+/g, "")
        : value.replace(/\s+/g, "").replace(/-/g, "");
      const pattern = allowNegative ? /^-?[\d.]*$/ : /^[\d.]*$/;
      const match = normalized.match(pattern);
      if (!match)
        return normalized.replace(allowNegative ? /[^0-9.-]/g : /[^0-9.]/g, "");

      // Chỉ cho phép một dấu chấm
      const parts = normalized.split(".");
      if (parts.length > 2) {
        return (parts[0] || "0") + "." + parts.slice(1).join("").slice(0, 3);
      }

      // Giới hạn tối đa 3 chữ số thập phân
      if (parts.length === 2 && parts[1].length > 3) {
        return parts[0] + "." + parts[1].slice(0, 3);
      }

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
    const rounded = Math.round(n * 1000) / 1000;
    const sign = rounded < 0 ? "-" : "";
    const abs = Math.abs(rounded);
    const [intPartRaw, fracRaw] = abs.toFixed(3).split(".");
    const intPart = intPartRaw.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return `${sign}${intPart}.${fracRaw}`;
  };

  const formatFloat3dp = (value: unknown): string => {
    if (value === null || value === undefined || value === "") return "";
    const raw = String(value).trim();
    if (!raw) return "";
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n)) return raw;
    const rounded = Math.round(n * 1000) / 1000;
    const sign = rounded < 0 ? "-" : "";
    const abs = Math.abs(rounded);
    const [intPart, fracPart] = abs.toFixed(3).split(".");
    return `${sign}${intPart}.${fracPart}`;
  };

  const formatIfNeeded = (format: unknown, value: unknown): string => {
    if (format === "number-group") return formatNumberGroup(value);
    return value === null || value === undefined ? "" : String(value);
  };

  const [rows, setRows] = useState(initialData);

  const getCellStyle = (
    dataIndex: string | number,
    value: any,
    row?: any,
    readonly?: boolean,
  ) => {
    const style: any = {};
    style.textAlign = "right";
    if (readonly || !editable) style.backgroundColor = "#fffbe6";
    if (String(dataIndex) === "stChuaChuyen" && Number(value) > 0) {
      style.backgroundColor = "#fff1f0";
      style.borderColor = "#ff4d4f";
    }

    const key = String(dataIndex || "");
    if (key.toLowerCase().startsWith("stdachuyen")) {
      const suffix = key.substring("stDachuyen".length);
      const sourceKey = `st${suffix}`;
      const sourceVal = Number(row?.[sourceKey] ?? 0);
      const transferredVal = Number(value ?? 0);

      if (
        !Number.isNaN(sourceVal) &&
        !Number.isNaN(transferredVal) &&
        sourceVal !== transferredVal
      ) {
        style.backgroundColor = "#fff1f0";
        style.borderColor = "#ff4d4f";
      }
    }

    return style;
  };

  /** Wrap một phần tử cell với Tooltip + style bổ sung từ cellDecorator */
  const wrapCell = (
    node: React.ReactElement,
    dataIndex: string,
    record: any,
    baseStyle: React.CSSProperties,
  ): React.ReactElement => {
    const deco = cellDecorator?.(dataIndex, record);
    if (!deco) return node;
    const decorated = deco.style
      ? React.cloneElement(
          node as React.ReactElement<{ style?: React.CSSProperties }>,
          { style: { ...baseStyle, ...deco.style } },
        )
      : node;
    if (deco.tooltip) {
      return (
        <Tooltip title={deco.tooltip} color="#faad14">
          {decorated}
        </Tooltip>
      );
    }
    return decorated;
  };

  // Sync với initialData khi có thay đổi
  useEffect(() => {
    setRows(initialData || []);
  }, [initialData]);

  // Xử lý thêm dòng trong bảng
  const handleAddRow = () => {
    // Lấy danh sách các field của cột
    const fieldKeys = getAllFieldKeys(columns);

    // Tạo object mới
    const newRow: any = { key: Date.now() };
    fieldKeys.forEach((k: any) => {
      newRow[k] = ""; // hoặc null
    });

    const newRows = [...rows, newRow];
    setRows(newRows);
    onDataChange?.(newRows);
  };

  // Clone dòng cuối, thêm vào phía dưới
  const handleCloneLastRow = () => {
    if (rows.length === 0) {
      handleAddRow();
      return;
    }
    const lastRow = rows[rows.length - 1];
    const newRow = { ...lastRow, key: Date.now() };
    const newRows = [...rows, newRow];
    setRows(newRows);
    onDataChange?.(newRows);
  };

  // Clone 1 hàng cụ thể, chèn ngay bên dưới hàng đó
  const handleCloneRow = (rowIndex: number) => {
    const sourceRow = rows[rowIndex];
    const newRow = { ...sourceRow, key: Date.now() };
    const newRows = [
      ...rows.slice(0, rowIndex + 1),
      newRow,
      ...rows.slice(rowIndex + 1),
    ];
    setRows(newRows);
    onDataChange?.(newRows);
  };

  // Xử lý xóa dòng
  const handleDeleteRow = (rowIndex: number) => {
    if (rows.length <= minRows) {
      return; // Không cho xóa nếu đã đạt số dòng tối thiểu
    }
    const newRows = rows.filter((_, idx) => idx !== rowIndex);
    setRows(newRows);
    onDataChange?.(newRows);
  };

  // Lấy tất cả field keys từ columns (đệ quy, hỗ trợ nhiều cấp children)
  const getAllFieldKeys = (cols: FormColumnDef[]): string[] => {
    const keys: string[] = [];
    cols.forEach((col) => {
      if (col.children?.length) {
        keys.push(...getAllFieldKeys(col.children));
      } else if (col.dataIndex) {
        keys.push(col.dataIndex);
      }
    });
    return keys;
  };

  // Xử lý thay đổi dữ liệu trong ô
  const handleCellChange = (
    value: string,
    rowIndex: number,
    dataIndex: string,
  ) => {
    const newData = rows.map((r, i) => (i === rowIndex ? { ...r } : r));
    // Manual tracking: nếu dataIndex khớp pattern → lưu giá trị gốc lần đầu người dùng sửa
    if (manualTrackPattern?.test(dataIndex)) {
      const manualKey = `_manual_${dataIndex}`;
      const gocKey = `_goc_${dataIndex}`;
      if (!newData[rowIndex][manualKey]) {
        newData[rowIndex][gocKey] = newData[rowIndex][dataIndex] ?? null;
      }
      newData[rowIndex][manualKey] = true;
    }
    newData[rowIndex][dataIndex] = value;
    setRows(newData);
    onDataChange?.(newData);
    onCellChange?.(rowIndex, dataIndex, value, newData[rowIndex]);
  };

  // Sinh cột động từ config
  const tableColumns = [
    ...(showRowCloneButton && editable
      ? [
          {
            title: "",
            key: "rowClone",
            width: 40,
            fixed: "left" as const,
            render: (_: any, _record: any, rowIndex: number) => (
              <Button
                type="text"
                icon={<CopyOutlined />}
                size="small"
                title="Sao chép hàng này"
                onClick={() => handleCloneRow(rowIndex)}
              />
            ),
          },
        ]
      : []),
    ...columns.map((col) => {
      if (col.children) {
        return {
          title: col.title,
          width: col.width,
          fixed: col.fixed,
          children: col.children.map((child: FormColumnDef) => {
            const key = child.dataIndex ?? "";
            return {
              title: child.title,
              dataIndex: key,
              width: child.width,
              render: (_: any, record: any, idx: number) =>
                readonlyFields.includes(key) ? (
                  <Input
                    placeholder={child.title}
                    value={
                      (child as any)?.type === "float"
                        ? formatFloat3dp(record[key])
                        : formatIfNeeded((child as any)?.format, record[key])
                    }
                    readOnly
                    style={getCellStyle(key, record[key], record, true)}
                  />
                ) : (child as any).options ? (
                  <Select
                    placeholder={child.title}
                    value={record[key] ?? undefined}
                    onChange={(value) => {
                      handleCellChange(value, idx, key);
                    }}
                    options={(child as any).options}
                    disabled={!editable}
                    style={{ width: "100%" }}
                  />
                ) : (
                  <Input
                    placeholder={child.title}
                    value={record[key] ?? ""}
                    onChange={(e) => {
                      const validated = validateAndFormatInput(
                        e.target.value,
                        (child as any)?.type,
                        (child as any)?.min,
                      );
                      handleCellChange(validated, idx, key);
                    }}
                    onBlur={() => {
                      if ((child as any)?.type === "float") {
                        const v = record[key];
                        if (v !== "" && v != null) {
                          const n = Number(String(v).replace(",", "."));
                          if (Number.isFinite(n))
                            handleCellChange(
                              (Math.round(n * 1000) / 1000).toFixed(3),
                              idx,
                              key,
                            );
                        }
                      }
                    }}
                    disabled={!editable}
                    style={getCellStyle(key, record[key], record, false)}
                  />
                ),
            };
          }),
        };
      }

      if (col.isLabel) {
        return {
          title: col.title,
          dataIndex: col.dataIndex,
          width: col.width,
          render: (_: any, record: any) => (
            <div
              style={{
                paddingLeft: 8,
                backgroundColor: !editable ? "#fffbe6" : undefined,
              }}
            >
              {record[col.dataIndex || ""]}
            </div>
          ),
        };
      }

      if ((col as any).type === "index") {
        return {
          title: col.title,
          dataIndex: col.dataIndex,
          width: col.width,
          fixed: col.fixed,
          render: (col as any).render,
        };
      }

      const dataIndex = col.dataIndex as string;
      const isReadonly =
        col.readonly === true ||
        col.editable === false ||
        readonlyFields.includes(String(dataIndex));

      return {
        title: col.title,
        dataIndex,
        width: col.width,
        fixed: col.fixed,
        render: (_: any, record: any, idx: number) => {
          const isCellReadonly =
            isReadonly || readonlyCellGetter?.(dataIndex, record) === true;
          const baseStyleRo = getCellStyle(
            dataIndex,
            record[dataIndex],
            record,
            true,
          );
          if (isCellReadonly) {
            const displayVal =
              col.type === "float"
                ? formatFloat3dp(record[dataIndex])
                : formatIfNeeded(col.format, record[dataIndex]);
            return wrapCell(
              <Input
                placeholder={col.title}
                value={displayVal}
                readOnly
                style={baseStyleRo}
              />,
              dataIndex,
              record,
              baseStyleRo,
            );
          }
          if (col.renderCell) {
            return col.renderCell(
              record,
              idx,
              (val) => handleCellChange(val, idx, dataIndex),
              !editable,
            );
          }
          if (col.options) {
            return (
              <Select
                placeholder={col.title}
                value={record[dataIndex] ?? undefined}
                onChange={(value) => handleCellChange(value, idx, dataIndex)}
                options={col.options}
                disabled={!editable}
                style={{ width: "100%" }}
              />
            );
          }
          const baseStyle = getCellStyle(
            dataIndex,
            record[dataIndex],
            record,
            false,
          );
          return wrapCell(
            <Input
              placeholder={col.title}
              value={record[dataIndex] ?? ""}
              onChange={(e) => {
                const validated = validateAndFormatInput(
                  e.target.value,
                  col.type as "number" | "text" | "float" | undefined,
                  col.min,
                );
                handleCellChange(validated, idx, dataIndex);
              }}
              onBlur={() => {
                if (col.type === "float") {
                  const v = record[dataIndex];
                  if (v !== "" && v != null) {
                    const n = Number(String(v).replace(",", "."));
                    if (Number.isFinite(n))
                      handleCellChange(
                        (Math.round(n * 1000) / 1000).toFixed(3),
                        idx,
                        dataIndex,
                      );
                  }
                }
              }}
              disabled={!editable}
              style={baseStyle}
            />,
            dataIndex,
            record,
            baseStyle,
          );
        },
      };
    }),
    ...(showStatus
      ? [
          {
            title: "Tình trạng",
            key: "status",
            width: 160,
            render: (_: any, record: any) => {
              const t = record.tinhTrang;
              const text =
                t === 1
                  ? "Đã chuyển hết"
                  : t === 2
                    ? "Đã chuyển 1 phần"
                    : "Chưa chuyển";
              const color = t === 1 ? "green" : t === 2 ? "orange" : "default";
              return <Tag color={color}>{text}</Tag>;
            },
          },
        ]
      : []),
    ...(showDeleteButton
      ? [
          {
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
          },
        ]
      : []),
    ...(rowActions
      ? [
          {
            title: "Thao tác",
            key: "rowActions",
            width: 80,
            render: (_: any, record: any, rowIndex: number) =>
              rowActions(record, rowIndex),
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
                selectionEnabled
                  ? {
                      selectedRowKeys: selectedRowKeys as any,
                      onChange: (keys, selected) => {
                        // Keep selected keys in the original data type (number/string)
                        const typedKeys = (selected as any[]).map(
                          (record, idx) =>
                            record?.key ?? record?.id ?? keys[idx],
                        );
                        onSelectionChange?.(typedKeys as any, selected as any);
                      },
                      getCheckboxProps: (record: any) => ({
                        disabled: isRowSelectable
                          ? !isRowSelectable(record)
                          : false,
                      }),
                    }
                  : undefined
              }
            />
          )}
          {showAddButton && editable && (
            <Button onClick={handleAddRow} type="dashed" className="my-2">
              {addRowButtonText}
            </Button>
          )}
          {showCloneButton && editable && (
            <Button
              onClick={handleCloneLastRow}
              type="dashed"
              icon={<CopyOutlined />}
              className="my-2"
              style={{ marginLeft: showAddButton ? 8 : 0 }}
            >
              {cloneRowButtonText}
            </Button>
          )}
          {onRefresh && (
            <Button
              onClick={onRefresh}
              style={{ marginLeft: 8 }}
              loading={loading}
            >
              Tải lại dữ liệu
            </Button>
          )}
        </>
      )}
    </div>
  );
}
