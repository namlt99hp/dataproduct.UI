import { Button, Card, Col, Form, Input, InputNumber, Modal, Popconfirm, Row, Space, Table, message } from "antd";
import { PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { useMemo, useState, useEffect } from "react";
import { LcBuiCocNoiNhanApi, type BuiCocNoiNhanDto, type BuiCocNoiNhanPayload } from "../../../services/LCThapThanApi";

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

/**
 * Quản lý danh mục "Nơi nhận" của khối Bụi cốc xuất (gộp vào tab Tháp/Phễu, TP1 only) — xem
 * TabThapPheu.tsx, TP1.xlsx dòng 209-217 ("Cho thêm dòng nếu cần" → làm danh mục CRUD).
 */
const QuanLyBuiCocNoiNhan = () => {
  const [modalForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [data, setData] = useState<BuiCocNoiNhanDto[]>([]);
  const [editingRecord, setEditingRecord] = useState<BuiCocNoiNhanDto | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await LcBuiCocNoiNhanApi.search();
      setData(res);
    } catch (err) {
      console.error("Failed to load LC_TP_BuiCocNoiNhan:", err);
      message.error("Không thể tải danh sách Nơi nhận bụi cốc");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditingRecord(null);
    modalForm.resetFields();
    setModalVisible(true);
  };

  const openEditModal = (record: BuiCocNoiNhanDto) => {
    setEditingRecord(record);
    modalForm.setFieldsValue({ ten: record.ten, thuTu: record.thuTu });
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
      const payload: BuiCocNoiNhanPayload = {
        ten: values.ten.trim(),
        thuTu: values.thuTu ?? null,
      };
      setModalLoading(true);
      if (editingRecord) {
        await LcBuiCocNoiNhanApi.update(editingRecord.id, payload);
        message.success("Cập nhật Nơi nhận bụi cốc thành công");
      } else {
        await LcBuiCocNoiNhanApi.create(payload);
        message.success("Tạo mới Nơi nhận bụi cốc thành công");
      }
      handleModalCancel();
      fetchData();
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "errorFields" in error) return;
      console.error("Failed to save LC_TP_BuiCocNoiNhan:", error);
      message.error(getErrorMessage(error) || "Không thể lưu Nơi nhận bụi cốc");
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await LcBuiCocNoiNhanApi.delete(id);
      message.success("Đã xóa Nơi nhận bụi cốc");
      fetchData();
    } catch (err) {
      console.error("Failed to delete LC_TP_BuiCocNoiNhan:", err);
      message.error(getErrorMessage(err) || "Không thể xóa Nơi nhận bụi cốc");
    }
  };

  const columns = useMemo(
    () => [
      { title: "Tên nơi nhận", dataIndex: "ten", key: "ten" },
      { title: "Thứ tự", dataIndex: "thuTu", key: "thuTu", width: 100, render: (v: number | null) => v ?? "-" },
      {
        title: "Thao tác",
        key: "actions",
        width: 160,
        render: (_: unknown, record: BuiCocNoiNhanDto) => (
          <Space>
            <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
              Sửa
            </Button>
            <Popconfirm title="Xác nhận xóa nơi nhận này?" onConfirm={() => handleDelete(record.id)} okText="Xóa" cancelText="Hủy">
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
        title="Quản lý Nơi nhận Bụi cốc (Luyện cốc, TP1)"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            Thêm nơi nhận
          </Button>
        }
        style={{ marginBottom: 16 }}
      >
        <Row>
          <Col>
            <Button icon={<ReloadOutlined />} onClick={fetchData}>
              Tải lại
            </Button>
          </Col>
        </Row>
      </Card>

      <Card>
        <Table columns={columns} dataSource={data} loading={loading} rowKey="id" pagination={false} />
      </Card>

      <Modal
        title={editingRecord ? "Cập nhật Nơi nhận bụi cốc" : "Thêm Nơi nhận bụi cốc"}
        open={modalVisible}
        onCancel={handleModalCancel}
        onOk={handleSave}
        confirmLoading={modalLoading}
        destroyOnClose
      >
        <Form layout="vertical" form={modalForm}>
          <Form.Item
            name="ten"
            label="Tên nơi nhận"
            rules={[
              { required: true, message: "Vui lòng nhập tên nơi nhận" },
              { max: 50, message: "Tối đa 50 ký tự" },
              { whitespace: true, message: "Tên nơi nhận không được chỉ có khoảng trắng" },
            ]}
          >
            <Input placeholder="VD: NM.LG1, NM.HRC1" />
          </Form.Item>
          <Form.Item name="thuTu" label="Thứ tự hiển thị">
            <InputNumber min={0} style={{ width: "100%" }} placeholder="Nhập thứ tự" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default QuanLyBuiCocNoiNhan;
