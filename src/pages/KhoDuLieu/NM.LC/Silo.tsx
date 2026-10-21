import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
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
import { LcSiloApi } from "../../../services/LcDanhMucApi";
import type { LcSilo, LcSiloPayload } from "../../../models/LcDanhMucModel";
import { ThanhPhamEnum } from "../../../models/LcDanhMucModel";

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

const LOAI_SILO_OPTIONS = [
  { value: "THAN", label: "Than" },
  { value: "COC_NHA_SANG", label: "Cốc nhà sàng" },
  { value: "COC_SANG_NGUOI", label: "Cốc sàng nguội" },
  { value: "COC_THANH_PHAM", label: "Cốc thành phẩm" },
  { value: "CDQ", label: "CDQ" },
];

const QuanLyLcSilo = () => {
  const [modalForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [data, setData] = useState<LcSilo[]>([]);
  const [scopeFilter, setScopeFilter] = useState<number | null>(null);
  const [editingRecord, setEditingRecord] = useState<LcSilo | null>(null);

  const fetchData = async (scope: number | null = scopeFilter) => {
    setLoading(true);
    try {
      const res = await LcSiloApi.search(scope ?? undefined);
      setData(res);
    } catch (err) {
      console.error("Failed to load LC_Silo:", err);
      message.error("Không thể tải danh sách Silo");
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
    modalForm.setFieldsValue({ scope: scopeFilter ?? ThanhPhamEnum.TP1, loaiSilo: "THAN" });
    setModalVisible(true);
  };

  const openEditModal = (record: LcSilo) => {
    setEditingRecord(record);
    modalForm.setFieldsValue({
      scope: record.scope,
      siloSo: record.siloSo,
      tenSilo: record.tenSilo,
      loaiSilo: record.loaiSilo,
      thuTu: record.thuTu,
    });
    setModalVisible(true);
  };

  const handleModalCancel = () => {
    setModalVisible(false);
    modalForm.resetFields();
    setEditingRecord(null);
  };

  const handleSave = async () => {
    try {
      const values = await modalForm.validateFields();
      const payload: LcSiloPayload = {
        scope: values.scope,
        siloSo: values.siloSo,
        tenSilo: values.tenSilo?.trim() || null,
        loaiSilo: values.loaiSilo || "THAN",
        thuTu: values.thuTu ?? null,
      };
      setModalLoading(true);
      if (editingRecord) {
        await LcSiloApi.update(editingRecord.id, payload);
        message.success("Cập nhật Silo thành công");
      } else {
        await LcSiloApi.create(payload);
        message.success("Tạo mới Silo thành công");
      }
      handleModalCancel();
      fetchData();
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "errorFields" in error) return;
      console.error("Failed to save LC_Silo:", error);
      message.error(getErrorMessage(error) || "Không thể lưu Silo");
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await LcSiloApi.delete(id);
      message.success("Đã xóa Silo");
      fetchData();
    } catch (err) {
      console.error("Failed to delete LC_Silo:", err);
      message.error(getErrorMessage(err) || "Không thể xóa Silo");
    }
  };

  const columns = useMemo(
    () => [
      {
        title: "Thành phẩm",
        dataIndex: "scope",
        key: "scope",
        width: 110,
        render: (value: number) =>
          value === ThanhPhamEnum.TP1 ? <Tag color="blue">TP1</Tag> : <Tag color="green">TP2</Tag>,
      },
      { title: "Silo số", dataIndex: "siloSo", key: "siloSo", width: 100 },
      { title: "Tên Silo", dataIndex: "tenSilo", key: "tenSilo", render: (v: string) => v || "-" },
      {
        title: "Loại silo",
        dataIndex: "loaiSilo",
        key: "loaiSilo",
        width: 150,
        render: (v: string) => LOAI_SILO_OPTIONS.find((o) => o.value === v)?.label || v,
      },
      { title: "Thứ tự", dataIndex: "thuTu", key: "thuTu", width: 90, render: (v: number | null) => v ?? "-" },
      {
        title: "Ngày tạo",
        dataIndex: "ngayTao",
        key: "ngayTao",
        width: 160,
        render: (value: string | undefined) => (value ? dayjs(value).format("DD/MM/YYYY HH:mm") : "-"),
      },
      {
        title: "Thao tác",
        key: "actions",
        width: 160,
        render: (_: unknown, record: LcSilo) => (
          <Space>
            <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
              Sửa
            </Button>
            <Popconfirm title="Xác nhận xóa Silo này?" onConfirm={() => handleDelete(record.id)} okText="Xóa" cancelText="Hủy">
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
        title="Quản lý Silo than (Luyện cốc)"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            Thêm Silo
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
        title={editingRecord ? "Cập nhật Silo" : "Thêm Silo"}
        open={modalVisible}
        onCancel={handleModalCancel}
        onOk={handleSave}
        confirmLoading={modalLoading}
        destroyOnClose
      >
        <Form layout="vertical" form={modalForm}>
          <Form.Item name="scope" label="Thành phẩm" rules={[{ required: true, message: "Vui lòng chọn thành phẩm" }]}>
            <Select placeholder="Chọn thành phẩm">
              <Select.Option value={ThanhPhamEnum.TP1}>TP1</Select.Option>
              <Select.Option value={ThanhPhamEnum.TP2}>TP2</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="siloSo"
            label="Silo số"
            rules={[
              { required: true, message: "Vui lòng nhập số thứ tự silo" },
              { type: "number", min: 1, message: "Silo số phải lớn hơn 0" },
            ]}
          >
            <InputNumber min={1} style={{ width: "100%" }} placeholder="VD: 1" />
          </Form.Item>
          <Form.Item name="tenSilo" label="Tên Silo" rules={[{ max: 50, message: "Tối đa 50 ký tự" }]}>
            <Input placeholder="VD: Silo 1" />
          </Form.Item>
          <Form.Item name="loaiSilo" label="Loại silo" rules={[{ required: true, message: "Vui lòng chọn loại silo" }]}>
            <Select options={LOAI_SILO_OPTIONS} />
          </Form.Item>
          <Form.Item name="thuTu" label="Thứ tự hiển thị">
            <InputNumber min={0} style={{ width: "100%" }} placeholder="Nhập thứ tự" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default QuanLyLcSilo;
