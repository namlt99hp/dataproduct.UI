/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { CommonAutocomplete } from "../../../components/CommonAutocomplete";
import dayjs from "dayjs";
import { BM_CONFIG } from "../../../utils/configs/BieuMauConst";
import {
  TKVV_SCOPES,
  TKVV_CA_OPTIONS,
  getTKVVScopeByCode,
  tkvvScopeToCode,
  tkvvScopeToLabel,
  TKVV_SCOPE_OPTIONS,
} from "../../../utils/constants/TKVV_constant";
import {
  tkvvNvlApi,
  tkvvSiloApi,
  tkvvNvlSiloMappingApi,
  tkvvSiloTagMappingApi,
  tkvvVatTuApi,
  tkvvNvlBbgnMappingApi,
  type TKVVNguyenVatLieuDto,
  type TKVVSiloDto,
  type TKVVNvlSiloMappingDto,
  type TKVVSiloTagMappingDto,
  type VatTuLookupDto,
  type TKVVNvlBbgnMappingDto,
} from "../../../services/TKVVApi";

const { Title } = Typography;

const MA_BM_OPTIONS = [
  {
    label: "ALL - Tất cả BM TKVV",
    value: "ALL",
  },
  {
    label: "BB Sản lượng (TKVV_BB_SanLuong)",
    value: BM_CONFIG.TKVV.TKVV_BB_SanLuong,
  },
  {
    label: "BC Sản lượng Chi phí (TKVV_BC_SanLuongChiPhi)",
    value: BM_CONFIG.TKVV.TKVV_BC_SanLuongChiPhi,
  },
];

// Dùng chung cho NVL và Silo — cả 2 đều lưu DB dạng số "1".."6" (TKVV_NguyenVatLieu.Scope
// đổi sang số từ 2026-08-27 để khớp TKVV_Silo/TKVV_NVL_SiloMapping.Scope).
const SILO_SCOPE_OPTIONS = TKVV_SCOPES.map((s) => ({
  label: s.label,
  value: s.scope.toString(),
}));

const siloScopeLabel = (v: string | null) =>
  TKVV_SCOPES.find((s) => s.scope.toString() === v)?.label ?? v ?? "";

// "1,2,3" hoặc "1 2 3" → ["1","2","3"]
const parseScopeStr = (v: string | null | undefined): string[] =>
  v
    ? v
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

// ["1","2"] hoặc "1,2" → "1,2" lưu DB; array rỗng/null → null
const joinScopes = (
  arr: string[] | string | null | undefined,
): string | null => {
  if (!arr) return null;
  if (Array.isArray(arr)) return arr.length ? arr.join(",") : null;
  return arr || null;
};

// ─── Tab 1: Danh mục NVL ─────────────────────────────────────────────────────

