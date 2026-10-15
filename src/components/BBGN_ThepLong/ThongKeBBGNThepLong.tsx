import { Button, Card, Checkbox, DatePicker, Form, Input, Select, Space, Table, Tag, Tooltip, message } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  bbgbThepLongApi,
  type SearchThongKeBBGNThepLongRequest,
  type SumThongKeBBGNThepLongResponse,
  type TongHopBBGNThepLongResponse,
  type TongHopItem,
} from "../../services/BBGNThepLongApi";
import { useMayDucOptions } from "../../hooks/useMayDucOptions";
import { SyncOutlined } from "@ant-design/icons";

const { RangePicker } = DatePicker;

type ThongKeRow = {
  id: number;
  mayDuc?: string | null;
  me?: string | null;
  macThep?: string | null;
  thungSo?: string | null;
  thoiGian?: string | null;
  klLan1?: number | null;
  klLan2?: number | null;
  klLan3?: number | null;
  klThepLong?: number | null;
  ghiChu?: string | null;
  tinhLuyenLenThang?: string | null;
  phanLoai?: string | null;
  macThepBKMIS?: string | null;
  phanLoaiNhom?: string | null;
  ngaySX?: string | null;
  ca?: number | null;
  scope?: number | null;
  isTrungMeThoi?: boolean | null;
  IsTrungMeThoi?: boolean | null;
  klLFSauThep?: number | null;
  tenNhomPhanLoaiMacThep?: string | null;
  klcau1?: number | null;
  klcau2?: number | null;
  lastNameUserEdit?: string | null;
};

const formatNumber = (value: number | null | undefined) =>
  value == null ? "" : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);

const isDuplicateMe = (record: ThongKeRow) =>
  record.isTrungMeThoi === true || record.IsTrungMeThoi === true;

type SummaryRow = {
  key: string;
  phanLoai: TongHopItem | null;
  ca: TongHopItem | null;
  kip: TongHopItem | null;
  tinhLuyenLenThang: TongHopItem | null;
  ducVuong: TongHopItem | null;
  ducTam: TongHopItem | null;
  nhomPhanLoaiMacThep: TongHopItem | null;
  isTotal?: boolean;
};

const renderSummaryCell = (item: TongHopItem | null, isTotal?: boolean) => {
  if (!item) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontWeight: isTotal ? 600 : undefined }}>
      <span>{item.label}</span>
      <span>{item.soMe}</span>
    </div>
  );
};

type Props = {
  bieuMau: string;
  nhaMay: number;
};

