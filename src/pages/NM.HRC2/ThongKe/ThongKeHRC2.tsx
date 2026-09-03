/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { dlnmHRC2Api } from "../../../services/DLNMHRC2Api";
import { formatNumberVN } from "../../../utils/formatters/numberFormat";
import {
  THONGKE_HRC2_HEADERS,
  type ThongKeHeaderColumn,
  type ThongKeLoaiBMKey,
} from "../../../utils/configs/thongKeHRC2HeaderConfig";
import ThongKeBBGNThepLong from "./ThongKeBBGNThepLong";
import { BM_CONFIG } from "../../../utils/configs/BieuMauConst";
import { getAllowedScope } from "../../../utils/helpers/checkAdminRole";
import ThongKeNhapXuatTonHRC2 from "./ThongKeNhapXuatTonHRC2";

const { Title } = Typography;
const { RangePicker } = DatePicker;

type HkCellData = {
  value: number | null;
  manualValue?: number | null;
  klPhanBo?: number | null;
  totalKLPhuGia?: number | null;
  isManual?: boolean;
};

const renderHkCell = (cellData: HkCellData | null | unknown) => {
  if (cellData === null || cellData === undefined) return "";
  const { value, manualValue, klPhanBo, totalKLPhuGia, isManual } = cellData as HkCellData;

  // isManual=true → dùng manualValue (null nếu user đã xóa → show "0")
  // isManual=false/undefined → dùng value (giá trị NM gốc)
  const effectiveValue = isManual ? (manualValue ?? 0) : value;
  const displayValue = totalKLPhuGia ?? effectiveValue;
  const formatted = formatNumberVN(displayValue);

  const hasPhanBo = klPhanBo != null;
  // hasManual = true khi có giá trị chỉnh tay, hoặc isManual=true (kể cả khi user đã xóa → manualValue=null)
  const hasManual = isManual === true || manualValue != null;

  if (hasPhanBo || hasManual) {
    const tooltipParts: string[] = [];
    tooltipParts.push(`Tự động: ${formatNumberVN(value)}`);
    if (manualValue != null) tooltipParts.push(`Chỉnh tay: ${formatNumberVN(manualValue)}`);
    else if (isManual) tooltipParts.push(`Chỉnh tay: (đã xóa)`);
    if (hasPhanBo) tooltipParts.push(`Phân bổ: ${formatNumberVN(klPhanBo)}`);

    const bg = hasPhanBo && hasManual ? "#d4edda" : hasPhanBo ? "#d6f0ff" : "#fff7b3";
    return (
      <Tooltip title={tooltipParts.join(" | ")}>
        <span style={{ backgroundColor: bg, display: "block", padding: "0 4px" }}>
          {formatted}
        </span>
      </Tooltip>
    );
  }
  return formatted;
};

type LoaiBMKey = ThongKeLoaiBMKey;

const toAntdColumns = (cols: ThongKeHeaderColumn[]): any[] => {
  return cols.map((c) => {
    const mapped: any = {
      key: c.dataIndex,
      dataIndex: c.dataIndex,
      title: c.title,
      width: c.width,
      align: "right" as const,
    };

    if (c.dataIndex === "ngay") {
      mapped.render = (value: unknown) =>
        value ? dayjs(String(value)).format("DD/MM/YYYY") : "";
    }

    if (c.dataIndex === "klGangLongCCT" || c.dataIndex === "klThepPhe") {
      mapped.render = (value: unknown) => formatNumberVN(value);
    }

    if (c.dataIndex === "meThoi") {
      mapped.render = (value: unknown, record: any) => {
        const isTrung =
          record.isTrungMeThoi === true ||
          record.IsTrungMeThoi === true;
        return isTrung ? (
          <span style={{ backgroundColor: "tomato", color: "#fff", padding: "0 4px", borderRadius: 2, display: "block" }}>
            {String(value ?? "")}
          </span>
        ) : (
          String(value ?? "")
        );
      };
    }

    if (Array.isArray(c.children) && c.children.length > 0) {
      mapped.children = toAntdColumns(c.children);
    }
    return mapped;
  });
};

