import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Divider, Empty, Input, Modal, Spin, Typography, message } from "antd";
import { SnippetsOutlined } from "@ant-design/icons";
import { thanhPhamToScope, type ThanhPham } from "./lcTabsConfig";
import {
  lcThapThanApi,
  type NhomThapThanDto,
  type PheuDto,
  type BuiCocNoiNhanDto,
} from "../../services/LCThapThanApi";
import { NumberCell, TextCell } from "./LcExcelGridCells";

/**
 * Vùng "Phân tích" (gộp từ TabPhanTich.tsx cũ, nay không còn dùng riêng) — LC_01 mục 2.2
 * Vùng 5 (cỡ hạt than sau nghiền 2, độ ẩm than phối trộn — tối đa 6 lần đo mỗi ca). Dùng
 * chung TP1/TP2, khớp bảng LC_TP_KetQuaPhanTichThan (ChiTieu, Lan1..Lan6, GhiChu).
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

/** Thứ tự cố định các chỉ tiêu: 2 cỡ hạt, rồi độ ẩm */
const CHI_TIEU_ORDER: ChiTieuPhanTich[] = ["CO_HAT_1MM", "CO_HAT_3MM", "DO_AM_PHOI_TRON"];

/** Đưa dữ liệu về đủ 1 dòng cho mỗi chỉ tiêu; gộp dữ liệu dạng cũ (nhomPhanTich/lanPhanTich/giaTri) */
function normalizePhanTich(rows: PhanTichRow[]): PhanTichRow[] {
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
          if (toNumOrNull(current[field]) === null) current[field] = legacy.giaTri ?? null;
        }
      });
    return current;
  });
}

const needsNormalizePhanTich = (rows: PhanTichRow[]) =>
  rows.length !== CHI_TIEU_ORDER.length ||
  rows.some((r, i) => r.chiTieu !== CHI_TIEU_ORDER[i] || r.nhomPhanTich);

/**
 * Vùng "Tháp / Phễu" — render theo nhóm tháp than (danh mục từ backend), mỗi nhóm 1 bảng:
 * các phễu của nhóm + cột gộp ô theo tháp (độ ẩm, than cấp lên tháp, than nạp lò) + dòng Tổng.
 * - Phễu  -> LC_TonPheu (#12)
 * - Tháp  -> LC_CapThap (#13) — "Than nạp lò" CALCULATED (chốt công thức 2026-11-13, thay cho
 *   giả định cũ "chưa rõ nguồn, tạm nhập tay" ở OQ-06/LC_01 mục 7): cân bằng khối lượng = (Σ Tồn
 *   đầu kíp quy khô + Than cấp lên tháp quy khô) − Σ Tồn cuối kíp quy khô của các phễu thuộc tháp
 *   đó. PREVIEW ở FE (xem computeNapLoQuyKho_PREVIEW), backend tính lại chính thức khi Lưu
 *   (LC_ThanhPhamRepository.ComputeNapLoQuyKho).
 *
 * Quy ước khoá: cumThapMa = String(nhom.id); pheuMa = String(pheu.id).
 */

export interface PheuRow {
  key?: string | number;
  cumThapMa?: string | null;
  pheuMa?: string | null;
  klTonDauQuyKho?: string | number | null;
  mucRadar?: string | number | null;
  klAmTonCuoi?: string | number | null;
  klTonCuoiQuyKho?: string | number | null;
  ghiChu?: string | null;
}

export interface ThapRow {
  key?: string | number;
  cumThapMa?: string | null;
  doAmThap?: string | number | null;
  capLenThapQuyKho?: string | number | null;
  luyKeCapLenThap?: string | number | null;
  napLoQuyKho?: string | number | null;
  luyKeNapLo?: string | number | null;
  ghiChu?: string | null;
}

/**
 * "I. Sản lượng" + "II. Bụi cốc tồn" gộp 1 object — cùng 1 hạng mục "Bụi cốc đóng bao" duy
 * nhất, 1 object/phiếu (xem TP1.xlsx dòng 201-208; TP2 không có cấu trúc này — CHỈ TP1).
 */
