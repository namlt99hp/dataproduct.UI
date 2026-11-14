import { useEffect, useMemo } from "react";
import { Button, Typography } from "antd";
import { NumberCell, TextCell } from "./LcExcelGridCells";
import type { ThanhPham } from "./lcTabsConfig";

/**
 * Tab "Nhân sự / Sự cố" — đặt ĐẦU TIÊN trong LC_BCSX_XNL_TABS (2026-11-12, theo yêu cầu người
 * dùng). Gộp 4 vùng của Excel gốc vào 1 tab UI (dispatcher theo Scope, cùng pattern với
 * TabChatLuongCoc.tsx):
 * - A. Tình hình nhân sự — layout khác hẳn giữa TP1 (1 đoạn văn tự do) và TP2 (bảng 4 dòng
 *   theo Tổ/Nhóm). ĐẢO NGƯỢC quyết định cũ "không làm tab/bảng nhân sự" ở
 *   LC_02_Prompt_Vibecoding_V5.md dòng 27 — xem [[lc-bcsx-xnl-chatluongcoc-cohatcoc-design]] cho
 *   pattern branch-by-scope tương tự.
 * - Sự cố — dùng chung TP1/TP2 (TP1 Excel chỉ có 1 cột "Thời gian" chung, nhưng theo chốt
 *   người dùng 2026-11-12 vẫn giữ nguyên 3 cột thời gian hiện có, TP1 chỉ cần điền 1).
 * - Vệ sinh 5S / Công việc bàn giao — CHỈ TP1 (TP2 không có 2 mục này, xác nhận trực tiếp từ
 *   TP2.xlsx — trả lời OQ-14). N dòng rời (Stt + Nội dung), KHÁC layout Excel gốc (1 cell
 *   free-text) — chốt theo yêu cầu người dùng, ưu tiên dễ mở rộng. Thay cho placeholder tab
 *   riêng "ghiChuCa" (đã bỏ khỏi lcTabsConfig.ts).
 *
 * Lưu ở 3 bảng quan hệ riêng (LC_TP_NhanSu/LC_TP_SuCoTrongCa/LC_TP_GhiChuCa) qua
 * LcNhanSuSuCoApi — KHÔNG qua DataJson của phiếu (xem LC_ThanhPhamController mục 5/8/9).
 *
 * SỬA 2026-11-13: bỏ hẳn `CustomFormTable`/AntD `DatePicker` ở 2 bảng N-dòng-rời (Sự cố, 5S/Bàn
 * giao) — chuyển sang `<table>` HTML + Tailwind + `TextCell`/input `datetime-local` thường, đúng
 * convention "ô Excel" đã áp cho TabCapLieuSilo.tsx/TabChatLuongCoc.tsx (CoHatCocSection là mẫu
 * N-dòng-rời gần nhất).
 *
 * SỬA 2026-11-13 (sau khi đọc trực tiếp TP1.xlsx có dữ liệu thật — kíp 2B 21/09/2026): đoạn văn
 * tự do "A. Tình hình nhân sự" ở TP1 thực ra LUÔN đúng 5 tổ/nhóm cố định, mỗi dòng theo khuôn
 * "<SL hiện có>/<SL định biên> - Vắng: Tên (LýDo), ...". Đổi textarea tự do → bảng 5 dòng cố định
 * (CÙNG shape với bảng TP2, tái dùng đúng 4 cột đã có của `LC_TP_NhanSu`: TenToNhom/
 * SoLuongDinhBien/SoLuongHienCoDinhBien/DienGiai — cột DienGiai dùng làm "Vắng" ở TP1), 2 cột số
 * lượng dùng `NumberCell` (hạn chế nhập đúng kiểu) thay `TextCell`. TP2 cũng đổi 3 cột số lượng
 * sang `NumberCell` theo cùng lý do (giá trị "x/y" của TP1 thực ra là 2 số riêng, không phải 1
 * chuỗi tỉ lệ — gỡ bỏ giả định "chưa xác nhận số thuần hay chuỗi" ở STATE.md). Cột `NoiDungTuDo`
 * (DB/BE không đổi) không còn dùng ở FE, giữ nguyên ở model/DTO cho khỏi phải đổi BE.
 */

