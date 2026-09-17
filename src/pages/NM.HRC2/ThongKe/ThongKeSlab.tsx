/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { Button, Card, Col, DatePicker, Form, Row, Select, Table, Typography, message } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { Hrc2SlabApi, type ThongKeSlabRow } from "../../../services/Hrc2SlabApi";

const { Title } = Typography;

const KL_RENDER = (v: number) => (v ? Math.round(v).toLocaleString("vi-VN") : "");
const ST_RENDER = (v: number) => (v ? v.toLocaleString("vi-VN") : "");

// ── Cột "Phôi nóng": mỗi Loại gồm 2 cột con — giá trị (kg, "_kl") và số tấm ("_st") ─────────
const PHOI_NONG_COLUMNS: any[] = [
  { title: "Kích thước phôi", dataIndex: "pn_kichThuoc", width: 100, align: "center" },
  { title: "ST", dataIndex: "pn_kichThuoc_st", width: 50, align: "right", render: ST_RENDER },
  { title: "Loại 1", dataIndex: "pn_loai1_kl", width: 80, align: "right", render: KL_RENDER },
  { title: "ST", dataIndex: "pn_loai1_st", width: 50, align: "right", render: ST_RENDER },
  { title: "Loại 2", dataIndex: "pn_loai2_kl", width: 80, align: "right", render: KL_RENDER },
  { title: "ST", dataIndex: "pn_loai2_st", width: 50, align: "right", render: ST_RENDER },
  { title: "Loại 2 TPHH", dataIndex: "pn_loai2Tphh_kl", width: 90, align: "right", render: KL_RENDER },
  { title: "ST", dataIndex: "pn_loai2Tphh_st", width: 50, align: "right", render: ST_RENDER },
  { title: "Loại 3", dataIndex: "pn_loai3_kl", width: 80, align: "right", render: KL_RENDER },
  { title: "ST", dataIndex: "pn_loai3_st", width: 50, align: "right", render: ST_RENDER },
  { title: "Loại 3 TPHH", dataIndex: "pn_loai3Tphh_kl", width: 90, align: "right", render: KL_RENDER },
  { title: "ST", dataIndex: "pn_loai3Tphh_st", width: 50, align: "right", render: ST_RENDER },
  { title: "Ngắn dài", dataIndex: "pn_nganDai_kl", width: 80, align: "right", render: KL_RENDER },
  { title: "ST", dataIndex: "pn_nganDai_st", width: 50, align: "right", render: ST_RENDER },
];

// ── Cột "Phôi nguội": theo đúng thứ tự trong mẫu (Kích thước phôi nằm sau Loại 3 TPHH) ──────
// "Loại 2 giao thoa" và "Phế phẩm" chưa có nguồn dữ liệu — để trống, không tính toán.
const PHOI_NGUOI_COLUMNS: any[] = [
  { title: "Loại 1", dataIndex: "png_loai1_kl", width: 80, align: "right", render: KL_RENDER },
  { title: "ST", dataIndex: "png_loai1_st", width: 50, align: "right", render: ST_RENDER },
  { title: "Loại 2", dataIndex: "png_loai2_kl", width: 80, align: "right", render: KL_RENDER },
  { title: "ST", dataIndex: "png_loai2_st", width: 50, align: "right", render: ST_RENDER },
  { title: "Loại 2 TPHH", dataIndex: "png_loai2Tphh_kl", width: 90, align: "right", render: KL_RENDER },
  { title: "ST", dataIndex: "png_loai2Tphh_st", width: 50, align: "right", render: ST_RENDER },
  { title: "Loại 2 giao thoa", dataIndex: "png_loai2GiaoThoa_kl", width: 100, align: "right" },
  { title: "ST", dataIndex: "png_loai2GiaoThoa_st", width: 50, align: "right" },
  { title: "Loại 3", dataIndex: "png_loai3_kl", width: 80, align: "right", render: KL_RENDER },
  { title: "ST", dataIndex: "png_loai3_st", width: 50, align: "right", render: ST_RENDER },
  { title: "Loại 3 TPHH", dataIndex: "png_loai3Tphh_kl", width: 90, align: "right", render: KL_RENDER },
  { title: "Kích thước phôi", dataIndex: "png_kichThuoc", width: 100, align: "center" },
  { title: "ST", dataIndex: "png_kichThuoc_st", width: 50, align: "right", render: ST_RENDER },
  { title: "Ngắn dài", dataIndex: "png_nganDai_kl", width: 80, align: "right", render: KL_RENDER },
  { title: "ST", dataIndex: "png_nganDai_st", width: 50, align: "right", render: ST_RENDER },
  { title: "Phế phẩm", dataIndex: "png_phePham_kl", width: 80, align: "right" },
];

