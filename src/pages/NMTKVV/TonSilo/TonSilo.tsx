/* eslint-disable @typescript-eslint/no-explicit-any */
import TKVV_TonSilo from "../../../utils/BM_config/TKVV_TonSilo.json";
import { Button, Card, Space, Table, Tag, Tooltip, message } from "antd";
import { EyeOutlined, PlusOutlined, SyncOutlined } from "@ant-design/icons";
import { tkvvTonSiloApi } from "../../../services/TKVVApi";
import PhieuFilterCard, {
  type FilterFieldConfig,
} from "../../../components/PhieuFilterCard";
import { useMemo, useState } from "react";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { usePhieuSearchListHRC } from "../../../hooks/usePhieuSearchListHRC";
import type { SearchPhieuResponseModel } from "../../../models/Phieu";
import useRowSelection from "../../../hooks/useRowSelection";
import useCheckPhieu from "../../../hooks/useCheckPhieu";
import { tkvvScopeToLabel, TKVV_SCOPE_OPTIONS } from "../../../utils/constants/TKVV_constant";

const TonSilo = ({ type }: { type?: string }) => {
  const config = TKVV_TonSilo as any;
  const navigate = useNavigate();
  const userInfoStr = localStorage.getItem("userinfo");
  const userInfoObj = userInfoStr ? JSON.parse(userInfoStr) : {};

  const currentUserId: number | null =
    userInfoObj?.iD_TaiKhoan ??
    userInfoObj?.ID_TaiKhoan ??
    userInfoObj?.idTaiKhoan ??
    null;

  const fixedFilters = useMemo(
    () => ({
      userId: currentUserId,
      loaiVung: type === "xemphieu" ? 3 : type === "viecdentoi" ? 2 : 1,
    }),
    [currentUserId, type],
  );

  const {
    data,
    loading,
    pagination,
    handleFilter,
    handleClearFilter,
    onPageChange,
    refetch,
    getAllowedScopeOptions,
  } = usePhieuSearchListHRC({
    maBm: config.code as string,
    fixedFilters,
    persistKey: true,
  });

  const { selectedRowKeys, setSelectedRowKeys, checkboxColumn } =
    useRowSelection(data as any[]);
  const { checkLoading, handleCheckPhieu } = useCheckPhieu(
    selectedRowKeys,
    () => setSelectedRowKeys([]),
    refetch,
  );

  const [refreshLoading, setRefreshLoading] = useState(false);

  const handleRefreshBbgn = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning("Vui lòng chọn ít nhất 1 phiếu.");
      return;
    }
    setRefreshLoading(true);
    try {
      const res = await tkvvTonSiloApi.refreshBbgnBatch({
        phieuIds: selectedRowKeys as string[],
        currentUserId,
      });
      message.success(res.message || "Đã cập nhật dữ liệu BBGN.");
      setSelectedRowKeys([]);
      refetch();
    } catch {
      message.error("Cập nhật dữ liệu BBGN thất bại.");
    } finally {
      setRefreshLoading(false);
    }
  };

  const statusConfig: Record<string, { color: string; text: string }> = {
    0: { color: "purple", text: "Đang lưu" },
    1: { color: "pink", text: "Đã gửi" },
    2: { color: "blue", text: "Hoàn thành" },
    3: { color: "tomato", text: "Đã thu hồi" },
    4: { color: "yellow", text: "Không xác nhận" },
    5: { color: "green", text: "Chốt" },
    6: { color: "gray", text: "Đang phê duyệt" },
  };

  const approvalStatusConfig: Record<number, { color: string; text: string }> =
    {
      0: { color: "default", text: "Chưa xác nhận" },
      1: { color: "green", text: "Đã ký" },
      2: { color: "red", text: "Từ chối" },
    };

  type TableRecord = SearchPhieuResponseModel & {
    pheDuyet?: Array<Record<string, unknown>>;
    [key: string]: unknown;
  };

  const columns = [
    checkboxColumn,
    {
      title: <b>Số Phiếu</b>,
      dataIndex: "soPhieu",
      key: "soPhieu",
      render: (text: string, record: TableRecord) => (
        <b
          style={{ color: "#1976d2", cursor: "pointer" }}
          onClick={() => {
            if (type === "viecdentoi" || type === "xemphieu") {
              return navigate(`/chitiettonsilotkvv/${record.idphieu}`);
            }

            if (
              record.tinhTrang === 0 ||
              record.tinhTrang === 3 ||
              record.tinhTrang === 7
            ) {
              return navigate(`/taophieutonsilotkvv/${record.idphieu}`);
            }

            return navigate(`/chitiettonsilotkvv/${record.idphieu}`);
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
      title: "Ngày sản xuất",
      dataIndex: "ngaySX",
      key: "ngaySX",
      width: 130,
      render: (value: string) =>
        value ? dayjs(value).format("DD/MM/YYYY") : "-",
    },
    {
      title: "Ca",
      dataIndex: "ca",
      key: "ca",
      width: 130,
      render: (value: number) =>
        value ? `Ca ${value == 1 ? "Ngày" : "Đêm"}` : "-",
    },
    {
      title: "Xưởng",
      dataIndex: "scope",
      key: "scope",
      width: 130,
      render: (value: number) => (value ? tkvvScopeToLabel(value) : "-"),
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
    // Cột động phê duyệt từng cấp
    ...config.signatures
      .filter((sig: any) => sig.capDuyet >= 0)
      .sort((a: any, b: any) => a.capDuyet - b.capDuyet)
      .map((sig: any) => ({
        title: `${sig.label} (Cấp ${sig.capDuyet})`,
        key: `approval_${sig.capDuyet}`,
        width: 180,
        ellipsis: true,
        render: (_: unknown, record: TableRecord) => {
          const pheDuyet = record.pheDuyet || [];
          const approvalItem = (pheDuyet as any[]).find(
            (pd: any) => pd.capDuyet === sig.capDuyet,
          );
          if (!approvalItem) return <Tag color="default">Chưa gán</Tag>;
          const status: number = approvalItem.tinhTrang ?? 0;
          const statusText =
            approvalStatusConfig[status]?.text || `Trạng thái ${status}`;
          const fullText = `${statusText}-${approvalItem.hoVaTen || "N/A"}`;
          return (
            <Tooltip title={fullText}>
              <Tag color={approvalStatusConfig[status]?.color || "default"}>
                <span
                  style={{
                    display: "inline-block",
                    maxWidth: 150,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {fullText}
                </span>
              </Tag>
            </Tooltip>
          );
        },
      })),
    {
      title: "Thao tác",
      key: "action",
      width: 90,
      render: (_: unknown, record: TableRecord) => (
        <Space>
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/chitiettonsilotkvv/${record.idphieu}`)}
          />
        </Space>
      ),
    },
  ];

  const filterFieldsConfig: FilterFieldConfig[] = useMemo(() => [
    {
      key: "soPhieu",
      label: "Số phiếu",
      type: "text",
      placeholder: "Số phiếu...",
    },
    {
      key: "ngaySX",
      label: "Khoảng ngày",
      type: "dateRange",
      placeholder: "Khoảng ngày",
    },
    {
      key: "scope",
      label: "Xưởng",
      type: "select",
      placeholder: "Chọn xưởng",
      options: getAllowedScopeOptions(config.code as string, TKVV_SCOPE_OPTIONS),
    },
  ], [getAllowedScopeOptions, config.code]);

  return (
    <div>
      <style>{`.row-checked td { background-color: #d9f7be !important; }`}</style>
      <PhieuFilterCard
        title={config.title}
        onFilter={handleFilter}
        onClearFilter={handleClearFilter}
        filterFields={filterFieldsConfig}
        mergeFilters={{}}
        selectedRowCount={selectedRowKeys.length}
        checkLoading={checkLoading}
        onCheckPhieu={handleCheckPhieu}
      />
      <Card
        extra={
          <Space>
            <Button
              icon={<SyncOutlined />}
              loading={refreshLoading}
              disabled={selectedRowKeys.length === 0}
              onClick={handleRefreshBbgn}
            >
              Cập nhật BBGN
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate("/taophieutonsilotkvv")}
            >
              Tạo phiếu mới
            </Button>
          </Space>
        }
      >
        <Table<TableRecord>
          columns={columns}
          dataSource={data as TableRecord[]}
          loading={loading}
          rowClassName={(record: any) =>
            record.isCheck === 1 ? "row-checked" : ""
          }
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
              <Table.Summary.Cell index={0} colSpan={9} align="right">
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

export default TonSilo;