const th = "border border-gray-300 px-2 py-1 text-center font-medium text-gray-700 bg-gray-50";
const td = "border border-gray-300 px-2 py-1 text-center";
const tdInput = "border border-gray-300 p-0 text-center";
const dateTimeInputClass =
  "w-full border-0 bg-transparent px-1 py-0.5 text-xs outline-none focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 disabled:bg-transparent disabled:text-gray-500";

export interface SuCoRow {
  key?: string | number;
  tinhTrangSuCo?: string | null;
  thoiGianPhatHien?: string | null;
  cachKhacPhuc?: string | null;
  thoiGianBatDau?: string | null;
  thoiGianKetThuc?: string | null;
  nhanLuc?: string | null;
}

export interface NhanSuRow {
  key?: string | number;
  /** TP2 only — tên tổ/nhóm cố định, dùng làm khoá match dòng. */
  tenToNhom?: string | null;
  soLuongDinhBien?: string | null;
  soLuongHienCoDinhBien?: string | null;
  soLuongTrongCa?: string | null;
  dienGiai?: string | null;
  /** TP1 only — nguyên đoạn văn "Tình hình nhân sự trong kíp". */
  noiDungTuDo?: string | null;
}

export interface GhiChuCaRow {
  key?: string | number;
  loai: "5S" | "BAN_GIAO";
  noiDung?: string | null;
}

interface TabSuCoProps {
  thanhPham: ThanhPham | null | undefined;
  editable: boolean;
  nhanSu: NhanSuRow[];
  onNhanSuChange: (rows: NhanSuRow[]) => void;
  suCo: SuCoRow[];
  onSuCoChange: (rows: SuCoRow[]) => void;
  ghiChuCa: GhiChuCaRow[];
  onGhiChuCaChange: (rows: GhiChuCaRow[]) => void;
}

const TabSuCo = ({
  thanhPham,
  editable,
  nhanSu,
  onNhanSuChange,
  suCo,
  onSuCoChange,
  ghiChuCa,
  onGhiChuCaChange,
}: TabSuCoProps) => {
  return (
    <div>
      <NhanSuSection thanhPham={thanhPham} editable={editable} rows={nhanSu} onChange={onNhanSuChange} />

      <SuCoSection editable={editable} rows={suCo} onChange={onSuCoChange} />

      {thanhPham === "TP1" && (
        <>
          <GhiChuSection
            label="Vệ sinh 5S"
            loai="5S"
            editable={editable}
            rows={ghiChuCa}
            onChange={onGhiChuCaChange}
          />
          <GhiChuSection
            label="Công việc bàn giao"
            loai="BAN_GIAO"
            editable={editable}
            rows={ghiChuCa}
            onChange={onGhiChuCaChange}
          />
        </>
      )}
    </div>
  );
};

/* ============================================================================
 * "A. Tình hình nhân sự" — cùng shape bảng cho TP1/TP2 (chỉ khác bộ tổ/nhóm cố định + số cột số
 * lượng), đọc trực tiếp TP1.xlsx/TP2.xlsx xác nhận (xem SỬA 2026-11-13 ở đầu file):
 * - TP1 (TP1.xlsx dòng 7-10, 5 tổ/nhóm): SL hiện có / SL định biên / Vắng (DienGiai dùng làm cột
 *   "Vắng" — ghi "Tên (LýDo), Tên (LýDo)" tự do, chưa có danh mục Lý do).
 * - TP2 (TP2.xlsx dòng 3-8, 4 tổ/nhóm, KHÔNG có "Tổ CDQ"): SL định biên / SL hiện có-định biên /
 *   SL trong ca / Diễn giải.
 * ============================================================================ */

const NHANSU_TP1_GROUPS = ["Kíp trưởng/kíp phó", "Nhóm KTV VH", "Tổ NL", "Tổ CDQ", "Tổ TP"] as const;
const NHANSU_TP2_GROUPS = ["Trưởng/Phó kíp", "KTV Vận hành", "Tổ Nguyên liệu", "Tổ Thành phẩm"] as const;

const toNumOrNull = (v: string | null | undefined): number | null =>
  v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null;
