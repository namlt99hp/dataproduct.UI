import { Alert, Button, Card, Col, DatePicker, Form, Row, Select, Space, Statistic, Table, Tag, Tooltip, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { LineChartOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import {
  canBangNLApi,
  isDat,
  type BalanceItem,
  type CanBangNLFilter,
  type MaterialBalance,
} from "../../../services/CanBangNLApi";
import CanBangNLTrendModal from "./CanBangNLTrendModal";

const { Text } = Typography;

const CA_OPTIONS = [
  { label: "Cả ngày", value: 0 },
  { label: "Ca ngày (1)", value: 1 },
  { label: "Ca đêm (2)", value: 2 },
];
const CO_AM_OPTIONS = [
  { label: "Có ẩm", value: true },
  { label: "Khô (trừ ẩm)", value: false },
];
const LO_CAO_OPTIONS = [1, 2, 3, 4, 5, 6].map((v) => ({ label: `Lò Cao ${v}`, value: v }));

type FormValues = { ngay: Dayjs; ca: number; coAm: boolean; idLoCao?: number };

type RowType = "item" | "total" | "loss" | "rate";

type BalanceRow = {
  key: string;
  type: RowType;
  mat: MaterialBalance;
  summary: MaterialSummary;
  /** Số dòng item của material (để rowSpan) */
  itemCount: number;
  index: number;
  gen?: BalanceItem;
  cons?: BalanceItem;
  genSourceSpan: number;
  consSourceSpan: number;
};

type MaterialSummary = {
  totalGen: number;
  totalCons: number;
  loss: number;
  lossRate: number | null;
  dat: boolean | null;
};

const fmt = (v: number | null | undefined, d = 3) =>
  v === null || v === undefined
    ? null
    : v.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });

/** vd "|Loss rate| ≤ 2%" */
const stdText = (m: MaterialBalance) =>
  `${m.standardAbsolute ? "|Loss rate|" : "Loss rate"} ${m.standardOperator === "<" ? "<" : "≤"} ${m.standardLossRate}%`;

const sum = (items: BalanceItem[]) => items.reduce((s, i) => s + (i.value ?? 0), 0);

const summarize = (m: MaterialBalance): MaterialSummary => {
  const totalGen = sum(m.generators);
  const totalCons = sum(m.consumers);
  const loss = totalGen - totalCons;
  const lossRate = totalGen ? (loss / totalGen) * 100 : null;
  return {
    totalGen,
    totalCons,
    loss,
    lossRate,
    dat: lossRate === null ? null : isDat(lossRate, m),
  };
};

/** rowSpan cho các ô "nguồn dữ liệu" liên tiếp giống nhau (vd Coke DQ2/DQ1/CVH cùng "SUM mẻ xuất vào lò") */
const sourceSpans = (items: (BalanceItem | undefined)[]) => {
  const spans = items.map(() => 1);
  for (let i = 0; i < items.length; i++) {
    if (spans[i] === 0 || !items[i]) continue;
    let j = i + 1;
    while (j < items.length && items[j]?.source === items[i]!.source) spans[j++] = 0;
    spans[i] = j - i;
  }
  return spans;
};

const buildRows = (materials: MaterialBalance[]): BalanceRow[] =>
  materials.flatMap((mat) => {
    const n = Math.max(mat.generators.length, mat.consumers.length, 1);
    const gens = Array.from({ length: n }, (_, i) => mat.generators[i]);
    const conss = Array.from({ length: n }, (_, i) => mat.consumers[i]);
    const gSpan = sourceSpans(gens);
    const cSpan = sourceSpans(conss);
    const summary = summarize(mat);
    const base = { mat, summary, itemCount: n, genSourceSpan: 1, consSourceSpan: 1 };
    return [
      ...gens.map((gen, i) => ({
        ...base,
        key: `${mat.key}-${i}`,
        type: "item" as const,
        index: i,
        gen,
        cons: conss[i],
        genSourceSpan: gSpan[i],
        consSourceSpan: cSpan[i],
      })),
      ...(["total", "loss", "rate"] as const).map((type, k) => ({ ...base, key: `${mat.key}-${type}`, type, index: n + k })),
    ];
  });

const Value = ({ v, strong }: { v: number | null | undefined; strong?: boolean }) => {
  const s = fmt(v);
  if (s === null)
    return (
      <Tooltip title="Chưa có dữ liệu">
        <Text type="secondary">—</Text>
      </Tooltip>
    );
  return <span style={{ fontWeight: strong ? 600 : undefined, fontVariantNumeric: "tabular-nums" }}>{s}</span>;
};