export interface BuiCocRow {
  sanLuongTrongCa?: string | number | null;
  luyKeSanLuong?: string | number | null;
  tonDauKyQuyKho?: string | number | null;
  tonCuoiKyQuyKho?: string | number | null;
}

/** "III. Bụi cốc xuất" — 1 dòng/Nơi nhận (danh mục `LC_TP_BuiCocNoiNhan`, xem TP1.xlsx dòng
 *  209-217). CHỈ TP1. */
export interface BuiCocXuatRow {
  key?: string | number;
  noiNhanId?: number | null;
  khoiLuong?: string | number | null;
  luyKeQuyKho?: string | number | null;
}

interface TabThapPheuProps {
  thanhPham: ThanhPham | null | undefined;
  editable: boolean;
  pheuRows: PheuRow[];
  onPheuChange: (rows: PheuRow[]) => void;
  thapRows: ThapRow[];
  onThapChange: (rows: ThapRow[]) => void;
  phanTich: PhanTichRow[];
  onPhanTichChange: (rows: PhanTichRow[]) => void;
  buiCoc: BuiCocRow;
  onBuiCocChange: (row: BuiCocRow) => void;
  buiCocXuat: BuiCocXuatRow[];
  onBuiCocXuatChange: (rows: BuiCocXuatRow[]) => void;
}

const fmt = (v: string | number | null | undefined) => {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 3 }) : String(v);
};

const sum = (rows: PheuRow[], field: keyof PheuRow) =>
  rows.reduce((acc, r) => acc + (Number(r[field]) || 0), 0);

const toNumOrNull = (v: string | number | null | undefined): number | null =>
  v === null || v === undefined || v === "" ? null : Number(v);

/**
 * F06a (TP1)/F06b (TP2) — "Khối lượng ẩm tồn cuối kíp" của phễu, từ Mức liệu phễu cuối kíp (H/G,
 * mét) + Độ ẩm tháp than cuối kíp (của Tháp chứa phễu đó). PREVIEW ONLY (ngoại lệ đã chấp nhận —
 * xem comment đầu TabCapLieuSilo.tsx): backend LUÔN tính lại y hệt khi Lưu
 * (LC_ThanhPhamRepository.ComputeKLAmTonCuoiPheu) và bỏ qua giá trị FE gửi cho 2 cột CALCULATED
 * này — đối chiếu đúng khớp TP1.xlsx ô J163 (`=ROUND(IF(H163<6,(H163/6)^2*100,100+33.5*(H163-6)),3)`)
 * và TP2.xlsx ô I140 (`=ROUND((IF(G140>=7.368,(G140-7.368)*62.964+90,((G140*0.442+0.75)^2+
 * (G140*0.442+0.75)*0.75+0.562)*G140*PI()/3))*(0.707+DoAmThap/100),3)`).
 */
function computeKLAmTonCuoiPheu_PREVIEW(
  isTP1: boolean,
  mucRadar: PheuRow["mucRadar"],
  doAmThap: ThapRow["doAmThap"]
): number | null {
  const h = toNumOrNull(mucRadar);
  if (h === null) return null;

  if (isTP1) {
    const result = h < 6 ? (h / 6) * (h / 6) * 100 : 100 + 33.5 * (h - 6);
    return Math.round(result * 1000) / 1000;
  }

  const doAmNum = toNumOrNull(doAmThap);
  if (doAmNum === null) return null;
  const vG =
    h >= 7.368
      ? (h - 7.368) * 62.964 + 90
      : (Math.pow(h * 0.442 + 0.75, 2) + (h * 0.442 + 0.75) * 0.75 + 0.562) * h * (Math.PI / 3);
  return Math.round(vG * (0.707 + doAmNum / 100) * 1000) / 1000;
}

/** F01 áp lại cho tồn phễu (giống F05a/F05b silo) — KLKho = KLAm × (100 − Độ ẩm tháp) / 100.
 *  PREVIEW ONLY — xem comment trên. */
