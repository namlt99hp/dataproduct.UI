import HRC2_BBSL_PhoiTam from "../../../utils/BM_config/HRC2_BBSL_PhoiTam.json";
import { Button, Card, Space, Table, Tabs, Tag } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useLocation, useNavigate } from "react-router-dom";
import PhieuFilterCard, { type FilterFieldConfig } from "../../../components/PhieuFilterCard";
import { useMemo, useState } from "react";
import type { SearchPhieuResponseModel } from "../../../models/Phieu";
import { usePhieuSearchListHRC } from "../../../hooks/usePhieuSearchListHRC";
import BkHrc2SlabTable from "./BkHrc2SlabTable";
import { PHOI_TAM_STATUS_CONFIG, PHIEU_STATUS_CONFIG } from "../../../utils/constants/TrangThaiPhieuDisplay";
import { renderXacNhanTag } from "../../../utils/helpers/renderXacNhanTag";

const config = HRC2_BBSL_PhoiTam;

// Keyed by React Router location.key — tự động clear khi user navigate forward (key mới), tự
// động restore khi user bấm Back (key cũ). Nhớ tab đang xem (Tổng hợp phôi tấm / Danh sách
// phiếu BBSL) để khi quay lại từ trang chi tiết phiếu không bị reset về tab mặc định.
const _tabCache = new Map<string, string>();

/** Trạng thái tổng hợp BBGN Phôi tấm (BE trả 11 | 12 | 5, xem Hrc2BbgnPhoiTamEnricher) */
const BBGN_PHOI_TAM_STATUS: Record<string, { text: string; color: string }> = {
  ...PHOI_TAM_STATUS_CONFIG,
  "5": PHIEU_STATUS_CONFIG[5],
};

