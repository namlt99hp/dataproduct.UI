import {
  Button,
  Card,
  Col,
  Empty,
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
  Typography,
  message,
} from "antd";
import { PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { LcXuatCapDanhMucApi } from "../../../services/LcXuatCapDanhMucApi";
import type {
  LcXuatCapDanhMucCum,
  LcXuatCapDanhMucCumPayload,
  LcXuatCapDanhMucChiTiet,
  LcPhongBanOption,
} from "../../../models/LcXuatCapDanhMucModel";
import { ThanhPhamEnum } from "../../../models/LcDanhMucModel";

const getErrMsg = (err: unknown, fallback: string): string =>
  typeof err === "object" && err !== null && "message" in err && typeof (err as { message?: unknown }).message === "string"
    ? (err as { message: string }).message
    : fallback;

/**
 * Quản lý danh mục "Cụm nhận" (CHA) + "Chi tiết" (CON) vùng Cấp cốc (LcTabXuatCap,
 * LC_BCSX_XNL_TP) — THAY THẾ layout hardcode trước đây.
 *
 * 1 Cụm (vd 'LG1-CDQ') là đơn vị GÁN (nguồn BBGN nhiều khi chỉ biết tới mức thô 'LG1' — người
 * dùng phải tự chọn đúng Cụm CDQ/Ướt khi gán) và cũng là đơn vị tính Trong ca/Lũy kế chính. Mỗi
 * Cụm có N Chi tiết con (vd 'LC1'..'LC4'). Mỗi phiếu Cấp cốc MỚI TẠO sinh slot từ đúng danh sách
 * này theo Scope — sửa ở đây có hiệu lực ngay cho phiếu tạo SAU, không ảnh hưởng phiếu cũ.
 */
const QuanLyLcXuatCapDanhMuc = () => {
  const [cumForm] = Form.useForm();
  const [chiTietForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [cums, setCums] = useState<LcXuatCapDanhMucCum[]>([]);
  const [phongBanOptions, setPhongBanOptions] = useState<LcPhongBanOption[]>([]);
  const [scopeFilter, setScopeFilter] = useState<number>(ThanhPhamEnum.TP1);

  const [cumModalOpen, setCumModalOpen] = useState(false);
  const [cumModalLoading, setCumModalLoading] = useState(false);
  const [editingCum, setEditingCum] = useState<LcXuatCapDanhMucCum | null>(null);

  const [chiTietModalCum, setChiTietModalCum] = useState<LcXuatCapDanhMucCum | null>(null);
  const [chiTietModalLoading, setChiTietModalLoading] = useState(false);
  const [editingChiTiet, setEditingChiTiet] = useState<LcXuatCapDanhMucChiTiet | null>(null);

  const fetchData = async (scope: number = scopeFilter) => {
    setLoading(true);
    try {
      const res = await LcXuatCapDanhMucApi.searchCum(scope);
      setCums(res);
    } catch (err) {
      console.error("Failed to load LC_XuatCapDanhMucCum:", err);
      message.error("Không thể tải danh mục Cụm nhận");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(scopeFilter);
    LcXuatCapDanhMucApi.getPhongBanOptions()
      .then(setPhongBanOptions)
      .catch((err) => console.error("Không thể tải danh sách Phòng ban:", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterScope = (value: number) => {
    setScopeFilter(value);
    fetchData(value);
  };

  const phongBanOptionItems = useMemo(
    () => phongBanOptions.map((p) => ({ value: p.idPhongBan, label: p.tenNgan || p.tenPhongBan || `#${p.idPhongBan}` })),
    [phongBanOptions]
  );

  // ─── Cụm (cha) ───────────────────────────────────────────────────────────
  const openCreateCum = () => {
    setEditingCum(null);
    cumForm.resetFields();
    cumForm.setFieldsValue({ scope: scopeFilter, thuTu: (cums.length || 0) + 1 });
    setCumModalOpen(true);
  };

  const openEditCum = (cum: LcXuatCapDanhMucCum) => {
    setEditingCum(cum);
    cumForm.setFieldsValue({
      scope: cum.scope,
      thuTu: cum.thuTu,
      tenCan: cum.tenCan,
      tenCum: cum.tenCum,
      loaiCoc: cum.loaiCoc,
      nhomTongHop: cum.nhomTongHop,
      idPhongBan: cum.idPhongBan ?? undefined,
    });
    setCumModalOpen(true);
  };

  const closeCumModal = () => {
    setCumModalOpen(false);
    cumForm.resetFields();
    setEditingCum(null);
  };

  const handleSaveCum = async () => {
    try {
      const values = await cumForm.validateFields();
      const payload: LcXuatCapDanhMucCumPayload = {
        scope: values.scope,
        thuTu: values.thuTu,
        tenCan: values.tenCan.trim(),
        tenCum: values.tenCum.trim(),
        loaiCoc: values.loaiCoc.trim(),
        nhomTongHop: values.nhomTongHop.trim(),
        idPhongBan: values.idPhongBan ?? null,
      };
      setCumModalLoading(true);
      if (editingCum) {
        await LcXuatCapDanhMucApi.updateCum(editingCum.id, payload);
        message.success("Cập nhật Cụm nhận thành công");
      } else {
        await LcXuatCapDanhMucApi.createCum(payload);
        message.success("Tạo mới Cụm nhận thành công");
      }
      closeCumModal();
      fetchData();
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "errorFields" in error) return;
      console.error("Failed to save LC_XuatCapDanhMucCum:", error);
      message.error(getErrMsg(error, "Không thể lưu Cụm nhận"));
    } finally {
      setCumModalLoading(false);
    }
  };

  const handleDeleteCum = async (id: number) => {
    try {
      await LcXuatCapDanhMucApi.deleteCum(id);
      message.success("Đã xoá Cụm nhận (và toàn bộ Chi tiết con)");
      fetchData();
    } catch (err) {
      console.error("Failed to delete LC_XuatCapDanhMucCum:", err);
      message.error("Không thể xoá Cụm nhận");
    }
  };

  // ─── Chi tiết (con) ──────────────────────────────────────────────────────
  const openAddChiTiet = (cum: LcXuatCapDanhMucCum) => {
    setChiTietModalCum(cum);
    setEditingChiTiet(null);
    chiTietForm.resetFields();
    chiTietForm.setFieldsValue({ thuTu: (cum.chiTiet.length || 0) + 1 });
  };

  const openEditChiTiet = (cum: LcXuatCapDanhMucCum, ct: LcXuatCapDanhMucChiTiet) => {
    setChiTietModalCum(cum);
    setEditingChiTiet(ct);
    chiTietForm.setFieldsValue({ thuTu: ct.thuTu, chiTietLo: ct.chiTietLo });
  };

  const closeChiTietModal = () => {
    setChiTietModalCum(null);
    setEditingChiTiet(null);
    chiTietForm.resetFields();
  };

  const handleSaveChiTiet = async () => {
    if (!chiTietModalCum) return;
    try {
      const values = await chiTietForm.validateFields();
      const chiTietLo = values.chiTietLo?.trim() || null;
      setChiTietModalLoading(true);
      if (editingChiTiet) {
        await LcXuatCapDanhMucApi.updateChiTiet(editingChiTiet.id, { thuTu: values.thuTu, chiTietLo });
        message.success("Cập nhật Chi tiết thành công");
      } else {
        await LcXuatCapDanhMucApi.createChiTiet({ idCum: chiTietModalCum.id, thuTu: values.thuTu, chiTietLo });
        message.success("Thêm Chi tiết thành công");
      }
      closeChiTietModal();
      fetchData();
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "errorFields" in error) return;
      console.error("Failed to save LC_XuatCapDanhMucChiTiet:", error);
      message.error(getErrMsg(error, "Không thể lưu Chi tiết"));
    } finally {
      setChiTietModalLoading(false);
    }
  };

  const handleDeleteChiTiet = async (id: number) => {
    try {
      await LcXuatCapDanhMucApi.deleteChiTiet(id);
      message.success("Đã xoá Chi tiết");
      fetchData();
    } catch (err) {
      console.error("Failed to delete LC_XuatCapDanhMucChiTiet:", err);
      message.error("Không thể xoá Chi tiết");
    }
  };

  const chiTietColumns = (cum: LcXuatCapDanhMucCum) => [
    { title: "Thứ tự", dataIndex: "thuTu", key: "thuTu", width: 80 },
    { title: "Chi tiết (con)", dataIndex: "chiTietLo", key: "chiTietLo", render: (v: string | null) => v ?? <span style={{ color: "#bbb" }}>(không có)</span> },
    {
      title: "Thao tác",
      key: "actions",
      width: 120,
      render: (_: unknown, ct: LcXuatCapDanhMucChiTiet) => (
        <Space>
          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEditChiTiet(cum, ct)} />
          <Popconfirm title="Xoá Chi tiết này?" onConfirm={() => handleDeleteChiTiet(ct.id)} okText="Xoá" cancelText="Hủy">
            <Button size="small" type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="Quản lý Cụm nhận — Cấp cốc (Luyện cốc)"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateCum}>
            Thêm Cụm nhận
          </Button>
        }
        style={{ marginBottom: 16 }}
      >
        <Row gutter={16}>
          <Col xs={24} md={6}>
            <Select style={{ width: "100%" }} value={scopeFilter} onChange={handleFilterScope}>
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

      {cums.length === 0 && !loading && <Empty description="Chưa có Cụm nhận nào cho Thành phẩm này" />}

      <Space direction="vertical" style={{ width: "100%" }} size={16}>
        {cums.map((cum) => (
          <Card
            key={cum.id}
            size="small"
            title={
              <Space>
                <Tag color="blue">#{cum.thuTu}</Tag>
                <b>{cum.tenCum}</b>
                <Typography.Text type="secondary">({cum.tenCan})</Typography.Text>
                {cum.tenPhongBan && <Tag>{cum.tenPhongBan}</Tag>}
              </Space>
            }
            extra={
              <Space>
                <Typography.Text type="secondary">
                  {cum.loaiCoc} · Nhóm: {cum.nhomTongHop}
                </Typography.Text>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEditCum(cum)}>
                  Sửa Cụm
                </Button>
                <Popconfirm title="Xoá cả Cụm và Chi tiết con?" onConfirm={() => handleDeleteCum(cum.id)} okText="Xoá" cancelText="Hủy">
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            }
          >
            {cum.chiTiet.length === 0 ? (
              <Empty description="Chưa có Chi tiết con nào" />
            ) : (
              <Table columns={chiTietColumns(cum)} dataSource={cum.chiTiet} rowKey="id" pagination={false} size="small" bordered />
            )}
            <Button type="link" icon={<PlusOutlined />} onClick={() => openAddChiTiet(cum)} style={{ marginTop: 8, paddingLeft: 0 }}>
              Thêm Chi tiết (con)
            </Button>
          </Card>
        ))}
      </Space>

      <Modal
        title={editingCum ? "Cập nhật Cụm nhận" : "Thêm Cụm nhận"}
        open={cumModalOpen}
        onCancel={closeCumModal}
        onOk={handleSaveCum}
        confirmLoading={cumModalLoading}
        destroyOnClose
        width={560}
      >
        <Form layout="vertical" form={cumForm}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="scope" label="Thành phẩm" rules={[{ required: true, message: "Vui lòng chọn thành phẩm" }]}>
                <Select>
                  <Select.Option value={ThanhPhamEnum.TP1}>TP1</Select.Option>
                  <Select.Option value={ThanhPhamEnum.TP2}>TP2</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="thuTu" label="Thứ tự hiển thị" rules={[{ required: true, message: "Vui lòng nhập thứ tự" }]}>
                <InputNumber min={1} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="tenCan" label="Tên cân" rules={[{ required: true, message: "Vui lòng nhập tên cân" }]}>
            <Input placeholder="VD: Cân BTC8,17 – NM.LC" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="tenCum" label="Tên Cụm (Nơi nhận)" rules={[{ required: true, message: "Vui lòng nhập tên Cụm" }]}>
                <Input placeholder="VD: LG1-CDQ, LG1-Ướt" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="loaiCoc" label="Loại cốc" rules={[{ required: true, message: "Vui lòng nhập loại cốc" }]}>
                <Input placeholder="VD: 10-80mm, <10mm, Bụi CDQ" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="idPhongBan" label="Phòng ban nhận (tham khảo, không bắt buộc)">
            <Select allowClear showSearch placeholder="Chưa gán" options={phongBanOptionItems} optionFilterProp="label" />
          </Form.Item>
          <Form.Item
            name="nhomTongHop"
            label="Nhóm tổng hợp (Trong ca/Lũy kế)"
            rules={[{ required: true, message: "Vui lòng nhập nhóm tổng hợp" }]}
            extra="Các Cụm cùng tên nhóm sẽ gộp chung 1 giá trị Trong ca/Lũy kế (giống ô merge trên Excel gốc)."
          >
            <Input placeholder="VD: C1-BTC817-LG1CDQ" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingChiTiet ? "Cập nhật Chi tiết" : `Thêm Chi tiết vào Cụm "${chiTietModalCum?.tenCum ?? ""}"`}
        open={chiTietModalCum != null}
        onCancel={closeChiTietModal}
        onOk={handleSaveChiTiet}
        confirmLoading={chiTietModalLoading}
        destroyOnClose
      >
        <Form layout="vertical" form={chiTietForm}>
          <Form.Item name="thuTu" label="Thứ tự" rules={[{ required: true, message: "Vui lòng nhập thứ tự" }]}>
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="chiTietLo" label="Chi tiết (tuỳ chọn — để trống nếu Cụm không tách con)">
            <Input placeholder="VD: LC1, ca trước, CSR62%" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default QuanLyLcXuatCapDanhMuc;