const THONGKE_SLAB_COLUMNS: any[] = [
  {
    title: "Ca",
    dataIndex: "ca",
    width: 60,
    align: "center",
    fixed: "left" as const,
    render: (v: number) => (v === 1 ? "Ca ngày" : v === 2 ? "Ca đêm" : v ?? "-"),
  },
  {
    title: "Ngày lên BBSL",
    dataIndex: "ngayLenBBSL",
    width: 100,
    align: "center",
    fixed: "left" as const,
    render: (v: string) => (v ? dayjs(v).format("DD/MM/YYYY") : "-"),
  },
  { title: "Kíp lên BBSL", dataIndex: "kipLenBBSL", width: 90, align: "center" },
  { title: "Hãng CXL", dataIndex: "hangCXL", width: 90, align: "center" },
  {
    title: "Máy đúc",
    dataIndex: "mayDuc",
    width: 70,
    align: "center",
    render: (v: number) => (v != null ? `Đúc ${v}` : "-"),
  },
  {
    title: "Lò",
    dataIndex: "lo",
    width: 60,
    align: "center",
    render: (v: number) => (v != null ? `Lò ${v}` : "-"),
  },
  { title: "Mác thép", dataIndex: "macThep", width: 100, align: "center" },
  { title: "Mẻ", dataIndex: "meThep", width: 100, align: "center" },
  { title: "LSX", dataIndex: "lsx", width: 90, align: "center" },
  { title: "% tiêu hao", dataIndex: "tyLeTieuHao", width: 80, align: "right" },
  {
    title: "Phôi tấm",
    children: [
      { title: "Phôi nóng", children: PHOI_NONG_COLUMNS },
      { title: "Phôi nguội", children: PHOI_NGUOI_COLUMNS },
    ],
  },
  { title: "Tổng sản lượng phôi", dataIndex: "tongSanLuongPhoi", width: 110, align: "right", render: KL_RENDER },
  { title: "GHI CHÚ", dataIndex: "ghiChu", width: 150, align: "left" },
  { title: "Check", dataIndex: "check", width: 70, align: "center" },
];

const ThongKeSlab = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  // Dữ liệu đã được BE gom nhóm (pivot) sẵn — FE chỉ render thẳng, không tự pivot nữa.
  const [data, setData] = useState<ThongKeSlabRow[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const columns = useMemo(() => THONGKE_SLAB_COLUMNS, []);

  const handleSearch = async (values: any) => {
    try {
      setLoading(true);
      const res = await Hrc2SlabApi.thongKeSlab({
        ngay: dayjs(values.ngay).format("YYYY-MM-DD"),
        ca: values.ca ?? null,
      });
      setData(res);
      setHasSearched(true);
    } catch (err: any) {
      message.error(err?.message ?? "Không thể tải dữ liệu!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card style={{ boxShadow: "0 2px 8px #f0f1f2" }}>
      <Title level={3} style={{ textAlign: "center", marginBottom: 24 }}>
        THỐNG KÊ SẢN LƯỢNG PHÔI TẤM
      </Title>

      <Card size="small" style={{ marginBottom: 12 }} bodyStyle={{ padding: "8px 12px" }}>
        <Form
          form={form}
          layout="vertical"
          size="small"
          initialValues={{ ngay: dayjs() }}
          onFinish={handleSearch}
        >
          <Row gutter={[12, 0]} align="bottom">
            <Col xs={12} sm={6} md={4}>
              <Form.Item name="ngay" label="Ngày" rules={[{ required: true, message: "Chọn ngày" }]}>
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" allowClear={false} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6} md={3}>
              <Form.Item name="ca" label="Ca">
                <Select allowClear placeholder="Tất cả ca">
                  <Select.Option value={1}>Ca Ngày</Select.Option>
                  <Select.Option value={2}>Ca Đêm</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col>
              <Form.Item>
                <Button type="primary" icon={<SearchOutlined />} htmlType="submit" loading={loading}>
                  Tìm
                </Button>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Table
        rowKey={(_, index) => index ?? 0}
        bordered
        size="small"
        loading={loading}
        columns={columns}
        dataSource={data}
        pagination={false}
        scroll={{ x: "max-content", y: 600 }}
        sticky={{ offsetHeader: 0 }}
        locale={{ emptyText: hasSearched ? "Không có dữ liệu" : "Chọn ngày và bấm Tìm" }}
      />
    </Card>
  );
};

export default ThongKeSlab;
