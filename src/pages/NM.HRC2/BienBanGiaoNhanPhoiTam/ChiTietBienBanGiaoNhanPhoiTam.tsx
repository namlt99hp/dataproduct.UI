/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Descriptions,
  Popconfirm,
  Radio,
  Space,
  Input,
  Table,
  Tabs,
  Tooltip,
  Tag,
  Typography,
  message,
  Modal,
} from "antd";
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  LockOutlined,
  UnlockOutlined,
  SnippetsOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
} from "@ant-design/icons";
import type { TableRowSelection } from "antd/es/table/interface";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { usePhieuNavigation } from "../../../hooks/usePhieuNavigation";
import { PhieuApi } from "../../../services/PhieuApi";
import { Hrc2SlabApi, type HrcSlabItem } from "../../../services/Hrc2SlabApi";
import { HRC2_PHAN_LOAI_ORDER } from "../../../utils/enums/Hrc2PhanLoaiEnum";
import HRC2_BBSL_PhoiTam from "../../../utils/BM_config/HRC2_BBSL_PhoiTam.json";
import {
  getBmQuyenUiFlags,
  hasKhuVucPhu,
  canChotBm,
} from "../../../utils/helpers/checkAdminRole";
import { phieuActionService } from "../../../services/PhieuActionService";
import { DETAIL_HIDDEN_BUTTON_KEYS } from "../../../utils/constants/PhieuActionButtonKeys";
import { BM_CONFIG } from "../../../utils/configs/BieuMauConst";

const { Title } = Typography;

const TT_COLOR: Record<number, string> = { 0: "default", 1: "green" };

// Màu theo Ý NGHĨA (không theo vị trí) để nhất quán giữa 3 nhóm filter: xám = "Tất cả" (không lọc),
// xanh = trạng thái "tốt/đã xong" (trong ca, đã xác nhận), cam = trạng thái "cần chú ý" (ngoài ca, chưa xác nhận).
const FILTER_BTN_COLOR: Record<string, { background: string; borderColor: string; color: string }> = {
  all: { background: "#f5f5f5", borderColor: "#d9d9d9", color: "rgba(0, 0, 0, 0.88)" },
  trongCa: { background: "#52c41a", borderColor: "#52c41a", color: "#fff" },
  da: { background: "#52c41a", borderColor: "#52c41a", color: "#fff" },
  ngoaiCa: { background: "#fa8c16", borderColor: "#fa8c16", color: "#fff" },
  chua: { background: "#fa8c16", borderColor: "#fa8c16", color: "#fff" },
};

const filterBtnStyle = (value: string, current: string) =>
  value === current ? FILTER_BTN_COLOR[value] : undefined;

const getUserId = (): number => {
  try {
    const info = localStorage.getItem("userinfo");
    if (info) {
      const obj = JSON.parse(info);
      return obj.iD_TaiKhoan ?? obj.ID_TaiKhoan ?? obj.idTaiKhoan ?? 0;
    }
  } catch {
    /* empty */
  }
  return 0;
};

// Map phanLoai code → cặp key cột trong pivot row
function getColKeysByPhanLoai(
  phanLoai?: string | null,
): { soKey: string; klKey: string } | null {
  if (!phanLoai || !HRC2_PHAN_LOAI_ORDER.includes(phanLoai as any)) return null;
  return { soKey: `pl_${phanLoai}_so`, klKey: `pl_${phanLoai}_kl` };
}

function getLeafCols(cols: any[]): any[] {
  return cols.flatMap((c: any) => (c.children ? getLeafCols(c.children) : [c]));
}

const COMPACT_WIDTHS: Record<string, number> = {
  stt: 40,
  shiftName: 100,
  macThep: 100,
  meThep: 80,
  kichThuoc: 100,
  tongSoPhoi: 50,
  tongKhoiLuong: 80,
};

function buildAntCols(cols: any[]): any[] {
  return cols.map((col: any) => {
    if (col.children)
      return { title: col.title, children: buildAntCols(col.children) };
    const width =
      COMPACT_WIDTHS[col.dataIndex] ??
      (/_so$/.test(col.dataIndex)
        ? 40
        : /_kl$/.test(col.dataIndex)
          ? 70
          : (col.width ?? 80));
    const base: any = {
      title: col.title,
      dataIndex: col.dataIndex,
      width,
      align: (col.align ?? "left") as "left" | "right" | "center",
    };
    if (/_kl$/.test(col.dataIndex) || col.dataIndex === "tongKhoiLuong")
      base.render = (v: number) =>
        v ? Math.round(v).toLocaleString("vi-VN") : "";
    else if (col.format === "number-group")
      base.render = (v: number) =>
        v
          ? Number(v).toLocaleString("vi-VN", { minimumFractionDigits: 3 })
          : "";
    return base;
  });
}

