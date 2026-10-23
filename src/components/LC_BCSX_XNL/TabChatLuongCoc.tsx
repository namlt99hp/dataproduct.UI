import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Button, Empty, InputNumber, Select, Spin, Typography, message } from "antd";
import {
  LcChatLuongCocApi,
  SO_LAN_CHAT_LUONG_COC,
  type ChatLuongCocDanhMuc,
} from "../../services/LcChatLuongCocApi";

/**
 * Vùng "Chất lượng cốc trong ca" — bố cục như biểu mẫu gốc: mỗi chỉ tiêu còn hoạt động (W, Ak, V,
 * Ccd, M40, M10, CSR, CRI) là 1 nhóm cột chia theo Loại (chỉ tiêu không phân loại chỉ có Loại 1),
 * hàng "Giá trị TCNB" hiện giá trị của từng loại, các hàng "Giá trị phân tích trong ca (lần n)" —
 * mỗi chỉ tiêu 1 ô mỗi lần đo (gộp ngang qua các cột Loại) — và hàng "Đánh giá".
 *
 * Chỉ hiển thị/nhập liệu, KHÔNG tự đánh giá đạt/không đạt: giá trị lần đo và "Đánh giá" đều do
 * người dùng nhập (đánh giá lưu vào cột DatYeuCau). Dữ liệu lưu ở bảng quan hệ riêng
 * (LcChatLuongCocApi), không qua DataJson của phiếu.
 */

export interface ChatLuongCocRow {
  key?: string | number;
  chiTieuId: number;
  lan1?: string | number | null;
  lan2?: string | number | null;
  lan3?: string | number | null;
  lan4?: string | number | null;
  lan5?: string | number | null;
  lan6?: string | number | null;
  /** "Đánh giá" người dùng chọn: true = Đạt, false = Không đạt, null/undefined = chưa đánh giá */
  danhGia?: boolean | null;
}

interface TabChatLuongCocProps {
  editable: boolean;
  rows: ChatLuongCocRow[];
  onChange: (rows: ChatLuongCocRow[]) => void;
}

const LAN_FIELDS = ["lan1", "lan2", "lan3", "lan4", "lan5", "lan6"] as const;
type LanField = (typeof LAN_FIELDS)[number];

/** Biểu mẫu gốc có sẵn 2 hàng lần đo */
const SO_LAN_MAC_DINH = 2;

// antd Select không nhận value boolean → dùng chuỗi, đổi qua lại với danhGia (true/false)
const DANH_GIA_OPTIONS = [
  { label: "Đạt", value: "dat" },
  { label: "Không đạt", value: "khongDat" },
];

const cell: CSSProperties = { border: "1px solid #d9d9d9", padding: "4px 8px", textAlign: "center" };
const head: CSSProperties = { ...cell, fontWeight: 600, background: "#fafafa" };

const toNum = (v: string | number | null | undefined): number | null =>
  v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null;

