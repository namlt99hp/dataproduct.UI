/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import {
  Card,
  Checkbox,
  Table,
  Tooltip,
  Typography,
  message,
  Form,
  DatePicker,
  Select,
  Input,
  Button,
  Tabs,
  Space,
} from "antd";
import dayjs from "dayjs";
import { dlnmHRC1Api } from "../../../services/DLNMHRC1Api";
import { formatNumberVN } from "../../../utils/formatters/numberFormat";
import {
  Header_TieuHaoLoThoi_HRC1,
  Header_TieuHaoTinhLuyen_LF_HRC1,
  type ThongKeHeaderColumn,
} from "../../../utils/configs/thongKeHRC1HeaderConfig";
import ThongKeNhapXuatTonHRC1 from "./ThongKeNhapXuatTonHRC1";

const { Title } = Typography;
const { RangePicker } = DatePicker;

type LoaiBmKey = "BOF" | "LF";

type PlCellData = {
  klPhuGia: number | null;
  klPhuGia_Manual?: number | null;
  klPhanBo?: number | null;
  totalKLPhuGia?: number | null;
  isManual?: boolean;
};

const getVal = <T,>(item: Record<string, unknown>, ...keys: string[]): T | null => {
  for (const key of keys) {
    const val = item[key];
    if (val !== undefined && val !== null) return val as T;
  }
  return null;
};

const renderPlCell = (cellData: PlCellData | null | unknown) => {
  if (cellData === null || cellData === undefined) return "";
  const { klPhuGia, klPhuGia_Manual, klPhanBo, totalKLPhuGia, isManual } = cellData as PlCellData;

  const effectiveValue = isManual ? klPhuGia_Manual : klPhuGia;
  const displayValue = totalKLPhuGia ?? effectiveValue;
  const formatted = formatNumberVN(displayValue);

  const hasPhanBo = klPhanBo != null;
  const hasManual = isManual === true || klPhuGia_Manual != null;

  if (hasPhanBo || hasManual) {
    const tooltipParts: string[] = [];
    tooltipParts.push(`Tự động: ${formatNumberVN(klPhuGia)}`);
    if (klPhuGia_Manual != null) tooltipParts.push(`Chỉnh tay: ${formatNumberVN(klPhuGia_Manual)}`);
    else if (isManual) tooltipParts.push(`Chỉnh tay: (đã xóa)`);
    if (hasPhanBo) tooltipParts.push(`Phân bổ: ${formatNumberVN(klPhanBo)}`);

    const bg = hasPhanBo && hasManual ? "#d4edda" : hasPhanBo ? "#d6f0ff" : "#fff7b3";
    return (
      <Tooltip title={tooltipParts.join(" | ")}>
        <span style={{ backgroundColor: bg, display: "block", padding: "0 4px" }}>{formatted}</span>
      </Tooltip>
    );
  }
  return formatted;
};

const SCOPE_LABEL_BY_BM: Record<LoaiBmKey, string> = {
  BOF: "Lò thổi",
  LF: "Tinh luyện",
};

const toAntdColumns = (cols: ThongKeHeaderColumn[], loaiBm: LoaiBmKey): any[] => {
  return cols.map((c) => {
    const mapped: any = {
      key: c.dataIndex,
      dataIndex: c.dataIndex,
      title: c.title,
      width: c.width,
      align: "right" as const,
    };

    if (c.dataIndex === "ngaySanXuat") {
      mapped.render = (value: unknown) => (value ? dayjs(String(value)).format("DD/MM/YYYY") : "");
    }

    if (c.dataIndex === "ca") {
      mapped.render = (value: unknown) => (value === 1 ? "Ca ngày" : value === 2 ? "Ca đêm" : "");
    }

    if (c.dataIndex === "scope") {
      mapped.render = (value: unknown) => (value != null ? `${SCOPE_LABEL_BY_BM[loaiBm]} ${value}` : "");
    }

    if (c.dataIndex === "klGang" || c.dataIndex === "klThepPhe" || c.dataIndex === "klThepLong") {
      mapped.render = (value: unknown) => formatNumberVN(value);
    }

    if (c.dataIndex === "meThoi") {
      mapped.render = (value: unknown, record: any) => {
        const isTrung = record.isTrungMeThoi === true;
        return isTrung ? (
          <span style={{ backgroundColor: "tomato", color: "#fff", padding: "0 4px", borderRadius: 2, display: "block" }}>
            {String(value ?? "")}
          </span>
        ) : (
          String(value ?? "")
        );
      };
    }

    return mapped;
  });
};

