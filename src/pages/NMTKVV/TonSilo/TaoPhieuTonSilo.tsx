/* eslint-disable @typescript-eslint/no-explicit-any */
import TKVV_TonSilo from "../../../utils/BM_config/TKVV_TonSilo.json";
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Typography,
  message,
} from "antd";
import {
  ClearOutlined,
  CloudDownloadOutlined,
  DeleteOutlined,
  DeploymentUnitOutlined,
  PlusOutlined,
  ScissorOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CustomFormItem from "../../../components/CustomFormItem";
import CustomFormTable, {
  type FormColumnDef,
} from "../../../components/CustomFormTable";
import { PhieuApi } from "../../../services/PhieuApi";
import { phieuActionService } from "../../../services/PhieuActionService";
import { TrangThaiPhieuConst } from "../../../utils/constants/TrangThaiPhieuConstant";
import { getThongTinUser } from "../../../utils/constants/GetThongTinLocalStore";
import {
  tkvvTonSiloApi,
  tkvvNvlApi,
  tkvvNvlSiloMappingApi,
  tkvvSiloApi,
  type TKVVTonSiloRowDto,
  type TKVVNguyenVatLieuDto,
  type TKVVNvlSiloMappingDto,
  type TKVVSiloDto,
} from "../../../services/TKVVApi";
import {
  TKVV_SCOPE_OPTIONS,
  getTKVVScopeByNumber,
} from "../../../utils/constants/TKVV_constant";

interface TableRow {
  key: string | number;
  dbId?: number | null;
  siloID?: number | null;
  nguyenVatLieuID?: number | null;
  maSilo?: string;
  nguyenLieu?: string;
  doAm?: number | string;
  doAmText?: string;
  tonDau?: number | string;
  nhap?: number | string;
  nhapAuto?: number | string;
  xuat?: number | string;
  xuatAuto?: number | string;
  tonCuoi?: number | string;
  tonCuoiAuto?: number | string;
  isAdjusted?: boolean;
  isTachLieu?: boolean;
  ghiChu?: string;
  [key: string]: any;
}

interface SiloMappingModalRow {
  id?: number;
  key: string | number;
  ca: number;
  nguyenVatLieuID: number | null;
  siloID: number | null;
  thuTu: number;
}

interface TachLieuRow {
  key: string | number;
  nguyenVatLieuID: number | null;
  doAm: number | string;
  tonDau: number | string;
  nhap: number | string;
  xuat: number | string;
  tonCuoi: number | string;
  ghiChu: string;
}

const TACH_SUM_FIELDS: Array<keyof TachLieuRow> = [
  "tonDau",
  "nhap",
  "xuat",
  "tonCuoi",
];

const recalcTachRow0 = (rows: TachLieuRow[], src: TableRow): TachLieuRow[] => {
  if (rows.length < 2) return rows;
  const result = [...rows];
  const row0 = { ...result[0] };
  TACH_SUM_FIELDS.forEach((f) => {
    const srcVal = parseFloat(String(src[f] ?? 0)) || 0;
    const sumOthers = result.slice(1).reduce((acc, r) => {
      const v = parseFloat(String(r[f] ?? 0));
      return acc + (isNaN(v) ? 0 : v);
    }, 0);
    (row0 as any)[f] = parseFloat((srcVal - sumOthers).toFixed(3)) || 0;
  });
  result[0] = row0;
  return result;
};

const MA_BM = "TKVV_TONSILO";

const fmt3 = (v: unknown): string => {
  if (v == null || v === "") return "";
  const n = Number(v);
  return Number.isFinite(n) ? (Math.round(n * 1000) / 1000).toFixed(3) : String(v);
};

const fromInitRecord = (item: TKVVTonSiloRowDto, idx: number): TableRow => ({
  key: `silo-${item.siloID}-${idx}`,
  dbId: item.id > 0 ? item.id : null,
  siloID: item.siloID,
  nguyenVatLieuID: item.nguyenVatLieuID,
  maSilo: item.maSilo ?? "",
  nguyenLieu: item.tenNVL ?? "",
  doAm: item.doAm ?? "",
  doAmText: fmt3(item.doAmText),
  tonDau: fmt3(item.tonDau),
  nhap: fmt3(item.nhap ?? item.nhapAuto),
  nhapAuto: fmt3(item.nhapAuto),
  xuat: fmt3(item.xuat ?? item.xuatAuto),
  xuatAuto: fmt3(item.xuatAuto),
  tonCuoi: fmt3(
    item.isAdjusted || item.isTachLieu
      ? item.tonCuoi ?? item.tonCuoiAuto
      : item.tonCuoiAuto
  ),
  tonCuoiAuto: fmt3(item.tonCuoiAuto),
  isAdjusted: item.isAdjusted ?? false,
  isTachLieu: item.isTachLieu ?? false,
  ghiChu: item.ghiChu ?? "",
});

// Nhóm cùng silo ở gần nhau; trong cùng silo sort theo NVL; chưa gán NVL xuống dưới
const sortSiloRows = (rows: TableRow[]): TableRow[] => {
  const withNvl = rows.filter((r) => r.nguyenVatLieuID != null);
  const withoutNvl = rows.filter((r) => r.nguyenVatLieuID == null);
  withNvl.sort((a, b) => {
    const siloCompare = String(a.maSilo ?? "").localeCompare(
      String(b.maSilo ?? ""),
      undefined,
      { numeric: true },
    );
    if (siloCompare !== 0) return siloCompare;
    return (a.nguyenVatLieuID as number) - (b.nguyenVatLieuID as number);
  });
  return [...withNvl, ...withoutNvl];
};

const TaoPhieuTonSilo = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const idphieu = id;

  const config = TKVV_TonSilo as any;
  const [form] = Form.useForm();

  const [tableData, setTableData] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingInit, setLoadingInit] = useState(false);
  const [soPhieu, setSoPhieu] = useState("");

  const [showSiloModal, setShowSiloModal] = useState(false);
  const [modalRows, setModalRows] = useState<SiloMappingModalRow[]>([]);
  const [modalNgaySXGan, setModalNgaySXGan] = useState("");
  const [nvlList, setNvlList] = useState<TKVVNguyenVatLieuDto[]>([]);
  const [siloList, setSiloList] = useState<TKVVSiloDto[]>([]);
  const [loadingBatch, setLoadingBatch] = useState(false);
  const [loadingSilo, setLoadingSilo] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);

  const [showTachModal, setShowTachModal] = useState(false);
  const [tachSourceIdx, setTachSourceIdx] = useState<number | null>(null);
  const [tachSourceRow, setTachSourceRow] = useState<TableRow | null>(null);
  const [tachRows, setTachRows] = useState<TachLieuRow[]>([]);
  const [loadingTachNvl, setLoadingTachNvl] = useState(false);

  const [phieuInfo, setPhieuInfo] = useState<{
    tinhTrang?: number;
    nguoiTaoId?: number | null;
    idphongBan?: number | null;
    pheDuyet?: any[];
    isClone?: boolean;
    idPhieuGoc?: string | null;
  }>({});

  const phieuInfoRef = useRef(phieuInfo);
  useEffect(() => {
    phieuInfoRef.current = phieuInfo;
  }, [phieuInfo]);

  const tableDataRef = useRef(tableData);
  useEffect(() => {
    tableDataRef.current = tableData;
  }, [tableData]);

  // Tính Tồn cuối tính toán = Σ(tồn đầu) + Σ(nhập) - Σ(xuất) nhóm theo NVL, chỉ gán cho dòng đầu tiên của mỗi nhóm
  const tonCuoiTinhToanByKey = useMemo(() => {
    const groups = new Map<
      number,
      {
        sumTonDau: number;
        sumNhap: number;
        sumXuat: number;
        firstKey: string | number;
      }
    >();
    tableData.forEach((row) => {
      if (row.nguyenVatLieuID == null) return;
      const id = row.nguyenVatLieuID as number;
      const tonDau = parseFloat(String(row.tonDau ?? 0)) || 0;
      const nhap = parseFloat(String(row.nhap ?? 0)) || 0;
      const xuat = parseFloat(String(row.xuat ?? 0)) || 0;
      if (!groups.has(id)) {
        groups.set(id, {
          sumTonDau: tonDau,
          sumNhap: nhap,
          sumXuat: xuat,
          firstKey: row.key,
        });
      } else {
        const g = groups.get(id)!;
        g.sumTonDau += tonDau;
        g.sumNhap += nhap;
        g.sumXuat += xuat;
      }
    });
    const result = new Map<string | number, number>();
    groups.forEach((g) => {
      result.set(
        g.firstKey,
        parseFloat((g.sumTonDau + g.sumNhap - g.sumXuat).toFixed(3)),
      );
    });
    return result;
  }, [tableData]);

  const tableDataDisplay = useMemo(
    () =>
      tableData.map((row) => ({
        ...row,
        tonCuoiTinhToan: tonCuoiTinhToanByKey.get(row.key) ?? null,
      })),
    [tableData, tonCuoiTinhToanByKey],
  );

  // Key của dòng đầu tiên trong mỗi nhóm NVL (theo thứ tự hiển thị sau sort)
  const firstNvlRowKeySet = useMemo(() => {
    const seen = new Set<number>();
    const result = new Set<string | number>();
    tableDataDisplay.forEach((row) => {
      const nvlId = row.nguyenVatLieuID as number;
      if (nvlId != null && !seen.has(nvlId)) {
        seen.add(nvlId);
        result.add(row.key);
      }
    });
    return result;
  }, [tableDataDisplay]);

  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const signaturesRef = useRef<HTMLDivElement>(null);
  const [tableScrollY, setTableScrollY] = useState(400);

  const recalcTableHeight = useCallback(() => {
    if (!tableWrapperRef.current) return;
    const rect = tableWrapperRef.current.getBoundingClientRect();
    const sigH = signaturesRef.current?.offsetHeight ?? 160;
    const y = Math.max(
      200,
      Math.floor(window.innerHeight - rect.top - sigH - 100),
    );
    setTableScrollY(y);
  }, []);

  useEffect(() => {
    const timer = setTimeout(recalcTableHeight, 50);
    window.addEventListener("resize", recalcTableHeight);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", recalcTableHeight);
    };
  }, [loading, recalcTableHeight]);

  // Form.useWatch để reactive disable nút "Tải dữ liệu"
  const ngaySXWatch = Form.useWatch("ngaySX", form);
  const scopeWatch = Form.useWatch("scope", form);

  const currentUserInfo = useMemo(() => getThongTinUser(), []);
  const currentTinhTrang = phieuInfo.tinhTrang ?? TrangThaiPhieuConst.DangLuu;

  const isSignatureReadonly = [
    TrangThaiPhieuConst.HoanThanh,
    TrangThaiPhieuConst.DangPheDuyet,
    TrangThaiPhieuConst.DaChot,
  ].includes(currentTinhTrang);

  const isFormLocked = !(
    currentTinhTrang === TrangThaiPhieuConst.DangLuu ||
    currentTinhTrang === TrangThaiPhieuConst.DaThuHoi ||
    currentTinhTrang === TrangThaiPhieuConst.HieuChinh
  );

  const getUserInfo = useCallback(() => getThongTinUser(), []);

  const initData = useCallback(async () => {
    try {
      setLoading(true);
      if (idphieu) {
        const res: any = await PhieuApi.getDetail(idphieu);
        if (res) {
          setSoPhieu(res.soPhieu || "");
          const data = res.jsonData || {};

          const signatureFields: Record<string, any> = {};
          (res.pheDuyet || []).forEach((pd: any) => {
            const sig = config.signatures.find(
              (s: any) =>
                s.capDuyet === pd.capDuyet && s.type === "selectNguoiKy",
            );
            if (sig && pd.nguoiDuyetId)
              signatureFields[sig.key] = pd.nguoiDuyetId;
          });

          const tinhTrang = res.tinhTrang ?? 0;
          // Ưu tiên jsonData; fallback top-level PhieuDto fields (cho phiếu auto-created)
          const ngaySXValue = data.ngaySX || data.NgaySX || res.ngaySX || res.NgaySX;
          const caVal = data.ca ?? res.ca ?? null;
          const scopeVal =
            data.scope != null
              ? Number(data.scope)
              : res.scope != null
                ? Number(res.scope)
                : undefined;

          form.setFieldsValue({
            ngaySX: ngaySXValue ? dayjs(ngaySXValue) : null,
            ca: caVal,
            scope: scopeVal,
            kip: data.kip,
            ...signatureFields,
          });

          if (tinhTrang === TrangThaiPhieuConst.DangLuu) {
            const overrides: Record<string, any> = {};
            config.signatures
              .filter((s: any) => s.capDuyet === 0)
              .forEach((s: any) => {
                overrides[s.key] = currentUserInfo?.iD_TaiKhoan ?? null;
              });
            if (Object.keys(overrides).length > 0)
              form.setFieldsValue(overrides);
          }

          const siloRows = await tkvvTonSiloApi.getRowsByPhieu(idphieu);
          setTableData(sortSiloRows(siloRows.map(fromInitRecord)));

          setPhieuInfo({
            tinhTrang,
            nguoiTaoId: res.nguoiTaoId ?? null,
            idphongBan: res.idphongBan ?? null,
            pheDuyet: res.pheDuyet || data.pheDuyet || [],
            isClone: res.isClone ?? false,
            idPhieuGoc:
              res.idPhieuGoc ?? res.iD_PhieuGoc ?? res.ID_PhieuGoc ?? null,
          });
        }
      } else {
        setPhieuInfo({});
        setTableData([]);
        setTimeout(() => {
          const overrides: Record<string, any> = { ngaySX: dayjs() };
          config.signatures
            .filter((s: any) => s.capDuyet === 0)
            .forEach((s: any) => {
              overrides[s.key] = currentUserInfo?.iD_TaiKhoan ?? null;
            });
          form.setFieldsValue(overrides);
        }, 300);
      }
    } catch {
      message.error("Không thể tải dữ liệu ban đầu!");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idphieu, config.signatures, currentUserInfo]);

  useEffect(() => {
    initData();
  }, [initData]);

  const handleLoadRows = useCallback(async () => {
    const ngaySXValue: dayjs.Dayjs | null = form.getFieldValue("ngaySX");
    if (!ngaySXValue) {
      message.warning("Chọn ngày sản xuất");
      return;
    }
    const scopeValue: number | undefined = form.getFieldValue("scope");
    if (!scopeValue) {
      message.warning("Chọn xưởng (scope)");
      return;
    }
    const caValue = form.getFieldValue("ca");
    if (!caValue) {
      message.warning("Chọn Ca");
      return;
    }

    setLoadingInit(true);
    try {
      const rows = await tkvvTonSiloApi.initRows({
        ngaySX: ngaySXValue.format("YYYY-MM-DD"),
        ca: caValue,
        scope: scopeValue,
        currentUserId: currentUserInfo?.iD_TaiKhoan ?? null,
        phieuID: idphieu ?? null,
      });
      setTableData(sortSiloRows(rows.map(fromInitRecord)));
      message.info(`Đã tải ${rows.length} Silo`);
    } catch {
      message.error("Lỗi khi tải danh sách Silo");
    } finally {
      setLoadingInit(false);
    }
  }, [form, currentUserInfo, idphieu]);

  const handleCheckSilo = useCallback(async () => {
    const ngaySXValue: dayjs.Dayjs | null = form.getFieldValue("ngaySX");
    if (!ngaySXValue) {
      message.warning("Chọn ngày sản xuất");
      return;
    }
    const scopeValue: number | undefined = form.getFieldValue("scope");
    if (!scopeValue) {
      message.warning("Chọn xưởng (scope)");
      return;
    }
    const caValue: number | undefined = form.getFieldValue("ca");
    if (!caValue) {
      message.warning("Chọn Ca");
      return;
    }

    setLoadingSilo(true);
    try {
      const ngayStr = ngaySXValue.format("YYYY-MM-DD");
      const scopeNum = String(scopeValue);
      const [mappingAll, nvls, silos, nvlOverrides] = await Promise.all([
        tkvvNvlSiloMappingApi.getList({ scope: scopeNum, ngaySX: ngayStr }),
        tkvvNvlApi.getListnvlbyBM({ scope: scopeNum }),
        tkvvSiloApi.getList({ scope: scopeNum }),
        tkvvTonSiloApi.getNvlOverride({ ngaySX: ngayStr, ca: caValue, scope: scopeValue }),
      ]);
      setNvlList(nvls ?? []);
      setSiloList(silos ?? []);

      // Chỉ lấy row mapping đúng ca đang chọn
      let source: TKVVNvlSiloMappingDto[] = (mappingAll ?? []).filter(
        (m) => m.ca === caValue,
      );
      let fromDate = ngayStr;
      let isToday = true;

      if (source.length === 0) {
        const nearest = await tkvvNvlSiloMappingApi.getNearest({
          scope: scopeNum,
          beforeDate: ngayStr,
        });
        source = (nearest ?? []).filter((m) => m.ca === caValue);
        fromDate = source[0]?.ngaySX
          ? String(source[0].ngaySX).slice(0, 10)
          : "";
        isToday = false;
      }

      // Xây map override: siloID → nvlId (từ tách liệu ca trước)
      const overrideMap = new Map<number, number>(
        (nvlOverrides ?? []).map((o) => [o.siloId, o.nvlId]),
      );

      const rows: SiloMappingModalRow[] = source.map((m, i) => {
        const siloId = m.siloID ?? null;
        const overrideNvl =
          siloId != null ? (overrideMap.get(siloId) ?? null) : null;
        return {
          id: m.id ?? 0,
          key: i,
          ca: m.ca,
          nguyenVatLieuID: overrideNvl ?? m.nguyenVatLieuID,
          siloID: siloId,
          thuTu: m.thuTu ?? i + 1,
        };
      });
      setModalRows(rows);
      setModalNgaySXGan(isToday ? "" : fromDate);
      setShowSiloModal(true);
    } catch {
      message.error("Lỗi khi tải mapping silo");
    } finally {
      setLoadingSilo(false);
    }
  }, [form]);

  const updateModalRow = useCallback(
    (idx: number, field: keyof SiloMappingModalRow, value: any) => {
      setModalRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
      );
    },
    [],
  );

  const addModalRow = useCallback(() => {
    setModalRows((prev) => [
      ...prev,
      {
        key: Date.now(),
        ca: 1,
        nguyenVatLieuID: null,
        siloID: null,
        thuTu: prev.length + 1,
      },
    ]);
  }, []);

  const deleteModalRow = useCallback((idx: number) => {
    setModalRows((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleSaveMapping = useCallback(async () => {
    const ngaySXValue: dayjs.Dayjs | null = form.getFieldValue("ngaySX");
    const scopeValue: number | undefined = form.getFieldValue("scope");
    if (!ngaySXValue || !scopeValue) return;
    if (modalRows.some((r) => !r.nguyenVatLieuID)) {
      message.warning("Vui lòng chọn Nguyên vật liệu cho tất cả dòng");
      return;
    }
    setLoadingBatch(true);
    try {
      const ngayStr = ngaySXValue.format("YYYY-MM-DD");
      await tkvvNvlSiloMappingApi.batchCreate({
        maBM: "ALL",
        scope: String(scopeValue),
        ngaySX: ngayStr,
        rows: modalRows.map((r, i) => ({
          id: r.id ?? 0,
          nguyenVatLieuID: r.nguyenVatLieuID!,
          siloID: r.siloID,
          ca: r.ca,
          thuTu: r.thuTu ?? i + 1,
        })),
      });
      setShowSiloModal(false);
      message.success("Đã lưu mapping — đang tải dữ liệu Silo...");
      await handleLoadRows();
    } catch {
      message.error("Lỗi khi lưu mapping");
    } finally {
      setLoadingBatch(false);
    }
  }, [form, modalRows, handleLoadRows]);

  const handleReset = useCallback(async () => {
    const ngaySXValue: dayjs.Dayjs | null = form.getFieldValue("ngaySX");
    const scopeValue: number | undefined = form.getFieldValue("scope");
    const caValue: number | undefined = form.getFieldValue("ca");
    if (!ngaySXValue || !scopeValue || !caValue) {
      message.warning("Chọn đủ Ngày SX, Ca, Xưởng");
      return;
    }
    setLoadingReset(true);
    try {
      await tkvvTonSiloApi.resetPhieu({
        ngaySX: ngaySXValue.format("YYYY-MM-DD"),
        ca: caValue,
        scope: scopeValue,
      });
      setTableData([]);
      message.success("Đã xóa dữ liệu — đang tải lại...");
      await handleLoadRows();
    } catch {
      message.error("Lỗi khi reset phiếu");
    } finally {
      setLoadingReset(false);
    }
  }, [form, handleLoadRows]);

  const handleOpenTach = useCallback(
    async (rowIdx: number) => {
      const row = tableData[rowIdx];
      if (!row) return;

      if (nvlList.length === 0) {
        const scopeValue: number | undefined = form.getFieldValue("scope");
        if (scopeValue) {
          setLoadingTachNvl(true);
          try {
            const nvls = await tkvvNvlApi.getListnvlbyBM({
              scope: String(scopeValue),
            });
            setNvlList(nvls ?? []);
          } catch {
            /* ignore */
          } finally {
            setLoadingTachNvl(false);
          }
        }
      }

      setTachSourceIdx(rowIdx);
      setTachSourceRow(row);
      setTachRows([
        {
          key: Date.now(),
          nguyenVatLieuID: row.nguyenVatLieuID ?? null,
          doAm: row.doAm ?? "",
          tonDau: row.tonDau ?? "",
          nhap: row.nhap ?? "",
          xuat: row.xuat ?? "",
          tonCuoi: row.tonCuoi ?? "",
          ghiChu: row.ghiChu ?? "",
        },
      ]);
      setShowTachModal(true);
    },
    [tableData, nvlList, form],
  );

  const updateTachRow = useCallback(
    (idx: number, field: keyof TachLieuRow, value: any) => {
      setTachRows((prev) => {
        const updated = prev.map((r, i) =>
          i === idx ? { ...r, [field]: value } : r,
        );
        if (idx === 0 || !tachSourceRow) return updated;
        return recalcTachRow0(updated, tachSourceRow);
      });
    },
    [tachSourceRow],
  );

  const addTachRow = useCallback(() => {
    setTachRows((prev) => {
      const newRow: TachLieuRow = {
        key: Date.now(),
        nguyenVatLieuID: null,
        doAm: "",
        tonDau: "",
        nhap: "",
        xuat: "",
        tonCuoi: prev.length > 0 ? (prev[0].tonCuoi ?? "") : "",
        ghiChu: "",
      };
      const updated = [...prev, newRow];
      if (!tachSourceRow) return updated;
      return recalcTachRow0(updated, tachSourceRow);
    });
  }, [tachSourceRow]);

  const deleteTachRow = useCallback(
    (idx: number) => {
      setTachRows((prev) => {
        const filtered = prev.filter((_, i) => i !== idx);
        if (!tachSourceRow) return filtered;
        return recalcTachRow0(filtered, tachSourceRow);
      });
    },
    [tachSourceRow],
  );

  const handleSaveTach = useCallback(() => {
    if (tachSourceIdx === null || !tachSourceRow) return;
    if (tachRows.some((r) => !r.nguyenVatLieuID)) {
      message.warning("Vui lòng chọn Nguyên vật liệu cho tất cả dòng");
      return;
    }

    const newRows: TableRow[] = tachRows.map((r, i) => ({
      key: `tach-${tachSourceRow.siloID}-${Date.now()}-${i}`,
      dbId: i === 0 ? (tachSourceRow.dbId ?? null) : null,
      siloID: tachSourceRow.siloID,
      nguyenVatLieuID: r.nguyenVatLieuID ?? undefined,
      maSilo: tachSourceRow.maSilo,
      nguyenLieu: nvlList.find((n) => n.id === r.nguyenVatLieuID)?.tenNVL ?? "",
      doAm: r.doAm,
      doAmText: tachSourceRow.doAmText,
      tonDau: r.tonDau,
      nhap: r.nhap,
      nhapAuto: i === 0 ? tachSourceRow.nhapAuto : "",
      xuat: r.xuat,
      xuatAuto: i === 0 ? tachSourceRow.xuatAuto : "",
      tonCuoi: r.tonCuoi,
      tonCuoiAuto: i === 0 ? tachSourceRow.tonCuoiAuto : "",
      isAdjusted: true,
      isTachLieu: i > 0 || (tachSourceRow.isTachLieu ?? false),
      ghiChu: r.ghiChu,
    }));

    setTableData((prev) => {
      const updated = [...prev];
      updated.splice(tachSourceIdx, 1, ...newRows);
      return sortSiloRows(updated);
    });

    setShowTachModal(false);
    setTachSourceIdx(null);
    setTachSourceRow(null);
    message.success(`Đã tách thành ${newRows.length} dòng`);
  }, [tachSourceIdx, tachSourceRow, tachRows, nvlList]);

  const handleDeleteTachRow = useCallback((rowIdx: number) => {
    setTableData((prev) => prev.filter((_, i) => i !== rowIdx));
  }, []);

  const getFormData = useCallback(async () => {
    const userInfo = getUserInfo();
    const formData = await form.validateFields();
    const pheDuyetFlow = config.signatures.map((s: any) => ({
      capDuyet: s.capDuyet,
      maKyDuyet: s.key,
      nguoiDuyetId: form.getFieldValue(s.key),
      tinhTrang: 0,
      ghiChu: "",
    }));
    const processRows = (rows: TableRow[]) =>
      rows.map((row, idx) => {
        const r: Record<string, any> = { thuTu: idx + 1 };
        Object.keys(row).forEach((k) => {
          if (k !== "key") r[k] = row[k];
        });
        return r;
      });

    return {
      ...formData,
      maBm: config.code,
      xuongId: userInfo.iD_PhanXuong ?? null,
      idphongBan: userInfo.iD_PhongBan ?? null,
      nguoiTaoId: userInfo.iD_TaiKhoan ?? null,
      table1: processRows(tableData),
      scope: formData.scope ?? null,
      ngaySX: formData.ngaySX
        ? dayjs(formData.ngaySX).format("YYYY-MM-DD")
        : dayjs().format("YYYY-MM-DD"),
      pheDuyet: pheDuyetFlow,
      prefix: config.prefix,
    };
  }, [getUserInfo, form, config, tableData]);

  const saveTonSiloRows = useCallback(
    async (phieuId?: string) => {
      const userInfo = getUserInfo();
      const userId = userInfo.iD_TaiKhoan;
      if (!userId) return;

      const ngaySX: dayjs.Dayjs | null = form.getFieldValue("ngaySX");
      const scope: number | undefined = form.getFieldValue("scope");
      const caValue = form.getFieldValue("ca");
      const kipValue = form.getFieldValue("kip");
      if (!ngaySX || !scope || !caValue) return;

      const ngayStr = ngaySX.format("YYYY-MM-DD");
      const toNum = (v: any) => (v !== "" && v != null ? Number(v) : null);

      const toSaveRow = (row: TableRow, idx: number) => ({
        id: row.dbId ?? null,
        ngaySX: ngayStr,
        ca: caValue,
        scope,
        siloID: row.siloID ?? 0,
        nguyenVatLieuID: row.nguyenVatLieuID ?? null,
        kip: kipValue ?? null,
        thuTu: idx + 1,
        doAm: toNum(row.doAm),
        doAmText: row.doAmText ?? null,
        tonDau: toNum(row.tonDau),
        nhap: toNum(row.nhap),
        nhapAuto: toNum(row.nhapAuto),
        xuat: toNum(row.xuat),
        xuatAuto: toNum(row.xuatAuto),
        tonCuoi: toNum(row.tonCuoi),
        tonCuoiAuto: toNum(row.tonCuoiAuto),
        isAdjusted: row.isAdjusted ?? false,
        isTachLieu: row.isTachLieu ?? false,
        ghiChu: row.ghiChu ?? null,
      });

      const rows = tableDataRef.current
        .filter((r) => r.dbId || r.siloID)
        .map((r, i) => toSaveRow(r, i));
      if (rows.length === 0) return;

      try {
        await tkvvTonSiloApi.saveRows({
          maBM: MA_BM,
          phieuID: phieuId ?? idphieu ?? null,
          currentUserId: userId,
          rows,
        });
      } catch {
        // không block phiếu nếu lưu bảng phụ TonSilo lỗi
      }
    },
    [getUserInfo, idphieu, form],
  );

  const handleActionSuccess = useCallback(
    async (context?: { newPhieuId?: string }) => {
      await saveTonSiloRows(context?.newPhieuId);
      if (context?.newPhieuId) {
        navigate(`/chitiettonsilotkvv/${context.newPhieuId}`, {
          replace: true,
        });
        return;
      }
      await initData();
    },
    [navigate, initData, saveTonSiloRows],
  );

  const handleStatusChange = useCallback(async () => {
    try {
      await form.validateFields();
    } catch (err: any) {
      message.error(err?.message || "Vui lòng kiểm tra dữ liệu");
    }
  }, [form]);

  const actionButtons = useMemo(() => {
    const userInfo = getUserInfo();
    const buttons = phieuActionService.getActionButtons({
      phieuId: idphieu || "",
      tinhTrang: phieuInfo.tinhTrang ?? 0,
      isClone: phieuInfo.isClone ?? false,
      currentUserId: userInfo.iD_TaiKhoan ?? null,
      currentUserPhongBanId: userInfo.iD_PhongBan ?? null,
      currentUserTenNgan: userInfo.tenNgan ?? null,
      nguoiTaoId: phieuInfo.nguoiTaoId ?? null,
      phieuPhongBanId: phieuInfo.idphongBan ?? null,
      phieuMaBm: config.code,
      pheDuyet: phieuInfo.pheDuyet ?? [],
      onStatusChange: handleStatusChange,
      onSuccess: handleActionSuccess,
      onError: (error) => console.error("Action error:", error),
    });
    if (buttons.length === 0) return null;
    return phieuActionService.renderActionButtons(
      buttons,
      idphieu || "",
      getFormData,
    );
  }, [
    getUserInfo,
    idphieu,
    phieuInfo,
    getFormData,
    handleStatusChange,
    handleActionSuccess,
    config.code,
  ]);

  const tableColumns: FormColumnDef[] = useMemo(() => {
    const section = config.layout.find(
      (s: any) => s.sectionType === "table" && s.key === "table1",
    );
    const baseCols = (section?.columns || []) as FormColumnDef[];
    const calcCol: FormColumnDef = {
      title: "Tồn cuối T.T",
      dataIndex: "tonCuoiTinhToan",
      width: 110,
      type: "float",
      align: "right",
      readonly: true,
    };
    const tonCuoiIdx = baseCols.findIndex((c) => c.dataIndex === "tonCuoi");
    if (tonCuoiIdx >= 0) {
      const cols = [...baseCols];
      cols.splice(tonCuoiIdx + 1, 0, calcCol);
      return cols;
    }
    return [...baseCols, calcCol];
  }, [config]);

  const handleCellChange = useCallback(
    (rowIndex: number, dataIndex: string, value: any) => {
      setTableData((prev) => {
        const updated = [...prev];
        const patch: Partial<TableRow> = { [dataIndex]: value };
        if (dataIndex === "doAmText") {
          const parsed = parseFloat(String(value));
          patch.doAm = isNaN(parsed) ? "" : parsed;
        }
        updated[rowIndex] = { ...updated[rowIndex], ...patch };
        return updated;
      });
    },
    [],
  );

  const handleDataChange = useCallback((rows: any[]) => {
    setTableData(
      rows.map(({ tonCuoiTinhToan: _c, ...rest }: any) => rest as TableRow),
    );
  }, []);

  // doAmText chỉ cho sửa khi: cột Xuất có giá trị VÀ là dòng đầu tiên của NVL
  const readonlyCellGetter = useCallback(
    (dataIndex: string, record: any): boolean => {
      if (dataIndex !== "doAmText") return false;
      const xuat = record.xuat;
      const xuatHasValue =
        xuat !== "" && xuat != null && !isNaN(parseFloat(String(xuat))) && parseFloat(String(xuat)) !== 0;
      if (!xuatHasValue) return true;
      return !firstNvlRowKeySet.has(record.key);
    },
    [firstNvlRowKeySet],
  );

  const cellDecorator = useCallback((dataIndex: string, record: any) => {
    if (
      dataIndex === "tonCuoi" &&
      record.tonCuoiAuto != null &&
      record.tonCuoiAuto !== ""
    ) {
      const cuoiNum = parseFloat(String(record.tonCuoi));
      const autoNum = parseFloat(String(record.tonCuoiAuto));
      if (!isNaN(cuoiNum) && !isNaN(autoNum) && cuoiNum !== autoNum) {
        return {
          style: { backgroundColor: "#fff1f0", borderColor: "#faad14" },
          tooltip: `Tồn cuối Auto: ${autoNum.toLocaleString("en-US", { maximumFractionDigits: 3 })}`,
        };
      }
    }
    if (
      dataIndex === "nhap" &&
      record.nhapAuto != null &&
      record.nhapAuto !== ""
    ) {
      const nhapNum = parseFloat(String(record.nhap));
      const autoNum = parseFloat(String(record.nhapAuto));
      if (!isNaN(nhapNum) && !isNaN(autoNum) && nhapNum !== autoNum) {
        return {
          style: { backgroundColor: "#fff1f0", borderColor: "#faad14" },
          tooltip: `Nhập BBGN (Auto): ${autoNum.toLocaleString("en-US", { maximumFractionDigits: 3 })}`,
        };
      }
    }
    if (
      dataIndex === "xuat" &&
      record.xuatAuto != null &&
      record.xuatAuto !== ""
    ) {
      const xuatNum = parseFloat(String(record.xuat));
      const autoNum = parseFloat(String(record.xuatAuto));
      if (!isNaN(xuatNum) && !isNaN(autoNum) && xuatNum !== autoNum) {
        return {
          style: { backgroundColor: "#fff1f0", borderColor: "#faad14" },
          tooltip: `Xuất Auto: ${autoNum.toLocaleString("en-US", { maximumFractionDigits: 3 })}`,
        };
      }
    }
    return undefined;
  }, []);

  const buildSummary = useCallback((data: readonly any[]) => {
    const totals: Record<string, number> = {
      tonDau: 0,
      nhap: 0,
      xuat: 0,
      tonCuoi: 0,
    };
    data.forEach((row) => {
      (["tonDau", "nhap", "xuat", "tonCuoi"] as const).forEach((k) => {
        const v = Number(row[k]);
        if (!Number.isNaN(v)) totals[k] += v;
      });
    });
    const fmt = (n: number) =>
      n ? n.toLocaleString("en-US", { maximumFractionDigits: 3 }) : "";
    return (
      <Table.Summary fixed="bottom">
        <Table.Summary.Row>
          <Table.Summary.Cell index={0} align="center">
            <b>TỔNG</b>
          </Table.Summary.Cell>
          <Table.Summary.Cell index={1} />
          <Table.Summary.Cell index={2} />
          <Table.Summary.Cell index={3} align="right">
            <b>{fmt(totals.tonDau)}</b>
          </Table.Summary.Cell>
          <Table.Summary.Cell index={4} align="right">
            <b>{fmt(totals.nhap)}</b>
          </Table.Summary.Cell>
          <Table.Summary.Cell index={5} align="right">
            <b>{fmt(totals.xuat)}</b>
          </Table.Summary.Cell>
          <Table.Summary.Cell index={6} align="right">
            <b>{fmt(totals.tonCuoi)}</b>
          </Table.Summary.Cell>
          <Table.Summary.Cell index={7} />
          <Table.Summary.Cell index={8} />
        </Table.Summary.Row>
      </Table.Summary>
    );
  }, []);

  return (
    <Card style={{ margin: 24, boxShadow: "0 2px 8px #f0f1f2" }}>
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <Typography.Title level={3} style={{ marginBottom: 0 }}>
          {config.title}
        </Typography.Title>
        {idphieu && <b>Số phiếu: {soPhieu}</b>}
      </div>

      <Form form={form} layout="vertical">
        <Form.Item name="idphieu" hidden>
          <Input type="hidden" />
        </Form.Item>

        {/* ─── headerFields: NgaySX, Ca, Xưởng, Kíp — dàn full width 1 hàng ──── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
            marginBottom: 8,
          }}
        >
          {config.headerFields.map((f: any, idx: number) => {
            const field = {
              ...f,
              options:
                f.type === "select" && f.key === "scope"
                  ? TKVV_SCOPE_OPTIONS.length > 0
                    ? TKVV_SCOPE_OPTIONS
                    : f.options
                  : f.options,
            };
            return (
              <CustomFormItem
                key={f.key}
                field={field}
                idx={idx}
                disabled={isFormLocked || (f.lockOnEdit && !!idphieu)}
              />
            );
          })}
        </div>

        {/* ─── Hàng action: nút quy trình + Tải dữ liệu + Quay lại ──────────── */}
        <div
          style={{
            margin: "12px 0 16px",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Space wrap>
            {actionButtons}
            {!isFormLocked && (
              <>
                <Button
                  icon={<CloudDownloadOutlined />}
                  loading={loadingInit}
                  onClick={handleLoadRows}
                  disabled={!ngaySXWatch || !scopeWatch}
                >
                  Tải dữ liệu
                </Button>
                <Button
                  icon={<DeploymentUnitOutlined />}
                  loading={loadingSilo}
                  onClick={handleCheckSilo}
                  disabled={!ngaySXWatch || !scopeWatch}
                >
                  Kiểm tra Silo
                </Button>
                <Popconfirm
                  title="Reset phiếu Tồn Silo"
                  description="Xóa toàn bộ dữ liệu đã lưu cho ngày/ca/xưởng này và tải lại từ đầu?"
                  okText="Xóa & Tải lại"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true }}
                  onConfirm={handleReset}
                >
                  <Button
                    icon={<ClearOutlined />}
                    loading={loadingReset}
                    danger
                    disabled={!ngaySXWatch || !scopeWatch}
                  >
                    Reset phiếu
                  </Button>
                </Popconfirm>
              </>
            )}
            <Button
              icon={<UndoOutlined />}
              onClick={() => navigate("/tonsilotkvv")}
            >
              Quay lại
            </Button>
          </Space>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {tableData.length} Silo
          </Typography.Text>
        </div>
        <div ref={tableWrapperRef} style={{ width: "100%", marginBottom: 4 }}>
          <CustomFormTable
            columns={tableColumns}
            initialData={tableDataDisplay}
            onDataChange={handleDataChange}
            onCellChange={handleCellChange}
            editable={!isFormLocked}
            loading={loading || loadingInit}
            minRows={0}
            showAddButton={false}
            showDeleteButton={false}
            summary={buildSummary}
            cellDecorator={cellDecorator}
            readonlyCellGetter={readonlyCellGetter}
            scrollY={tableScrollY}
            onRow={(record) =>
              record.isTachLieu
                ? {
                    style: {
                      backgroundColor: "#fff7e6",
                      outline: "1px solid #fa8c16",
                    },
                  }
                : {}
            }
            rowActions={
              !isFormLocked
                ? (record, rowIdx) => (
                    <Space size={4}>
                      <Button
                        size="small"
                        icon={<ScissorOutlined />}
                        onClick={() => handleOpenTach(rowIdx)}
                        title="Chia tách liệu"
                      />
                      {record.isTachLieu && (
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleDeleteTachRow(rowIdx)}
                          title="Xóa dòng tách"
                        />
                      )}
                    </Space>
                  )
                : undefined
            }
          />
        </div>

        {config.footerNotes?.length > 0 && (
          <div style={{ marginBottom: 12, fontSize: 12, color: "#888" }}>
            {config.footerNotes.map((note: string, i: number) => (
              <div key={i}>* {note}</div>
            ))}
          </div>
        )}

        <div
          ref={signaturesRef}
          style={{
            marginTop: 20,
            display: "flex",
            justifyContent: "space-around",
            textAlign: "center",
          }}
        >
          {config.signatures?.map((sig: any, i: number) => {
            const isLevelZero = sig.capDuyet === 0;
            const autoValue = isLevelZero
              ? (currentUserInfo?.iD_TaiKhoan ?? null)
              : undefined;
            const duyet = phieuInfo.pheDuyet?.find(
              (p: any) => p.capDuyet === sig.capDuyet,
            );
            return (
              <div key={sig.key || i}>
                <CustomFormItem
                  field={sig}
                  idx={i}
                  disabled={isLevelZero || isSignatureReadonly || isFormLocked}
                  initialValue={autoValue ?? form.getFieldValue(sig.key)}
                />
                {idphieu && duyet && (
                  <div style={{ marginTop: 6 }}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {duyet?.tinhTrang === 1
                        ? "Đã ký"
                        : duyet?.tinhTrang === 2
                          ? "Đã từ chối"
                          : "Chưa xử lý"}
                    </Typography.Text>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Form>

      {/* ─── Modal Tách liệu ──────────────────────────────────────────────── */}
      <Modal
        title={
          tachSourceRow
            ? `Tách liệu — Silo ${tachSourceRow.maSilo ?? ""}`
            : "Tách liệu"
        }
        open={showTachModal}
        onCancel={() => setShowTachModal(false)}
        width={820}
        footer={[
          <Button key="cancel" onClick={() => setShowTachModal(false)}>
            Hủy
          </Button>,
          <Button key="add" onClick={addTachRow} icon={<PlusOutlined />}>
            Thêm dòng
          </Button>,
          <Button key="save" type="primary" onClick={handleSaveTach}>
            Lưu tách liệu
          </Button>,
        ]}
        destroyOnHidden
      >
        {tachSourceRow && (
          <div style={{ marginBottom: 12, fontSize: 12, color: "#888" }}>
            Gốc: <b>{tachSourceRow.nguyenLieu || "—"}</b> · Tồn đầu:{" "}
            <b>{tachSourceRow.tonDau || "—"}</b> · Nhập:{" "}
            <b>{tachSourceRow.nhap || "—"}</b> · Xuất:{" "}
            <b>{tachSourceRow.xuat || "—"}</b> · Tồn cuối:{" "}
            <b>{tachSourceRow.tonCuoi || "—"}</b>
          </div>
        )}
        <Table<TachLieuRow>
          dataSource={tachRows}
          rowKey="key"
          pagination={false}
          size="small"
          loading={loadingTachNvl}
          columns={[
            {
              title: "Dòng",
              width: 60,
              render: (_, __, idx) =>
                idx === 0 ? (
                  <span style={{ fontSize: 11, color: "#888" }}>
                    Gốc (tự tính)
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: "#1677ff" }}>
                    Tách {idx}
                  </span>
                ),
            },
            {
              title: "Nguyên vật liệu",
              dataIndex: "nguyenVatLieuID",
              render: (val, _, idx) => (
                <Select
                  value={val}
                  onChange={(v) => updateTachRow(idx, "nguyenVatLieuID", v)}
                  style={{ width: "100%" }}
                  showSearch
                  optionFilterProp="label"
                  placeholder="Chọn NVL"
                  options={nvlList.map((n) => ({
                    label: n.tenNVL,
                    value: n.id,
                  }))}
                />
              ),
            },
            ...(["tonDau", "nhap", "xuat", "tonCuoi"] as const).map((f) => ({
              title:
                f === "tonDau"
                  ? "Tồn đầu"
                  : f === "nhap"
                    ? "Nhập"
                    : f === "xuat"
                      ? "Xuất"
                      : "Tồn cuối",
              dataIndex: f,
              width: 100,
              render: (val: any, _: any, idx: number) => {
                const isAutoCalc = idx === 0 && tachRows.length > 1;
                return (
                  <input
                    type="number"
                    min={0}
                    step="0.001"
                    value={val ?? ""}
                    onChange={(e) => {
                      let v = e.target.value;
                      if (v !== "" && Number(v) < 0) return;
                      if (v.includes(".")) {
                        const [int, dec] = v.split(".");
                        if (dec && dec.length > 3) v = int + "." + dec.slice(0, 3);
                      }
                      updateTachRow(idx, f, v);
                    }}
                    onBlur={(e) => {
                      const v = e.target.value;
                      if (v !== "" && Number.isFinite(Number(v)))
                        updateTachRow(idx, f, (Math.round(Number(v) * 1000) / 1000).toFixed(3));
                    }}
                    style={{
                      width: "100%",
                      border: "1px solid #d9d9d9",
                      borderRadius: 4,
                      padding: "4px 8px",
                      backgroundColor: isAutoCalc ? "#fff1f0" : undefined,
                    }}
                    title={
                      isAutoCalc
                        ? `Tự tính: Gốc − tổng dòng tách (có thể sửa thủ công)`
                        : undefined
                    }
                  />
                );
              },
            })),
            {
              title: "Ghi chú",
              dataIndex: "ghiChu",
              render: (val, _, idx) => (
                <input
                  value={val ?? ""}
                  onChange={(e) => updateTachRow(idx, "ghiChu", e.target.value)}
                  style={{
                    width: "100%",
                    border: "1px solid #d9d9d9",
                    borderRadius: 4,
                    padding: "4px 8px",
                  }}
                />
              ),
            },
            {
              title: "",
              width: 50,
              render: (_, __, idx) =>
                tachRows.length > 1 ? (
                  <Button
                    danger
                    size="small"
                    type="text"
                    onClick={() => deleteTachRow(idx)}
                  >
                    Xóa
                  </Button>
                ) : null,
            },
          ]}
        />
      </Modal>

      {/* ─── Modal Kiểm tra / Thiết lập Silo Mapping ──────────────────────── */}
      <Modal
        title={
          <span>
            Thiết lập Silo Mapping
            {ngaySXWatch && (
              <span style={{ fontWeight: 400, fontSize: 13, marginLeft: 8 }}>
                — {(ngaySXWatch as dayjs.Dayjs).format("DD/MM/YYYY")} ·{" "}
                {getTKVVScopeByNumber(scopeWatch ?? 0)?.label ?? ""}
              </span>
            )}
            {modalNgaySXGan && (
              <span
                style={{
                  fontWeight: 400,
                  fontSize: 12,
                  marginLeft: 8,
                  color: "#888",
                }}
              >
                (từ ngày {modalNgaySXGan})
              </span>
            )}
          </span>
        }
        open={showSiloModal}
        onCancel={() => setShowSiloModal(false)}
        width={760}
        footer={[
          <Button key="cancel" onClick={() => setShowSiloModal(false)}>
            Hủy
          </Button>,
          <Button key="add" onClick={addModalRow} icon={<PlusOutlined />}>
            Thêm dòng
          </Button>,
          <Button
            key="save"
            type="primary"
            loading={loadingBatch}
            onClick={handleSaveMapping}
          >
            Lưu &amp; Tải dữ liệu
          </Button>,
        ]}
        destroyOnHidden
      >
        <Table<SiloMappingModalRow>
          dataSource={modalRows}
          rowKey="key"
          pagination={false}
          size="small"
          columns={[
            {
              title: "Ca",
              dataIndex: "ca",
              width: 110,
              render: (val, _, idx) => (
                <Select
                  value={val}
                  onChange={(v) => updateModalRow(idx, "ca", v)}
                  style={{ width: "100%" }}
                  options={[
                    { label: "Ca ngày", value: 1 },
                    { label: "Ca đêm", value: 2 },
                  ]}
                />
              ),
            },
            {
              title: "Tên nguyên vật liệu",
              dataIndex: "nguyenVatLieuID",
              render: (val, _, idx) => (
                <Select
                  value={val}
                  onChange={(v) => updateModalRow(idx, "nguyenVatLieuID", v)}
                  style={{ width: "100%" }}
                  showSearch
                  optionFilterProp="label"
                  placeholder="Chọn NVL"
                  options={nvlList.map((n) => ({
                    label: n.tenNVL,
                    value: n.id,
                  }))}
                />
              ),
            },
            {
              title: "Mã Silo",
              dataIndex: "siloID",
              width: 200,
              render: (val, _, idx) => (
                <Select
                  value={val}
                  onChange={(v) => updateModalRow(idx, "siloID", v)}
                  style={{ width: "100%" }}
                  showSearch
                  allowClear
                  optionFilterProp="label"
                  placeholder="Chọn Silo"
                  options={siloList.map((s) => ({
                    label: s.maSilo ? `${s.maSilo} - ${s.tenSilo}` : s.tenSilo,
                    value: s.id,
                  }))}
                />
              ),
            },
            {
              title: "Thứ tự",
              dataIndex: "thuTu",
              width: 80,
              render: (val, _, idx) => (
                <input
                  type="number"
                  value={val ?? ""}
                  onChange={(e) =>
                    updateModalRow(idx, "thuTu", Number(e.target.value))
                  }
                  style={{
                    width: "100%",
                    border: "1px solid #d9d9d9",
                    borderRadius: 4,
                    padding: "4px 8px",
                  }}
                />
              ),
            },
            {
              title: "",
              width: 50,
              render: (_, __, idx) => (
                <Button
                  danger
                  size="small"
                  type="text"
                  onClick={() => deleteModalRow(idx)}
                >
                  Xóa
                </Button>
              ),
            },
          ]}
        />
      </Modal>
    </Card>
  );
};

export default TaoPhieuTonSilo;