const deriveScopeLabel = (loai: LoaiBMKey, scopeRaw: unknown): string => {
  const scopeNum = Number(scopeRaw);
  if (!Number.isFinite(scopeNum)) return "";
  if (loai === "BOF") return `Lò thổi ${scopeNum}`;
  if (loai === "RH") return `RH${scopeNum}`;
  if (loai === "LF") return "LF";
  return String(scopeNum);
};


const CA_OPTIONS = [
  { value: 1, label: "Ca Ngày" },
  { value: 2, label: "Ca Đêm" },
];

const SCOPE_OPTIONS_BY_BM: Record<LoaiBMKey, { value: number; label: string }[]> =
  {
    BOF: [
      { value: 6, label: "Lò 6" },
      { value: 7, label: "Lò 7" },
    ],
    // RH: scope 1,2
    RH: [
      { value: 1, label: "Lò RH1" },
      { value: 2, label: "Lò RH2" },
    ],
    // LF: mặc định là 6
    LF: [{ value: 6, label: "Lò 6" }],
  };

type SumRowMap = Record<string, number | null>;

const flattenLeafColumns = (cols: any[]): any[] =>
  cols.flatMap((c) => (Array.isArray(c.children) ? flattenLeafColumns(c.children) : [c]));

const MAIN_TAB_SCOPE_MAP: Record<"tieuhao" | "bbgn", string> = {
  tieuhao: "TIEUHAO",
  bbgn: "BBGN",
};

