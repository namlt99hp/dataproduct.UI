import {
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
  Switch,
  Table,
  Tag,
  message,
} from "antd";
import { PlusOutlined, SearchOutlined, ReloadOutlined, EditOutlined, LockOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { MayDucServiceApi, NhaMayEnum } from "../../services/MayDucServiceApi";
import { invalidateMayDucCache } from "../../hooks/useMayDucOptions";
import type { MayDuc, MayDucPayload } from "../../services/MayDucServiceApi";
import type { ColumnType } from "antd/es/table";


type FilterState = {
  searchKey?: string;
  isLock?: boolean;
};

const QuanLyMayDuc = () => {
  const [searchForm] = Form.useForm();
  const [modalForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [data, setData] = useState<MayDuc[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState<FilterState>({});
  const [editingRecord, setEditingRecord] = useState<MayDuc | null>(null);

  const fetchData = async (
    page = pagination.current,
    pageSize = pagination.pageSize,
    nhaMay = searchForm.getFieldsValue().nhaMay as NhaMayEnum,
    appliedFilters: FilterState = filters
  ) => {
    setLoading(true);
    try {
      const res = await MayDucServiceApi.search({ ...appliedFilters, nhaMay, page, pageSize });
      setData(res.data);
      setPagination({ current: res.page, pageSize: res.pageSize, total: res.totalRecords });
      setFilters(appliedFilters);
    } catch {
      message.error("Không thể tải danh sách Máy đúc");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(1, pagination.pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = () => {
    const values = searchForm.getFieldsValue();
    fetchData(1, pagination.pageSize, values.nhaMay as NhaMayEnum, {
      searchKey: values.searchKey?.trim() || undefined,
      isLock: typeof values.isLock === "boolean" ? values.isLock : undefined,
    });
  };

  const handleReset = () => {
    searchForm.resetFields();
    fetchData(1, pagination.pageSize, undefined, {});
  };

  const openCreateModal = () => {
    setEditingRecord(null);
    modalForm.resetFields();
    modalForm.setFieldsValue({ isLock: false });
    setModalVisible(true);
  };

  const openEditModal = (record: MayDuc) => {
    setEditingRecord(record);
    modalForm.setFieldsValue({
      tenMayDuc: record.tenMayDuc,
      nhaMay: record.nhaMay as NhaMayEnum,
      isLock: record.isLock ?? false,
      loaiMayDuc: record.loaiMayDuc ?? undefined,
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
      const payload: MayDucPayload = {
        tenMayDuc: values.tenMayDuc.trim(),
        nhaMay: values.nhaMay as NhaMayEnum,
        isLock: values.isLock as boolean,
        loaiMayDuc: (values.loaiMayDuc as string) || null,
      };
      setModalLoading(true);
      if (editingRecord) {
        await MayDucServiceApi.update(editingRecord.id, payload);
        message.success("Cập nhật Máy đúc thành công");
      } else {
        await MayDucServiceApi.create(payload);
        message.success("Tạo mới Máy đúc thành công");
      }
      invalidateMayDucCache();
      handleModalCancel();
      fetchData(editingRecord ? pagination.current : 1, pagination.pageSize);
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "errorFields" in error) return;
      message.error((error as { message?: string })?.message ?? "Không thể lưu Máy đúc");
    } finally {
      setModalLoading(false);
    }
  };

  const handleLock = async (id: number) => {
    try {
      await MayDucServiceApi.lock(id);
      message.success("Đã khóa Máy đúc");
      invalidateMayDucCache();
      fetchData(pagination.current, pagination.pageSize);
    } catch {
      message.error("Không thể khóa Máy đúc");
    }
  };

  const modalNhaMay = Form.useWatch("nhaMay", modalForm);

  const columns = useMemo(
    () => [
      {
        title: "Tên Máy đúc",
        dataIndex: "tenMayDuc",
        key: "tenMayDuc",
        sorter: (a: MayDuc, b: MayDuc) => a.tenMayDuc.localeCompare(b.tenMayDuc),
      },
      {
        title: "Nhà máy",
        dataIndex: "nhaMay",
        key: "nhaMay",
        width: 130,
        render: (v: number) => {
          if (v === NhaMayEnum.HRC1) return <Tag color="blue">HRC1</Tag>;
          if (v === NhaMayEnum.HRC2) return <Tag color="green">HRC2</Tag>;
          return v ?? "-";
        },
      },
      {
        title: "Loại máy đúc",
        dataIndex: "loaiMayDuc",
        key: "loaiMayDuc",
        width: 130,
        render: (v: string | null) => {
          if (v === "DV") return <Tag color="blue">Đúc Vuông</Tag>;
          if (v === "DT") return <Tag color="purple">Đúc Tấm</Tag>;
          return "-";
        },
      },
      {
        title: "Trạng thái",
        dataIndex: "isLock",
        key: "isLock",
        width: 130,
        render: (v: boolean | null) =>
          v ? <Tag color="red">Đã khóa</Tag> : <Tag color="green">Đang dùng</Tag>,
      },
      {
        title: "Thao tác",
        key: "actions",
        width: 140,
        render: (_: unknown, record: MayDuc) => (
          <Space>
            <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
              Sửa
            </Button>
            {!record.isLock && (
              <Popconfirm
                title="Khóa (ngừng sử dụng) Máy đúc này?"
                description="Phiếu và quyền cũ vẫn giữ nguyên, chỉ không chọn được cho phiếu mới."
                onConfirm={() => handleLock(record.id)}
                okText="Khóa"
                cancelText="Hủy"
              >
                <Button size="small" type="link" danger icon={<LockOutlined />}>
                  Khóa
                </Button>
              </Popconfirm>
            )}
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
        title="Quản lý Máy đúc"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            Thêm Máy đúc
          </Button>
        }
        style={{ marginBottom: 16 }}
      >
        <Form form={searchForm} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} md={6}>
              <Form.Item label="Nhà máy" name="nhaMay">
                <Select allowClear placeholder="Tất cả">
                  <Select.Option value={NhaMayEnum.HRC1}>HRC1</Select.Option>
                  <Select.Option value={NhaMayEnum.HRC2}>HRC2</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item label="Tìm kiếm" name="searchKey">
                <Input placeholder="Tên máy đúc..." allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} md={4}>
              <Form.Item label="Trạng thái" name="isLock">
                <Select allowClear placeholder="Tất cả">
                  <Select.Option value={false}>Đang dùng</Select.Option>
                  <Select.Option value={true}>Đã khóa</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={6} style={{ display: "flex", alignItems: "flex-end", paddingBottom: 24 }}>
              <Space>
                <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                  Lọc
                </Button>
                <Button icon={<ReloadOutlined />} onClick={handleReset}>
                  Xóa lọc
                </Button>
              </Space>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card>
        <Table
          columns={columns as unknown as ColumnType<MayDuc>[]}
          dataSource={data}
          loading={loading}
          rowKey="id"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} bản ghi`,
            onChange: (page, pageSize) => fetchData(page, pageSize),
          }}
        />
      </Card>

      <Modal
        title={editingRecord ? "Cập nhật Máy đúc" : "Thêm Máy đúc"}
        open={modalVisible}
        onCancel={handleModalCancel}
        onOk={handleSave}
        confirmLoading={modalLoading}
        destroyOnClose
      >
        <Form layout="vertical" form={modalForm}>
          <Form.Item name="nhaMay" label="Nhà máy" rules={[{ required: true, message: "Vui lòng chọn nhà máy" }]}>
            <Select allowClear placeholder="Tất cả">
              <Select.Option value={NhaMayEnum.HRC1}>HRC1</Select.Option>
              <Select.Option value={NhaMayEnum.HRC2}>HRC2</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="tenMayDuc"
            label="Tên Máy đúc"
            rules={[{ required: true, message: "Vui lòng nhập tên máy đúc" }, { max: 100, message: "Tối đa 100 ký tự" }, { whitespace: true, message: "Không được chỉ có khoảng trắng" }]}
          >
            <Input placeholder="Nhập tên máy đúc" />
          </Form.Item>
          <Form.Item
            name="loaiMayDuc"
            label="Loại máy đúc"
            rules={[{ required: modalNhaMay === NhaMayEnum.HRC1, message: "Máy đúc HRC1 bắt buộc chọn loại máy đúc" }]}
          >
            <Select allowClear placeholder="Chọn loại máy đúc">
              <Select.Option value="DV">Đúc Vuông</Select.Option>
              <Select.Option value="DT">Đúc Tấm</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="isLock" label="Trạng thái khóa" valuePropName="checked" initialValue={false}>
            <Switch checkedChildren="Đã khóa" unCheckedChildren="Đang dùng" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default QuanLyMayDuc;
