import { useCallback, useState } from "react";
import { Button, Card, DatePicker, Form, Space, Table, Tooltip, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { STD_NXT_HRC1ServiceApi } from "../../../services/STD_NXT_HRC1ServiceApi";
import type { STD_NXT_HRC1_NhapXuatTonRow } from "../../../models/STD_NXT_HRC1_Model";
import { formatNumberVN } from "../../../utils/formatters/numberFormat";

const { Title } = Typography;
const { RangePicker } = DatePicker;

const formatNgay = (value?: string | null) => (value ? dayjs(value).format("DD/MM/YYYY") : "");
const formatCa = (value?: number | null) => (value === 1 ? "Ca Ngày" : value === 2 ? "Ca Đêm" : "");

const isMismatch = (row: STD_NXT_HRC1_NhapXuatTonRow) => {
  const { tonCuoiTruoc, tonDauSau } = row;
  if (tonCuoiTruoc == null || tonDauSau == null) return false;
  return Math.abs(tonCuoiTruoc - tonDauSau) > 0.001;
};

const renderKL = (value: number | null | undefined, row: STD_NXT_HRC1_NhapXuatTonRow) => {
  const mismatch = isMismatch(row);
  const formatted = formatNumberVN(value);
  if (!mismatch) return formatted;
  return (
    <Tooltip title="Không khớp với ca đối chiếu">
      <span style={{ backgroundColor: "#ffd6d6", display: "block", padding: "0 4px" }}>{formatted}</span>
    </Tooltip>
  );
};

const ThongKeNhapXuatTonHRC1 = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [tableData, setTableData] = useState<STD_NXT_HRC1_NhapXuatTonRow[]>([]);

  const handleSearch = useCallback(async () => {
    const values = form.getFieldsValue(true) as Record<string, unknown>;
    const dateRange = values.dateRange as [dayjs.Dayjs, dayjs.Dayjs] | undefined;
    const fromDate = dateRange?.[0];
    const toDate = dateRange?.[1];

    if (!fromDate || !toDate) {
      message.warning("Vui lòng chọn Từ ngày và Đến ngày.");
      return;
    }

    try {
      setLoading(true);
      const res = await STD_NXT_HRC1ServiceApi.searchNhapXuatTon({
        TuNgay: fromDate.format("YYYY-MM-DD"),
        DenNgay: toDate.format("YYYY-MM-DD"),
      });
      const rows = res?.data?.data ?? [];
      setTableData(rows);
      if (!rows.length) {
        message.info("Không có dữ liệu phù hợp với điều kiện lọc.");
      }
    } catch (error) {
      console.error("Lỗi thống kê Nhập Xuất Tồn HRC1:", error);
      message.error("Không thể tải dữ liệu thống kê.");
    } finally {
      setLoading(false);
    }
  }, [form]);

  const handleReset = useCallback(() => {
    form.resetFields();
    setTableData([]);
  }, [form]);

  const columns: ColumnsType<STD_NXT_HRC1_NhapXuatTonRow> = [
    {
      title: "Tồn cuối (phiếu ca trước)",
      children: [
        {
          title: "Ngày SX",
          dataIndex: "ngaySXTruoc",
          key: "ngaySXTruoc",
          width: 120,
          align: "center",
          render: formatNgay,
        },
        {
          title: "Ca",
          dataIndex: "caTruoc",
          key: "caTruoc",
          width: 100,
          align: "center",
          render: formatCa,
        },
        {
          title: "Phụ liệu",
          dataIndex: "phuLieuTruoc",
          key: "phuLieuTruoc",
          width: 200,
        },
        {
          title: "Khối lượng",
          dataIndex: "tonCuoiTruoc",
          key: "tonCuoiTruoc",
          width: 130,
          align: "right",
          render: (value, row) => renderKL(value, row),
        },
      ],
    },
    {
      title: "Tồn đầu (phiếu ca sau)",
      children: [
        {
          title: "Ngày SX",
          dataIndex: "ngaySXSau",
          key: "ngaySXSau",
          width: 120,
          align: "center",
          render: formatNgay,
        },
        {
          title: "Ca",
          dataIndex: "caSau",
          key: "caSau",
          width: 100,
          align: "center",
          render: formatCa,
        },
        {
          title: "Phụ liệu",
          dataIndex: "phuLieuSau",
          key: "phuLieuSau",
          width: 200,
        },
        {
          title: "Khối lượng",
          dataIndex: "tonDauSau",
          key: "tonDauSau",
          width: 130,
          align: "right",
          render: (value, row) => renderKL(value, row),
        },
      ],
    },
    {
      title: "Check",
      key: "check",
      width: 130,
      align: "right",
      render: (_, row: STD_NXT_HRC1_NhapXuatTonRow) => {
        const { tonCuoiTruoc, tonDauSau } = row;
        if (tonCuoiTruoc == null || tonDauSau == null) return "";
        const diff = Math.abs(tonDauSau - tonCuoiTruoc);
        const mismatch = diff > 0.001;
        const formatted = formatNumberVN(diff);
        if (!mismatch) return formatted;
        return (
          <Tooltip title="Không khớp với ca đối chiếu">
            <span
              style={{
                backgroundColor: "tomato",
                color: "#fff",
                display: "block",
                padding: "0 4px",
                borderRadius: 2,
              }}
            >
              {formatted}
            </span>
          </Tooltip>
        );
      },
    },
  ];

  return (
    <Card style={{ boxShadow: "0 2px 8px #f0f1f2", marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <Title level={3} style={{ textAlign: "center", flex: 1, marginBottom: 0 }}>
          THỐNG KÊ NHẬP XUẤT TỒN HRC1
        </Title>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#555" }}>
            <span
              style={{
                display: "inline-block",
                width: 14,
                height: 14,
                backgroundColor: "#ffd6d6",
                border: "1px solid #ccc",
                borderRadius: 2,
                flexShrink: 0,
              }}
            />
            Lệch tồn cuối / tồn đầu
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#555" }}>
            <span
              style={{
                display: "inline-block",
                width: 14,
                height: 14,
                backgroundColor: "tomato",
                border: "1px solid #ccc",
                borderRadius: 2,
                flexShrink: 0,
              }}
            />
            Check khác 0
          </div>
        </div>
      </div>

      <Form form={form} layout="inline" style={{ marginTop: 16 }}>
        <Space wrap align="center">
          <Form.Item name="dateRange" label="Từ ngày / Đến ngày">
            <RangePicker format="DD/MM/YYYY" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" onClick={() => void handleSearch()} loading={loading}>
                Tìm
              </Button>
              <Button onClick={handleReset}>Reset</Button>
            </Space>
          </Form.Item>
        </Space>
      </Form>

      <div style={{ marginTop: 24 }}>
        <Table
          bordered
          size="small"
          loading={loading}
          columns={columns}
          dataSource={tableData}
          rowKey={(row, idx) =>
            `${row.ngaySXTruoc ?? ""}_${row.caTruoc ?? ""}_${row.phuLieuTruoc ?? ""}_${row.ngaySXSau ?? ""}_${row.caSau ?? ""}_${row.phuLieuSau ?? ""}_${idx}`
          }
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ["10", "20", "50", "100"],
            showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} bản ghi`,
          }}
          scroll={{ x: "max-content", y: 500 }}
        />
      </div>
    </Card>
  );
};

export default ThongKeNhapXuatTonHRC1;
