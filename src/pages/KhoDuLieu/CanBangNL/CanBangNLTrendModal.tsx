import { Empty, Modal, Radio, Space, Spin, Tag } from "antd";
import { useEffect, useState } from "react";
import { canBangNLApi, isDat, type CanBangNLFilter, type MaterialBalance, type TrendPoint } from "../../../services/CanBangNLApi";

type Props = {
  open: boolean;
  onClose: () => void;
  filter: CanBangNLFilter;
  mat: MaterialBalance;
};

const W = 960;
const H = 340;
const PAD = { top: 20, right: 24, bottom: 56, left: 48 };

const fmt = (v: number, d = 3) =>
  v.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Biểu đồ đường Loss rate (%) theo ngày/ca, có vạch ngưỡng tiêu chuẩn. Vẽ bằng SVG — không cần thư viện chart. */
const LossRateChart = ({ data, mat }: { data: TrendPoint[]; mat: MaterialBalance }) => {
  const threshold = mat.standardLossRate;
  const ok = (v: number) => isDat(v, mat);
  const [hover, setHover] = useState<number | null>(null);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const values = data.flatMap((p) => (p.lossRate === null ? [] : [p.lossRate]));
  const yMax = Math.ceil(Math.max(threshold * 1.5, ...values) + 0.5);
  const yMin = Math.min(0, Math.floor(Math.min(...values)));
  const x = (i: number) => PAD.left + (data.length === 1 ? innerW / 2 : (i * innerW) / (data.length - 1));
  const y = (v: number) => PAD.top + ((yMax - v) / (yMax - yMin)) * innerH;

  const ticks: number[] = [];
  for (let t = yMin; t <= yMax; t += yMax - yMin > 6 ? 2 : 1) ticks.push(t);
  const labelStep = Math.max(1, Math.ceil(data.length / 14));
  // Điểm không có loss rate (Generator = 0) → ngắt đường
  const path = data
    .map((p, i) => (p.lossRate === null ? null : `${i && data[i - 1].lossRate !== null ? "L" : "M"}${x(i)},${y(p.lossRate)}`))
    .filter(Boolean)
    .join(" ");

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#f0f0f0" />
            <text x={PAD.left - 8} y={y(t) + 4} fontSize={11} textAnchor="end" fill="#8c8c8c">
              {t}%
            </text>
          </g>
        ))}

        {/* Ngưỡng tiêu chuẩn */}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(threshold)}
          y2={y(threshold)}
          stroke="#ff4d4f"
          strokeDasharray="6 4"
        />
        <text x={W - PAD.right} y={y(threshold) - 6} fontSize={11} textAnchor="end" fill="#ff4d4f">
          Ngưỡng {threshold}%
        </text>

        <path d={path} fill="none" stroke="#1677ff" strokeWidth={2} />

        {data.map((p, i) => (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <rect x={x(i) - innerW / data.length / 2} y={PAD.top} width={innerW / data.length} height={innerH} fill="transparent" />
            {p.lossRate !== null && (
              <circle
                cx={x(i)}
                cy={y(p.lossRate)}
                r={hover === i ? 5 : 3.5}
                fill={ok(p.lossRate) ? "#1677ff" : "#ff4d4f"}
                stroke="#fff"
                strokeWidth={1.5}
              />
            )}
            {i % labelStep === 0 && (
              <text
                x={x(i)}
                y={H - PAD.bottom + 16}
                fontSize={11}
                fill="#595959"
                textAnchor="end"
                transform={`rotate(-35 ${x(i)} ${H - PAD.bottom + 16})`}
              >
                {p.label}
              </text>
            )}
          </g>
        ))}
        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="#bfbfbf" strokeDasharray="3 3" />
        )}
      </svg>

      {hover !== null && (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: `${(x(hover) / W) * 100}%`,
            transform: x(hover) > W / 2 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
            background: "#fff",
            border: "1px solid #d9d9d9",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 12,
            boxShadow: "0 2px 8px rgba(0,0,0,.12)",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          <b>{data[hover].label}</b>
          <div>Generator: {fmt(data[hover].generator)}</div>
          <div>Consumer: {fmt(data[hover].consumer)}</div>
          <div>
            Loss rate:{" "}
            {data[hover].lossRate === null ? (
              <b>— (không có Generator)</b>
            ) : (
              <b style={{ color: ok(data[hover].lossRate!) ? "#1677ff" : "#ff4d4f" }}>
                {fmt(data[hover].lossRate!, 2)}%
              </b>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const CanBangNLTrendModal = ({ open, onClose, filter, mat }: Props) => {
  const [soNgay, setSoNgay] = useState(7);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TrendPoint[]>([]);
  const material = mat.material;

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    canBangNLApi
      .getTrend({ ...filter, material: mat.key, soNgay })
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [open, filter, mat.key, soNgay]);

  const coDuLieu = data.filter((p) => p.lossRate !== null);
  const soDat = coDuLieu.filter((p) => isDat(p.lossRate!, mat)).length;
  const soKhongDat = coDuLieu.length - soDat;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={1040}
      title={`Biểu đồ trend Loss rate — ${material}`}
      destroyOnClose
    >
      <Space style={{ marginBottom: 12, width: "100%", justifyContent: "space-between" }} wrap>
        <Radio.Group value={soNgay} onChange={(e) => setSoNgay(e.target.value)} optionType="button" buttonStyle="solid">
          <Radio.Button value={7}>7 ngày</Radio.Button>
          <Radio.Button value={15}>15 ngày</Radio.Button>
          <Radio.Button value={30}>30 ngày</Radio.Button>
        </Radio.Group>
        {data.length > 0 && (
          <Space>
            <Tag color="blue">Đạt: {soDat}</Tag>
            <Tag color="red">Không đạt: {soKhongDat}</Tag>
            {data.length > coDuLieu.length && <Tag>Không có Generator: {data.length - coDuLieu.length}</Tag>}
          </Space>
        )}
      </Space>
      <Spin spinning={loading}>
        {coDuLieu.length ? (
          <LossRateChart data={data} mat={mat} />
        ) : (
          <Empty style={{ padding: 48 }} description="Chưa có dữ liệu" />
        )}
      </Spin>
    </Modal>
  );
};

export default CanBangNLTrendModal;
