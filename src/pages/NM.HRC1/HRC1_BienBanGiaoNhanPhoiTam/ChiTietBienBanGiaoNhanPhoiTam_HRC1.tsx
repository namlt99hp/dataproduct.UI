/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Row,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import type { TableRowSelection } from "antd/es/table/interface";
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SnippetsOutlined,
  SyncOutlined,
  LockOutlined,
  UnlockOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { usePhieuNavigation } from "../../../hooks/usePhieuNavigation";
import { PhieuApi } from "../../../services/PhieuApi";
import {
  Hrc1SlabApi,
  type Hrc1SlabItem,
  type Hrc1TongHopGhiChuItem,
} from "../../../services/Hrc1SlabApi";
import {
  getBmQuyenUiFlags,
  hasKhuVucPhu,
  canChotBm,
} from "../../../utils/helpers/checkAdminRole";
import { phieuActionService } from "../../../services/PhieuActionService";
import { DETAIL_HIDDEN_BUTTON_KEYS } from "../../../utils/constants/PhieuActionButtonKeys";
import { BM_CONFIG } from "../../../utils/configs/BieuMauConst";

const { Title } = Typography;

const MA_BM = BM_CONFIG.HRC1.HRC1_BBSL_PhoiTam as string;
const TT_COLOR: Record<number, string> = { 0: "default", 1: "green" };

// Màu theo Ý NGHĨA (không theo vị trí) để nhất quán giữa các nhóm filter: xám = "Tất cả" (không
// lọc), xanh = trạng thái "đã xong" (đã xác nhận), cam = trạng thái "cần chú ý" (chưa xác nhận).
const FILTER_BTN_COLOR: Record<string, { background: string; borderColor: string; color: string }> = {
  all: { background: "#f5f5f5", borderColor: "#d9d9d9", color: "rgba(0, 0, 0, 0.88)" },
  da: { background: "#52c41a", borderColor: "#52c41a", color: "#fff" },
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
  } catch { /* empty */ }
  return 0;
};



// Tính ca đích khi chuyển phôi
const tinhCaDich = (phieuNgaySX: string, phieuCa: number, huong: "truoc" | "sau") => {
  const ngay = dayjs(phieuNgaySX);
  if (phieuCa === 1) {
    return huong === "truoc"
      ? { ca: 2, ngay: ngay.subtract(1, "day") }
      : { ca: 2, ngay };
  }
  return huong === "truoc"
    ? { ca: 1, ngay }
    : { ca: 1, ngay: ngay.add(1, "day") };
};

// ── Row edit state ──────────────────────────────────────────────────────────
type RowEdit = { ghiChu: string };

