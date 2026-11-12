import { useEffect, useMemo, useState } from "react";
import { Button, Empty, Spin, Typography, message } from "antd";
import {
  LcChatLuongCocApi,
  SO_LAN_CHAT_LUONG_COC,
  type ChatLuongCocDanhMuc,
  type CoHatCocRow,
} from "../../services/LcChatLuongCocApi";
import { NumberCell, SelectCell, TextCell } from "./LcExcelGridCells";
import type { ThanhPham } from "./lcTabsConfig";

/**
 * Tab "Cỡ hạt / Chất lượng cốc" — 2 mục loại trừ nhau theo Scope (xem PhanTichLayout.md dòng
 * 52/76): TP1 có "4. Cỡ hạt cốc trong ca" (CoHatCocSection), TP2 có "1. Chất lượng cốc trong ca"
 * (ChatLuongCocSection). KHÔNG dùng chung — phát hiện 2026-11-11: trước đó component này chỉ
 * code đúng phần Chất lượng cốc (TP2) nhưng lại hiện cho cả TP1 (TP1.xlsx không có mục đó).
 */

export type { CoHatCocRow };

interface TabChatLuongCocProps {
  thanhPham: ThanhPham | null | undefined;
  editable: boolean;
  rows: ChatLuongCocRow[];
  onChange: (rows: ChatLuongCocRow[]) => void;
  coHatCocRows: CoHatCocRow[];
  onCoHatCocChange: (rows: CoHatCocRow[]) => void;
}

const th = "border border-gray-300 px-2 py-1 text-center font-medium text-gray-700 bg-gray-50";
const td = "border border-gray-300 px-2 py-1 text-center";
const tdInput = "border border-gray-300 p-0 text-center";

const toNum = (v: string | number | null | undefined): number | null =>
  v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null;

const fmt = (v: string | number | null | undefined) => {
  const n = toNum(v);
  return n === null ? "" : n.toLocaleString("en-US", { maximumFractionDigits: 2 });
};

const TabChatLuongCoc = (props: TabChatLuongCocProps) =>
  props.thanhPham === "TP1" ? (
    <CoHatCocSection
      editable={props.editable}
      rows={props.coHatCocRows}
      onChange={props.onCoHatCocChange}
    />
  ) : (
    <ChatLuongCocSection editable={props.editable} rows={props.rows} onChange={props.onChange} />
  );

/* ============================================================================
 * "1. Chất lượng cốc trong ca" (TP2 only) — bố cục như biểu mẫu gốc: mỗi chỉ tiêu còn hoạt động
 * (W, Ak, V, Ccd, M40, M10, CSR, CRI) là 1 nhóm cột chia theo Loại (chỉ tiêu không phân loại chỉ
 * có Loại 1), hàng "Giá trị TCNB" hiện giá trị của từng loại, các hàng "Giá trị phân tích trong
 * ca (lần n)" — mỗi chỉ tiêu 1 ô mỗi lần đo (gộp ngang qua các cột Loại) — và hàng "Đánh giá".
 *
 * Chỉ hiển thị/nhập liệu, KHÔNG tự đánh giá đạt/không đạt: giá trị lần đo và "Đánh giá" đều do
 * người dùng nhập (đánh giá lưu vào cột DatYeuCau). Dữ liệu lưu ở bảng quan hệ riêng
 * (LcChatLuongCocApi), không qua DataJson của phiếu.
 *
 * UI dạng "ô Excel" (table HTML + Tailwind + NumberCell/SelectCell từ LcExcelGridCells.tsx),
 * đúng convention đã áp dụng cho các tab khác của module (xem TabTieuHao.tsx/TabThapPheu.tsx).
 * ============================================================================ */

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

const LAN_FIELDS = ["lan1", "lan2", "lan3", "lan4", "lan5", "lan6"] as const;
type LanField = (typeof LAN_FIELDS)[number];

/** Biểu mẫu gốc có sẵn 2 hàng lần đo */
const SO_LAN_MAC_DINH = 2;

// <select> HTML không nhận value boolean → dùng chuỗi, đổi qua lại với danhGia (true/false)
const DANH_GIA_OPTIONS: { label: string; value: "dat" | "khongDat" }[] = [
  { label: "Đạt", value: "dat" },
  { label: "Không đạt", value: "khongDat" },
];

