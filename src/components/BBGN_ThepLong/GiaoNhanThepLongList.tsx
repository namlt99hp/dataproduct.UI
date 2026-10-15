import HRC1_BBGN_ThepLong from "../../utils/BM_config/HRC1_BBGN_ThepLong.json";
import HRC2_BBGN_ThepLong from "../../utils/BM_config/HRC2_BBGN_ThepLong.json";
import { Button, Card, Space, Table, Tag } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import PhieuFilterCard, { type FilterFieldConfig } from "../PhieuFilterCard";
import { useMemo } from "react";
import type { SearchPhieuResponseModel } from "../../models/Phieu";
import { PHIEU_STATUS_CONFIG } from "../../utils/constants/TrangThaiPhieuDisplay";
import { getThongTinUser } from "../../utils/constants/GetThongTinLocalStore";
import { usePhieuSearchListHRC } from "../../hooks/usePhieuSearchListHRC";
import { useMayDucOptions } from "../../hooks/useMayDucOptions";

const CONFIG_MAP = {
  HRC1_BBGN_ThepLong: HRC1_BBGN_ThepLong,
  HRC2_BBGN_ThepLong: HRC2_BBGN_ThepLong,
} as const;

export type BBGNThepLongBieuMau = keyof typeof CONFIG_MAP;

interface GiaoNhanThepLongListProps {
  bieuMau: BBGNThepLongBieuMau;
  type?: string; // "viecdentoi" | undefined
  routeDetail?: string; // default: "/chitietgiaonhantheplong"
  routeCreate?: string; // default: "/taophieugiaonhantheplong"
}

type TableRecord = SearchPhieuResponseModel & {
  pheDuyet?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

const GiaoNhanThepLongList = ({
  bieuMau,
  type,
  routeDetail = "/chitietgiaonhantheplong",
  routeCreate = "/taophieugiaonhantheplong",
}: GiaoNhanThepLongListProps) => {
  const config = CONFIG_MAP[bieuMau];
  const navigate = useNavigate();
  const nhaMay = bieuMau === "HRC2_BBGN_ThepLong" ? 2 : 1;
  // Gồm cả máy đã khóa — để cột "Máy đúc" của phiếu cũ vẫn hiện đúng tên
  const { getTen: getTenMayDuc } = useMayDucOptions(nhaMay);

  const userStr = localStorage.getItem("user");
  const userObj = userStr ? JSON.parse(userStr) : {};
  const isAdmin = userObj?.role?.includes("admin") || false;

  const currentUserId = useMemo(() => {
    const user = getThongTinUser();
    return user.iD_TaiKhoan ?? null;
  }, []);

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
              return navigate(routeDetail, {
                state: {
                  idphieu: record.idphieu,
                  pheduyet: record?.pheDuyet?.[0] ?? null,
                },
              });
            } else {
              return navigate(routeCreate, {
                state: { idphieu: record.idphieu },
              });
            }
          }}
        >
          {text}
        </b>
      ),
      width: 250,
    },
    {
      title: "Quy trình",
      dataIndex: "maBm",
      key: "maBm",
      width: 220,
      ellipsis: true,
    },
    {
      title: "Ngày lập phiếu",
      dataIndex: "ngaySX",
      key: "ngaySX",
      width: 190,
      render: (value: string) =>
        value ? dayjs(value).format("DD/MM/YYYY") : "-",
    },
    {
      title: "Ca",
      dataIndex: "ca",
      key: "ca",
      width: 130,
      ellipsis: true,
      render: (value: number) => {
        return value === 1 ? "Ca Ngày" : "Ca Đêm";
      },
    },
    {
      title: "Máy đúc",
      dataIndex: "scope",
      key: "scope",
      width: 130,
      ellipsis: true,
      render: (value: number, record: TableRecord) =>
        record.tenScope || getTenMayDuc(value) || (value != null ? String(value) : "-"),
    },
    {
      title: "Người tạo",
      dataIndex: "nguoiTaoId",
      key: "nguoiTaoId",
      width: 270,
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
            onClick={() =>
              navigate(routeDetail, {
                state: { idphieu: record.idphieu },
              })
            }
          />
        </Space>
      ),
    },
  ];

  const filterFieldsConfig = useMemo((): FilterFieldConfig[] => [
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
      key: "ca",
      label: "Ca",
      type: "select",
      options: [
        { label: "Ca ngày (1)", value: 1 },
        { label: "Ca đêm (2)", value: 2 },
      ],
    },
    {
      key: "scope",
      label: "Máy đúc",
      type: "select",
      // Lọc theo khu vực được phân quyền — scope lấy động từ bảng MayDuc (bmQuyenConfig.scopeSource)
      options: getAllowedScopeOptions(config.code as string),
    },
  ], [getAllowedScopeOptions]);

  return (
    <div>
      <PhieuFilterCard
        title={config.title}
        onFilter={handleFilter}
        onClearFilter={handleClearFilter}
        filterFields={filterFieldsConfig}
        showCreateButton={true}
        onCreateClick={() => {
          navigate(routeCreate);
        }}
        createButtonText="Tạo phiếu mới"
        storageKey={true} 
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
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} của ${total} phiếu`,
            onChange: onPageChange,
          }}
          scroll={{ x: 1100 }}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={8} align="right">
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

export default GiaoNhanThepLongList;