const ChiTietBienBanGiaoNhanPhoiTam_HRC1 = ({ readOnly = false }: { readOnly?: boolean }) => {
  const { idphieu, navigateToDetail, safeGetDetail, redirectToList } =
    usePhieuNavigation("phieu_bbgnphoitam_hrc1_id", "/viecdentoi/bbgnphoitam_hrc1");

  // ── Phân quyền ────────────────────────────────────────────────────────────
  // Vào từ "Xem phiếu" (vùng 3) → luôn chỉ xem, không cho thao tác dù user có quyền chức năng.
  const userInfo = useMemo(() => {
    try {
      const s = localStorage.getItem("userinfo");
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  }, []);
  const isDuc = !readOnly && hasKhuVucPhu(userInfo, MA_BM, "Duc");
  const isCan = !readOnly && hasKhuVucPhu(userInfo, MA_BM, "Can");
  const isC4 = !readOnly && hasKhuVucPhu(userInfo, MA_BM, "C4");
  const isPKH = !readOnly && canChotBm(userInfo, MA_BM);

  // ── State ─────────────────────────────────────────────────────────────────
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [slabDetails, setSlabDetails] = useState<Hrc1SlabItem[]>([]);
  const [tongHopGhiChu, setTongHopGhiChu] = useState<Hrc1TongHopGhiChuItem[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [chotLoading, setChotLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);

  const [chuyenLoading, setChuyenLoading] = useState<"truoc" | "sau" | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [tongHopRefreshLoading, setTongHopRefreshLoading] = useState(false);

  // Search client-side (không gọi API) cho cột Số Mẻ / ID Slab trong tab chi tiết —
  // gõ trực tiếp vào ô input, hoặc bấm nút Paste để mở popup dán danh sách
  // (mỗi dòng/phẩy/tab 1 giá trị) từ Excel.
  const [maMeSearch, setMaMeSearch] = useState("");
  const [idSlabSearch, setIdSlabSearch] = useState("");

  // Bộ lọc theo trạng thái 4 cấp xác nhận — dùng CHUNG cho cả 2 tab (Chi tiết + Tổng hợp).
  const [filterDuc, setFilterDuc] = useState<"all" | "chua" | "da">("all");
  const [filterCan, setFilterCan] = useState<"all" | "chua" | "da">("all");
  const [filterC4, setFilterC4] = useState<"all" | "chua" | "da">("all");
  const [filterPKH, setFilterPKH] = useState<"all" | "chua" | "da">("all");
  const hasActiveFilter = filterDuc !== "all" || filterCan !== "all" || filterC4 !== "all" || filterPKH !== "all";
  const resetFilters = () => {
    setFilterDuc("all");
    setFilterCan("all");
    setFilterC4("all");
    setFilterPKH("all");
  };

  // ── Thêm mới / Sửa slab thủ công (tab "Chi tiết") ────────────────────────
  // Dùng chung 1 Modal/Form cho cả 2 chế độ — bộ field giống hệt nhau, chỉ khác nguồn dữ liệu
  // fill vào form lúc mở (rỗng khi Thêm mới, fill từ dòng đang chọn khi Sửa) và API gọi lúc Lưu.
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addForm] = Form.useForm();
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [editingSlabId, setEditingSlabId] = useState<number | null>(null);

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

  const TAB_TITLES: Record<string, string> = {
    chitiet: "BIÊN BẢN GIAO NHẬN PHÔI TẤM",
    tonghop: "BIÊN BẢN XÁC NHẬN SẢN LƯỢNG PHÔI TẤM",
  };
  const [activeTabKey, setActiveTabKey] = useState<string>("chitiet");

  // inline edits per slab id
  const [rowEdits, setRowEdits] = useState<Record<number, RowEdit>>({});
  // tonghop ghi chu local edits: key = "macThep|maVatTu"
  const [thGhiChuEdits, setThGhiChuEdits] = useState<Record<string, string>>({});

  // ── Load data ─────────────────────────────────────────────────────────────
  const loadSlabs = useCallback(async () => {
    if (!idphieu) return;
    const [details, ghiChuList] = await Promise.all([
      Hrc1SlabApi.getSlabsByPhieu(idphieu),
      Hrc1SlabApi.getTongHopGhiChu(idphieu),
    ]);
    setSlabDetails(details);
    setTongHopGhiChu(ghiChuList);
    setSelectedRowKeys([]);
    const edits: Record<number, RowEdit> = {};
    details.forEach((s) => { edits[s.id] = { ghiChu: s.ghiChu ?? "" }; });
    setRowEdits(edits);
    const thEdits: Record<string, string> = {};
    ghiChuList.forEach((g) => {
      const key = `${g.macThep ?? ""}|${g.maVatTu ?? ""}`;
      thEdits[key] = g.ghiChu ?? "";
    });
    setThGhiChuEdits(thEdits);
  }, [idphieu]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setSlabDetails([]);
      setTongHopGhiChu([]);
      setSelectedRowKeys([]);
      setRowEdits({});
      setThGhiChuEdits({});
      if (!idphieu) return;

      // Chỉ đọc dữ liệu local (nhanh) — KHÔNG đồng bộ TSC ở đây.
      // Đồng bộ TSC (nặng, qua SP linked-server) chỉ chạy khi user chủ động
      // bấm "Làm mới dữ liệu" (xem handleSyncData), tránh mọi lần reload
      // (vào phiếu, sau XN/chuyển phôi/chốt phiếu) đều phải chờ sync.
      const res = await safeGetDetail(() => PhieuApi.getDetail(idphieu));
      if (!res) return;
      const phieuData = (res as any)?.data ?? res;
      setData(phieuData);

      await loadSlabs();
    } catch (error) {
      console.error("Lỗi tải dữ liệu phiếu:", error);
      message.error("Không thể tải dữ liệu phiếu");
    } finally {
      setLoading(false);
    }
  }, [idphieu, safeGetDetail, loadSlabs]);

  const handleSyncData = useCallback(async () => {
    if (!idphieu || !data?.ngaySX || !data?.ca) return;
    try {
      setSyncLoading(true);
      const result = await Hrc1SlabApi.sync(dayjs(data.ngaySX).format("YYYY-MM-DD"), data.ca);
      message.success(`Sync thành công: ${result.rowsUpserted} slab từ TSC`);
      await loadSlabs();
    } catch (err: any) {
      message.error(err?.message ?? "Lỗi sync dữ liệu từ TSC");
    } finally {
      setSyncLoading(false);
    }
  }, [idphieu, data, loadSlabs]);

  // ── Thêm mới / Sửa slab thủ công — NgaySX/CaSX/KipSX lấy từ thông tin phiếu (data) khi thêm
  // mới, không cho user nhập, để slab mới luôn khớp đúng phiếu đang xem (BE cũng tự lấy lại từ
  // phiếu). Khi Sửa, các field này giữ nguyên (không gửi lên, BE không đụng tới).
  const closeSlabFormModal = useCallback(() => {
    setAddModalOpen(false);
    addForm.resetFields();
    setFormMode("add");
    setEditingSlabId(null);
  }, [addForm]);

  const handleSubmitSlabForm = useCallback(async () => {
    if (!idphieu) return;
    try {
      const values = await addForm.validateFields();
      setAddLoading(true);
      const payload = {
        idSlab: values.idSlab,
        idPiece: values.idPiece || null,
        maMe: values.maMe || null,
        macThep: values.macThep || null,
        mayDuc: values.mayDuc || null,
        cutDate: values.cutDate ? values.cutDate.format("YYYY-MM-DDTHH:mm:ss") : null,
        chieuDay: values.chieuDay ?? null,
        chieuRong: values.chieuRong ?? null,
        chieuDai: values.chieuDai ?? null,
        khoiLuong: values.khoiLuong ?? null,
      };
      if (formMode === "edit" && editingSlabId != null) {
        await Hrc1SlabApi.editSlab(editingSlabId, payload);
        message.success("Đã cập nhật slab");
      } else {
        await Hrc1SlabApi.createSlab({ idPhieu: idphieu, ...payload });
        message.success("Đã thêm slab mới");
      }
      closeSlabFormModal();
      await loadSlabs();
    } catch (err: any) {
      if (err?.errorFields) return; // lỗi validate form, không phải lỗi API
      message.error(err?.message ?? (formMode === "edit" ? "Lỗi cập nhật slab" : "Lỗi thêm slab mới"));
    } finally {
      setAddLoading(false);
    }
  }, [idphieu, addForm, formMode, editingSlabId, closeSlabFormModal, loadSlabs]);

  const openAddModal = useCallback(() => {
    setFormMode("add");
    setEditingSlabId(null);
    addForm.resetFields();
    setAddModalOpen(true);
  }, [addForm]);

  useEffect(() => { loadData(); }, [loadData]);

  // Chỉ làm mới dữ liệu slab/ghi chú cho tab tổng hợp — không gọi loadData()
  // vì loadData() bật Card loading, khiến Tabs (uncontrolled) unmount rồi
  // remount về defaultActiveKey, làm mất tab đang xem.
  const handleRefreshTongHop = useCallback(async () => {
    try {
      setTongHopRefreshLoading(true);
      await loadSlabs();
    } catch (err: any) {
      message.error(err?.message ?? "Lỗi làm mới dữ liệu");
    } finally {
      setTongHopRefreshLoading(false);
    }
  }, [loadSlabs]);

  // ── Chốt / Hủy chốt ──────────────────────────────────────────────────────
  const handleChotPhieu = async () => {
    if (!idphieu) return;
    try {
      setChotLoading(true);
      await Hrc1SlabApi.chotPhieu(idphieu, getUserId());
      message.success("Đã chốt phiếu thành công");
      await loadData();
    } catch (err: any) {
      message.error(err?.message ?? "Lỗi khi chốt phiếu");
    } finally { setChotLoading(false); }
  };

  const handleHuyChotPhieu = async () => {
    if (!idphieu) return;
    try {
      setChotLoading(true);
      await Hrc1SlabApi.huyChotPhieu(idphieu, getUserId());
      message.success("Đã hủy chốt phiếu");
      await loadData();
    } catch (err: any) {
      message.error(err?.message ?? "Lỗi khi hủy chốt phiếu");
    } finally { setChotLoading(false); }
  };

  // ── XN / Hủy XN theo selection ────────────────────────────────────────────
  const selectedRows = useMemo(
    () => slabDetails.filter((r) => selectedRowKeys.includes(r.id)),
    [slabDetails, selectedRowKeys],
  );
  const selectedCount = selectedRowKeys.length;

  // Chỉ cho phép Sửa khi tick đúng 1 dòng — fill toàn bộ field từ dòng đang chọn vào form, y hệt
  // popup "Thêm mới" nhưng đổi tiêu đề + hành vi Lưu (gọi editSlab thay vì createSlab).
  const openEditModal = useCallback(() => {
    const row = selectedRows[0];
    if (!row) return;
    setFormMode("edit");
    setEditingSlabId(row.id);
    addForm.setFieldsValue({
      idSlab: row.idSlab,
      idPiece: row.idPiece ?? null,
      maMe: row.maMe ?? null,
      macThep: row.macThep ?? null,
      mayDuc: row.mayDuc ?? null,
      cutDate: row.cutDate ? dayjs(row.cutDate) : null,
      chieuDay: row.chieuDay ?? null,
      chieuRong: row.chieuRong ?? null,
      chieuDai: row.chieuDai ?? null,
      khoiLuong: row.khoiLuong ?? null,
    });
    setAddModalOpen(true);
  }, [selectedRows, addForm]);

  // Xóa mềm: slab bị ẩn khỏi phiếu và không bị SyncAsync hồi sinh ở lần "Làm mới dữ liệu" kế
  // tiếp (khác xóa cứng trước đây — TSC luôn trả đủ slab của ca nên sẽ bị insert lại ngay).
  const handleDeleteSlabs = useCallback(async () => {
    if (selectedRows.length === 0) return;
    try {
      setDeleteLoading(true);
      const ids = selectedRows.map((r) => r.id);
      const result = await Hrc1SlabApi.deleteSlabs(ids, getUserId());
      message.success(result.message || `Đã xóa ${result.affectedRows} slab`);
      await loadSlabs();
    } catch (err: any) {
      message.error(err?.message ?? "Lỗi xóa slab");
    } finally {
      setDeleteLoading(false);
    }
  }, [selectedRows, loadSlabs]);

  const parseSearchTerms = (text: string) =>
    text.split(/[\n\t,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);

  // Lọc theo trạng thái Đúc/Cán/GĐ-PGĐ NM/PKH — dùng CHUNG cho cả 2 tab (Chi tiết + Tổng hợp).
  const sharedFilteredSlabDetails = useMemo(() => {
    return slabDetails.filter((r) => {
      if (filterDuc === "chua" && r.trangThaiDuc !== 0) return false;
      if (filterDuc === "da" && r.trangThaiDuc !== 1) return false;
      if (filterCan === "chua" && r.trangThaiCan !== 0) return false;
      if (filterCan === "da" && r.trangThaiCan !== 1) return false;
      if (filterC4 === "chua" && r.trangThaiC4) return false;
      if (filterC4 === "da" && !r.trangThaiC4) return false;
      if (filterPKH === "chua" && r.trangThaiPKH !== 0) return false;
      if (filterPKH === "da" && r.trangThaiPKH !== 1) return false;
      return true;
    });
  }, [slabDetails, filterDuc, filterCan, filterC4, filterPKH]);

  // Lọc riêng cho tab "Chi tiết" theo Số Mẻ / ID Slab — tách các giá trị nhập/paste theo
  // dòng/phẩy/tab, 1 dòng khớp nếu chứa (contains, không phân biệt hoa/thường) BẤT KỲ giá trị
  // nào đã nhập. Áp dụng thêm trên nền đã lọc chung ở trên (không ảnh hưởng tab "Tổng hợp").
  const filteredSlabDetails = useMemo(() => {
    const maMeTerms = parseSearchTerms(maMeSearch);
    const idSlabTerms = parseSearchTerms(idSlabSearch);
    return sharedFilteredSlabDetails.filter((r) => {
      const maMe = (r.maMe ?? "").toLowerCase();
      const idSlab = (r.idSlab ?? "").toLowerCase();
      if (maMeTerms.length > 0 && !maMeTerms.some((t) => maMe.includes(t))) return false;
      if (idSlabTerms.length > 0 && !idSlabTerms.some((t) => idSlab.includes(t))) return false;
      return true;
    });
  }, [sharedFilteredSlabDetails, maMeSearch, idSlabSearch]);

  // Đúc, Cán và C4 đồng cấp (song song, không phụ thuộc lẫn nhau)
  const canXacNhanDuc = selectedCount > 0 && selectedRows.every((r) => r.trangThaiDuc === 0 && r.trangThaiPKH === 0);
  const canHuyDuc     = selectedCount > 0 && selectedRows.every((r) => r.trangThaiDuc === 1 && r.trangThaiPKH === 0);
  const canXacNhanCan = selectedCount > 0 && selectedRows.every((r) => r.trangThaiCan === 0 && r.trangThaiPKH === 0);
  const canHuyCan     = selectedCount > 0 && selectedRows.every((r) => r.trangThaiCan === 1 && r.trangThaiPKH === 0);
  const canXacNhanC4  = selectedCount > 0 && selectedRows.every((r) => !r.trangThaiC4 && r.trangThaiPKH === 0);
  const canHuyC4      = selectedCount > 0 && selectedRows.every((r) => r.trangThaiC4 && r.trangThaiPKH === 0);
  // PKH chỉ chốt được khi cả Đúc, Cán và C4 đã xác nhận

  const handleXacNhan = async (loai: "Duc" | "Can" | "C4" | "PKH") => {
    try {
      setActionLoading(true);
      const ids = selectedRows.map((r) => r.id);
      await Hrc1SlabApi.xacNhan(ids, loai, getUserId());
      message.success(`Xác nhận ${loai} thành công cho ${ids.length} slab`);
      await loadData();
    } catch (err: any) {
      message.error(err?.message ?? `Lỗi xác nhận ${loai}`);
    } finally { setActionLoading(false); }
  };

  const handleHuyXacNhan = async (loai: "Duc" | "Can" | "C4" | "PKH") => {
    try {
      setActionLoading(true);
      const ids = selectedRows.map((r) => r.id);
      await Hrc1SlabApi.huyXacNhan(ids, loai, getUserId());
      message.success(`Hủy xác nhận ${loai} thành công cho ${ids.length} slab`);
      await loadData();
    } catch (err: any) {
      message.error(err?.message ?? `Lỗi hủy xác nhận ${loai}`);
    } finally { setActionLoading(false); }
  };

  const canChuyen = selectedCount > 0 && selectedRows.every((r) => r.trangThaiCan === 0 && !r.trangThaiC4 && r.trangThaiPKH === 0);

  // ── Chuyển phôi bulk (áp dụng cho tất cả slab đã chọn) ───────────────────
  const handleChuyenBulk = useCallback(async (huong: "truoc" | "sau") => {
    if (!idphieu || selectedRows.length === 0) return;
    try {
      setChuyenLoading(huong);
      const ids = selectedRows.map((r) => r.id);
      const result = await Hrc1SlabApi.chuyenPhoi(ids, idphieu, huong, getUserId());
      message.success(`Đã chuyển ${result.affectedRows} slab về ca ${huong === "truoc" ? "trước" : "sau"}`);
      await loadSlabs();
    } catch (err: any) {
      message.error(err?.message ?? "Lỗi chuyển phôi");
    } finally { setChuyenLoading(null); }
  }, [idphieu, selectedRows, loadSlabs]);

  // ── Inline save GhiChu ───────────────────────────────────────────────────
  const saveRowEdit = useCallback(async (id: number) => {
    const edit = rowEdits[id];
    if (!edit) return;
    const original = slabDetails.find((s) => s.id === id);
    if (!original) return;
    const ghiChu = edit.ghiChu || null;
    if (ghiChu === (original.ghiChu ?? null)) return;
    try {
      await Hrc1SlabApi.updateSlab(id, { ghiChu });
      setSlabDetails((prev) => prev.map((s) => s.id === id ? { ...s, ghiChu } : s));
    } catch {
      message.error("Lỗi lưu ghi chú");
    }
  }, [rowEdits, slabDetails]);

  // ── Inline save TongHop GhiChu ────────────────────────────────────────────
  const saveTongHopGhiChu = useCallback(async (macThep: string | null, maVatTu: string | null) => {
    if (!idphieu) return;
    const key = `${macThep ?? ""}|${maVatTu ?? ""}`;
    const ghiChu = thGhiChuEdits[key] ?? null;
    const original = tongHopGhiChu.find((g) => g.macThep === macThep && g.maVatTu === maVatTu);
    if ((ghiChu || null) === (original?.ghiChu ?? null)) return;
    try {
      await Hrc1SlabApi.saveTongHopGhiChu({ idPhieuBBSL: idphieu, macThep, maVatTu, ghiChu: ghiChu || null });
      setTongHopGhiChu((prev) => {
        const idx = prev.findIndex((g) => g.macThep === macThep && g.maVatTu === maVatTu);
        const updated = { macThep, maVatTu, ghiChu: ghiChu || null };
        return idx >= 0 ? prev.map((g, i) => (i === idx ? updated : g)) : [...prev, updated];
      });
    } catch {
      message.error("Lỗi lưu ghi chú tổng hợp");
    }
  }, [idphieu, thGhiChuEdits, tongHopGhiChu]);

  // ── rowSelection ──────────────────────────────────────────────────────────
  const rowSelection: TableRowSelection<Hrc1SlabItem> = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys),
    columnWidth: 32,
  };

  // ── Tab chi tiết columns ──────────────────────────────────────────────────
  const detailColumns = useMemo(() => [
    {
      title: "STT",
      key: "stt",
      width: 40,
      align: "center" as const,
      render: (_: unknown, __: unknown, idx: number) => idx + 1,
    },
    
    {
      title: "Mã vật tư",
      key: "maVatTu",
      width: 140,
      render: (_: unknown, r: Hrc1SlabItem) => r.maVatTu ?? "-",
    },
    {
      title: "Mác phôi",
      key: "macPhoi",
      width: 300,
      render: (_: unknown, r: Hrc1SlabItem) => r.tenVatTu || r.macThep || "-",
    },
    {
      title: (
        <div>
          <div>Số Mẻ</div>
          <div style={{ display: "flex", gap: 2, marginTop: 4 }} onClick={(e) => e.stopPropagation()}>
            <Input
              size="small"
              value={maMeSearch}
              onChange={(e) => setMaMeSearch(e.target.value)}
              placeholder="Tìm/paste..."
              allowClear
              style={{ fontWeight: "normal" }}
            />
            <Tooltip title="Paste từ clipboard">
              <Button size="small" icon={<SnippetsOutlined />} onClick={() => openPasteModal(setMaMeSearch)} />
            </Tooltip>
          </div>
        </div>
      ),
      dataIndex: "maMe",
      width: 130,
      align: "center" as const,
      render: (v: string) => v ?? "-",
    },
    {
      title: (
        <div>
          <div>ID Slab</div>
          <div style={{ display: "flex", gap: 2, marginTop: 4 }} onClick={(e) => e.stopPropagation()}>
            <Input
              size="small"
              value={idSlabSearch}
              onChange={(e) => setIdSlabSearch(e.target.value)}
              placeholder="Tìm/paste..."
              allowClear
              style={{ fontWeight: "normal" }}
            />
            <Tooltip title="Paste từ clipboard">
              <Button size="small" icon={<SnippetsOutlined />} onClick={() => openPasteModal(setIdSlabSearch)} />
            </Tooltip>
          </div>
        </div>
      ),
      dataIndex: "idSlab",
      width: 150,
      align: "center" as const,
    },
    {
      title: "KL (kg)",
      dataIndex: "khoiLuong",
      width: 100,
      align: "right" as const,
      render: (v: number) =>
        v != null ? Math.round(v).toLocaleString("vi-VN") : "-",
    },
    {
      title: "Ghi chú",
      key: "ghiChu",
      width: 200,
      render: (_: unknown, r: Hrc1SlabItem) => (
        <Input
          value={rowEdits[r.id]?.ghiChu ?? ""}
          onChange={(e) => setRowEdits((prev) => ({ ...prev, [r.id]: { ...prev[r.id], ghiChu: e.target.value } }))}
          onBlur={() => void saveRowEdit(r.id)}
          size="small"
          placeholder="Nhập ghi chú..."
          disabled={readOnly || data?.tinhTrang === 5}
        />
      ),
    },
    {
      title: "TT Đúc",
      dataIndex: "trangThaiDuc",
      width: 85,
      align: "center" as const,
      render: (v: number) => <Tag color={TT_COLOR[v]}>{v === 1 ? "Đã XN" : "Chưa"}</Tag>,
    },
    {
      title: "TT Cán",
      dataIndex: "trangThaiCan",
      width: 85,
      align: "center" as const,
      render: (v: number) => <Tag color={TT_COLOR[v]}>{v === 1 ? "Đã XN" : "Chưa"}</Tag>,
    },
    {
      title: "TT GĐ/PGĐ NM",
      dataIndex: "trangThaiC4",
      width: 85,
      align: "center" as const,
      render: (v: boolean) => <Tag color={v ? "green" : "default"}>{v ? "Đã XN" : "Chưa"}</Tag>,
    },
    {
      title: "TT PKH",
      dataIndex: "trangThaiPKH",
      width: 85,
      align: "center" as const,
      render: (v: number) => <Tag color={v === 1 ? "blue" : "default"}>{v === 1 ? "Đã chốt" : "Chưa"}</Tag>,
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [isDuc, isCan, isC4, isPKH, rowEdits, saveRowEdit, data?.tinhTrang, maMeSearch, idSlabSearch, openPasteModal]);

  // ── Tab tổng hợp rows ─────────────────────────────────────────────────────
  // Pivot từ sharedFilteredSlabDetails (đã áp bộ lọc trạng thái Đúc/Cán/GĐ-PGĐ NM/PKH dùng
  // chung cho cả 2 tab) — không áp Số Mẻ/ID Slab search vì đó là filter riêng của tab "Chi tiết".
  const tongHopRows = useMemo(() => {
    const map = new Map<string, { macThep: string | null; maVatTu: string | null; tenVatTu: string | null; soPhoi: number; tongKL: number, trangThaiDuc: number;trangThaiCan: number; }>();
    sharedFilteredSlabDetails.forEach((r) => {
      const key = `${r.macThep ?? ""}|${r.maVatTu ?? ""}`;
      if (!map.has(key)) {
        map.set(key, { macThep: r.macThep ?? null, maVatTu: r.maVatTu ?? null, tenVatTu: r.tenVatTu ?? null, soPhoi: 0, tongKL: 0, trangThaiDuc: 1, trangThaiCan: 1 });
      }
      const row = map.get(key)!;
      row.soPhoi += 1;
      row.tongKL += r.khoiLuong ?? 0;
      // Chỉ cần có 1 phôi chưa xác nhận => cả nhóm chưa xác nhận
      if (r.trangThaiDuc !== 1) {
        row.trangThaiDuc = 0;
      }

      if (r.trangThaiCan !== 1) {
        row.trangThaiCan = 0;
      }
    });

    console.log("tongHopRows", Array.from(map.values()));
    return Array.from(map.values()).map((r, i) => ({
      ...r,
      stt: i + 1,
      trangThaiDuc: r.trangThaiDuc ,
      trangThaiCan: r.trangThaiCan,
    }));
  }, [sharedFilteredSlabDetails]);

  const tongHopTotals = useMemo(() => ({
    soPhoi: tongHopRows.reduce((s, r) => s + r.soPhoi, 0),
    tongKL: tongHopRows.reduce((s, r) => s + r.tongKL, 0),
  }), [tongHopRows]);

  // ── Export handlers ───────────────────────────────────────────────────────

  const handleExportChiTietExcel = useCallback(async () => {
    if (!idphieu || !data?.ngaySX || !data?.ca) return;
    setExportLoading("chitiet-excel");
    try {
      await Hrc1SlabApi.exportExcel(idphieu, "chitiet", dayjs(data.ngaySX).format("YYYY-MM-DD"), data.ca, data.kip);
    } catch (e: any) {
      message.error(e?.message ?? "Lỗi xuất Excel");
    } finally { setExportLoading(null); }
  }, [idphieu, data]);

  const handleExportTongHopExcel = useCallback(async () => {
    if (!idphieu || !data?.ngaySX || !data?.ca) return;
    setExportLoading("tonghop-excel");
    try {
      await Hrc1SlabApi.exportExcel(idphieu, "tonghop", dayjs(data.ngaySX).format("YYYY-MM-DD"), data.ca, data.kip);
    } catch (e: any) {
      message.error(e?.message ?? "Lỗi xuất Excel");
    } finally { setExportLoading(null); }
  }, [idphieu, data]);

  const handleExportTongHopPdf = useCallback(async () => {
    if (!idphieu || !data?.ngaySX || !data?.ca) return;
    setExportLoading("tonghop-pdf");
    try {
      await Hrc1SlabApi.exportPdf(idphieu, dayjs(data.ngaySX).format("YYYY-MM-DD"), data.ca, data.kip);
    } catch (e: any) {
      message.error(e?.message ?? "Lỗi xuất PDF");
    } finally { setExportLoading(null); }
  }, [idphieu, data]);

  const tongHopColumns = useMemo(() => [
    { title: "STT", dataIndex: "stt", width: 60, align: "center" as const },
    {
      title: "TT Đúc",
      dataIndex: "trangThaiDuc",
      width: 100,
      align: "center" as const,
      render: (v: number) => <Tag color={TT_COLOR[v]}>{v === 1 ? "Đã xác nhận" : "Chưa hoàn thành"}</Tag>,
    },
    {
      title: "TT Cán",
      dataIndex: "trangThaiCan",
      width: 100,
      align: "center" as const,
      render: (v: number) => <Tag color={TT_COLOR[v]}>{v === 1 ? "Đã xác nhận" : "Chưa hoàn thành"}</Tag>,
    },
    {
      title: "Sản phẩm x Mác thép",
      key: "sanPham",
      render: (_: unknown, r: { macThep: string | null; maVatTu: string | null; tenVatTu: string | null }) =>
        r.tenVatTu || r.macThep || "-",
    },
    {
      title: "Số phôi",
      dataIndex: "soPhoi",
      width: 100,
      align: "right" as const,
      render: (v: number) => v.toLocaleString("vi-VN"),
    },
    {
      title: "KL Cân (kg)",
      dataIndex: "tongKL",
      width: 200,
      align: "right" as const,
      render: (v: number) => Math.round(v).toLocaleString("vi-VN"),
    },
    {
      title: "Ghi chú",
      key: "ghiChu",
      width: 260,
      render: (_: unknown, r: { macThep: string | null; maVatTu: string | null }) => {
        const key = `${r.macThep ?? ""}|${r.maVatTu ?? ""}`;
        return (
          <Input
            value={thGhiChuEdits[key] ?? ""}
            onChange={(e) => setThGhiChuEdits((prev) => ({ ...prev, [key]: e.target.value }))}
            onBlur={() => void saveTongHopGhiChu(r.macThep, r.maVatTu || null)}
            size="small"
            placeholder="Nhập ghi chú..."
            disabled={readOnly}
          />
        );
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [thGhiChuEdits, saveTongHopGhiChu]);

  // ── Action buttons phiếu ──────────────────────────────────────────────────
  const getUserInfo = useCallback(() => {
    const stored = localStorage.getItem("userinfo");
    return stored ? JSON.parse(stored) : {};
  }, []);

  const handleActionSuccess = useCallback(async (context?: { newPhieuId?: string }) => {
    if (context?.newPhieuId) {
      navigateToDetail(context.newPhieuId, "/form-bbgnphoitam_hrc1");
      return;
    }
    await loadData();
  }, [loadData, navigateToDetail]);

  const actionButtons = useMemo(() => {
    if (readOnly || !data || !idphieu) return null;
    const ui = getUserInfo();
    if (getBmQuyenUiFlags(MA_BM, ui).isView) return null;
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
        message.error((error as any)?.message ?? "Không thể thực hiện thao tác");
      },
    });
    const filtered = buttons.filter((btn) => !DETAIL_HIDDEN_BUTTON_KEYS.has(btn.key));
    if (filtered.length === 0) return null;
    return phieuActionService.renderActionButtons(filtered, idphieu);
  }, [readOnly, data, idphieu, getUserInfo, handleActionSuccess, redirectToList]);

  const chuyenTargets = useMemo(() => {
    if (!data?.ngaySX || !data?.ca) return null;
    const truoc = tinhCaDich(data.ngaySX, data.ca, "truoc");
    const sau   = tinhCaDich(data.ngaySX, data.ca, "sau");
    return {
      truoc: `Ca ${truoc.ca} - ${truoc.ngay.format("DD/MM/YYYY")}`,
      sau:   `Ca ${sau.ca} - ${sau.ngay.format("DD/MM/YYYY")}`,
    };
  }, [data]);

  // ── Nút Chốt phiếu dùng chung cho cả 2 tab ────────────────────────────────
  const chotPhieuButtons = (
    <>
      {isPKH && data?.tinhTrang !== 5 && (
        <Tooltip title="Tự động chốt tất cả dòng chưa chốt và đóng phiếu">
          <Popconfirm
            title="Chốt phiếu? Tất cả slab chưa chốt sẽ được chốt tự động và phiếu sẽ bị khóa."
            onConfirm={handleChotPhieu}
          >
            <Button size="small" type="primary" icon={<LockOutlined />} loading={chotLoading}>
              Chốt phiếu
            </Button>
          </Popconfirm>
        </Tooltip>
      )}
      {isPKH && data?.tinhTrang === 5 && (
        <Popconfirm title="Hủy chốt phiếu này?" onConfirm={handleHuyChotPhieu}>
          <Button size="small" danger icon={<UnlockOutlined />} loading={chotLoading}>
            Hủy chốt
          </Button>
        </Popconfirm>
      )}
    </>
  );

  // ── Info header dùng chung ────────────────────────────────────────────────
  const phieuInfo = (
    <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
      <Descriptions.Item label="Số phiếu">{data?.soPhieu || ""}</Descriptions.Item>
      <Descriptions.Item label="Ngày SX">
        {data?.ngaySX ? dayjs(data.ngaySX).format("DD/MM/YYYY") : ""}
      </Descriptions.Item>
      <Descriptions.Item label="Ca sản xuất">
        {data?.ca == 1 ? "Ca ngày" : data?.ca == 2 ? "Ca đêm" : ""}
      </Descriptions.Item>
      <Descriptions.Item label="Kíp">{data?.kip || ""}</Descriptions.Item>
    </Descriptions>
  );

  return (
    <Card bordered style={{ padding: 24, background: "#fff" }} loading={loading}>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <Title level={4} style={{ marginBottom: 4 }}>
          {TAB_TITLES[activeTabKey] ?? TAB_TITLES.chitiet}
        </Title>
        {idphieu && <b>Số phiếu: {data?.soPhieu}</b>}
      </div>

      {/* Bộ lọc theo trạng thái 4 cấp: dùng CHUNG cho cả 2 tab (Chi tiết + Tổng hợp) */}
      <Card size="small" style={{ marginBottom: 12 }} bodyStyle={{ padding: "8px 12px" }}>
        <Space wrap size={[16, 8]}>
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
            <span style={{ color: "#555" }}>Cán:</span>
            <Radio.Group
              size="small"
              value={filterCan}
              onChange={(e) => setFilterCan(e.target.value)}
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value="all" style={filterBtnStyle("all", filterCan)}>Tất cả</Radio.Button>
              <Radio.Button value="chua" style={filterBtnStyle("chua", filterCan)}>Chưa XN</Radio.Button>
              <Radio.Button value="da" style={filterBtnStyle("da", filterCan)}>Đã XN</Radio.Button>
            </Radio.Group>
          </Space>
          <Space size={4}>
            <span style={{ color: "#555" }}>GĐ/PGĐ NM:</span>
            <Radio.Group
              size="small"
              value={filterC4}
              onChange={(e) => setFilterC4(e.target.value)}
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value="all" style={filterBtnStyle("all", filterC4)}>Tất cả</Radio.Button>
              <Radio.Button value="chua" style={filterBtnStyle("chua", filterC4)}>Chưa XN</Radio.Button>
              <Radio.Button value="da" style={filterBtnStyle("da", filterC4)}>Đã XN</Radio.Button>
            </Radio.Group>
          </Space>
          <Space size={4}>
            <span style={{ color: "#555" }}>PKH:</span>
            <Radio.Group
              size="small"
              value={filterPKH}
              onChange={(e) => setFilterPKH(e.target.value)}
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value="all" style={filterBtnStyle("all", filterPKH)}>Tất cả</Radio.Button>
              <Radio.Button value="chua" style={filterBtnStyle("chua", filterPKH)}>Chưa chốt</Radio.Button>
              <Radio.Button value="da" style={filterBtnStyle("da", filterPKH)}>Đã chốt</Radio.Button>
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
        defaultActiveKey="chitiet"
        onChange={setActiveTabKey}
        type="card"
        style={{ padding: "0 8px" }}
        items={[
          {
            key: "chitiet",
            label: "Biên bản giao nhận phôi tấm",
            children: (
              <>
                {phieuInfo}
                <Card
                  size="small"
                  title={`Danh sách slab (${filteredSlabDetails.length}${filteredSlabDetails.length !== slabDetails.length ? ` / ${slabDetails.length}` : ""})${selectedCount > 0 ? ` — Đã chọn ${selectedCount}` : ""}`}
                  styles={{ body: { padding: "8px 12px" } }}
                  extra={
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {!readOnly && (
                        <Button
                          size="small"
                          icon={<SyncOutlined />}
                          loading={syncLoading}
                          onClick={() => void handleSyncData()}
                          type="primary"
                          ghost
                          disabled={data?.tinhTrang === 5}
                        >
                          Làm mới dữ liệu
                        </Button>
                      )}
                      {!readOnly && (
                        <Button
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={openAddModal}
                          disabled={data?.tinhTrang === 5}
                        >
                          Thêm mới
                        </Button>
                      )}
                      {!readOnly && (
                        <Tooltip title={selectedCount === 1 ? undefined : "Chọn đúng 1 dòng để sửa"}>
                          <Button
                            size="small"
                            icon={<EditOutlined />}
                            onClick={openEditModal}
                            disabled={data?.tinhTrang === 5 || selectedCount !== 1}
                          >
                            Sửa
                          </Button>
                        </Tooltip>
                      )}
                      {!readOnly && (
                        <Popconfirm
                          title={`Xóa ${selectedCount} slab đã chọn? Slab sẽ bị ẩn khỏi phiếu và không hiện lại khi Làm mới dữ liệu.`}
                          onConfirm={() => void handleDeleteSlabs()}
                          disabled={selectedCount === 0}
                        >
                          <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            loading={deleteLoading}
                            disabled={data?.tinhTrang === 5 || selectedCount === 0}
                          >
                            Xóa
                          </Button>
                        </Popconfirm>
                      )}

                      {/* Đúc: chuyển ca + xác nhận Đúc */}
                      {isDuc && (
                        <>
                          <Tooltip title={canChuyen ? `Chuyển ${selectedCount} slab → ${chuyenTargets?.truoc ?? "ca trước"}` : "Chọn slab chưa Cán xác nhận để chuyển"}>
                            <Popconfirm
                              title={`Chuyển ${selectedCount} slab về ${chuyenTargets?.truoc ?? "ca trước"}?`}
                              onConfirm={() => void handleChuyenBulk("truoc")}
                              disabled={!canChuyen}
                            >
                              <Button size="small" icon={<ArrowLeftOutlined />} disabled={!canChuyen} loading={chuyenLoading === "truoc"} />
                            </Popconfirm>
                          </Tooltip>
                          <Tooltip title={canChuyen ? `Chuyển ${selectedCount} slab → ${chuyenTargets?.sau ?? "ca sau"}` : "Chọn slab chưa Cán xác nhận để chuyển"}>
                            <Popconfirm
                              title={`Chuyển ${selectedCount} slab về ${chuyenTargets?.sau ?? "ca sau"}?`}
                              onConfirm={() => void handleChuyenBulk("sau")}
                              disabled={!canChuyen}
                            >
                              <Button size="small" icon={<ArrowRightOutlined />} disabled={!canChuyen} loading={chuyenLoading === "sau"} />
                            </Popconfirm>
                          </Tooltip>
                          <Popconfirm
                            title={`Xác nhận Đúc ${selectedCount} slab?`}
                            onConfirm={() => void handleXacNhan("Duc")}
                            disabled={!canXacNhanDuc}
                          >
                            <Button size="small" icon={<CheckCircleOutlined />} disabled={!canXacNhanDuc} loading={actionLoading} style={{ color: canXacNhanDuc ? "#1890ff" : undefined }}>
                              XN Đúc
                            </Button>
                          </Popconfirm>
                          <Popconfirm
                            title={`Hủy XN Đúc ${selectedCount} slab?`}
                            onConfirm={() => void handleHuyXacNhan("Duc")}
                            disabled={!canHuyDuc}
                          >
                            <Button size="small" icon={<CloseCircleOutlined />} disabled={!canHuyDuc} loading={actionLoading} danger>
                              Hủy XN Đúc
                            </Button>
                          </Popconfirm>
                        </>
                      )}

                      {/* Cán: xác nhận Cán */}
                      {isCan && (
                        <>
                          <Popconfirm
                            title={`Xác nhận Cán ${selectedCount} slab?`}
                            onConfirm={() => void handleXacNhan("Can")}
                            disabled={!canXacNhanCan}
                          >
                            <Button size="small" icon={<CheckCircleOutlined />} disabled={!canXacNhanCan} loading={actionLoading} style={{ color: canXacNhanCan ? "#52c41a" : undefined }}>
                              XN Cán
                            </Button>
                          </Popconfirm>
                          <Popconfirm
                            title={`Hủy XN Cán ${selectedCount} slab?`}
                            onConfirm={() => void handleHuyXacNhan("Can")}
                            disabled={!canHuyCan}
                          >
                            <Button size="small" icon={<CloseCircleOutlined />} disabled={!canHuyCan} loading={actionLoading} danger>
                              Hủy XN Cán
                            </Button>
                          </Popconfirm>
                        </>
                      )}

                      {/* C4 (GĐ/PGĐ NM): xác nhận C4, song song với Đúc/Cán */}
                      {isC4 && (
                        <>
                          <Popconfirm
                            title={`Xác nhận C4 ${selectedCount} slab?`}
                            onConfirm={() => void handleXacNhan("C4")}
                            disabled={!canXacNhanC4}
                          >
                            <Button size="small" icon={<CheckCircleOutlined />} disabled={!canXacNhanC4} loading={actionLoading} style={{ color: canXacNhanC4 ? "#fa8c16" : undefined }}>
                              GĐ/PGĐ NM XN
                            </Button>
                          </Popconfirm>
                          <Popconfirm
                            title={`Hủy XN GĐ/PGĐ NM ${selectedCount} slab?`}
                            onConfirm={() => void handleHuyXacNhan("C4")}
                            disabled={!canHuyC4}
                          >
                            <Button size="small" icon={<CloseCircleOutlined />} disabled={!canHuyC4} loading={actionLoading} danger>
                              GĐ/PGĐ NM Hủy XN
                            </Button>
                          </Popconfirm>
                        </>
                      )}

                      {/* PKH: chốt từng dòng (chỉ khi phiếu chưa chốt) */}
                      {/* {isPKH && data?.tinhTrang !== 5 && (
                        <>
                          <Popconfirm
                            title={`Chốt PKH ${selectedCount} slab?`}
                            onConfirm={() => void handleXacNhan("PKH")}
                            disabled={!canChotPKH}
                          >
                            <Button size="small" icon={<LockOutlined />} disabled={!canChotPKH} loading={actionLoading} style={{ color: canChotPKH ? "#722ed1" : undefined }}>
                              Chốt PKH
                            </Button>
                          </Popconfirm>
                          <Popconfirm
                            title={`Hủy chốt PKH ${selectedCount} slab?`}
                            onConfirm={() => void handleHuyXacNhan("PKH")}
                            disabled={!canHuyChotPKH}
                          >
                            <Button size="small" icon={<UnlockOutlined />} disabled={!canHuyChotPKH} loading={actionLoading} danger>
                              Hủy chốt PKH
                            </Button>
                          </Popconfirm>
                        </>
                      )} */}

                      <Button
                        size="small"
                        icon={<FileExcelOutlined />}
                        loading={exportLoading === "chitiet-excel"}
                        onClick={() => void handleExportChiTietExcel()}
                        style={{ color: "#217346" }}
                      >
                        Excel
                      </Button>

                      {chotPhieuButtons}
                    </div>
                  }
                >
                  <Table<Hrc1SlabItem>
                    rowKey="id"
                    rowSelection={readOnly ? undefined : rowSelection}
                    size="small"
                    bordered
                    virtual
                    columns={detailColumns}
                    dataSource={filteredSlabDetails}
                    pagination={false}
                    scroll={{ x: "max-content", y: 520 }}
                    sticky={{ offsetHeader: 0 }}
                    rowClassName={(r) => [
                      r.isChuyenCa ? "row-chuyen-ca" : "",
                      r.isManualEdited ? "row-manual-edited" : "",
                    ].filter(Boolean).join(" ")}
                    summary={() => {
                      const totalKL = filteredSlabDetails.reduce((s, r) => s + (r.khoiLuong ?? 0), 0);
                      const optColCount = ((isDuc || isCan || isPKH) ? 1 : 0) + ((isCan || isPKH) ? 1 : 0) + ((isC4 || isPKH) ? 1 : 0) + (isPKH ? 1 : 0);
                      return (
                        <Table.Summary fixed>
                          <Table.Summary.Row>
                            <Table.Summary.Cell index={0} colSpan={6} align="center">
                              <strong>Tổng</strong>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={6} align="right">
                              <strong>{Math.round(totalKL).toLocaleString("vi-VN")}</strong>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={7} colSpan={1 + optColCount} />
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
            label: "Biên bản xác nhận sản lượng phôi tấm",
            children: (
              <>
                {phieuInfo}
                <div style={{ display: "flex", gap: 8, marginBottom: 8, justifyContent: "flex-end" }}>
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
                <Table
                  rowKey={(r) => `${r.macThep ?? ""}|${r.maVatTu ?? ""}`}
                  bordered
                  columns={tongHopColumns}
                  dataSource={tongHopRows}
                  pagination={false}
                  size="small"
                  scroll={{ x: "max-content" }}
                  sticky={{ offsetHeader: 0 }}
                  summary={() => (
                    <Table.Summary fixed>
                      <Table.Summary.Row>
                        <Table.Summary.Cell index={0} colSpan={4} align="center">
                          <strong>Tổng</strong>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={2} align="right">
                          <strong>{tongHopTotals.soPhoi.toLocaleString("vi-VN")}</strong>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={3} align="right">
                          <strong>
                            {Math.round(tongHopTotals.tongKL).toLocaleString("vi-VN")}
                          </strong>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={4} />
                      </Table.Summary.Row>
                    </Table.Summary>
                  )}
                />
              </>
            ),
          },
        ]}
      />

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

      {/* Popup thêm mới / sửa slab thủ công (tab "Chi tiết") — dùng chung 1 Form cho cả 2 chế độ */}
      <Modal
        title={formMode === "edit" ? "Sửa slab" : "Thêm mới slab"}
        open={addModalOpen}
        onOk={() => void handleSubmitSlabForm()}
        onCancel={closeSlabFormModal}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={addLoading}
        width={480}
        destroyOnClose
      >
        <Form form={addForm} layout="vertical" style={{ marginTop: 12 }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="idSlab"
                label="ID Slab"
                rules={[{ required: true, message: "Nhập ID Slab" }]}
              >
                <Input maxLength={50} placeholder="ID Slab" style={{ height: 36 }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="idPiece" label="ID Piece">
                <Input maxLength={50} placeholder="ID Piece" style={{ height: 36 }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="maMe"
                label="Mã mẻ"
                rules={[{ required: true, message: "Nhập Mã mẻ" }]}
              >
                <Input maxLength={50} placeholder="Mã mẻ" style={{ height: 36 }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="macThep"
                label="Mác thép"
                rules={[{ required: true, message: "Nhập Mác thép" }]}
              >
                <Input maxLength={50} placeholder="Mác thép" style={{ height: 36 }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="khoiLuong"
                label="Khối lượng (kg)"
                rules={[{ required: true, message: "Nhập Khối lượng" }]}
              >
                <InputNumber min={0} precision={2} style={{ width: "100%", height: 36 }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="mayDuc" label="Máy đúc">
                <Input maxLength={10} placeholder="Máy đúc" style={{ height: 36 }} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="cutDate"
                label="Cut Date"
                rules={[{ required: true, message: "Chọn Cut Date" }]}
              >
                <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: "100%", height: 36 }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="chieuDay" label="Chiều dày">
                <InputNumber min={0} precision={2} style={{ width: "100%", height: 36 }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="chieuRong" label="Chiều rộng">
                <InputNumber min={0} precision={2} style={{ width: "100%", height: 36 }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="chieuDai" label="Chiều dài">
                <InputNumber min={0} precision={2} style={{ width: "100%", height: 36 }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

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

      {/* CSS cho row được chuyển ca / đã sửa thủ công — bảng tab "Chi tiết" dùng virtual (Table
          virtual), rc-table render cell bằng <div className="ant-table-cell"> thay vì <td>, nên
          phải match cả 2 kiểu selector để hoạt động ở cả bảng thường và bảng virtual. */}
      <style>{`
        .row-chuyen-ca td, .row-chuyen-ca.ant-table-row > .ant-table-cell {
          background-color: #fff7e6 !important;
        }
        .row-chuyen-ca:hover td, .row-chuyen-ca.ant-table-row:hover > .ant-table-cell {
          background-color: #ffe7ba !important;
        }
        .row-manual-edited td, .row-manual-edited.ant-table-row > .ant-table-cell {
          background-color: #fffbe6 !important;
        }
        .row-manual-edited:hover td, .row-manual-edited.ant-table-row:hover > .ant-table-cell {
          background-color: #fff1b8 !important;
        }
      `}</style>
    </Card>
  );
};

export default ChiTietBienBanGiaoNhanPhoiTam_HRC1;
