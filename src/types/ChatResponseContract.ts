// Response Contract (mục 5 bản phân tích chatbox_MCP_analysis.md) — hình dạng JSON
// mà dataproduct.gateway trả về cho mỗi câu trả lời của Claude.

export interface TextBlock {
  type: "text";
  markdown: string;
}

export interface TableBlock {
  type: "table";
  columns: string[];
  rows: (string | number | null)[][];
}

export interface ChartSeries {
  name: string;
  data: number[];
}

export interface ChartBlock {
  type: "chart";
  chartType: "line" | "bar" | "pie";
  categories: string[];
  series: ChartSeries[];
}

export interface KpiBlock {
  type: "kpi";
  label: string;
  value: string;
  trend?: "up" | "down" | "flat";
}

export interface CardBlock {
  type: "card";
  title: string;
  fields: Record<string, string>;
}

export interface FileBlock {
  type: "file";
  name: string;
  url: string;
}

export interface ImageBlock {
  type: "image";
  url: string;
  caption?: string;
}

export type ResponseBlock =
  | TextBlock
  | TableBlock
  | ChartBlock
  | KpiBlock
  | CardBlock
  | FileBlock
  | ImageBlock;

export interface ChatUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  totalTokens: number;
  turns: number;
}

export interface ChatResponseEnvelope {
  type: "composite";
  blocks: ResponseBlock[];
  usage?: ChatUsage;
}
