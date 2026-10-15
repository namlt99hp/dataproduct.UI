import { Button, Card, Checkbox, DatePicker, Form, Input, Popconfirm, Select, Space, Table, Tag, message } from "antd";
import { SyncOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Key } from "react";
import dayjs from "dayjs";
import type { TableColumnsType } from "antd";
import {
  HRC1Api,
  type HRC1_ThongKeQuery,
  type HRC1_ThongKeRow,
  type HRC1_TongHopItem,
  type HRC1_TongHopResult,
} from "../../../services/HRC1_BBGNApi";
import { NhaMayEnum } from "../../../services/MayDucServiceApi";
import { useMayDucOptions } from "../../../hooks/useMayDucOptions";
import { MacThepServiceApi } from "../../../services/MacThepServiceApi";
import { BmQuyenXlApi } from "../../../services/BmQuyenXlApi";
import { BM_CONFIG } from "../../../utils/configs/BieuMauConst";
import { getThongTinUser } from "../../../utils/constants/GetThongTinLocalStore";
import { isAdminUser } from "../../../utils/helpers/checkAdminRole";
import Tooltip from "antd/es/tooltip";

const { RangePicker } = DatePicker;

const fmt = (v: number | null | undefined) =>
  v == null ? "" : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(v);

// Ghi chú PCN — auto-save khi blur (dời từ form máy đúc sang, chỉ sửa được khi có quyền
// Xác nhận PCN và mẻ chưa bị chốt PCN vĩnh viễn).
const GhiChuPCNInput = ({
  meId, value, locked, onSaved,
}: {
  meId: number;
  value?: string | null;
  locked: boolean;
  onSaved: (v: string | null) => void;
}) => {
  const [local, setLocal] = useState(value ?? "");
  useEffect(() => { setLocal(value ?? ""); }, [value]);
  if (locked) return <>{value ?? ""}</>;
  return (
    <Input
      size="small"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={async () => {
        const newVal = local.trim() || null;
        if (newVal === (value ?? null)) return;
        try {
          await HRC1Api.updateGhiChu(meId, newVal, "pcn");
          onSaved(newVal);
        } catch {
          message.error("Lỗi lưu ghi chú");
          setLocal(value ?? "");
        }
      }}
    />
  );
};

