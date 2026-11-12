import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Checkbox, Divider, Input, Modal, Popconfirm, Space, Tooltip, message } from "antd";
import dayjs from "dayjs";
import { DeleteOutlined, PlusSquareOutlined, SnippetsOutlined } from "@ant-design/icons";
import type { ThanhPham } from "./lcTabsConfig";
import { buildDefaultCoHatNghien1Rows } from "./lcMockOptions";
import { VatTuAutoCompleteCell, MaLoAutoCompleteCell, useMaLoBatchCache, type VatTuMaLoCellPatch } from "./LcVatTuMaLoCells";
import { NumberCell, TextCell } from "./LcExcelGridCells";
import { LcCanTuDongApi, type CanTuDongRawLogRow } from "../../services/LcCanTuDongApi";

/**
 * Vùng "Cấp liệu & Silo" — lát cắt đầu tiên theo LC_02_Prompt_Vibecoding_V5.md mục 3.
 *
 * Layout khớp workbook thật (xem .claude/LuyenCoc/PhanTichLayout.md mục 2–3 và
 * LC_01_PhanTich_ThietKe_TP1_TP2.md mục 2.2 Vùng 2): MỘT bảng duy nhất, 1 dòng = 1 silo,
 * số dòng CỐ ĐỊNH theo thành phẩm (TP1: 16 silo, TP2: 20 silo) — không thêm/xóa dòng tự
 * do như trước đây (Excel không có nút thêm dòng ở vùng này). Có dòng "Tổng" ở cuối, và
 * bảng phụ "Cỡ hạt sau nghiền 1" (đúng 2 dòng ≤1mm/≤3mm) bên dưới.
 *
 * DB tương ứng (LC_03_Prompt_ThietKe_CSDL.md mục 3.3): #7 LC_CapLieu + #9 LC_CapLieuTonSilo —
 * ở Excel 2 bảng này gộp làm 1 theo silo nên UI cũng gộp lại cho khớp; khi có backend,
 * 1 dòng UI sẽ tách thành 1 bản ghi LC_CapLieu + 1 bản ghi LC_CapLieuTonSilo cùng SiloId.
 *
 * Các cột CALCULATED: "KL khô thực tế" (F01), "KL ẩm tồn cuối" (F05a, chỉ TP1), "KL khô tồn
 * cuối" (F01 áp lại cho KL ẩm tồn cuối + Độ ẩm silo) đều có PREVIEW tính NGAY ở FE (bắt sự
 * kiện nhập, xem các hàm *_PREVIEW bên dưới) để người dùng thấy kết quả tức thời, không phải
 * đợi Lưu. Đây là ngoại lệ tạm thời theo LC_02 mục 2.5 (cấm công thức ở frontend, công thức
 * chính thức phải ở backend qua engine) — backend vẫn LUÔN tính lại y hệt công thức khi Lưu
 * (LC_CapLieuSiloRepository.ComputeKLAmTonCuoi_TP1/ComputeKhoiLuongKhoThucTe) và bỏ qua giá
 * trị FE gửi, nên giá trị lưu/đọc lại luôn đúng dù FE preview có sai lệch tạm thời.
 * "KL ẩm tồn cuối" CHỈ tính ở TP1 — TP2 dùng công thức khác (F05b), CHƯA có, để NULL.
 * "Lũy kế", "Tồn đầu" vẫn trống theo quy ước NULL (LC_02 mục 2.7/7), chờ engine.
 *
 * SỬA 2026-11-02: cả 2 bảng (Cấp liệu & tồn silo, Cỡ hạt sau nghiền 1) KHÔNG còn dùng
 * `CustomFormTable` (component AntD DÙNG CHUNG cho ~28 file khác trong app — KHÔNG sửa component
 * đó) — thay bằng `<table>`/`<input>` HTML thường + Tailwind, dùng lại `NumberCell`/`TextCell` từ
 * LcExcelGridCells.tsx (cùng cách đã áp cho TabXuatCapCoc.tsx/TabPhoiTron.tsx). Cột "Tên than"/"Số
 * hiệu lô" vẫn giữ `VatTuAutoCompleteCell`/`MaLoAutoCompleteCell` (AntD Select autocomplete, có
 * debounce/async search riêng — không phải nguồn gây đơ, không cần đổi).
 */

export interface CapLieuRow {
  key?: string | number;
  siloSo: number;
  /** Thứ tự lớp liệu trong CÙNG 1 silo — 1 = lớp hiện tại, 2.. = lớp tách thêm (nút "Tách
   *  liệu"). Mặc định 1 nếu không set (dữ liệu cũ trước khi có tách liệu). */
  stt?: number;
  /** ID_VatTu đã chọn (PRODUCTDATA.dbo.Tbl_VatTu) — nguồn thật để lọc lô; vatLieuTen chỉ là snapshot hiển thị. */
  idVatTu?: number | null;
  vatLieuTen?: string | null;
  /** ID_MaLo đang active (PRODUCTDATA.dbo.Tbl_MaLo, qua Tbl_VatTuMaLo) — soHieuLo là snapshot hiển thị. */
  idMaLo?: number | null;
  soHieuLo?: string | null;
  khoiLuongKeHoach?: string | number | null;
  khoiLuongAmThucTe?: string | number | null;
  /** Snapshot lúc "Gán" cân tự động — NULL = chưa từng Gán. Dùng để khoá chọn lại dòng này
   *  làm đích Gán + highlight khi khoiLuongAmThucTe bị sửa tay khác giá trị này. */
  khoiLuongAmThucTeCanTuDong?: string | number | null;
  doAm?: string | number | null;
  khoiLuongKhoThucTe?: string | number | null;
  luyKeQuyKho?: string | number | null;
  tonDauKyQuyKho?: string | number | null;
  amSiloCuoiKy?: string | number | null;
  klAmTonCuoi?: string | number | null;
  doAmSilo?: string | number | null;
  klTonCuoiQuyKho?: string | number | null;
  ghiChu?: string | null;
}

