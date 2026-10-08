import LC_BCSX_XNL from "../../../utils/BM_config/LC_BCSX_XNL.json";
import { Button, Card, Space, Table, Tag } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import PhieuFilterCard, { type FilterFieldConfig } from "../../../components/PhieuFilterCard";
import { useMemo } from "react";
import type { SearchPhieuResponseModel } from "../../../models/Phieu";
import { PHIEU_STATUS_CONFIG } from "../../../utils/constants/TrangThaiPhieuDisplay";
import { usePhieuSearchListHRC } from "../../../hooks/usePhieuSearchListHRC";
import { THANH_PHAM_SCOPE_OPTIONS } from "../../../components/LC_BCSX_XNL/lcTabsConfig";

/**
 * Danh sách phiếu "Báo cáo sản xuất Xưởng Nguyên liệu" — DÙNG CHUNG cho TP1 và TP2
 * (LC_02_Prompt_Vibecoding_V5.md mục 2.1: cấm tạo UI riêng theo TP, phân biệt bằng field
 * cấu hình). "Thành phẩm" tái dùng field "scope" có sẵn của hệ Phiếu (giống Lò thổi ở
 * HRC2 BOF): scope 1 = TP1, scope 2 = TP2 — xem lcTabsConfig.ts.
 */
const BaoCaoSanXuat_XNL = ({ type }: { type?: string }) => {
  const config = LC_BCSX_XNL;
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
    userObj?.idTaiKhoan ??
    userObj?.IdTaiKhoan ??
    null;

  const fixedFilters = useMemo(() => {
    return {
      userId: currentUserId,
      loaiVung: type === "xemphieu" ? 3 : type === "viecdentoi" ? 2 : 1,
    };
  }, [currentUserId, type]);

  const {
    data,
    loading,
    pagination,
    handleFilter,
    handleClearFilter,
    onPageChange,
    getAllowedScopeOptions,
  } = usePhieuSearchListHRC({
    maBm: config.code as string,
    fixedFilters,
    persistKey: true,
  });

  const statusConfig = PHIEU_STATUS_CONFIG;

  type TableRecord = SearchPhieuResponseModel & {
    pheDuyet?: Array<Record<string, unknown>>;
    [key: string]: unknown;
  };

  const detailPath = "/chitietbaocaosanxuat_xnl";
  const editPath = "/taophieubaocaosanxuat_xnl";

  const columns = [
    {
      title: <b>Số Phiếu</b>,
      dataIndex: "soPhieu",
      key: "soPhieu",
      render: (text: string, record: TableRecord) => (
        <b
          style={{ color: "#1976d2", cursor: "pointer" }}
          onClick={() => {
            if (type === "viecdentoi" || type === "xemphieu") {
              return navigate(detailPath, {
                state: { idphieu: record.idphieu, pheduyet: record?.pheDuyet?.[0] ?? null },
              });
            }
            return navigate(editPath, { state: { idphieu: record.idphieu } });
          }}
        >
          {text}
        </b>
      ),
      width: 220,
    },
    {
      title: "Thành phẩm",
      dataIndex: "scope",
      key: "scope",
      width: 100,
      render: (value: number) => (value === 2 ? "TP2" : value === 1 ? "TP1" : "-"),
    },
    {
      title: "Ngày SX",
      dataIndex: "ngaySX",
      key: "ngaySX",
      width: 110,
      render: (value: string) => (value ? dayjs(value).format("DD/MM/YYYY") : "-"),
    },
    {
      title: "Ca",
      dataIndex: "ca",
      key: "ca",
      width: 90,
      render: (value: number) => (value === 1 ? "Ca Ngày" : value === 2 ? "Ca Đêm" : "-"),
    },
    {
      title: "Người tạo",
      dataIndex: "tenNguoiTao",
      key: "tenNguoiTao",
      width: 180,
      ellipsis: true,
    },
    {
      title: "Trạng thái",
      dataIndex: "tinhTrang",
      key: "tinhTrang",
      width: 150,
      render: (status: string) => (
        <Tag color={statusConfig[status]?.color || "default"}>
          {statusConfig[status]?.text || status}
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
            onClick={() => navigate(detailPath, { state: { idphieu: record.idphieu } })}
          />
        </Space>
      ),
    },
  ];

  const filterFieldsConfig = useMemo(
    (): FilterFieldConfig[] => [
      {
        key: "soPhieu",
        label: "Số phiếu",
        type: "text",
        placeholder: "Số phiếu...",
      },
      {
        key: "ngaySX",
        label: "Ngày sản xuất",
        type: "dateRange",
        placeholder: "Khoảng ngày",
      },
      {
        key: "scope",
        label: "Thành phẩm",
        type: "select",
        options: getAllowedScopeOptions(config.code as string, THANH_PHAM_SCOPE_OPTIONS),
      },
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
        label: "Tình trạng",
        type: "select",
        placeholder: "Chọn tình trạng",
        options: Object.entries(statusConfig).map(([value, cfg]) => ({
          label: cfg.text,
          value: Number(value),
        })),
      },
    ],
    [getAllowedScopeOptions, statusConfig, config.code]
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
        showCreateButton={isAdmin}
        onCreateClick={() => navigate(editPath)}
        createButtonText="Tạo phiếu mới"
        singleRow
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
          scroll={{ x: 1000 }}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={7} align="right">
                <span style={{ fontWeight: 500 }}>Tổng: {pagination.total} Phiếu</span>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      </Card>
    </div>
  );
};

export default BaoCaoSanXuat_XNL;
