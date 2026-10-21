import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Divider, Input, Modal, Popconfirm, Space, Table, Tooltip, Typography } from "antd";
import { DeleteOutlined, PlusSquareOutlined, SnippetsOutlined } from "@ant-design/icons";
import CustomFormTable, { type FormColumnDef } from "../CustomFormTable";
import type { ThanhPham } from "./lcTabsConfig";
import { buildDefaultCoHatNghien1Rows } from "./lcMockOptions";
import { VatTuAutoCompleteCell, MaLoAutoCompleteCell, useMaLoBatchCache, type VatTuMaLoCellPatch } from "./LcVatTuMaLoCells";

/**
 * Vùng "Cấp liệu & Silo" — lát cắt đầu tiên theo LC_02_Prompt_Vibecoding_V5.md mục 3.
 *
 * Layout khớp workbook thật (xem .claude/LuyenCoc/PhanTichLayout.md mục 2–3 và
 * LC_01_PhanTich_ThietKe_TP1_TP2.md mục 2.2 Vùng 2): MỘT bảng duy nhất, 1 dòng = 1 silo,
 * số dòng CỐ ĐỊNH theo thành phẩm (TP1: 16 silo, TP2: 20 silo) — không thêm/xóa dòng tự
 * do như trước đây (Excel không có nút thêm dòng ở vùng này). Có dòng "Tổng" ở cuối, và
 * bảng phụ "Cỡ hạt sau nghiền 1" (đúng 2 dòng ≤1mm/≤3mm) bên dưới.
 *
 * DB tương ứng (LC_03_Prompt_ThietKe_CSDL.md mục 3.3): #7 LC_CapLieu + #9 LC_TonSilo —
 * ở Excel 2 bảng này gộp làm 1 theo silo nên UI cũng gộp lại cho khớp; khi có backend,
 * 1 dòng UI sẽ tách thành 1 bản ghi LC_CapLieu + 1 bản ghi LC_TonSilo cùng SiloId.
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
}

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

/** Các cột thuộc về SILO VẬT LÝ (bảng LC_TonSilo, đo 1 lần/silo bằng radar) — khi 1 silo có
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
  // Excel không cho thêm/xóa SILO tự do — đảm bảo mỗi silo (1..N theo thành phẩm) luôn có
  // ÍT NHẤT 1 dòng (lớp Stt=1), giữ nguyên mọi lớp đã tách thêm (Stt>1) và dữ liệu đã nhập.
  // KHÔNG còn merge theo vị trí index như trước (index không còn đại diện cho silo nữa khi
  // có silo bị tách thành nhiều dòng) — xem handleTachLieu/handleXoaLop.
  useEffect(() => {
    if (!thanhPham) return;
    const expected = thanhPham === "TP2" ? 20 : 16;
    const current = capLieuRowsRef.current;
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

  const columns: FormColumnDef[] = useMemo(
    () => [
      {
        title: "Silo",
        dataIndex: "siloSo",
        width: 70,
        align: "center",
        type: "index",
        render: (_: unknown, record: CapLieuRow) => record.siloSo,
      } as FormColumnDef,
      {
        title: "Tên than",
        dataIndex: "vatLieuTen",
        width: 200,
        renderCell: (record: CapLieuRow, idx: number, _onChange, disabled: boolean) => (
          <VatTuAutoCompleteCell
            idx={idx}
            disabled={disabled}
            onUpdateRow={updateCapLieuRow}
            idVatTu={record.idVatTu}
            vatLieuTen={record.vatLieuTen}
          />
        ),
      } as FormColumnDef,
      {
        title: "Số hiệu lô",
        dataIndex: "soHieuLo",
        width: 160,
        renderCell: (record: CapLieuRow, idx: number, _onChange, disabled: boolean) => (
          <MaLoAutoCompleteCell
            idx={idx}
            disabled={disabled}
            onUpdateRow={updateCapLieuRow}
            idVatTu={record.idVatTu}
            idMaLo={record.idMaLo}
            options={getMaLoOptions(record.idVatTu)}
            loading={isMaLoLoading(record.idVatTu)}
          />
        ),
      } as FormColumnDef,
      {
        title: renderPasteableTitle("Kế hoạch (tấn)", "khoiLuongKeHoach"),
        dataIndex: "khoiLuongKeHoach",
        width: 100,
        type: "float",
        align: "right",
      },
      {
        title: renderPasteableTitle("KL ẩm thực tế (tấn)", "khoiLuongAmThucTe"),
        dataIndex: "khoiLuongAmThucTe",
        width: 130,
        type: "float",
        align: "right",
      },
      {
        title: renderPasteableTitle("Độ ẩm (%)", "doAm"),
        dataIndex: "doAm",
        width: 85,
        type: "float",
        min: 0,
        align: "right",
      },
      {
        title: "KL khô thực tế (tấn)",
        dataIndex: "khoiLuongKhoThucTe",
        width: 130,
        type: "float",
        align: "right",
        readonly: true,
      },
      {
        title: "Lũy kế quy khô (tấn)",
        dataIndex: "luyKeQuyKho",
        width: 130,
        align: "right",
        readonly: true,
      },
      {
        title: "KL tồn silo đầu kíp quy khô (tấn)",
        dataIndex: "tonDauKyQuyKho",
        width: 150,
        align: "right",
        readonly: true,
      },
      {
        title: renderPasteableTitle("Âm silo cuối kíp (m)", "amSiloCuoiKy"),
        dataIndex: "amSiloCuoiKy",
        width: 130,
        type: "float",
        align: "right",
      },
      {
        title: "KL ẩm tồn silo cuối kíp (tấn)",
        dataIndex: "klAmTonCuoi",
        width: 130,
        align: "right",
        readonly: true,
      },
      {
        title: renderPasteableTitle("Độ ẩm silo (%)", "doAmSilo"),
        dataIndex: "doAmSilo",
        width: 95,
        type: "float",
        min: 0,
        align: "right",
      },
      {
        title: "Khối lượng tồn silo cuối kíp quy khô (tấn)",
        dataIndex: "klTonCuoiQuyKho",
        width: 130,
        align: "right",
        readonly: true,
      },
      { title: "Ghi chú / vị trí bãi", dataIndex: "ghiChu", width: 160 },
    ],
    [updateCapLieuRow, getMaLoOptions, isMaLoLoading, renderPasteableTitle]
  );

  const renderSummary = () => {
    const sum = (key: keyof CapLieuRow) => {
      const total = displayRows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
      return total
        ? total.toLocaleString("en-US", { maximumFractionDigits: 3 })
        : "—";
    };
    return (
      <Table.Summary fixed>
        <Table.Summary.Row style={{ backgroundColor: "#fafafa", fontWeight: 600 }}>
          <Table.Summary.Cell index={0} colSpan={3} align="center">
            Tổng
          </Table.Summary.Cell>
          <Table.Summary.Cell index={3} align="right">
            {sum("khoiLuongKeHoach")}
          </Table.Summary.Cell>
          <Table.Summary.Cell index={4} align="right">
            {sum("khoiLuongAmThucTe")}
          </Table.Summary.Cell>
          <Table.Summary.Cell index={5} />
          <Table.Summary.Cell index={6} align="right">
            {sum("khoiLuongKhoThucTe")}
          </Table.Summary.Cell>
          <Table.Summary.Cell index={7} align="right">
            {sum("luyKeQuyKho")}
          </Table.Summary.Cell>
          <Table.Summary.Cell index={8} align="right">
            {sum("tonDauKyQuyKho")}
          </Table.Summary.Cell>
          <Table.Summary.Cell index={9} />
          <Table.Summary.Cell index={10} align="right">
            {sum("klAmTonCuoi")}
          </Table.Summary.Cell>
          <Table.Summary.Cell index={11} />
          <Table.Summary.Cell index={12} align="right">
            {sum("klTonCuoiQuyKho")}
          </Table.Summary.Cell>
          <Table.Summary.Cell index={13} />
          {editable && <Table.Summary.Cell index={14} />}
        </Table.Summary.Row>
      </Table.Summary>
    );
  };

  const coHatColumns: FormColumnDef[] = useMemo(
    () => [
      { title: "Kích cỡ", dataIndex: "kichCo", width: 90, readonly: true },
      { title: "Lần 1", dataIndex: "lan1", width: 90, type: "float", align: "right" },
      { title: "Lần 2", dataIndex: "lan2", width: 90, type: "float", align: "right" },
      { title: "Lần 3", dataIndex: "lan3", width: 90, type: "float", align: "right" },
      { title: "Ghi chú", dataIndex: "ghiChu", width: 200 },
    ],
    []
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

      <Divider orientation="left" plain>
        Cấp liệu &amp; tồn silo
      </Divider>
      <CustomFormTable
        columns={columns}
        initialData={displayRows}
        onDataChange={(rows) => onCapLieuChange(rows as CapLieuRow[])}
        showAddButton={false}
        showDeleteButton={false}
        editable={editable}
        minRows={0}
        summary={renderSummary}
        scrollY={520}
        stickyHeader
        readonlyCellGetter={(dataIndex, record: CapLieuRow) => TONSILO_FIELDS.has(dataIndex) && (record.stt ?? 1) !== 1}
        rowActions={
          editable
            ? (record: CapLieuRow, rowIndex: number) => (
                <Space size={4}>
                  <Tooltip title="Tách liệu (thêm 1 lớp liệu khác cho silo này)">
                    <Button size="small" icon={<PlusSquareOutlined />} onClick={() => handleTachLieu(rowIndex)} />
                  </Tooltip>
                  {(record.stt ?? 1) !== 1 && (
                    <Popconfirm
                      title="Xoá lớp liệu này?"
                      okText="Xoá"
                      cancelText="Hủy"
                      onConfirm={() => handleXoaLop(rowIndex)}
                    >
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  )}
                </Space>
              )
            : undefined
        }
      />

      <Divider orientation="left" plain>
        Cỡ hạt sau nghiền 1
      </Divider>
      <CustomFormTable
        columns={coHatColumns}
        initialData={coHatNghien1Rows}
        onDataChange={(rows) => onCoHatNghien1Change(rows as CoHatNghien1Row[])}
        showAddButton={false}
        showDeleteButton={false}
        editable={editable}
        minRows={0}
      />

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
        destroyOnClose
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