export interface CoHatNghien1Row {
  key?: string | number;
  kichCo: string;
  lan1?: string | number | null;
  lan2?: string | number | null;
  lan3?: string | number | null;
  ghiChu?: string | null;
}

interface TabCapLieuSiloProps {
  thanhPham: ThanhPham | null | undefined;
  editable: boolean;
  capLieuRows: CapLieuRow[];
  onCapLieuChange: (rows: CapLieuRow[]) => void;
  coHatNghien1Rows: CoHatNghien1Row[];
  onCoHatNghien1Change: (rows: CoHatNghien1Row[]) => void;
  idPhieu?: string;
}

const getErrMsg = (err: unknown, fallback: string): string =>
  typeof err === "object" && err != null && "message" in err && typeof (err as { message?: unknown }).message === "string"
    ? (err as { message: string }).message
    : fallback;

/**
 * F01 (PREVIEW ONLY — TẠM Ở FE, KHÔNG PHẢI CÔNG THỨC CHÍNH THỨC):
 * KL khô thực tế = KL ẩm thực tế × (100 − Độ ẩm) / 100.
 * LC_02_Prompt_Vibecoding_V5.md mục 2.5 cấm đưa công thức Excel vào frontend (công thức
 * chính thức phải là lớp ICalculation ở backend, qua engine → API). Hàm này CHỈ để xem
 * trước kết quả khi chưa có engine; cần xoá/thay bằng giá trị trả về từ API khi backend
 * xong (xem [[lc-bcsx-xnl-caplieu-phoitron-plan]]).
 * NULL-behavior (LC_02 mục 2.3): thiếu 1 trong 2 input → kết quả NULL, không ép về 0.
 */
/** Các cột cho phép "Paste từ Excel" ở TabCapLieuSilo — xem GroupedTableSTD.tsx (bản gốc). */
const PASTE_COLUMNS = new Set([
  "khoiLuongKeHoach",
  "khoiLuongAmThucTe",
  "doAm",
  "amSiloCuoiKy",
  "doAmSilo",
]);

/** Các cột thuộc về SILO VẬT LÝ (bảng LC_CapLieuTonSilo, đo 1 lần/silo bằng radar) — khi 1 silo có
 *  nhiều lớp liệu (tách liệu), các cột này chỉ cho nhập ở lớp Stt=1, khoá ở các lớp còn lại
 *  (không nhân theo lớp, tránh nhập trùng/lệch 1 giá trị vật lý duy nhất). */
const TONSILO_FIELDS = new Set(["amSiloCuoiKy", "klAmTonCuoi", "doAmSilo", "klTonCuoiQuyKho"]);

function computeKhoiLuongKhoThucTe_PREVIEW(row: CapLieuRow): number | null {
  const am = row.khoiLuongAmThucTe;
  const doAm = row.doAm;
  if (am === null || am === undefined || am === "" || doAm === null || doAm === undefined || doAm === "")
    return null;
  const amNum = Number(am);
  const doAmNum = Number(doAm);
  if (!Number.isFinite(amNum) || !Number.isFinite(doAmNum)) return null;
  const result = (amNum * (100 - doAmNum)) / 100;
  return Math.round(result * 1000) / 1000;
}

/**
 * F05a (PREVIEW ONLY — xem comment đầu file) — KL ẩm tồn cuối, CHỈ TP1 (N = Âm silo cuối kíp):
 * ROUND(IF(N>13.75, ((24.5-N)/10.75)^2*165, 165+52.564*(13.75-N)), 3).
 * TP2 dùng công thức khác (F05b) — CHƯA có, trả NULL, không suy diễn từ F05a.
 */
function computeKLAmTonCuoi_PREVIEW(row: CapLieuRow, thanhPham: ThanhPham | null | undefined): number | null {
  if (thanhPham !== "TP1") return null;
  const am = row.amSiloCuoiKy;
  if (am === null || am === undefined || am === "") return null;
  const amNum = Number(am);
  if (!Number.isFinite(amNum)) return null;
  const result =
    amNum > 13.75 ? Math.pow((24.5 - amNum) / 10.75, 2) * 165 : 165 + 52.564 * (13.75 - amNum);
  return Math.round(result * 1000) / 1000;
}

/** F01 (PREVIEW ONLY) áp lại cho (KL ẩm tồn cuối, Độ ẩm silo) — ra KL khô tồn cuối. */
const toNumOrNull = (v: string | number | null | undefined): number | null =>
  v === null || v === undefined || v === "" ? null : Number(v);

