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
  LcXuatCapCumOption,
  LcXuatCapLoaiOption,
} from "../../../models/LcXuatCapDanhMucModel";
import { ThanhPhamEnum } from "../../../models/LcDanhMucModel";

const getErrMsg = (err: unknown, fallback: string): string =>
  typeof err === "object" && err !== null && "message" in err && typeof (err as { message?: unknown }).message === "string"
    ? (err as { message: string }).message
    : fallback;

/**
 * Quản lý danh mục "Nơi nhận" (CHA) + "Chi tiết" (CON) vùng Cấp cốc (LcTabXuatCap,
 * LC_BCSX_XNL_TP). Xem .claude/LuyenCoc/PhanTich_TabCapCoc.md §10/§11 (sửa lại 2026-10-26 — tên
 * cũ "Cụm nhận" bị nhầm, đây thực chất là "Nơi nhận"; "Cụm" THẬT (Cụm 1,2,3,4/5/6-7) là 1 danh
 * mục riêng, quản lý mở rộng qua `idCum`).
 *
 * 1 Nơi nhận (vd 'LG1-CDQ') thuộc đúng 1 Cụm + 1 Loại cốc, là đơn vị GÁN (nguồn BBGN nhiều khi
 * chỉ biết tới mức thô 'LG1' — người dùng phải tự chọn đúng Nơi nhận CDQ/Ướt khi gán) và cũng là
 * đơn vị tính Trong ca/Lũy kế chính. Mỗi Nơi nhận có N Chi tiết con (vd 'LC1'..'LC4'), mỗi con có
 * thể mang 1 Loại nhận riêng (vd TP2 "NMLG-CDQ" có con LC5/LC6 × CDQ/ƯỚT/TN/xả ôtô). Danh sách
 * này là nguồn DUY NHẤT để sinh slot LAZY khi người dùng nhập/gán trên 1 phiếu Cấp cốc (xem
 * LC_XuatCapRepository.EnsureSlotAsync) — sửa ở đây có hiệu lực ngay cho mọi phiếu từ lúc đó.
 */