const TabChatLuongCoc = ({ editable, rows, onChange }: TabChatLuongCocProps) => {
  const [danhMuc, setDanhMuc] = useState<ChatLuongCocDanhMuc>({ chiTieu: [], tcnb: [] });
  const [loading, setLoading] = useState(false);
  const [soLan, setSoLan] = useState(SO_LAN_MAC_DINH);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    LcChatLuongCocApi.getDanhMuc()
      .then((res) => !cancelled && setDanhMuc(res))
      .catch(() => message.error("Không tải được danh mục chỉ tiêu chất lượng cốc"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Bổ sung dòng còn thiếu cho mỗi chỉ tiêu khi danh mục tải xong (hoặc khi phiếu nạp lại dữ liệu đã lưu)
  useEffect(() => {
    if (!danhMuc.chiTieu.length) return;
    const missing = danhMuc.chiTieu.filter((c) => !rows.some((r) => r.chiTieuId === c.id));
    if (missing.length) {
      onChange([...rows, ...missing.map((c) => ({ key: `ct-${c.id}`, chiTieuId: c.id }))]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [danhMuc.chiTieu, rows]);

  // Số hàng lần đo hiển thị: tối thiểu 2, mở rộng theo lần cao nhất đã có dữ liệu
  useEffect(() => {
    const maxLan = rows.reduce((m, r) => {
      const idx = LAN_FIELDS.reduce((acc, f, i) => (toNum(r[f]) !== null ? i + 1 : acc), 0);
      return Math.max(m, idx);
    }, 0);
    if (maxLan > soLan) setSoLan(maxLan);
  }, [rows, soLan]);

  const nhom = useMemo(
    () =>
      danhMuc.chiTieu.map((c) => ({
        chiTieu: c,
        nguong: danhMuc.tcnb.filter((t) => t.chiTieuId === c.id).sort((a, b) => a.loai - b.loai),
      })),
    [danhMuc]
  );

  const rowOf = (chiTieuId: number) => rows.find((r) => r.chiTieuId === chiTieuId);

  const patch = (chiTieuId: number, change: Partial<ChatLuongCocRow>) =>
    onChange(rows.map((r) => (r.chiTieuId === chiTieuId ? { ...r, ...change } : r)));

  if (loading && !nhom.length) return <Spin />;
  if (!nhom.length) {
    return <Empty description="Chưa có danh mục chỉ tiêu chất lượng cốc" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  // Số cột con (Loại) của 1 chỉ tiêu; chưa có TCNB thì vẫn chừa 1 cột
  const spanOf = (n: (typeof nhom)[number]) => Math.max(n.nguong.length, 1);

  return (
    <div>
      <Typography.Text strong style={{ display: "block", marginBottom: 6 }}>
        1. Chất lượng cốc trong ca
      </Typography.Text>

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1100 }}>
          <tbody>
            <tr>
              <th style={head}>Chỉ tiêu</th>
              {nhom.map((n) => (
                <th key={n.chiTieu.id} style={head} colSpan={spanOf(n)}>
                  {n.chiTieu.ten}
                  {n.chiTieu.donVi ? ` (${n.chiTieu.donVi})` : ""}
                </th>
              ))}
            </tr>
            <tr>
              {/* Nhãn "Giá trị TCNB" gộp dọc qua cả hàng Loại và hàng giá trị, như biểu mẫu gốc */}
              <th style={head} rowSpan={2}>
                Giá trị TCNB
              </th>
              {nhom.flatMap((n) =>
                n.nguong.length
                  ? n.nguong.map((t) => (
                      <th key={`${n.chiTieu.id}-${t.loai}`} style={head}>
                        Loại {t.loai}
                      </th>
                    ))
                  : [<th key={`${n.chiTieu.id}-x`} style={head} />]
              )}
            </tr>
            <tr>
              {nhom.flatMap((n) =>
                n.nguong.length
                  ? n.nguong.map((t) => (
                      <td key={`${n.chiTieu.id}-${t.loai}`} style={cell}>
                        {t.giaTriTCNB ?? ""}
                      </td>
                    ))
                  : [<td key={`${n.chiTieu.id}-x`} style={cell} />]
              )}
            </tr>
            {Array.from({ length: soLan }, (_, i) => {
              const field: LanField = LAN_FIELDS[i];
              return (
                <tr key={i}>
                  <th style={head}>Giá trị phân tích trong ca (lần {i + 1})</th>
                  {nhom.map((n) => {
                    const val = toNum(rowOf(n.chiTieu.id)?.[field]);
                    return (
                      <td key={n.chiTieu.id} style={cell} colSpan={spanOf(n)}>
                        {editable ? (
                          <InputNumber
                            size="small"
                            min={0}
                            max={9999.99}
                            precision={2}
                            value={val}
                            onChange={(v) => patch(n.chiTieu.id, { [field]: v })}
                            style={{ width: 110 }}
                          />
                        ) : (
                          (val ?? "")
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr>
              <th style={head}>Đánh giá</th>
              {nhom.map((n) => {
                const danhGia = rowOf(n.chiTieu.id)?.danhGia ?? null;
                return (
                  <td key={n.chiTieu.id} style={cell} colSpan={spanOf(n)}>
                    {editable ? (
                      <Select<string>
                        size="small"
                        allowClear
                        placeholder="Đánh giá"
                        options={DANH_GIA_OPTIONS}
                        value={danhGia === null ? undefined : danhGia ? "dat" : "khongDat"}
                        onChange={(v) => patch(n.chiTieu.id, { danhGia: v === undefined ? null : v === "dat" })}
                        style={{ width: 120 }}
                      />
                    ) : danhGia === null ? (
                      ""
                    ) : danhGia ? (
                      "Đạt"
                    ) : (
                      "Không đạt"
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {editable && soLan < SO_LAN_CHAT_LUONG_COC && (
        <Button size="small" style={{ marginTop: 8 }} onClick={() => setSoLan((s) => s + 1)}>
          + Thêm lần đo
        </Button>
      )}
    </div>
  );
};

export default TabChatLuongCoc;