const sumCapLieu = (rows: readonly CapLieuRow[], key: keyof CapLieuRow): string => {
  const total = rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
  return total ? total.toLocaleString("en-US", { maximumFractionDigits: 3 }) : "—";
};

function computeKLTonCuoiQuyKho_PREVIEW(
  klAmTonCuoi: number | null,
  doAmSilo: CapLieuRow["doAmSilo"]
): number | null {
  if (klAmTonCuoi === null || doAmSilo === null || doAmSilo === undefined || doAmSilo === "") return null;
  const doAmNum = Number(doAmSilo);
  if (!Number.isFinite(doAmNum)) return null;
  const result = (klAmTonCuoi * (100 - doAmNum)) / 100;
  return Math.round(result * 1000) / 1000;
}

const TabCapLieuSilo = ({
  thanhPham,
  editable,
  capLieuRows,
  onCapLieuChange,
  coHatNghien1Rows,
  onCoHatNghien1Change,
  idPhieu,
}: TabCapLieuSiloProps) => {
  // capLieuRows thay đổi theo mỗi phím gõ ở các ô khác (Input không kiểm soát qua state này),
  // nên dùng ref để patch nhiều field 1 lúc (than + lô) luôn đọc được dữ liệu MỚI NHẤT, không
  // phải bản đã đóng băng lúc tạo `columns`.
  const capLieuRowsRef = useRef(capLieuRows);
  useEffect(() => {
    capLieuRowsRef.current = capLieuRows;
  }, [capLieuRows]);

  const updateCapLieuRow = useCallback(
    (idx: number, patch: VatTuMaLoCellPatch) => {
      const next = capLieuRowsRef.current.map((row, i) => (i === idx ? { ...row, ...patch } : row));
      onCapLieuChange(next as CapLieuRow[]);
    },
    [onCapLieuChange]
  );

  /* ================= PASTE FROM EXCEL (clone từ GroupedTableSTD.tsx) ================= */
  const [pasteModal, setPasteModal] = useState<{
    open: boolean;
    columnKey: string;
    columnTitle: string;
  }>({ open: false, columnKey: "", columnTitle: "" });
  const [pasteText, setPasteText] = useState("");

  const handlePasteConfirm = useCallback(() => {
    const { columnKey } = pasteModal;
    const currentRows = capLieuRowsRef.current;
    const lines = pasteText
      .split("\n")
      .map((line) => line.split("\t")[0].trim())
      .filter((line, index) => line !== "" || index < currentRows.length);

    const next = currentRows.map((row, i) => {
      if (lines[i] === undefined || lines[i] === "") return row;
      const num = parseFloat(lines[i].replace(/,/g, ""));
      if (Number.isNaN(num)) return row;
      return { ...row, [columnKey]: num };
    });
    onCapLieuChange(next as CapLieuRow[]);
    setPasteModal({ open: false, columnKey: "", columnTitle: "" });
    setPasteText("");
  }, [pasteModal, pasteText, onCapLieuChange]);

  /** Title có nút "Paste từ Excel" cho các cột trong PASTE_COLUMNS (chỉ khi editable). */
  const renderPasteableTitle = useCallback(
    (rawTitle: string, dataIndex: string) => {
      if (!editable || !PASTE_COLUMNS.has(dataIndex)) return rawTitle;
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
          <span>{rawTitle}</span>
          <Button
            size="small"
            type="primary"
            ghost
            icon={<SnippetsOutlined />}
            title="Paste từ Excel"
            style={{ lineHeight: 1, padding: "0 6px" }}
            onClick={(e) => {
              e.stopPropagation();
              setPasteModal({ open: true, columnKey: dataIndex, columnTitle: rawTitle });
              setPasteText("");
            }}
          />
        </div>
      );
    },
    [editable]
  );

  // 1 request chung cho mọi idVatTu đang có trong bảng (vd lúc mở lại phiếu đã chọn sẵn
  // than ở nhiều silo) — thay cho mỗi MaLoAutoCompleteCell tự gọi API riêng (N+1).
  const { getOptions: getMaLoOptions, isLoading: isMaLoLoading } = useMaLoBatchCache(
    capLieuRows.map((r) => r.idVatTu)
  );

  // Than chỉ có đúng 1 lô đang active → tự chọn cho các dòng chưa có lô, ngay khi cache có kết quả.
  useEffect(() => {
    let changed = false;
    const next = capLieuRowsRef.current.map((row) => {
      if (row.idVatTu == null || row.idMaLo != null) return row;
      const opts = getMaLoOptions(row.idVatTu);
      if (opts.length === 1) {
        changed = true;
        return { ...row, idMaLo: opts[0].value, soHieuLo: opts[0].label };
      }
      return row;
    });
    if (changed) onCapLieuChange(next as CapLieuRow[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getMaLoOptions]);

  // Preview F01/F05a — xem comment ở các hàm *_PREVIEW. Giá trị tính ra chỉ dùng cho hiển thị
  // (bảng + dòng Tổng), KHÔNG gửi lên backend như giá trị đã chốt (backend tự tính lại y hệt
  // công thức lúc Lưu, không nhận giá trị FE gửi cho các cột CALCULATED này).
  const displayRows = useMemo(
    () =>
      capLieuRows.map((row) => {
        const klAmTonCuoi = computeKLAmTonCuoi_PREVIEW(row, thanhPham);
        return {
          ...row,
          khoiLuongKhoThucTe: computeKhoiLuongKhoThucTe_PREVIEW(row),
          klAmTonCuoi,
          klTonCuoiQuyKho: computeKLTonCuoiQuyKho_PREVIEW(klAmTonCuoi, row.doAmSilo),
        };
      }),
    [capLieuRows, thanhPham]
  );

  // Patch 1 field của 1 dòng — nguồn là `displayRows` (bản đã gộp preview F01/F05a), giữ đúng
  // hành vi cũ của CustomFormTable (initialData=displayRows, onDataChange ghi thẳng lại toàn bộ
  // mảng) — KHÔNG dùng cho cột Tên than/Số hiệu lô (vẫn qua `updateCapLieuRow`/capLieuRowsRef ở
  // trên, patch nhiều field 1 lúc theo dữ liệu THÔ, không phải bản preview).
  const updateDisplayField = useCallback(
    (idx: number, patch: Partial<CapLieuRow>) => {
      const next = displayRows.map((row, i) => (i === idx ? { ...row, ...patch } : row));
      onCapLieuChange(next);
    },
    [displayRows, onCapLieuChange]
  );
  // Excel không cho thêm/xóa SILO tự do — đảm bảo mỗi silo (1..N theo thành phẩm) luôn có
  // ÍT NHẤT 1 dòng (lớp Stt=1), giữ nguyên mọi lớp đã tách thêm (Stt>1) và dữ liệu đã nhập.
  // KHÔNG còn merge theo vị trí index như trước (index không còn đại diện cho silo nữa khi
  // có silo bị tách thành nhiều dòng) — xem handleTachLieu/handleXoaLop.
  useEffect(() => {
    if (!thanhPham) return;
    const current = capLieuRowsRef.current;
    // mảng RỖNG chỉ xảy ra trong lúc trang cha đang load phiếu (set tạm capLieu=[] trước khi
    // fetch dữ liệu thật từ API xong) — KHÔNG tự tạo skeleton lúc này, tránh race: nếu lần set
    // skeleton (không có than/lô) này đến SAU khi dữ liệu thật đã load xong, nó sẽ đè mất
    // than/lô vừa đọc đúng (bug 2026-11-11: "Lưu rồi Gán, tải lại phiếu mất Tên than/Số hiệu
    // lô" — API trả đúng dữ liệu nhưng UI hiện trống do bị effect này đè lại).
    if (current.length === 0) return;
    const expected = thanhPham === "TP2" ? 20 : 16;
    const presentSilos = new Set(current.map((r) => r.siloSo));
    const missingSilos: number[] = [];
    for (let s = 1; s <= expected; s++) if (!presentSilos.has(s)) missingSilos.push(s);
    const hasOutOfRange = current.some((r) => r.siloSo < 1 || r.siloSo > expected);
    if (missingSilos.length === 0 && !hasOutOfRange) return;

    const kept = current.filter((r) => r.siloSo >= 1 && r.siloSo <= expected);
    const additions = missingSilos.map((s) => ({ key: `silo-${s}-1`, siloSo: s, stt: 1 }));
    const merged = [...kept, ...additions].sort(
      (a, b) => a.siloSo - b.siloSo || (a.stt ?? 1) - (b.stt ?? 1)
    );
    onCapLieuChange(merged as CapLieuRow[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thanhPham, capLieuRows.length]);

  /** Thêm 1 lớp liệu mới cho silo của dòng `rowIndex`, chèn ngay sau lớp cuối cùng CÙNG silo
   *  đó (giữ các lớp của 1 silo luôn liền kề nhau trong bảng, dù không gộp ô). */
  const handleTachLieu = useCallback(
    (rowIndex: number) => {
      const current = capLieuRowsRef.current;
      const row = current[rowIndex];
      if (!row) return;
      const sameSilo = current.filter((r) => r.siloSo === row.siloSo);
      const nextStt = Math.max(...sameSilo.map((r) => r.stt ?? 1)) + 1;
      let lastIdxOfGroup = -1;
      current.forEach((r, i) => {
        if (r.siloSo === row.siloSo) lastIdxOfGroup = i;
      });
      const newRow: CapLieuRow = { key: `silo-${row.siloSo}-${nextStt}`, siloSo: row.siloSo, stt: nextStt };
      const next = [...current.slice(0, lastIdxOfGroup + 1), newRow, ...current.slice(lastIdxOfGroup + 1)];
      onCapLieuChange(next);
    },
    [onCapLieuChange]
  );

  /** Xoá 1 lớp liệu đã tách (chỉ cho xoá lớp Stt>1 — lớp Stt=1 là lớp gốc của silo, luôn giữ). */
  const handleXoaLop = useCallback(
    (rowIndex: number) => {
      const current = capLieuRowsRef.current;
      const row = current[rowIndex];
      if (!row || (row.stt ?? 1) === 1) return;
      onCapLieuChange(current.filter((_, i) => i !== rowIndex));
    },
    [onCapLieuChange]
  );

  useEffect(() => {
    if (coHatNghien1Rows.length === 2) return;
    const base = buildDefaultCoHatNghien1Rows();
    const merged = base.map((row, idx) => ({ ...row, ...coHatNghien1Rows[idx] }));
    onCoHatNghien1Change(merged as CoHatNghien1Row[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coHatNghien1Rows.length]);

  const updateCoHatField = useCallback(
    (idx: number, patch: Partial<CoHatNghien1Row>) => {
      const next = coHatNghien1Rows.map((row, i) => (i === idx ? { ...row, ...patch } : row));
      onCoHatNghien1Change(next);
    },
    [coHatNghien1Rows, onCoHatNghien1Change]
  );

  /** true nếu cột đo vật lý silo (TONSILO_FIELDS) bị khoá ở dòng này (lớp Stt>1, không phải lớp
   *  gốc của silo — xem comment TONSILO_FIELDS đầu file). */
  const isTonSiloLocked = (dataIndex: string, row: CapLieuRow) => TONSILO_FIELDS.has(dataIndex) && (row.stt ?? 1) !== 1;


  /* ================= CÂN TỰ ĐỘNG (xem [[lc-bcsx-xnl-cantudong-design]]) =================
   * Gán dữ liệu cân thô (LC_CanTuDongRawLog) vào KhoiLuongAmThucTe — ghi NGAY qua API riêng,
   * KHÔNG qua nút Lưu phiếu của tab này. Mỗi dòng Cấp liệu chỉ Gán được 1 lần (chốt thiết kế);
   * khoiLuongAmThucTe vẫn sửa/xoá tay tự do sau đó. */
  const targetKey = (row: CapLieuRow) => `${row.siloSo}-${row.stt ?? 1}`;

  const [rawLogRows, setRawLogRows] = useState<CanTuDongRawLogRow[]>([]);
  const [loadingRawLog, setLoadingRawLog] = useState(false);
  const [selectedRawLogIds, setSelectedRawLogIds] = useState<number[]>([]);
  const [selectedTargetKey, setSelectedTargetKey] = useState<string | null>(null);
  const [ganLoading, setGanLoading] = useState(false);
  const [boGanKey, setBoGanKey] = useState<string | null>(null);

  // Tự render dữ liệu cân đã sync sẵn trong LC_CanTuDongRawLog khi mở tab/phiếu — CHỈ đọc,
  // KHÔNG chạy SP đồng bộ (xem LC_CanTuDongController.GetByPhieu).
  useEffect(() => {
    if (!idPhieu) return;
    (async () => {
      try {
        const rows = await LcCanTuDongApi.getByPhieu(idPhieu);
        setRawLogRows(rows);
      } catch (err) {
        console.error("Không thể tải dữ liệu cân tự động:", err);
      }
    })();
  }, [idPhieu]);

  // Nút "Làm mới dữ liệu cân" — chủ động chạy SP đồng bộ (SECTION 30, đúng Scope của phiếu)
  // rồi đọc lại, KHÁC lúc tự render ở trên (chỉ đọc).
  const handleLamMoiCan = useCallback(async () => {
    if (!idPhieu) return;
    setLoadingRawLog(true);
    try {
      const rows = await LcCanTuDongApi.sync(idPhieu);
      setRawLogRows(rows);
    } catch (err) {
      console.error("Đồng bộ dữ liệu cân tự động thất bại:", err);
      message.error(getErrMsg(err, "Không thể đồng bộ dữ liệu cân tự động."));
    } finally {
      setLoadingRawLog(false);
    }
  }, [idPhieu]);

  const toggleRawLogSelected = (id: number, checked: boolean) => {
    setSelectedRawLogIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  };

  const tongKhoiLuongDaChon = useMemo(
    () => rawLogRows.filter((r) => selectedRawLogIds.includes(r.id)).reduce((acc, r) => acc + r.khoiLuong, 0),
    [rawLogRows, selectedRawLogIds]
  );

  const handleGanCanTuDong = useCallback(async () => {
    if (!idPhieu || !selectedTargetKey || selectedRawLogIds.length === 0) return;
    const targetRow = capLieuRowsRef.current.find((r) => targetKey(r) === selectedTargetKey);
    if (!targetRow) return;
    setGanLoading(true);
    try {
      const result = await LcCanTuDongApi.gan(idPhieu, {
        siloSo: targetRow.siloSo,
        stt: targetRow.stt ?? 1,
        rawLogIds: selectedRawLogIds,
      });
      const next = capLieuRowsRef.current.map((row) =>
        targetKey(row) === selectedTargetKey
          ? { ...row, khoiLuongAmThucTe: result.khoiLuongAmThucTe, khoiLuongAmThucTeCanTuDong: result.khoiLuongAmThucTeCanTuDong }
          : row
      );
      onCapLieuChange(next);
      setRawLogRows(result.rawLogRows);
      setSelectedRawLogIds([]);
      setSelectedTargetKey(null);
      message.success("Đã gán dữ liệu cân tự động vào Cấp liệu.");
    } catch (err) {
      console.error("Gán cân tự động thất bại:", err);
      message.error(getErrMsg(err, "Không thể gán dữ liệu cân tự động."));
    } finally {
      setGanLoading(false);
    }
  }, [idPhieu, selectedTargetKey, selectedRawLogIds, onCapLieuChange]);

  /** "Bỏ gán" — undo toàn bộ (KhoiLuongAmThucTe + snapshot về null), mở khoá lại các dòng
   *  RawLog đã dùng cho lần Gán đó (xem [[lc-bcsx-xnl-cantudong-design]]). */
  const handleBoGanCanTuDong = useCallback(
    async (row: CapLieuRow) => {
      if (!idPhieu) return;
      const key = targetKey(row);
      setBoGanKey(key);
      try {
        const freshRawLog = await LcCanTuDongApi.boGan(idPhieu, { siloSo: row.siloSo, stt: row.stt ?? 1 });
        const next = capLieuRowsRef.current.map((r) =>
          targetKey(r) === key ? { ...r, khoiLuongAmThucTe: null, khoiLuongAmThucTeCanTuDong: null } : r
        );
        onCapLieuChange(next);
        setRawLogRows(freshRawLog);
        message.success("Đã bỏ gán cân tự động.");
      } catch (err) {
        console.error("Bỏ gán cân tự động thất bại:", err);
        message.error(getErrMsg(err, "Không thể bỏ gán cân tự động."));
      } finally {
        setBoGanKey(null);
      }
    },
    [idPhieu, onCapLieuChange]
  );

  return (
    <div>
      {/* <Typography.Text type="secondary">
        Mỗi silo cố định có đúng 1 dòng ({thanhPham === "TP2" ? "20" : "16"} silo theo thành
        phẩm) — không thêm/xóa silo. Khi 1 silo nhận nhiều lớp liệu khác loại/lô trong cùng
        kíp, bấm nút "Tách liệu" ở cột Thao tác để thêm 1 dòng lớp liệu ngay dưới silo đó (số
        Silo lặp lại, nhập than/lô/khối lượng như dòng thường); 4 cột đo vật lý silo (Âm silo
        cuối kíp, KL ẩm/khô tồn cuối, Độ ẩm silo) chỉ nhập ở lớp đầu tiên. Các cột nền vàng là
        giá trị tính toán, tính ngay khi nhập ("KL khô thực tế", "KL ẩm/khô tồn cuối" — riêng
        "KL ẩm/khô tồn cuối" chỉ tính ở TP1, TP2 chưa có công thức); giá trị hiển thị là xem
        trước ở trình duyệt, backend tính lại chính thức khi Lưu. "Lũy kế", "Tồn đầu" vẫn để
        trống, chờ engine.
      </Typography.Text> */}
{editable && (
        <>
          <Divider orientation="left" plain>
            Cân tự động
          </Divider>
          <Space style={{ marginBottom: 8 }}>
            <Button size="small" loading={loadingRawLog} disabled={!idPhieu} onClick={handleLamMoiCan}>
              Làm mới dữ liệu cân
            </Button>
            <span className="text-xs text-gray-600">
              {selectedTargetKey
                ? `Đích: Silo ${selectedTargetKey.split("-")[0]}${selectedTargetKey.endsWith("-1") ? "" : ` (lớp ${selectedTargetKey.split("-")[1]})`}`
                : "Chưa chọn dòng Cấp liệu đích (tick ở cột Thao tác bên trên)"}
            </span>
          </Space>
          <div className="overflow-x-auto">
            <table className="border-collapse text-xs" style={{ width: 720 }}>
              <thead>
                <tr className="bg-gray-50">
                  <th style={{ width: 40 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700"></th>
                  <th style={{ width: 150 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">Thời gian cân</th>
                  <th style={{ width: 120 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">Tên cân</th>
                  <th style={{ width: 200 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">Loại liệu (theo NM)</th>
                  <th style={{ width: 100 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">Khối lượng</th>
                </tr>
              </thead>
              <tbody>
                {rawLogRows.map((row) => (
                  <tr key={row.id} className="hover:bg-blue-50/50">
                    <td className="border border-gray-300 px-2 py-1 text-center">
                      <Checkbox
                        checked={selectedRawLogIds.includes(row.id)}
                        disabled={row.isDaGan}
                        onChange={(e) => toggleRawLogSelected(row.id, e.target.checked)}
                      />
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-center">{dayjs(row.ngayGio).format("DD/MM/YYYY HH:mm:ss")}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center">{row.tenCan ?? "-"}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center">{row.loaiLieuTen ?? "-"}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right">{row.khoiLuong}</td>
                  </tr>
                ))}
                {rawLogRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="border border-gray-300 px-2 py-2 text-center text-gray-500">
                      Chưa có dữ liệu — bấm "Làm mới dữ liệu cân".
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Space style={{ marginTop: 8 }}>
            <span className="text-xs text-gray-600">Tổng đã chọn: {tongKhoiLuongDaChon.toLocaleString("en-US", { maximumFractionDigits: 3 })}</span>
            <Button
              size="small"
              type="primary"
              loading={ganLoading}
              disabled={!selectedTargetKey || selectedRawLogIds.length === 0}
              onClick={handleGanCanTuDong}
            >
              Gán
            </Button>
          </Space>
        </>
      )}
      <Divider orientation="left" plain>
        Cấp liệu &amp; tồn silo
      </Divider>
      
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1700px] border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50">
              {editable && <th style={{ width: 90 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">Thao tác</th>}
              <th style={{ width: 60 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">Silo</th>
              <th style={{ width: 200 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">Tên than</th>
              <th style={{ width: 160 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">Số hiệu lô</th>
              <th style={{ width: 100 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">{renderPasteableTitle("Kế hoạch (tấn)", "khoiLuongKeHoach")}</th>
              <th style={{ width: 130 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">{renderPasteableTitle("KL ẩm thực tế (tấn)", "khoiLuongAmThucTe")}</th>
              <th style={{ width: 85 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">{renderPasteableTitle("Độ ẩm (%)", "doAm")}</th>
              <th style={{ width: 130 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">KL khô thực tế (tấn)</th>
              <th style={{ width: 130 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">Lũy kế quy khô (tấn)</th>
              <th style={{ width: 150 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">KL tồn silo đầu kíp quy khô (tấn)</th>
              <th style={{ width: 130 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">{renderPasteableTitle("Âm silo cuối kíp (m)", "amSiloCuoiKy")}</th>
              <th style={{ width: 130 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">KL ẩm tồn silo cuối kíp (tấn)</th>
              <th style={{ width: 95 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">{renderPasteableTitle("Độ ẩm silo (%)", "doAmSilo")}</th>
              <th style={{ width: 150 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">Khối lượng tồn silo cuối kíp quy khô (tấn)</th>
              <th style={{ width: 160 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">Ghi chú / vị trí bãi</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, idx) => (
              <tr key={row.key ?? `${row.siloSo}-${row.stt ?? 1}`} className="hover:bg-blue-50/50">
                {editable && (
                  <td className="border border-gray-300 px-1 py-1 text-center">
                    <Space size={4}>
                      {row.khoiLuongAmThucTeCanTuDong != null ? (
                        <Popconfirm
                          title="Bỏ gán cân tự động? KL ẩm thực tế sẽ về trống, các dòng cân đã dùng được mở lại."
                          okText="Bỏ gán"
                          cancelText="Hủy"
                          onConfirm={() => handleBoGanCanTuDong(row)}
                        >
                          <Button size="small" danger loading={boGanKey === targetKey(row)} title="Bỏ gán cân tự động">
                            Bỏ gán
                          </Button>
                        </Popconfirm>
                      ) : (
                        <Tooltip title="Chọn làm đích Gán cân tự động">
                          <Checkbox
                            checked={selectedTargetKey === targetKey(row)}
                            onChange={(e) => setSelectedTargetKey(e.target.checked ? targetKey(row) : null)}
                          />
                        </Tooltip>
                      )}
                      <Tooltip title="Tách liệu (thêm 1 lớp liệu khác cho silo này)">
                        <Button size="small" icon={<PlusSquareOutlined />} onClick={() => handleTachLieu(idx)} />
                      </Tooltip>
                      {(row.stt ?? 1) !== 1 && (
                        <Popconfirm title="Xoá lớp liệu này?" okText="Xoá" cancelText="Hủy" onConfirm={() => handleXoaLop(idx)}>
                          <Button size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      )}
                    </Space>
                  </td>
                )}
                <td className="border border-gray-300 px-2 py-1 text-center">{row.siloSo}</td>
                <td className="border border-gray-300 p-0">
                  <VatTuAutoCompleteCell
                    idx={idx}
                    disabled={!editable}
                    onUpdateRow={updateCapLieuRow}
                    idVatTu={row.idVatTu}
                    vatLieuTen={row.vatLieuTen}
                  />
                </td>
                <td className="border border-gray-300 p-0">
                  <MaLoAutoCompleteCell
                    idx={idx}
                    disabled={!editable}
                    onUpdateRow={updateCapLieuRow}
                    idVatTu={row.idVatTu}
                    idMaLo={row.idMaLo}
                    options={getMaLoOptions(row.idVatTu)}
                    loading={isMaLoLoading(row.idVatTu)}
                  />
                </td>
                <td className="border border-gray-300 p-0">
                  <NumberCell value={toNumOrNull(row.khoiLuongKeHoach)} disabled={!editable} onCommit={(v) => updateDisplayField(idx, { khoiLuongKeHoach: v })} />
                </td>
                <td
                  className={`border border-gray-300 p-0 ${
                    row.khoiLuongAmThucTeCanTuDong != null && Number(row.khoiLuongAmThucTe) !== Number(row.khoiLuongAmThucTeCanTuDong)
                      ? "bg-amber-100"
                      : ""
                  }`}
                  title={
                    row.khoiLuongAmThucTeCanTuDong != null
                      ? `Đã gán cân tự động = ${row.khoiLuongAmThucTeCanTuDong}${
                          Number(row.khoiLuongAmThucTe) !== Number(row.khoiLuongAmThucTeCanTuDong) ? " (đã sửa tay)" : ""
                        }`
                      : undefined
                  }
                >
                  <NumberCell value={toNumOrNull(row.khoiLuongAmThucTe)} disabled={!editable} onCommit={(v) => updateDisplayField(idx, { khoiLuongAmThucTe: v })} />
                </td>
                <td className="border border-gray-300 p-0">
                  <NumberCell value={toNumOrNull(row.doAm)} disabled={!editable} onCommit={(v) => updateDisplayField(idx, { doAm: v })} />
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right">{row.khoiLuongKhoThucTe ?? "-"}</td>
                <td className="border border-gray-300 px-2 py-1 text-right">{row.luyKeQuyKho ?? "-"}</td>
                <td className="border border-gray-300 px-2 py-1 text-right">{row.tonDauKyQuyKho ?? "-"}</td>
                <td className="border border-gray-300 p-0">
                  <NumberCell
                    value={toNumOrNull(row.amSiloCuoiKy)}
                    disabled={!editable || isTonSiloLocked("amSiloCuoiKy", row)}
                    onCommit={(v) => updateDisplayField(idx, { amSiloCuoiKy: v })}
                  />
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right">{row.klAmTonCuoi ?? "-"}</td>
                <td className="border border-gray-300 p-0">
                  <NumberCell
                    value={toNumOrNull(row.doAmSilo)}
                    disabled={!editable || isTonSiloLocked("doAmSilo", row)}
                    onCommit={(v) => updateDisplayField(idx, { doAmSilo: v })}
                  />
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right">{row.klTonCuoiQuyKho ?? "-"}</td>
                <td className="border border-gray-300 p-0">
                  <TextCell value={row.ghiChu ?? null} disabled={!editable} onCommit={(v) => updateDisplayField(idx, { ghiChu: v })} />
                </td>
                
              </tr>
            ))}
          </tbody>
          {displayRows.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50 font-semibold">
                <td colSpan={editable ? 4 : 3} className="border border-gray-300 px-2 py-1 text-center">
                  Tổng
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right">{sumCapLieu(displayRows, "khoiLuongKeHoach")}</td>
                <td className="border border-gray-300 px-2 py-1 text-right">{sumCapLieu(displayRows, "khoiLuongAmThucTe")}</td>
                <td className="border border-gray-300 px-2 py-1" />
                <td className="border border-gray-300 px-2 py-1 text-right">{sumCapLieu(displayRows, "khoiLuongKhoThucTe")}</td>
                <td className="border border-gray-300 px-2 py-1 text-right">{sumCapLieu(displayRows, "luyKeQuyKho")}</td>
                <td className="border border-gray-300 px-2 py-1 text-right">{sumCapLieu(displayRows, "tonDauKyQuyKho")}</td>
                <td className="border border-gray-300 px-2 py-1" />
                <td className="border border-gray-300 px-2 py-1 text-right">{sumCapLieu(displayRows, "klAmTonCuoi")}</td>
                <td className="border border-gray-300 px-2 py-1" />
                <td className="border border-gray-300 px-2 py-1 text-right">{sumCapLieu(displayRows, "klTonCuoiQuyKho")}</td>
                <td className="border border-gray-300 px-2 py-1" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <Divider orientation="left" plain>
        Cỡ hạt sau nghiền 1
      </Divider>
      <div className="overflow-x-auto">
        <table className="border-collapse text-xs" style={{ width: 580 }}>
          <thead>
            <tr className="bg-gray-50">
              <th style={{ width: 90 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">Kích cỡ</th>
              <th style={{ width: 90 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">Lần 1</th>
              <th style={{ width: 90 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">Lần 2</th>
              <th style={{ width: 90 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">Lần 3</th>
              <th style={{ width: 200 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {coHatNghien1Rows.map((row, idx) => (
              <tr key={row.key ?? row.kichCo} className="hover:bg-blue-50/50">
                <td className="border border-gray-300 px-2 py-1 text-center">{row.kichCo}</td>
                <td className="border border-gray-300 p-0">
                  <NumberCell value={toNumOrNull(row.lan1)} disabled={!editable} onCommit={(v) => updateCoHatField(idx, { lan1: v })} />
                </td>
                <td className="border border-gray-300 p-0">
                  <NumberCell value={toNumOrNull(row.lan2)} disabled={!editable} onCommit={(v) => updateCoHatField(idx, { lan2: v })} />
                </td>
                <td className="border border-gray-300 p-0">
                  <NumberCell value={toNumOrNull(row.lan3)} disabled={!editable} onCommit={(v) => updateCoHatField(idx, { lan3: v })} />
                </td>
                <td className="border border-gray-300 p-0">
                  <TextCell value={row.ghiChu ?? null} disabled={!editable} onCommit={(v) => updateCoHatField(idx, { ghiChu: v })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      

      <Modal
        title={`Paste dữ liệu - ${pasteModal.columnTitle}`}
        open={pasteModal.open}
        onOk={handlePasteConfirm}
        onCancel={() => {
          setPasteModal({ open: false, columnKey: "", columnTitle: "" });
          setPasteText("");
        }}
        okText="Xác nhận"
        cancelText="Hủy"
        destroyOnHidden
      >
        <Input.TextArea
          autoFocus
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="Paste dữ liệu từ Excel vào đây..."
          rows={8}
        />
      </Modal>
    </div>
  );
};

export default TabCapLieuSilo;