const ThongKeBBGNThepLongHRC1 = () => {
  const [form] = Form.useForm();
  const [loading, setLoading]       = useState(false);
  const [exporting, setExporting]   = useState(false);
  const [syncing, setSyncing]       = useState(false);
  const [data, setData]             = useState<HRC1_ThongKeRow[]>([]);
  const [totalRecords, setTotal]    = useState(0);
  const [totalKl, setTotalKl]           = useState<number | null>(null);
  const [totalKlChot, setTotalKlChot]   = useState<number | null>(null);
  const [totalKlPhanBo, setTotalKlPhanBo] = useState<number | null>(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 100 });
  const [filters, setFilters]       = useState<HRC1_ThongKeQuery>({ page: 1, pageSize: 100 });
  const { options: mayDucOpts } = useMayDucOptions(NhaMayEnum.HRC1);
  const [nhomMacOpts, setNhomMacOpts] = useState<{ label: string; value: number }[]>([]);
  const [tongHopData, setTongHopData] = useState<HRC1_TongHopResult | null>(null);
  const [canChotPCN, setCanChotPCN] = useState(false);
  const [canXacNhanPCN, setCanXacNhanPCN] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [chotPCNBusy, setChotPCNBusy] = useState(false);
  const [xacNhanPCNBusy, setXacNhanPCNBusy] = useState(false);

  useEffect(() => {
    const user = getThongTinUser();
    const isPKHAdmin = user.tenNgan === "P.KH" || user.iD_PhongBan === 70 || isAdminUser(user);
    if (isPKHAdmin) { setCanChotPCN(true); return; }
    const userId = user.iD_TaiKhoan;
    if (!userId) return;
    BmQuyenXlApi.getByTaiKhoan(userId).then((res: any) => {
      const list: Array<{ maBm: string; quyenChucNang: number }> = Array.isArray(res) ? res : res?.data ?? [];
      setCanChotPCN(list.some((r) => r.maBm === BM_CONFIG.HRC1.HRC1_BBGN_ThepLong && Number(r.quyenChucNang) === 3));
      // Quyền riêng (extraQuyens) của THONGKE_HRC1 — value 6 = "Xác nhận PCN" (dời từ form máy đúc sang)
      setCanXacNhanPCN(list.some((r) => r.maBm === BM_CONFIG.HRC1.THONGKE_HRC1 && Number(r.quyenChucNang) === 6));
    }).catch(() => {/* ignore permission load errors */});
  }, []);

  useEffect(() => {
    MacThepServiceApi.getPhanLoaiNhomOptions({ pageSize: 200 })
      .then((res) => setNhomMacOpts(res.data.map((x) => ({ label: x.tenNhom, value: x.id }))))
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async (q: HRC1_ThongKeQuery) => {
    setLoading(true);
    try {
      const res = await HRC1Api.searchThongKe(q);
      setData(res.items);
      setTotal(res.totalRecords);
      setTotalKl(res.totalKlThepLong);
      setTotalKlChot(res.totalKlThepLongChot ?? null);
      setTotalKlPhanBo(res.totalKlThepLongPhanBo ?? null);
      setPagination({ current: res.page, pageSize: res.pageSize });
      setFilters(q);
      // Tổng hợp — fire and forget, không block main table
      void HRC1Api.tongHopThongKe(q).then(setTongHopData).catch(() => {});
    } catch (e: unknown) {
      const msg = typeof e === "string" ? e : (e as { message?: string })?.message ?? "Lỗi tải dữ liệu.";
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData({ page: 1, pageSize: 100 }); }, [fetchData]);

  const handleFilter = useCallback(() => {
    const v = form.getFieldsValue(true) as Record<string, unknown>;
    const dr = v.ngaySX as [dayjs.Dayjs, dayjs.Dayjs] | undefined;
    const drLo = v.ngayLoThoi as [dayjs.Dayjs, dayjs.Dayjs] | undefined;
    // Decode select "Trạng thái" → các filter riêng biệt
    const tt = v.trangThai as string | undefined;
    const trangThaiLo  = tt === "lo_0"  ? 0 : tt === "lo_1"  ? 1 : undefined;
    const trangThaiTL  = tt === "tl_0"  ? 0 : tt === "tl_1"  ? 1 : undefined;
    const trangThaiDuc = tt === "duc_0" ? 0 : tt === "duc_1" ? 1 : undefined;
    const isChot       = tt === "chot"  ? true : undefined;

    const q: HRC1_ThongKeQuery = {
      tuNgay:        dr?.[0]?.format("YYYY-MM-DD"),
      denNgay:       dr?.[1]?.format("YYYY-MM-DD"),
      tuNgayLoThoi:  drLo?.[0]?.format("YYYY-MM-DD"),
      denNgayLoThoi: drLo?.[1]?.format("YYYY-MM-DD"),
      ca:            v.ca != null ? Number(v.ca) : undefined,
      kip:           v.kip ? String(v.kip) : undefined,
      loSo:          v.loSo != null ? Number(v.loSo) : undefined,
      tlSo:          v.tlSo != null ? Number(v.tlSo) : undefined,
      idMayDuc:      v.idMayDuc != null ? Number(v.idMayDuc) : undefined,
      maMe:          v.maMe ? String(v.maMe).trim() : undefined,
      maMeChuyenVe: v.maMeChuyenVe ? String(v.maMeChuyenVe).trim() : undefined,
      thungSo:       v.thungSo ? String(v.thungSo).trim() : undefined,
      phanLoai:      v.phanLoai ? String(v.phanLoai).trim() : undefined,
      isManualTL:           v.isManualTL === true ? true : undefined,
      isTrungMeThoi:        v.isTrungMeThoi === true ? true : undefined,
      isChuyenMe:           v.isChuyenMe === true ? true : undefined,
      chuaCoNhomPhanLoai:   v.chuaCoNhomPhanLoai === true ? true : undefined,
      idNhomPhanLoai:       v.idNhomPhanLoai != null ? Number(v.idNhomPhanLoai) : undefined,
      isThuNghiem:          v.isThuNghiem === true ? true : undefined,
      trangThaiPCN:         v.isThuNghiem === true && v.trangThaiPCN != null
        ? v.trangThaiPCN === "true"
        : undefined,
      isLenThang:           v.isLenThang === true ? true : undefined,
      chuaLenDuc:           v.chuaLenDuc === true ? true : undefined,
      trangThaiLo,
      trangThaiTL,
      trangThaiDuc,
      isChot,
      page: 1,
      pageSize: pagination.pageSize,
    };
    void fetchData(q);
  }, [fetchData, form, pagination.pageSize]);

  const handleReset = useCallback(() => {
    form.resetFields();
    void fetchData({ page: 1, pageSize: pagination.pageSize });
  }, [fetchData, form, pagination.pageSize]);

  const handleSync = useCallback(async () => {
    const maMes = data
      .filter((r) => r.isChot !== true && r.maMe)
      .map((r) => r.maMe!);
    if (maMes.length === 0) {
      void message.info("Không có mẻ chưa chốt trong danh sách hiện tại.");
      return;
    }
    setSyncing(true);
    try {
      const res = await HRC1Api.syncPhanLoaiMeThep(maMes);
      void message.success(`Đồng bộ: ${res.totalUpdated}/${maMes.length} mẻ được cập nhật.`);
      void fetchData(filters);
    } catch {
      void message.error("Đồng bộ phân loại thất bại.");
    } finally {
      setSyncing(false);
    }
  }, [data, filters, fetchData]);

  // Chốt PCN: khóa vĩnh viễn — chỉ áp dụng mẻ đã Xác nhận PCN (isThuNghiem && trangThaiPCN), chưa chốt.
  // Hủy chốt PCN: chỉ áp dụng mẻ đang trangThaiChotPCN=true.
  const validateChotPCN = useCallback(
    (mode: "chot" | "bo-chot"): number[] | null => {
      if (selectedRowKeys.length === 0) {
        message.warning("Chưa chọn mẻ nào");
        return null;
      }
      const ids = selectedRowKeys.map((k) => Number(k));
      const selectedRows = data.filter((r) => ids.includes(r.meId));
      const invalid = mode === "chot"
        ? selectedRows.filter((r) => !(r.isThuNghiem === true && r.trangThaiPCN === true && r.trangThaiChotPCN !== true))
        : selectedRows.filter((r) => r.trangThaiChotPCN !== true);
      if (invalid.length > 0) {
        const msg = mode === "chot"
          ? `Chỉ chốt được mẻ đã Xác nhận PCN, chưa chốt — không hợp lệ: ${invalid.map((r) => r.maMe ?? r.meId).join(", ")}`
          : `Mẻ chưa chốt PCN, không cần hủy: ${invalid.map((r) => r.maMe ?? r.meId).join(", ")}`;
        message.warning(msg);
        return null;
      }
      return ids;
    },
    [selectedRowKeys, data]
  );

  const handleChotPCN = useCallback(async () => {
    const ids = validateChotPCN("chot");
    if (!ids) return;
    setChotPCNBusy(true);
    try {
      await HRC1Api.chotPCN(ids);
      message.success("Đã chốt PCN");
      setSelectedRowKeys([]);
      void fetchData(filters);
    } catch {
      message.error("Chốt PCN thất bại");
    } finally {
      setChotPCNBusy(false);
    }
  }, [validateChotPCN, filters, fetchData]);

  const handleBoChotPCN = useCallback(async () => {
    const ids = validateChotPCN("bo-chot");
    if (!ids) return;
    setChotPCNBusy(true);
    try {
      await HRC1Api.boChotPCN(ids);
      message.success("Đã hủy chốt PCN");
      setSelectedRowKeys([]);
      void fetchData(filters);
    } catch {
      message.error("Hủy chốt PCN thất bại");
    } finally {
      setChotPCNBusy(false);
    }
  }, [validateChotPCN, filters, fetchData]);

  // Xác nhận/Không xác nhận/Reset PCN (dời từ form máy đúc sang) — chỉ áp dụng mẻ thử
  // nghiệm, chưa chốt, chưa bị chốt PCN vĩnh viễn.
  const validateXacNhanPCN = useCallback((): number[] | null => {
    if (selectedRowKeys.length === 0) {
      message.warning("Chưa chọn mẻ nào");
      return null;
    }
    const ids = selectedRowKeys.map((k) => Number(k));
    const selectedRows = data.filter((r) => ids.includes(r.meId));
    const daChotPCN = selectedRows.filter((r) => r.trangThaiChotPCN === true);
    if (daChotPCN.length > 0) {
      message.warning(`Mẻ đã chốt PCN, không thể sửa: ${daChotPCN.map((r) => r.maMe ?? r.meId).join(", ")}`);
      return null;
    }
    const invalid = selectedRows.filter((r) => !(r.isThuNghiem === true && !r.isChot));
    if (invalid.length > 0) {
      message.warning(`Chỉ áp dụng PCN cho mẻ thử nghiệm, chưa chốt — không hợp lệ: ${invalid.map((r) => r.maMe ?? r.meId).join(", ")}`);
      return null;
    }
    return ids;
  }, [selectedRowKeys, data]);

  const handleXacNhanPCN = useCallback(async () => {
    const ids = validateXacNhanPCN();
    if (!ids) return;
    setXacNhanPCNBusy(true);
    try {
      await HRC1Api.xacNhanPCN(ids);
      message.success("Đã xác nhận PCN");
      setSelectedRowKeys([]);
      void fetchData(filters);
    } catch {
      message.error("Xác nhận PCN thất bại");
    } finally {
      setXacNhanPCNBusy(false);
    }
  }, [validateXacNhanPCN, filters, fetchData]);

  const handleKhongXacNhanPCN = useCallback(async () => {
    const ids = validateXacNhanPCN();
    if (!ids) return;
    setXacNhanPCNBusy(true);
    try {
      await HRC1Api.khongXacNhanPCN(ids);
      message.success("Đã đặt Không xác nhận PCN");
      setSelectedRowKeys([]);
      void fetchData(filters);
    } catch {
      message.error("Không xác nhận PCN thất bại");
    } finally {
      setXacNhanPCNBusy(false);
    }
  }, [validateXacNhanPCN, filters, fetchData]);

  const handleResetXacNhanPCN = useCallback(async () => {
    const ids = validateXacNhanPCN();
    if (!ids) return;
    setXacNhanPCNBusy(true);
    try {
      await HRC1Api.resetXacNhanPCN(ids);
      message.success("Đã reset xác nhận PCN");
      setSelectedRowKeys([]);
      void fetchData(filters);
    } catch {
      message.error("Reset xác nhận PCN thất bại");
    } finally {
      setXacNhanPCNBusy(false);
    }
  }, [validateXacNhanPCN, filters, fetchData]);

  const handleExport = useCallback(async () => {
    const v = form.getFieldsValue(true) as Record<string, unknown>;
    const dr = v.ngaySX as [dayjs.Dayjs, dayjs.Dayjs] | undefined;
    if (!dr?.[0] || !dr?.[1]) {
      message.warning("Vui lòng chọn khoảng ngày đúc trước khi xuất Excel.");
      return;
    }
    const drLo = v.ngayLoThoi as [dayjs.Dayjs, dayjs.Dayjs] | undefined;
    const tt = v.trangThai as string | undefined;
    const q: HRC1_ThongKeQuery = {
      tuNgay:        dr[0].format("YYYY-MM-DD"),
      denNgay:       dr[1].format("YYYY-MM-DD"),
      tuNgayLoThoi:  drLo?.[0]?.format("YYYY-MM-DD"),
      denNgayLoThoi: drLo?.[1]?.format("YYYY-MM-DD"),
      ca:            v.ca != null ? Number(v.ca) : undefined,
      kip:           v.kip ? String(v.kip) : undefined,
      loSo:          v.loSo != null ? Number(v.loSo) : undefined,
      tlSo:          v.tlSo != null ? Number(v.tlSo) : undefined,
      idMayDuc:      v.idMayDuc != null ? Number(v.idMayDuc) : undefined,
      maMe:          v.maMe ? String(v.maMe).trim() : undefined,
      thungSo:       v.thungSo ? String(v.thungSo).trim() : undefined,
      phanLoai:      v.phanLoai ? String(v.phanLoai).trim() : undefined,
      isManualTL:           v.isManualTL === true ? true : undefined,
      isTrungMeThoi:        v.isTrungMeThoi === true ? true : undefined,
      isChuyenMe:           v.isChuyenMe === true ? true : undefined,
      chuaCoNhomPhanLoai:   v.chuaCoNhomPhanLoai === true ? true : undefined,
      idNhomPhanLoai:       v.idNhomPhanLoai != null ? Number(v.idNhomPhanLoai) : undefined,
      isThuNghiem:          v.isThuNghiem === true ? true : undefined,
      trangThaiPCN:         v.isThuNghiem === true && v.trangThaiPCN != null
        ? v.trangThaiPCN === "true"
        : undefined,
      isLenThang:           v.isLenThang === true ? true : undefined,
      chuaLenDuc:           v.chuaLenDuc === true ? true : undefined,
      trangThaiLo:   tt === "lo_0"  ? 0 : tt === "lo_1"  ? 1 : undefined,
      trangThaiTL:   tt === "tl_0"  ? 0 : tt === "tl_1"  ? 1 : undefined,
      trangThaiDuc:  tt === "duc_0" ? 0 : tt === "duc_1" ? 1 : undefined,
      isChot:        tt === "chot"  ? true : undefined,
      page: 1,
      pageSize: pagination.pageSize,
    };
    setExporting(true);
    try {
      await HRC1Api.exportThongKe(q);
    } catch (e: unknown) {
      const msg = typeof e === "string" ? e : (e as { message?: string })?.message ?? "Xuất Excel thất bại.";
      message.error(msg);
    } finally {
      setExporting(false);
    }
  }, [form, pagination.pageSize]);

  const columns = useMemo((): TableColumnsType<HRC1_ThongKeRow> => [
    {
      title: "TT Nhận", key: "trangThaiTL", width: 95,align: "center",fixed: "left",
      render: (_: unknown, r: HRC1_ThongKeRow) => {
        if (r.trangThaiTL === 1) return <Tag color="cyan">Đã nhận</Tag>;
        if (r.trangThaiTL === 0) return <Tag>Chưa nhận</Tag>;
        return <Tag color="default">-</Tag>;
      },
    },
    {
      title: "TT Đúc", key: "trangThaiDuc", width: 100,align: "center",fixed: "left",
      render: (_: unknown, r: HRC1_ThongKeRow) => {
        if (r.trangThaiDuc === 1) return <Tag color="blue">Đã xác nhận</Tag>;
        if (r.trangThaiDuc === 0) return <Tag>Chờ</Tag>;
        return <Tag color="default">-</Tag>;
      },
    },
    {
      title: "Ngày đúc", key: "ngayDuc", width: 110, fixed: "left", align: "center",
      render: (_: unknown, r: HRC1_ThongKeRow) => {
        const v = r.ngayDuc ?? r.ngayNhanTL ?? r.ngayTao;
        return v ? dayjs(v).format("DD/MM/YYYY") : "-";
      },
    },
    {
      title: "Ca Đúc", key: "caDuc", width: 70, fixed: "left", align: "center",
      render: (_: unknown, r: HRC1_ThongKeRow) => {
        const v = r.caDuc ?? r.caTinhLuyen ?? r.ca;
        return v === 1 ? "Ngày" : v === 2 ? "Đêm" : "-";
      },
    },
    {
      title: "Kíp Đúc", key: "kipDuc", width: 60, align: "center", fixed: "left",
      render: (_: unknown, r: HRC1_ThongKeRow) => r.kipTinhLuyen ?? r.kip ?? "-",
    },
    {
      title: "Chốt", key: "isChot", width: 80, align: "center",fixed: "left",
      render: (_: unknown, r: HRC1_ThongKeRow) =>
        r.isChot ? <Tag color="green">Đã chốt</Tag> : <Tag color="default">-</Tag>,
    },
    {
      title: "Ngày lò thổi", dataIndex: "ngayTao", key: "ngayTao", width: 110, fixed: "left", align: "center",
      render: (v: string) => v ? dayjs(v).format("DD/MM/YYYY") : "-",
    },
    {
      title: "Ngày TL", dataIndex: "ngayNhanTL", key: "ngayNhanTL", width: 110, fixed: "left", align: "center",
      render: (v: string) => v ? dayjs(v).format("DD/MM/YYYY") : "-",
    },
    {
      title: "Ca TL", dataIndex: "caTinhLuyen", key: "caTinhLuyen", width: 70, fixed: "left", align: "center",
      render: (v: number) => v === 1 ? "Ngày" : v === 2 ? "Đêm" : "-",
    },
    { title: "Máy đúc", dataIndex: "tenMayDuc", key: "tenMayDuc", width: 110, fixed: "left" },
    {
      title: "Mẻ thổi", dataIndex: "maMe", key: "maMe", width: 110, fixed: "left", align: "center",
      render: (v: string, r: HRC1_ThongKeRow) =>
        r.isTrungMeThoi ? <span style={{ color: "red", fontWeight: 600 }}>{v}</span> : v,
    },
    // { title: "Mác thép", dataIndex: "macThep", key: "macThep", width: 110 },
    { title: "Thùng số", dataIndex: "thungSo", key: "thungSo", width: 60, align: "center" },
    { title: "Thời gian", dataIndex: "thoiGian", key: "thoiGian", width: 65 , align: "center"},
    {
      title: "KL LF sau thép", dataIndex: "kllfSauThep", key: "kllfSauThep", width: 80,
      align: "right", render: (v: number) => fmt(v),
    },
    {
      title: "KL lần 1", dataIndex: "klLan1", key: "klLan1", width: 80,
      align: "right", render: (v: number) => fmt(v),
    },
    {
      title: "KL lần 2", dataIndex: "klLan2", key: "klLan2", width: 80,
      align: "right", render: (v: number) => fmt(v),
    },
    {
      title: "KL lần 3", dataIndex: "klLan3", key: "klLan3", width: 80,
      align: "right", render: (v: number) => fmt(v),
    },
    {
      title: "KL thép lỏng", dataIndex: "klThepLong", key: "klThepLong", width: 80,
      align: "right",
      render: (v: number) => (
        <span style={{ fontWeight: 600, ...(v < 0 ? { color: "red" } : {}) }}>{fmt(v)}</span>
      ),
    },
    {
      title: "KL Thép Lỏng chốt", key: "klThepLongChot", width: 85,
      align: "right",
      render: (_: unknown, r: HRC1_ThongKeRow) => {
        const v = r.klThepLongChot;
        if (v == null) return "";
        const isTransferred = r.chuyenVeMaMe != null && r.chuyenVeMaMe !== r.maMe;
        return (
          <Tooltip title={isTransferred ? `Đã chuyển sang mẻ ${r.chuyenVeMaMe}` : undefined}>
            <span style={{ fontWeight: 600, color: isTransferred ? "#aaa" : undefined }}>
              {fmt(v)}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: "KL phân bổ", dataIndex: "klThepLongPhanBo", key: "klThepLongPhanBo", width: 80,
      align: "right",
      render: (v: number) => fmt(v),
    },
    { title: "TL / Lên thẳng", dataIndex: "tinhLuyenLenThang", key: "tinhLuyenLenThang", width: 90, align: "center" },
    {
      title: "TL số", key: "soTinhLuyenNhan", width: 60, align: "center",
      render: (_: unknown, r: HRC1_ThongKeRow) =>
        r.soTinhLuyenNhan != null ? `TL ${r.soTinhLuyenNhan}` : "-",
    },
    { title: "Chuyển mẻ", dataIndex: "chuyenVeMaMe", key: "chuyenVeMaMe", width: 100, align: "center",
      render: (_: unknown, r: HRC1_ThongKeRow) => {
        const isRealTransfer = r.chuyenVeMaMe && r.chuyenVeMaMe !== r.maMe;
        return isRealTransfer
          ? <span style={{ background: "#FFFF00", padding: "0 4px", borderRadius: 3 }}>{r.chuyenVeMaMe}</span>
          : <span>{r.maMe}</span>;
      }},
    { title: "Máy đúc chuyển", dataIndex: "tenMayDucChuyen", key: "tenMayDucChuyen", width: 115, align: "center",
      render: (v: string | null) => v ?? "" },
    { title: "Phân loại", dataIndex: "phanLoai", key: "phanLoai", width: 100, align: "center" },
    { title: "Mác BKMIS", dataIndex: "macThepBKMIS", key: "macThepBKMIS", width: 110 },
    { title: "Nhóm phân loại mác thép", dataIndex: "tenNhomPhanLoai", key: "tenNhomPhanLoai", width: 260 },
    
    {
      title: "Trùng mẻ", dataIndex: "isTrungMeThoi", key: "isTrungMeThoi", width: 70, align: "center",
      render: (v: boolean) => v ? <Tag color="red">Trùng</Tag> : null,
    },
    {
      title: "Thử nghiệm", dataIndex: "isThuNghiem", key: "isThuNghiem", width: 70, align: "center",
      render: (v: boolean) => v ? "✓" : "",
    },
    {
      title: "Tình trạng PCN", key: "trangThaiPCN", width: 100, align: "center",
      render: (_: unknown, r: HRC1_ThongKeRow) => {
        if (r.isThuNghiem !== true) return "";
        if (r.trangThaiChotPCN === true) return <Tag color="green">Đã chốt</Tag>;
        return r.trangThaiPCN === true
          ? <Tag color="cyan">Đã XN</Tag>
          : r.trangThaiPCN === false
            ? <Tag color="red">Không XN</Tag>
          : <Tag color="default">Chờ</Tag>;
      },
    },
    { title: "Ghi chú Lò", dataIndex: "ghiChuLo",  key: "ghiChuLo",  width: 140 },
    { title: "Ghi chú TL", dataIndex: "ghiChuTL",  key: "ghiChuTL",  width: 140 },
    { title: "Ghi chú đúc", dataIndex: "ghiChuDuc", key: "ghiChuDuc", width: 140 },
    {
      title: "Ghi chú PCN", key: "ghiChuPCN", width: 140,
      render: (_: unknown, r: HRC1_ThongKeRow) => (
        <GhiChuPCNInput
          meId={r.meId}
          value={r.ghiChuPCN}
          locked={!canXacNhanPCN || r.isThuNghiem !== true || r.isChot === true || r.trangThaiChotPCN === true}
          onSaved={(v) => setData((prev) => prev.map((row) => row.meId === r.meId ? { ...row, ghiChuPCN: v } : row))}
        />
      ),
    },
    { title: "Người sửa lò",  dataIndex: "tenCapNhatBoiLo",  key: "tenCapNhatBoiLo",  width: 160 },
    { title: "Người sửa TL", dataIndex: "tenCapNhatBoiTL",  key: "tenCapNhatBoiTL",  width: 160 },
    { title: "Người XN đúc", dataIndex: "tenCapNhatBoiDuc", key: "tenCapNhatBoiDuc", width: 160 },
  ], [canXacNhanPCN]);

  // ── Tổng hợp ─────────────────────────────────────────────────────────────
  type SummaryRow = {
    key: string;
    phanLoai: HRC1_TongHopItem | null;
    ca: HRC1_TongHopItem | null;
    kip: HRC1_TongHopItem | null;
    tinhLuyenLenThang: HRC1_TongHopItem | null;
    ducVuong: HRC1_TongHopItem | null;
    ducTam: HRC1_TongHopItem | null;
    nhomPhanLoaiMacThep: HRC1_TongHopItem | null;
    isTotal?: boolean;
  };

  const renderCell = (item: HRC1_TongHopItem | null, isTotal?: boolean) => {
    if (!item) return null;
    return (
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontWeight: isTotal ? 600 : undefined }}>
        <span>{item.label}</span>
        <span>{fmt(item.klThepLong)}</span>
      </div>
    );
  };

  const summaryRows = useMemo<SummaryRow[]>(() => {
    if (!tongHopData) return [];
    const { phanLoai, ca, kip, tinhLuyenLenThang, ducVuong, ducTam, nhomPhanLoaiMacThep } = tongHopData;
    const maxLen = Math.max(phanLoai.length, ca.length, kip.length, tinhLuyenLenThang.length, ducVuong.length, ducTam.length, nhomPhanLoaiMacThep.length, 0);
    const rows: SummaryRow[] = Array.from({ length: maxLen }, (_, i) => ({
      key: `s${i}`,
      phanLoai:            phanLoai[i]            ?? null,
      ca:                  ca[i]                  ?? null,
      kip:                 kip[i]                 ?? null,
      tinhLuyenLenThang:   tinhLuyenLenThang[i]   ?? null,
      ducVuong:            ducVuong[i]            ?? null,
      ducTam:              ducTam[i]              ?? null,
      nhomPhanLoaiMacThep: nhomPhanLoaiMacThep[i] ?? null,
    }));
    const sum = (arr: HRC1_TongHopItem[]) => arr.reduce((acc, x) => acc + x.klThepLong, 0);
    rows.push({
      key: "total", isTotal: true,
      phanLoai:            { label: "Tổng", klThepLong: sum(phanLoai) },
      ca:                  { label: "Tổng", klThepLong: sum(ca) },
      kip:                 { label: "Tổng", klThepLong: sum(kip) },
      tinhLuyenLenThang:   { label: "Tổng", klThepLong: sum(tinhLuyenLenThang) },
      ducVuong:            { label: "Tổng", klThepLong: sum(ducVuong) },
      ducTam:              { label: "Tổng", klThepLong: sum(ducTam) },
      nhomPhanLoaiMacThep: { label: "Tổng", klThepLong: sum(nhomPhanLoaiMacThep) },
    });
    return rows;
  }, [tongHopData]);

  const summaryColumns = useMemo(() => [
    { title: "Phân loại",           key: "phanLoai",            render: (_: unknown, r: SummaryRow) => renderCell(r.phanLoai, r.isTotal) },
    { title: "Ca",                  key: "ca",                  render: (_: unknown, r: SummaryRow) => renderCell(r.ca, r.isTotal) },
    { title: "Kíp",                 key: "kip",                 render: (_: unknown, r: SummaryRow) => renderCell(r.kip, r.isTotal) },
    { title: "TL / Lên thẳng",     key: "tinhLuyenLenThang",   render: (_: unknown, r: SummaryRow) => renderCell(r.tinhLuyenLenThang, r.isTotal) },
    { title: "Đúc vuông",           key: "ducVuong",            render: (_: unknown, r: SummaryRow) => renderCell(r.ducVuong, r.isTotal) },
    { title: "Đúc tấm",            key: "ducTam",              render: (_: unknown, r: SummaryRow) => renderCell(r.ducTam, r.isTotal) },
    { title: "Nhóm phân loại mác thép", key: "nhomPhanLoaiMacThep", render: (_: unknown, r: SummaryRow) => renderCell(r.nhomPhanLoaiMacThep, r.isTotal) },
  ], [tongHopData]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card style={{ marginTop: -10 }}>
      <Form form={form} layout="inline" style={{ marginBottom: 16 }}>
        <Space wrap align="center">
          <Form.Item name="ngaySX" label="Ngày Đúc">
            <RangePicker format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="ngayLoThoi" label="Ngày Lò thổi">
            <RangePicker format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="ca" label="Ca Đúc">
            <Select allowClear style={{ minWidth: 70 }} placeholder="Ca"
              options={[{ label: "Ngày", value: 1 }, { label: "Đêm", value: 2 }]} />
          </Form.Item>
          <Form.Item name="kip" label="Kíp Đúc">
            <Select allowClear style={{ minWidth: 50 }} placeholder="Kíp"
              options={["A","B","C"].map(k => ({ label: `${k}`, value: k }))} />
          </Form.Item>
          <Form.Item name="loSo" label="Lò thổi">
            <Select allowClear style={{ minWidth: 90 }} placeholder="Lò số"
              options={[1,2,3,4,5].map(n => ({ label: `Lò thổi ${n}`, value: n }))} />
          </Form.Item>
          <Form.Item name="tlSo" label="Tinh luyện">
            <Select allowClear style={{ minWidth: 70 }} placeholder="TL số"
              options={[1,2,3,4,5].map(n => ({ label: `TL ${n}`, value: n }))} />
          </Form.Item>
          <Form.Item name="maMeChuyenVe" label="Mẻ chuyển về">
            <Input placeholder="Mã mẻ chuyển về" style={{ width: 110 }} />
          </Form.Item>
          <Form.Item name="idMayDuc" label="Máy đúc">
            <Select allowClear style={{ minWidth: 120 }} placeholder="Máy đúc" options={mayDucOpts} />
          </Form.Item>
          <Form.Item name="maMe" label="Mẻ">
            <Input placeholder="Mã mẻ" style={{ width: 110 }} />
          </Form.Item>
          <Form.Item name="thungSo" label="Thùng số">
            <Input placeholder="Thùng số" style={{ width: 80 }} />
          </Form.Item>
          <Form.Item name="phanLoai" label="Phân loại">
            <Select allowClear style={{ minWidth: 80 }} placeholder="Phân loại"
              options={["Loại 1","Loại 2","Loại 3","Phế phẩm"].map(n => ({ label: `${n}`, value: n }))} />
          </Form.Item>
          <Form.Item name="idNhomPhanLoai" label="Nhóm PL mác">
            <Select allowClear showSearch style={{ minWidth: 180 }} placeholder="Tất cả"
              optionFilterProp="label" options={nhomMacOpts} />
          </Form.Item>
          <Form.Item name="trangThai" label="Trạng thái">
            <Select allowClear style={{ minWidth: 150 }} placeholder="Tất cả"
              options={[
                { label: "TL: chưa nhận",         value: "tl_0" },
                { label: "TL: đã nhận",           value: "tl_1" },
                { label: "Đúc: chờ xác nhận",    value: "duc_0" },
                { label: "Đúc: đã xác nhận",     value: "duc_1" },
                { label: "Đã chốt",               value: "chot" },
              ]}
            />
          </Form.Item>
          <Form.Item name="isManualTL" valuePropName="checked">
            <Checkbox>Nhập tay</Checkbox>
          </Form.Item>
          <Form.Item name="isTrungMeThoi" valuePropName="checked">
            <Checkbox>Trùng mẻ</Checkbox>
          </Form.Item>
          <Form.Item name="isChuyenMe" valuePropName="checked">
            <Checkbox>Đã chuyển mẻ</Checkbox>
          </Form.Item>
          <Form.Item name="chuaCoNhomPhanLoai" valuePropName="checked">
            <Checkbox>Chưa có nhóm PL</Checkbox>
          </Form.Item>
          <Form.Item name="isLenThang" valuePropName="checked">
            <Checkbox>Lên thẳng</Checkbox>
          </Form.Item>
          <Form.Item name="chuaLenDuc" valuePropName="checked">
            <Checkbox>Chưa lên đúc</Checkbox>
          </Form.Item>
          <Form.Item name="isThuNghiem" valuePropName="checked">
            <Checkbox>Thử nghiệm</Checkbox>
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.isThuNghiem !== cur.isThuNghiem}>
            {() =>
              form.getFieldValue("isThuNghiem") ? (
                <Form.Item name="trangThaiPCN" label="Trạng thái PCN">
                  <Select allowClear style={{ minWidth: 150 }} placeholder="Tất cả"
                    options={[
                      { label: "Đã xác nhận", value: "true" },
                      { label: "Không xác nhận", value: "false" },
                    ]} />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" loading={loading} onClick={() => void handleFilter()}>Tìm</Button>
              <Button onClick={handleReset}>Reset</Button>
              <Button
                style={{ backgroundColor: "#217346", borderColor: "#217346", color: "#fff" }}
                loading={exporting}
                onClick={() => void handleExport()}
              >
                Xuất Excel
              </Button>
              <Tooltip title="Đồng bộ phân loại">
                <Button
                  icon={<SyncOutlined />}
                  loading={syncing}
                  onClick={() => void handleSync()}
                >
                </Button>
              </Tooltip>
              {canXacNhanPCN && (
                <>
                  <Popconfirm
                    title={`Xác nhận PCN ${selectedRowKeys.length} mẻ?`}
                    disabled={selectedRowKeys.length === 0}
                    onConfirm={() => void handleXacNhanPCN()}
                  >
                    <Button type="primary" loading={xacNhanPCNBusy} disabled={selectedRowKeys.length === 0}>
                      Xác nhận PCN ({selectedRowKeys.length})
                    </Button>
                  </Popconfirm>
                  <Popconfirm
                    title={`Không xác nhận PCN ${selectedRowKeys.length} mẻ?`}
                    disabled={selectedRowKeys.length === 0}
                    onConfirm={() => void handleKhongXacNhanPCN()}
                  >
                    <Button danger loading={xacNhanPCNBusy} disabled={selectedRowKeys.length === 0}>
                      Không xác nhận PCN ({selectedRowKeys.length})
                    </Button>
                  </Popconfirm>
                  <Popconfirm
                    title={`Reset xác nhận PCN ${selectedRowKeys.length} mẻ?`}
                    disabled={selectedRowKeys.length === 0}
                    onConfirm={() => void handleResetXacNhanPCN()}
                  >
                    <Button loading={xacNhanPCNBusy} disabled={selectedRowKeys.length === 0}>
                      Reset xác nhận PCN ({selectedRowKeys.length})
                    </Button>
                  </Popconfirm>
                </>
              )}
              {canChotPCN && (
                <>
                  <Popconfirm
                    title={`Chốt PCN ${selectedRowKeys.length} mẻ?`}
                    disabled={selectedRowKeys.length === 0}
                    onConfirm={() => void handleChotPCN()}
                  >
                    <Button type="primary" loading={chotPCNBusy} disabled={selectedRowKeys.length === 0}>
                      Chốt PCN ({selectedRowKeys.length})
                    </Button>
                  </Popconfirm>
                  <Popconfirm
                    title={`Hủy chốt PCN ${selectedRowKeys.length} mẻ?`}
                    disabled={selectedRowKeys.length === 0}
                    onConfirm={() => void handleBoChotPCN()}
                  >
                    <Button danger loading={chotPCNBusy} disabled={selectedRowKeys.length === 0}>
                      Hủy chốt PCN ({selectedRowKeys.length})
                    </Button>
                  </Popconfirm>
                </>
              )}
            </Space>
          </Form.Item>
        </Space>
      </Form>

      <Table<HRC1_ThongKeRow>
        bordered
        size="small"
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey={(r) => String(r.meId)}
        rowSelection={(canChotPCN || canXacNhanPCN) ? { selectedRowKeys, onChange: setSelectedRowKeys } : undefined}
        scroll={{ x: 1800, y: 520 }}
        onRow={(r) => (r.isManualTL ? { style: { backgroundColor: "#FFFFCC" } } : {})}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: totalRecords,
          showSizeChanger: true,
          showQuickJumper: true,
          pageSizeOptions: ["10","20","50","100"],
          showTotal: (total, range) => `${range[0]}-${range[1]} / ${total} dòng`,
          onChange: (page, pageSize) => void fetchData({ ...filters, page, pageSize }),
        }}
        summary={() => {
          // rowSelection (khi canChotPCN hoặc canXacNhanPCN) chèn thêm 1 cột checkbox ở đầu —
          // cộng offset vào colSpan/index đầu tiên để các cell tổng không bị lệch cột.
          const selCol = (canChotPCN || canXacNhanPCN) ? 1 : 0;
          return (
            <Table.Summary fixed>
              <Table.Summary.Row style={{ background: "#fafafa", fontWeight: 600 }}>
                <Table.Summary.Cell index={0} colSpan={9 + selCol} align="right">
                  Tổng dòng: {totalRecords}
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5 + selCol} colSpan={8} />
                <Table.Summary.Cell index={13 + selCol} align="right">
                  <span style={{ fontWeight: 600, ...(Number(totalKl) < 0 ? { color: "red" } : {}) }}>
                    {fmt(totalKl)}
                  </span>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={14 + selCol} align="right">
                  <span style={{ fontWeight: 600 }}>{fmt(totalKlChot)}</span>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={15 + selCol} align="right">
                  {fmt(totalKlPhanBo)}
                </Table.Summary.Cell>
                <Table.Summary.Cell index={16 + selCol} colSpan={8} />
              </Table.Summary.Row>
            </Table.Summary>
          );
        }}
      />

      {tongHopData && summaryRows.length > 0 && (
        <Table<SummaryRow>
          bordered
          size="small"
          columns={summaryColumns}
          dataSource={summaryRows}
          pagination={false}
          rowKey="key"
          style={{ marginTop: 16 }}
          rowClassName={(r) => r.isTotal ? "ant-table-row-selected" : ""}
        />
      )}
    </Card>
  );
};

export default ThongKeBBGNThepLongHRC1;