const QuanLyLcXuatCapDanhMuc = () => {
  const [cumForm] = Form.useForm();
  const [chiTietForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [cums, setCums] = useState<LcXuatCapDanhMucCum[]>([]);
  const [phongBanOptions, setPhongBanOptions] = useState<LcPhongBanOption[]>([]);
  const [cumOptions, setCumOptions] = useState<LcXuatCapCumOption[]>([]);
  const [loaiCocOptions, setLoaiCocOptions] = useState<LcXuatCapLoaiOption[]>([]);
  const [loaiNhanOptions, setLoaiNhanOptions] = useState<LcXuatCapLoaiOption[]>([]);
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
      message.error("Không thể tải danh mục Nơi nhận");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(scopeFilter);
    LcXuatCapDanhMucApi.getPhongBanOptions().then(setPhongBanOptions).catch((err) => console.error("Không thể tải danh sách Phòng ban:", err));
    LcXuatCapDanhMucApi.getLoaiCocOptions().then(setLoaiCocOptions).catch((err) => console.error("Không thể tải danh sách Loại cốc:", err));
    LcXuatCapDanhMucApi.getLoaiNhanOptions().then(setLoaiNhanOptions).catch((err) => console.error("Không thể tải danh sách Loại nhận:", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    LcXuatCapDanhMucApi.getCumOptions(scopeFilter).then(setCumOptions).catch((err) => console.error("Không thể tải danh sách Cụm:", err));
  }, [scopeFilter]);

  const handleFilterScope = (value: number) => {
    setScopeFilter(value);
    fetchData(value);
  };

  const phongBanOptionItems = useMemo(
    () => phongBanOptions.map((p) => ({ value: p.idPhongBan, label: p.tenNgan || p.tenPhongBan || `#${p.idPhongBan}` })),
    [phongBanOptions]
  );
  const cumOptionItems = useMemo(() => cumOptions.map((c) => ({ value: c.id, label: `${c.ten} (${c.ma})` })), [cumOptions]);
  const loaiCocOptionItems = useMemo(() => loaiCocOptions.map((l) => ({ value: l.id, label: l.ten })), [loaiCocOptions]);
  const loaiNhanOptionItems = useMemo(() => loaiNhanOptions.map((l) => ({ value: l.id, label: l.ten })), [loaiNhanOptions]);

  // Nhóm theo Cụm THẬT (tầng ngoài cùng đúng layout Excel — xem §10/§11), giữ thứ tự ThuTu của Nơi nhận.
  const groupsByCum = useMemo(() => {
    const byCum = new Map<number, { tenCumThat: string; maCum: string; items: LcXuatCapDanhMucCum[] }>();
    for (const c of cums) {
      if (!byCum.has(c.idCum)) byCum.set(c.idCum, { tenCumThat: c.tenCumThat, maCum: c.maCum, items: [] });
      byCum.get(c.idCum)!.items.push(c);
    }
    return Array.from(byCum.values());
  }, [cums]);

  // ─── Nơi nhận (cha) ──────────────────────────────────────────────────────
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
      idCum: cum.idCum,
      thuTu: cum.thuTu,
      tenCan: cum.tenCan,
      noiNhan: cum.noiNhan,
      idLoaiCoc: cum.idLoaiCoc,
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
        idCum: values.idCum,
        thuTu: values.thuTu,
        tenCan: values.tenCan.trim(),
        noiNhan: values.noiNhan.trim(),
        idLoaiCoc: values.idLoaiCoc,
        nhomTongHop: values.nhomTongHop.trim(),
        idPhongBan: values.idPhongBan ?? null,
      };
      setCumModalLoading(true);
      if (editingCum) {
        await LcXuatCapDanhMucApi.updateCum(editingCum.id, payload);
        message.success("Cập nhật Nơi nhận thành công");
      } else {
        await LcXuatCapDanhMucApi.createCum(payload);
        message.success("Tạo mới Nơi nhận thành công");
      }
      closeCumModal();
      fetchData();
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "errorFields" in error) return;
      console.error("Failed to save LC_XuatCapDanhMucCum:", error);
      message.error(getErrMsg(error, "Không thể lưu Nơi nhận"));
    } finally {
      setCumModalLoading(false);
    }
  };

  const handleDeleteCum = async (id: number) => {
    try {
      await LcXuatCapDanhMucApi.deleteCum(id);
      message.success("Đã xoá Nơi nhận (và toàn bộ Chi tiết con)");
      fetchData();
    } catch (err) {
      console.error("Failed to delete LC_XuatCapDanhMucCum:", err);
      message.error("Không thể xoá Nơi nhận");
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
    chiTietForm.setFieldsValue({ thuTu: ct.thuTu, chiTietLo: ct.chiTietLo, idLoaiNhan: ct.idLoaiNhan ?? undefined });
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
      const idLoaiNhan = values.idLoaiNhan ?? null;
      setChiTietModalLoading(true);
      if (editingChiTiet) {
        await LcXuatCapDanhMucApi.updateChiTiet(editingChiTiet.id, { thuTu: values.thuTu, chiTietLo, idLoaiNhan });
        message.success("Cập nhật Chi tiết thành công");
      } else {
        await LcXuatCapDanhMucApi.createChiTiet({ idNoiNhan: chiTietModalCum.id, thuTu: values.thuTu, chiTietLo, idLoaiNhan });
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
    { title: "Thứ tự", dataIndex: "thuTu", key: "thuTu", width: 70 },
    { title: "Chi tiết (con)", dataIndex: "chiTietLo", key: "chiTietLo", render: (v: string | null) => v ?? <span style={{ color: "#bbb" }}>(không có)</span> },
    { title: "Loại nhận", dataIndex: "tenLoaiNhan", key: "tenLoaiNhan", width: 110, render: (v: string | null) => v ?? <span style={{ color: "#bbb" }}>—</span> },
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
        title="Quản lý Nơi nhận — Cấp cốc (Luyện cốc)"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateCum}>
            Thêm Nơi nhận
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

      {cums.length === 0 && !loading && <Empty description="Chưa có Nơi nhận nào cho Thành phẩm này" />}

      <Space direction="vertical" style={{ width: "100%" }} size={16}>
        {groupsByCum.map((grp) => (
          <Card key={grp.maCum} size="small" title={<Tag color="purple">{grp.tenCumThat}</Tag>}>
            <Space direction="vertical" style={{ width: "100%" }} size={12}>
              {grp.items.map((cum) => (
                <Card
                  key={cum.id}
                  size="small"
                  type="inner"
                  title={
                    <Space>
                      <Tag color="blue">#{cum.thuTu}</Tag>
                      <b>{cum.noiNhan}</b>
                      <Typography.Text type="secondary">({cum.tenCan})</Typography.Text>
                      {cum.tenPhongBan && <Tag>{cum.tenPhongBan}</Tag>}
                    </Space>
                  }
                  extra={
                    <Space>
                      <Typography.Text type="secondary">
                        {cum.tenLoaiCoc} · Nhóm: {cum.nhomTongHop}
                      </Typography.Text>
                      <Button size="small" icon={<EditOutlined />} onClick={() => openEditCum(cum)}>
                        Sửa
                      </Button>
                      <Popconfirm title="Xoá cả Nơi nhận và Chi tiết con?" onConfirm={() => handleDeleteCum(cum.id)} okText="Xoá" cancelText="Hủy">
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
          </Card>
        ))}
      </Space>

      <Modal
        title={editingCum ? "Cập nhật Nơi nhận" : "Thêm Nơi nhận"}
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
          <Form.Item
            name="idCum"
            label="Cụm"
            rules={[{ required: true, message: "Vui lòng chọn Cụm" }]}
            extra="Cụm là tầng header thật trong Excel (vd 'Cụm 1,2,3,4') — quản lý ở danh mục riêng, có thể mở rộng khi phát sinh Cụm mới."
          >
            <Select options={cumOptionItems} placeholder="Chọn Cụm" />
          </Form.Item>
          <Form.Item name="tenCan" label="Tên cân (tham khảo hiển thị)" rules={[{ required: true, message: "Vui lòng nhập tên cân" }]}>
            <Input placeholder="VD: Cân BTC8,17 – NM.LC" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="noiNhan" label="Nơi nhận" rules={[{ required: true, message: "Vui lòng nhập tên Nơi nhận" }]}>
                <Input placeholder="VD: LG1-CDQ, LG1-Ướt" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="idLoaiCoc" label="Loại cốc" rules={[{ required: true, message: "Vui lòng chọn loại cốc" }]}>
                <Select options={loaiCocOptionItems} placeholder="Chọn loại cốc" />
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
            extra="Các Nơi nhận cùng tên nhóm sẽ gộp chung 1 giá trị Trong ca/Lũy kế (giống ô merge trên Excel gốc)."
          >
            <Input placeholder="VD: C1-BTC817-LG1CDQ" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingChiTiet ? "Cập nhật Chi tiết" : `Thêm Chi tiết vào Nơi nhận "${chiTietModalCum?.noiNhan ?? ""}"`}
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
          <Form.Item name="chiTietLo" label="Chi tiết (tuỳ chọn — để trống nếu Nơi nhận không tách con)">
            <Input placeholder="VD: LC1, ca trước, CSR62%" />
          </Form.Item>
          <Form.Item
            name="idLoaiNhan"
            label="Loại nhận (tuỳ chọn)"
            extra="Chỉ áp dụng khi Chi tiết này mang 1 biến thể CDQ/ƯỚT/TN/Xả bãi/Cốc ướt/Xả ôtô riêng (vd TP2 'LC5-CDQ')."
          >
            <Select allowClear options={loaiNhanOptionItems} placeholder="Không áp dụng" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default QuanLyLcXuatCapDanhMuc;