const DatTag = ({ dat }: { dat: boolean | null }) =>
  dat === null ? <Tag>Chưa đủ dữ liệu</Tag> : dat ? <Tag color="success">Đạt</Tag> : <Tag color="error">Không đạt</Tag>;

const summaryBg: Record<RowType, string | undefined> = {
  item: undefined,
  total: "#fafafa",
  loss: "#fafafa",
  rate: "#f0f5ff",
};

const CanBangNL = () => {
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MaterialBalance[]>([]);
  const [filter, setFilter] = useState<CanBangNLFilter | null>(null);
  const [trendMat, setTrendMat] = useState<MaterialBalance | null>(null);

  const fetchData = async () => {
    const v = form.getFieldsValue();
    const f: CanBangNLFilter = {
      ngay: (v.ngay ?? dayjs()).format("YYYY-MM-DD"),
      ca: v.ca || undefined,
      coAm: v.coAm ?? true,
      idLoCao: v.idLoCao || undefined,
    };
    setLoading(true);
    try {
      setData(await canBangNLApi.getCanBang(f));
      setFilter(f);
    } catch (err) {
      console.error("Failed to load cân bằng NL:", err);
      message.error("Không thể tải dữ liệu cân bằng nguyên liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReset = () => {
    form.resetFields();
    fetchData();
  };

  const rows = useMemo(() => buildRows(data), [data]);

  const columns: ColumnsType<BalanceRow> = useMemo(() => {
    const bg = (r: BalanceRow) => ({ style: { background: summaryBg[r.type] } });
    const isItem = (r: BalanceRow) => r.type === "item";

    return [
      {
        title: "No.",
        key: "stt",
        width: 56,
        align: "center",
        onCell: (r) => ({ rowSpan: r.index === 0 ? r.itemCount + 3 : 0 }),
        render: (_, r) => data.indexOf(r.mat) + 1,
      },
      {
        title: "Material",
        key: "material",
        width: 150,
        align: "center",
        onCell: (r) => ({
          ...bg(r),
          rowSpan: isItem(r) ? (r.index === 0 ? r.itemCount : 0) : 1,
        }),
        render: (_, r) => {
          if (r.type === "item")
            return (
              <>
                <div style={{ fontWeight: 600 }}>{r.mat.material}</div>
                <Text type="secondary">(Unit: {r.mat.unit})</Text>
              </>
            );
          return <b>{{ total: "Total", loss: "Balance loss", rate: "Loss rate" }[r.type]}</b>;
        },
      },
      {
        title: "Generator (Giao nhận)",
        children: [
          {
            title: "Generator",
            key: "genName",
            width: 180,
            onCell: (r) => ({ ...bg(r), colSpan: isItem(r) ? 1 : 2 }),
            render: (_, r) => (isItem(r) ? r.gen?.name : null),
          },
          {
            title: "Generate data",
            key: "genSource",
            width: 130,
            align: "center",
            onCell: (r) => ({ ...bg(r), colSpan: isItem(r) ? 1 : 0, rowSpan: isItem(r) ? r.genSourceSpan : 1 }),
            render: (_, r) => (r.gen ? <Tag color="gold">{r.gen.source}</Tag> : null),
          },
          {
            title: "Khối lượng",
            key: "genValue",
            width: 130,
            align: "right",
            onCell: bg,
            render: (_, r) => {
              if (r.type === "item") return r.gen ? <Value v={r.gen.value} /> : null;
              if (r.type === "total") return <Value v={r.summary.totalGen} strong />;
              if (r.type === "loss") return <Value v={r.summary.loss} strong />;
              const rate = r.summary.lossRate;
              return rate === null ? (
                <Text type="secondary">—</Text>
              ) : (
                <b style={{ color: r.summary.dat ? "#389e0d" : "#cf1322" }}>{fmt(rate, 2)} %</b>
              );
            },
          },
        ],
      },
      {
        title: "Consumer (Vào lò)",
        children: [
          {
            title: "Consumer",
            key: "consName",
            width: 220,
            onCell: (r) => ({ ...bg(r), colSpan: r.type === "item" ? 1 : r.type === "total" ? 2 : 3 }),
            render: (_, r) => {
              if (r.type === "item") return r.cons?.name;
              if (r.type === "loss") return <Text type="secondary">= Total Generator − Total Consumer</Text>;
              if (r.type === "rate")
                return (
                  <Space>
                    <Text type="secondary">
                      = Balance loss / Total Generator · Đạt khi {stdText(r.mat)}
                    </Text>
                    <DatTag dat={r.summary.dat} />
                  </Space>
                );
              return null;
            },
          },
          {
            title: "Consume data",
            key: "consSource",
            width: 200,
            align: "center",
            onCell: (r) => ({
              ...bg(r),
              colSpan: r.type === "item" ? 1 : 0,
              rowSpan: isItem(r) ? r.consSourceSpan : 1,
            }),
            render: (_, r) => (r.cons ? <Tag color="blue" style={{ whiteSpace: "normal" }}>{r.cons.source}</Tag> : null),
          },
          {
            title: "Khối lượng",
            key: "consValue",
            width: 130,
            align: "right",
            onCell: (r) => ({ ...bg(r), colSpan: r.type === "item" || r.type === "total" ? 1 : 0 }),
            render: (_, r) => {
              if (r.type === "item") return r.cons ? <Value v={r.cons.value} /> : null;
              if (r.type === "total") return <Value v={r.summary.totalCons} strong />;
              return null;
            },
          },
        ],
      },
      {
        title: "Standard data",
        key: "standard",
        width: 150,
        align: "center",
        onCell: (r) => ({ rowSpan: r.index === 0 ? r.itemCount + 3 : 0 }),
        render: (_, r) => (
          <Space direction="vertical" size={4}>
            <Text>{stdText(r.mat)}</Text>
            <DatTag dat={r.summary.dat} />
          </Space>
        ),
      },
    ];
  }, [data]);

  return (
    <div>
      <Card title="Cân bằng nguyên liệu" style={{ marginBottom: 16 }}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{ ngay: dayjs(), ca: 1, coAm: true }}
          onFinish={fetchData}
        >
          <Row gutter={16} align="bottom">
            <Col xs={24} sm={12} md={5}>
              <Form.Item label="Ngày" name="ngay">
                <DatePicker format="DD/MM/YYYY" allowClear={false} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Form.Item label="Ca" name="ca">
                <Select options={CA_OPTIONS} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Form.Item label="Có ẩm?" name="coAm">
                <Select options={CO_AM_OPTIONS} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={5}>
              <Form.Item label="Lò cao" name="idLoCao">
                <Select options={LO_CAO_OPTIONS} allowClear placeholder="Tất cả" />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={loading}>
                    Xem
                  </Button>
                  <Button icon={<ReloadOutlined />} onClick={handleReset}>
                    Làm mới
                  </Button>
                </Space>
              </Form.Item>
            </Col>
          </Row>
        </Form>
        <Alert
          type="info"
          showIcon
          message="So sánh khối lượng Giao nhận (Generator) với khối lượng Vào lò (Consumer). Balance loss = Generator − Consumer; Loss rate = Balance loss / Generator."
        />
      </Card>

      {data.map((m) => {
        const s = summarize(m);
        return (
          <Card
            key={m.key}
            size="small"
            style={{ marginBottom: 16 }}
            title={
              <Space>
                <span>{m.material}</span>
                <DatTag dat={s.dat} />
              </Space>
            }
            extra={
              <Button icon={<LineChartOutlined />} onClick={() => setTrendMat(m)}>
                Xem biểu đồ trend dữ liệu
              </Button>
            }
          >
            <Row gutter={16}>
              <Col xs={12} md={6}>
                <Statistic title={`Total Generator (${m.unit})`} value={fmt(s.totalGen) ?? "—"} />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title={`Total Consumer (${m.unit})`} value={fmt(s.totalCons) ?? "—"} />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title={`Balance loss (${m.unit})`} value={fmt(s.loss) ?? "—"} />
              </Col>
              <Col xs={12} md={6}>
                <Statistic
                  title={`Loss rate (Đạt khi ${stdText(m)})`}
                  value={s.lossRate === null ? "—" : `${fmt(s.lossRate, 2)} %`}
                  valueStyle={{ color: s.dat === null ? undefined : s.dat ? "#389e0d" : "#cf1322" }}
                />
              </Col>
            </Row>
            {m.notes?.length > 0 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginTop: 12 }}
                message={m.notes.length === 1 ? m.notes[0] : <ul style={{ margin: 0, paddingLeft: 18 }}>{m.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
              />
            )}
          </Card>
        );
      })}

      <Card title="Bảng cân bằng chi tiết">
        <Table<BalanceRow>
          rowKey="key"
          columns={columns}
          dataSource={rows}
          loading={loading}
          pagination={false}
          bordered
          size="middle"
          scroll={{ x: 1290 }}
        />
      </Card>

      {trendMat && filter && (
        <CanBangNLTrendModal
          open
          onClose={() => setTrendMat(null)}
          filter={filter}
          mat={trendMat}
        />
      )}
    </div>
  );
};

export default CanBangNL;