type TableRecord = SearchPhieuResponseModel & {
  pheDuyet?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

/** Danh sách phiếu BBSL — dùng chung cho cả 3 zone */
const PhieuListView = ({ type }: { type?: "taoMoi" | "viecdentoi" | "xemphieu" }) => {
  const navigate = useNavigate();
  const userStr = localStorage.getItem("user");
  const userObj = userStr ? JSON.parse(userStr) : {};
  const userInfoStr = localStorage.getItem("userinfo");
  const userInfoObj = userInfoStr ? JSON.parse(userInfoStr) : {};
  const isAdmin = userObj?.role?.includes("admin") || false;

  const currentUserId: number | null =
    userInfoObj?.iD_TaiKhoan ??
    userInfoObj?.ID_TaiKhoan ??
    userInfoObj?.idTaiKhoan ??
    userInfoObj?.IdTaiKhoan ??
    userObj?.iD_TaiKhoan ??
    userObj?.ID_TaiKhoan ??
    null;

  const fixedFilters = useMemo(
    () => ({
      userId: currentUserId,
      loaiVung: type === "xemphieu" ? 3 : type === "viecdentoi" ? 2 : 1,
    }),
    [currentUserId, type]
  );

  const {
    data,
    loading,
    pagination,
    handleFilter,
    handleClearFilter,
    onPageChange,
  } = usePhieuSearchListHRC({ maBm: config.code as string, fixedFilters, persistKey: true });

  const detailPath = type === "xemphieu" ? "/xemphieu/chitietbbgnphoitam" : "/chitietbbgnphoitam";

  const columns = [
    {
      title: <b>Số Phiếu</b>,
      dataIndex: "soPhieu",
      key: "soPhieu",
      render: (text: string, record: TableRecord) => (
        <b
          style={{ color: "#1976d2", cursor: "pointer" }}
          onClick={() =>
            navigate(detailPath, {
              state: { idphieu: record.idphieu, pheduyet: record?.pheDuyet?.[0] ?? null },
            })
          }
        >
          {text}
        </b>
      ),
      width: 250,
    },
    {
      title: "Ngày lên BBSL",
      dataIndex: "ngaySX",
      key: "ngaySX",
      width: 140,
      render: (value: string) => (value ? dayjs(value).format("DD/MM/YYYY") : "-"),
    },
    {
      title: "Ca",
      dataIndex: "ca",
      key: "ca",
      width: 110,
      render: (value: number) => (value === 1 ? "Ca Ngày" : "Ca Đêm"),
    },
    {
      title: "Kíp",
      dataIndex: "kip",
      key: "kip",
      width: 90,
      ellipsis: true,
    },
    {
      title: "Số lượng ID",
      dataIndex: "soLuongSlab",
      key: "soLuongSlab",
      width: 110,
      align: "right" as const,
      render: (value: number | null | undefined) => (value ?? "-"),
    },
    {
      title: "Trạng thái chi tiết",
      key: "tinhTrangChiTiet",
      width: 340,
      render: (_: unknown, record: TableRecord) => (
        <Space size={4} wrap>
          {renderXacNhanTag("Đúc", record.soLuongXNDuc as number | null | undefined, record.soLuongSlab as number | null | undefined)}
          {renderXacNhanTag("Kho", record.soLuongXNKho as number | null | undefined, record.soLuongSlab as number | null | undefined)}
          {renderXacNhanTag("PKH", record.soLuongXNPKH as number | null | undefined, record.soLuongSlab as number | null | undefined)}
        </Space>
      ),
    },
    {
      title: "Tình trạng phiếu",
      dataIndex: "tinhTrang",
      key: "tinhTrang",
      width: 150,
      render: (status: number | string | null | undefined) => {
        const key = String(status ?? "");
        const cfg = BBGN_PHOI_TAM_STATUS[key];
        return (
          <Tag color={cfg?.color ?? "default"}>
            {cfg?.text ?? (status !== null && status !== undefined && status !== "" ? String(status) : "-")}
          </Tag>
        );
      },
    },
    {
      title: "Thao tác",
      key: "action",
      width: 80,
      render: (_: unknown, record: TableRecord) => (
        <Space>
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() =>
              navigate(detailPath, { state: { idphieu: record.idphieu } })
            }
          />
        </Space>
      ),
    },
  ];

  const filterFieldsConfig = useMemo(
    (): FilterFieldConfig[] => [
      { key: "soPhieu", label: "Số phiếu", type: "text", placeholder: "Số phiếu..." },
      { key: "ngaySX", label: "Ngày sản xuất", type: "dateRange", placeholder: "Khoảng ngày" },
      {
        key: "ca",
        label: "Ca",
        type: "select",
        options: [
          { label: "Ca ngày (1)", value: 1 },
          { label: "Ca đêm (2)", value: 2 },
        ],
      },
      {
        key: "tinhTrang",
        label: "Tình trạng phiếu",
        type: "select",
        options: Object.entries(BBGN_PHOI_TAM_STATUS).map(([key, cfg]) => ({
          label: cfg.text,
          value: key,
        })),
      }
    ],
    []
  );

  return (
    <div>
      <PhieuFilterCard
        title={config.title}
        onFilter={handleFilter}
        onClearFilter={handleClearFilter}
        filterFields={filterFieldsConfig}
        mergeFilters={{ usercode: userObj?.maNV || "" }}
        storageKey={true}
        showCreateButton={true}
        onCreateClick={() => navigate("/form-bbgnphoitam")}
        createButtonText="Tạo phiếu mới"
      />
      <Card>
        <Table<TableRecord>
          columns={columns}
          dataSource={data as TableRecord[]}
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} phiếu`,
            onChange: onPageChange,
          }}
          scroll={{ x: 1330 }}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={8} align="right">
                <span style={{ fontWeight: 500 }}>Tổng: {pagination.total} Phiếu</span>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      </Card>
    </div>
  );
};

/** Entry point — phân nhánh theo type */
const BienBanGiaoNhanPhoiTam = ({ type }: { type?: string }) => {
  const { key: locationKey } = useLocation();
  const [activeKey, setActiveKey] = useState<string>(() => _tabCache.get(locationKey) ?? "slab");

  // viecdentoi: chỉ hiện danh sách phiếu
  if (type === "viecdentoi") {
    return <PhieuListView type={type} />;
  }

  // xemphieu (vùng xem phiếu): hiện đủ 2 tab như trang chính nhưng chỉ để truy xuất dữ liệu —
  // BkHrc2SlabTable ở chế độ readOnly (ẩn Sync/Chuyển BBSL/Thu hồi + cột tick chọn dòng).
  const readOnly = type === "xemphieu";

  // /bbgnphoitam (mặc định) hoặc /xemphieu/bbgnphoitam: 2 tab — activeKey được nhớ theo
  // location.key (xem _tabCache) để bấm Back từ trang chi tiết phiếu không bị reset về
  // "Tổng hợp phôi tấm" nếu trước đó đang xem "Danh sách phiếu BBSL".
  return (
    <Tabs
      activeKey={activeKey}
      onChange={(key) => {
        setActiveKey(key);
        _tabCache.set(locationKey, key);
      }}
      type="card"
      style={{ padding: "0 8px" }}
      items={[
        {
          key: "slab",
          label: "Tổng hợp phôi tấm",
          children: <BkHrc2SlabTable readOnly={readOnly} />,
        },
        {
          key: "phieu",
          label: "Danh sách phiếu BBSL",
          children: <PhieuListView type={readOnly ? "xemphieu" : "taoMoi"} />,
        },
      ]}
    />
  );
};

export default BienBanGiaoNhanPhoiTam;