const ThongKeHRC2 = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [sumLoading, setSumLoading] = useState(false);
  const [sumRow, setSumRow] = useState<SumRowMap>({});
  const [columns, setColumns] = useState<any[]>([]);
  const [tableData, setTableData] = useState<any[]>([]);
  const [loaiBmKey, setLoaiBmKey] = useState<LoaiBMKey>("BOF");
  const [activeSubTab, setActiveSubTab] = useState<LoaiBMKey | "NXT">("BOF");
  const [mainTabKey, setMainTabKey] = useState<"tieuhao" | "bbgn">("tieuhao");
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const allowedScope = useMemo(
    () => getAllowedScope(BM_CONFIG.HRC2.THONGKE_HRC2),
    []
  );

  const mainTabItems = useMemo(() => {
    const all: { key: "tieuhao" | "bbgn"; label: string }[] = [
      { key: "tieuhao", label: "Thống kê tiêu hao HRC2" },
      { key: "bbgn", label: "Thống kê BBGN thép lỏng" },
    ];
    if (allowedScope === null) return all;
    return all.filter((t) => allowedScope.includes(MAIN_TAB_SCOPE_MAP[t.key]));
  }, [allowedScope]);

  useEffect(() => {
    if (mainTabItems.length > 0 && !mainTabItems.some((t) => t.key === mainTabKey)) {
      setMainTabKey(mainTabItems[0].key);
    }
  }, [mainTabItems, mainTabKey]);

  const handleSearch = useCallback(
    async (overrideLoaiBm?: LoaiBMKey, page?: number, pageSize?: number) => {
      try {
        // Multi search: không bắt validate field nào
        const values = form.getFieldsValue(true) as Record<string, unknown>;
        const currentLoaiBm: LoaiBMKey = overrideLoaiBm ?? loaiBmKey ?? "BOF";

        const dateRange = values.dateRange as
          | [dayjs.Dayjs, dayjs.Dayjs]
          | undefined;
        const fromDate = dateRange?.[0] ?? null;

        const ca = values.ca as number | undefined;
        let scope = values.scope as number | undefined;

        // Quy ước Lò / Khu vực theo từng loại BM
        if (currentLoaiBm === "LF") {
          // LF mặc định là 6
          scope = 6;
        }
        const meThoiFilter = (values.meThoi as string | undefined)?.trim();
        const isDelete = (values.isDelete as boolean | undefined) === true;
        const isTrungMeThoi = (values.isTrungMeThoi as boolean | undefined) === true;

        // Cột cố định: không hardcode phụ liệu theo config nữa
        const configCols =
          THONGKE_HRC2_HEADERS[currentLoaiBm] as ThongKeHeaderColumn[];
        const fixedDataIndexes =
          currentLoaiBm === "BOF"
            ? new Set([
                "ngay",
                "ca",
                "kip",
                "loThoi",
                "meThoi",
                "macThep",
                "klGangLongCCT",
                "klThepPhe",
              ])
            : new Set(["ngay", "ca", "kip", "tinhLuyen", "meThoi", "macThep"]);
        const fixedCols = configCols.filter((c) => fixedDataIndexes.has(c.dataIndex));
        const fixedColumns = toAntdColumns(fixedCols);

        setLoading(true);

        const currentPage = page ?? 1;
        const currentPageSize = pageSize ?? pagination.pageSize;
        const toDate = dateRange?.[1] ?? null;

        const basePayload = {
          TuNgay: fromDate ? fromDate.format("YYYY-MM-DD") : null,
          DenNgay: toDate ? toDate.format("YYYY-MM-DD") : null,
          Ca: ca ?? undefined,
          LoaiBM: currentLoaiBm,
          Scope: scope ?? undefined,
          SearchText: meThoiFilter ?? undefined,
          IsDelete: isDelete || undefined,
          IsTrungMeThoi: isTrungMeThoi || undefined,
        };

        // Nếu có đủ TuNgay + DenNgay → BE tính sum toàn range, fire độc lập
        // Nếu không → FE tự tính từ trang hiện tại sau khi rows sẵn sàng
        const hasDateRange = !!(fromDate && toDate);
        setSumLoading(true);
        setSumRow({});
        if (hasDateRange) {
          dlnmHRC2Api.sumThongKe(basePayload).then((sumRes) => {
            const sp = sumRes as any;
            // BE trả trực tiếp array hoặc wrap trong SumValues
            const sumList: any[] = Array.isArray(sp)
              ? sp
              : (sp?.SumValues ?? sp?.sumValues ?? sp?.data ?? sp?.Data ?? []);
            const map: SumRowMap = {};
            sumList.forEach((sv: any) => {
              const hkId = sv?.idHeaderKey ?? sv?.IDHeaderKey ?? sv?.iDHeaderKey;
              const total = sv?.totalKLPhuGia ?? sv?.TotalKLPhuGia ?? sv?.KLPhuGia ?? sv?.kLPhuGia ?? sv?.klPhuGia;
              if (hkId != null) {
                map[`hk_${hkId}`] = total != null ? Number(total) : null;
              }
            });
            setSumRow(map);
          }).catch((err) => console.error("Lỗi sum thống kê:", err)).finally(() => setSumLoading(false));
        }

        const res = await dlnmHRC2Api.searchThongKe({
          ...basePayload,
          Page: currentPage,
          PageSize: currentPageSize,
        });

        const payload = res as any;

        const headerListRaw: any[] =
          (payload?.phuLieuHeaderTables as any[]) ||
          (payload?.PhuLieuHeaderTables as any[]) ||
          [];
        const headerList = headerListRaw
          .map((h: any) => ({
            idHeaderKey: Number(h?.iDHeaderKey ?? h?.IDHeaderKey ?? h?.idHeaderKey ?? 0),
            tenPhuLieu: String(h?.tenPhuLieu ?? h?.TenPhuLieu ?? "").trim(),
            loaiThongKe: h?.loaiThongKe ?? h?.LoaiThongKe,
          }))
          .filter((h: any) => h.idHeaderKey !== 0 && !!h.tenPhuLieu);

        const totalRecords: number =
          payload?.totalRecords ??
          payload?.TotalRecords ??
          payload?.totalCount ??
          payload?.TotalCount ??
          0;

        const rawList: any[] =
          (Array.isArray(payload?.data) && payload.data) ||
          (Array.isArray(payload?.Data) && payload.Data) ||
          [];

        const headerColumns: any[] = [
          ...fixedColumns,
          ...headerList.map((h: any) => ({
            key: `hk_${h.idHeaderKey}`,
            dataIndex: `hk_${h.idHeaderKey}`,
            title: h.tenPhuLieu,
            width: 90,
            align: "right" as const,
            render: (value: unknown) => renderHkCell(value),
          })),
        ];

        if (!rawList.length) {
          message.info("Không có dữ liệu phù hợp với điều kiện lọc.");
          setColumns(headerColumns);
          setTableData([]);
          setPagination({ current: currentPage, pageSize: currentPageSize, total: 0 });
          return;
        }

        const rows = rawList.map((item: any, idx: number) => {
          // Sau khi BE đơn giản hóa, mỗi item là HRC2ThongKeRow: { Data, Values }
          const dataObj = (item?.data ?? item?.Data ?? {}) as any;
          const valuesArr = (item?.values ??
            item?.Values ??
            []) as any[];

          const row: any = {
            key:
              dataObj?.report_NO ??
              dataObj?.REPORT_NO ??
              dataObj?.id ??
              dataObj?.ID ??
              idx,
          };

          const getFieldValue = (dataIndex: string): unknown => {
            const direct = (dataObj as any)?.[dataIndex];
            if (direct !== undefined && direct !== null) return direct;

            const pascal =
              dataIndex.charAt(0).toUpperCase() + dataIndex.slice(1);
            if (
              (dataObj as any)?.[pascal] !== undefined &&
              (dataObj as any)?.[pascal] !== null
            ) {
              return (dataObj as any)?.[pascal];
            }

            const upper = dataIndex.toUpperCase();
            if (
              (dataObj as any)?.[upper] !== undefined &&
              (dataObj as any)?.[upper] !== null
            ) {
              return (dataObj as any)?.[upper];
            }

            const lower = dataIndex.toLowerCase();
            if (
              (dataObj as any)?.[lower] !== undefined &&
              (dataObj as any)?.[lower] !== null
            ) {
              return (dataObj as any)?.[lower];
            }

            return null;
          };

          // Lookup giá trị theo IDHeaderKey từ Values
          const valueByHeaderKeyId = new Map<number, HkCellData>();
          valuesArr.forEach((v: any) => {
            const hkId: number | null | undefined =
              v?.iDHeaderKey ??
              v?.IDHeaderKey ??
              v?.idHeaderKey ??
              v?.IdHeaderKey ??
              v?.id_headerKey ??
              v?.ID_HeaderKey;
            if (!hkId) return;

            const toNum = (raw: unknown): number | null => {
              if (raw === null || raw === undefined) return null;
              const n = Number(raw);
              return Number.isFinite(n) ? n : null;
            };

            const value     = toNum(v?.kLPhuGia ?? v?.KLPhuGia ?? v?.klPhuGia);
            const manualValue = toNum(v?.klPhuGia_Manual ?? v?.KLPhuGia_Manual);
            const klPhanBo  = toNum(v?.kLPhanBo ?? v?.KLPhanBo ?? v?.klPhanBo);
            const totalKLPhuGia = toNum(v?.totalKLPhuGia ?? v?.TotalKLPhuGia);
            const isManual  = v?.isManual === true || v?.IsManual === true;

            valueByHeaderKeyId.set(Number(hkId), { value, manualValue, klPhanBo, totalKLPhuGia, isManual });
          });

          // Set các field cố định
          fixedCols.forEach((c) => {
            const di = c.dataIndex;
            if (di === "loThoi" || di === "tinhLuyen") return;
            row[di] = getFieldValue(di);
          });

          // BOF: gộp klThepPheGang vào klThepPhe, hiển thị 1 cột duy nhất
          if (currentLoaiBm === "BOF") {
            const v1 = Number(row.klThepPhe ?? 0);
            const v2 = Number(getFieldValue("klThepPheGang") ?? 0);
            const sum = v1 + v2;
            row.klThepPhe = sum !== 0 ? sum : null;
          }

          row.isNM = getFieldValue("isNM");
          row.isTrungMeThoi = getFieldValue("isTrungMeThoi");

          // Set các cột phụ liệu theo headers trả về từ BE (theo IDHeaderKey)
          headerList.forEach((h: any) => {
            const di = `hk_${h.idHeaderKey}`;
            row[di] = valueByHeaderKeyId.get(h.idHeaderKey) ?? null;
            // null nếu không có giá trị
          });

          const scopeValue = (dataObj as any)?.scope ?? (dataObj as any)?.Scope;
          row.loThoi = row.loThoi ?? deriveScopeLabel(currentLoaiBm, scopeValue);
          row.tinhLuyen =
            row.tinhLuyen ?? deriveScopeLabel(currentLoaiBm, scopeValue);

          return row;
        });

        // FE tính sum từ trang hiện tại khi không có dateRange
        if (!hasDateRange) {
          const localSum: SumRowMap = {};
          rows.forEach((row) => {
            Object.keys(row).forEach((key) => {
              if (!key.startsWith("hk_")) return;
              const cell = row[key] as HkCellData | null;
              if (!cell) return;
              const effectiveVal = cell.isManual ? cell.manualValue : cell.value;
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
          current: payload?.page ?? payload?.Page ?? currentPage,
          pageSize: payload?.pageSize ?? payload?.PageSize ?? currentPageSize,
          total: totalRecords || rows.length,
        });
      } catch (error) {
        console.error("Lỗi thống kê HRC2:", error);
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
    void handleSearch(loaiBmKey, 1, pagination.pageSize);
  }, [form, handleSearch, loaiBmKey, pagination.pageSize]);

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
    let scope = values.scope as number | undefined;

    // LF: scope mặc định là 6 (giống handleSearch)
    if (loaiBmKey === "LF") {
      scope = 6;
    }
    const meThoiFilter = (values.meThoi as string | undefined)?.trim();
    const isDelete = (values.isDelete as boolean | undefined) === true;

    const payload: Record<string, unknown> = {
      TuNgay: fromDate.format("YYYY-MM-DD"),
      DenNgay: toDate.format("YYYY-MM-DD"),
      Ca: ca ?? undefined,
      LoaiBM: loaiBmKey,
      Scope: scope ?? undefined,
      SearchText: meThoiFilter ?? undefined,
      IsDelete: isDelete || undefined,
    };

    try {
      setLoading(true);
      const baseUrl = import.meta.env.VITE_API_URL as string;
      const token = localStorage.getItem("token");

      const res = await fetch(`${baseUrl}api/DLNMHRC2/export-thongke`, {
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

      let fileName = `ThongKe_HRC2_${loaiBmKey}_${fromDate.format(
        "YYYYMMDD"
      )}_${toDate.format("YYYYMMDD")}.xlsx`;
      const contentDisposition = res.headers.get("Content-Disposition");
      if (contentDisposition) {
        const match = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(
          contentDisposition
        );
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
      const msg =
        (error as { message?: string })?.message ??
        "Xuất Excel thất bại. Vui lòng thử lại.";
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [form, loaiBmKey]);

  const handleTabChange = useCallback(
    (key: string) => {
      const bmKey = key as LoaiBMKey;
      setLoaiBmKey(bmKey);
      // Cập nhật lại scope theo loại BM (LF mặc định 6, BOF/RH để trống cho người dùng chọn)
      if (bmKey === "LF") {
        form.setFieldsValue({ scope: 6 });
      } else {
        form.setFieldsValue({ scope: undefined });
      }
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
      setActiveSubTab(key as LoaiBMKey);
      handleTabChange(key);
    },
    [handleTabChange]
  );

  return (
    <div style={{ margin: 2 }}>
      <Tabs
        activeKey={mainTabKey}
        onChange={(k) => setMainTabKey(k as "tieuhao" | "bbgn")}
        items={mainTabItems}
      />

      {mainTabKey === "bbgn" ? (
        <ThongKeBBGNThepLong />
      ) : (
    <Card style={{ boxShadow: "0 2px 8px #f0f1f2" }}>
      <Title level={3} style={{ textAlign: "center", marginBottom: 24 }}>
        BẢNG TỔNG HỢP DỮ LIỆU TIÊU HAO HRC2
      </Title>

      {/* Tabs chọn loại BM + chú thích màu sắc */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <Tabs
          activeKey={activeSubTab}
          onChange={handleSubTabChange}
          style={{ flex: 1 }}
          items={[
            { key: "BOF", label: "BOF" },
            { key: "LF", label: "LF" },
            { key: "RH", label: "RH" },
            { key: "NXT", label: "Nhập Xuất Tồn" },
          ]}
        />
        {activeSubTab !== "NXT" && (
          <div style={{ display: "flex", gap: 12, alignItems: "center", paddingTop: 10, flexShrink: 0 }}>
            {[
              { bg: "#fff7b3", label: "Chỉnh tay" },
              { bg: "#d6f0ff", label: "Phân bổ" },
              { bg: "#d4edda", label: "Phân bổ + Chỉnh tay" },
            ].map(({ bg, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#555" }}>
                <span style={{ display: "inline-block", width: 14, height: 14, backgroundColor: bg, border: "1px solid #ccc", borderRadius: 2, flexShrink: 0 }} />
                {label}
              </div>
            ))}
          </div>
        )}
      </div>

      {activeSubTab === "NXT" ? (
        <ThongKeNhapXuatTonHRC2 />
      ) : (
        <>
          {/* Khu vực search (các ô tô đỏ trong Excel) */}
          <Form form={form} layout="inline" style={{ marginTop: 8 }}>
            <Space wrap align="center">
              <Form.Item
                name="dateRange"
                label="Từ ngày LT / Đến ngày LT"
              >
                <RangePicker format="DD/MM/YYYY" />
              </Form.Item>

              <Form.Item name="ca" label="Ca LT">
                <Select
                  allowClear
                  options={CA_OPTIONS}
                  placeholder="-- Ca --"
                  style={{ minWidth: 120 }}
                />
              </Form.Item>

              <Form.Item name="scope" label="Lò / Khu vực">
                <Select
                  allowClear
                  options={SCOPE_OPTIONS_BY_BM[loaiBmKey]}
                  placeholder={loaiBmKey === "LF" ? "Lò 6 (mặc định)" : "-- Lò --"}
                  style={{ minWidth: 150 }}
                />
              </Form.Item>

              <Form.Item name="kip" label="Kíp LT">
                <Select
                  allowClear
                  placeholder="-- Kíp --"
                  options={[
                    { value: "A", label: "Kíp A" },
                    { value: "B", label: "Kíp B" },
                    { value: "C", label: "Kíp C" },
                  ]}
                  style={{ minWidth: 140 }}
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
                  <Button
                    type="primary"
                    onClick={() => void handleSearch()}
                    loading={loading}
                  >
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

          {/* Bảng thống kê */}
          <style>{`.row-not-nm td { background-color: #fffbe6 !important; }`}</style>
          <div style={{ marginTop: 24 }}>
            <Table
              bordered
              size="small"
              loading={loading}
              columns={columns}
              dataSource={tableData}
              rowClassName={(record) => record.isNM === false ? "row-not-nm" : ""}
              pagination={{
                current: pagination.current,
                pageSize: pagination.pageSize,
                total: pagination.total,
                showSizeChanger: true,
                showQuickJumper: true,
                pageSizeOptions: ["10", "20", "50", "100"],
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} của ${total} bản ghi`,
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
                        const isHkCol = di.startsWith("hk_");
                        if (!isHkCol) {
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
      )}
    </div>
  );
};

export default ThongKeHRC2;