const CA_OPTIONS = [
  { value: 1, label: "Ca Ngày" },
  { value: 2, label: "Ca Đêm" },
];

const SCOPE_OPTIONS_BY_BM: Record<LoaiBmKey, { value: number; label: string }[]> = {
  BOF: [1, 2, 3, 4, 5].map((s) => ({ value: s, label: `Lò thổi ${s}` })),
  LF: [1, 2, 3, 4, 5].map((s) => ({ value: s, label: `Tinh luyện ${s}` })),
};

const HEADER_CONFIG_BY_BM: Record<LoaiBmKey, ThongKeHeaderColumn[]> = {
  BOF: Header_TieuHaoLoThoi_HRC1,
  LF: Header_TieuHaoTinhLuyen_LF_HRC1,
};

type SumRowMap = Record<string, number | null>;

const ThongKeTieuHaoHRC1 = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [sumLoading, setSumLoading] = useState(false);
  const [sumRow, setSumRow] = useState<SumRowMap>({});
  const [columns, setColumns] = useState<any[]>([]);
  const [tableData, setTableData] = useState<any[]>([]);
  const [loaiBmKey, setLoaiBmKey] = useState<LoaiBmKey>("BOF");
  const [activeSubTab, setActiveSubTab] = useState<LoaiBmKey | "NXT">("BOF");
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const handleSearch = useCallback(
    async (overrideLoaiBm?: LoaiBmKey, page?: number, pageSize?: number) => {
      try {
        const currentLoaiBm: LoaiBmKey = overrideLoaiBm ?? loaiBmKey ?? "BOF";
        const values = form.getFieldsValue(true) as Record<string, unknown>;

        const dateRange = values.dateRange as [dayjs.Dayjs, dayjs.Dayjs] | undefined;
        const fromDate = dateRange?.[0] ?? null;
        const toDate = dateRange?.[1] ?? null;
        const ca = values.ca as number | undefined;
        const scope = values.scope as number | undefined;
        const meThoiFilter = (values.meThoi as string | undefined)?.trim();
        const isDelete = (values.isDelete as boolean | undefined) === true;
        const isTrungMeThoi = (values.isTrungMeThoi as boolean | undefined) === true;

        const headerConfig = HEADER_CONFIG_BY_BM[currentLoaiBm];
        const fixedColumns = toAntdColumns(headerConfig, currentLoaiBm);

        setLoading(true);

        const currentPage = page ?? 1;
        const currentPageSize = pageSize ?? pagination.pageSize;

        const basePayload = {
          TuNgay: fromDate ? fromDate.format("YYYY-MM-DD") : null,
          DenNgay: toDate ? toDate.format("YYYY-MM-DD") : null,
          Ca: ca ?? undefined,
          BieuMau: currentLoaiBm,
          Scope: scope ?? undefined,
          SearchText: meThoiFilter ?? undefined,
          IsDelete: isDelete || undefined,
          IsTrungMeThoi: isTrungMeThoi || undefined,
        };

        const hasDateRange = !!(fromDate && toDate);
        setSumLoading(true);
        setSumRow({});
        if (hasDateRange) {
          dlnmHRC1Api
            .sumThongKe(basePayload)
            .then((sumRes) => {
              const sumList = (Array.isArray(sumRes) ? sumRes : []) as Record<string, unknown>[];
              const map: SumRowMap = {};
              sumList.forEach((sv) => {
                const plId = getVal<number>(sv, "phuLieuID", "PhuLieuID");
                const total = getVal<number>(sv, "totalKLPhuGia", "TotalKLPhuGia");
                if (plId != null) map[`pl_${plId}`] = total != null ? Number(total) : null;
              });
              setSumRow(map);
            })
            .catch((err) => console.error("Lỗi sum thống kê HRC1:", err))
            .finally(() => setSumLoading(false));
        }

        const res = await dlnmHRC1Api.searchThongKe({
          ...basePayload,
          Page: currentPage,
          PageSize: currentPageSize,
        });

        const payload = res as unknown as Record<string, unknown>;

        const headerListRaw = (getVal<unknown[]>(payload, "phuLieuHeaderTables", "PhuLieuHeaderTables") ?? []) as Record<
          string,
          unknown
        >[];
        const headerList = headerListRaw
          .map((h) => ({
            phuLieuID: getVal<number>(h, "phuLieuID", "PhuLieuID") ?? 0,
            tenPhuLieu: getVal<string>(h, "tenPhuLieu", "TenPhuLieu") ?? "",
          }))
          .filter((h) => h.phuLieuID > 0 && !!h.tenPhuLieu);

        const totalRecords = getVal<number>(payload, "totalRecords", "TotalRecords") ?? 0;
        const rawList = (getVal<unknown[]>(payload, "data", "Data") ?? []) as Record<string, unknown>[];

        const headerColumns: any[] = [
          ...fixedColumns,
          ...headerList.map((h) => ({
            key: `pl_${h.phuLieuID}`,
            dataIndex: `pl_${h.phuLieuID}`,
            title: h.tenPhuLieu,
            width: 90,
            align: "right" as const,
            render: (value: unknown) => renderPlCell(value),
          })),
        ];

        if (!rawList.length) {
          message.info("Không có dữ liệu phù hợp với điều kiện lọc.");
          setColumns(headerColumns);
          setTableData([]);
          setPagination({ current: currentPage, pageSize: currentPageSize, total: 0 });
          return;
        }

        const rows = rawList.map((item, idx) => {
          const dataObj = (getVal<Record<string, unknown>>(item, "data", "Data") ?? {}) as Record<string, unknown>;
          const valuesArr = (getVal<unknown[]>(item, "values", "Values") ?? []) as Record<string, unknown>[];

          const row: Record<string, unknown> = {
            key: getVal<number>(dataObj, "id", "ID") ?? idx,
          };

          headerConfig.forEach((c) => {
            const pascal = c.dataIndex.charAt(0).toUpperCase() + c.dataIndex.slice(1);
            row[c.dataIndex] = getVal(dataObj, c.dataIndex, pascal);
          });
          row.isNM = getVal<boolean>(dataObj, "isNM", "IsNM");
          row.isTrungMeThoi = getVal<boolean>(dataObj, "isTrungMeThoi", "IsTrungMeThoi") === true;

          const valueByPhuLieuId = new Map<number, PlCellData>();
          valuesArr.forEach((v) => {
            const plId = getVal<number>(v, "phuLieuID", "PhuLieuID");
            if (plId == null) return;
            valueByPhuLieuId.set(plId, {
              klPhuGia: getVal<number>(v, "klPhuGia", "KLPhuGia"),
              klPhuGia_Manual: getVal<number>(v, "klPhuGia_Manual", "KLPhuGia_Manual"),
              klPhanBo: getVal<number>(v, "klPhanBo", "KLPhanBo"),
              totalKLPhuGia: getVal<number>(v, "totalKLPhuGia", "TotalKLPhuGia"),
              isManual: getVal<boolean>(v, "isManual", "IsManual") === true,
            });
          });

          headerList.forEach((h) => {
            row[`pl_${h.phuLieuID}`] = valueByPhuLieuId.get(h.phuLieuID) ?? null;
          });

          return row;
        });

        if (!hasDateRange) {
          const localSum: SumRowMap = {};
          rows.forEach((row) => {
            Object.keys(row).forEach((key) => {
              if (!key.startsWith("pl_")) return;
              const cell = row[key] as PlCellData | null;
              if (!cell) return;
              const effectiveVal = cell.isManual ? cell.klPhuGia_Manual : cell.klPhuGia;
              const val = cell.totalKLPhuGia ?? effectiveVal;
              if (val != null) localSum[key] = (localSum[key] ?? 0) + val;
            });
          });
          setSumRow(localSum);
          setSumLoading(false);
        }

        setColumns(headerColumns);
        setTableData(rows);
        setPagination({
          current: getVal<number>(payload, "page", "Page") ?? currentPage,
          pageSize: getVal<number>(payload, "pageSize", "PageSize") ?? currentPageSize,
          total: totalRecords || rows.length,
        });
      } catch (error) {
        console.error("Lỗi thống kê tiêu hao HRC1:", error);
        message.error("Không thể tải dữ liệu thống kê.");
      } finally {
        setLoading(false);
      }
    },
    [form, loaiBmKey, pagination.pageSize]
  );

  useEffect(() => {
    void handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReset = useCallback(() => {
    form.resetFields();
    setColumns([]);
    setTableData([]);
    setSumRow({});
    setPagination({ current: 1, pageSize: pagination.pageSize, total: 0 });
  }, [form, pagination.pageSize]);

  const handleTabChange = useCallback(
    (key: string) => {
      const bmKey = key as LoaiBmKey;
      setLoaiBmKey(bmKey);
      form.resetFields();
      setColumns([]);
      setTableData([]);
      setSumRow({});
      void handleSearch(bmKey, 1, pagination.pageSize);
    },
    [form, handleSearch, pagination.pageSize]
  );

  const handleSubTabChange = useCallback(
    (key: string) => {
      if (key === "NXT") {
        setActiveSubTab("NXT");
        return;
      }
      setActiveSubTab(key as LoaiBmKey);
      handleTabChange(key);
    },
    [handleTabChange]
  );

  const handleExcel = useCallback(async () => {
    const values = form.getFieldsValue(true) as Record<string, unknown>;
    const dateRange = values.dateRange as [dayjs.Dayjs, dayjs.Dayjs] | undefined;
    const fromDate = dateRange?.[0];
    const toDate = dateRange?.[1];
    if (!fromDate || !toDate) {
      message.warning("Xuất Excel cần chọn Từ ngày và Đến ngày.");
      return;
    }
    const ca = values.ca as number | undefined;
    const scope = values.scope as number | undefined;
    const meThoiFilter = (values.meThoi as string | undefined)?.trim();
    const isDelete = (values.isDelete as boolean | undefined) === true;
    const isTrungMeThoi = (values.isTrungMeThoi as boolean | undefined) === true;

    const payload: Record<string, unknown> = {
      TuNgay: fromDate.format("YYYY-MM-DD"),
      DenNgay: toDate.format("YYYY-MM-DD"),
      Ca: ca ?? undefined,
      BieuMau: loaiBmKey,
      Scope: scope ?? undefined,
      SearchText: meThoiFilter ?? undefined,
      IsDelete: isDelete || undefined,
      IsTrungMeThoi: isTrungMeThoi || undefined,
    };

    try {
      setLoading(true);
      const baseUrl = import.meta.env.VITE_API_URL as string;
      const token = localStorage.getItem("token");

      const res = await fetch(`${baseUrl}api/DLNMHRC1/export-thongke`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Xuất Excel thất bại.");
      }

      const blob = await res.blob();
      let fileName = `ThongKe_HRC1_${loaiBmKey}_${fromDate.format("YYYYMMDD")}_${toDate.format("YYYYMMDD")}.xlsx`;
      const contentDisposition = res.headers.get("Content-Disposition");
      if (contentDisposition) {
        const match = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
        if (match && match[1]) {
          fileName = decodeURIComponent(match[1].replace(/['"]/g, ""));
        }
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: unknown) {
      const msg = (error as { message?: string })?.message ?? "Xuất Excel thất bại. Vui lòng thử lại.";
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [form, loaiBmKey]);

  const flattenLeafColumns = (cols: any[]): any[] =>
    cols.flatMap((c) => (Array.isArray(c.children) ? flattenLeafColumns(c.children) : [c]));

  return (
    <Card style={{ boxShadow: "0 2px 8px #f0f1f2" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <Title level={3} style={{ textAlign: "center", flex: 1, marginBottom: 0 }}>
          BẢNG TỔNG HỢP DỮ LIỆU TIÊU HAO HRC1
        </Title>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexShrink: 0 }}>
          {[
            { bg: "#fff7b3", label: "Chỉnh tay" },
            { bg: "#d6f0ff", label: "Phân bổ" },
            { bg: "#d4edda", label: "Phân bổ + Chỉnh tay" },
          ].map(({ bg, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#555" }}>
              <span
                style={{
                  display: "inline-block",
                  width: 14,
                  height: 14,
                  backgroundColor: bg,
                  border: "1px solid #ccc",
                  borderRadius: 2,
                  flexShrink: 0,
                }}
              />
              {label}
            </div>
          ))}
        </div>
      </div>

      <Tabs
        activeKey={activeSubTab}
        onChange={handleSubTabChange}
        style={{ marginTop: 8 }}
        items={[
          { key: "BOF", label: "BOF" },
          { key: "LF", label: "LF" },
          { key: "NXT", label: "Nhập Xuất Tồn" },
        ]}
      />

      {activeSubTab === "NXT" ? (
        <ThongKeNhapXuatTonHRC1 />
      ) : (
        <>
          <Form form={form} layout="inline" style={{ marginTop: 8 }}>
            <Space wrap align="center">
              <Form.Item name="dateRange" label="Từ ngày / Đến ngày">
                <RangePicker format="DD/MM/YYYY" />
              </Form.Item>

              <Form.Item name="ca" label="Ca">
                <Select allowClear options={CA_OPTIONS} placeholder="-- Ca --" style={{ minWidth: 120 }} />
              </Form.Item>

              <Form.Item name="scope" label={SCOPE_LABEL_BY_BM[loaiBmKey]}>
                <Select
                  allowClear
                  options={SCOPE_OPTIONS_BY_BM[loaiBmKey]}
                  placeholder={`-- ${SCOPE_LABEL_BY_BM[loaiBmKey]} --`}
                  style={{ minWidth: 150 }}
                />
              </Form.Item>

              <Form.Item name="meThoi" label="Mã mẻ thép">
                <Input placeholder="Nhập mã mẻ thép" style={{ minWidth: 160 }} />
              </Form.Item>

              <Form.Item name="isDelete" valuePropName="checked">
                <Checkbox>Đã xóa</Checkbox>
              </Form.Item>

              <Form.Item name="isTrungMeThoi" valuePropName="checked">
                <Checkbox>Mẻ trùng</Checkbox>
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button type="primary" onClick={() => void handleSearch()} loading={loading}>
                    Tìm
                  </Button>
                  <Button onClick={handleReset}>Reset</Button>
                  <Button type="primary" style={{ backgroundColor: "green" }} onClick={() => void handleExcel()}>
                    Excel
                  </Button>
                </Space>
              </Form.Item>
            </Space>
          </Form>

          <style>{`.row-not-nm td { background-color: #fffbe6 !important; }`}</style>
          <div style={{ marginTop: 24 }}>
            <Table
              bordered
              size="small"
              loading={loading}
              columns={columns}
              dataSource={tableData}
              rowClassName={(record: any) => (record.isNM === false ? "row-not-nm" : "")}
              pagination={{
                current: pagination.current,
                pageSize: pagination.pageSize,
                total: pagination.total,
                showSizeChanger: true,
                showQuickJumper: true,
                pageSizeOptions: ["10", "20", "50", "100"],
                showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} bản ghi`,
                onChange: (page, pageSize) => {
                  void handleSearch(undefined, page, pageSize);
                },
              }}
              scroll={{ x: "max-content", y: 500 }}
              summary={() => {
                const leafCols = flattenLeafColumns(columns);
                if (!leafCols.length) return null;
                return (
                  <Table.Summary fixed>
                    <Table.Summary.Row style={{ background: "#e6f4ff", fontWeight: 600 }}>
                      {leafCols.map((col, idx) => {
                        if (idx === 0) {
                          return (
                            <Table.Summary.Cell key={idx} index={idx} align="right">
                              Tổng
                            </Table.Summary.Cell>
                          );
                        }
                        const di: string = col.dataIndex ?? "";
                        if (!di.startsWith("pl_")) {
                          return <Table.Summary.Cell key={idx} index={idx} />;
                        }
                        if (sumLoading) {
                          return (
                            <Table.Summary.Cell key={idx} index={idx} align="right">
                              <span style={{ color: "#aaa" }}>...</span>
                            </Table.Summary.Cell>
                          );
                        }
                        const val = sumRow[di];
                        return (
                          <Table.Summary.Cell key={idx} index={idx} align="right">
                            {val != null ? formatNumberVN(val) : ""}
                          </Table.Summary.Cell>
                        );
                      })}
                    </Table.Summary.Row>
                  </Table.Summary>
                );
              }}
            />
          </div>
        </>
      )}
    </Card>
  );
};

export default ThongKeTieuHaoHRC1;