function computeKhoiLuongKhoPheu_PREVIEW(klAmTonCuoi: number | null, doAmThap: ThapRow["doAmThap"]): number | null {
  if (klAmTonCuoi === null) return null;
  const doAmNum = toNumOrNull(doAmThap);
  if (doAmNum === null) return null;
  return Math.round(((klAmTonCuoi * (100 - doAmNum)) / 100) * 1000) / 1000;
}

/**
 * F09 (PREVIEW ONLY — xem comment đầu TabCapLieuSilo.tsx): Than nạp lò = cân bằng khối lượng —
 * (Σ Tồn đầu kíp quy khô + Than cấp lên tháp quy khô theo cân 2A) − Σ Tồn cuối kíp quy khô của
 * các phễu thuộc tháp đó (`rows` đã có `klTonCuoiQuyKho` là bản preview F06+F01 — xem
 * computeKhoiLuongKhoPheu_PREVIEW). Chốt công thức 2026-11-13, thay cho "chưa rõ nguồn, tạm nhập
 * tay" (OQ-06). NULL-behavior (LC_02 mục 2.3): không có bất kỳ số liệu nào trong cả 3 phần → NULL,
 * không ép về 0; có ít nhất 1 phần → coi phần thiếu còn lại = 0 (giống cách tính "Trong ca" ở
 * TabXuatCapCoc.tsx).
 */
function computeNapLoQuyKho_PREVIEW(
  rows: readonly { klTonDauQuyKho?: string | number | null; klTonCuoiQuyKho: number | null }[],
  capLenThapQuyKho: ThapRow["capLenThapQuyKho"]
): number | null {
  const capLenThapNum = toNumOrNull(capLenThapQuyKho);
  const anyData = capLenThapNum !== null || rows.some((r) => toNumOrNull(r.klTonDauQuyKho) !== null || r.klTonCuoiQuyKho !== null);
  if (!anyData) return null;
  const tonDauSum = rows.reduce((acc, r) => acc + (toNumOrNull(r.klTonDauQuyKho) ?? 0), 0);
  const tonCuoiSum = rows.reduce((acc, r) => acc + (r.klTonCuoiQuyKho ?? 0), 0);
  return Math.round((tonDauSum + (capLenThapNum ?? 0) - tonCuoiSum) * 1000) / 1000;
}