const NvlTab = ({
  data,
  loading,
  selectedMaBM,
  onReload,
}: {
  data: TKVVNguyenVatLieuDto[];
  loading: boolean;
  selectedMaBM: string;
  onReload: () => void;
}) => {
  const [form] = Form.useForm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TKVVNguyenVatLieuDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteSaving, setPasteSaving] = useState(false);
  const [mappingNvl, setMappingNvl] = useState<TKVVNguyenVatLieuDto | null>(
    null,
  );
  const [bbgnByNvl, setBbgnByNvl] = useState<
    Record<number, TKVVNvlBbgnMappingDto[]>
  >({});

  const fetchBbgnMappings = useCallback(async () => {
    try {
      const res = await tkvvNvlBbgnMappingApi.getList();
      const grouped: Record<number, TKVVNvlBbgnMappingDto[]> = {};
      (Array.isArray(res) ? res : []).forEach((m) => {
        (grouped[m.tkvvNvlId] ??= []).push(m);
      });
      setBbgnByNvl(grouped);
    } catch {
      // không chặn trang nếu lỗi tải mapping — chỉ ảnh hưởng cột hiển thị
    }
  }, []);

  useEffect(() => {
    fetchBbgnMappings();
  }, [fetchBbgnMappings]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      trangThai: true,
      maBM: selectedMaBM === "ALL" ? undefined : selectedMaBM,
    });
    setModalOpen(true);
  };

  const openEdit = (record: TKVVNguyenVatLieuDto) => {
    setEditing(record);
    form.setFieldsValue({ ...record, scope: parseScopeStr(record.scope) });
    setModalOpen(true);
  };

  const handleScopeChange = (values: string[]) => {
    const labels = values
      .map((v) => TKVV_SCOPES.find((s) => s.scope.toString() === v)?.label ?? v)
      .join(", ");
    form.setFieldValue("tenScope", labels);
  };

  const handleSubmit = async () => {
    const raw = await form.validateFields();
    const values = { ...raw, scope: joinScopes(raw.scope) };
    setSaving(true);
    try {
      if (editing) {
        await tkvvNvlApi.update(editing.id, values);
        message.success("Cập nhật NVL thành công");
      } else {
        await tkvvNvlApi.create(values);
        message.success("Thêm NVL thành công");
      }
      setModalOpen(false);
      onReload();
    } catch (err: any) {
      message.error(err?.message || "Không thể lưu NVL");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await tkvvNvlApi.delete(id);
      message.success("Đã xóa NVL");
      onReload();
    } catch (err: any) {
      message.error(err?.message || "Không thể xóa NVL");
    }
  };

  // Resolve scope input (code "TK1" hoặc số "1"–"6") → { code, tenScope }
  const resolveNvlScope = (
    raw: string,
  ): { code: string; tenScope: string } | null => {
    const byCode = TKVV_SCOPES.find(
      (s) => s.code.toUpperCase() === raw.toUpperCase(),
    );
    if (byCode) return { code: byCode.code, tenScope: byCode.label };
    const byNum = TKVV_SCOPES.find((s) => s.scope.toString() === raw.trim());
    if (byNum) return { code: byNum.code, tenScope: byNum.label };
    return null;
  };

  // Format: maBM | TenNVL | DonViTinh | ThuTu | Scope
  const parsePasteRows = (text: string) => {
    const lines = text
      .split(/\r?\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) =>
        l
          .replace(/\s*\|\s*/g, "\t")
          .replace(/\s*;\s*/g, "\t")
          .split(/\t+/)
          .map((p) => p.trim()),
      );

    type ValidRow = {
      maBM: string;
      tenNVL: string;
      donViTinh: string | null;
      thuTu: number | null;
      scope: string | null;
      tenScope: string | null;
    };

    const validRows: ValidRow[] = [];
    const errorRows: string[] = [];

    for (const [i, parts] of lines.entries()) {
      const lineNo = i + 1;
      if (parts.length < 2) {
        errorRows.push(`Dòng ${lineNo}: cần ít nhất maBM và tên NVL`);
        continue;
      }

      const maBM = parts[0];
      const tenNVL = parts[1];
      const donViTinh = parts[2] || null;
      const rawThuTu = parts[3];
      const rawScope = parts[4];

      if (!maBM) {
        errorRows.push(`Dòng ${lineNo}: maBM trống`);
        continue;
      }
      if (!tenNVL) {
        errorRows.push(`Dòng ${lineNo}: tên NVL trống`);
        continue;
      }

      let thuTu: number | null = null;
      if (rawThuTu) {
        const n = Number(rawThuTu);
        if (!Number.isInteger(n)) {
          errorRows.push(`Dòng ${lineNo}: thứ tự không hợp lệ (${rawThuTu})`);
          continue;
        }
        thuTu = n;
      }

      let scope: string | null = null;
      let tenScope: string | null = null;
      // if (rawScope) {
      //   const resolved = resolveNvlScope(rawScope);
      //   if (!resolved) {
      //     errorRows.push(`Dòng ${lineNo}: scope không hợp lệ (${rawScope}) — dùng TK1..VV2 hoặc 1-6`);
      //     continue;
      //   }
      //   scope = resolved.code;
      //   tenScope = resolved.tenScope;
      // }

      validRows.push({ maBM, tenNVL, donViTinh, thuTu, scope, tenScope });
    }

    return { validRows, errorRows };
  };

  const handlePasteSubmit = async () => {
    const { validRows, errorRows } = parsePasteRows(pasteText);
    if (validRows.length === 0) {
      message.error(errorRows[0] || "Không có dòng hợp lệ");
      return;
    }
    setPasteSaving(true);
    try {
      let created = 0;
      const failedRows: string[] = [];
      for (const row of validRows) {
        try {
          await tkvvNvlApi.create(row);
          created++;
        } catch (err: any) {
          failedRows.push(`${row.tenNVL}: ${err?.message ?? "lỗi"}`);
        }
      }
      onReload();
      setPasteOpen(false);
      setPasteText("");
      const parts = [
        `Đã thêm ${created}/${validRows.length} NVL`,
        errorRows.length ? `Bỏ qua ${errorRows.length} dòng lỗi` : null,
        failedRows.length ? `Lưu thất bại ${failedRows.length} dòng` : null,
      ].filter(Boolean);
      if (errorRows.length || failedRows.length) {
        Modal.warning({
          title: "Kết quả dán nhanh NVL",
          content: (
            <div style={{ maxHeight: 320, overflow: "auto" }}>
              <p>{parts.join(". ")}.</p>
              {!!errorRows.length && (
                <div style={{ marginBottom: 8 }}>
                  <b>Dòng bỏ qua:</b>
                  {errorRows.map((r) => (
                    <div key={r}>{r}</div>
                  ))}
                </div>
              )}
              {!!failedRows.length && (
                <div>
                  <b>Lưu thất bại:</b>
                  {failedRows.map((r) => (
                    <div key={r}>{r}</div>
                  ))}
                </div>
              )}
            </div>
          ),
        });
      } else {
        message.success(parts.join(". "));
      }
    } finally {
      setPasteSaving(false);
    }
  };

  return (
    <div>
      <div
        style={{
          marginBottom: 12,
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <Space>
          <Button
            onClick={() => {
              setPasteText("");
              setPasteOpen(true);
            }}
          >
            Dán nhanh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Thêm NVL
          </Button>
        </Space>
      </div>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={data}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        size="small"
        columns={[
          {
            title: "STT",
            key: "stt",
            width: 55,
            align: "center",
            render: (_: unknown, __: unknown, i: number) => i + 1,
          },
          { title: "Mã BM", dataIndex: "maBM", width: 140, ellipsis: true },
          { title: "Tên NVL", dataIndex: "tenNVL", width: 140 },
          { title: "ĐVT", dataIndex: "donViTinh", width: 90, align: "center" },
          {
            title: "Scope",
            dataIndex: "scope",
            width: 120,
            render: (v: string | null) => {
              const scopes = parseScopeStr(v);
              if (!scopes.length) return null;
              return (
                <Space size={2} wrap>
                  {scopes.map((s) => (
                    <Tag key={s} color="blue">
                      {tkvvScopeToCode(Number(s))}
                    </Tag>
                  ))}
                </Space>
              );
            },
          },
          { title: "Tên xưởng", dataIndex: "tenScope", width: 160 },
          { title: "Thứ tự", dataIndex: "thuTu", width: 75, align: "center" },
          {
            title: "Trạng thái",
            dataIndex: "trangThai",
            width: 110,
            align: "center",
            render: (v: boolean) => (
              <Tag color={v ? "green" : "default"}>
                {v ? "Đang dùng" : "Ngừng"}
              </Tag>
            ),
          },
          {
            title: "Vật tư BBGN",
            key: "bbgnMapping",
            width: 240,
            render: (_: unknown, record: TKVVNguyenVatLieuDto) => {
              const items = bbgnByNvl[record.id] || [];
              if (items.length === 0)
                return (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Chưa móc nối NVL
                  </Typography.Text>
                );
              return (
                <Space size={[4, 4]} wrap>
                  {items.map((m) => (
                    <Tag key={m.id} color={m.trangThai ? "blue" : "default"}>
                      {m.tenVatTu ?? `#${m.idVatTuBBGN}`}
                      {m.maVatTuSap ? ` (${m.maVatTuSap})` : ""}
                    </Tag>
                  ))}
                </Space>
              );
            },
          },
          { title: "Ghi chú", dataIndex: "ghiChu", width: 90 },
          {
            title: "Thao tác",
            key: "action",
            width: 90,
            render: (_: unknown, record: TKVVNguyenVatLieuDto) => (
              <Space>
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => openEdit(record)}
                />
                <Button
                  type="text"
                  icon={<LinkOutlined />}
                  title="Ánh xạ Vật tư BBGN"
                  onClick={() => setMappingNvl(record)}
                />
                <Popconfirm
                  title="Xóa NVL này?"
                  onConfirm={() => handleDelete(record.id)}
                >
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      {/* Modal thêm/sửa đơn lẻ */}
      <Modal
        title={editing ? "Sửa NVL" : "Thêm NVL"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="maBM"
            label="Mã BM"
            rules={[{ required: true, message: "Bắt buộc" }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn Mã BM"
              options={MA_BM_OPTIONS}
              disabled={selectedMaBM !== "ALL"}
            />
          </Form.Item>
          <Form.Item
            name="tenNVL"
            label="Tên NVL"
            rules={[{ required: true, message: "Bắt buộc" }]}
          >
            <Input placeholder="VD: Quặng Vê Viên TP" />
          </Form.Item>
          <Form.Item name="donViTinh" label="Đơn vị tính">
            <Input placeholder="VD: Tấn" />
          </Form.Item>
          <Space style={{ width: "100%" }} size="middle">
            <Form.Item
              name="scope"
              label="Scope (có thể chọn nhiều)"
              style={{ minWidth: 260 }}
            >
              <Select
                mode="multiple"
                allowClear
                placeholder="Chọn scope"
                options={SILO_SCOPE_OPTIONS}
                onChange={handleScopeChange}
              />
            </Form.Item>
            <Form.Item name="tenScope" label="Tên scope" style={{ flex: 1 }}>
              <Input placeholder="Tự động điền" />
            </Form.Item>
          </Space>
          <Form.Item name="thuTu" label="Thứ tự hiển thị">
            <InputNumber style={{ width: "100%" }} />
          </Form.Item>
          {editing && (
            <Form.Item
              name="trangThai"
              label="Trạng thái"
              valuePropName="checked"
            >
              <Switch checkedChildren="Đang dùng" unCheckedChildren="Ngừng" />
            </Form.Item>
          )}
          <Form.Item name="ghiChu" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal dán nhanh nhiều NVL */}
      <Modal
        title="Dán nhanh danh mục NVL"
        open={pasteOpen}
        onCancel={() => setPasteOpen(false)}
        onOk={handlePasteSubmit}
        okText="Kiểm tra & thêm"
        confirmLoading={pasteSaving}
        destroyOnClose
        width={720}
      >
        <Space direction="vertical" style={{ width: "100%" }} size="small">
          <Typography.Text>
            Mỗi dòng một NVL. Các cột ngăn cách bằng <b>tab</b>, dấu <b>|</b>{" "}
            hoặc dấu <b>;</b>:
          </Typography.Text>
          <Typography.Text code style={{ fontSize: 12 }}>
            maBM | Tên NVL | Đơn vị tính | Thứ tự | Scope
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Ba cột cuối là tùy chọn. Scope chấp nhận mã (<b>TK1, VV2…</b>) hoặc
            số (<b>1–6</b>). Tên scope tự động điền khi lưu.
          </Typography.Text>
          <Input.TextArea
            rows={14}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={
              "Ví dụ:\nTKVV_BB_SanLuong\tQuặng Vê Viên TP\tTấn\t1\tVV1\nTKVV_BB_SanLuong\tQuặng Sinter\tTấn\t2\tTK1\nTKVV_BC_SanLuongChiPhi\tCoke\tTấn\t3\t"
            }
            style={{ fontFamily: "monospace" }}
          />
        </Space>
      </Modal>

      <NvlBbgnMappingModal
        nvl={mappingNvl}
        onClose={() => setMappingNvl(null)}
        onChanged={fetchBbgnMappings}
      />
    </div>
  );
};

// ─── Modal: Ánh xạ NVL ↔ Vật tư BBGN (Tbl_VatTu, PRODUCTDATA) ─────────────────

const NvlBbgnMappingModal = ({
  nvl,
  onClose,
  onChanged,
}: {
  nvl: TKVVNguyenVatLieuDto | null;
  onClose: () => void;
  onChanged: () => void;
}) => {
  const [data, setData] = useState<TKVVNvlBbgnMappingDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingVatTuId, setPendingVatTuId] = useState<number | null>(null);
  const [ghiChu, setGhiChu] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchData = useCallback(async () => {
    if (!nvl) return;
    setLoading(true);
    try {
      const res = await tkvvNvlBbgnMappingApi.getList(nvl.id);
      setData(Array.isArray(res) ? res : []);
    } catch {
      message.error("Lỗi khi tải danh sách ánh xạ");
    } finally {
      setLoading(false);
    }
  }, [nvl]);

  useEffect(() => {
    if (nvl) {
      setPendingVatTuId(null);
      setGhiChu("");
      fetchData();
    }
  }, [nvl, fetchData]);

  const handleAdd = async () => {
    if (!nvl || !pendingVatTuId) return;
    setAdding(true);
    try {
      await tkvvNvlBbgnMappingApi.create({
        tkvvNvlId: nvl.id,
        idVatTuBBGN: pendingVatTuId,
        ghiChu: ghiChu || undefined,
      });
      message.success("Đã thêm ánh xạ");
      setPendingVatTuId(null);
      setGhiChu("");
      fetchData();
      onChanged();
    } catch (err: any) {
      message.error(err?.message || "Không thể thêm ánh xạ");
    } finally {
      setAdding(false);
    }
  };

  const handleToggleTrangThai = async (record: TKVVNvlBbgnMappingDto) => {
    try {
      await tkvvNvlBbgnMappingApi.update(record.id, {
        trangThai: !record.trangThai,
        ghiChu: record.ghiChu,
      });
      fetchData();
      onChanged();
    } catch {
      message.error("Không thể cập nhật trạng thái");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await tkvvNvlBbgnMappingApi.delete(id);
      message.success("Đã xóa ánh xạ");
      fetchData();
      onChanged();
    } catch {
      message.error("Không thể xóa ánh xạ");
    }
  };

  return (
    <Modal
      title={`Ánh xạ Vật tư BBGN — ${nvl?.tenNVL ?? ""}`}
      open={!!nvl}
      onCancel={onClose}
      footer={null}
      width={760}
      destroyOnClose
    >
      <Space style={{ width: "100%", marginBottom: 16 }} align="start" wrap>
        <CommonAutocomplete<VatTuLookupDto>
          searchApi={tkvvVatTuApi.search}
          mapOption={(vt) => ({
            value: vt.idVatTu,
            label: vt.maVatTuSap
              ? `${vt.tenVatTu ?? ""} — ${vt.maVatTuSap}`
              : (vt.tenVatTu ?? `#${vt.idVatTu}`),
          })}
          value={pendingVatTuId}
          onChange={(value) => setPendingVatTuId((value as number) ?? null)}
          placeholder="Tìm vật tư theo tên hoặc mã SAP..."
          style={{ width: 320 }}
        />
        <Input
          placeholder="Ghi chú (tùy chọn)"
          value={ghiChu}
          onChange={(e) => setGhiChu(e.target.value)}
          style={{ width: 200 }}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          loading={adding}
          disabled={!pendingVatTuId}
          onClick={handleAdd}
        >
          Thêm
        </Button>
      </Space>
      <Table<TKVVNvlBbgnMappingDto>
        rowKey="id"
        size="small"
        loading={loading}
        dataSource={data}
        pagination={false}
        columns={[
          {
            title: "Tên vật tư",
            dataIndex: "tenVatTu",
            render: (v: string | null, r) => v ?? `#${r.idVatTuBBGN}`,
          },
          { title: "Mã SAP", dataIndex: "maVatTuSap", width: 120 },
          { title: "ĐVT", dataIndex: "donViTinh", width: 80, align: "center" },
          { title: "Ghi chú", dataIndex: "ghiChu" },
          {
            title: "Trạng thái",
            dataIndex: "trangThai",
            width: 110,
            align: "center",
            render: (v: boolean, record) => (
              <Switch
                checked={v}
                checkedChildren="Dùng"
                unCheckedChildren="Ngừng"
                onChange={() => handleToggleTrangThai(record)}
              />
            ),
          },
          {
            title: "",
            key: "action",
            width: 50,
            render: (_: unknown, record) => (
              <Popconfirm
                title="Xóa ánh xạ này?"
                onConfirm={() => handleDelete(record.id)}
              >
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            ),
          },
        ]}
      />
    </Modal>
  );
};

// ─── Tab 2: Quản lý Silo ──────────────────────────────────────────────────────

const SiloTab = () => {
  const [data, setData] = useState<TKVVSiloDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [scopeFilter, setScopeFilter] = useState<string | undefined>();
  const [form] = Form.useForm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TKVVSiloDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteSaving, setPasteSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tkvvSiloApi.getList(
        scopeFilter ? { scope: scopeFilter } : undefined,
      );
      setData(Array.isArray(res) ? res : []);
    } catch {
      message.error("Lỗi khi tải danh sách Silo");
    } finally {
      setLoading(false);
    }
  }, [scopeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // scope selector dùng giá trị số ("1","2"...) — khớp với TKVV_Silo.Scope trên DB
  const handleScopeChange = (value: string) => {
    const s = TKVV_SCOPES.find((x) => x.scope.toString() === value);
    form.setFieldValue("tenScope", s?.label ?? "");
    form.setFieldValue("maXuong", s?.code ?? "");
  };

  // Resolve scope từ input tự do: "1" / "2" / "TK1" / "VV2" → chuỗi số "1"-"6" hoặc null
  const resolveScope = (raw: string): string | null => {
    const num = Number(raw);
    if (Number.isInteger(num) && num >= 1 && num <= 6) return num.toString();
    const byCode = getTKVVScopeByCode(raw.toUpperCase());
    if (byCode) return byCode.scope.toString();
    return null;
  };

  const parsePasteRows = (text: string) => {
    const lines = text
      .split(/\r?\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) =>
        l
          .replace(/\s*[|;]\s*/g, "\t")
          .replace(/\s*,\s*/g, "\t")
          .split(/\t+/)
          .map((p) => p.trim()),
      );

    const validRows: Array<{
      scope: string;
      maXuong: string;
      maSilo: string | null;
      tenSilo: string;
      tenScope: string;
    }> = [];
    const errorRows: string[] = [];

    for (const [i, parts] of lines.entries()) {
      const lineNo = i + 1;
      if (parts.length < 2) {
        errorRows.push(`Dòng ${lineNo}: cần ít nhất scope và tên Silo`);
        continue;
      }

      const rawScope = parts[0];
      // 2 cột: scope + tenSilo | 3+ cột: scope + maSilo + tenSilo
      const maSilo = parts.length >= 3 ? parts[1] || null : null;
      const tenSilo = parts.length >= 3 ? parts.slice(2).join(" ") : parts[1];

      const scopeStr = resolveScope(rawScope);
      if (!scopeStr) {
        errorRows.push(
          `Dòng ${lineNo}: scope không hợp lệ (${rawScope}) — dùng 1-6 hoặc TK1/VV1…`,
        );
        continue;
      }
      if (!tenSilo) {
        errorRows.push(`Dòng ${lineNo}: tên Silo trống`);
        continue;
      }
      const scopeInfo = TKVV_SCOPES.find(
        (s) => s.scope.toString() === scopeStr,
      );
      validRows.push({
        scope: scopeStr,
        maXuong: scopeInfo?.code ?? "",
        maSilo,
        tenSilo,
        tenScope: scopeInfo?.label ?? "",
      });
    }

    return { validRows, errorRows };
  };

  const handlePasteSubmit = async () => {
    const { validRows, errorRows } = parsePasteRows(pasteText);
    if (validRows.length === 0) {
      message.error(errorRows[0] || "Không có dòng hợp lệ");
      return;
    }
    setPasteSaving(true);
    try {
      let created = 0;
      const failedRows: string[] = [];
      for (const row of validRows) {
        try {
          await tkvvSiloApi.create({
            scope: row.scope,
            tenScope: row.tenScope,
            maXuong: row.maXuong,
            maSilo: row.maSilo,
            tenSilo: row.tenSilo,
          });
          created++;
        } catch (err: any) {
          failedRows.push(
            `${row.maSilo ?? "?"} ${row.tenSilo}: ${err?.message ?? "lỗi"}`,
          );
        }
      }
      await fetchData();
      setPasteOpen(false);
      setPasteText("");
      const parts = [
        `Đã thêm ${created}/${validRows.length} Silo`,
        errorRows.length ? `Bỏ qua ${errorRows.length} dòng lỗi` : null,
        failedRows.length ? `Lưu thất bại ${failedRows.length} dòng` : null,
      ].filter(Boolean);
      if (errorRows.length || failedRows.length) {
        Modal.warning({
          title: "Kết quả dán nhanh Silo",
          content: (
            <div style={{ maxHeight: 320, overflow: "auto" }}>
              <p>{parts.join(". ")}.</p>
              {!!errorRows.length && (
                <div>
                  <b>Dòng bỏ qua:</b>
                  {errorRows.map((r) => (
                    <div key={r}>{r}</div>
                  ))}
                </div>
              )}
              {!!failedRows.length && (
                <div>
                  <b>Lưu thất bại:</b>
                  {failedRows.map((r) => (
                    <div key={r}>{r}</div>
                  ))}
                </div>
              )}
            </div>
          ),
        });
      } else {
        message.success(parts.join(". "));
      }
    } finally {
      setPasteSaving(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record: TKVVSiloDto) => {
    setEditing(record);
    form.setFieldsValue({
      scope: record.scope,
      tenScope: record.tenScope,
      maXuong: record.maXuong,
      maSilo: record.maSilo,
      tenSilo: record.tenSilo,
      ghiChu: record.ghiChu,
      trangThai: record.trangThai,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editing) {
        await tkvvSiloApi.update(editing.id, values);
        message.success("Cập nhật Silo thành công");
      } else {
        await tkvvSiloApi.create(values);
        message.success("Thêm Silo thành công");
      }
      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      message.error(err?.message || "Không thể lưu Silo");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await tkvvSiloApi.delete(id);
      message.success("Đã xóa Silo");
      fetchData();
    } catch (err: any) {
      message.error(err?.message || "Không thể xóa Silo");
    }
  };

  return (
    <div>
      <div
        style={{
          marginBottom: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Space>
          <span style={{ fontWeight: 500 }}>Scope:</span>
          <Select
            allowClear
            placeholder="Tất cả scope"
            style={{ width: 220 }}
            options={SILO_SCOPE_OPTIONS}
            value={scopeFilter}
            onChange={(v) => setScopeFilter(v)}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchData}>
            Làm mới
          </Button>
        </Space>
        <Space>
          <Button
            onClick={() => {
              setPasteText("");
              setPasteOpen(true);
            }}
          >
            Dán nhanh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Thêm Silo
          </Button>
        </Space>
      </div>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={data}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        size="small"
        scroll={{ x: 900 }}
        columns={[
          {
            title: "Scope",
            dataIndex: "scope",
            width: 60,
            align: "center",
            render: (v: string | null) =>
              v ? <Tag color="blue">{v}</Tag> : null,
          },
          {
            title: "Tên khu vực",
            dataIndex: "scope",
            key: "tenKhuVuc",
            width: 180,
            render: (v: string | null) => siloScopeLabel(v),
          },
          {
            title: "Mã Silo",
            dataIndex: "maSilo",
            width: 110,
            align: "center",
          },
          { title: "Tên Silo", dataIndex: "tenSilo" },
          { title: "Ghi chú", dataIndex: "ghiChu", ellipsis: true },
          {
            title: "TT",
            dataIndex: "trangThai",
            width: 80,
            align: "center",
            render: (v: boolean) => (
              <Tag color={v ? "green" : "default"}>{v ? "Dùng" : "Ngừng"}</Tag>
            ),
          },
          {
            title: "Thao tác",
            key: "action",
            width: 90,
            render: (_: unknown, record: TKVVSiloDto) => (
              <Space>
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => openEdit(record)}
                />
                <Popconfirm
                  title="Xóa Silo này?"
                  onConfirm={() => handleDelete(record.id)}
                >
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      {/* Modal thêm/sửa đơn lẻ */}
      <Modal
        title={editing ? "Sửa Silo" : "Thêm Silo"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={saving}
        destroyOnClose
        width={560}
      >
        <Form form={form} layout="vertical">
          <Space style={{ width: "100%" }}>
            <Form.Item name="scope" label="Scope (số)" style={{ width: 200 }}>
              <Select
                allowClear
                placeholder="VD: 1 = TK1"
                options={SILO_SCOPE_OPTIONS}
                onChange={handleScopeChange}
              />
            </Form.Item>
            <Form.Item name="tenScope" label="Tên scope" style={{ flex: 1 }}>
              <Input placeholder="Tự động điền" />
            </Form.Item>
          </Space>
          <Space style={{ width: "100%" }}>
            <Form.Item name="maSilo" label="Mã Silo" style={{ width: 160 }}>
              <Input placeholder="VD: SILO_01" />
            </Form.Item>
            <Form.Item
              name="tenSilo"
              label="Tên Silo"
              rules={[{ required: true, message: "Bắt buộc" }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="VD: Silo Quặng TK1 - Ca ngày" />
            </Form.Item>
          </Space>
          {editing && (
            <Form.Item
              name="trangThai"
              label="Trạng thái"
              valuePropName="checked"
            >
              <Switch checkedChildren="Đang dùng" unCheckedChildren="Ngừng" />
            </Form.Item>
          )}
          <Form.Item name="ghiChu" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal dán nhanh nhiều Silo */}
      <Modal
        title="Dán nhanh Silo"
        open={pasteOpen}
        onCancel={() => setPasteOpen(false)}
        onOk={handlePasteSubmit}
        okText="Kiểm tra & thêm"
        confirmLoading={pasteSaving}
        destroyOnClose
        width={680}
      >
        <Space direction="vertical" style={{ width: "100%" }} size="small">
          <Typography.Text>
            Mỗi dòng một Silo theo định dạng: <b>scope — mã silo — tên silo</b>.
            Cột mã silo là tùy chọn (nếu chỉ 2 cột: scope + tên silo). Ngăn cách
            bằng tab, dấu phẩy hoặc dấu chấm phẩy.
          </Typography.Text>
          <Typography.Text type="secondary">
            scope: số <b>1–6</b> hoặc mã <b>TK1, TK2, TK3, TK4, VV1, VV2</b>
          </Typography.Text>
          <Input.TextArea
            rows={12}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={
              "Ví dụ:\n1\tSILO_TK1_01\tSilo Thiêu kết 1 - Ca ngày\n2\tSILO_TK2_01\tSilo TK2\nTK3\t\tSilo TK3 không mã"
            }
          />
        </Space>
      </Modal>
    </div>
  );
};

// ─── Batch add modal: thêm nhiều NVL-Silo cùng lúc ──────────────────────────

interface BatchRow {
  key: number;
  nvlId: number | null;
  siloId: number | null;
  ca: number | null;
  thuTu: number | null;
}

const newBatchRow = (): BatchRow => ({
  key: Date.now() + Math.random(),
  nvlId: null,
  siloId: null,
  ca: null,
  thuTu: null,
});

const BatchMappingModal = ({
  open,
  onClose,
  onSaved,
  allNvl,
  allSilo,
  defaultMaBM,
  defaultScope,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  allNvl: TKVVNguyenVatLieuDto[];
  allSilo: TKVVSiloDto[];
  defaultMaBM?: string;
  defaultScope?: string;
}) => {
  const [scope, setScope] = useState<string | null>(defaultScope ?? null);
  const [ngaySX, setNgaySX] = useState<dayjs.Dayjs>(dayjs());
  const [maBM, setMaBM] = useState<string>(defaultMaBM ?? "ALL");
  const [rows, setRows] = useState<BatchRow[]>([newBatchRow()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setScope(defaultScope ?? null);
      setMaBM(defaultMaBM ?? "ALL");
      setNgaySX(dayjs());
      setRows([newBatchRow()]);
    }
  }, [open, defaultMaBM, defaultScope]);

  const nvlOptions = useMemo(
    () =>
      allNvl.filter(
        (n) =>
          n.trangThai &&
          (!maBM || maBM === "ALL" || n.maBM === maBM) &&
          (!scope || parseScopeStr(n.scope).includes(scope)),
      ),
    [allNvl, maBM, scope],
  );

  const siloOptions = useMemo(
    () =>
      scope ? allSilo.filter((s) => s.trangThai && s.scope === scope) : [],
    [allSilo, scope],
  );

  const updateRow = (key: number, patch: Partial<BatchRow>) =>
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );

  const removeRow = (key: number) =>
    setRows((prev) => prev.filter((r) => r.key !== key));

  const handleScopeChange = (v: string) => {
    setScope(v ?? null);
    setRows((prev) => prev.map((r) => ({ ...r, siloId: null })));
  };

  const handleSave = async () => {
    if (!scope) {
      message.warning("Chọn scope");
      return;
    }
    if (!ngaySX) {
      message.warning("Chọn ngày SX");
      return;
    }
    const validRows = rows.filter((r) => r.nvlId && r.siloId && r.ca);
    if (validRows.length === 0) {
      message.warning("Chưa có dòng hợp lệ (cần NVL + Silo + Ca)");
      return;
    }
    setSaving(true);
    try {
      const result = await tkvvNvlSiloMappingApi.batchCreate({
        maBM: maBM === "ALL" ? "ALL" : maBM,
        scope,
        ngaySX: ngaySX.format("YYYY-MM-DD"),
        rows: validRows.map((r) => {
          const nvl = allNvl.find((n) => n.id === r.nvlId);
          return {
            nguyenVatLieuID: r.nvlId!,
            siloID: r.siloId,
            ca: r.ca!,
            thuTu: r.thuTu,
          };
        }),
      });
      message.success(`Đã thêm ${result.count} mapping`);
      onSaved();
      onClose();
    } catch (err: any) {
      message.error(err?.message || "Không thể lưu");
    } finally {
      setSaving(false);
    }
  };

  const scopeLabel = scope ? tkvvScopeToCode(Number(scope)) : "";

  return (
    <Modal
      title="Thêm nhiều NVL-Silo"
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      confirmLoading={saving}
      okText={`Lưu ${rows.filter((r) => r.nvlId && r.siloId && r.ca).length || ""} mapping`}
      width={900}
      destroyOnClose
    >
      {/* ── Header chung ─────────────────────────────────────────────────── */}
      <Space wrap style={{ marginBottom: 12 }}>
        <Form.Item label="Scope" style={{ marginBottom: 0 }} required>
          <Select
            style={{ width: 200 }}
            placeholder="Chọn scope"
            options={SILO_SCOPE_OPTIONS}
            value={scope ?? undefined}
            onChange={handleScopeChange}
            allowClear
          />
        </Form.Item>
        <Form.Item label="Ngày SX" style={{ marginBottom: 0 }} required>
          <DatePicker
            value={ngaySX}
            onChange={(v) => setNgaySX(v ?? dayjs())}
            format="DD/MM/YYYY"
          />
        </Form.Item>
        <Form.Item label="Mã BM" style={{ marginBottom: 0 }}>
          <Select
            style={{ width: 200 }}
            options={MA_BM_OPTIONS}
            value={maBM}
            onChange={setMaBM}
          />
        </Form.Item>
      </Space>

      {/* ── Bảng dòng mapping ────────────────────────────────────────────── */}
      <Table<BatchRow>
        dataSource={rows}
        rowKey="key"
        pagination={false}
        size="small"
        scroll={{ x: 700 }}
        columns={[
          {
            title: "STT",
            width: 45,
            align: "center",
            render: (_: unknown, __: unknown, i: number) => i + 1,
          },
          {
            title: "NVL",
            dataIndex: "nvlId",
            render: (v: number | null, record) => (
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Chọn NVL"
                style={{ width: 220 }}
                value={v ?? undefined}
                options={nvlOptions.map((n) => ({
                  label: n.tenNVL,
                  value: n.id,
                }))}
                onChange={(val) => updateRow(record.key, { nvlId: val })}
              />
            ),
          },
          {
            title: `Silo${scopeLabel ? ` (${scopeLabel})` : ""}`,
            dataIndex: "siloId",
            render: (v: number | null, record) => (
              <Select
                showSearch
                optionFilterProp="label"
                placeholder={scope ? "Chọn Silo" : "Chọn scope trước"}
                disabled={!scope}
                style={{ width: 220 }}
                value={v ?? undefined}
                options={siloOptions.map((s) => ({
                  label: s.maSilo
                    ? `[${s.maXuong ?? ""}] ${s.maSilo} — ${s.tenSilo}`
                    : s.tenSilo,
                  value: s.id,
                }))}
                onChange={(val) => updateRow(record.key, { siloId: val })}
              />
            ),
          },
          {
            title: "Ca",
            dataIndex: "ca",
            width: 120,
            render: (v: number | null, record) => (
              <Select
                style={{ width: 110 }}
                placeholder="Ca"
                value={v ?? undefined}
                options={TKVV_CA_OPTIONS}
                onChange={(val) => updateRow(record.key, { ca: val })}
              />
            ),
          },
          {
            title: "Thứ tự",
            dataIndex: "thuTu",
            width: 85,
            render: (v: number | null, record) => (
              <InputNumber
                style={{ width: 75 }}
                value={v}
                min={0}
                onChange={(val) => updateRow(record.key, { thuTu: val })}
              />
            ),
          },
          {
            title: "",
            key: "del",
            width: 40,
            render: (_: unknown, record) => (
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => removeRow(record.key)}
                disabled={rows.length <= 1}
              />
            ),
          },
        ]}
        footer={() => (
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => setRows((prev) => [...prev, newBatchRow()])}
            block
          >
            Thêm dòng
          </Button>
        )}
      />
    </Modal>
  );
};

// ─── Tab 3: NVL ↔ Silo theo Ca ───────────────────────────────────────────────

const NvlSiloMappingTab = ({
  allNvl,
  allSilo,
  selectedMaBM,
  selectedScope,
}: {
  allNvl: TKVVNguyenVatLieuDto[];
  allSilo: TKVVSiloDto[];
  selectedMaBM: string;
  selectedScope?: string;
}) => {
  const [data, setData] = useState<TKVVNvlSiloMappingDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [nvlFilter, setNvlFilter] = useState<number | undefined>();
  const [siloFilter, setSiloFilter] = useState<number | undefined>();
  const [form] = Form.useForm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TKVVNvlSiloMappingDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteSaving, setPasteSaving] = useState(false);
  const [selectedNvlScope, setSelectedNvlScope] = useState<string | null>(null);
  const [selectedMappingScope, setSelectedMappingScope] = useState<
    string | null
  >(null);
  const [batchOpen, setBatchOpen] = useState(false);

  const activeNvlOptions = useMemo(
    () =>
      allNvl.filter(
        (n) =>
          n.trangThai &&
          (!selectedMaBM ||
            selectedMaBM === "ALL" ||
            n.maBM === selectedMaBM) &&
          (!selectedScope || parseScopeStr(n.scope).includes(selectedScope)),
      ),
    [allNvl, selectedMaBM, selectedScope],
  );

  const activeSiloOptions = useMemo(
    () =>
      allSilo.filter(
        (s) => s.trangThai && (!selectedScope || s.scope === selectedScope),
      ),
    [allSilo, selectedScope],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tkvvNvlSiloMappingApi.getList({
        ...(selectedMaBM && selectedMaBM !== "ALL"
          ? { maBM: selectedMaBM }
          : {}),
        ...(selectedScope ? { scope: selectedScope } : {}),
        ...(nvlFilter ? { nvlId: nvlFilter } : {}),
        ...(siloFilter ? { siloId: siloFilter } : {}),
      });
      setData(Array.isArray(res) ? res : []);
    } catch {
      message.error("Lỗi khi tải danh sách NVL-Silo");
    } finally {
      setLoading(false);
    }
  }, [nvlFilter, siloFilter, selectedMaBM, selectedScope]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // selectedNvlScope lưu dạng số string ("1","2"...) để khớp với Silo.scope
  const filteredSiloOptions = useMemo(() => {
    if (!selectedMappingScope) return [];
    return allSilo.filter(
      (s) => s.trangThai && s.scope === selectedMappingScope,
    );
  }, [allSilo, selectedMappingScope]);

  const handleNvlChange = (nvlId: number) => {
    const nvl = allNvl.find((n) => n.id === nvlId);
    const scopes = parseScopeStr(nvl?.scope);
    setSelectedNvlScope(nvl?.scope ?? null);
    form.setFieldValue("maBM", nvl?.maBM ?? selectedMaBM ?? null);
    form.setFieldValue("thuTu", nvl?.thuTu ?? null);
    form.setFieldValue("siloID", undefined);
    if (scopes.length === 1) {
      // NVL chỉ có 1 scope → tự điền luôn
      setSelectedMappingScope(scopes[0]);
      form.setFieldValue("scope", scopes[0]);
    } else {
      // NVL nhiều scope → user phải chọn scope trước
      setSelectedMappingScope(null);
      form.setFieldValue("scope", undefined);
    }
  };

  const handleMappingScopeChange = (scopeVal: string) => {
    setSelectedMappingScope(scopeVal ?? null);
    form.setFieldValue("siloID", undefined); // reset silo khi đổi scope
  };

  const handleSiloChange = (siloId: number) => {
    const silo = allSilo.find((s) => s.id === siloId);
    if (silo?.scope) form.setFieldValue("scope", silo.scope);
  };

  const openCreate = () => {
    setEditing(null);
    setSelectedNvlScope(null);
    setSelectedMappingScope(selectedScope ?? null);
    form.resetFields();
    form.setFieldsValue({ maBM: selectedMaBM, scope: selectedScope ?? null });
    setModalOpen(true);
  };

  const openEdit = (record: TKVVNvlSiloMappingDto) => {
    setEditing(record);
    const nvl = allNvl.find((n) => n.id === record.nguyenVatLieuID);
    setSelectedNvlScope(nvl?.scope ?? record.scope ?? null);
    setSelectedMappingScope(record.scope ?? null);
    form.setFieldsValue({
      nguyenVatLieuID: record.nguyenVatLieuID,
      maBM: record.maBM,
      scope: record.scope,
      thuTu: record.thuTu,
      siloID: record.siloID,
      ca: record.ca,
      ngaySX: record.ngaySX ? dayjs(record.ngaySX) : null,
      ghiChu: record.ghiChu,
      trangThai: record.trangThai,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const dto = {
      ...values,
      ngaySX: values.ngaySX ? dayjs(values.ngaySX).format("YYYY-MM-DD") : "",
    };
    setSaving(true);
    try {
      if (editing) {
        await tkvvNvlSiloMappingApi.update(editing.id, dto);
        message.success("Cập nhật NVL-Silo thành công");
      } else {
        await tkvvNvlSiloMappingApi.create(dto);
        message.success("Thêm NVL-Silo thành công");
      }
      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      message.error(err?.message || "Không thể lưu");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await tkvvNvlSiloMappingApi.delete(id);
      message.success("Đã xóa");
      fetchData();
    } catch (err: any) {
      message.error(err?.message || "Không thể xóa");
    }
  };

  const normalizeScopeCode = (raw: string | null): string | null => {
    if (!raw) return null;
    const trimmed = raw.trim();
    const byCode = getTKVVScopeByCode(trimmed.toUpperCase());
    if (byCode) return byCode.code;
    const byNumber = TKVV_SCOPES.find((s) => s.scope.toString() === trimmed);
    return byNumber?.scope.toString() ?? null;
  };

  const parseDateToIso = (raw: string | null): string | null => {
    if (!raw) return null;
    const trimmed = raw.trim();
    const ymd = /^(\d{4})-(\d{2})-(\d{2})$/;
    const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const dashDmy = /^(\d{2})-(\d{2})-(\d{4})$/;

    let match = trimmed.match(ymd);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;

    match = trimmed.match(dmy);
    if (match) return `${match[3]}-${match[2]}-${match[1]}`;

    match = trimmed.match(dashDmy);
    if (match) return `${match[3]}-${match[2]}-${match[1]}`;

    return null;
  };

  const parsePasteRows = (text: string) => {
    const rows = text
      .split(/\r?\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) =>
        line
          .replace(/\s*[|;]\s*/g, "\t")
          .replace(/\s*,\s*/g, "\t")
          .split(/\t+/)
          .map((part) => part.trim()),
      );

    type ValidRow = {
      maBM: string;
      nguyenVatLieuID: number;
      scope: string;
      siloID: number;
      ngaySX: string;
      ca: number;
      thuTu: number | null;
    };

    const validRows: ValidRow[] = [];
    const errorRows: string[] = [];

    for (const [index, parts] of rows.entries()) {
      const lineNo = index + 1;
      if (parts.length < 6) {
        errorRows.push(
          `Dòng ${lineNo}: cần ít nhất 6 cột (Mã BM, NVLID, scope, SiloID, ngày sx, ca)`,
        );
        continue;
      }
      const maBM = parts[0];
      const nvlId = Number(parts[1]);
      const scope = normalizeScopeCode(parts[2]);
      const siloId = Number(parts[3]);
      const ngaySX = parseDateToIso(parts[4]);
      const ca = Number(parts[5]);
      const rawThuTu = parts[6];
      const thuTu = rawThuTu ? Number(rawThuTu) : null;

      if (!maBM) {
        errorRows.push(`Dòng ${lineNo}: Mã BM trống`);
        continue;
      }
      if (!Number.isInteger(nvlId) || nvlId <= 0) {
        errorRows.push(`Dòng ${lineNo}: NVLID không hợp lệ (${parts[1]})`);
        continue;
      }
      if (!scope) {
        errorRows.push(`Dòng ${lineNo}: scope không hợp lệ (${parts[2]})`);
        continue;
      }
      if (!Number.isInteger(siloId) || siloId <= 0) {
        errorRows.push(`Dòng ${lineNo}: SiloID không hợp lệ (${parts[3]})`);
        continue;
      }
      if (!ngaySX) {
        errorRows.push(`Dòng ${lineNo}: ngày sx không hợp lệ (${parts[4]})`);
        continue;
      }
      if (!Number.isInteger(ca) || (ca !== 1 && ca !== 2)) {
        errorRows.push(`Dòng ${lineNo}: ca không hợp lệ (${parts[5]})`);
        continue;
      }
      if (rawThuTu && (!Number.isInteger(thuTu) || (thuTu ?? 0) < 0)) {
        errorRows.push(`Dòng ${lineNo}: Thứ tự không hợp lệ (${rawThuTu})`);
        continue;
      }

      const nvl = allNvl.find((item) => item.id === nvlId);
      if (!nvl) {
        errorRows.push(`Dòng ${lineNo}: không tìm thấy NVL ID=${nvlId}`);
        continue;
      }
      // if (nvl.maBM !== maBM) {
      //   errorRows.push(
      //     `Dòng ${lineNo}: Mã BM ${maBM} không khớp với NVL ID=${nvlId} (${nvl.maBM})`,
      //   );
      //   continue;
      // }
      // if (nvl.scope && nvl.scope !== scope) {
      //   errorRows.push(
      //     `Dòng ${lineNo}: scope ${scope} không khớp với NVL ID=${nvlId} (${nvl.scope})`,
      //   );
      //   continue;
      // }

      const silo = allSilo.find((item) => item.id === siloId);
      if (!silo) {
        errorRows.push(`Dòng ${lineNo}: không tìm thấy Silo ID=${siloId}`);
        continue;
      }
      const siloScopeCode = normalizeScopeCode(silo.scope);
      if (siloScopeCode && siloScopeCode !== scope) {
        errorRows.push(
          `Dòng ${lineNo}: scope ${scope} không khớp với Silo ID=${siloId} (${silo.scope ?? "?"})`,
        );
        continue;
      }

      validRows.push({
        maBM,
        nguyenVatLieuID: nvlId,
        scope,
        siloID: siloId,
        ngaySX,
        ca,
        thuTu,
      });
    }

    return { validRows, errorRows };
  };

  const handlePasteSubmit = async () => {
    const { validRows, errorRows } = parsePasteRows(pasteText);
    if (validRows.length === 0) {
      message.error(errorRows[0] || "Không có dòng hợp lệ");
      return;
    }

    setPasteSaving(true);
    try {
      let created = 0;
      const failedRows: string[] = [];

      for (const row of validRows) {
        try {
          await tkvvNvlSiloMappingApi.create(row);
          created += 1;
        } catch (err: any) {
          failedRows.push(
            `NVL ${row.nguyenVatLieuID} / Silo ${row.siloID}: ${err?.message || "không thể lưu"}`,
          );
        }
      }

      await fetchData();
      setPasteOpen(false);
      setPasteText("");

      const parts = [
        `Đã thêm ${created}/${validRows.length} mapping`,
        errorRows.length ? `Bỏ qua ${errorRows.length} dòng lỗi` : null,
        failedRows.length ? `Lưu thất bại ${failedRows.length} dòng` : null,
      ].filter(Boolean);

      if (errorRows.length || failedRows.length) {
        Modal.warning({
          title: "Kết quả dán nhanh NVL-Silo",
          width: 780,
          content: (
            <div style={{ maxHeight: 360, overflow: "auto" }}>
              <p style={{ marginBottom: 8 }}>{parts.join(". ")}.</p>
              {!!errorRows.length && (
                <div style={{ marginBottom: 12 }}>
                  <b>Dòng bỏ qua:</b>
                  {errorRows.map((item) => (
                    <div key={item}>{item}</div>
                  ))}
                </div>
              )}
              {!!failedRows.length && (
                <div>
                  <b>Lưu thất bại:</b>
                  {failedRows.map((item) => (
                    <div key={item}>{item}</div>
                  ))}
                </div>
              )}
            </div>
          ),
        });
      } else {
        message.success(parts.join(". "));
      }
    } finally {
      setPasteSaving(false);
    }
  };

  return (
    <div>
      <div
        style={{
          marginBottom: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Space wrap>
          <span style={{ fontWeight: 500 }}>Lọc NVL:</span>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Tất cả NVL"
            style={{ width: 260 }}
            options={activeNvlOptions.map((n) => ({
              label: `[${n.scope ? tkvvScopeToCode(Number(n.scope)) : "?"}] ${n.tenNVL}`,
              value: n.id,
            }))}
            value={nvlFilter}
            onChange={(v) => setNvlFilter(v)}
          />
          <span style={{ fontWeight: 500 }}>Lọc Silo:</span>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Tất cả Silo"
            style={{ width: 220 }}
            options={activeSiloOptions.map((s) => ({
              label: `[${s.scope ?? "?"}] ${s.tenSilo}`,
              value: s.id,
            }))}
            value={siloFilter}
            onChange={(v) => setSiloFilter(v)}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchData}>
            Làm mới
          </Button>
        </Space>
        <Space>
          <Button
            onClick={() => {
              setPasteText("");
              setPasteOpen(true);
            }}
            disabled={allNvl.length === 0 || allSilo.length === 0}
          >
            Dán nhanh
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={() => setBatchOpen(true)}
            disabled={allNvl.length === 0 || allSilo.length === 0}
          >
            Thêm nhiều
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreate}
            disabled={allNvl.length === 0 || allSilo.length === 0}
          >
            Thêm 1 mapping
          </Button>
        </Space>
      </div>

      <BatchMappingModal
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        onSaved={fetchData}
        allNvl={allNvl}
        allSilo={allSilo}
        defaultMaBM={selectedMaBM}
        defaultScope={selectedScope}
      />

      <Table
        rowKey="id"
        loading={loading}
        dataSource={data}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        size="small"
        scroll={{ x: 900 }}
        columns={[
          {
            title: "Scope",
            dataIndex: "scope",
            width: 80,
            align: "center",
            render: (v: string | null) =>
              v ? <Tag color="blue">{tkvvScopeToCode(Number(v))}</Tag> : null,
          },
          { title: "Mã BM", dataIndex: "maBM", width: 140, ellipsis: true },
          { title: "Tên NVL", dataIndex: "tenNVL", width: 200, ellipsis: true },
          {
            title: "Silo",
            key: "silo",
            width: 220,
            render: (_: unknown, r: TKVVNvlSiloMappingDto) => {
              const maXuong = allSilo.find((s) => s.id === r.siloID)?.maXuong;
              const siloLabel = r.maSilo
                ? `${r.maSilo} — ${r.tenSilo}`
                : (r.tenSilo ?? "");
              return maXuong ? `[${maXuong}] ${siloLabel}` : siloLabel;
            },
          },
          { title: "Thứ tự", dataIndex: "thuTu", width: 80, align: "center" },
          {
            title: "Ca",
            dataIndex: "ca",
            width: 100,
            align: "center",
            render: (v: number) =>
              v === 1 ? (
                <Tag color="orange">Ca ngày</Tag>
              ) : (
                <Tag color="blue">Ca đêm</Tag>
              ),
          },
          {
            title: "Ngày SX",
            dataIndex: "ngaySX",
            width: 110,
            align: "center",
            render: (v: string) => (v ? dayjs(v).format("DD/MM/YYYY") : ""),
          },
          { title: "Ghi chú", width: 80, dataIndex: "ghiChu", ellipsis: true },
          {
            title: "TT",
            dataIndex: "trangThai",
            width: 80,
            align: "center",
            render: (v: boolean) => (
              <Tag color={v ? "green" : "default"}>{v ? "Dùng" : "Ngừng"}</Tag>
            ),
          },
          {
            title: "Ngày cập nhật",
            dataIndex: "ngayCapNhat",
            width: 140,
            render: (v: string) =>
              v ? dayjs(v).format("DD/MM/YYYY HH:mm") : "",
          },
          {
            title: "Thao tác",
            key: "action",
            width: 90,
            render: (_: unknown, record: TKVVNvlSiloMappingDto) => (
              <Space>
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => openEdit(record)}
                />
                <Popconfirm
                  title="Xóa mapping này?"
                  onConfirm={() => handleDelete(record.id)}
                >
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editing ? "Sửa NVL-Silo" : "Thêm NVL-Silo"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="nguyenVatLieuID"
            label="Nguyên vật liệu"
            rules={[{ required: true, message: "Bắt buộc" }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn NVL"
              options={allNvl.map((n) => ({
                label: `[${parseScopeStr(n.scope)
                  .map((s) => tkvvScopeToCode(Number(s)))
                  .join(",")}] ${n.tenNVL}`,
                value: n.id,
              }))}
              onChange={handleNvlChange}
            />
          </Form.Item>
          <Space style={{ width: "100%" }} size="middle">
            <Form.Item name="maBM" label="Mã BM" style={{ width: 180 }}>
              <Input disabled />
            </Form.Item>
            <Form.Item
              name="scope"
              label="Scope (xưởng)"
              rules={[{ required: true, message: "Bắt buộc" }]}
              style={{ width: 200 }}
            >
              {(() => {
                const nvlScopes = parseScopeStr(selectedNvlScope);
                const opts = nvlScopes.length
                  ? SILO_SCOPE_OPTIONS.filter((o) =>
                      nvlScopes.includes(o.value),
                    )
                  : SILO_SCOPE_OPTIONS;
                return (
                  <Select
                    placeholder={
                      nvlScopes.length > 1 ? "Chọn scope cho mapping này" : "—"
                    }
                    options={opts}
                    disabled={nvlScopes.length <= 1}
                    onChange={handleMappingScopeChange}
                    allowClear={nvlScopes.length > 1}
                  />
                );
              })()}
            </Form.Item>
            <Form.Item name="thuTu" label="Thứ tự" style={{ width: 120 }}>
              <InputNumber style={{ width: "100%" }} />
            </Form.Item>
          </Space>
          <Form.Item
            name="siloID"
            label={
              selectedMappingScope
                ? `Silo (scope ${tkvvScopeToCode(Number(selectedMappingScope))})`
                : parseScopeStr(selectedNvlScope).length > 1
                  ? "Silo (chọn scope trước)"
                  : "Silo"
            }
            rules={[{ required: true, message: "Bắt buộc" }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder={
                selectedMappingScope ? "Chọn Silo" : "Chọn scope trước"
              }
              disabled={!selectedMappingScope}
              options={filteredSiloOptions.map((s) => ({
                label: s.maSilo ? `${s.maSilo} — ${s.tenSilo}` : s.tenSilo,
                value: s.id,
              }))}
              onChange={handleSiloChange}
            />
          </Form.Item>
          <Space style={{ width: "100%" }}>
            <Form.Item
              name="ca"
              label="Ca"
              rules={[{ required: true, message: "Bắt buộc" }]}
              style={{ width: 160 }}
            >
              <Select options={TKVV_CA_OPTIONS} placeholder="Chọn ca" />
            </Form.Item>
            <Form.Item
              name="ngaySX"
              label="Ngày SX"
              rules={[{ required: true, message: "Bắt buộc" }]}
              style={{ flex: 1 }}
            >
              <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
            </Form.Item>
          </Space>
          {editing && (
            <Form.Item
              name="trangThai"
              label="Trạng thái"
              valuePropName="checked"
            >
              <Switch checkedChildren="Đang dùng" unCheckedChildren="Ngừng" />
            </Form.Item>
          )}
          <Form.Item name="ghiChu" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Dán nhanh NVL-Silo"
        open={pasteOpen}
        onCancel={() => setPasteOpen(false)}
        onOk={handlePasteSubmit}
        okText="Kiểm tra & thêm"
        confirmLoading={pasteSaving}
        destroyOnClose
        width={820}
      >
        <Space direction="vertical" style={{ width: "100%" }} size="small">
          <Typography.Text>
            Mỗi dòng theo thứ tự:{" "}
            <b>Mã BM - NVLID - scope - SiloID - ngày sx - ca - Thứ tự</b>. Ngăn
            cách bằng tab, dấu phẩy, dấu chấm phẩy hoặc dấu <b>|</b>.
          </Typography.Text>
          <Typography.Text type="secondary">
            scope chấp nhận <b>TK1, TK2, TK3, TK4, VV1, VV2</b> hoặc số{" "}
            <b>1-6</b>. Ngày sx chấp nhận <b>YYYY-MM-DD</b> hoặc{" "}
            <b>DD/MM/YYYY</b>.
          </Typography.Text>
          <Input.TextArea
            rows={14}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={
              "Ví dụ:\nTKVV_BB_SanLuong\t101\tTK1\t12\t2026-08-17\t1\t1\nTKVV_BB_SanLuong\t102\tTK1\t13\t17/08/2026\t2\t2"
            }
            style={{ fontFamily: "monospace" }}
          />
        </Space>
      </Modal>
    </div>
  );
};

// ─── Tab 4: Silo ↔ Tag EMS ───────────────────────────────────────────────────

const SiloTagMappingTab = ({ allSilo }: { allSilo: TKVVSiloDto[] }) => {
  const [data, setData] = useState<TKVVSiloTagMappingDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [siloFilter, setSiloFilter] = useState<number | undefined>();
  const [maBMFilter, setMaBMFilter] = useState<string | undefined>();
  const [form] = Form.useForm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TKVVSiloTagMappingDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteSaving, setPasteSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tkvvSiloTagMappingApi.getList({
        ...(siloFilter ? { siloId: siloFilter } : {}),
        ...(maBMFilter && maBMFilter !== "ALL" ? { maBM: maBMFilter } : {}),
      });
      setData(Array.isArray(res) ? res : []);
    } catch {
      message.error("Lỗi khi tải danh sách Silo-Tag");
    } finally {
      setLoading(false);
    }
  }, [siloFilter, maBMFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openPaste = () => {
    setPasteText("");
    setPasteOpen(true);
  };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record: TKVVSiloTagMappingDto) => {
    setEditing(record);
    form.setFieldsValue({
      siloID: record.siloID,
      maBM: record.maBM,
      loaiDuLieu: record.loaiDuLieu,
      tagIDEMS: record.tagIDEMS,
      tagName: record.tagName,
      tagIDEMS_Ngay: record.tagIDEMS_Ngay,
      tagName_Ngay: record.tagName_Ngay,
      tagIDEMS_Dem: record.tagIDEMS_Dem,
      tagName_Dem: record.tagName_Dem,
      ghiChu: record.ghiChu,
      trangThai: record.trangThai,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editing) {
        await tkvvSiloTagMappingApi.update(editing.id, values);
        message.success("Cập nhật Silo-Tag thành công");
      } else {
        await tkvvSiloTagMappingApi.create(values);
        message.success("Thêm Silo-Tag thành công");
      }
      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      message.error(err?.message || "Không thể lưu");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await tkvvSiloTagMappingApi.delete(id);
      message.success("Đã xóa");
      fetchData();
    } catch (err: any) {
      message.error(err?.message || "Không thể xóa");
    }
  };

  // ─── Bulk paste ────────────────────────────────────────────────────────────
  // Format mỗi dòng: SiloID | LoaiDuLieu | MaBM | TagIDEMS | TagIDEMS_Ngay | TagIDEMS_Dem
  // TagIDEMS, TagIDEMS_Ngay, TagIDEMS_Dem đều tùy chọn nhưng phải có ít nhất 1
  const parsePasteRows = (text: string) => {
    const lines = text
      .split(/\r?\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) =>
        l
          .replace(/\s*\|\s*/g, "\t")
          .replace(/\s*;\s*/g, "\t")
          .split(/\t+/)
          .map((p) => p.trim()),
      );

    type ValidRow = {
      siloID: number;
      loaiDuLieu: string;
      maBM: string;
      tagIDEMS: string | null;
      tagName: string | null;
      tagIDEMS_Ngay: string | null;
      tagName_Ngay: string | null;
      tagIDEMS_Dem: string | null;
      tagName_Dem: string | null;
    };

    const validRows: ValidRow[] = [];
    const errorRows: string[] = [];

    for (const [i, parts] of lines.entries()) {
      const lineNo = i + 1;
      if (parts.length < 3) {
        errorRows.push(
          `Dòng ${lineNo}: cần ít nhất 3 cột (SiloID, LoaiDuLieu, MaBM)`,
        );
        continue;
      }

      const siloID = Number(parts[0]);
      if (!Number.isInteger(siloID) || siloID <= 0) {
        errorRows.push(`Dòng ${lineNo}: SiloID không hợp lệ (${parts[0]})`);
        continue;
      }
      if (!allSilo.find((s) => s.id === siloID)) {
        errorRows.push(`Dòng ${lineNo}: không tìm thấy Silo ID=${siloID}`);
        continue;
      }

      const loaiDuLieu = parts[1];
      if (!loaiDuLieu) {
        errorRows.push(`Dòng ${lineNo}: LoaiDuLieu trống`);
        continue;
      }

      const maBM = parts[2];
      if (!maBM) {
        errorRows.push(`Dòng ${lineNo}: MaBM trống`);
        continue;
      }

      const tagIDEMS = parts[3] || null;
      const tagIDEMS_Ngay = parts[4] || null;
      const tagIDEMS_Dem = parts[5] || null;

      if (!tagIDEMS && !tagIDEMS_Ngay && !tagIDEMS_Dem) {
        errorRows.push(`Dòng ${lineNo}: phải có ít nhất 1 TagIDEMS`);
        continue;
      }

      validRows.push({
        siloID,
        loaiDuLieu,
        maBM,
        tagIDEMS,
        tagName: null,
        tagIDEMS_Ngay,
        tagName_Ngay: null,
        tagIDEMS_Dem,
        tagName_Dem: null,
      });
    }

    return { validRows, errorRows };
  };

  const handlePasteSubmit = async () => {
    const { validRows, errorRows } = parsePasteRows(pasteText);
    if (validRows.length === 0) {
      message.error(errorRows[0] || "Không có dòng hợp lệ");
      return;
    }
    setPasteSaving(true);
    try {
      let created = 0;
      const failedRows: string[] = [];
      for (const row of validRows) {
        try {
          await tkvvSiloTagMappingApi.create(row);
          created++;
        } catch (err: any) {
          failedRows.push(
            `Silo ${row.siloID} / ${row.loaiDuLieu}: ${err?.message ?? "lỗi"}`,
          );
        }
      }
      await fetchData();
      setPasteOpen(false);
      setPasteText("");
      const parts = [
        `Đã thêm ${created}/${validRows.length} mapping`,
        errorRows.length ? `Bỏ qua ${errorRows.length} dòng lỗi` : null,
        failedRows.length ? `Lưu thất bại ${failedRows.length} dòng` : null,
      ].filter(Boolean);
      if (errorRows.length || failedRows.length) {
        Modal.warning({
          title: "Kết quả dán nhanh Silo-Tag",
          content: (
            <div style={{ maxHeight: 360, overflow: "auto" }}>
              <p>{parts.join(". ")}.</p>
              {!!errorRows.length && (
                <div style={{ marginBottom: 8 }}>
                  <b>Dòng bỏ qua:</b>
                  {errorRows.map((r) => (
                    <div key={r}>{r}</div>
                  ))}
                </div>
              )}
              {!!failedRows.length && (
                <div>
                  <b>Lưu thất bại:</b>
                  {failedRows.map((r) => (
                    <div key={r}>{r}</div>
                  ))}
                </div>
              )}
            </div>
          ),
        });
      } else {
        message.success(parts.join(". "));
      }
    } finally {
      setPasteSaving(false);
    }
  };

  return (
    <div>
      <div
        style={{
          marginBottom: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Space wrap>
          <span style={{ fontWeight: 500 }}>Silo:</span>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Tất cả Silo"
            style={{ width: 240 }}
            options={allSilo.map((s) => ({
              label: `[${s.scope ?? "?"}] ${s.tenSilo}`,
              value: s.id,
            }))}
            value={siloFilter}
            onChange={(v) => setSiloFilter(v)}
          />
          <span style={{ fontWeight: 500 }}>Mã BM:</span>
          <Select
            allowClear
            placeholder="Tất cả BM"
            style={{ width: 280 }}
            options={MA_BM_OPTIONS}
            value={maBMFilter}
            onChange={(v) => setMaBMFilter(v)}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchData}>
            Làm mới
          </Button>
        </Space>
        <Space>
          <Button onClick={openPaste} disabled={allSilo.length === 0}>
            Dán nhanh
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreate}
            disabled={allSilo.length === 0}
          >
            Thêm Silo-Tag
          </Button>
        </Space>
      </div>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={data}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        size="small"
        scroll={{ x: 1100 }}
        columns={[
          {
            title: "Scope",
            dataIndex: "scopeNVL",
            width: 60,
            align: "center",
            render: (v: string | null) =>
              v ? <Tag color="blue">{v}</Tag> : null,
          },
          {
            title: "Khu vực",
            dataIndex: "scopeNVL",
            key: "tenKhuVuc",
            width: 170,
            render: (v: string | null) => siloScopeLabel(v),
          },
          {
            title: "Tên Silo",
            dataIndex: "tenSilo",
            width: 160,
            ellipsis: true,
          },
          { title: "Mã BM", dataIndex: "maBM", width: 120, ellipsis: true },
          { title: "Loại dữ liệu", dataIndex: "loaiDuLieu", width: 120 },
          {
            title: "Tag EMS (chung)",
            dataIndex: "tagIDEMS",
            width: 120,
            align: "center",
          },
          { title: "Tag Name", dataIndex: "tagName", ellipsis: true },
          {
            title: "Tag ID Ngày",
            dataIndex: "tagIDEMS_Ngay",
            width: 110,
            align: "center",
          },
          {
            title: "Tag ID Đêm",
            dataIndex: "tagIDEMS_Dem",
            width: 110,
            align: "center",
          },
          { title: "Ghi chú", dataIndex: "ghiChu", ellipsis: true },
          {
            title: "TT",
            dataIndex: "trangThai",
            width: 80,
            align: "center",
            render: (v: boolean) => (
              <Tag color={v ? "green" : "default"}>{v ? "Dùng" : "Ngừng"}</Tag>
            ),
          },
          {
            title: "Thao tác",
            key: "action",
            width: 90,
            render: (_: unknown, record: TKVVSiloTagMappingDto) => (
              <Space>
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => openEdit(record)}
                />
                <Popconfirm
                  title="Xóa mapping này?"
                  onConfirm={() => handleDelete(record.id)}
                >
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      {/* Modal thêm/sửa đơn lẻ */}
      <Modal
        title={editing ? "Sửa Silo-Tag EMS" : "Thêm Silo-Tag EMS"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={saving}
        destroyOnClose
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="siloID"
            label="Silo"
            rules={[{ required: true, message: "Bắt buộc" }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn Silo"
              options={allSilo.map((s) => ({
                label: `[${s.scope ?? "?"}] ${s.tenSilo}`,
                value: s.id,
              }))}
            />
          </Form.Item>
          <Space style={{ width: "100%" }}>
            <Form.Item
              name="maBM"
              label="Mã BM"
              rules={[{ required: true, message: "Bắt buộc" }]}
              style={{ flex: 1 }}
            >
              <Select
                options={MA_BM_OPTIONS.filter((o) => o.value !== "ALL")}
                placeholder="Chọn BM"
              />
            </Form.Item>
            <Form.Item
              name="loaiDuLieu"
              label="Loại dữ liệu"
              rules={[{ required: true, message: "Bắt buộc" }]}
              style={{ width: 160 }}
            >
              <Input placeholder="VD: KhoiLuongAm" />
            </Form.Item>
          </Space>
          <Space style={{ width: "100%" }}>
            <Form.Item
              name="tagIDEMS"
              label="Tag ID EMS (chung)"
              style={{ width: 200 }}
            >
              <Input placeholder="Dùng khi chỉ có 1 tag" />
            </Form.Item>
            <Form.Item name="tagName" label="Tag Name" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </Space>
          <Space style={{ width: "100%" }}>
            <Form.Item
              name="tagIDEMS_Ngay"
              label="Tag ID EMS (Ca ngày)"
              style={{ width: 200 }}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="tagName_Ngay"
              label="Tag Name (Ca ngày)"
              style={{ flex: 1 }}
            >
              <Input />
            </Form.Item>
          </Space>
          <Space style={{ width: "100%" }}>
            <Form.Item
              name="tagIDEMS_Dem"
              label="Tag ID EMS (Ca đêm)"
              style={{ width: 200 }}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="tagName_Dem"
              label="Tag Name (Ca đêm)"
              style={{ flex: 1 }}
            >
              <Input />
            </Form.Item>
          </Space>
          {editing && (
            <Form.Item
              name="trangThai"
              label="Trạng thái"
              valuePropName="checked"
            >
              <Switch checkedChildren="Đang dùng" unCheckedChildren="Ngừng" />
            </Form.Item>
          )}
          <Form.Item name="ghiChu" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal dán nhanh nhiều Silo-Tag */}
      <Modal
        title="Dán nhanh Silo ↔ Tag EMS"
        open={pasteOpen}
        onCancel={() => setPasteOpen(false)}
        onOk={handlePasteSubmit}
        okText="Kiểm tra & thêm"
        confirmLoading={pasteSaving}
        destroyOnClose
        width={760}
      >
        <Space direction="vertical" style={{ width: "100%" }} size="small">
          <Typography.Text>
            Mỗi dòng một mapping. Các cột ngăn cách bằng <b>tab</b>, dấu{" "}
            <b>|</b> hoặc dấu <b>;</b>:
          </Typography.Text>
          <Typography.Text code style={{ fontSize: 12 }}>
            SiloID | LoaiDuLieu | MaBM | TagIDEMS | TagIDEMS_Ngay | TagIDEMS_Dem
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Ba cột tag cuối là tùy chọn nhưng phải có ít nhất 1. TagName sửa
            trực tiếp trong bảng sau khi thêm nếu cần.
          </Typography.Text>
          <Input.TextArea
            rows={14}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={
              "Ví dụ:\n12\tKhoiLuongAm\tTKVV_BB_SanLuong\tTAG001\t\t\n12\tKhoiLuongAm\tTKVV_BB_SanLuong\t\tTAG_NGAY_01\tTAG_DEM_01\n13\tKhoiLuong\tTKVV_BC_SanLuongChiPhi\tTAG002\t\t"
            }
            style={{ fontFamily: "monospace" }}
          />
        </Space>
      </Modal>
    </div>
  );
};

// ─── Trang chính ─────────────────────────────────────────────────────────────

const QuanLyNVLTKVV = () => {
  const [selectedMaBM, setSelectedMaBM] = useState<string>(
    BM_CONFIG.TKVV.TKVV_BB_SanLuong,
  );
  const [scopeFilter, setScopeFilter] = useState<string | undefined>();
  const [nvlData, setNvlData] = useState<TKVVNguyenVatLieuDto[]>([]);
  const [nvlLoading, setNvlLoading] = useState(false);
  const [allNvl, setAllNvl] = useState<TKVVNguyenVatLieuDto[]>([]);
  const [allSilo, setAllSilo] = useState<TKVVSiloDto[]>([]);

  const loadNvl = useCallback(async () => {
    setNvlLoading(true);
    try {
      const res = await tkvvNvlApi.getListnvlbyBM({
        ...(selectedMaBM !== "ALL" ? { maBM: selectedMaBM } : {}),
        ...(scopeFilter ? { scope: scopeFilter } : {}),
      });
      setNvlData(Array.isArray(res) ? res : []);
    } catch {
      message.error("Lỗi khi tải danh mục NVL");
    } finally {
      setNvlLoading(false);
    }
  }, [selectedMaBM, scopeFilter]);

  const loadAllNvl = useCallback(async () => {
    try {
      const res = await tkvvNvlApi.getListnvlbyBM();
      setAllNvl(Array.isArray(res) ? res : []);
    } catch {
      // silent
    }
  }, []);

  const loadAllSilo = useCallback(async () => {
    try {
      const res = await tkvvSiloApi.getList();
      setAllSilo(Array.isArray(res) ? res : []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadNvl();
  }, [loadNvl]);

  useEffect(() => {
    loadAllNvl();
    loadAllSilo();
  }, [loadAllNvl, loadAllSilo]);

  return (
    <Card style={{ margin: 24 }}>
      <Title level={4} style={{ marginBottom: 16 }}>
        Quản lý NVL &amp; Silo &amp; Mapping (NM.TKVV)
      </Title>

      <Space style={{ marginBottom: 16 }} wrap>
        <span style={{ fontWeight: 500 }}>Mã BM:</span>
        <Select
          style={{ width: 320 }}
          options={MA_BM_OPTIONS}
          value={selectedMaBM}
          onChange={(v) => {
            setSelectedMaBM(v);
            setScopeFilter(undefined);
          }}
        />
        <span style={{ fontWeight: 500 }}>Scope:</span>
        <Select
          allowClear
          placeholder="Tất cả scope"
          style={{ width: 200 }}
          options={SILO_SCOPE_OPTIONS}
          value={scopeFilter}
          onChange={(v) => setScopeFilter(v)}
        />
      </Space>

      <Tabs
        defaultActiveKey="nvl"
        items={[
          {
            key: "nvl",
            label: "Danh mục NVL",
            children: (
              <NvlTab
                data={nvlData}
                loading={nvlLoading}
                selectedMaBM={selectedMaBM}
                onReload={loadNvl}
              />
            ),
          },
          {
            key: "silo",
            label: "Quản lý Silo",
            children: <SiloTab />,
          },
          {
            key: "nvl-silo",
            label: "NVL ↔ Silo theo Ca",
            children: (
              <NvlSiloMappingTab
                allNvl={allNvl}
                allSilo={allSilo}
                selectedMaBM={selectedMaBM}
                selectedScope={scopeFilter}
              />
            ),
          },
          {
            key: "silo-tag",
            label: "Silo ↔ Tag EMS",
            children: <SiloTagMappingTab allSilo={allSilo} />,
          },
        ]}
      />
    </Card>
  );
};

export default QuanLyNVLTKVV;
