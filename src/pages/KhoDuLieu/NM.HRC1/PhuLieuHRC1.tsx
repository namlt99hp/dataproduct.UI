import { Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag, message } from "antd";
import { PlusOutlined, SearchOutlined, ReloadOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import type { ColumnsType } from "antd/es/table";
import { Hrc1PhuLieuNmServiceApi,
  LoaiPhuLieuLF,
  type Hrc1PhuLieuNm,
  type Hrc1PhuLieuNmPayload } from "../../../services/Hrc1PhuLieuNmServiceApi";

const LOAI_PL_LABELS: Record<number, string> = {
  [LoaiPhuLieuLF.KimLoai]: "Kim loại",
  [LoaiPhuLieuLF.PhuGia]: "Phụ gia",
};


const PhuLieuHRC1 = () => {
  const [modalForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Hrc1PhuLieuNm[]>([]);
  const [searchKey, setSearchKey] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Hrc1PhuLieuNm | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [togglingNXTId, setTogglingNXTId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchData = async (appliedSearchKey = searchKey) => {
    setLoading(true);
    try {
      const res = await Hrc1PhuLieuNmServiceApi.getAll({
        searchKey: appliedSearchKey.trim() || undefined,
      });
      setData(res);
    } catch {
      message.error("Không thể tải danh sách phụ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = () => fetchData(searchKey);

  const handleReset = () => {
    setSearchKey("");
    fetchData("");
  };

  const openCreateModal = () => {
    setEditingRecord(null);
    modalForm.resetFields();
    setModalVisible(true);
  };

  const openEditModal = (record: Hrc1PhuLieuNm) => {
    setEditingRecord(record);
    modalForm.setFieldsValue({
      tenPhuLieu: record.tenPhuLieu,
      thuTu_TK_BOF: record.thuTu_TK_BOF ?? null,
      thuTu_TK_LF: record.thuTu_TK_LF ?? null,
      thuTu_Excel_BOF: record.thuTu_Excel_BOF ?? null,
      thuTu_Excel_LF: record.thuTu_Excel_LF ?? null,
      maVatTuChiPhi: record.maVatTuChiPhi ?? undefined,
      loaiPL: record.loaiPL ?? null,
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

      // Phụ liệu có cấu hình cột LF (thuTu_Excel_LF) bắt buộc phải chọn nhóm (Kim loại/Phụ gia) — nếu
      // không, TaoTieuHaoTinhLuyenLF.tsx/ChiTietLF.tsx sẽ không biết hiện cột này ở nhóm nào (ẩn mất).
      if (values.thuTu_Excel_LF != null && values.loaiPL == null) {
        message.error("Đã nhập Thứ tự Excel - LF thì phải chọn Nhóm phụ liệu (LF).");
        return;
      }

      const payload: Hrc1PhuLieuNmPayload = {
        tenPhuLieu: values.tenPhuLieu.trim(),
        thuTu_TK_BOF: values.thuTu_TK_BOF ?? null,
        thuTu_TK_LF: values.thuTu_TK_LF ?? null,
        thuTu_Excel_BOF: values.thuTu_Excel_BOF ?? null,
        thuTu_Excel_LF: values.thuTu_Excel_LF ?? null,
        maVatTuChiPhi: values.maVatTuChiPhi?.trim() || null,
        loaiPL: values.loaiPL ?? null,
      };
      setModalLoading(true);
      if (editingRecord) {
        await Hrc1PhuLieuNmServiceApi.update(editingRecord.id, payload);
        message.success("Cập nhật phụ liệu thành công");
      } else {
        await Hrc1PhuLieuNmServiceApi.create(payload);
        message.success("Thêm phụ liệu thành công");
      }
      handleModalCancel();
      fetchData();
    } catch (error: any) {
      if (typeof error === "object" && error !== null && "errorFields" in error) return;
      message.error(error.message ? error.message : "Không thể lưu phụ liệu");
    } finally {
      setModalLoading(false);
    }
  };

  const handleToggleXacNhan = async (record: Hrc1PhuLieuNm) => {
    setTogglingId(record.id);
    const prev = record.dangSuDung;
    setData((d) => d.map((r) => (r.id === record.id ? { ...r, dangSuDung: !prev } : r)));
    try {
      const res = await Hrc1PhuLieuNmServiceApi.toggleXacNhan(record.id);
      setData((d) => d.map((r) => (r.id === record.id ? { ...r, dangSuDung: res.dangSuDung } : r)));
    } catch {
      setData((d) => d.map((r) => (r.id === record.id ? { ...r, dangSuDung: prev } : r)));
      message.error("Không thể cập nhật trạng thái sử dụng");
    } finally {
      setTogglingId(null);
    }
  };

  // Bật/tắt danh sách mặc định cho Sổ Xuất-Nhập-Tồn HRC1 (HRC1_PhuLieuNM.IsUsedNXT) — dùng khi
  // khởi tạo phiếu HRC1_STD_NXT đầu tiên, xem .claude/hrc1_xnt.md mục 2.2.
  const handleToggleIsUsedNXT = async (record: Hrc1PhuLieuNm) => {
    setTogglingNXTId(record.id);
    const prev = record.isUsedNXT ?? false;
    setData((d) => d.map((r) => (r.id === record.id ? { ...r, isUsedNXT: !prev } : r)));
    try {
      const res = await Hrc1PhuLieuNmServiceApi.toggleIsUsedNXT(record.id);
      setData((d) => d.map((r) => (r.id === record.id ? { ...r, isUsedNXT: res.isUsedNXT } : r)));
    } catch {
      setData((d) => d.map((r) => (r.id === record.id ? { ...r, isUsedNXT: prev } : r)));
      message.error("Không thể cập nhật cờ Sổ Xuất-Nhập-Tồn");
    } finally {
      setTogglingNXTId(null);
    }
  };

  const handleDelete = async (record: Hrc1PhuLieuNm) => {
    setDeletingId(record.id);
    try {
      await Hrc1PhuLieuNmServiceApi.delete(record.id);
      message.success("Đã xóa phụ liệu");
      fetchData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : "Không thể xóa phụ liệu");
    } finally {
      setDeletingId(null);
    }
  };

  const columns = useMemo<ColumnsType<Hrc1PhuLieuNm>>(
    () => [
      
      {
        title: "Tên phụ liệu",
        dataIndex: "tenPhuLieu",
        key: "tenPhuLieu",
        sorter: (a, b) => a.tenPhuLieu.localeCompare(b.tenPhuLieu),
      },
      {
        title: "Cột nguồn NM",
        dataIndex: "tenPhuLieuNM",
        key: "tenPhuLieuNM",
        width: 160,
        render: (v?: string | null) => (v ? <Tag color="blue">{v}</Tag> : "-"),
      },
      {
        title: "Mã vật tư chi phí",
        dataIndex: "maVatTuChiPhi",
        key: "maVatTuChiPhi",
        width: 160,
        render: (v?: string | null) => (v ? <Tag color="purple">{v}</Tag> : "-"),
      },
      {
        title: "Nguồn",
        dataIndex: "isNM",
        key: "isNM",
        width: 130,
        align: "center",
        render: (v: boolean) => (v ? <Tag color="green">Tự động (NM)</Tag> : <Tag>Thêm tay</Tag>),
      },
      {
        title: "Xác nhận sử dụng",
        dataIndex: "dangSuDung",
        key: "dangSuDung",
        width: 150,
        align: "center",
        render: (v: boolean, record: Hrc1PhuLieuNm) => (
          <Switch
            checked={v === true}
            loading={togglingId === record.id}
            onChange={() => void handleToggleXacNhan(record)}
            checkedChildren="Đang dùng"
            unCheckedChildren="Ngừng dùng"
          />
        ),
      },
      {
        title: "Mặc định Sổ XNT",
        dataIndex: "isUsedNXT",
        key: "isUsedNXT",
        width: 150,
        align: "center",
        render: (v: boolean | null | undefined, record: Hrc1PhuLieuNm) => (
          <Switch
            checked={v === true}
            loading={togglingNXTId === record.id}
            onChange={() => void handleToggleIsUsedNXT(record)}
            checkedChildren="Có"
            unCheckedChildren="Không"
          />
        ),
      },
      {
        title: "Thứ tự TK",
        children: [
          {
            title: "BOF",
            dataIndex: "thuTu_TK_BOF",
            key: "thuTu_TK_BOF",
            width: 70,
            align: "center",
            sorter: (a, b) => (a.thuTu_TK_BOF ?? 0) - (b.thuTu_TK_BOF ?? 0),
            render: (v?: number | null) => v ?? "-",
          },
          {
            title: "LF",
            dataIndex: "thuTu_TK_LF",
            key: "thuTu_TK_LF",
            width: 70,
            align: "center",
            sorter: (a, b) => (a.thuTu_TK_LF ?? 0) - (b.thuTu_TK_LF ?? 0),
            render: (v?: number | null) => v ?? "-",
          },
        ],
      },
      {
        title: "Thứ tự Excel",
        children: [
          {
            title: "BOF",
            dataIndex: "thuTu_Excel_BOF",
            key: "thuTu_Excel_BOF",
            width: 70,
            align: "center",
            sorter: (a, b) => (a.thuTu_Excel_BOF ?? 0) - (b.thuTu_Excel_BOF ?? 0),
            render: (v?: number | null) => v ?? "-",
          },
          {
            title: "LF",
            dataIndex: "thuTu_Excel_LF",
            key: "thuTu_Excel_LF",
            width: 70,
            align: "center",
            sorter: (a, b) => (a.thuTu_Excel_LF ?? 0) - (b.thuTu_Excel_LF ?? 0),
            render: (v?: number | null) => v ?? "-",
          },
        ],
      },
      {
        title: "Nhóm (LF)",
        dataIndex: "loaiPL",
        key: "loaiPL",
        width: 100,
        align: "center",
        render: (v?: number | null) => (v != null && LOAI_PL_LABELS[v] ? <Tag>{LOAI_PL_LABELS[v]}</Tag> : "-"),
      },
      {
        title: "Thao tác",
        key: "actions",
        width: 160,
        align: "center",
        render: (_: unknown, record: Hrc1PhuLieuNm) => (
          <Space>
            <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
              Sửa
            </Button>
            <Popconfirm
              title="Xóa phụ liệu?"
              description="Không thể xóa nếu phụ liệu đã được sử dụng."
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleDelete(record)}
            >
              <Button size="small" type="link" danger loading={deletingId === record.id} icon={<DeleteOutlined />}>
                Xóa
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [togglingId, togglingNXTId, deletingId]
  );

  return (
    <div>
      <Card
        title="Quản lý phụ liệu HRC1 (Lò thổi BOF)"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            Thêm phụ liệu
          </Button>
        }
        style={{ marginBottom: 16 }}
      >
        <Space>
          <Input
            placeholder="Tìm theo tên phụ liệu..."
            value={searchKey}
            onChange={(e) => setSearchKey(e.target.value)}
            onPressEnter={handleSearch}
            allowClear
            style={{ width: 260 }}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            Lọc
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            Xóa lọc
          </Button>
        </Space>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey="id"
          pagination={{
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} bản ghi`,
          }}
        />
      </Card>

      <Modal
        title={editingRecord ? "Cập nhật phụ liệu" : "Thêm phụ liệu"}
        open={modalVisible}
        onCancel={handleModalCancel}
        onOk={handleSave}
        confirmLoading={modalLoading}
        destroyOnClose
      >
        <Form layout="vertical" form={modalForm}>
          <Form.Item
            name="tenPhuLieu"
            label="Tên phụ liệu"
            rules={[
              { required: true, message: "Vui lòng nhập tên phụ liệu" },
              { max: 100, message: "Tối đa 100 ký tự" },
              { whitespace: true, message: "Không được chỉ có khoảng trắng" },
            ]}
          >
            <Input placeholder="Nhập tên phụ liệu" />
          </Form.Item>
          <div style={{ display: "flex", gap: 12 }}>
            <Form.Item name="thuTu_TK_BOF" label="Thứ tự Thống kê - BOF" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: "100%" }} placeholder="Số thứ tự" />
            </Form.Item>
            <Form.Item name="thuTu_TK_LF" label="Thứ tự Thống kê - LF" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: "100%" }} placeholder="Số thứ tự" />
            </Form.Item>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <Form.Item name="thuTu_Excel_BOF" label="Thứ tự Excel - BOF" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: "100%" }} placeholder="Số thứ tự" />
            </Form.Item>
            <Form.Item name="thuTu_Excel_LF" label="Thứ tự Excel - LF" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: "100%" }} placeholder="Số thứ tự" />
            </Form.Item>
          </div>
          <Form.Item
            name="loaiPL"
            label="Nhóm phụ liệu (LF)"
            tooltip="Chỉ dùng cho bảng Tiêu hao Tinh luyện LF — quyết định cột này hiện dưới nhóm 'Chất hợp kim hóa' hay 'Phụ gia & chất khử oxy'. Bắt buộc nếu có nhập Thứ tự Excel - LF."
          >
            <Select
              allowClear
              placeholder="Chọn nhóm (bắt buộc nếu dùng cho LF)"
              options={[
                { value: LoaiPhuLieuLF.KimLoai, label: "Kim loại (Chất hợp kim hóa)" },
                { value: LoaiPhuLieuLF.PhuGia, label: "Phụ gia & chất khử oxy" },
              ]}
            />
          </Form.Item>
          <Form.Item name="maVatTuChiPhi" label="Mã vật tư chi phí">
            <Input placeholder="Mã vật tư bên hệ thống chi phí (để trống nếu không feed)" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PhuLieuHRC1;