const TabThapPheu = ({
  thanhPham,
  editable,
  pheuRows,
  onPheuChange,
  thapRows,
  onThapChange,
  phanTich,
  onPhanTichChange,
  buiCoc,
  onBuiCocChange,
  buiCocXuat,
  onBuiCocXuatChange,
}: TabThapPheuProps) => {
  const [nhomList, setNhomList] = useState<NhomThapThanDto[]>([]);
  const [pheuList, setPheuList] = useState<PheuDto[]>([]);
  const [noiNhanList, setNoiNhanList] = useState<BuiCocNoiNhanDto[]>([]);
  const [loading, setLoading] = useState(false);
  const isTP1 = thanhPham === "TP1";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const scope = thanhPhamToScope(thanhPham);
    Promise.all([
      lcThapThanApi.getNhom(scope),
      lcThapThanApi.getPheu(undefined, undefined, scope),
      lcThapThanApi.getNoiNhanBuiCoc(),
    ])
      .then(([nhom, pheu, noiNhan]) => {
        if (cancelled) return;
        setNhomList(nhom);
        setPheuList(pheu);
        setNoiNhanList(noiNhan);
      })
      .catch(() => message.error("Không tải được danh mục tháp than / phễu / nơi nhận bụi cốc"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [thanhPham]);

  // Bổ sung dòng còn thiếu cho mỗi phễu / mỗi nhóm tháp than khi danh mục tải xong
  useEffect(() => {
    if (!nhomList.length) return;

    const missingPheu = pheuList.filter(
      (p) => !pheuRows.some((r) => r.pheuMa === String(p.id) && r.cumThapMa === String(p.thapThanId))
    );
    if (missingPheu.length) {
      onPheuChange([
        ...pheuRows,
        ...missingPheu.map((p) => ({
          key: `pheu-${p.id}`,
          cumThapMa: String(p.thapThanId),
          pheuMa: String(p.id),
        })),
      ]);
    }

    const missingThap = nhomList.filter((n) => !thapRows.some((r) => r.cumThapMa === String(n.id)));
    if (missingThap.length) {
      onThapChange([
        ...thapRows,
        ...missingThap.map((n) => ({ key: `thap-${n.id}`, cumThapMa: String(n.id) })),
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nhomList, pheuList]);

  // Bổ sung dòng còn thiếu cho mỗi Nơi nhận Bụi cốc khi danh mục tải xong (CHỈ TP1).
  useEffect(() => {
    if (!isTP1 || !noiNhanList.length) return;
    const missing = noiNhanList.filter((n) => !buiCocXuat.some((r) => r.noiNhanId === n.id));
    if (missing.length) {
      onBuiCocXuatChange([
        ...buiCocXuat,
        ...missing.map((n) => ({ key: `bc-noinhan-${n.id}`, noiNhanId: n.id })),
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTP1, noiNhanList, buiCocXuat]);

  const noiNhanTenById = useMemo(
    () => new Map(noiNhanList.map((n) => [n.id, n.ten])),
    [noiNhanList]
  );

  const patchBuiCocXuat = (noiNhanId: number, patch: Partial<BuiCocXuatRow>) =>
    onBuiCocXuatChange(buiCocXuat.map((r) => (r.noiNhanId === noiNhanId ? { ...r, ...patch } : r)));

  // Luôn đủ các dòng chỉ tiêu Phân tích cố định, đúng thứ tự
  useEffect(() => {
    if (needsNormalizePhanTich(phanTich)) onPhanTichChange(normalizePhanTich(phanTich));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phanTich]);

  const patchPhanTich = (chiTieu: ChiTieuPhanTich, field: LanField, value: number | null) =>
    onPhanTichChange(phanTich.map((r) => (r.chiTieu === chiTieu ? { ...r, [field]: value } : r)));

  // Ghi chú chung của vùng Phân tích: 1 ô gộp dọc, lưu ở dòng chỉ tiêu đầu tiên (cột GhiChu)
  const phanTichGhiChu = phanTich.find((r) => r.chiTieu === CHI_TIEU_ORDER[0])?.ghiChu ?? "";
  const patchPhanTichGhiChu = (value: string) =>
    onPhanTichChange(phanTich.map((r) => (r.chiTieu === CHI_TIEU_ORDER[0] ? { ...r, ghiChu: value } : r)));

  const renderPhanTichInputs = (chiTieu: ChiTieuPhanTich) =>
    LAN_FIELDS.map((field) => {
      const value = toNumOrNull(phanTich.find((r) => r.chiTieu === chiTieu)?.[field]);
      return (
        <td key={field} className="border border-gray-300 p-0">
          <NumberCell value={value} disabled={!editable} onCommit={(v) => patchPhanTich(chiTieu, field, v)} />
        </td>
      );
    });

  const renderPhanTichLanHeader = () =>
    LAN_FIELDS.map((_, i) => (
      <th
        key={i}
        className="border border-gray-300 px-2 py-1 text-center font-medium leading-tight text-gray-700"
      >
        Lần {i + 1}
      </th>
    ));

  const patchPheu = (pheuId: number, patch: Partial<PheuRow>) =>
    onPheuChange(pheuRows.map((r) => (r.pheuMa === String(pheuId) ? { ...r, ...patch } : r)));

  const patchThap = (nhomId: number, patch: Partial<ThapRow>) =>
    onThapChange(thapRows.map((r) => (r.cumThapMa === String(nhomId) ? { ...r, ...patch } : r)));

  /* ================= PASTE FROM EXCEL (clone từ TabPhoiTron.tsx) =================
   * Chỉ áp cho 2 cột dạng "cột dọc N-dòng" khớp đúng semantics paste-theo-cột: "Mức liệu phễu
   * cuối kíp" (theo từng nhóm tháp than, paste riêng mỗi nhóm) và "Khối lượng" ở Bụi cốc xuất.
   * Bảng "Kết quả phân tích" KHÔNG áp — Lần 1..6 nằm NGANG trên 1 dòng/chỉ tiêu, không phải cột
   * dọc nhiều dòng, paste theo cột không khớp layout đó.
   */
  const [pasteModal, setPasteModal] = useState<{
    open: boolean;
    target: "mucRadar" | "buiCocXuatKhoiLuong";
    cumThapMa?: string;
    title: string;
  }>({ open: false, target: "mucRadar", title: "" });
  const [pasteText, setPasteText] = useState("");

  const handlePasteConfirm = useCallback(() => {
    const lines = pasteText.split("\n").map((line) => line.split("\t")[0].trim());

    if (pasteModal.target === "mucRadar" && pasteModal.cumThapMa != null) {
      let i = 0;
      const next = pheuRows.map((r) => {
        if (r.cumThapMa !== pasteModal.cumThapMa) return r;
        const line = lines[i++];
        if (line === undefined || line === "") return r;
        const num = parseFloat(line.replace(/,/g, ""));
        return Number.isNaN(num) ? r : { ...r, mucRadar: num };
      });
      onPheuChange(next);
    } else if (pasteModal.target === "buiCocXuatKhoiLuong") {
      const next = buiCocXuat.map((row, i) => {
        const line = lines[i];
        if (line === undefined || line === "") return row;
        const num = parseFloat(line.replace(/,/g, ""));
        return Number.isNaN(num) ? row : { ...row, khoiLuong: num };
      });
      onBuiCocXuatChange(next);
    }

    setPasteModal({ open: false, target: "mucRadar", title: "" });
    setPasteText("");
  }, [pasteModal, pasteText, pheuRows, onPheuChange, buiCocXuat, onBuiCocXuatChange]);

  /** Title có nút "Paste từ Excel" cho cột "Mức liệu phễu cuối kíp" — gắn kèm cumThapMa của
   *  nhóm đang chứa cột đó để paste đúng nhóm, không lẫn giữa các nhóm. */
  const renderMucRadarTitle = (cumThapMa: string) => {
    const label = "Mức liệu phễu cuối kíp, (m)";
    if (!editable) return label;
    return (
      <div className="flex flex-col items-center justify-center gap-0.5">
        <span className="break-words leading-tight">{label}</span>
        <Button
          size="small"
          type="primary"
          ghost
          icon={<SnippetsOutlined />}
          title="Paste từ Excel"
          style={{ height: 18, lineHeight: "18px", padding: "0 6px" }}
          onClick={(e) => {
            e.stopPropagation();
            setPasteModal({ open: true, target: "mucRadar", cumThapMa, title: label });
            setPasteText("");
          }}
        />
      </div>
    );
  };

  /** Title có nút "Paste từ Excel" cho cột "Khối lượng" ở bảng Bụi cốc xuất. */
  const renderBuiCocXuatTitle = () => {
    const label = "Khối lượng, (tấn)";
    if (!editable) return label;
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
        <span>{label}</span>
        <Button
          size="small"
          type="primary"
          ghost
          icon={<SnippetsOutlined />}
          title="Paste từ Excel"
          style={{ lineHeight: 1, padding: "0 6px" }}
          onClick={(e) => {
            e.stopPropagation();
            setPasteModal({ open: true, target: "buiCocXuatKhoiLuong", title: label });
            setPasteText("");
          }}
        />
      </div>
    );
  };

  const pheuNameById = useMemo(
    () => new Map(pheuList.map((p) => [String(p.id), p.tenPheu ?? `Phễu ${p.id}`])),
    [pheuList]
  );

  const renderNhom = (nhom: NhomThapThanDto, index: number) => {
    const thap = thapRows.find((r) => r.cumThapMa === String(nhom.id));
    // Preview F06a/F06b + F01 ngay khi gõ Mức liệu phễu (không phải đợi Lưu mới thấy số) — xem
    // computeKLAmTonCuoiPheu_PREVIEW đầu file. Backend vẫn tính lại chính thức khi Lưu.
    const rows = pheuRows.filter((r) => r.cumThapMa === String(nhom.id)).map((row) => {
      const klAmTonCuoi = computeKLAmTonCuoiPheu_PREVIEW(isTP1, row.mucRadar, thap?.doAmThap);
      return { ...row, klAmTonCuoi, klTonCuoiQuyKho: computeKhoiLuongKhoPheu_PREVIEW(klAmTonCuoi, thap?.doAmThap) };
    });
    const napLoQuyKhoPreview = computeNapLoQuyKho_PREVIEW(rows, thap?.capLenThapQuyKho);
    const th = "border border-gray-300 px-2 py-1 text-center font-medium text-gray-700";
    const td = "border border-gray-300 px-2 py-1";

    return (
      <div key={nhom.id} style={{ marginBottom: 20 }}>
        <Typography.Text strong style={{ display: "block", padding: "4px 0" }}>
          {index + 1}. {nhom.ten}
        </Typography.Text>
        <div className="w-full overflow-hidden">
          <table className="w-full table-fixed border-collapse text-xs">
            <colgroup>
              <col style={{ width: "8%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "10%" }} />
            </colgroup>
            <thead>
              <tr className="bg-gray-50">
                <th className={`${th} leading-tight`}>Phễu tháp than</th>
                <th className={`${th} leading-tight`}>Khối lượng tồn đầu kíp quy khô, (tấn)</th>
                <th className={`${th} leading-tight`}>{renderMucRadarTitle(String(nhom.id))}</th>
                <th className={`${th} leading-tight`}>Khối lượng ẩm tồn cuối kíp, (tấn)</th>
                <th className={`${th} leading-tight`}>Độ ẩm tháp than cuối kíp, (W%)</th>
                <th className={`${th} leading-tight`}>Khối lượng tồn cuối kíp quy khô, (tấn)</th>
                <th className={`${th} leading-tight`}>Khối lượng than cấp lên tháp quy khô theo cân 2A, (tấn)</th>
                <th className={`${th} leading-tight`}>Lũy kế than cấp lên tháp, (tấn)</th>
                <th className={`${th} leading-tight`}>Khối lượng than nạp lò quy khô, (tấn)</th>
                <th className={`${th} leading-tight`}>Lũy kế than nạp lò, (tấn)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={row.key ?? `${row.cumThapMa}-${row.pheuMa}`} className="hover:bg-blue-50/50">
                  <td className={`${td} text-center`}>{pheuNameById.get(row.pheuMa ?? "") ?? row.pheuMa}</td>
                  <td className={`${td} text-right`}>{fmt(row.klTonDauQuyKho)}</td>
                  <td className="border border-gray-300 p-0">
                    <NumberCell
                      value={toNumOrNull(row.mucRadar)}
                      disabled={!editable}
                      onCommit={(v) => patchPheu(Number(row.pheuMa), { mucRadar: v })}
                    />
                  </td>
                  <td className={`${td} text-right`}>{fmt(row.klAmTonCuoi)}</td>
                  {rIdx === 0 && (
                    <td className="border border-gray-300 p-0" rowSpan={rows.length}>
                      <NumberCell
                        value={toNumOrNull(thap?.doAmThap)}
                        disabled={!editable}
                        merged
                        onCommit={(v) => patchThap(nhom.id, { doAmThap: v })}
                      />
                    </td>
                  )}
                  <td className={`${td} text-right`}>{fmt(row.klTonCuoiQuyKho)}</td>
                  {rIdx === 0 && (
                    <td className={`${td} text-right`} rowSpan={rows.length}>
                      {fmt(thap?.capLenThapQuyKho)}
                    </td>
                  )}
                  {rIdx === 0 && (
                    <td className={`${td} text-right`} rowSpan={rows.length}>
                      {fmt(thap?.luyKeCapLenThap)}
                    </td>
                  )}
                  {rIdx === 0 && (
                    <td className={`${td} text-right`} rowSpan={rows.length}>
                      {fmt(napLoQuyKhoPreview)}
                    </td>
                  )}
                  {rIdx === 0 && (
                    <td className={`${td} text-right`} rowSpan={rows.length}>
                      {fmt(thap?.luyKeNapLo)}
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className={`${td} text-center text-gray-400`}>
                    Nhóm tháp than chưa có phễu
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 font-semibold">
                  <td className={`${td} text-center`}>Tổng</td>
                  <td className={`${td} text-right`}>{fmt(sum(rows, "klTonDauQuyKho"))}</td>
                  <td className={td} />
                  <td className={`${td} text-right`}>{fmt(sum(rows, "klAmTonCuoi"))}</td>
                  <td className={td} />
                  <td className={`${td} text-right`}>{fmt(sum(rows, "klTonCuoiQuyKho"))}</td>
                  <td className={td} colSpan={4} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    );
  };

  return (
    <div>
      <Typography.Text type="secondary">
        "Than cấp lên tháp" tổng hợp từ vùng Phối trộn (cross-region). "Than nạp lò" tính tự động =
        cân bằng khối lượng (Tồn đầu kíp + Than cấp lên tháp) − Tồn cuối kíp của các phễu thuộc
        tháp đó — không nhập tay.
      </Typography.Text>

      <Spin spinning={loading}>
        <div style={{ marginTop: 12 }}>
          {nhomList.length === 0 && !loading ? (
            <Empty description="Chưa có nhóm tháp than nào" />
          ) : (
            nhomList.map(renderNhom)
          )}
        </div>
      </Spin>

      <Divider orientation="left" plain>
        Kết quả phân tích
      </Divider>
      <Typography.Text type="secondary">
        TP1: nhập tay trực tiếp. TP2: lấy từ BKMIS (ghi "(BKM)" trên biểu mẫu gốc) — tạm nhập tay cho tới
        khi tích hợp (xem LC_02_Prompt_Vibecoding_V5.md mục 2.4).
      </Typography.Text>
      <div className="w-full overflow-hidden" style={{ marginTop: 12 }}>
        <table className="w-full table-fixed border-collapse text-xs">
          <colgroup>
            <col style={{ width: "19%" }} />
            <col style={{ width: "8%" }} />
            {LAN_FIELDS.map((f) => (
              <col key={f} style={{ width: "9%" }} />
            ))}
            <col style={{ width: "19%" }} />
          </colgroup>
          <tbody>
            {/* Cỡ hạt than sau nghiền 2 */}
            <tr>
              <th
                className="border border-gray-300 px-2 py-1 text-center font-medium leading-tight text-gray-700"
                rowSpan={3}
              >
                Cỡ hạt than sau nghiền 2:
              </th>
              <th className="border border-gray-300 px-2 py-1 text-center font-medium leading-tight text-gray-700">
                Cỡ hạt
              </th>
              {renderPhanTichLanHeader()}
              <td className="border border-gray-300 p-0 align-top" rowSpan={5}>
                <div className="px-2 pt-1 text-xs font-semibold text-gray-700">Ghi chú:</div>
                <TextCell value={phanTichGhiChu || null} disabled={!editable} merged onCommit={(v) => patchPhanTichGhiChu(v ?? "")} />
              </td>
            </tr>
            <tr className="hover:bg-blue-50/50">
              <td className="border border-gray-300 px-2 py-1 text-center">≤1mm</td>
              {renderPhanTichInputs("CO_HAT_1MM")}
            </tr>
            <tr className="hover:bg-blue-50/50">
              <td className="border border-gray-300 px-2 py-1 text-center">≤3mm</td>
              {renderPhanTichInputs("CO_HAT_3MM")}
            </tr>

            {/* Độ ẩm than phối trộn */}
            <tr>
              <th
                className="border border-gray-300 px-2 py-1 text-center font-medium leading-tight text-gray-700"
                rowSpan={2}
              >
                Độ ẩm than phối trộn
              </th>
              <th className="border border-gray-300 px-2 py-1 text-center font-medium leading-tight text-gray-700">
                W
              </th>
              {renderPhanTichLanHeader()}
            </tr>
            <tr className="hover:bg-blue-50/50">
              <td className="border border-gray-300 px-2 py-1 text-center">%</td>
              {renderPhanTichInputs("DO_AM_PHOI_TRON")}
            </tr>
          </tbody>
        </table>
      </div>

      {isTP1 && (
        <>
          <Divider orientation="left" plain>
            I. Sản lượng
          </Divider>
          <div className="overflow-x-auto">
            <table className="border-collapse text-xs" style={{ width: 520 }}>
              <thead>
                <tr className="bg-gray-50">
                  <th style={{ width: 200 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">Hạng mục</th>
                  <th style={{ width: 160 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">Sản lượng, (tấn)</th>
                  <th style={{ width: 160 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">Lũy kế quy khô, (tấn)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-blue-50/50">
                  <td className="border border-gray-300 px-2 py-1 text-center">Bụi cốc đóng bao</td>
                  <td className="border border-gray-300 p-0">
                    <NumberCell
                      value={toNumOrNull(buiCoc.sanLuongTrongCa)}
                      disabled={!editable}
                      onCommit={(v) => onBuiCocChange({ ...buiCoc, sanLuongTrongCa: v })}
                    />
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right">{fmt(buiCoc.luyKeSanLuong)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <Divider orientation="left" plain>
            II. Bụi cốc tồn
          </Divider>
          <div className="overflow-x-auto">
            <table className="border-collapse text-xs" style={{ width: 520 }}>
              <thead>
                <tr className="bg-gray-50">
                  <th style={{ width: 200 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">Hạng mục</th>
                  <th style={{ width: 160 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">Tồn đầu kíp quy khô, (tấn)</th>
                  <th style={{ width: 160 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">Tồn cuối kíp quy khô, (tấn)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-blue-50/50">
                  <td className="border border-gray-300 px-2 py-1 text-center">Bụi cốc đóng bao</td>
                  <td className="border border-gray-300 px-2 py-1 text-right">{fmt(buiCoc.tonDauKyQuyKho)}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right">{fmt(buiCoc.tonCuoiKyQuyKho)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <Divider orientation="left" plain>
            III. Bụi cốc xuất
          </Divider>
          <div className="overflow-x-auto">
            <table className="border-collapse text-xs" style={{ width: 520 }}>
              <thead>
                <tr className="bg-gray-50">
                  <th style={{ width: 200 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">Nơi nhận</th>
                  <th style={{ width: 160 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">{renderBuiCocXuatTitle()}</th>
                  <th style={{ width: 160 }} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">Lũy kế quy khô, (tấn)</th>
                </tr>
              </thead>
              <tbody>
                {buiCocXuat.map((row) => (
                  <tr key={row.key ?? row.noiNhanId} className="hover:bg-blue-50/50">
                    <td className="border border-gray-300 px-2 py-1 text-center">
                      {row.noiNhanId != null ? noiNhanTenById.get(row.noiNhanId) ?? row.noiNhanId : "-"}
                    </td>
                    <td className="border border-gray-300 p-0">
                      <NumberCell
                        value={toNumOrNull(row.khoiLuong)}
                        disabled={!editable}
                        onCommit={(v) => row.noiNhanId != null && patchBuiCocXuat(row.noiNhanId, { khoiLuong: v })}
                      />
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-right">{fmt(row.luyKeQuyKho)}</td>
                  </tr>
                ))}
                {buiCocXuat.length === 0 && (
                  <tr>
                    <td colSpan={3} className="border border-gray-300 px-2 py-4 text-center text-gray-400">
                      Chưa có danh mục Nơi nhận
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal
        title={`Paste dữ liệu - ${pasteModal.title}`}
        open={pasteModal.open}
        onOk={handlePasteConfirm}
        onCancel={() => {
          setPasteModal({ open: false, target: "mucRadar", title: "" });
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

export default TabThapPheu;
