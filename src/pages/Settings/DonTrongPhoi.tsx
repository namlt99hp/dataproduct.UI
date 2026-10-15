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
  Switch,
  Table,
  Tag,
  Upload,
  message,
} from "antd";
import type { UploadProps } from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  UploadOutlined,
  SyncOutlined,
  LockOutlined,
  UnlockOutlined,
} from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import {
  DonTrongPhoiServiceApi,
} from "../../services/DonTrongPhoiServiceApi";
import type { DonTrongPhoi, DonTrongPhoiPayload, ImportDonTrongPhoiResult } from "../../services/DonTrongPhoiServiceApi";
import type { ColumnType } from "antd/es/table";

type FilterState = {
  searchKey?: string;
  mac?: string;
  kichThuoc?: string;
  isXacNhan?: number | null;
  maVatTu?: string;
};

const QuanLyDonTrongPhoi = () => {
  const [searchForm] = Form.useForm();
  const [modalForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [data, setData] = useState<DonTrongPhoi[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState<FilterState>({});
  const [editingRecord, setEditingRecord] = useState<DonTrongPhoi | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [importResultVisible, setImportResultVisible] = useState(false);
  const [importResult, setImportResult] = useState<ImportDonTrongPhoiResult | null>(null);

  const fetchData = async (
    page = pagination.current,
    pageSize = pagination.pageSize,
    appliedFilters: FilterState = filters
  ) => {
    setLoading(true);
    try {
      const res = await DonTrongPhoiServiceApi.search({ ...appliedFilters, page, pageSize });
      setData(res.data);
      setPagination({ current: res.page, pageSize: res.pageSize, total: res.totalRecords });
      setFilters(appliedFilters);
    } catch {
      message.error("Không thể tải danh sách Đơn trọng phôi");
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
    fetchData(1, pagination.pageSize, {
      searchKey: values.searchKey?.trim() || undefined,
      mac: values.mac?.trim() || undefined,
      kichThuoc: values.kichThuoc?.trim() || undefined,
      isXacNhan: values.isXacNhan ?? undefined,
      maVatTu: values.maVatTu?.trim() || undefined,
    });
  };

  const handleReset = () => {
    searchForm.resetFields();
    fetchData(1, pagination.pageSize, {});
  };

  const openCreateModal = () => {
    setEditingRecord(null);
    modalForm.resetFields();
    setModalVisible(true);
  };

  const openEditModal = (record: DonTrongPhoi) => {
    setEditingRecord(record);
    modalForm.setFieldsValue({
      macPhoi: record.macPhoi,
      donTrong: record.donTrong,
      mac: record.mac ?? undefined,
      kichThuoc: record.kichThuoc ?? undefined,
      isXacNhan: record.isXacNhan === 1,
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
      const payload: DonTrongPhoiPayload = {
        macPhoi: values.macPhoi.trim(),
        donTrong: values.donTrong as number,
        mac: values.mac?.trim() || null,
        kichThuoc: values.kichThuoc?.trim() || null,
        isXacNhan: values.isXacNhan ? 1 : 0,
      };
      setModalLoading(true);
      if (editingRecord) {
        await DonTrongPhoiServiceApi.update(editingRecord.id, payload);
        message.success("Cập nhật Đơn trọng phôi thành công");
      } else {
        await DonTrongPhoiServiceApi.create(payload);
        message.success("Tạo mới Đơn trọng phôi thành công");
      }
      handleModalCancel();
      fetchData(editingRecord ? pagination.current : 1, pagination.pageSize);
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "errorFields" in error) return;
      message.error("Không thể lưu Đơn trọng phôi");
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await DonTrongPhoiServiceApi.delete(id);
      message.success("Đã xóa Đơn trọng phôi");
      const nextPage =
        data.length === 1 && pagination.current > 1 ? pagination.current - 1 : pagination.current;
      fetchData(nextPage, pagination.pageSize);
    } catch {
      message.error("Không thể xóa Đơn trọng phôi");
    }
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      await DonTrongPhoiServiceApi.exportExcel();
      message.success("Đã tải file Excel thành công");
    } catch {
      message.error("Không thể tải file Excel");
    } finally {
      setExportLoading(false);
    }
  };

  const handleToggleLock = async (id: number) => {
    try {
      await DonTrongPhoiServiceApi.toggleLock(id);
      fetchData(pagination.current, pagination.pageSize);
    } catch {
      message.error("Không thể thay đổi trạng thái khóa");
    }
  };

  const handleSyncMaVatTu = async () => {
    setSyncLoading(true);
    try {
      await DonTrongPhoiServiceApi.syncMaVatTu();
      message.success("Đồng bộ mã vật tư thành công");
      fetchData(pagination.current, pagination.pageSize);
    } catch {
      message.error("Không thể đồng bộ mã vật tư");
    } finally {
      setSyncLoading(false);
    }
  };

  const uploadProps: UploadProps = {
    accept: ".xlsx,.xls",
    showUploadList: false,
    beforeUpload: async (file) => {
      setImportLoading(true);
      try {
        const result = await DonTrongPhoiServiceApi.importExcel(file);
        setImportResult(result);
        setImportResultVisible(true);
        if (result.created > 0 || result.updated > 0) {
          fetchData(1, pagination.pageSize);
        }
      } catch (err: unknown) {
        const errMsg =
          typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: string }).message)
            : "Không thể import file Excel";
        message.error(errMsg);
      } finally {
        setImportLoading(false);
      }
      return false;
    },
  };

  const columns = useMemo(
    () => [
      {
        title: "Mác phôi",
        dataIndex: "macPhoi",
        key: "macPhoi",
        sorter: (a: DonTrongPhoi, b: DonTrongPhoi) => a.macPhoi.localeCompare(b.macPhoi),
      },
      {
        title: "Mác",
        dataIndex: "mac",
        key: "mac",
        width: 150,
        render: (v: string | null) => v ?? "-",
      },
      {
        title: "Kích thước",
        dataIndex: "kichThuoc",
        key: "kichThuoc",
        width: 150,
        render: (v: string | null) => v ?? "-",
      },
      {
        title: "Mã Vật Tư",
        dataIndex: "maVatTu",
        key: "maVatTu",
        width: 140,
        render: (v: string | null) => v ?? "-",
      },
      {
        title: "Tên Vật Tư",
        dataIndex: "tenVatTu",
        key: "tenVatTu",
        render: (v: string | null) => v ?? "-",
      },
      {
        title: "Đơn trọng (kg)",
        dataIndex: "donTrong",
        key: "donTrong",
        width: 150,
        render: (v: number) => v.toLocaleString("vi-VN", { minimumFractionDigits: 3 }),
      },
      {
        title: "Xác nhận",
        dataIndex: "isXacNhan",
        key: "isXacNhan",
        width: 130,
        render: (v: number | null) =>
          v === 1
            ? <Tag color="success">Đã xác nhận</Tag>
            : <Tag color="default">Chưa xác nhận</Tag>,
      },
      {
        title: "Thao tác",
        key: "actions",
        width: 190,
        render: (_: unknown, record: DonTrongPhoi) => (
          <Space>
            <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
              Sửa
            </Button>
            <Popconfirm
              title={record.isLock === 1 ? "Mở khóa đơn trọng này?" : "Khóa đơn trọng này? Khi khóa sẽ không xuất hiện khi tạo phiếu."}
              onConfirm={() => handleToggleLock(record.id)}
              okText="Xác nhận"
              cancelText="Hủy"
            >
              <Button
                size="small"
                type="link"
                danger={record.isLock === 1}
                icon={record.isLock === 1 ? <LockOutlined /> : <UnlockOutlined />}
              >
                {record.isLock === 1 ? "Đang khóa" : "Khóa"}
              </Button>
            </Popconfirm>
            <Popconfirm
              title="Xác nhận xóa bản ghi này?"
              onConfirm={() => handleDelete(record.id)}
              okText="Xóa"
              cancelText="Hủy"
            >
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
        title="Quản lý Đơn trọng phôi"
        extra={
          <Space>
            <Button
              icon={<SyncOutlined />}
              loading={syncLoading}
              onClick={handleSyncMaVatTu}
            >
              Sync Mã Vật Tư
            </Button>
            <Button
              icon={<DownloadOutlined />}
              loading={exportLoading}
              onClick={handleExport}
            >
              Tải về
            </Button>
            <Upload {...uploadProps}>
              <Button icon={<UploadOutlined />} loading={importLoading}>
                Import Excel
              </Button>
            </Upload>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              Thêm mới
            </Button>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Form form={searchForm} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} md={6}>
              <Form.Item label="Mác phôi" name="searchKey">
                <Input placeholder="Tìm theo mác phôi..." allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} md={5}>
              <Form.Item label="Mác" name="mac">
                <Input placeholder="Tìm theo mác thép..." allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} md={5}>
              <Form.Item label="Kích thước" name="kichThuoc">
                <Input placeholder="Tìm theo kích thước..." allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} md={5}>
              <Form.Item label="Mã Vật Tư" name="maVatTu">
                <Input placeholder="Tìm theo mã vật tư..." allowClear />
              </Form.Item>
            </Col>
            <Col xs={24} md={4}>
              <Form.Item label="Xác nhận" name="isXacNhan">
                <Select allowClear placeholder="Tất cả">
                  <Select.Option value={1}>Đã xác nhận</Select.Option>
                  <Select.Option value={0}>Chưa xác nhận</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={4} style={{ display: "flex", alignItems: "flex-end", paddingBottom: 24 }}>
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
          columns={columns as unknown as ColumnType<DonTrongPhoi>[]}
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

      {/* Modal thêm/sửa */}
      <Modal
        title={editingRecord ? "Cập nhật Đơn trọng phôi" : "Thêm Đơn trọng phôi"}
        open={modalVisible}
        onCancel={handleModalCancel}
        onOk={handleSave}
        confirmLoading={modalLoading}
        destroyOnClose
      >
        <Form layout="vertical" form={modalForm}>
          <Form.Item
            name="macPhoi"
            label="Mác phôi"
            rules={[
              { required: true, message: "Vui lòng nhập mác phôi" },
              { max: 100, message: "Tối đa 100 ký tự" },
              { whitespace: true, message: "Không được chỉ có khoảng trắng" },
            ]}
          >
            <Input placeholder="Nhập mác phôi" />
          </Form.Item>
          <Form.Item
            name="mac"
            label="Mác"
            rules={[{ max: 100, message: "Tối đa 100 ký tự" }]}
          >
            <Input placeholder="Nhập mác thép" />
          </Form.Item>
          <Form.Item
            name="kichThuoc"
            label="Kích thước"
            rules={[{ max: 100, message: "Tối đa 100 ký tự" }]}
          >
            <Input placeholder="Ví dụ: 150x150, 160x160..." />
          </Form.Item>
          <Form.Item
            name="donTrong"
            label="Đơn trọng (kg)"
            rules={[
              { required: true, message: "Vui lòng nhập đơn trọng" },
              { type: "number", min: 0, message: "Đơn trọng phải >= 0" },
            ]}
          >
            <InputNumber
              style={{ width: "100%" }}
              placeholder="Nhập đơn trọng"
              min={0}
              precision={3}
            />
          </Form.Item>
          <Form.Item name="isXacNhan" label="Xác nhận" valuePropName="checked">
            <Switch checkedChildren="Đã xác nhận" unCheckedChildren="Chưa xác nhận" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal kết quả import */}
      <Modal
        title="Kết quả Import"
        open={importResultVisible}
        onOk={() => setImportResultVisible(false)}
        onCancel={() => setImportResultVisible(false)}
        cancelButtonProps={{ style: { display: "none" } }}
        okText="Đóng"
      >
        {importResult && (
          <div>
            <p>
              <strong style={{ color: "#52c41a" }}>Tạo mới:</strong> {importResult.created} bản ghi
            </p>
            <p>
              <strong style={{ color: "#1677ff" }}>Cập nhật:</strong> {importResult.updated} bản ghi
            </p>
            {importResult.errors.length > 0 && (
              <div>
                <p>
                  <strong style={{ color: "#ff4d4f" }}>Lỗi ({importResult.errors.length} dòng):</strong>
                </p>
                <ul style={{ maxHeight: 200, overflowY: "auto", paddingLeft: 20 }}>
                  {importResult.errors.map((err, i) => (
                    <li key={i} style={{ color: "#ff4d4f", fontSize: 13 }}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default QuanLyDonTrongPhoi;
