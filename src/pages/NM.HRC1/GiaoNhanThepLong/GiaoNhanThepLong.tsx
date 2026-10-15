import { useCallback, useMemo, useState } from "react";
import { Button, Card, Checkbox, DatePicker, Form, message, Modal, Select, Space, Table, Tag, Tooltip } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { useNavigate } from "react-router-dom";
import { PhieuApi } from "../../../services/PhieuApi";
import PhieuFilterCard, { type FilterFieldConfig, type PhieuFilterValues } from "../../../components/PhieuFilterCard";
import { usePhieuSearchListHRC } from "../../../hooks/usePhieuSearchListHRC";
import { getThongTinUser } from "../../../utils/constants/GetThongTinLocalStore";
import { bmQuyenConfig } from "../../../utils/configs/bmQuyenConfig";
import { BM_CONFIG } from "../../../utils/configs/BieuMauConst";
import { PHIEU_STATUS_CONFIG } from "../../../utils/constants/TrangThaiPhieuDisplay";
import type { SearchPhieuByUserRequest, SearchPhieuResponseModel } from "../../../models/Phieu";
import { HRC1Api } from "../../../services/HRC1_BBGNApi";
import { NhaMayEnum } from "../../../services/MayDucServiceApi";
import { useMayDucOptions, type MayDucOption } from "../../../hooks/useMayDucOptions";

type TableRecord = SearchPhieuResponseModel & { kip?: string | null };

// ── Modal tạo phiếu ──────────────────────────────────────────────────────────

const CA_OPTIONS_MODAL = [
  { label: "Ca ngày (1)", value: 1 },
  { label: "Ca đêm (2)",  value: 2 },
];

const CONG_DOAN_OPTIONS = [
  { label: "Lò thổi",    value: BM_CONFIG.HRC1.HRC1_LoThoi    },
  { label: "Tinh luyện", value: BM_CONFIG.HRC1.HRC1_TinhLuyen },
  { label: "Máy đúc",    value: BM_CONFIG.HRC1.HRC1_BBGN_ThepLong },
];

const MABM_PREFIX: Record<string, string> = {
  [BM_CONFIG.HRC1.HRC1_LoThoi]:         "LT",
  [BM_CONFIG.HRC1.HRC1_TinhLuyen]:      "TL",
  [BM_CONFIG.HRC1.HRC1_BBGN_ThepLong]:  "BBGN_TL_HRC1",
};

// mayDucOptions: máy đúc HRC1 đang dùng (useMayDucOptions(...).options) — scope phiếu Đúc = MayDuc.Id
const getScopeOptions = (maBm: string, mayDucOptions: MayDucOption[]) => {
  if (maBm === BM_CONFIG.HRC1.HRC1_LoThoi)
    return [1,2,3,4,5].map((i) => ({ label: `Lò thổi ${i}`, value: i }));
  if (maBm === BM_CONFIG.HRC1.HRC1_TinhLuyen)
    return [1,2,3,4,5].map((i) => ({ label: `Tinh luyện ${i}`, value: i }));
  if (maBm === BM_CONFIG.HRC1.HRC1_BBGN_ThepLong)
    return mayDucOptions;
  const bmDef = bmQuyenConfig.danhSachBieuMau.find((b) => b.maBm === maBm);
  return (bmDef?.scope ?? []).map((s) => ({ label: s.tenKhuVuc, value: Number(s.maKhuVuc) }));
};

const SCOPE_OPTIONAL_MABM = new Set([
  BM_CONFIG.HRC1.HRC1_LoThoi,
  BM_CONFIG.HRC1.HRC1_TinhLuyen,
]);