const ThongKeBBGNThepLong = ({ bieuMau, nhaMay }: Props) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [tableData, setTableData] = useState<ThongKeRow[]>([]);
  const [sumData, setSumData] = useState<SumThongKeBBGNThepLongResponse>({
    totalRows: 0,
    totalKlThepLong: null,
  });
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState<SearchThongKeBBGNThepLongRequest>({
    bieuMau,
    page: 1,
    pageSize: 20,
  });
  const { options: mayDucOptions } = useMayDucOptions(nhaMay);
  const [exporting, setExporting] = useState(false);
  const [syncingPhanLoai, setSyncingPhanLoai] = useState(false);
  const [tongHopData, setTongHopData] = useState<TongHopBBGNThepLongResponse | null>(null);

  const fetchData = useCallback(async (nextFilters: SearchThongKeBBGNThepLongRequest) => {
    try {
      setLoading(true);
      const [searchRes, sumRes] = await Promise.all([
        bbgbThepLongApi.searchThongKe<ThongKeRow>(nextFilters),
        bbgbThepLongApi.sumThongKe(nextFilters),
      ]);
      setTableData(searchRes.data ?? []);
      setSumData(sumRes);
      setPagination({
        current: searchRes.page ?? nextFilters.page ?? 1,
        pageSize: searchRes.pageSize ?? nextFilters.pageSize ?? 20,
        total: searchRes.totalRecords ?? 0,
      });
      setFilters(nextFilters);
      void bbgbThepLongApi.tongHop(nextFilters).then(setTongHopData).catch(() => {});
    } catch (error) {
      console.error(error);
      message.error("Không thể tải thống kê BBGN thép lỏng.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData({ bieuMau, page: 1, pageSize: 20 });
  }, [fetchData, bieuMau]);

  const handleFilter = useCallback(() => {
    const values = form.getFieldsValue(true) as Record<string, unknown>;
    const dateRange = values.ngaySX as [dayjs.Dayjs, dayjs.Dayjs] | undefined;
    const nextFilters: SearchThongKeBBGNThepLongRequest = {
      tuNgay: dateRange?.[0]?.format("YYYY-MM-DD"),
      denNgay: dateRange?.[1]?.format("YYYY-MM-DD"),
      ca: values.ca ? Number(values.ca) : undefined,
      kip: values.kip ? String(values.kip) : undefined,
      scope: values.scope ? Number(values.scope) : undefined,
      mayDuc: values.scope ? Number(values.scope) : undefined,
      searchString: values.searchString ? String(values.searchString).trim() : undefined,
      thungSo: values.thungSo ? String(values.thungSo).trim() : undefined,
      tinhLuyenLenThang: values.tinhLuyenLenThang ? String(values.tinhLuyenLenThang) : undefined,
      phanLoai: values.phanLoai ? String(values.phanLoai).trim() : undefined,
      phanLoaiNhom: values.phanLoaiNhom ? String(values.phanLoaiNhom).trim() : undefined,
      isTrungMeThoi: values.isTrungMeThoi === true ? true : undefined,
      bieuMau,
      page: 1,
      pageSize: pagination.pageSize,
    };
    void fetchData(nextFilters);
  }, [fetchData, form, pagination.pageSize, bieuMau]);

  const handleExcel = useCallback(async () => {
    const dateRange = form.getFieldValue("ngaySX") as [dayjs.Dayjs, dayjs.Dayjs] | undefined;
    if (!dateRange || !dateRange[0] || !dateRange[1]) {
      message.warning("Vui lòng chọn khoảng ngày sản xuất trước khi xuất Excel.");
      return;
    }
    try {
      setExporting(true);
      await bbgbThepLongApi.exportThongKe({
        ...filters,
        tuNgay: dateRange[0].format("YYYY-MM-DD"),
        denNgay: dateRange[1].format("YYYY-MM-DD"),
      });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Xuất Excel thất bại.");
    } finally {
      setExporting(false);
    }
  }, [filters, form]);

  const handleSyncPhanLoai = useCallback(async () => {
    const maMes = Array.from(
      new Set(
        tableData
          .map((row) => row.me?.trim())
          .filter((me): me is string => !!me)
      )
    );
    if (maMes.length === 0) {
      message.warning("Không có mã mẻ nào trong bảng để đồng bộ.");
      return;
    }
    try {
      setSyncingPhanLoai(true);
      const res = await bbgbThepLongApi.syncPhanLoai({ bieuMau: "HRC2_BBGN_ThepLong", maMes });
      message.success(`Đã đồng bộ ${res.totalUpdated}/${res.totalFromMySQL} mẻ có dữ liệu phân loại.`);
      await fetchData(filters);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Đồng bộ phân loại thất bại.");
    } finally {
      setSyncingPhanLoai(false);
    }
  }, [tableData, filters, fetchData]);

  const handleClearFilter = useCallback(() => {
    form.resetFields();
    void fetchData({ bieuMau, page: 1, pageSize: pagination.pageSize });
  }, [fetchData, form, pagination.pageSize, bieuMau]);

  const summaryRows = useMemo<SummaryRow[]>(() => {
    if (!tongHopData) return [];
    const { phanLoai, ca, kip, tinhLuyenLenThang, ducVuong, ducTam, nhomPhanLoaiMacThep } = tongHopData;
    const maxLen = Math.max(phanLoai.length, ca.length, kip.length, tinhLuyenLenThang.length, ducVuong.length, ducTam.length, nhomPhanLoaiMacThep.length, 0);

    const rows: SummaryRow[] = Array.from({ length: maxLen }, (_, i) => ({
      key: `s${i}`,
      phanLoai: phanLoai[i] ?? null,
      ca: ca[i] ?? null,
      kip: kip[i] ?? null,
      tinhLuyenLenThang: tinhLuyenLenThang[i] ?? null,
      ducVuong: ducVuong[i] ?? null,
      ducTam: ducTam[i] ?? null,
      nhomPhanLoaiMacThep: nhomPhanLoaiMacThep[i] ?? null,
    }));

    const sumMe = (items: TongHopItem[]) => items.reduce((acc, x) => acc + x.soMe, 0);

    rows.push({
      key: "total",
      isTotal: true,
      phanLoai: { label: "Tổng", soMe: sumMe(phanLoai) },
      ca: { label: "Tổng", soMe: sumMe(ca) },
      kip: { label: "Tổng", soMe: sumMe(kip) },
      tinhLuyenLenThang: { label: "Tổng", soMe: sumMe(tinhLuyenLenThang) },
      ducVuong: { label: "Tổng", soMe: sumMe(ducVuong) },
      ducTam: { label: "Tổng", soMe: sumMe(ducTam) },
      nhomPhanLoaiMacThep: { label: "Tổng", soMe: sumMe(nhomPhanLoaiMacThep) },
    });

    return rows;
  }, [tongHopData]);

  const summaryColumns = useMemo(
    () => [
      {
        title: "Phân loại",
        key: "phanLoai",
        render: (_: unknown, record: SummaryRow) => renderSummaryCell(record.phanLoai, record.isTotal),
      },
      {
        title: "Ca",
        key: "ca",
        render: (_: unknown, record: SummaryRow) => renderSummaryCell(record.ca, record.isTotal),
      },
      {
        title: "Kíp",
        key: "kip",
        render: (_: unknown, record: SummaryRow) => renderSummaryCell(record.kip, record.isTotal),
      },
      {
        title: "Tinh luyện / Lên thẳng",
        key: "tinhLuyenLenThang",
        render: (_: unknown, record: SummaryRow) => renderSummaryCell(record.tinhLuyenLenThang, record.isTotal),
      },
      {
        title: "Đúc Vuông",
        key: "ducVuong",
        render: (_: unknown, record: SummaryRow) => renderSummaryCell(record.ducVuong, record.isTotal),
      },
      {
        title: "Đúc Tấm",
        key: "ducTam",
        render: (_: unknown, record: SummaryRow) => renderSummaryCell(record.ducTam, record.isTotal),
      },
      {
        title: "Nhóm phân loại mác thép",
        key: "nhomPhanLoaiMacThep",
        render: (_: unknown, record: SummaryRow) => renderSummaryCell(record.nhomPhanLoaiMacThep, record.isTotal),
      },
    ],
    []
  );

  const columns = useMemo(
    () => [

      {
        title: "Ngày SX",
        dataIndex: "ngaySX",
        key: "ngaySX",
        width: 120,
        fixed: "left" as const,
        render: (value: string) => (value ? dayjs(value).format("DD/MM/YYYY") : "-"),
      },
      {
        title: "Ca",
        dataIndex: "ca",
        key: "ca",
        width: 80,
        fixed: "left" as const,
        render: (value: number) => (value === 1 ? "Ngày" : value === 2 ? "Đêm" : "-"),
      },
      {
        title: "Máy đúc",
        dataIndex: "mayDuc",
        key: "mayDuc",
        width: 130,
        fixed: "left" as const,
        render: (value: string) => {
          return value;
        },
      },
      {
        title: "Mẻ",
        dataIndex: "me",
        key: "me",
        width: 120,
        fixed: "left" as const,
        render: (value: string, record: ThongKeRow) =>
          isDuplicateMe(record) ? <span style={{ color: "red", fontWeight: 600 }}>{value}</span> : value,
      },
      { title: "Mác thép", dataIndex: "macThep", key: "macThep", width: 120, fixed: "left" as const },
      { title: "Thùng số", dataIndex: "thungSo", key: "thungSo", width: 110 },
      { title: "Thời gian", dataIndex: "thoiGian", key: "thoiGian", width: 100 },
      ...(nhaMay === 1
        ? [
            {
              title: "KL LF sau thép",
              dataIndex: "klLFSauThep",
              key: "klLFSauThep",
              width: 130,
              align: "right" as const,
              render: (value: number) => formatNumber(value),
            },
          ]
        : []),
      {
        title: "KL lần 1",
        dataIndex: "klLan1",
        key: "klLan1",
        width: 100,
        align: "right" as const,
        render: (value: number) => formatNumber(value),
      },
      {
        title: "KL lần 2",
        dataIndex: "klLan2",
        key: "klLan2",
        width: 100,
        align: "right" as const,
        render: (value: number) => formatNumber(value),
      },
      {
        title: "KL lần 3",
        dataIndex: "klLan3",
        key: "klLan3",
        width: 100,
        align: "right" as const,
        render: (value: number) => formatNumber(value),
      },
      {
        title: "KL thép lỏng",
        dataIndex: "klThepLong",
        key: "klThepLong",
        width: 120,
        align: "right" as const,
        render: (value: number) => {
          const isNegative = Number(value) < 0;
          return (
            <span style={isNegative ? { color: "red", fontWeight: 600 } : undefined}>
              {formatNumber(value)}
            </span>
          );
        },
      },
      { title: "Tinh luyện / Lên thẳng", dataIndex: "tinhLuyenLenThang", key: "tinhLuyenLenThang", width: 160 },
      { title: "Phân loại", dataIndex: "phanLoai", key: "phanLoai", width: 120 },
      { title: "Mác thép BKMIS", dataIndex: "macThepBKMIS", key: "macThepBKMIS", width: 120 },
      { title: "Phân loại nhóm", dataIndex: "phanLoaiNhom", key: "phanLoaiNhom", width: 130 },
      { title: "Nhóm mác thép", dataIndex: "tenNhomPhanLoaiMacThep", key: "tenNhomPhanLoaiMacThep", width: 150 },
      {
        title: "KL cầu 1",
        dataIndex: "klcau1",
        key: "klcau1",
        width: 100,
        align: "right" as const,
        render: (value: number) => formatNumber(value),
      },
      {
        title: "KL cầu 2",
        dataIndex: "klcau2",
        key: "klcau2",
        width: 100,
        align: "right" as const,
        render: (value: number) => formatNumber(value),
      },
      {
        title: "Trùng mẻ",
        dataIndex: "isTrungMeThoi",
        key: "isTrungMeThoi",
        width: 100,
        render: (value: boolean | null) =>
          value === true ? <Tag color="red">Trùng</Tag> : <Tag>Không</Tag>,
      },
      { title: "Ghi chú", dataIndex: "ghiChu", key: "ghiChu", width: 180 },
      { title: "Người sửa", dataIndex: "lastNameUserEdit", key: "lastNameUserEdit", width: 130 },

    ],
    [nhaMay]
  );

  return (
    <Card style={{ marginTop: 12 }}>
      <Form form={form} layout="inline" style={{ marginBottom: 16 }}>
        <Space wrap align="center">
          <Form.Item name="ngaySX" label="Ngày sản xuất">
            <RangePicker format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="ca" label="Ca"> 
            <Select allowClear options={[
              { label: "Ca ngày (1)", value: 1 },
              { label: "Ca đêm (2)", value: 2 },
            ]} placeholder="Ca" style={{ minWidth: 140 }} />
          </Form.Item>
          <Form.Item name="kip" label="Kíp">
            <Select allowClear options={[
              { label: "Kíp A", value: "A" },
              { label: "Kíp B", value: "B" },
              { label: "Kíp C", value: "C" },
            ]} placeholder="Kíp" style={{ minWidth: 140 }} />
          </Form.Item>
          <Form.Item name="scope" label="Máy đúc">
            <Select allowClear options={mayDucOptions} placeholder="Máy đúc" style={{ minWidth: 140 }} />
          </Form.Item>

          <Form.Item name="searchString" label="Mẻ / Mác thép">
            <Input placeholder="Mẻ hoặc mác thép" style={{ minWidth: 160 }} />
          </Form.Item>

          <Form.Item name="thungSo" label="Thùng số">
            <Input placeholder="Thùng số" style={{ minWidth: 120 }} />
          </Form.Item>

          <Form.Item name="tinhLuyenLenThang" label="Tinh luyện / Lên thẳng">
            <Select
              allowClear
              placeholder="Tất cả"
              style={{ minWidth: 140 }}
              options={[
                { label: "Tinh luyện", value: "Tinh luyện" },
                { label: "Lên thẳng", value: "Lên thẳng" },
              ]}
            />
          </Form.Item>

          <Form.Item name="phanLoai" label="Phân loại">
            <Input placeholder="Phân loại" style={{ minWidth: 100 }} />
          </Form.Item>

          <Form.Item name="phanLoaiNhom" label="Phân loại nhóm">
            <Input placeholder="Phân loại nhóm" style={{ minWidth: 120 }} />
          </Form.Item>

          <Form.Item name="isTrungMeThoi" valuePropName="checked">
            <Checkbox>Trùng mẻ</Checkbox>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" onClick={() => void handleFilter()} loading={loading}>
                Tìm
              </Button>
              <Button onClick={handleClearFilter}>Reset</Button>
              {/* <Button
                loading={syncingPhanLoai}
                onClick={() => void handleSyncPhanLoai()}
              >
                Đồng bộ phân loại / mác BKMIS
              </Button> */}
              <Tooltip title="Đồng bộ phân loại">
                <Button
                  icon={<SyncOutlined />}
                  loading={syncingPhanLoai}
                  onClick={() => void handleSyncPhanLoai()}
                >
                </Button>
              </Tooltip>
              <Button
                type="primary"
                style={{ backgroundColor: "#217346", borderColor: "#217346" }}
                loading={exporting}
                onClick={() => void handleExcel()}
              >
                Xuất Excel
              </Button>
            </Space>
          </Form.Item>
        </Space>
      </Form>

      <Table<ThongKeRow>
        bordered
        size="small"
        columns={columns}
        dataSource={tableData}
        loading={loading}
        rowKey={(row) => String(row.id)}
        scroll={{ x: 1800, y: 520 }}
        onRow={(record) => (isDuplicateMe(record) ? { style: { backgroundColor: "#fff1f0" } } : {})}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          showQuickJumper: true,
          pageSizeOptions: ["10", "20", "50", "100"],
          showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} dòng`,
          onChange: (page, pageSize) => {
            void fetchData({ ...filters, page, pageSize });
          },
        }}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row style={{ background: "#fafafa", fontWeight: 600 }}>
              <Table.Summary.Cell index={0} colSpan={5} align="right">
                Tổng dòng: {sumData.totalRows}
              </Table.Summary.Cell>
              <Table.Summary.Cell index={5} colSpan={nhaMay == 1 ? 6 : 5}>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={10} align="right">
                <span
                  style={
                    Number(sumData.totalKlThepLong) < 0 ? { color: "red", fontWeight: 600 } : undefined
                  }
                >
                  {formatNumber(sumData.totalKlThepLong)}
                </span>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={11} colSpan={10} align="center">
              </Table.Summary.Cell>
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />

      {tongHopData && (
        <Table<SummaryRow>
          bordered
          size="small"
          columns={summaryColumns}
          dataSource={summaryRows}
          pagination={false}
          rowKey="key"
          style={{ marginTop: 16 }}
          rowClassName={(record) => (record.isTotal ? "summary-total-row" : "")}
        />
      )}
    </Card>
  );
};

export default ThongKeBBGNThepLong;
