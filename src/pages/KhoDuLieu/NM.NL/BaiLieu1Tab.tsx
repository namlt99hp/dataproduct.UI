import { Button, Card, Col, DatePicker, Row, Table } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { nguyenlieuApi } from "../../../services/BKNguyenLieuApi";

interface CanBangTaiRow {
  year1: number;
  month1: number;
  date1: number;
  time1?: string;
  sod?: number;
  can?: string;
  loai?: string;
  totalW?: number; // SP trả double
  bgiao?: string;
  bnhan?: string;
}

const columns = [
  {
    title: "Ngày",
    key: "ngay",
    width: 110,
    render: (_: unknown, row: CanBangTaiRow) => {
      const y = row.year1;
      const m = String(row.month1).padStart(2, "0");
      const d = String(row.date1).padStart(2, "0");
      return `${d}/${m}/${y}`;
    },
  },
  {
    title: "Thời gian chốt",
    dataIndex: "time1",
    key: "time1",
    width: 130,
    render: (v?: string) => v ?? "-",
  },
  {
    title: "SOD",
    dataIndex: "sod",
    key: "sod",
    width: 80,
    render: (v?: number) => v ?? "-",
  },
  {
    title: "Tên Cân",
    dataIndex: "can",
    key: "can",
    ellipsis: true,
    render: (v?: string) => v ?? "-",
  },
  {
    title: "Loại NVL",
    dataIndex: "loai",
    key: "loai",
    ellipsis: true,
    render: (v?: string) => v ?? "-",
  },
  {
    title: "Tổng khối lượng",
    dataIndex: "totalW",
    key: "totalW",
    width: 150,
    align: "right" as const,
    render: (v?: number) =>
      v != null ? v.toLocaleString("vi-VN", { maximumFractionDigits: 4 }) : "-",
  },
  {
    title: "Bên giao",
    dataIndex: "bgiao",
    key: "bgiao",
    ellipsis: true,
    render: (v?: string) => v ?? "-",
  },
  {
    title: "Bên nhận",
    dataIndex: "bnhan",
    key: "bnhan",
    ellipsis: true,
    render: (v?: string) => v ?? "-",
  },
];

const BaiLieu1Tab = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CanBangTaiRow[]>([]);
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());

  const fetchData = async (date: Dayjs) => {
    setLoading(true);
    try {
      const res = await nguyenlieuApi.getCanBangTai(date.format("YYYY-MM-DD"));
      setData((res as unknown as CanBangTaiRow[]) ?? []);
    } catch (err) {
      console.error("Lỗi tải dữ liệu bãi liệu:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedDate);
  }, []);

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col>
            <DatePicker
              value={selectedDate}
              format="DD/MM/YYYY"
              onChange={(d) => d && setSelectedDate(d)}
              allowClear={false}
            />
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={() => fetchData(selectedDate)}
            >
              Lọc
            </Button>
          </Col>
        </Row>
      </Card>
      <Card>
        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey={(_, idx) => String(idx)}
          size="small"
          scroll={{ x: 900 }}
          pagination={{ pageSize: 50, showSizeChanger: true }}
        />
      </Card>
    </div>
  );
};

export default BaiLieu1Tab;
