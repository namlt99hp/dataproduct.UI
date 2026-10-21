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
import { LcCumThapApi } from "../../../services/LcDanhMucApi";
import type { LcCumThap, LcCumThapPayload } from "../../../models/LcDanhMucModel";
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

const QuanLyLcCumThap = () => {
  const [modalForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [data, setData] = useState<LcCumThap[]>([]);
  const [scopeFilter, setScopeFilter] = useState<number | null>(null);
  const [editingRecord, setEditingRecord] = useState<LcCumThap | null>(null);

  const fetchData = async (scope: number | null = scopeFilter) => {
    setLoading(true);
    try {
      const res = await LcCumThapApi.search(scope ?? undefined);
      setData(res);
    } catch (err) {
      console.error("Failed to load LC_CumThap:", err);
      message.error("Không thể tải danh sách Cụm tháp than");
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
    modalForm.setFieldsValue({ scope: scopeFilter ?? ThanhPhamEnum.TP1 });
    setModalVisible(true);
  };

  const openEditModal = (record: LcCumThap) => {
    setEditingRecord(record);
    modalForm.setFieldsValue({
      scope: record.scope,
      ma: record.ma,
      ten: record.ten,
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
      const payload: LcCumThapPayload = {
        scope: values.scope,
        ma: values.ma.trim(),
        ten: values.ten?.trim() || null,
        thuTu: values.thuTu ?? null,
      };
      setModalLoading(true);
      if (editingRecord) {
        await LcCumThapApi.update(editingRecord.id, payload);
        message.success("Cập nhật Cụm tháp than thành công");
      } else {
        await LcCumThapApi.create(payload);
        message.success("Tạo mới Cụm tháp than thành công");
      }
      handleModalCancel();
      fetchData();
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "errorFields" in error) return;
      console.error("Failed to save LC_CumThap:", error);
      message.error(getErrorMessage(error) || "Không thể lưu Cụm tháp than");
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await LcCumThapApi.delete(id);
      message.success("Đã xóa Cụm tháp than");
      fetchData();
    } catch (err) {
      console.error("Failed to delete LC_CumThap:", err);
      message.error(getErrorMessage(err) || "Không thể xóa Cụm tháp than");
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
      { title: "Mã cụm tháp", dataIndex: "ma", key: "ma", width: 140 },
      { title: "Tên", dataIndex: "ten", key: "ten", render: (v: string) => v || "-" },
      { title: "Thứ tự", dataIndex: "thuTu", key: "thuTu", width: 100, render: (v: number | null) => v ?? "-" },
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
        render: (_: unknown, record: LcCumThap) => (
          <Space>
            <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
              Sửa
            </Button>
            <Popconfirm title="Xác nhận xóa cụm tháp này?" onConfirm={() => handleDelete(record.id)} okText="Xóa" cancelText="Hủy">
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
        title="Quản lý Cụm tháp than (Luyện cốc)"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            Thêm cụm tháp
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
        title={editingRecord ? "Cập nhật Cụm tháp than" : "Thêm Cụm tháp than"}
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
            name="ma"
            label="Mã cụm tháp"
            rules={[
              { required: true, message: "Vui lòng nhập mã cụm tháp" },
              { max: 10, message: "Tối đa 10 ký tự" },
              { whitespace: true, message: "Mã cụm tháp không được chỉ có khoảng trắng" },
            ]}
          >
            <Input placeholder="VD: 1-2, 7-8" />
          </Form.Item>
          <Form.Item name="ten" label="Tên" rules={[{ max: 50, message: "Tối đa 50 ký tự" }]}>
            <Input placeholder="VD: Tháp than 1, 2" />
          </Form.Item>
          <Form.Item name="thuTu" label="Thứ tự hiển thị">
            <InputNumber min={0} style={{ width: "100%" }} placeholder="Nhập thứ tự" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default QuanLyLcCumThap;