const ChiTietBienBanGiaoNhanPhoiTam = ({ readOnly = false }: { readOnly?: boolean }) => {
  const navigate = useNavigate();
  const { idphieu, navigateToDetail, safeGetDetail, redirectToList } =
    usePhieuNavigation("phieu_bbgnphoitam_id", "/viecdentoi/bbgnphoitam");

  const config = HRC2_BBSL_PhoiTam;

  const TAB_TITLES: Record<string, string> = {
    slab: "CHI TIẾT SẢN LƯỢNG PHÔI TẤM",
    tonghop: config.title,
  };
  const [activeTabKey, setActiveTabKey] = useState<string>("slab");

  // ── Phân quyền ────────────────────────────────────────────────────────────
  // isXxx: quyền thực tế của user, vẫn dùng để hiển thị các cột trạng thái (TT Đúc/Kho/PKH).
  // canAct: false khi vào từ "Xem phiếu" (vùng 3) — dùng để ẩn nút thao tác + cột tick chọn dù user có quyền chức năng.
  const userInfo = useMemo(() => {
    try {
      const s = localStorage.getItem("userinfo");
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  }, []);
  const isKCS = hasKhuVucPhu(userInfo, BM_CONFIG.HRC2.HRC2_BBSL_PhoiTam, "KCS");
  const isDuc = hasKhuVucPhu(userInfo, BM_CONFIG.HRC2.HRC2_BBSL_PhoiTam, "Duc");
  const isKho = hasKhuVucPhu(userInfo, BM_CONFIG.HRC2.HRC2_BBSL_PhoiTam, "Kho");
  const isPKH = canChotBm(userInfo, BM_CONFIG.HRC2.HRC2_BBSL_PhoiTam);
  const canAct = !readOnly;
  // Search client-side (không gọi API) cho các cột ID Slab / Ca SX / OrderID / Mẻ thép / Mác thép —
  // gõ trực tiếp vào ô input trong header cột, hoặc bấm nút Paste để dán danh sách từ Excel.
  const [idSlabSearch, setIdSlabSearch] = useState("");
  const [caSXSearch, setCaSXSearch] = useState("");
  const [orderIdSearch, setOrderIdSearch] = useState("");
  const [meThepSearch, setMeThepSearch] = useState("");
  const [macThepSearch, setMacThepSearch] = useState("");
  // Search riêng cho tab "Tổng hợp" — độc lập với bộ lọc/tìm kiếm của tab "Chi tiết slab" —
  // gắn cho 3 cột: Kíp-ngày (shiftName), Mác thép (macThep), Mẻ (meThep).
  const [thKipNgaySearch, setThKipNgaySearch] = useState("");
  const [thMacThepSearch, setThMacThepSearch] = useState("");
  const [thMeThepSearch, setThMeThepSearch] = useState("");
  // ── State ─────────────────────────────────────────────────────────────────
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [slabDetails, setSlabDetails] = useState<HrcSlabItem[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [chotLoading, setChotLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState<string | null>(null);
  const [tongHopRefreshLoading, setTongHopRefreshLoading] = useState(false);

  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteTarget, setPasteTarget] = useState<((v: string) => void) | null>(null);

  const openPasteModal = useCallback((setter: (v: string) => void) => {
    setPasteTarget(() => setter);
    setPasteText("");
    setPasteModalOpen(true);
  }, []);

  const applyPasteModal = () => {
    const vals = pasteText.split(/[\n\t,;]+/).map((s) => s.trim()).filter(Boolean);
    if (vals.length > 0 && pasteTarget) pasteTarget(vals.join(", "));
    setPasteModalOpen(false);
    setPasteText("");
  };

  // Header cột có ô tìm/paste dùng chung cho ID Slab, Ca SX, OrderID, Mẻ thép, Mác thép
  const renderSearchHeader = useCallback(
    (label: string, value: string, onChangeValue: (v: string) => void) => (
      <div>
        <div>{label}</div>
        <div style={{ display: "flex", gap: 2, marginTop: 4, minWidth: 0 }} onClick={(e) => e.stopPropagation()}>
          <Input
            size="small"
            value={value}
            onChange={(e) => onChangeValue(e.target.value)}
            placeholder="Tìm/paste..."
            allowClear
            style={{ fontWeight: "normal", flex: 1, minWidth: 0 }}
          />
          <Tooltip title="Paste từ clipboard">
            <Button size="small" icon={<SnippetsOutlined />} onClick={() => openPasteModal(onChangeValue)} />
          </Tooltip>
        </div>
      </div>
    ),
    [openPasteModal],
  );

  // ── Chốt / Hủy chốt phiếu ────────────────────────────────────────────────
  const handleChotPhieu = async () => {
    if (!idphieu) return;
    try {
      setChotLoading(true);
      await Hrc2SlabApi.chotPhieu(idphieu, getUserId());
      message.success("Đã chốt phiếu thành công");
      await loadData();
    } catch (err: any) {
      message.error(err?.message ?? "Lỗi khi chốt phiếu");
    } finally {
      setChotLoading(false);
    }
  };

  const handleHuyChotPhieu = async () => {
    if (!idphieu) return;
    try {
      setChotLoading(true);
      await Hrc2SlabApi.huyChotPhieu(idphieu, getUserId());
      message.success("Đã hủy chốt phiếu");
      await loadData();
    } catch (err: any) {
      message.error(err?.message ?? "Lỗi khi hủy chốt phiếu");
    } finally {
      setChotLoading(false);
    }
  };

  // ── Load data ─────────────────────────────────────────────────────────────
  // Nguồn dữ liệu duy nhất cho cả 2 tab: bảng chi tiết theo từng slab (đủ trangThaiDuc/Kho,
  // ngaySXTheoCa, caSanXuat, phanLoai...) — tab "Tổng hợp" tự pivot lại từ đây (xem pivotedRows)
  // để filter cùng lúc ảnh hưởng cả 2 tab, thay vì gọi riêng API group-by getRuotPhieu.
  const loadSlabRows = useCallback(async () => {
    if (!idphieu) return;
    const details = await Hrc2SlabApi.getSlabsByPhieu(idphieu, getUserId());
    setSlabDetails(details);
    setSelectedRowKeys([]);
  }, [idphieu]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setSlabDetails([]);
      setSelectedRowKeys([]);
      if (!idphieu) return;
      const [res] = await Promise.all([
        safeGetDetail(() => PhieuApi.getDetail(idphieu)),
        loadSlabRows(),
      ]);
      if (!res) return;
      setData((res as any)?.data ?? res);
    } catch (error) {
      console.error("Lỗi tải dữ liệu phiếu:", error);
      message.error("Không thể tải dữ liệu phiếu");
    } finally {
      setLoading(false);
    }
  }, [idphieu, safeGetDetail, loadSlabRows]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Chỉ làm mới dữ liệu slab cho tab "Tổng hợp slab" — không gọi loadData()
  // vì loadData() bật Card loading, khiến Tabs (uncontrolled) unmount rồi
  // remount về defaultActiveKey ("slab"), làm mất tab đang xem.
  const handleRefreshTongHop = useCallback(async () => {
    try {
      setTongHopRefreshLoading(true);
      await loadSlabRows();
    } catch (err: any) {
      message.error(err?.message ?? "Lỗi làm mới dữ liệu");
    } finally {
      setTongHopRefreshLoading(false);
    }
  }, [loadSlabRows]);

  const formData = data?.jsonData || {};
  // ── Bảng tổng hợp: build columns từ JSON config, gắn ô tìm/paste riêng cho
  // 3 cột Kíp-ngày / Mác thép / Mẻ — bộ lọc này độc lập, không dùng chung với tab chi tiết.
  const tongHopColumns = useMemo(() => {
    const base = buildAntCols(HRC2_BBSL_PhoiTam.layout[0].columns);
    // Kíp-ngày/Mác thép/Mẻ giảm 1/4 chiều rộng so với trước (150/140/150 → còn 3/4); Kích thước
    // tăng 1/5 (100 → 120) để đủ chỗ hiển thị.
    const searchable: Record<string, { value: string; setValue: (v: string) => void; width: number }> = {
      shiftName: { value: thKipNgaySearch, setValue: setThKipNgaySearch, width: 113 },
      macThep: { value: thMacThepSearch, setValue: setThMacThepSearch, width: 105 },
      meThep: { value: thMeThepSearch, setValue: setThMeThepSearch, width: 113 },
    };
    const widthOnly: Record<string, number> = {
      kichThuoc: 120,
    };
    return base.map((col: any) => {
      const cfg = searchable[col.dataIndex];
      if (cfg) return { ...col, title: renderSearchHeader(col.title, cfg.value, cfg.setValue), width: cfg.width };
      const w = widthOnly[col.dataIndex];
      if (w != null) return { ...col, width: w };
      return col;
    });
  }, [renderSearchHeader, thKipNgaySearch, thMacThepSearch, thMeThepSearch]);
  const leafCols = useMemo(
    () => getLeafCols(HRC2_BBSL_PhoiTam.layout[0].columns),
    [],
  );
  const sumKeys = useMemo(
    () =>
      leafCols
        .filter((c: any) => c.sum && c.dataIndex)
        .map((c: any) => c.dataIndex as string),
    [leafCols],
  );

  // ── Ngày/Ca của phiếu (chuẩn hóa để so với ngaySXTheoCa/caSanXuat từng slab) ─
  const phieuInfo = useMemo(
    () => ({
      ngaySX: formData?.NgaySX ? dayjs(formData.NgaySX).format("YYYY-MM-DD") : null,
      ca: formData?.ca != null ? String(formData.ca) : null,
    }),
    [formData?.NgaySX, formData?.ca],
  );

  // true = slab lệch ngày/ca so với phiếu — dùng chung cho filter "Trong ca/Ngoài ca" (dưới đây)
  // và highlight nhóm lệch (shiftGroupInfo, sau phần selectedRows).
  const isRecordMismatch = useCallback(
    (d: HrcSlabItem) => {
      const recNgay = d.ngaySXTheoCa ? dayjs(d.ngaySXTheoCa).format("YYYY-MM-DD") : null;
      const recCa = d.caSanXuat != null ? String(d.caSanXuat) : null;
      return (
        (phieuInfo.ngaySX != null && recNgay != null && recNgay !== phieuInfo.ngaySX) ||
        (phieuInfo.ca != null && recCa != null && recCa !== phieuInfo.ca)
      );
    },
    [phieuInfo],
  );

  // ── Bộ lọc dùng chung cho cả 2 tab: Trong ca/Ngoài ca — XN Đúc — XN Kho ─────
  const [filterTrongCa, setFilterTrongCa] = useState<"all" | "trongCa" | "ngoaiCa">("all");
  const [filterDuc, setFilterDuc] = useState<"all" | "chua" | "da">("all");
  const [filterKho, setFilterKho] = useState<"all" | "chua" | "da">("all");
  const hasActiveFilter = filterTrongCa !== "all" || filterDuc !== "all" || filterKho !== "all";
  const resetFilters = () => {
    setFilterTrongCa("all");
    setFilterDuc("all");
    setFilterKho("all");
  };

  const parseSearchTerms = (text: string) =>
    text.split(/[\n\t,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);

  // Lọc Ngày/Ca — Đúc — Kho dùng CHUNG cho cả 2 tab (Chi tiết slab + Tổng hợp).
  const sharedFilteredSlabDetails = useMemo(() => {
    return slabDetails.filter((d) => {
      if (filterTrongCa !== "all") {
        const mismatch = isRecordMismatch(d);
        if (filterTrongCa === "trongCa" && mismatch) return false;
        if (filterTrongCa === "ngoaiCa" && !mismatch) return false;
      }
      if (filterDuc === "chua" && d.trangThaiDuc !== 0) return false;
      if (filterDuc === "da" && d.trangThaiDuc !== 1) return false;
      if (filterKho === "chua" && d.trangThaiKho !== 0) return false;
      if (filterKho === "da" && d.trangThaiKho !== 1) return false;
      return true;
    });
  }, [slabDetails, filterTrongCa, filterDuc, filterKho, isRecordMismatch]);

  // Lọc riêng cho tab "Chi tiết slab" theo ID Slab / Ca SX / OrderID / Mẻ thép / Mác thép — tách
  // các giá trị nhập/paste theo dòng/phẩy/tab, 1 dòng khớp nếu chứa (contains, không phân biệt
  // hoa/thường) BẤT KỲ giá trị nào đã nhập. Áp dụng thêm trên nền đã lọc chung ở trên.
  const filteredSlabDetails = useMemo(() => {
    const idSlabTerms = parseSearchTerms(idSlabSearch);
    const caSXTerms = parseSearchTerms(caSXSearch);
    const orderIdTerms = parseSearchTerms(orderIdSearch);
    const meThepTerms = parseSearchTerms(meThepSearch);
    const macThepTerms = parseSearchTerms(macThepSearch);
    return sharedFilteredSlabDetails.filter((d) => {
      if (idSlabTerms.length > 0 && !idSlabTerms.some((t) => (d.idSlab ?? "").toLowerCase().includes(t))) return false;
      if (caSXTerms.length > 0 && !caSXTerms.some((t) => (d.shiftName ?? "").toLowerCase().includes(t))) return false;
      if (orderIdTerms.length > 0 && !orderIdTerms.some((t) => (d.orderId ?? "").toLowerCase().includes(t))) return false;
      if (meThepTerms.length > 0 && !meThepTerms.some((t) => (d.meThep ?? "").toLowerCase().includes(t))) return false;
      if (macThepTerms.length > 0 && !macThepTerms.some((t) => (d.macThep ?? "").toLowerCase().includes(t))) return false;
      return true;
    });
  }, [sharedFilteredSlabDetails, idSlabSearch, caSXSearch, orderIdSearch, meThepSearch, macThepSearch]);

  // Lọc riêng cho tab "Tổng hợp" theo Kíp-ngày / Mác thép / Mẻ — áp dụng thêm trên nền đã lọc
  // chung (Ngày/Ca — Đúc — Kho), độc lập với bộ lọc theo cột của tab "Chi tiết slab".
  const filteredSlabDetailsForTongHop = useMemo(() => {
    const kipNgayTerms = parseSearchTerms(thKipNgaySearch);
    const macThepTerms = parseSearchTerms(thMacThepSearch);
    const meThepTerms = parseSearchTerms(thMeThepSearch);
    return sharedFilteredSlabDetails.filter((d) => {
      if (kipNgayTerms.length > 0 && !kipNgayTerms.some((t) => (d.shiftName ?? "").toLowerCase().includes(t))) return false;
      if (macThepTerms.length > 0 && !macThepTerms.some((t) => (d.macThep ?? "").toLowerCase().includes(t))) return false;
      if (meThepTerms.length > 0 && !meThepTerms.some((t) => (d.meThep ?? "").toLowerCase().includes(t))) return false;
      return true;
    });
  }, [sharedFilteredSlabDetails, thKipNgaySearch, thMacThepSearch, thMeThepSearch]);

  // Pivot: nhóm filteredSlabDetailsForTongHop theo (meThep, macThep, kichThuoc); trải phanLoai thành cột.
  // Tự pivot client-side từ slab chi tiết (thay vì gọi API group-by riêng) để bộ lọc riêng của
  // tab "Tổng hợp" (Kíp-ngày/Mác thép/Mẻ) áp dụng được luôn — dữ liệu group-by sẵn không giữ
  // trangThaiDuc/Kho/ngaySXTheoCa theo từng slab nên không lọc lại được.
  const pivotedRows = useMemo(() => {
    const map = new Map<string, Record<string, any>>();
    filteredSlabDetailsForTongHop.forEach((d) => {
      const kt = [d.chieuDay, d.chieuRong, d.chieuDai].every((v) => v != null)
        ? `${d.chieuDay}x${d.chieuRong}x${d.chieuDai}`
        : "";
      const rowKey = `${d.meThep ?? ""}|${d.macThep ?? ""}|${kt}`;
      if (!map.has(rowKey)) {
        map.set(rowKey, {
          key: rowKey,
          shiftNames: new Set<string>(),
          meThep: d.meThep,
          macThep: d.macThep,
          kichThuoc: kt,
          tongSoPhoi: 0,
          tongKhoiLuong: 0,
        });
      }
      const row = map.get(rowKey)!;
      if (d.shiftName) (row.shiftNames as Set<string>).add(d.shiftName);
      const keys = getColKeysByPhanLoai(d.phanLoai);
      if (keys) {
        row[keys.soKey] = (row[keys.soKey] ?? 0) + 1;
        row[keys.klKey] = (row[keys.klKey] ?? 0) + (d.khoiLuong ?? 0);
      }
      row.tongSoPhoi += 1;
      row.tongKhoiLuong += d.khoiLuong ?? 0;
    });
    return Array.from(map.values()).map((r, i) => {
      const { shiftNames, ...rest } = r;
      return {
        ...rest,
        shiftName: Array.from(shiftNames as Set<string>).join(", "),
        stt: i + 1,
      };
    });
  }, [filteredSlabDetailsForTongHop]);

  // Tính tổng các cột sum
  const sumTotals = useMemo(() => {
    const t: Record<string, number> = {};
    sumKeys.forEach((k) => {
      t[k] = 0;
    });
    pivotedRows.forEach((r: any) => {
      sumKeys.forEach((k) => {
        t[k] = (t[k] ?? 0) + (r[k] ?? 0);
      });
    });
    return t;
  }, [pivotedRows, sumKeys]);

  // ── Selection ─────────────────────────────────────────────────────────────
  const selectedRows = useMemo(
    () => slabDetails.filter((r) => selectedRowKeys.includes(r.id)),
    [slabDetails, selectedRowKeys],
  );
  const selectedCount = selectedRowKeys.length;

  // ── Gom nhóm theo shiftName (Ca SX), order theo ngaySXTheoCa desc ───────────
  // Nhóm nào có ngaySXTheoCa/caSanXuat khác Ngày/Ca của phiếu → tô nền xanh lá nhạt để
  // nhận biết đây là các ID Slab "lạc" ngày/ca so với phiếu BBSL đang xem.
  const groupedSlabDetails = useMemo(() => {
    const groups = new Map<string, HrcSlabItem[]>();
    filteredSlabDetails.forEach((d) => {
      const key = d.shiftName ?? "";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(d);
    });
    return Array.from(groups.values())
      .sort((a, b) => {
        const na = a[0]?.ngaySXTheoCa ?? "";
        const nb = b[0]?.ngaySXTheoCa ?? "";
        return nb.localeCompare(na); // desc — nhóm gần đây nhất lên trước
      })
      .flatMap((rows) => rows);
  }, [filteredSlabDetails]);

  const shiftGroupInfo = useMemo(() => {
    const mismatchMap = new Map<number, boolean>();
    let i = 0;
    while (i < groupedSlabDetails.length) {
      const shiftName = groupedSlabDetails[i].shiftName;
      let j = i;
      while (j < groupedSlabDetails.length && groupedSlabDetails[j].shiftName === shiftName) j++;
      const groupRows = groupedSlabDetails.slice(i, j);
      const isMismatch = isRecordMismatch(groupRows[0]);
      groupRows.forEach((r) => mismatchMap.set(r.id, isMismatch));
      i = j;
    }
    return { mismatchMap };
  }, [groupedSlabDetails, isRecordMismatch]);

  const rowSelection: TableRowSelection<HrcSlabItem> = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys),
    columnWidth: 32,
    // 4 cột đầu (Đã check/Ca SX/ID Slab/OrderID) đang fixed "left" — cột tick chọn dòng
    // cũng phải fixed để bám theo nhóm cột đó, không thì khi cuộn ngang cột tick sẽ trôi
    // đi trong khi các cột kia đứng yên, gây lệch hàng.
    fixed: true,
  };

  // ── Enable conditions ─────────────────────────────────────────────────────
  const canXacNhanDuc =
    selectedCount > 0 &&
    selectedRows.every((r) => r.trangThaiDuc === 0 && r.trangThaiPKH === 0);
  const canHuyDuc =
    selectedCount > 0 &&
    selectedRows.every((r) => r.trangThaiDuc === 1 && r.trangThaiPKH === 0);
  const canXacNhanKho =
    selectedCount > 0 &&
    selectedRows.every((r) => r.trangThaiKho === 0 && r.trangThaiPKH === 0);
  const canHuyKho =
    selectedCount > 0 &&
    selectedRows.every((r) => r.trangThaiKho === 1 && r.trangThaiPKH === 0);
  // PKH chỉ chốt được khi cả Đúc và Kho đã xác nhận
  const canChot =
    selectedCount > 0 &&
    selectedRows.every(
      (r) => r.trangThaiDuc === 1 && r.trangThaiKho === 1 && r.trangThaiPKH === 0,
    );
  const canHuyChot =
    selectedCount > 0 && selectedRows.every((r) => r.trangThaiPKH === 1);
  // Đánh dấu "đã check" — độc lập theo user, không phụ thuộc trạng thái workflow
  const canCheck =
    selectedCount > 0 && selectedRows.every((r) => !r.daCheck);
  const canUnCheck =
    selectedCount > 0 && selectedRows.every((r) => r.daCheck);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleXacNhan = async (loai: "KCS" | "Duc" | "Kho" | "PKH") => {
    try {
      setActionLoading(true);
      const ids = selectedRows.map((r) => r.id);
      await Hrc2SlabApi.xacNhan(ids, loai, getUserId());
      message.success(`Xác nhận ${loai} thành công cho ${ids.length} slab`);
      await loadData();
    } catch (err: any) {
      message.error(err?.message ?? `Lỗi xác nhận ${loai}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleHuyXacNhan = async (loai: "KCS" | "Duc" | "Kho" | "PKH") => {
    try {
      setActionLoading(true);
      const ids = selectedRows.map((r) => r.id);
      await Hrc2SlabApi.huyXacNhan(ids, loai, getUserId());
      message.success(`Hủy xác nhận ${loai} thành công cho ${ids.length} slab`);
      await loadData();
    } catch (err: any) {
      message.error(err?.message ?? `Lỗi hủy xác nhận ${loai}`);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Đánh dấu "đã check" (độc lập theo user, không thuộc workflow xác nhận) ──
  const handleCheck = async () => {
    try {
      setActionLoading(true);
      const ids = selectedRows.map((r) => r.id);
      await Hrc2SlabApi.check(ids, getUserId());
      message.success(`Đã check ${ids.length} slab`);
      await loadData();
    } catch (err: any) {
      message.error(err?.message ?? "Lỗi check");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnCheck = async () => {
    try {
      setActionLoading(true);
      const ids = selectedRows.map((r) => r.id);
      await Hrc2SlabApi.unCheck(ids, getUserId());
      message.success(`Đã bỏ check ${ids.length} slab`);
      await loadData();
    } catch (err: any) {
      message.error(err?.message ?? "Lỗi bỏ check");
    } finally {
      setActionLoading(false);
    }
  };

  // ── Export handlers ───────────────────────────────────────────────────────

  const handleExportChiTietExcel = useCallback(async () => {
    if (!idphieu) return;
    setExportLoading("chitiet-excel");
    try {
      await Hrc2SlabApi.exportExcel(idphieu, "chitiet", getUserId());
    } catch (e: any) {
      message.error(e?.message ?? "Lỗi xuất Excel");
    } finally { setExportLoading(null); }
  }, [idphieu]);

  const handleExportTongHopExcel = useCallback(async () => {
    if (!idphieu) return;
    setExportLoading("tonghop-excel");
    try {
      await Hrc2SlabApi.exportExcel(idphieu, "tonghop");
    } catch (e: any) {
      message.error(e?.message ?? "Lỗi xuất Excel");
    } finally { setExportLoading(null); }
  }, [idphieu]);

  const handleExportTongHopPdf = useCallback(async () => {
    if (!idphieu) return;
    setExportLoading("tonghop-pdf");
    try {
      await Hrc2SlabApi.exportPdf(idphieu);
    } catch (e: any) {
      message.error(e?.message ?? "Lỗi xuất PDF");
    } finally { setExportLoading(null); }
  }, [idphieu]);

  // ── Columns bảng slab chi tiết ────────────────────────────────────────────
  const detailColumns = useMemo(
    () => [
      {
        title: "Đã check",
        dataIndex: "daCheck",
        width: 90,
        align: "center" as const,
        fixed: "left" as const,
        render: (v: boolean) => (
          <Tag color={v ? "green" : "default"}>{v ? "Đã check" : "Chưa"}</Tag>
        ),
      },
      {
        title: renderSearchHeader("Ca SX", caSXSearch, setCaSXSearch),
        dataIndex: "shiftName",
        width: 160,
        align: "center" as const,
        fixed: "left" as const,
        render: (v: string) => v ?? "-",
      },
      {
        title: renderSearchHeader("ID Slab", idSlabSearch, setIdSlabSearch),
        dataIndex: "idSlab",
        width: 150,
        align: "center" as const,
        fixed: "left" as const,
      },
      {
        title: renderSearchHeader("OrderID", orderIdSearch, setOrderIdSearch),
        dataIndex: "orderId",
        width: 150,
        align: "center" as const,
        fixed: "left" as const,
      },
      {
        title: renderSearchHeader("Mẻ thép", meThepSearch, setMeThepSearch),
        dataIndex: "meThep",
        width: 140,
        align: "center" as const,
      },
      {
        title: "Máy đúc",
        dataIndex: "mayDuc",
        width: 70,
        align: "center" as const,
        render: (v: number) => v != null ? `Đúc ${v}` : "-",
      },
      {
        title: "Kích thước",
        dataIndex: "kichThuoc",
        width: 130,
        align: "center" as const,
        render: (_: unknown, r: HrcSlabItem) =>
          [r.chieuDay, r.chieuRong, r.chieuDai].every((v) => v != null)
            ? `${r.chieuDay}x${r.chieuRong}x${r.chieuDai}`
            : "-",
      },
      {
        title: renderSearchHeader("Mác thép", macThepSearch, setMacThepSearch),
        dataIndex: "macThep",
        width: 160,
        align: "center" as const,
      },
      {
        title: "Khối lượng",
        dataIndex: "khoiLuong",
        width: 110,
        align: "right" as const,
        render: (v: number, r: HrcSlabItem) => {
          const fmt = (x: number | null | undefined) =>
            x != null ? Number(x).toLocaleString("vi-VN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : "-";
          if (r.khoiLuongManual == null) return fmt(v);
          return (
            <Tooltip
              title={
                <div>
                  <div>KL nhà máy: <b>{fmt(r.khoiLuongGoc)}</b></div>
                  <div>KL sửa tay: <b>{fmt(r.khoiLuongManual)}</b></div>
                  <div>Lý do: {r.lyDoSua ?? "-"}</div>
                  <div>Số BBSV: {r.soBBSV ?? "-"}</div>
                  <div>Người sửa: {r.nguoiSuaKL ?? "-"}</div>
                  <div>Lúc: {r.thoiDiemSuaKL ? dayjs(r.thoiDiemSuaKL).format("DD/MM/YYYY HH:mm:ss") : "-"}</div>
                </div>
              }
            >
              <span style={{ fontWeight: 600 }}>{fmt(v)}</span>
            </Tooltip>
          );
        },
      },
      { title: "Chất lượng", dataIndex: "chatLuong", width: 90 },
      {
        title: "KCS",
        dataIndex: "nguoiChuyenBBSL",
        width: 120,
      },
      {
        title: "TT KCS",
        dataIndex: "trangThaiKCS",
        width: 90,
        align: "center" as const,
        render: (v: number) => (
          <Tag color={TT_COLOR[v]}>{v === 1 ? "Đã XN" : "Chưa"}</Tag>
        ),
      },
      {
        title: "Đúc",
        dataIndex: "nguoiXacNhanDuc",
        width: 120,
      },
      {
        title: "TT Đúc",
        dataIndex: "trangThaiDuc",
        width: 90,
        align: "center" as const,
        render: (v: number) => (
          <Tag color={TT_COLOR[v]}>{v === 1 ? "Đã XN" : "Chưa"}</Tag>
        ),
      },
      {
        title: "Kho",
        dataIndex: "nguoiXacNhanKho",
        width: 120,
      },
      {
        title: "TT Kho",
        dataIndex: "trangThaiKho",
        width: 90,
        align: "center" as const,
        render: (v: number) => (
          <Tag color={TT_COLOR[v]}>{v === 1 ? "Đã XN" : "Chưa"}</Tag>
        ),
      },
      {
        title: "TT PKH",
        dataIndex: "trangThaiPKH",
        width: 90,
        align: "center" as const,
        render: (v: number) => (
          //
          <Tag color={TT_COLOR[v]}>{v === 1 ? "Đã Chốt" : "Chưa"}</Tag>
        ),
      },

    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isKCS, isDuc, isKho, isPKH, renderSearchHeader, caSXSearch, idSlabSearch, orderIdSearch, meThepSearch, macThepSearch],
  );

  // Áp rowSpan gom nhóm theo shiftName lên cột "Ca SX" + tô nền xanh lá nhạt cho mọi cột của
  // các dòng thuộc nhóm lệch ngày/ca so với phiếu — dùng onCell per-column vì rowSpan khiến ô
  // merge không nhận được style tô nền qua onRow (onRow chỉ style <tr>, không phủ được ô đang
  // span xuống từ dòng trước).
  // Dòng có KL đã được KCS sửa tay: tô vàng cả dòng (ô KL đậm hơn), ưu tiên hơn nền xanh lệch ngày/ca —
  // riêng cột "Ca SX" vẫn giữ xanh nếu lệch để không mất thông tin lệch ca.
  const MISMATCH_BG = "#f6ffed";
  const KL_SUA_ROW_BG = "#fffbe6";
  const KL_SUA_CELL_BG = "#ffe58f";
  const groupedDetailColumns = useMemo(
    () =>
      detailColumns.map((col) => ({
        ...col,
        onCell: (record: HrcSlabItem) => {
          const isMismatch = shiftGroupInfo.mismatchMap.get(record.id);
          const isSuaKL = record.khoiLuongManual != null;
          let bg: string | undefined;
          if (isSuaKL && col.dataIndex === "khoiLuong") bg = KL_SUA_CELL_BG;
          else if (isMismatch && (!isSuaKL || col.dataIndex === "shiftName")) bg = MISMATCH_BG;
          else if (isSuaKL) bg = KL_SUA_ROW_BG;
          return { style: bg ? { backgroundColor: bg } : undefined };
        },
      })),
    [detailColumns, shiftGroupInfo],
  );

  // ── Action buttons phiếu ──────────────────────────────────────────────────
  const getUserInfo = useCallback(() => {
    const stored = localStorage.getItem("userinfo");
    return stored ? JSON.parse(stored) : {};
  }, []);

  const handleActionSuccess = useCallback(
    async (context?: { newPhieuId?: string }) => {
      if (context?.newPhieuId) {
        navigateToDetail(context.newPhieuId, "/form-bbgnphoitam");
        return;
      }
      await loadData();
    },
    [loadData, navigateToDetail],
  );

  const actionButtons = useMemo(() => {
    if (readOnly || !data || !idphieu) return null;
    const ui = getUserInfo();
    if (getBmQuyenUiFlags(config.code, ui).isView) return null;
    const buttons = phieuActionService.getActionButtons({
      phieuId: idphieu,
      tinhTrang: data.tinhTrang ?? 0,
      isClone: data.isClone ?? false,
      currentUserId: ui.iD_TaiKhoan ?? null,
      currentUserPhongBanId: ui.iD_PhongBan ?? null,
      currentUserTenNgan: ui.tenNgan ?? null,
      nguoiTaoId: data.nguoiTaoId ?? null,
      phieuPhongBanId: data.idphongBan ?? null,
      pheDuyet: data.pheDuyet ?? [],
      redirectToList,
      onSuccess: handleActionSuccess,
      onError: (error) => {
        console.error("Action error:", error);
        message.error(
          (error as any)?.message ?? "Không thể thực hiện thao tác",
        );
      },
    });
    const filteredButtons = buttons.filter(
      (btn) => !DETAIL_HIDDEN_BUTTON_KEYS.has(btn.key),
    );
    if (filteredButtons.length === 0) return null;
    return phieuActionService.renderActionButtons(
      filteredButtons,
      idphieu || "",
    );
  }, [
    readOnly,
    data,
    idphieu,
    config.code,
    getUserInfo,
    handleActionSuccess,
    redirectToList,
  ]);

  // const hasWorkflowButtons = isDuc || isKho || isPKH;

  // ── Nút Chốt phiếu dùng chung cho cả 2 tab ────────────────────────────────
  const chotPhieuButtons = (
    <>
      {canAct && isPKH && data?.tinhTrang !== 5 && (
        <Popconfirm
          title="Chốt phiếu này? Sau khi chốt sẽ không thể chuyển thêm slab vào."
          onConfirm={handleChotPhieu}
        >
          <Button size="small" type="primary" icon={<LockOutlined />} loading={chotLoading}>
            Chốt phiếu
          </Button>
        </Popconfirm>
      )}
      {canAct && isPKH && data?.tinhTrang === 5 && (
        <Popconfirm title="Hủy chốt phiếu này?" onConfirm={handleHuyChotPhieu}>
          <Button size="small" danger icon={<UnlockOutlined />} loading={chotLoading}>
            Hủy chốt
          </Button>
        </Popconfirm>
      )}
    </>
  );

  return (
    <Card
      bordered
      style={{ padding: 24, background: "#fff" }}
      loading={loading}
    >
      <div style={{ position: "relative", textAlign: "center", marginBottom: 16 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(-1)}
          style={{ position: "absolute", left: 0, top: 0 }}
        >
          Quay lại
        </Button>
        <Title level={4} style={{ marginBottom: 0 }}>
          {TAB_TITLES[activeTabKey] ?? config.title}
        </Title>
        {idphieu && <b>Số phiếu: {data?.soPhieu}</b>}
      </div>

      {/* Bộ lọc Ngày/Ca — Đúc — Kho: dùng CHUNG cho cả 2 tab (Chi tiết slab + Tổng hợp) */}
      <Card size="small" style={{ marginBottom: 12 }} bodyStyle={{ padding: "8px 12px" }}>
        <Space wrap size={[16, 8]}>
          <Space size={4}>
            <span style={{ color: "#555" }}>Ngày/Ca:</span>
            <Radio.Group
              size="small"
              value={filterTrongCa}
              onChange={(e) => setFilterTrongCa(e.target.value)}
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value="all" style={filterBtnStyle("all", filterTrongCa)}>Tất cả</Radio.Button>
              <Radio.Button value="trongCa" style={filterBtnStyle("trongCa", filterTrongCa)}>Trong ca</Radio.Button>
              <Radio.Button value="ngoaiCa" style={filterBtnStyle("ngoaiCa", filterTrongCa)}>Ngoài ca</Radio.Button>
            </Radio.Group>
          </Space>
          <Space size={4}>
            <span style={{ color: "#555" }}>Đúc:</span>
            <Radio.Group
              size="small"
              value={filterDuc}
              onChange={(e) => setFilterDuc(e.target.value)}
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value="all" style={filterBtnStyle("all", filterDuc)}>Tất cả</Radio.Button>
              <Radio.Button value="chua" style={filterBtnStyle("chua", filterDuc)}>Chưa XN</Radio.Button>
              <Radio.Button value="da" style={filterBtnStyle("da", filterDuc)}>Đã XN</Radio.Button>
            </Radio.Group>
          </Space>
          <Space size={4}>
            <span style={{ color: "#555" }}>Kho:</span>
            <Radio.Group
              size="small"
              value={filterKho}
              onChange={(e) => setFilterKho(e.target.value)}
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value="all" style={filterBtnStyle("all", filterKho)}>Tất cả</Radio.Button>
              <Radio.Button value="chua" style={filterBtnStyle("chua", filterKho)}>Chưa XN</Radio.Button>
              <Radio.Button value="da" style={filterBtnStyle("da", filterKho)}>Đã XN</Radio.Button>
            </Radio.Group>
          </Space>
          {hasActiveFilter && (
            <Button size="small" onClick={resetFilters}>
              Xóa lọc
            </Button>
          )}
          <span style={{ color: "#888" }}>
            Đang hiển thị {sharedFilteredSlabDetails.length}/{slabDetails.length} slab
          </span>
        </Space>
      </Card>

      <Tabs
        defaultActiveKey="slab"
        onChange={setActiveTabKey}
        type="card"
        style={{ padding: "0 8px" }}
        items={[
          {
            key: "slab",
            label: "Chi tiết slab",
            children: (
              <>
                <Descriptions bordered size="small" column={2}>
                  <Descriptions.Item label="Số phiếu">
                    {data?.soPhieu || ""}
                  </Descriptions.Item>
                  <Descriptions.Item label="Ngày lên BBSL">
                    {formData?.NgaySX
                      ? dayjs(formData.NgaySX).format("DD/MM/YYYY")
                      : ""}
                  </Descriptions.Item>
                  <Descriptions.Item label="Ca lên BBSL">
                    {formData?.ca == 1
                      ? "Ca ngày"
                      : formData?.ca == 2
                        ? "Ca đêm"
                        : ""}
                  </Descriptions.Item>
                  <Descriptions.Item label="Kíp">
                    {data?.kip || ""}
                  </Descriptions.Item>
                </Descriptions>

                <Card
                  size="small"
                  title={`Danh sách slab (${filteredSlabDetails.length})${selectedCount > 0 ? ` — Đã chọn ${selectedCount}` : ""}`}
                  style={{ marginTop: 16 }}
                  bodyStyle={{ padding: "8px 12px" }}
                  extra={
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Button
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={() => void loadData()}
                        loading={loading}
                      >
                        Làm mới
                      </Button>
                      <Button
                        size="small"
                        icon={<FileExcelOutlined />}
                        loading={exportLoading === "chitiet-excel"}
                        onClick={() => void handleExportChiTietExcel()}
                        style={{ color: "#217346" }}
                      >
                        Excel
                      </Button>
                      <>
                          <Popconfirm
                            title={`Check ${selectedCount} slab?`}
                            onConfirm={handleCheck}
                            disabled={!canCheck}
                          >
                            <Button
                              size="small"
                              icon={<CheckCircleOutlined />}
                              disabled={!canCheck}
                              loading={actionLoading}
                            >
                              Check
                            </Button>
                          </Popconfirm>
                          <Popconfirm
                            title={`Bỏ check ${selectedCount} slab?`}
                            onConfirm={handleUnCheck}
                            disabled={!canUnCheck}
                          >
                            <Button
                              size="small"
                              icon={<CloseCircleOutlined />}
                              disabled={!canUnCheck}
                              loading={actionLoading}
                              danger
                            >
                              Bỏ check
                            </Button>
                          </Popconfirm>
                      </>
                      {canAct && isDuc && (
                        <>
                          <Popconfirm
                            title={`Xác nhận Đúc ${selectedCount} slab?`}
                            onConfirm={() => handleXacNhan("Duc")}
                            disabled={!canXacNhanDuc}
                          >
                            <Button
                              size="small"
                              icon={<CheckCircleOutlined />}
                              disabled={!canXacNhanDuc}
                              loading={actionLoading}
                              style={{
                                color: canXacNhanDuc ? "#1890ff" : undefined,
                              }}
                            >
                              XN Đúc
                            </Button>
                          </Popconfirm>
                          <Popconfirm
                            title={`Hủy XN Đúc ${selectedCount} slab?`}
                            onConfirm={() => handleHuyXacNhan("Duc")}
                            disabled={!canHuyDuc}
                          >
                            <Button
                              size="small"
                              icon={<CloseCircleOutlined />}
                              disabled={!canHuyDuc}
                              loading={actionLoading}
                              danger
                            >
                              Hủy XN Đúc
                            </Button>
                          </Popconfirm>
                        </>
                      )}
                      {canAct && isKho && (
                        <>
                          <Popconfirm
                            title={`Xác nhận Kho ${selectedCount} slab?`}
                            onConfirm={() => handleXacNhan("Kho")}
                            disabled={!canXacNhanKho}
                          >
                            <Button
                              size="small"
                              icon={<CheckCircleOutlined />}
                              disabled={!canXacNhanKho}
                              loading={actionLoading}
                              style={{
                                color: canXacNhanKho ? "#52c41a" : undefined,
                              }}
                            >
                              XN Kho
                            </Button>
                          </Popconfirm>
                          <Popconfirm
                            title={`Hủy XN Kho ${selectedCount} slab?`}
                            onConfirm={() => handleHuyXacNhan("Kho")}
                            disabled={!canHuyKho}
                          >
                            <Button
                              size="small"
                              icon={<CloseCircleOutlined />}
                              disabled={!canHuyKho}
                              loading={actionLoading}
                              danger
                            >
                              Hủy XN Kho
                            </Button>
                          </Popconfirm>
                        </>
                      )}

                      {chotPhieuButtons}
                      {/* {isPKH && (
                        <>
                          <Popconfirm
                            title={`Chốt PKH ${selectedCount} slab?`}
                            onConfirm={() => handleXacNhan("PKH")}
                            disabled={!canChot}
                          >
                            <Button
                              size="small"
                              icon={<CheckCircleOutlined />}
                              disabled={!canChot}
                              loading={actionLoading}
                              style={{ color: canChot ? "#722ed1" : undefined }}
                            >
                              Chốt PKH
                            </Button>
                          </Popconfirm>
                          <Popconfirm
                            title={`Hủy chốt PKH ${selectedCount} slab?`}
                            onConfirm={() => handleHuyXacNhan("PKH")}
                            disabled={!canHuyChot}
                          >
                            <Button
                              size="small"
                              icon={<CloseCircleOutlined />}
                              disabled={!canHuyChot}
                              loading={actionLoading}
                              danger
                            >
                              Hủy chốt
                            </Button>
                          </Popconfirm>
                        </>
                      )} */}
                    </div>
                  }
                >
                  <Table<HrcSlabItem>
                    rowKey="id"
                    rowSelection={rowSelection}
                    size="small"
                    bordered
                    virtual
                    columns={groupedDetailColumns}
                    dataSource={groupedSlabDetails}
                    pagination={false}
                    scroll={{ x: "max-content", y: 520 }}
                    sticky={{ offsetHeader: 0 }}
                    summary={() => {
                      const totalKL = filteredSlabDetails.reduce((s, r) => s + (r.khoiLuong ?? 0), 0);
                      const optColCount = (isKCS ? 1 : 0) + (isDuc ? 1 : 0) + (isKho ? 1 : 0) + (isPKH ? 1 : 0);
                      return (
                        <Table.Summary fixed>
                          <Table.Summary.Row>
                            <Table.Summary.Cell index={0} colSpan={9} align="center">
                              <strong>Tổng</strong>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={10} align="right">
                              <strong>{Number(totalKL).toLocaleString("vi-VN", { minimumFractionDigits: 3 })}</strong>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={10} colSpan={1 + optColCount + 1} />
                          </Table.Summary.Row>
                        </Table.Summary>
                      );
                    }}
                  />
                </Card>
              </>
            ),
          },
          {
            key: "tonghop",
            label: "Biên bản sản lượng",
            children: (
              <>
                <Descriptions bordered size="small" column={2}>
                  <Descriptions.Item label="Số phiếu">
                    {data?.soPhieu || ""}
                  </Descriptions.Item>
                  <Descriptions.Item label="Ngày lên BBSL">
                    {formData?.NgaySX
                      ? dayjs(formData.NgaySX).format("DD/MM/YYYY")
                      : ""}
                  </Descriptions.Item>
                  <Descriptions.Item label="Ca lên BBSL">
                    {formData?.ca == 1
                      ? "Ca ngày"
                      : formData?.ca == 2
                        ? "Ca đêm"
                        : ""}
                  </Descriptions.Item>
                  <Descriptions.Item label="Kíp">
                    {data?.kip || ""}
                  </Descriptions.Item>
                </Descriptions>
                <div style={{ display: "flex", gap: 8, marginTop: 12, marginBottom: 8, justifyContent: "flex-end" }}>
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={() => void handleRefreshTongHop()}
                    loading={tongHopRefreshLoading}
                  >
                    Làm mới
                  </Button>
                  <Button
                    size="small"
                    icon={<FileExcelOutlined />}
                    loading={exportLoading === "tonghop-excel"}
                    onClick={() => void handleExportTongHopExcel()}
                    style={{ color: "#217346" }}
                  >
                    Excel
                  </Button>
                  <Button
                    size="small"
                    icon={<FilePdfOutlined />}
                    loading={exportLoading === "tonghop-pdf"}
                    onClick={() => void handleExportTongHopPdf()}
                    danger
                  >
                    PDF
                  </Button>
                  {chotPhieuButtons}
                </div>
                <div style={{ marginTop: 0, fontSize: 11, lineHeight: 1.4 }}>
                  <Table
                    bordered
                    style={{}}
                    columns={tongHopColumns}
                    dataSource={pivotedRows}
                    pagination={false}
                    size="small"
                    scroll={{ x: 1676 }}
                    sticky={{ offsetHeader: 0 }}
                    summary={() => (
                      <Table.Summary fixed>
                        <Table.Summary.Row>
                          {leafCols.map((col: any, idx: number) => {
                            if (idx > 0 && idx < 5) {
                              return (
                                <Table.Summary.Cell
                                  key={col.dataIndex ?? idx}
                                  index={idx}
                                  colSpan={0}
                                />
                              );
                            }
                            if (idx === 0) {
                              return (
                                <Table.Summary.Cell
                                  key="tong-label"
                                  index={0}
                                  colSpan={5}
                                  align="center"
                                >
                                  <strong>Tổng</strong>
                                </Table.Summary.Cell>
                              );
                            }
                            const val = sumTotals[col.dataIndex];
                            let content: any = null;
                            if (col.sum && val != null) {
                              const formatted =
                                /_kl$/.test(col.dataIndex) ||
                                col.dataIndex === "tongKhoiLuong"
                                  ? Math.round(val).toLocaleString("vi-VN")
                                  : Number(val).toLocaleString("vi-VN");
                              content = <strong>{formatted}</strong>;
                            }
                            return (
                              <Table.Summary.Cell
                                key={col.dataIndex ?? idx}
                                index={idx}
                                align={col.align ?? "left"}
                              >
                                {content}
                              </Table.Summary.Cell>
                            );
                          })}
                        </Table.Summary.Row>
                      </Table.Summary>
                    )}
                  />
                </div>
              </>
            ),
          },
        ]}
      />

      {/* ── Bảng slab chi tiết (Đúc / Kho / PKH xác nhận) ── */}

      {/* ── Bảng tổng hợp (pivot theo cấu trúc JSON config) ── */}

      {/* Ký duyệt */}
      {/* <Row justify="space-around" align="top" style={{ textAlign: "center", marginTop: 30 }}>
        {config.signatures.map((sig) => {
          const duyet = data?.pheDuyet?.find((p: any) => p.capDuyet === sig.capduyet);
          return (
            <Col key={sig.capduyet}>
              <Text strong>{sig.label}</Text>
              <br />
              <Text type="secondary">
                <Text>{duyet?.tinhTrang === 1 ? "Đã ký" : "Chưa xử lý"}</Text>
                <br />
                {duyet?.tenNguoiDuyet}
              </Text>
            </Col>
          );
        })}
      </Row> */}

      {/* Action buttons phiếu */}
      {/* {actionButtons && (
        <div
          style={{
            textAlign: "center",
            marginTop: 32,
            display: "flex",
            gap: 8,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {actionButtons}
        </div>
      )} */}
      {/* Popup paste danh sách Số Mẻ / ID Slab (dùng chung) */}
      <Modal
        title="Paste danh sách"
        open={pasteModalOpen}
        onOk={applyPasteModal}
        onCancel={() => { setPasteModalOpen(false); setPasteText(""); }}
        okText="Xác nhận"
        cancelText="Hủy"
        destroyOnClose
      >
        <p style={{ marginBottom: 8, color: "#666", fontSize: 12 }}>
          Paste danh sách từ Excel (mỗi dòng 1 giá trị, hoặc phân cách bằng dấu phẩy/tab).
        </p>
        <Input.TextArea
          autoFocus
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="Paste dữ liệu từ Excel vào đây..."
          rows={8}
        />
      </Modal>
    </Card>
  );
};

export default ChiTietBienBanGiaoNhanPhoiTam;
