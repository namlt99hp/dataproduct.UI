import { Card, Descriptions, Table, Typography, Button, Statistic } from "antd";
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined, DownloadOutlined } from "@ant-design/icons";
import { Line, Column, Pie } from "@ant-design/plots";
import type {
  ResponseBlock,
  TableBlock,
  ChartBlock,
  KpiBlock,
  CardBlock,
  FileBlock,
  TextBlock,
  ImageBlock,
} from "../types/ChatResponseContract";
import { CATEGORICAL_PALETTE, STATUS_COLORS, paletteFor } from "../utils/vizPalette";

const { Paragraph } = Typography;

const TextBlockView = ({ block }: { block: TextBlock }) => (
  <Paragraph style={{ margin: 0, whiteSpace: "pre-wrap" }}>{block.markdown}</Paragraph>
);

const TableBlockView = ({ block }: { block: TableBlock }) => {
  const columns = block.columns.map((title, idx) => ({
    title,
    dataIndex: `col_${idx}`,
    key: `col_${idx}`,
  }));
  const dataSource = block.rows.map((row, rowIdx) => {
    const record: Record<string, unknown> = { key: rowIdx };
    row.forEach((cell, idx) => {
      record[`col_${idx}`] = cell;
    });
    return record;
  });

  return (
    <Table
      size="small"
      columns={columns}
      dataSource={dataSource}
      pagination={dataSource.length > 10 ? { pageSize: 10 } : false}
      scroll={{ x: true }}
    />
  );
};

const ChartBlockView = ({ block }: { block: ChartBlock }) => {
  const { chartType, categories, series } = block;

  if (chartType === "pie") {
    // Pie = part-to-whole, chỉ hợp lý với 1 series
    const first = series[0];
    const data = categories.map((category, idx) => ({
      category,
      value: first?.data[idx] ?? 0,
    }));
    return (
      <div style={{ height: 260 }}>
        <Pie
          data={data}
          angleField="value"
          colorField="category"
          height={260}
          scale={{ color: { range: paletteFor(categories.length) } }}
          label={{ text: "category" }}
        />
      </div>
    );
  }

  // line/bar: chuyển {categories, series[]} -> mảng phẳng cho G2
  const data = series.flatMap((s) =>
    categories.map((category, idx) => ({
      category,
      value: s.data[idx] ?? 0,
      series: s.name,
    })),
  );
  const commonProps = {
    data,
    xField: "category",
    yField: "value",
    seriesField: series.length > 1 ? "series" : undefined,
    colorField: series.length > 1 ? "series" : undefined,
    height: 260,
    scale: { color: { range: paletteFor(series.length || 1) } },
  } as const;

  return (
    <div style={{ height: 260 }}>
      {chartType === "line" ? <Line {...commonProps} /> : <Column {...commonProps} />}
    </div>
  );
};

const trendIcon = (trend?: KpiBlock["trend"]) => {
  if (trend === "up") return <ArrowUpOutlined style={{ color: STATUS_COLORS.good }} />;
  if (trend === "down") return <ArrowDownOutlined style={{ color: STATUS_COLORS.critical }} />;
  if (trend === "flat") return <MinusOutlined />;
  return undefined;
};

const KpiBlockView = ({ block }: { block: KpiBlock }) => (
  <Card size="small" style={{ display: "inline-block", minWidth: 180 }}>
    <Statistic title={block.label} value={block.value} prefix={trendIcon(block.trend)} />
  </Card>
);

const CardBlockView = ({ block }: { block: CardBlock }) => (
  <Card size="small" title={block.title}>
    <Descriptions size="small" column={1} bordered>
      {Object.entries(block.fields).map(([label, value]) => (
        <Descriptions.Item key={label} label={label}>
          {value}
        </Descriptions.Item>
      ))}
    </Descriptions>
  </Card>
);

const FileBlockView = ({ block }: { block: FileBlock }) => (
  <Button icon={<DownloadOutlined />} href={block.url} target="_blank" rel="noopener noreferrer">
    {block.name}
  </Button>
);

const ImageBlockView = ({ block }: { block: ImageBlock }) => (
  <div>
    <img src={block.url} alt={block.caption ?? ""} style={{ maxWidth: "100%", borderRadius: 4 }} />
    {block.caption && <Paragraph type="secondary" style={{ marginTop: 4 }}>{block.caption}</Paragraph>}
  </div>
);

export const ResponseRenderer = ({ blocks }: { blocks: ResponseBlock[] }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    {blocks.map((block, idx) => {
      switch (block.type) {
        case "text":
          return <TextBlockView key={idx} block={block} />;
        case "table":
          return <TableBlockView key={idx} block={block} />;
        case "chart":
          return <ChartBlockView key={idx} block={block} />;
        case "kpi":
          return <KpiBlockView key={idx} block={block} />;
        case "card":
          return <CardBlockView key={idx} block={block} />;
        case "file":
          return <FileBlockView key={idx} block={block} />;
        case "image":
          return <ImageBlockView key={idx} block={block} />;
        default:
          return null;
      }
    })}
  </div>
);

// re-export để nơi khác chỉ cần import từ đây khi cần chỉnh màu nhanh
export { CATEGORICAL_PALETTE };