const ChatLuongCocSection = ({
  editable,
  rows,
  onChange,
}: {
  editable: boolean;
  rows: ChatLuongCocRow[];
  onChange: (rows: ChatLuongCocRow[]) => void;
}) => {
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

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] border-collapse text-xs">
          <tbody>
            <tr>
              <th className={th}>Chỉ tiêu</th>
              {nhom.map((n) => (
                <th key={n.chiTieu.id} className={th} colSpan={spanOf(n)}>
                  {n.chiTieu.ten}
                  {n.chiTieu.donVi ? ` (${n.chiTieu.donVi})` : ""}
                </th>
              ))}
            </tr>
            <tr>
              {/* Nhãn "Giá trị TCNB" gộp dọc qua cả hàng Loại và hàng giá trị, như biểu mẫu gốc */}
              <th className={th} rowSpan={2}>
                Giá trị TCNB
              </th>
              {nhom.flatMap((n) =>
                n.nguong.length
                  ? n.nguong.map((t) => (
                      <th key={`${n.chiTieu.id}-${t.loai}`} className={th}>
                        Loại {t.loai}
                      </th>
                    ))
                  : [<th key={`${n.chiTieu.id}-x`} className={th} />]
              )}
            </tr>
            <tr>
              {nhom.flatMap((n) =>
                n.nguong.length
                  ? n.nguong.map((t) => (
                      <td key={`${n.chiTieu.id}-${t.loai}`} className={td}>
                        {t.giaTriTCNB ?? ""}
                      </td>
                    ))
                  : [<td key={`${n.chiTieu.id}-x`} className={td} />]
              )}
            </tr>
            {Array.from({ length: soLan }, (_, i) => {
              const field: LanField = LAN_FIELDS[i];
              return (
                <tr key={i}>
                  <th className={th}>Giá trị phân tích trong ca (lần {i + 1})</th>
                  {nhom.map((n) => {
                    const val = toNum(rowOf(n.chiTieu.id)?.[field]);
                    return (
                      <td key={n.chiTieu.id} className={editable ? tdInput : td} colSpan={spanOf(n)}>
                        {editable ? (
                          <NumberCell value={val} step={0.01} onCommit={(v) => patch(n.chiTieu.id, { [field]: v })} />
                        ) : (
                          fmt(val)
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr>
              <th className={th}>Đánh giá</th>
              {nhom.map((n) => {
                const danhGia = rowOf(n.chiTieu.id)?.danhGia ?? null;
                return (
                  <td key={n.chiTieu.id} className={editable ? tdInput : td} colSpan={spanOf(n)}>
                    {editable ? (
                      <SelectCell<"dat" | "khongDat">
                        value={danhGia === null ? null : danhGia ? "dat" : "khongDat"}
                        options={DANH_GIA_OPTIONS}
                        placeholder="Đánh giá"
                        onCommit={(v) => patch(n.chiTieu.id, { danhGia: v === null ? null : v === "dat" })}
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

/* ============================================================================
 * "4. Cỡ hạt cốc trong ca" (TP1 only, xem TP1.xlsx dòng 359-363) — N dòng/phiếu, mỗi dòng = 1
 * lần lấy mẫu: 5 cột % theo cỡ hạt (giữ đúng tên khoảng của Excel, "25-80mm" và "40-80mm" chồng
 * khoảng — không tự sửa) + Thời gian/Vị trí lấy mẫu. Không lũy kế/tồn đầu, không danh mục —
 * người dùng tự thêm/xoá dòng mẫu. Lưu ở bảng quan hệ riêng LC_TP_CoHatCoc (LcCoHatCocApi),
 * không qua DataJson.
 * ============================================================================ */

const COHAT_FIELDS = [
  { key: "pctDuoi10mm", label: "<10mm" },
  { key: "pct10Den25mm", label: "10-25mm" },
  { key: "pct25Den80mm", label: "25-80mm" },
  { key: "pct40Den80mm", label: "40-80mm" },
  { key: "pctTren80mm", label: ">80mm" },
] as const;

const CoHatCocSection = ({
  editable,
  rows,
  onChange,
}: {
  editable: boolean;
  rows: CoHatCocRow[];
  onChange: (rows: CoHatCocRow[]) => void;
}) => {
  const patchRow = (index: number, change: Partial<CoHatCocRow>) =>
    onChange(rows.map((r, i) => (i === index ? { ...r, ...change } : r)));

  const addRow = () => onChange([...rows, { key: `cht-new-${Date.now()}` }]);

  const removeRow = (index: number) => onChange(rows.filter((_, i) => i !== index));

  return (
    <div>
      <Typography.Text strong style={{ display: "block", marginBottom: 6 }}>
        4. Cỡ hạt cốc trong ca
      </Typography.Text>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-xs">
          <thead>
            <tr>
              {COHAT_FIELDS.map((f) => (
                <th key={f.key} className={th}>
                  {f.label}
                </th>
              ))}
              <th className={th}>Thời gian lấy mẫu</th>
              <th className={th}>Vị trí lấy mẫu</th>
              {editable && <th className={`${th} w-[40px]`} />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className={td} colSpan={COHAT_FIELDS.length + 2 + (editable ? 1 : 0)}>
                  Chưa có lần lấy mẫu nào
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={r.key ?? i}>
                {COHAT_FIELDS.map((f) => (
                  <td key={f.key} className={editable ? tdInput : td}>
                    {editable ? (
                      <NumberCell
                        value={toNum(r[f.key])}
                        step={0.01}
                        onCommit={(v) => patchRow(i, { [f.key]: v })}
                      />
                    ) : (
                      fmt(r[f.key])
                    )}
                  </td>
                ))}
                <td className={editable ? tdInput : td}>
                  {editable ? (
                    <input
                      type="datetime-local"
                      className="w-full border-0 bg-transparent px-1 py-0.5 text-xs outline-none focus:bg-blue-50 focus:ring-1 focus:ring-blue-400"
                      value={r.thoiGianLayMau ?? ""}
                      onChange={(e) => patchRow(i, { thoiGianLayMau: e.target.value || null })}
                    />
                  ) : (
                    r.thoiGianLayMau?.replace("T", " ") ?? ""
                  )}
                </td>
                <td className={editable ? tdInput : td}>
                  {editable ? (
                    <TextCell
                      value={r.viTriLayMau ?? null}
                      onCommit={(v) => patchRow(i, { viTriLayMau: v })}
                    />
                  ) : (
                    r.viTriLayMau ?? ""
                  )}
                </td>
                {editable && (
                  <td className={td}>
                    <button
                      type="button"
                      className="text-gray-400 hover:text-red-500"
                      onClick={() => removeRow(i)}
                    >
                      ×
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editable && (
        <Button size="small" style={{ marginTop: 8 }} onClick={addRow}>
          + Thêm lần lấy mẫu
        </Button>
      )}
    </div>
  );
};

export default TabChatLuongCoc;
