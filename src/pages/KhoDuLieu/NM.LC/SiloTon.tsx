import {
  AutoComplete,
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  message,
} from "antd";
import { PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { LcSiloTonApi } from "../../../services/LcDanhMucApi";
import type { LcSiloTon, LcSiloTonPayload } from "../../../models/LcDanhMucModel";
import { ThanhPhamEnum, LoaiLieuSiloTonEnum } from "../../../models/LcDanhMucModel";
import CongThucCalculatorInput from "../../../components/LC_BCSX_XNL/CongThucCalculatorInput";

type ErrorLike = { message?: unknown; Message?: unknown };

const getErrorMessage = (error: unknown): string | undefined => {
  if (!error) return undefined;
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    const errObj = error as ErrorLike;
    if (typeof errObj.message === "string") return errObj.message;
    if (typeof errObj.Message === "string") return errObj.Message;
  }
  return undefined;
};

const LOAI_LIEU_OPTIONS = [
  { value: LoaiLieuSiloTonEnum.MM_10_80, label: "10-80mm" },
  { value: LoaiLieuSiloTonEnum.MM_DUOI_10, label: "<10mm" },
];

const NHAP_LIEU_OPTIONS = ["Chiều cao", "Bánh cốc"].map((v) => ({ value: v }));

const QuanLyLcSiloTon = () => {
  const [modalForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [data, setData] = useState<LcSiloTon[]>([]);
  const [scopeFilter, setScopeFilter] = useState<number | null>(null);
  const [editingRecord, setEditingRecord] = useState<LcSiloTon | null>(null);
  const [congThucValue, setCongThucValue] = useState("");

  const fetchData = async (scope: number | null = scopeFilter) => {
    setLoading(true);
    try {
      const res = await LcSiloTonApi.search(scope ?? undefined);
      setData(res);
    } catch (err) {
      console.error("Failed to load LC_SiloTon:", err);
      message.error("Không thể tải danh sách Silo tồn");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterScope = (value: number | null) => {
    setScopeFilter(value);
    fetchData(value);
  };

  const openCreateModal = () => {
    setEditingRecord(null);
    modalForm.resetFields();
    modalForm.setFieldsValue({
      scope: scopeFilter ?? ThanhPhamEnum.TP1,
      loaiLieu: LoaiLieuSiloTonEnum.MM_10_80,
      tenNhapLieu: "Chiều cao",
    });
    setCongThucValue("");
    setModalVisible(true);
  };

  const openEditModal = (record: LcSiloTon) => {
    setEditingRecord(record);
    modalForm.setFieldsValue({
      scope: record.scope,
      tenSilo: record.tenSilo,
      loaiLieu: record.loaiLieu,
      tenNhapLieu: record.tenNhapLieu,
    });
    setCongThucValue(record.congThuc);
    setModalVisible(true);
  };

  const handleModalCancel = () => {
    setModalVisible(false);
    modalForm.resetFields();
    setEditingRecord(null);
    setCongThucValue("");
  };

  const handleSave = async () => {
    try {
      const values = await modalForm.validateFields();
      if (!congThucValue?.trim()) {
        message.error("Vui lòng nhập công thức tính khối lượng");
        return;
      }
      const payload: LcSiloTonPayload = {
        scope: values.scope,
        tenSilo: values.tenSilo.trim(),
        loaiLieu: values.loaiLieu,
        tenNhapLieu: values.tenNhapLieu?.trim() || "Chiều cao",
        congThuc: congThucValue.trim(),
      };
      setModalLoading(true);
      if (editingRecord) {
        await LcSiloTonApi.update(editingRecord.id, payload);
        message.success("Cập nhật Silo tồn thành công");
      } else {
        await LcSiloTonApi.create(payload);
        message.success("Tạo mới Silo tồn thành công");
      }
      handleModalCancel();
      fetchData();
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "errorFields" in error) return;
      console.error("Failed to save LC_SiloTon:", error);
      message.error(getErrorMessage(error) || "Không thể lưu Silo tồn");
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await LcSiloTonApi.delete(id);
      message.success("Đã xóa Silo tồn");
      fetchData();
    } catch (err) {
      console.error("Failed to delete LC_SiloTon:", err);
      message.error(getErrorMessage(err) || "Không thể xóa Silo tồn");
    }
  };

  const columns = useMemo(
    () => [
      {
        title: "Thành phẩm",
        dataIndex: "scope",
        key: "scope",
        width: 100,
        render: (value: number) =>
          value === ThanhPhamEnum.TP1 ? <Tag color="blue">TP1</Tag> : <Tag color="green">TP2</Tag>,
      },
      { title: "Tên silo / phụ liệu", dataIndex: "tenSilo", key: "tenSilo" },
      {
        title: "Loại liệu",
        dataIndex: "loaiLieu",
        key: "loaiLieu",
        width: 100,
        render: (v: string) => (v === LoaiLieuSiloTonEnum.MM_10_80 ? "10-80mm" : "<10mm"),
      },
      { title: "Nhập liệu", dataIndex: "tenNhapLieu", key: "tenNhapLieu", width: 110 },
      {
        title: "Công thức",
        dataIndex: "congThuc",
        key: "congThuc",
        render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code>,
      },
      {
        title: "Ngày tạo",
        dataIndex: "ngayTao",
        key: "ngayTao",
        width: 150,
        render: (value: string | undefined) => (value ? dayjs(value).format("DD/MM/YYYY HH:mm") : "-"),
      },
      {
        title: "Thao tác",
        key: "actions",
        width: 140,
        render: (_: unknown, record: LcSiloTon) => (
          <Space>
            <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
              Sửa
            </Button>
            <Popconfirm title="Xác nhận xóa Silo tồn này?" onConfirm={() => handleDelete(record.id)} okText="Xóa" cancelText="Hủy">
              <Button size="small" type="link" danger icon={<DeleteOutlined />}>
                Xóa
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data]
  );

  return (
    <div>
      <Card
        title="Quản lý Silo Tồn (Luyện cốc)"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            Thêm Silo tồn
          </Button>
        }
        style={{ marginBottom: 16 }}
      >
        <Row gutter={16}>
          <Col xs={24} md={6}>
            <Select
              allowClear
              placeholder="Tất cả thành phẩm"
              style={{ width: "100%" }}
              value={scopeFilter ?? undefined}
              onChange={(v) => handleFilterScope(v ?? null)}
            >
              <Select.Option value={ThanhPhamEnum.TP1}>TP1</Select.Option>
              <Select.Option value={ThanhPhamEnum.TP2}>TP2</Select.Option>
            </Select>
          </Col>
          <Col>
            <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>
              Tải lại
            </Button>
          </Col>
        </Row>
      </Card>

      <Card>
        <Table columns={columns} dataSource={data} loading={loading} rowKey="id" pagination={false} />
      </Card>

      <Modal
        title={editingRecord ? "Cập nhật Silo tồn" : "Thêm Silo tồn"}
        open={modalVisible}
        onCancel={handleModalCancel}
        onOk={handleSave}
        confirmLoading={modalLoading}
        destroyOnClose
        width={640}
      >
        <Form layout="vertical" form={modalForm}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="scope" label="Thành phẩm" rules={[{ required: true, message: "Vui lòng chọn thành phẩm" }]}>
                <Select placeholder="Chọn thành phẩm">
                  <Select.Option value={ThanhPhamEnum.TP1}>TP1</Select.Option>
                  <Select.Option value={ThanhPhamEnum.TP2}>TP2</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="loaiLieu" label="Loại liệu" rules={[{ required: true, message: "Vui lòng chọn loại liệu" }]}>
                <Select options={LOAI_LIEU_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="tenSilo"
            label="Tên silo / phụ liệu"
            rules={[{ required: true, message: "Vui lòng nhập tên silo" }, { max: 100, message: "Tối đa 100 ký tự" }]}
          >
            <Input placeholder="VD: Silo 1 (<10mm), CDQ 1, Cốc sàng nguội 1,2" />
          </Form.Item>

          <Form.Item name="tenNhapLieu" label="Nhãn giá trị nhập">
            <AutoComplete options={NHAP_LIEU_OPTIONS} placeholder="Chiều cao" />
          </Form.Item>

          <Form.Item
            label="Công thức tính khối lượng"
            required
            tooltip="Biến H đại diện giá trị nhập (Chiều cao/Bánh cốc). Dùng Pow(x,y) thay cho ký hiệu ^."
          >
            <CongThucCalculatorInput value={congThucValue} onChange={setCongThucValue} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default QuanLyLcSiloTon;