const numToStr = (v: number | null): string | null => (v === null ? null : String(v));

const NhanSuSection = ({
  thanhPham,
  editable,
  rows,
  onChange,
}: {
  thanhPham: ThanhPham | null | undefined;
  editable: boolean;
  rows: NhanSuRow[];
  onChange: (rows: NhanSuRow[]) => void;
}) => {
  // Bổ sung đủ các dòng tổ/nhóm cố định theo Scope nếu còn thiếu (TP1: 5 dòng, TP2: 4 dòng).
  useEffect(() => {
    if (!thanhPham) return;
    const groups = thanhPham === "TP1" ? NHANSU_TP1_GROUPS : NHANSU_TP2_GROUPS;
    const missing = groups.filter((g) => !rows.some((r) => r.tenToNhom === g));
    if (missing.length) {
      onChange([...rows, ...missing.map((g) => ({ key: `ns-${g}`, tenToNhom: g }))]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thanhPham, rows]);

  const patch = (tenToNhom: string, change: Partial<NhanSuRow>) =>
    onChange(rows.map((r) => (r.tenToNhom === tenToNhom ? { ...r, ...change } : r)));

  if (thanhPham === "TP1") {
    return (
      <div>
        <Typography.Text strong style={{ display: "block", marginBottom: 6 }}>
          A. Tình hình nhân sự trong kíp
        </Typography.Text>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-xs">
            <thead>
              <tr>
                <th className={th}>Tổ/Nhóm</th>
                <th className={th}>SL hiện có</th>
                <th className={th}>SL định biên</th>
                <th className={th}>Vắng</th>
              </tr>
            </thead>
            <tbody>
              {NHANSU_TP1_GROUPS.map((g) => {
                const r = rows.find((x) => x.tenToNhom === g);
                return (
                  <tr key={g}>
                    <td className={th}>{g}</td>
                    <td className={editable ? tdInput : td}>
                      {editable ? (
                        <NumberCell
                          value={toNumOrNull(r?.soLuongHienCoDinhBien)}
                          onCommit={(v) => patch(g, { soLuongHienCoDinhBien: numToStr(v) })}
                        />
                      ) : (
                        r?.soLuongHienCoDinhBien ?? ""
                      )}
                    </td>
                    <td className={editable ? tdInput : td}>
                      {editable ? (
                        <NumberCell
                          value={toNumOrNull(r?.soLuongDinhBien)}
                          onCommit={(v) => patch(g, { soLuongDinhBien: numToStr(v) })}
                        />
                      ) : (
                        r?.soLuongDinhBien ?? ""
                      )}
                    </td>
                    <td className={editable ? tdInput : td}>
                      {editable ? (
                        <TextCell value={r?.dienGiai ?? null} onCommit={(v) => patch(g, { dienGiai: v })} />
                      ) : (
                        r?.dienGiai ?? ""
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Typography.Text strong style={{ display: "block", marginBottom: 6 }}>
        A. Tình hình nhân sự trong ca
      </Typography.Text>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] border-collapse text-xs">
          <thead>
            <tr>
              <th className={th}>Tổ/Nhóm</th>
              <th className={th}>Số lượng định biên</th>
              <th className={th}>Số lượng hiện có/định biên</th>
              <th className={th}>Số lượng trong ca</th>
              <th className={th}>Diễn giải</th>
            </tr>
          </thead>
          <tbody>
            {NHANSU_TP2_GROUPS.map((g) => {
              const r = rows.find((x) => x.tenToNhom === g);
              return (
                <tr key={g}>
                  <td className={th}>{g}</td>
                  <td className={editable ? tdInput : td}>
                    {editable ? (
                      <NumberCell
                        value={toNumOrNull(r?.soLuongDinhBien)}
                        onCommit={(v) => patch(g, { soLuongDinhBien: numToStr(v) })}
                      />
                    ) : (
                      r?.soLuongDinhBien ?? ""
                    )}
                  </td>
                  <td className={editable ? tdInput : td}>
                    {editable ? (
                      <NumberCell
                        value={toNumOrNull(r?.soLuongHienCoDinhBien)}
                        onCommit={(v) => patch(g, { soLuongHienCoDinhBien: numToStr(v) })}
                      />
                    ) : (
                      r?.soLuongHienCoDinhBien ?? ""
                    )}
                  </td>
                  <td className={editable ? tdInput : td}>
                    {editable ? (
                      <NumberCell
                        value={toNumOrNull(r?.soLuongTrongCa)}
                        onCommit={(v) => patch(g, { soLuongTrongCa: numToStr(v) })}
                      />
                    ) : (
                      r?.soLuongTrongCa ?? ""
                    )}
                  </td>
                  <td className={editable ? tdInput : td}>
                    {editable ? (
                      <TextCell value={r?.dienGiai ?? null} onCommit={(v) => patch(g, { dienGiai: v })} />
                    ) : (
                      r?.dienGiai ?? ""
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ============================================================================
 * "Sự cố" — dùng chung TP1/TP2, N dòng rời (add/remove), đúng mẫu CoHatCocSection
 * (TabChatLuongCoc.tsx): `<table>` + Tailwind + `TextCell`/input `datetime-local` thường.
 * ============================================================================ */

const SuCoSection = ({
  editable,
  rows,
  onChange,
}: {
  editable: boolean;
  rows: SuCoRow[];
  onChange: (rows: SuCoRow[]) => void;
}) => {
  const patchRow = (index: number, change: Partial<SuCoRow>) =>
    onChange(rows.map((r, i) => (i === index ? { ...r, ...change } : r)));

  const addRow = () => onChange([...rows, { key: `suco-new-${Date.now()}` }]);

  const removeRow = (index: number) => onChange(rows.filter((_, i) => i !== index));

  return (
    <div style={{ marginTop: 16 }}>
      <Typography.Text strong style={{ display: "block", marginBottom: 6 }}>
        Sự cố
      </Typography.Text>
      <div className="w-full overflow-hidden">
        <table className="w-full table-fixed border-collapse text-xs">
          <colgroup>
            <col style={{ width: "4%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: editable ? "11%" : "16%" }} />
            {editable && <col style={{ width: "5%" }} />}
          </colgroup>
          <thead>
            <tr>
              <th className={`${th} leading-tight`}>STT</th>
              <th className={`${th} leading-tight`}>Tình trạng sự cố</th>
              <th className={`${th} leading-tight`}>Thời gian phát hiện sự cố</th>
              <th className={`${th} leading-tight`}>Cách khắc phục</th>
              <th className={`${th} leading-tight`}>Thời gian bắt đầu</th>
              <th className={`${th} leading-tight`}>Thời gian kết thúc</th>
              <th className={`${th} leading-tight`}>Nhân lực</th>
              {editable && <th className={th} />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className={td} colSpan={7 + (editable ? 1 : 0)}>
                  Chưa có sự cố nào
                </td>
              </tr>
            )}
            {rows.map((r, i) => {
              const invalidKetThuc =
                !!r.thoiGianKetThuc && !!r.thoiGianBatDau && r.thoiGianKetThuc < r.thoiGianBatDau;
              return (
                <tr key={r.key ?? i}>
                  <td className={td}>{i + 1}</td>
                  <td className={editable ? tdInput : td}>
                    {editable ? (
                      <TextCell
                        value={r.tinhTrangSuCo ?? null}
                        onCommit={(v) => patchRow(i, { tinhTrangSuCo: v })}
                      />
                    ) : (
                      r.tinhTrangSuCo ?? ""
                    )}
                  </td>
                  <td className={editable ? tdInput : td}>
                    {editable ? (
                      <input
                        type="datetime-local"
                        className={dateTimeInputClass}
                        value={r.thoiGianPhatHien ?? ""}
                        onChange={(e) => patchRow(i, { thoiGianPhatHien: e.target.value || null })}
                      />
                    ) : (
                      r.thoiGianPhatHien?.replace("T", " ") ?? ""
                    )}
                  </td>
                  <td className={editable ? tdInput : td}>
                    {editable ? (
                      <TextCell
                        value={r.cachKhacPhuc ?? null}
                        onCommit={(v) => patchRow(i, { cachKhacPhuc: v })}
                      />
                    ) : (
                      r.cachKhacPhuc ?? ""
                    )}
                  </td>
                  <td className={editable ? tdInput : td}>
                    {editable ? (
                      <input
                        type="datetime-local"
                        className={dateTimeInputClass}
                        value={r.thoiGianBatDau ?? ""}
                        onChange={(e) => patchRow(i, { thoiGianBatDau: e.target.value || null })}
                      />
                    ) : (
                      r.thoiGianBatDau?.replace("T", " ") ?? ""
                    )}
                  </td>
                  <td className={`${editable ? tdInput : td} ${invalidKetThuc ? "bg-red-100" : ""}`}>
                    {editable ? (
                      <input
                        type="datetime-local"
                        className={dateTimeInputClass}
                        value={r.thoiGianKetThuc ?? ""}
                        title={invalidKetThuc ? "Thời gian kết thúc không được trước thời gian bắt đầu" : undefined}
                        onChange={(e) => patchRow(i, { thoiGianKetThuc: e.target.value || null })}
                      />
                    ) : (
                      r.thoiGianKetThuc?.replace("T", " ") ?? ""
                    )}
                  </td>
                  <td className={editable ? tdInput : td}>
                    {editable ? (
                      <TextCell value={r.nhanLuc ?? null} onCommit={(v) => patchRow(i, { nhanLuc: v })} />
                    ) : (
                      r.nhanLuc ?? ""
                    )}
                  </td>
                  {editable && (
                    <td className={td}>
                      <button type="button" className="text-gray-400 hover:text-red-500" onClick={() => removeRow(i)}>
                        ×
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editable && (
        <Button size="small" style={{ marginTop: 8 }} onClick={addRow}>
          + Thêm sự cố
        </Button>
      )}
    </div>
  );
};

/* ============================================================================
 * "Vệ sinh 5S" / "Công việc bàn giao" (TP1 only, TP1.xlsx dòng 380-396) — N dòng rời (Stt +
 * Nội dung), add/remove giống bảng Sự cố. 2 mục cùng lưu trong 1 mảng `ghiChuCa`, phân biệt
 * bằng `loai`.
 * ============================================================================ */

const GhiChuSection = ({
  label,
  loai,
  editable,
  rows,
  onChange,
}: {
  label: string;
  loai: "5S" | "BAN_GIAO";
  editable: boolean;
  rows: GhiChuCaRow[];
  onChange: (rows: GhiChuCaRow[]) => void;
}) => {
  const filtered = useMemo(() => rows.filter((r) => r.loai === loai), [rows, loai]);
  const others = useMemo(() => rows.filter((r) => r.loai !== loai), [rows, loai]);

  const patchRow = (index: number, change: Partial<GhiChuCaRow>) =>
    onChange([...others, ...filtered.map((r, i) => (i === index ? { ...r, ...change } : r))]);

  const addRow = () => onChange([...others, ...filtered, { key: `ghichu-new-${Date.now()}`, loai }]);

  const removeRow = (index: number) =>
    onChange([...others, ...filtered.filter((_, i) => i !== index)]);

  return (
    <div style={{ marginTop: 16 }}>
      <Typography.Text strong style={{ display: "block", marginBottom: 6 }}>
        {label}
      </Typography.Text>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[500px] border-collapse text-xs">
          <thead>
            <tr>
              <th className={`${th} w-[40px]`}>STT</th>
              <th className={th}>Nội dung</th>
              {editable && <th className={`${th} w-[40px]`} />}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td className={td} colSpan={2 + (editable ? 1 : 0)}>
                  Chưa có nội dung
                </td>
              </tr>
            )}
            {filtered.map((r, i) => (
              <tr key={r.key ?? i}>
                <td className={td}>{i + 1}</td>
                <td className={editable ? tdInput : td}>
                  {editable ? (
                    <TextCell value={r.noiDung ?? null} onCommit={(v) => patchRow(i, { noiDung: v })} />
                  ) : (
                    r.noiDung ?? ""
                  )}
                </td>
                {editable && (
                  <td className={td}>
                    <button type="button" className="text-gray-400 hover:text-red-500" onClick={() => removeRow(i)}>
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
          + Thêm dòng
        </Button>
      )}
    </div>
  );
};

export default TabSuCo;