const TaoPhieuModal = ({
  open, onClose, onCreated,
  congDoanOptions = CONG_DOAN_OPTIONS,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (idPhieu: string) => void;
  congDoanOptions?: typeof CONG_DOAN_OPTIONS;
}) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [maBm, setMaBm] = useState<string>(congDoanOptions[0]?.value ?? BM_CONFIG.HRC1.HRC1_LoThoi);
  const { options: mayDucOptions } = useMayDucOptions(NhaMayEnum.HRC1);

  const scopeOptions = useMemo(() => getScopeOptions(maBm, mayDucOptions), [maBm, mayDucOptions]);
  const scopeRequired = !SCOPE_OPTIONAL_MABM.has(maBm);

  const handleOpen = () => {
    const defaultMaBm = congDoanOptions[0]?.value ?? BM_CONFIG.HRC1.HRC1_LoThoi;
    form.setFieldsValue({ maBm: defaultMaBm, scope: undefined, ngaySX: dayjs(), ca: 1 });
    setMaBm(defaultMaBm);
  };

  const handleSubmit = async () => {
    let values: { maBm: string; scope?: number | null; ngaySX: Dayjs; ca: number };
    try { values = await form.validateFields(); }
    catch { return; }

    setSubmitting(true);
    try {
      const scopeVal = scopeRequired ? values.scope : undefined;
      const scopeLabel = scopeVal != null
        ? getScopeOptions(values.maBm, mayDucOptions).find((o) => o.value === scopeVal)?.label
        : undefined;
      const res: any = await PhieuApi.postData({
        maBm:       values.maBm,
        prefix:     MABM_PREFIX[values.maBm] ?? "HRC1",
        scope:      scopeVal ?? null,
        NgaySX:     values.ngaySX.format("YYYY-MM-DD"),
        ca:         values.ca,
        tenScope:   scopeLabel ?? null,
        nguoiTaoId: getThongTinUser().iD_TaiKhoan ?? null,
      });
      const idPhieu: string = res?.idphieu ?? res?.Idphieu ?? res?.id;
      if (!idPhieu) throw new Error("Không lấy được idPhieu từ phản hồi.");
      message.success("Đã tạo phiếu");
      onClose();
      onCreated(idPhieu);
    } catch (e: any) {
      message.error(e?.message ?? "Tạo phiếu thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Tạo phiếu thủ công"
      open={open}
      onOk={handleSubmit}
      onCancel={onClose}
      okText="Tạo phiếu"
      cancelText="Hủy"
      confirmLoading={submitting}
      afterOpenChange={(o) => { if (o) handleOpen(); }}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Form.Item name="ngaySX" label="Ngày SX" rules={[{ required: true }]}>
          <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="ca" label="Ca" rules={[{ required: true }]}>
          <Select options={CA_OPTIONS_MODAL} />
        </Form.Item>
        <Form.Item name="maBm" label="Công đoạn" rules={[{ required: true }]}>
          <Select
            options={congDoanOptions}
            onChange={(v) => { setMaBm(v); form.setFieldValue("scope", undefined); }}
          />
        </Form.Item>
        {scopeRequired && (
          <Form.Item name="scope" label="Thiết bị / Khu vực" rules={[{ required: true, message: "Chọn thiết bị" }]}>
            <Select options={scopeOptions} placeholder="Chọn thiết bị..." />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
};

// ── List ─────────────────────────────────────────────────────────────────────

const MA_BM_LIST = [
  BM_CONFIG.HRC1.HRC1_LoThoi,
  BM_CONFIG.HRC1.HRC1_TinhLuyen,
  BM_CONFIG.HRC1.HRC1_BBGN_ThepLong,
];

const TRANG_THAI_FILTER_OPTIONS = Object.entries(PHIEU_STATUS_CONFIG).map(
  ([key, cfg]) => ({ label: cfg.text, value: Number(key) })
);


const getScopeName = (
  maBm: string,
  scope: number | null | undefined,
  tenScope: string | null | undefined,
  getTenMayDuc: (id: number) => string | undefined,
): string => {
  if (tenScope) return tenScope;
  if (!scope) {
    if (maBm === BM_CONFIG.HRC1.HRC1_LoThoi)    return "Tất cả lò thổi";
    if (maBm === BM_CONFIG.HRC1.HRC1_TinhLuyen) return "Tất cả tinh luyện";
    return "-";
  }
  if (maBm === BM_CONFIG.HRC1.HRC1_LoThoi)         return `Lò thổi ${scope}`;
  if (maBm === BM_CONFIG.HRC1.HRC1_TinhLuyen)      return `Tinh luyện ${scope}`;
  if (maBm === BM_CONFIG.HRC1.HRC1_BBGN_ThepLong)
    return getTenMayDuc(scope) ?? `Máy đúc ${scope}`;
  const bmDef = bmQuyenConfig.danhSachBieuMau.find((b) => b.maBm === maBm);
  return bmDef?.scope?.find((s) => s.maKhuVuc === String(scope))?.tenKhuVuc ?? `${maBm} - ${scope}`;
};

const getCongDoanBadge = (maBm: string) => {
  if (maBm === BM_CONFIG.HRC1.HRC1_LoThoi)         return <Tag color="orange">Lò thổi</Tag>;
  if (maBm === BM_CONFIG.HRC1.HRC1_TinhLuyen)      return <Tag color="purple">Tinh luyện</Tag>;
  if (maBm === BM_CONFIG.HRC1.HRC1_BBGN_ThepLong)  return <Tag color="blue">Máy đúc</Tag>;
  return <Tag>{maBm}</Tag>;
};

const GiaoNhanThepLong = ({ type, maBmFilter }: { type?: string; maBmFilter?: string[] }) => {
  const navigate = useNavigate();
  const currentUserId = useMemo(() => getThongTinUser().iD_TaiKhoan ?? null, []);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedBms, setSelectedBms] = useState<string[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [exportLoading, setExportLoading] = useState(false);
  const { getTen: getTenMayDuc } = useMayDucOptions(NhaMayEnum.HRC1);

  const routeCreate = "/taophieugiaonhantheplong_hrc1";
  const routeDetail = "/chitietgiaonhantheplong_hrc1";

  const activeMaBmList = useMemo(
    () => maBmFilter && maBmFilter.length > 0 ? maBmFilter : MA_BM_LIST,
    [maBmFilter]
  );

  const activeCongDoanOptions = useMemo(
    () => CONG_DOAN_OPTIONS.filter((o) => activeMaBmList.includes(o.value)),
    [activeMaBmList]
  );

  const fixedFilters = useMemo(() => ({
    userId:   currentUserId,
    loaiVung: type === "xemphieu" ? 3 : type === "viecdentoi" ? 2 : 1,
  }), [currentUserId, type]);

  const transformFilters = useCallback((filters: PhieuFilterValues): Partial<SearchPhieuByUserRequest> => {
    const maBmArr   = Array.isArray(filters.maBm)  ? (filters.maBm  as string[]) : undefined;
    const scopeFilters = Array.isArray(filters.scope) ? (filters.scope as string[]).filter(Boolean) : undefined;
    const result: Partial<SearchPhieuByUserRequest> = {
      tuNgay:     (filters.ngaySXFrom || null) as string | null,
      denNgay:    (filters.ngaySXTo   || null) as string | null,
      ca:         filters.ca        != null && filters.ca        !== "" ? Number(filters.ca)        : null,
      searchText: (filters.soPhieu  || null) as string | null,
      tinhTrang:  filters.tinhTrang != null && filters.tinhTrang !== "" ? Number(filters.tinhTrang) : null,
    };
    if (maBmArr      && maBmArr.length      > 0) result.maBmList     = maBmArr;
    if (scopeFilters && scopeFilters.length > 0) result.scopeFilters = scopeFilters;
    return result;
  }, []);

  const { data, loading, pagination, handleFilter, handleClearFilter, onPageChange,
          getAllowedBmOptions, getAllowedScopeOptions } =
    usePhieuSearchListHRC({ maBmList: activeMaBmList, fixedFilters, transformFilters, persistKey: true });

  const allowedCongDoanOptions = useMemo(
    () => getAllowedBmOptions(activeCongDoanOptions),
    [getAllowedBmOptions, activeCongDoanOptions]
  );

  const handleFieldChange = useCallback((key: string, value: unknown) => {
    if (key === "maBm") setSelectedBms(Array.isArray(value) ? (value as string[]) : []);
  }, []);

  const allowedScopeOptions = useMemo(() => {
    const activeBms = selectedBms.length > 0
      ? allowedCongDoanOptions.filter((bm) => selectedBms.includes(bm.value))
      : allowedCongDoanOptions;
    // Lò thổi và Tinh luyện: scope = null ở phiếu, không dùng scope filter
    return activeBms
      .filter((bm) => !SCOPE_OPTIONAL_MABM.has(bm.value))
      .flatMap((bm) =>
        getAllowedScopeOptions(bm.value).map((opt) => ({
          label: opt.label,
          value: `${bm.value}::${opt.value}`,
        }))
      );
  }, [selectedBms, allowedCongDoanOptions, getAllowedScopeOptions]);

  const filterFields = useMemo((): FilterFieldConfig[] => [
    { key: "soPhieu", label: "Số phiếu", type: "text", placeholder: "Số phiếu..." },
    { key: "ngaySX",  label: "Ngày sản xuất", type: "dateRange", placeholder: "Khoảng ngày" },
    {
      key: "ca", label: "Ca", type: "select",
      options: [
        { label: "Ca ngày (1)", value: 1 },
        { label: "Ca đêm (2)",  value: 2 },
      ],
    },
    {
      key: "maBm", label: "Loại phiếu", type: "multiselect",
      options: allowedCongDoanOptions,
      placeholder: "Tất cả loại phiếu",
    },
    {
      key: "scope", label: "Khu vực", type: "multiselect",
      options: allowedScopeOptions,
      placeholder: "Tất cả khu vực",
    },
    {
      key: "tinhTrang", label: "Trạng thái", type: "select",
      options: TRANG_THAI_FILTER_OPTIONS,
      placeholder: "Tất cả trạng thái",
    },
  ], [allowedCongDoanOptions, allowedScopeOptions]);

  const selectedMaBm = useMemo(() => {
    if (selectedKeys.size === 0) return null;
    const dataMap = new Map((data as TableRecord[]).map((r) => [r.idphieu, r.maBm as string]));
    const maBms = new Set([...selectedKeys].map((id) => dataMap.get(id)).filter(Boolean) as string[]);
    return maBms.size === 1 ? [...maBms][0] : null;
  }, [selectedKeys, data]);

  const firstSelectedMaBm = useMemo(() => {
    if (selectedKeys.size === 0) return null;
    return (data as TableRecord[]).find((r) => selectedKeys.has(r.idphieu))?.maBm ?? null;
  }, [selectedKeys, data]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handlePageChange = useCallback((page: number, pageSize: number) => {
    setSelectedKeys(new Set());
    onPageChange(page, pageSize);
  }, [onPageChange]);

  const handleExportBulk = useCallback(async () => {
    if (selectedKeys.size === 0 || !selectedMaBm) return;
    try {
      setExportLoading(true);
      await HRC1Api.exportBulkExcel([...selectedKeys]);
    } catch (e: any) {
      message.error(e?.message ?? "Xuất Excel thất bại.");
    } finally {
      setExportLoading(false);
    }
  }, [selectedKeys, selectedMaBm]);

  const handleNavigate = (record: TableRecord, forceDetail = false) => {
    if (forceDetail || type === "xemphieu") {
      navigate(routeDetail, { state: { idphieu: record.idphieu } });
    } else if (type === "viecdentoi") {
      // Phiếu máy đúc: mở trang tạo/chỉnh sửa để tick xác nhận mẻ
      const isEditable = record.maBm === BM_CONFIG.HRC1.HRC1_BBGN_ThepLong;
      navigate(isEditable ? routeCreate : routeDetail, { state: { idphieu: record.idphieu } });
    } else {
      navigate(routeCreate, { state: { idphieu: record.idphieu } });
    }
  };

  const isAllSelected = (data as TableRecord[]).length > 0
    && (data as TableRecord[]).every((r) => selectedKeys.has(r.idphieu));
  const isIndeterminate = !isAllSelected && (data as TableRecord[]).some((r) => selectedKeys.has(r.idphieu));

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) setSelectedKeys(new Set((data as TableRecord[]).map((r) => r.idphieu)));
    else setSelectedKeys(new Set());
  }, [data]);

  const columns = [
    {
      title: (
        <Checkbox
          checked={isAllSelected}
          indeterminate={isIndeterminate}
          onChange={(e) => handleSelectAll(e.target.checked)}
        />
      ),
      key: "select",
      width: 50,
      fixed: "left" as const,
      render: (_: unknown, record: TableRecord) => {
        const disabled = !!firstSelectedMaBm && !selectedKeys.has(record.idphieu) && record.maBm !== firstSelectedMaBm;
        return (
          <span onClick={(e) => e.stopPropagation()}>
            <Tooltip title={disabled ? "Chỉ xuất được phiếu cùng loại biểu mẫu" : undefined}>
              <Checkbox
                checked={selectedKeys.has(record.idphieu)}
                disabled={disabled}
                onChange={() => toggleSelect(record.idphieu)}
              />
            </Tooltip>
          </span>
        );
      },
    },
    {
      title: <b>Số Phiếu</b>,
      dataIndex: "soPhieu",
      key: "soPhieu",
      width: 200,
      render: (text: string, record: TableRecord) => (
        <b
          style={{ color: "#1976d2", cursor: "pointer" }}
          onClick={() => handleNavigate(record)}
        >
          {text}
        </b>
      ),
    },
    {
      title: "Công đoạn",
      key: "congDoan",
      width: 120,
      render: (_: unknown, r: TableRecord) => getCongDoanBadge(r.maBm),
    },
    {
      title: "Thiết bị / Khu vực",
      key: "thietBi",
      width: 170,
      render: (_: unknown, r: TableRecord) =>
        <b>{getScopeName(r.maBm, r.scope, r.tenScope, getTenMayDuc)}</b>,
    },
    {
      title: "Ngày sản xuất",
      dataIndex: "ngaySX",
      key: "ngaySX",
      width: 150,
      render: (v: string) => v ? dayjs(v).format("DD/MM/YYYY") : "-",
    },
    {
      title: "Ca",
      dataIndex: "ca",
      key: "ca",
      width: 110,
      render: (v: number) => v === 1 ? "Ca Ngày" : "Ca Đêm",
    },
    {
      title: "Kíp",
      dataIndex: "kip",
      key: "kip",
      width: 80,
      render: (v: string) => v ?? "-",
    },
    {
      title: "Số mẻ",
      key: "soLuongMe",
      width: 90,
      align: "center" as const,
      render: (_: unknown, r: TableRecord) => {
        if (r.maBm !== BM_CONFIG.HRC1.HRC1_BBGN_ThepLong) return null;
        return r.soLuongMe != null ? <span>{r.soLuongMe} mẻ</span> : "-";
      },
    },
    {
      title: "Trạng thái",
      dataIndex: "tinhTrang",
      key: "tinhTrang",
      width: 150,
      render: (status: number) => (
        <Tag color={PHIEU_STATUS_CONFIG[status]?.color ?? "default"}>
          {PHIEU_STATUS_CONFIG[status]?.text ?? status}
        </Tag>
      ),
    },
    {
      title: "Thao tác",
      key: "action",
      width: 90,
      render: (_: unknown, record: TableRecord) => (
        <Space>
          <Button
            type="text"
            icon={<EyeOutlined twoToneColor="#1890ff" />}
            onClick={() => handleNavigate(record, true)}
          />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PhieuFilterCard
        title="HRC1 — Biên bản giao nhận thép lỏng"
        onFilter={handleFilter}
        onClearFilter={handleClearFilter}
        filterFields={filterFields}
        onFilterFieldChange={handleFieldChange}
        storageKey={true}
        showCreateButton={type !== "xemphieu"}
        onCreateClick={() => setModalOpen(true)}
        createButtonText="Tạo phiếu"
      />
      <TaoPhieuModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(idPhieu) => navigate(routeCreate, { state: { idphieu: idPhieu } })}
        congDoanOptions={activeCongDoanOptions}
      />
      <Card>
        {selectedKeys.size > 0 && (
          <div style={{ marginBottom: 12, display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ color: "#666" }}>Đã chọn {selectedKeys.size} phiếu</span>
            <Tooltip title={!selectedMaBm ? "Chỉ xuất được nhiều phiếu cùng loại biểu mẫu" : undefined}>
              <Button
                disabled={!selectedMaBm}
                loading={exportLoading}
                onClick={handleExportBulk}
              >
                Export Excel ({selectedKeys.size})
              </Button>
            </Tooltip>
            <Button size="small" onClick={() => setSelectedKeys(new Set())}>Bỏ chọn tất cả</Button>
          </div>
        )}
        <Table<TableRecord>
          columns={columns}
          dataSource={data as TableRecord[]}
          rowKey={(r) => String(r.idphieu)}
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} phiếu`,
            onChange: handlePageChange,
          }}
          onRow={(record) => ({
            onClick: () => handleNavigate(record),
            style: { cursor: "pointer" },
          })}
          scroll={{ x: 1250 }}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={10} align="right">
                <span style={{ fontWeight: 500 }}>
                  Tổng: {pagination.total} Phiếu
                </span>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      </Card>
    </div>
  );
};

export default GiaoNhanThepLong;
