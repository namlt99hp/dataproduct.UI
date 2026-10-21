import { useEffect, type CSSProperties } from "react";
import { Input, InputNumber, Typography } from "antd";

/**
 * Vùng "Phân tích" — LC_01_PhanTich_ThietKe_TP1_TP2.md mục 2.2 Vùng 5
 * (cỡ hạt than sau nghiền 2, độ ẩm than phối trộn — tối đa 6 lần đo mỗi ca).
 * Mỗi chỉ tiêu 1 dòng với Lần 1..Lần 6 — khớp bảng LC_TP_KetQuaPhanTichThan
 * (ChiTieu, Lan1..Lan6 DECIMAL(6,2), GhiChu). PhieuCaId và Scope lấy từ phiếu/header.
 */

export const SO_LAN_PHAN_TICH = 6;
const LAN_FIELDS = ["lan1", "lan2", "lan3", "lan4", "lan5", "lan6"] as const;
type LanField = (typeof LAN_FIELDS)[number];

export type ChiTieuPhanTich = "CO_HAT_1MM" | "CO_HAT_3MM" | "DO_AM_PHOI_TRON";

export interface PhanTichRow {
  key?: string | number;
  chiTieu?: string | null;
  lan1?: string | number | null;
  lan2?: string | number | null;
  lan3?: string | number | null;
  lan4?: string | number | null;
  lan5?: string | number | null;
  lan6?: string | number | null;
  ghiChu?: string | null;
  /** Dữ liệu phiếu cũ (1 dòng / 1 lần đo) — chỉ để chuyển đổi khi tải */
  nhomPhanTich?: string | null;
  lanPhanTich?: string | number | null;
  giaTri?: string | number | null;
}

interface TabPhanTichProps {
  editable: boolean;
  rows: PhanTichRow[];
  onChange: (rows: PhanTichRow[]) => void;
}

/** Thứ tự cố định các chỉ tiêu: 2 cỡ hạt, rồi độ ẩm */
const CHI_TIEU_ORDER: ChiTieuPhanTich[] = ["CO_HAT_1MM", "CO_HAT_3MM", "DO_AM_PHOI_TRON"];

const cell: CSSProperties = { border: "1px solid #d9d9d9", padding: "4px 8px", textAlign: "center" };
const head: CSSProperties = { ...cell, fontWeight: 600 };

const toNum = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "" ? null : Number(v);

/** Đưa dữ liệu về đủ 1 dòng cho mỗi chỉ tiêu; gộp dữ liệu dạng cũ (nhomPhanTich/lanPhanTich/giaTri) */
function normalize(rows: PhanTichRow[]): PhanTichRow[] {
  return CHI_TIEU_ORDER.map((chiTieu) => {
    const current: PhanTichRow = {
      ...(rows.find((r) => r.chiTieu === chiTieu) ?? { key: chiTieu, chiTieu }),
    };
    rows
      .filter((r) => r.nhomPhanTich === chiTieu)
      .forEach((legacy) => {
        const lan = Number(legacy.lanPhanTich);
        if (lan >= 1 && lan <= SO_LAN_PHAN_TICH) {
          const field = LAN_FIELDS[lan - 1];
          if (toNum(current[field]) === null) current[field] = legacy.giaTri ?? null;
        }
      });
    return current;
  });
}

const needsNormalize = (rows: PhanTichRow[]) =>
  rows.length !== CHI_TIEU_ORDER.length ||
  rows.some((r, i) => r.chiTieu !== CHI_TIEU_ORDER[i] || r.nhomPhanTich);

const TabPhanTich = ({ editable, rows, onChange }: TabPhanTichProps) => {
  // Luôn đủ các dòng chỉ tiêu cố định, đúng thứ tự
  useEffect(() => {
    if (needsNormalize(rows)) onChange(normalize(rows));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const patch = (chiTieu: ChiTieuPhanTich, field: LanField, value: number | null) =>
    onChange(rows.map((r) => (r.chiTieu === chiTieu ? { ...r, [field]: value } : r)));

  // Ghi chú chung của vùng: 1 ô gộp dọc, lưu ở dòng chỉ tiêu đầu tiên (cột GhiChu)
  const ghiChu = rows.find((r) => r.chiTieu === CHI_TIEU_ORDER[0])?.ghiChu ?? "";
  const patchGhiChu = (value: string) =>
    onChange(rows.map((r) => (r.chiTieu === CHI_TIEU_ORDER[0] ? { ...r, ghiChu: value } : r)));

  const renderInputs = (chiTieu: ChiTieuPhanTich) =>
    LAN_FIELDS.map((field) => {
      const value = toNum(rows.find((r) => r.chiTieu === chiTieu)?.[field]);
      return (
        <td key={field} style={cell}>
          {editable ? (
            <InputNumber
              size="small"
              min={0}
              max={9999.99}
              precision={2}
              value={value}
              onChange={(val) => patch(chiTieu, field, val)}
              style={{ width: "100%" }}
            />
          ) : (
            value ?? ""
          )}
        </td>
      );
    });

  const renderLanHeader = () =>
    LAN_FIELDS.map((_, i) => (
      <th key={i} style={head}>
        Lần {i + 1}
      </th>
    ));

  return (
    <div>
      <Typography.Text type="secondary">
        TP1: nhập tay trực tiếp. TP2: lấy từ BKMIS (ghi "(BKM)" trên biểu mẫu gốc) — tạm nhập tay cho tới
        khi tích hợp (xem LC_02_Prompt_Vibecoding_V5.md mục 2.4).
      </Typography.Text>

      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 900, tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 200 }} />
            <col style={{ width: 90 }} />
            {LAN_FIELDS.map((f) => (
              <col key={f} />
            ))}
            <col style={{ width: 160 }} />
          </colgroup>
          <tbody>
            {/* Cỡ hạt than sau nghiền 2 */}
            <tr>
              <th style={head} rowSpan={3}>
                Cỡ hạt than sau nghiền 2:
              </th>
              <th style={head}>Cỡ hạt</th>
              {renderLanHeader()}
              <td style={{ ...cell, textAlign: "left", verticalAlign: "top" }} rowSpan={5}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Ghi chú:</div>
                {editable ? (
                  <Input.TextArea
                    value={ghiChu}
                    maxLength={200}
                    autoSize={{ minRows: 4, maxRows: 10 }}
                    placeholder="Nhập ghi chú"
                    onChange={(e) => patchGhiChu(e.target.value)}
                  />
                ) : (
                  <span style={{ whiteSpace: "pre-wrap" }}>{ghiChu}</span>
                )}
              </td>
            </tr>
            <tr>
              <td style={cell}>≤1mm</td>
              {renderInputs("CO_HAT_1MM")}
            </tr>
            <tr>
              <td style={cell}>≤3mm</td>
              {renderInputs("CO_HAT_3MM")}
            </tr>

            {/* Độ ẩm than phối trộn */}
            <tr>
              <th style={head} rowSpan={2}>
                Độ ẩm than phối trộn
              </th>
              <th style={head}>W</th>
              {renderLanHeader()}
            </tr>
            <tr>
              <td style={cell}>%</td>
              {renderInputs("DO_AM_PHOI_TRON")}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TabPhanTich;
