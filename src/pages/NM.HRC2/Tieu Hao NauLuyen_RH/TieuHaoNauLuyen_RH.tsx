import HRC2_BB_NauLuyen_RH from "../../../utils/BM_config/HRC2_BB_NauLuyen_RH.json";
import {
  Button,
  Card,
  Space,
  Table,
  Tag,
} from "antd";
// import PdfMakeExample from "../../components/PdfMakeExample";
// import CTD_BB_Phoinong from "../../../utils/BM_config/CTD_BB_Phoinong.json";
import {
  EyeOutlined,
} from "@ant-design/icons";
import PhieuFilterCard, { type FilterFieldConfig } from "../../../components/PhieuFilterCard";
import { useMemo } from "react";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import type { SearchPhieuResponseModel } from "../../../models/Phieu";
import { PHIEU_STATUS_CONFIG } from "../../../utils/constants/TrangThaiPhieuDisplay";
import { usePhieuSearchListHRC } from "../../../hooks/usePhieuSearchListHRC";
// Dữ liệu mẫu

const TieuHaoNauLuyen_LF = ({ type }: { type?: string }) => {
  const config = HRC2_BB_NauLuyen_RH;
  const navigate = useNavigate();
  const userStr = localStorage.getItem("user");
  const userObj = userStr ? JSON.parse(userStr) : {};
  const userInfoStr = localStorage.getItem("userinfo");
  const userInfoObj = userInfoStr ? JSON.parse(userInfoStr) : {};
  const isAdmin = userObj?.role?.includes("admin") || false;

  const statusXL: Record<string, { color: string; text: string }> = {
    0: { color: "purple", text: "Chờ xử lý" },
    1: { color: "green", text: "Đã xử lý" },
    2: { color: "pink", text: "Hủy" },
  };

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

  // [API cũ] phân biệt "việc tôi tạo" vs "việc đến tôi" bằng 2 param riêng
  // const fixedFilters = useMemo(() => {
  //   const base: Record<string, string | number | null | undefined> = {
  //     usercode: userObj?.maNV || "",
  //   };
  //   if (type === "viecdentoi") {
  //     base.nguoiDuyetId = currentUserId;
  //   } else {
  //     base.nguoiTaoId = currentUserId;
  //   }
  //   return base;
  // }, [currentUserId, type, userObj?.maNV]);

  // [API mới] dùng userId + loaiVung — backend tách vùng 1 / vùng 2
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
              return navigate("/chitiettieuhaonauluyen_rh", {
                state: {
                  idphieu: record.idphieu,
                  pheduyet: record?.pheDuyet?.[0] ?? null,
                },
              });
            } else {
              return navigate("/taophieutieuhaonauluyen_rh", {
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
      width: 200,
      ellipsis: true,
    },
    {
      title: "Khu vực",
      dataIndex: "tenScope",
      key: "tenScope",
      width: 120,
      ellipsis: true,
      render: (value: string | null | undefined, record: { scope?: number | string | null }) => {
        if (value) return value;
        if (record.scope !== null && record.scope !== undefined) return "RH " + String(record.scope);
        return null;
      },
    },
    {
      title: "Ngày lập",
      dataIndex: "ngaySX",
      key: "ngaySX",
      width: 120,
      render: (value: string) =>
        value ? dayjs(value).format("DD/MM/YYYY") : "-",
    },
    {
      title: "Ca",
      dataIndex: "ca",
      key: "ca",
      width: 100,
      ellipsis: true,
      render: (value: number) => {
        return value === 1 ? "Ca Ngày" : "Ca Đêm";
      },
    },
    {
      title: "Kíp",
      dataIndex: "kip",
      key: "kip",
      width: 60,
      ellipsis: true,
      render: (value: string) => {
        return value;
      },
    },
    {
      title: "Người tạo",
      dataIndex: "pheDuyet",
      key: "nguoiTao",
      width: 230,
      ellipsis: true,
      render: (_: any, record: TableRecord) => {
        const ctdApproval = record.pheDuyet?.find(
          (item: any) => item.capDuyet === 0,
        );
        const status = ctdApproval?.tinhTrang?.toString() || "0";
        return (
          <Tag color={statusXL[status]?.color || "default"}>
            {ctdApproval?.hoVaTen?.toString()}
          </Tag>
        );
      },
    },
    {
      title: "Người duyệt",
      dataIndex: "pheDuyet",
      key: "nguoiDuyetID",
      width: 230,
      ellipsis: true,
      render: (_: any, record: TableRecord) => {
        const ctdApproval = record.pheDuyet?.find(
          (item: any) => item.capDuyet === 1,
        );
        const status = ctdApproval?.tinhTrang?.toString() || "0";
        return (
          <Tag color={statusXL[status]?.color || "default"}>
            {ctdApproval?.hoVaTen?.toString()}
          </Tag>
        );
      },
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
              navigate("/chitiettieuhaonauluyen_rh", {
                state: { idphieu: record.idphieu },
              })
            }
          />
        </Space>
      ),
    },
  ];

  // Config cho các filter fields theo model phiếu
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
      placeholder: "Chọn ca",
      options: [
        { label: "Ca ngày (1)", value: 1 },
        { label: "Ca đêm (2)", value: 2 },
      ],
    },
    {
      key: "scope",
      label: "Lò",
      type: "select",
      placeholder: "Chọn lò",
      options: getAllowedScopeOptions(config.code as string),
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
  ], [getAllowedScopeOptions, statusConfig]);

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
        onCreateClick={() => {
          navigate("/taophieutieuhaonauluyen_rh");
        }}
        createButtonText="Tạo phiếu mới"
        singleRow
      />
      <Card>
        <Table<TableRecord>
          columns={columns}
          dataSource={data as TableRecord[]}
          loading={loading}
          // pagination={{
          //   total: data.length,
          //   pageSize: pagination.pageSize,
          //   showSizeChanger: true,
          //   showQuickJumper: true,
          //   showTotal: (total, range) =>
          //     `${range[0]}-${range[1]} của ${total} ticket`,
          // }}
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
      {/* <Modal
        title={
          editModal.record
            ? `Chỉnh sửa: ${editModal.record.soPhieu}`
            : "Chỉnh sửa"
        }
        open={editModal.open}
        onCancel={() => setEditModal({ open: false, record: undefined })}
        footer={null}
        destroyOnClose
      >
        <Form layout="vertical" form={editForm} onFinish={handleEditFinish}>
          <Form.Item
            name="soPhieu"
            label="Số phiếu"
            rules={[{ required: true }]}
          >
            <Input placeholder="Nhập số phiếu" />
          </Form.Item>
          <Form.Item
            name="quyTrinh"
            label="Quy trình"
            rules={[{ required: true }]}
          >
            <Input placeholder="Nhập quy trình" />
          </Form.Item>
          <Form.Item name="kip" label="Kíp" rules={[{ required: true }]}>
            <Input placeholder="Nhập kíp" />
          </Form.Item>
          <Form.Item
            name="xuong"
            label="Xưởng sản xuất"
            rules={[{ required: true }]}
          >
            <Input placeholder="Nhập xưởng" />
          </Form.Item>
          <Form.Item
            name="nguoiTao"
            label="Người tạo"
            rules={[{ required: true }]}
          >
            <Input placeholder="Nhập người tạo" />
          </Form.Item>
          <Form.Item name="ngaytao" label="Ngày tạo">
            <DatePicker showTime style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            name="ticketStatus"
            label="Trạng thái"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: "0", label: "Chờ xử lý" },
                { value: "1", label: "Đang xử lý" },
                { value: "2", label: "Hoàn tất" },
              ]}
            />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea rows={3} placeholder="Nhập ghi chú" />
          </Form.Item>
          <Space style={{ display: "flex", justifyContent: "end" }}>
            <Button
              onClick={() => setEditModal({ open: false, record: undefined })}
            >
              Hủy
            </Button>
            <Button type="primary" htmlType="submit">
              Lưu
            </Button>
          </Space>
        </Form>
      </Modal> */}
    </div>
  );
};

export default TieuHaoNauLuyen_LF;
