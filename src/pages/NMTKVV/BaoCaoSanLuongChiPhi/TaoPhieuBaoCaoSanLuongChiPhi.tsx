/* eslint-disable @typescript-eslint/no-explicit-any */
import TKVV_BC_SanLuongChiPhi from "../../../utils/BM_config/TKVV_BC_SanLuongChiPhi.json";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import {
  CloudDownloadOutlined,
  DeploymentUnitOutlined,
  FileAddOutlined,
  PartitionOutlined,
  PlusOutlined,
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
  bm11Api,
  tkvvBcSlChiPhiApi,
  tkvvNvlApi,
  tkvvNvlSiloMappingApi,
  tkvvSiloApi,
  tkvvScopeXuongMappingApi,
  type TaoBBGNRequestDto,
  type TKVVBaoCaoSanLuongChiPhiDto,
  type TKVVNguyenVatLieuDto,
  type TKVVNvlSiloMappingDto,
  type TKVVSiloDto,
} from "../../../services/TKVVApi";
import { TaiKhoanApi } from "../../../services/TaiKhoanService";
import {
  TKVV_SCOPES,
  getTKVVScopeByNumber,
} from "../../../utils/constants/TKVV_constant";

interface TableRow {
  key: string | number;
  dbId?: number | null; // TKVV_BaoCaoSanLuongChiPhi.ID
  nguyenVatLieuID?: number;
  siloID?: number | null;
  maSilo?: string | null;
  kip?: string;
  nguyenLieu?: string;
  donViTinh?: string | null;
  klAm?: number | string;
  klAmAuto?: number | string; // KLAmAuto từ hệ thống cân — chỉ tham chiếu, không sửa
  isAdjusted?: boolean;
  doAm?: number | string;
  quyKho?: number | string;
  thanhPhamL1?: number | string;
  thanhPhamL2?: number | string;
  thanhPham_Note?: string;
  ghiChu?: string;
  id_CT_BBGN?: number | null;
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

interface TaoBBGNChiTietRow {
  key: string | number;
  tenNVL: string;
  nguyenVatLieuID: number | undefined;
  id_VatTu: number | null;
  idTaiKhoanBG: number | null;
  idTaiKhoan: number | null;
  noiDungTrichYeu: string;
  maLo: string;
  doAm_W: number | null;
  khoiLuong_BG: number | null;
  ghiChu: string;
}

const MA_BM = "TKVV_BC_SanLuongChiPhi";
const LOAI_DU_LIEU = "SANLUONG";

const BBGN_LOCKED_FIELDS = new Set([
  "thanhPhamL1",
  "thanhPhamL2",
  "thanhPhamL3",
  "thanhPham_Note",
]);

const SCOPE_OPTIONS = TKVV_SCOPES.map((s) => ({
  label: s.label,
  value: s.scope,
}));

const fmt3 = (v: unknown): string => {
  if (v == null || v === "") return "";
  const n = Number(v);
  return Number.isFinite(n) ? (Math.round(n * 1000) / 1000).toFixed(3) : String(v);
};

const calcQuyKho = (klAmRaw: any, doAmRaw: any): string => {
  const klAm = parseFloat(String(klAmRaw));
  if (isNaN(klAm)) return "";
  const doAm = parseFloat(String(doAmRaw));
  const result = isNaN(doAm) ? klAm : klAm * (1 - doAm / 100);
  return (Math.round(result * 1000) / 1000).toFixed(3);
};

const withQuyKho = (rows: TableRow[]): TableRow[] =>
  rows.map((r) => ({ ...r, quyKho: calcQuyKho(r.klAm, r.doAm) }));

const buildBlankRow = (idx: number): TableRow => ({
  key: `blank-${idx}-${Date.now()}`,
  kip: "",
  nguyenLieu: "",
  klAm: "",
  doAm: "",
  quyKho: "",
  thanhPhamL1: "",
  thanhPhamL2: "",
  ghiChu: "",
});

const fromDbRecord = (
  item: TKVVBaoCaoSanLuongChiPhiDto,
  idx: number,
): TableRow => ({
  key: `db-${item.id}-${idx}`,
  dbId: item.id,
  nguyenVatLieuID: item.nguyenVatLieuID,
  kip: item.kip ?? "",
  nguyenLieu: item.tenNVL ?? "",
  donViTinh: null,
  klAm: fmt3(item.klAm),
  klAmAuto: fmt3(item.klAmAuto),
  isAdjusted: item.isAdjusted,
  doAm: fmt3(item.doAm),
  quyKho: item.quyKho != null ? fmt3(item.quyKho) : calcQuyKho(item.klAm, item.doAm),
  thanhPhamL1: fmt3(item.thanhPhamL1),
  thanhPhamL2: fmt3(item.thanhPhamL2),
  thanhPham_Note: item.thanhPham_Note ?? "",
  ghiChu: item.ghiChu ?? "",
  id_CT_BBGN: item.iD_CT_BBGN ?? null,
});

const fromNearestMapping = (
  m: TKVVNvlSiloMappingDto,
  idx: number,
): TableRow => ({
  key: `nearest-${m.siloID ?? 0}-${m.nguyenVatLieuID}-${idx}`,
  nguyenVatLieuID: m.nguyenVatLieuID,
  siloID: m.siloID,
  maSilo: m.maSilo,
  nguyenLieu: m.tenNVL ?? "",
  donViTinh: null,
  klAm: "",
  doAm: "",
  quyKho: "",
  thanhPhamL1: "",
  thanhPhamL2: "",
  ghiChu: "",
});

const TaoPhieuBaoCaoSanLuongChiPhi = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const idphieu = id;

  const config = TKVV_BC_SanLuongChiPhi as any;
  const [form] = Form.useForm();

  const [tableData, setTableData] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingEMS, setLoadingEMS] = useState(false);
  const [loadingSilo, setLoadingSilo] = useState(false);
  const [soPhieu, setSoPhieu] = useState("");

  const [showSiloModal, setShowSiloModal] = useState(false);
  const [modalRows, setModalRows] = useState<SiloMappingModalRow[]>([]);
  const [modalNgaySXGan, setModalNgaySXGan] = useState("");
  const [nvlList, setNvlList] = useState<TKVVNguyenVatLieuDto[]>([]);
  const [siloList, setSiloList] = useState<TKVVSiloDto[]>([]);
  const [loadingBatch, setLoadingBatch] = useState(false);

  const [ngaySXFilter, setNgaySXFilter] = useState<dayjs.Dayjs | null>(dayjs());
  const [selectedScope, setSelectedScope] = useState<number | undefined>();
  const [caSX, setCaSX] = useState<number>(1);
  const [tongSanLuong, setTongSanLuong] = useState<{
    giaTriTuDong: number | null;
    giaTriDieuChinh: number | null;
    lyDoDieuChinh: string | null;
  }>({ giaTriTuDong: null, giaTriDieuChinh: null, lyDoDieuChinh: null });
  const tongSanLuongRef = useRef(tongSanLuong);
  useEffect(() => {
    tongSanLuongRef.current = tongSanLuong;
  }, [tongSanLuong]);
  const [showBBGNModal, setShowBBGNModal] = useState(false);
  const [bbgnEditRows, setBbgnEditRows] = useState<TableRow[]>([]);
  const [showTaoBBGNModal, setShowTaoBBGNModal] = useState(false);
  const [taoBBGNRows, setTaoBBGNRows] = useState<TaoBBGNChiTietRow[]>([]);
  const [loadingTaoBBGN, setLoadingTaoBBGN] = useState(false);
  const [idTaiKhoanBG, setIdTaiKhoanBG] = useState<number | null>(null);
  const [bbgnIdVatTu, setBbgnIdVatTu] = useState<number | null>(null);
  const [bbgnTenVatTu, setBbgnTenVatTu] = useState<string | null>(null);
  const [userOptions, setUserOptions] = useState<
    { label: string; value: number }[]
  >([]);
  const [nguoiBGOptions, setNguoiBGOptions] = useState<
    { label: string; value: number }[]
  >([]);
  const [userInfoMap, setUserInfoMap] = useState<
    Record<number, { tenPhongBan: string | null; xuong_API: string | null }>
  >({});

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
  const caSXRef = useRef(caSX);
  useEffect(() => {
    caSXRef.current = caSX;
  }, [caSX]);
  const ngaySXRef = useRef(ngaySXFilter);
  useEffect(() => {
    ngaySXRef.current = ngaySXFilter;
  }, [ngaySXFilter]);
  const selectedScopeRef = useRef(selectedScope);
  useEffect(() => {
    selectedScopeRef.current = selectedScope;
  }, [selectedScope]);

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
          const dateFields = config.headerFields
            .filter((f: any) => f.type === "date")
            .map((f: any) => f.key);
          const parsedDates: Record<string, any> = {};
          dateFields.forEach((k: string) => {
            if (data[k]) {
              const p = dayjs(data[k]);
              parsedDates[k] = p.isValid() ? p : null;
            }
          });

          // Ưu tiên jsonData; fallback top-level PhieuDto fields (cho phiếu auto-created)
          const caValue = Number(data.ca ?? data.caSX ?? res.ca ?? 1);
          const scopeResolved: number | undefined =
            data.scope != null
              ? Number(data.scope)
              : res.scope != null
                ? Number(res.scope)
                : undefined;
          const ngaySXValue =
            data.ngaySX || data.NgaySX || res.ngaySX || res.NgaySX;

          form.setFieldsValue({
            ...data,
            ca: caValue,
            caSX: caValue,
            ...(scopeResolved != null ? { scope: scopeResolved } : {}),
            ...(ngaySXValue ? { ngaySX: dayjs(ngaySXValue) } : {}),
            ...signatureFields,
            ...parsedDates,
          });
          setCaSX(caValue);

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

          const selectedTable =
            Array.isArray(data.table) && data.table.length > 0
              ? data.table
              : Array.isArray(data.table1)
                ? data.table1
                : [];

          const mappedRows = withQuyKho(
            selectedTable.map((r: any, i: number) => ({
              ...r,
              key: r.key ?? `row-${i}`,
            })),
          );
          setTableData(mappedRows);

          if (scopeResolved != null) setSelectedScope(scopeResolved);
          if (ngaySXValue) setNgaySXFilter(dayjs(ngaySXValue));
          setTongSanLuong({
            giaTriTuDong: data.tongSanLuongTuDong ?? null,
            giaTriDieuChinh: data.tongSanLuong ?? null,
            lyDoDieuChinh: null,
          });

          // Patch id_CT_BBGN + giaTriTuDong từ DB
          if (ngaySXValue && scopeResolved != null) {
            try {
              const freshData = await tkvvBcSlChiPhiApi.getBaoCaoData({
                ngaySX: ngaySXValue.slice(0, 10),
                maBM: MA_BM,
                scope: scopeResolved,
                caSX: caValue,
              });
              if (freshData?.table?.length) {
                const bbgnMap = new Map(
                  freshData.table.map((r) => [r.id, r.iD_CT_BBGN]),
                );
                setTableData((prev) =>
                  prev.map((r) =>
                    r.dbId && bbgnMap.has(r.dbId)
                      ? { ...r, id_CT_BBGN: bbgnMap.get(r.dbId) ?? null }
                      : r,
                  ),
                );
              }
              if (freshData?.tongSanLuong) {
                setTongSanLuong((prev) => ({
                  giaTriTuDong:
                    freshData.tongSanLuong!.giaTriTuDong ?? prev.giaTriTuDong,
                  giaTriDieuChinh:
                    freshData.tongSanLuong!.giaTriDieuChinh ??
                    prev.giaTriDieuChinh,
                  lyDoDieuChinh:
                    freshData.tongSanLuong!.lyDoDieuChinh ?? prev.lyDoDieuChinh,
                }));
              }
            } catch {
              // không block nếu lỗi
            }
          }

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
          const defaultCa = 1;
          setCaSX(defaultCa);
          const overrides: Record<string, any> = {
            tuNgay: dayjs(),
            denNgay: dayjs().add(1, "day"),
            ca: defaultCa,
            caSX: defaultCa,
          };
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
  }, [idphieu, config.signatures, config.headerFields, currentUserInfo]);

  useEffect(() => {
    initData();
  }, [initData]);

  // Auto-fetch NVL list khi scope thay đổi để làm options cho cột nguyenLieu
  useEffect(() => {
    if (!selectedScope) {
      setNvlList([]);
      return;
    }
    tkvvNvlApi
      .getListnvlbyBM({ scope: String(selectedScope) })
      .then((res) => setNvlList(Array.isArray(res) ? res : []))
      .catch(() => {});
  }, [selectedScope]);

  const handleLoadEMS = useCallback(async () => {
    if (!ngaySXFilter) {
      message.warning("Chọn ngày sản xuất");
      return;
    }
    if (!caSX) {
      message.warning("Chọn ca sản xuất");
      return;
    }
    if (!selectedScope) {
      message.warning("Chọn xưởng (scope)");
      return;
    }
    setLoadingEMS(true);
    try {
      const ngayStr = ngaySXFilter.format("YYYY-MM-DD");
      const result = await tkvvBcSlChiPhiApi.loadDuLieu({
        ngaySX: ngayStr,
        maBM: MA_BM,
        caSX: caSX,
        loaiDuLieu: LOAI_DU_LIEU,
        scope: selectedScope,
        createdBy: currentUserInfo?.iD_TaiKhoan ?? null,
      });

      const activeRows = Array.isArray(result.table) ? result.table : [];

      setTableData(activeRows.map(fromDbRecord));
      if (activeRows.length > 0) {
        message.info(`${activeRows.length} dòng`);
      } else {
        message.warning(
          `Chưa có phiếu Tồn silo được khởi tạo cho ngày ${ngaySXFilter.format("DD/MM/YYYY")} ca ${caSX === 1 ? "ngày" : "đêm"}`,
        );
      }

      setTongSanLuong({
        giaTriTuDong: result.tongSanLuong?.giaTriTuDong ?? null,
        giaTriDieuChinh: result.tongSanLuong?.giaTriDieuChinh ?? null,
        lyDoDieuChinh: result.tongSanLuong?.lyDoDieuChinh ?? null,
      });
    } catch {
      message.error("Lỗi khi tải dữ liệu từ EMS");
    } finally {
      setLoadingEMS(false);
    }
  }, [ngaySXFilter, caSX, selectedScope, currentUserInfo]);

  const handleCheckSilo = useCallback(async () => {
    if (!ngaySXFilter) {
      message.warning("Chọn ngày sản xuất");
      return;
    }
    if (!selectedScope) {
      message.warning("Chọn xưởng (scope)");
      return;
    }
    setLoadingSilo(true);
    try {
      const ngayStr = ngaySXFilter.format("YYYY-MM-DD");
      const scopeNum = String(selectedScope);
      const [[today, nvls, silos]] = await Promise.all([
        Promise.all([
          tkvvNvlSiloMappingApi.getList({ scope: scopeNum, ngaySX: ngayStr }),
          tkvvNvlApi.getListnvlbyBM({ scope: scopeNum }),
          tkvvSiloApi.getList({ scope: scopeNum }),
        ]),
      ]);
      setNvlList(nvls ?? []);
      setSiloList(silos ?? []);

      let source: TKVVNvlSiloMappingDto[] = today ?? [];
      let fromDate = ngayStr;
      let isToday = true;

      if (source.length === 0) {
        // Chưa có mapping hôm nay → lấy nearest để làm template
        source = await tkvvNvlSiloMappingApi.getNearest({
          scope: scopeNum,
          beforeDate: ngayStr,
        });
        fromDate = source[0]?.ngaySX
          ? String(source[0].ngaySX).slice(0, 10)
          : "";
        isToday = false;
      }

      const rows: SiloMappingModalRow[] = source.map((m, i) => ({
        id: m.id ?? 0,
        key: i,
        ca: m.ca,
        nguyenVatLieuID: m.nguyenVatLieuID,
        siloID: m.siloID ?? null,
        thuTu: m.thuTu ?? i + 1,
      }));
      setModalRows(rows);
      setModalNgaySXGan(isToday ? "" : fromDate);
      setShowSiloModal(true);
    } catch {
      message.error("Lỗi khi tải mapping silo");
    } finally {
      setLoadingSilo(false);
    }
  }, [ngaySXFilter, selectedScope]);

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
    if (!ngaySXFilter || !selectedScope) return;
    if (modalRows.some((r) => !r.nguyenVatLieuID)) {
      message.warning("Vui lòng chọn Nguyên vật liệu cho tất cả dòng");
      return;
    }
    setLoadingBatch(true);
    try {
      const ngayStr = ngaySXFilter.format("YYYY-MM-DD");
      await tkvvNvlSiloMappingApi.batchCreate({
        maBM: "ALL", // set maBM = "ALL" để lưu cho tất cả BM (TonSilo và BC_SanLuongChiPhi)
        scope: String(selectedScope),
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
      message.success("Đã lưu mapping — đang tải dữ liệu EMS...");
      await handleLoadEMS();
    } catch {
      message.error("Lỗi khi lưu mapping");
    } finally {
      setLoadingBatch(false);
    }
  }, [ngaySXFilter, selectedScope, modalRows, handleLoadEMS]);

  const getFormData = useCallback(async () => {
    if (!ngaySXFilter) {
      message.warning("Vui lòng chọn ngày sản xuất");
      throw new Error("Thiếu ngày sản xuất");
    }
    if (!caSX) {
      message.warning("Vui lòng chọn ca sản xuất");
      throw new Error("Thiếu ca sản xuất");
    }
    if (!selectedScope) {
      message.warning("Vui lòng chọn xưởng");
      throw new Error("Thiếu xưởng (scope)");
    }
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
    const dateFields = config.headerFields
      .filter((f: any) => f.type === "date")
      .map((f: any) => f.key);
    const formattedDates: Record<string, any> = {};
    dateFields.forEach((k: string) => {
      if (formData[k]) formattedDates[k] = formData[k].format("YYYY-MM-DD");
    });

    const currentCaSX = Number(formData.ca ?? formData.caSX ?? caSX ?? 1);

    return {
      ...formData,
      ...formattedDates,
      ca: currentCaSX,
      caSX: currentCaSX,
      maBm: config.code,
      xuongId: userInfo.iD_PhanXuong ?? null,
      idphongBan: userInfo.iD_PhongBan ?? null,
      nguoiTaoId: userInfo.iD_TaiKhoan ?? null,
      table: processRows(tableData),
      table1: processRows(tableData),
      scope: selectedScope ?? null,
      ngaySX: (ngaySXFilter ?? dayjs()).format("YYYY-MM-DD"),
      pheDuyet: pheDuyetFlow,
      prefix: config.prefix,
      tongSanLuong: tongSanLuong.giaTriDieuChinh ?? null,
      tongSanLuongTuDong: tongSanLuong.giaTriTuDong ?? null,
    };
  }, [
    getUserInfo,
    form,
    config,
    tableData,
    selectedScope,
    ngaySXFilter,
    caSX,
    tongSanLuong,
  ]);

  const saveBcSlRows = useCallback(
    async (phieuId?: string) => {
      const userInfo = getUserInfo();
      const userId = userInfo.iD_TaiKhoan;
      if (!userId) return;

      const ngaySX = ngaySXRef.current;
      const scope = selectedScopeRef.current;
      if (!ngaySX || !scope) return;

      const ngayStr = ngaySX.format("YYYY-MM-DD");
      const toNum = (v: any) => (v !== "" && v != null ? Number(v) : null);

      const toSaveRow = (row: TableRow, ca: number, idx: number) => ({
        id: row.dbId ?? null,
        ngaySX: ngayStr,
        ca,
        scope, // INT — gửi thẳng giá trị number
        nguyenVatLieuID: row.nguyenVatLieuID ?? 0,
        kip: row.kip ?? null,
        thuTu: idx + 1,
        klAm: toNum(row.klAm),
        klAmAuto: toNum(row.klAmAuto),
        doAm: toNum(row.doAm),
        quyKho: toNum(row.quyKho),
        thanhPhamL1: toNum(row.thanhPhamL1),
        thanhPhamL2: toNum(row.thanhPhamL2),
        thanhPhamL3: toNum(row.thanhPhamL3),
        thanhPham_Note: row.thanhPham_Note ?? null,
        ghiChu: row.ghiChu ?? null,
      });

      // Chỉ lưu các dòng có dbId (đã được load từ DB) hoặc có nguyenVatLieuID hợp lệ
      const rows = tableDataRef.current
        .filter((r) => r.dbId || r.nguyenVatLieuID)
        .map((r, i) => toSaveRow(r, caSXRef.current, i));
      if (rows.length === 0) return;

      try {
        await tkvvBcSlChiPhiApi.savePhieuRows({
          maBM: MA_BM,
          phieuID: phieuId ?? idphieu ?? null,
          currentUserId: userId,
          rows,
          lyDoDieuChinh: tongSanLuongRef.current.lyDoDieuChinh ?? null,
        });
      } catch {
        // không block phiếu nếu lưu BCSL lỗi
      }
    },
    [getUserInfo, idphieu],
  );

  const handleActionSuccess = useCallback(
    async (context?: { newPhieuId?: string }) => {
      await saveBcSlRows(context?.newPhieuId);
      if (context?.newPhieuId) {
        navigate(`/chitietbaocaoslcptkvv/${context.newPhieuId}`, {
          replace: true,
        });
        return;
      }
      await initData();
    },
    [navigate, initData, saveBcSlRows],
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
    const cols = (section?.columns || []) as FormColumnDef[];
    return cols.map((col) => {
      if (col.dataIndex === "nguyenLieu") {
        return {
          ...col,
          options: nvlList.map((n) => ({ label: n.tenNVL, value: n.tenNVL })),
        };
      }
      return col;
    });
  }, [config, nvlList]);

  const bbgnCellReadonly = useCallback(
    (dataIndex: string, record: any) =>
      record.id_CT_BBGN != null && BBGN_LOCKED_FIELDS.has(dataIndex),
    [],
  );

  const bcSlCellDecorator = useCallback((dataIndex: string, record: any) => {
    if (
      dataIndex === "klAm" &&
      record.klAmAuto != null &&
      record.klAmAuto !== ""
    ) {
      const klAmNum = parseFloat(String(record.klAm));
      const klAmAutoNum = parseFloat(String(record.klAmAuto));
      if (!isNaN(klAmNum) && !isNaN(klAmAutoNum) && klAmNum !== klAmAutoNum) {
        return {
          style: { backgroundColor: "#fffbe6", borderColor: "#faad14" },
          tooltip: `KL ẩm Auto: ${klAmAutoNum.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`,
        };
      }
    }
    return null;
  }, []);

  const handleCellChange = useCallback(
    (rowIndex: number, dataIndex: string, value: any) => {
      if (dataIndex === "nguyenLieu") {
        const nvl = nvlList.find((n) => n.tenNVL === value);
        if (nvl) {
          setTableData((prev) => {
            const updated = [...prev];
            updated[rowIndex] = {
              ...updated[rowIndex],
              nguyenVatLieuID: nvl.id,
              donViTinh: nvl.donViTinh,
            };
            return updated;
          });
        }
        return;
      }
      if (dataIndex !== "klAm") return;
      setTableData((prev) => {
        const r = { ...prev[rowIndex], [dataIndex]: value };
        r.quyKho = calcQuyKho(r.klAm, r.doAm);
        const updated = [...prev];
        updated[rowIndex] = r;
        return updated;
      });
    },
    [nvlList],
  );

  const tongThanhPhamDieuChinh = useMemo(() => {
    const sum = tableData.reduce((acc, r) => {
      const v = parseFloat(String(r.thanhPhamL1));
      return acc + (isNaN(v) ? 0 : v);
    }, 0);
    return sum > 0 ? parseFloat(sum.toFixed(3)) : null;
  }, [tableData]);

  const buildSummary = useCallback((data: readonly any[]) => {
    const totals: Record<string, number> = {
      klAm: 0,
      quyKho: 0,
      thanhPhamL1: 0,
      thanhPhamL2: 0,
      thanhPhamL3: 0,
    };
    data.forEach((row) => {
      (
        ["klAm", "quyKho", "thanhPhamL1", "thanhPhamL2", "thanhPhamL3"] as const
      ).forEach((k) => {
        const v = Number(row[k]);
        if (!Number.isNaN(v)) totals[k] += v;
      });
    });
    const fmt = (n: number) =>
      n ? n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : "";
    return (
      <tr>
        <td style={{ fontWeight: 600, textAlign: "center" }}>TỔNG</td>
        <td style={{ fontWeight: 600, textAlign: "right" }}>
          {fmt(totals.klAm)}
        </td>
        <td />
        <td style={{ fontWeight: 600, textAlign: "right" }}>
          {fmt(totals.quyKho)}
        </td>
        <td />
        <td style={{ fontWeight: 600, textAlign: "right" }}>
          {fmt(totals.thanhPhamL1)}
        </td>
        <td style={{ fontWeight: 600, textAlign: "right" }}>
          {fmt(totals.thanhPhamL2)}
        </td>
        <td style={{ fontWeight: 600, textAlign: "right" }}>
          {fmt(totals.thanhPhamL3)}
        </td>
        <td />
      </tr>
    );
  }, []);

  const handleOpenBBGN = useCallback(async () => {
    const rows = tableData.filter((r) => r.id_CT_BBGN != null);
    setBbgnEditRows(rows.map((r) => ({ ...r })));
    if (!bbgnTenVatTu && selectedScope) {
      try {
        const mapping = await tkvvScopeXuongMappingApi.getByScope(selectedScope).catch(() => null);
        if (mapping?.tenVatTu) setBbgnTenVatTu(mapping.tenVatTu);
        if (mapping?.idNvlBbgnThanhPham) setBbgnIdVatTu(mapping.idNvlBbgnThanhPham);
      } catch {}
    }
    setShowBBGNModal(true);
  }, [tableData, bbgnTenVatTu, selectedScope]);

  const handleApplyBBGN = useCallback(() => {
    const editMap = new Map(bbgnEditRows.map((r) => [r.key, r.thanhPhamL1]));
    setTableData((prev) =>
      prev.map((r) =>
        editMap.has(r.key) ? { ...r, thanhPhamL1: editMap.get(r.key) } : r,
      ),
    );
    setShowBBGNModal(false);
  }, [bbgnEditRows]);

  const handleOpenTaoBBGN = useCallback(
    async (sourceRows?: TableRow[]) => {
      setLoadingTaoBBGN(true);
      try {
        const fetchBGUsers = selectedScope
          ? TaiKhoanApi.getNguoiKyByScope(selectedScope)
          : TaiKhoanApi.getData();
        const fetchScopeMapping = selectedScope
          ? tkvvScopeXuongMappingApi.getByScope(selectedScope).catch(() => null)
          : Promise.resolve(null);

        const [users, bgUsers, scopeMapping] = await Promise.all([
          TaiKhoanApi.getData(),
          fetchBGUsers,
          fetchScopeMapping,
        ]);
        const idVatTuThanhPham = scopeMapping?.idNvlBbgnThanhPham ?? null;
        const tenNvlThanhPham = scopeMapping?.tenVatTu ?? null;
        setBbgnIdVatTu(idVatTuThanhPham);
        setBbgnTenVatTu(tenNvlThanhPham);
        const userList: any[] = Array.isArray(users) ? users : [];
        const bgList: any[] = Array.isArray(bgUsers) ? bgUsers : [];
        const toOption = (u: any) => ({
          label: `${u.tenTaiKhoan} - ${u.hoVaTen}`,
          value: u.iD_TaiKhoan,
        });
        setUserOptions(userList.map(toOption));
        setNguoiBGOptions(
          bgList.length > 0 ? bgList.map(toOption) : userList.map(toOption),
        );
        const infoMap: Record<
          number,
          { tenPhongBan: string | null; xuong_API: string | null }
        > = {};
        userList.forEach((u: any) => {
          if (u.iD_TaiKhoan != null)
            infoMap[u.iD_TaiKhoan] = {
              tenPhongBan: u.tenPhongBan ?? null,
              xuong_API: u.xuong_API ?? null,
            };
        });
        setUserInfoMap(infoMap);

        const initRows: TaoBBGNChiTietRow[] =
          sourceRows && sourceRows.length > 0
            ? sourceRows.map((r, i) => ({
                key: i,
                tenNVL: tenNvlThanhPham ?? r.nguyenLieu ?? "",
                nguyenVatLieuID: r.nguyenVatLieuID,
                id_VatTu: idVatTuThanhPham,
                idTaiKhoanBG: null,
                idTaiKhoan: null,
                noiDungTrichYeu: "",
                maLo: "",
                doAm_W: 0,
                khoiLuong_BG:
                  r.thanhPhamL1 !== "" && r.thanhPhamL1 != null
                    ? Number(r.thanhPhamL1)
                    : null,
                ghiChu: "",
              }))
            : [
                {
                  key: Date.now(),
                  tenNVL: tenNvlThanhPham ?? "",
                  nguyenVatLieuID: undefined,
                  id_VatTu: idVatTuThanhPham,
                  idTaiKhoanBG: null,
                  idTaiKhoan: null,
                  noiDungTrichYeu: "",
                  maLo: "",
                  doAm_W: 0,
                  khoiLuong_BG: null,
                  ghiChu: "",
                },
              ];

        setTaoBBGNRows(initRows);
        setShowTaoBBGNModal(true);
      } catch {
        message.error("Lỗi khi tải dữ liệu");
      } finally {
        setLoadingTaoBBGN(false);
      }
    },
    [currentUserInfo, selectedScope],
  );

  const updateTaoBBGNRow = useCallback(
    (idx: number, field: keyof TaoBBGNChiTietRow, value: any) => {
      setTaoBBGNRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
      );
    },
    [],
  );

  const addTaoBBGNRow = useCallback(() => {
    setTaoBBGNRows((prev) => [
      ...prev,
      {
        key: Date.now(),
        tenNVL: bbgnTenVatTu ?? "",
        nguyenVatLieuID: undefined,
        id_VatTu: bbgnIdVatTu,
        idTaiKhoanBG: null,
        idTaiKhoan: null,
        noiDungTrichYeu: "",
        maLo: "",
        doAm_W: 0,
        khoiLuong_BG: null,
        ghiChu: "",
      },
    ]);
  }, [bbgnIdVatTu, bbgnTenVatTu]);

  const handleSubmitTaoBBGN = useCallback(async () => {
    const missingNguoiGiao = taoBBGNRows.filter((r) => !r.idTaiKhoanBG);
    if (missingNguoiGiao.length > 0) {
      message.warning(`${missingNguoiGiao.length} dòng chưa chọn người giao`);
      return;
    }
    const missingNguoiNhan = taoBBGNRows.filter((r) => !r.idTaiKhoan);
    if (missingNguoiNhan.length > 0) {
      message.warning(`${missingNguoiNhan.length} dòng chưa chọn người nhận`);
      return;
    }
    const missingVatTu = taoBBGNRows.filter((r) => !r.id_VatTu);
    if (missingVatTu.length > 0) {
      message.warning(`${missingVatTu.length} dòng chưa có ID Vật tư`);
      return;
    }
    setLoadingTaoBBGN(true);
    try {
      const ngay = (ngaySXFilter ?? dayjs()).format("YYYY-MM-DD");
      const idCa = caSX === 1 ? "1" : "2";

      let successCount = 0;
      for (const r of taoBBGNRows) {
        const request: TaoBBGNRequestDto = {
          IDTaiKhoanBG: r.idTaiKhoanBG!,
          IDTaiKhoan: r.idTaiKhoan!,
          XacNhan: "1",
          ID_Day: ngay,
          IDCa: idCa,
          NoiDungTrichYeu: r.noiDungTrichYeu || "",
          ChiTiet: [
            {
              ID_VatTu: r.id_VatTu!,
              MaLo: r.maLo ?? "",
              DoAm_W: r.doAm_W ?? null,
              KhoiLuong_BG: r.khoiLuong_BG ?? 0,
              GhiChu: r.ghiChu ?? "",
            },
          ],
        };
        await bm11Api.taoPhieu(request);
        successCount++;
      }
      message.success(`Đã tạo ${successCount} BBGN thành công`);
      setShowTaoBBGNModal(false);
      setShowBBGNModal(false);
      await handleLoadEMS();
    } catch {
      message.error("Lỗi khi tạo BBGN");
    } finally {
      setLoadingTaoBBGN(false);
    }
  }, [idTaiKhoanBG, taoBBGNRows, ngaySXFilter, caSX, handleLoadEMS]);

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

        {/* ─── Ngày SX + Xưởng ────────────────────────────────────────────────── */}
        <Space wrap align="end" style={{ marginBottom: 8 }}>
          <div>
            <div style={{ fontWeight: 500, marginBottom: 4, fontSize: 14 }}>
              Ngày sản xuất
            </div>
            <DatePicker
              value={ngaySXFilter}
              onChange={setNgaySXFilter}
              format="DD/MM/YYYY"
              style={{ width: 160 }}
              placeholder="Chọn ngày SX"
              allowClear={false}
              disabled={!!idphieu}
            />
          </div>
          <div>
            <div style={{ fontWeight: 500, marginBottom: 4, fontSize: 14 }}>
              Ca sản xuất
            </div>
            <Select
              value={caSX}
              onChange={(value) => {
                setCaSX(Number(value));
                form.setFieldValue("ca", Number(value));
                form.setFieldValue("caSX", Number(value));
              }}
              options={[
                { label: "Ca ngày", value: 1 },
                { label: "Ca đêm", value: 2 },
              ]}
              style={{ width: 170 }}
              disabled={!!idphieu}
            />
          </div>
          <div>
            <div style={{ fontWeight: 500, marginBottom: 4, fontSize: 14 }}>
              Xưởng
            </div>
            <Select
              value={selectedScope}
              onChange={setSelectedScope}
              options={SCOPE_OPTIONS}
              placeholder="Chọn xưởng"
              style={{ width: 220 }}
              allowClear
              disabled={!!idphieu}
            />
          </div>
        </Space>

        {/* ─── Hàng action: nút quy trình + Tải EMS + Quay lại ──────────────── */}
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
                  loading={loadingEMS}
                  onClick={handleLoadEMS}
                  disabled={!ngaySXFilter || !selectedScope}
                >
                  Tải dữ liệu
                </Button>
                {/* <Button
                  icon={<DeploymentUnitOutlined />}
                  loading={loadingSilo}
                  onClick={handleCheckSilo}
                  disabled={!ngaySXFilter || !selectedScope}
                >
                  Kiểm tra Silo
                </Button> */}
                <Button
                  icon={<FileAddOutlined />}
                  loading={loadingTaoBBGN}
                  onClick={() => handleOpenTaoBBGN()}
                  disabled={!ngaySXFilter || !selectedScope}
                >
                  Tạo BBGN
                </Button>
              </>
            )}
            <Button
              icon={<UndoOutlined />}
              onClick={() => navigate("/baocaoslcptkvv")}
            >
              Quay lại
            </Button>
          </Space>
        </div>

        {/* ─── Bảng dữ liệu ──────────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <Typography.Text
            strong
            style={{ color: caSX === 2 ? "#0958d9" : "#d46b08", fontSize: 14 }}
          >
            {caSX === 2 ? "Ca đêm (Ca 2)" : "Ca ngày (Ca 1)"}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {tableData.length} dòng
          </Typography.Text>
        </div>
        <div style={{ width: "100%", overflowX: "auto", marginBottom: 4 }}>
          <CustomFormTable
            columns={tableColumns}
            initialData={tableData}
            onDataChange={setTableData}
            onCellChange={handleCellChange}
            editable={!isFormLocked}
            loading={loading || loadingEMS}
            minRows={0}
            showAddButton={false}
            showDeleteButton={!isFormLocked && tableData.length > 0}
            summary={buildSummary}
            cellDecorator={bcSlCellDecorator}
            readonlyCellGetter={bbgnCellReadonly}
          />
        </div>
        {/* ─── Dòng TỔNG THÀNH PHẨM riêng ── */}
        {(() => {
          const auto = tongSanLuong.giaTriTuDong;
          const dc = tongThanhPhamDieuChinh;
          const fmt = (n: number) =>
            n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
          const chenhlech =
            auto != null && dc != null
              ? parseFloat((dc - auto).toFixed(3))
              : null;
          const hasWarning = chenhlech !== null && Math.abs(chenhlech) >= 0.001;
          return (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: "8px 14px",
                marginBottom: 4,
                background: hasWarning ? "#fffbe6" : "#f6ffed",
                border: `1px solid ${hasWarning ? "#ffe58f" : "#b7eb8f"}`,
                borderRadius: 4,
              }}
            >
              {/* Hàng 1: TỔNG + giá trị + chênh lệch + nút */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <Typography.Text strong style={{ minWidth: 160 }}>
                  TỔNG THÀNH PHẨM:
                </Typography.Text>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Tự động:
                  </Typography.Text>
                  <Typography.Text
                    strong
                    style={{ fontSize: 14, minWidth: 90 }}
                  >
                    {auto != null ? `${fmt(auto)} Tấn` : "—"}
                  </Typography.Text>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Điều chỉnh:
                  </Typography.Text>
                  <Typography.Text
                    strong
                    style={{ fontSize: 14, minWidth: 90 }}
                  >
                    {dc != null ? `${fmt(dc)} Tấn` : "—"}
                  </Typography.Text>
                </div>
                {hasWarning && (
                  <Tag color="warning">
                    Chênh lệch: {chenhlech! >= 0 ? "+" : ""}
                    {fmt(chenhlech!)} Tấn
                  </Tag>
                )}
                <Button
                  icon={<PartitionOutlined />}
                  onClick={handleOpenBBGN}
                  size="small"
                >
                  Phân bổ BBGN
                </Button>
              </div>
              {/* Hàng 2: Lý do điều chỉnh (chỉ khi có chênh lệch) */}
              {hasWarning && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Typography.Text
                    type="secondary"
                    style={{ fontSize: 12, whiteSpace: "nowrap" }}
                  >
                    Lý do điều chỉnh:
                  </Typography.Text>
                  <Input
                    size="small"
                    placeholder="Nhập lý do điều chỉnh..."
                    value={tongSanLuong.lyDoDieuChinh ?? ""}
                    onChange={(e) =>
                      setTongSanLuong((prev) => ({
                        ...prev,
                        lyDoDieuChinh: e.target.value || null,
                      }))
                    }
                    disabled={isFormLocked}
                    style={{ flex: 1, maxWidth: 500 }}
                    maxLength={500}
                  />
                </div>
              )}
            </div>
          );
        })()}

        {/* {!isFormLocked && (
          <Button
            icon={<PlusOutlined />}
            onClick={() =>
              setTableData((p) => [...p, buildBlankRow(p.length + 1)])
            }
            type="dashed"
            size="small"
            style={{ marginBottom: 20 }}
          >
            Thêm dòng
          </Button>
        )} */}

        {config.footerNotes?.length > 0 && (
          <div style={{ marginBottom: 12, fontSize: 12, color: "#888" }}>
            {config.footerNotes.map((note: string, i: number) => (
              <div key={i}>* {note}</div>
            ))}
          </div>
        )}

        <div
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

      {/* ─── Modal Kiểm tra / Thiết lập Silo Mapping ──────────────────────── */}
      <Modal
        title={
          <span>
            Thiết lập Silo Mapping
            {ngaySXFilter && (
              <span style={{ fontWeight: 400, fontSize: 13, marginLeft: 8 }}>
                — {ngaySXFilter.format("DD/MM/YYYY")} ·{" "}
                {getTKVVScopeByNumber(selectedScope ?? 0)?.label ?? ""}
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

      {/* ─── Modal Điều chỉnh & Phân bổ BBGN ─────────────────────────────── */}
      <Modal
        title={
          <span>
            Điều chỉnh &amp; Phân bổ theo BBGN
            {tongSanLuong.giaTriDieuChinh != null && (
              <span
                style={{
                  fontWeight: 400,
                  fontSize: 13,
                  marginLeft: 8,
                  color: "#52c41a",
                }}
              >
                — Tổng PLC:{" "}
                {tongSanLuong.giaTriDieuChinh.toLocaleString("en-US", {
                  minimumFractionDigits: 3,
                  maximumFractionDigits: 3,
                })}{" "}
                Tấn
              </span>
            )}
          </span>
        }
        open={showBBGNModal}
        onCancel={() => setShowBBGNModal(false)}
        width={820}
        footer={[
          <Button key="cancel" onClick={() => setShowBBGNModal(false)}>
            Đóng
          </Button>,
          // <Button
          //   key="taoBBGN"
          //   icon={<PartitionOutlined />}
          //   loading={loadingTaoBBGN}
          //   onClick={() => handleOpenTaoBBGN(bbgnEditRows)}
          //   disabled={false}
          // >
          //   Tạo BBGN
          // </Button>,
          <Button
            key="apply"
            type="primary"
            onClick={handleApplyBBGN}
            disabled={isFormLocked}
          >
            Áp dụng
          </Button>,
        ]}
        destroyOnHidden
      >
        <Table<TableRow>
          dataSource={bbgnEditRows}
          rowKey="key"
          pagination={false}
          size="small"
          locale={{ emptyText: "Chưa có dữ liệu từ BBGN" }}
          summary={(rows) => {
            const total = Array.from(rows).reduce((s, r) => {
              const v = Number(r.thanhPhamL1);
              return s + (isNaN(v) ? 0 : v);
            }, 0);
            const plc = tongSanLuong.giaTriDieuChinh ?? 0;
            const diff = total - plc;
            return (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={3}>
                  <b>TỔNG</b>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3}>
                  <b>
                    {total.toLocaleString("en-US", {
                      minimumFractionDigits: 3,
                      maximumFractionDigits: 3,
                    })}
                  </b>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4}>
                  {tongSanLuong.giaTriDieuChinh != null && (
                    <Typography.Text
                      type={Math.abs(diff) < 0.001 ? "success" : "warning"}
                      style={{ fontSize: 12 }}
                    >
                      {diff >= 0 ? "+" : ""}
                      {diff.toLocaleString("en-US", {
                        minimumFractionDigits: 3,
                        maximumFractionDigits: 3,
                      })}{" "}
                      so PLC
                    </Typography.Text>
                  )}
                </Table.Summary.Cell>
              </Table.Summary.Row>
            );
          }}
          columns={[
            {
              title: "STT",
              width: 50,
              render: (_, __, idx) => idx + 1,
            },
            {
              title: "Nguyên vật liệu",
              dataIndex: "nguyenLieu",
              render: (val) => {
                const name = bbgnTenVatTu ?? val;
                return name || <Typography.Text type="secondary">—</Typography.Text>;
              },
            },
            {
              title: "Nguồn BBGN",
              dataIndex: "thanhPham_Note",
              render: (val) => (
                <Typography.Text style={{ fontSize: 12 }}>
                  {val || "—"}
                </Typography.Text>
              ),
            },
            {
              title: "Thành phẩm L1 (Tấn)",
              dataIndex: "thanhPhamL1",
              width: 180,
              render: (val, _, idx) => (
                <InputNumber
                  value={val === "" || val == null ? undefined : Number(val)}
                  onChange={(v) =>
                    setBbgnEditRows((prev) =>
                      prev.map((r, i) =>
                        i === idx ? { ...r, thanhPhamL1: v ?? "" } : r,
                      ),
                    )
                  }
                  precision={3}
                  min={0}
                  style={{ width: "100%" }}
                  disabled={isFormLocked}
                />
              ),
            },
            {
              title: "ID CT BBGN",
              dataIndex: "id_CT_BBGN",
              width: 110,
              render: (val) => (
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  {val ?? "—"}
                </Typography.Text>
              ),
            },
          ]}
        />
        <div style={{ marginTop: 8, fontSize: 12, color: "#888" }}>
          * Điều chỉnh giá trị Thành phẩm L1 để phân bổ lại. Nhấn &quot;Áp
          dụng&quot; để cập nhật vào bảng chính.
        </div>
      </Modal>

      {/* ─── Modal Tạo Biên bản giao nhận ─────────────────────────────────── */}
      <Modal
        title={
          <span>
            Tạo Biên bản giao nhận
            <span
              style={{
                fontWeight: 400,
                fontSize: 13,
                marginLeft: 8,
                color: "#888",
              }}
            >
              — {(ngaySXFilter ?? dayjs()).format("DD/MM/YYYY")} ·{" "}
              {caSX === 1 ? "Ca ngày" : "Ca đêm"}
            </span>
          </span>
        }
        open={showTaoBBGNModal}
        onCancel={() => setShowTaoBBGNModal(false)}
        width={1300}
        footer={[
          <Button key="cancel" onClick={() => setShowTaoBBGNModal(false)}>
            Hủy
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={loadingTaoBBGN}
            onClick={handleSubmitTaoBBGN}
          >
            Tạo BBGN
          </Button>,
        ]}
        destroyOnHidden
      >
        {/* Header nhỏ — thông tin chung */}
        <div
          style={{ display: "flex", gap: 24, marginBottom: 12, fontSize: 13 }}
        >
          <span>
            <Typography.Text type="secondary">Ngày SX: </Typography.Text>
            <b>{(ngaySXFilter ?? dayjs()).format("DD/MM/YYYY")}</b>
          </span>
          <span>
            <Typography.Text type="secondary">Ca: </Typography.Text>
            <b>{caSX === 1 ? "Ca ngày" : "Ca đêm"}</b>
          </span>
          {tongSanLuong.giaTriDieuChinh != null && (
            <span>
              <Typography.Text type="secondary">Tổng PLC: </Typography.Text>
              <b style={{ color: "#1677ff" }}>
                {tongSanLuong.giaTriDieuChinh.toLocaleString("en-US", {
                  minimumFractionDigits: 3,
                  maximumFractionDigits: 3,
                })}{" "}
                Tấn
              </b>
            </span>
          )}
        </div>

        <Table<TaoBBGNChiTietRow>
          dataSource={taoBBGNRows}
          rowKey="key"
          pagination={false}
          size="small"
          scroll={{ x: 1000 }}
          columns={[
            {
              title: "STT",
              width: 45,
              render: (_, __, idx) => idx + 1,
            },
            {
              title: "Vật tư giao nhận",
              dataIndex: "tenNVL",
              width: 150,
              render: (val) =>
                val || <Typography.Text type="secondary">—</Typography.Text>,
            },
            {
              title: (
                <span>
                  Người giao <span style={{ color: "red" }}>*</span>
                </span>
              ),
              dataIndex: "idTaiKhoanBG",
              width: 200,
              render: (val, _, idx) => (
                <Select
                  style={{ width: "100%" }}
                  showSearch
                  optionFilterProp="label"
                  options={nguoiBGOptions}
                  value={val}
                  onChange={(v) =>
                    updateTaoBBGNRow(idx, "idTaiKhoanBG", v ?? null)
                  }
                  placeholder="Chọn người giao"
                  status={!val ? "error" : undefined}
                />
              ),
            },
            {
              title: (
                <span>
                  Người nhận <span style={{ color: "red" }}>*</span>
                </span>
              ),
              dataIndex: "idTaiKhoan",
              width: 200,
              render: (val, _, idx) => (
                <Select
                  style={{ width: "100%" }}
                  showSearch
                  optionFilterProp="label"
                  options={userOptions}
                  value={val}
                  onChange={(v) =>
                    updateTaoBBGNRow(idx, "idTaiKhoan", v ?? null)
                  }
                  placeholder="Chọn người nhận"
                  status={!val ? "error" : undefined}
                />
              ),
            },
            {
              title: "Thông tin người nhận",
              dataIndex: "idTaiKhoan",
              width: 180,
              render: (val) => {
                if (!val)
                  return (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      —
                    </Typography.Text>
                  );
                const info = userInfoMap[val];
                if (!info) return null;
                const parts = [info.tenPhongBan, info.xuong_API].filter(
                  Boolean,
                );
                return (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {parts.join(" · ") || "—"}
                  </Typography.Text>
                );
              },
            },
            {
              title: "Nội dung trích yếu",
              dataIndex: "noiDungTrichYeu",
              width: 180,
              render: (val, _, idx) => (
                <Input
                  value={val}
                  onChange={(e) =>
                    updateTaoBBGNRow(idx, "noiDungTrichYeu", e.target.value)
                  }
                  placeholder="Nhập nội dung..."
                />
              ),
            },
            {
              title: "Mã lô",
              dataIndex: "maLo",
              width: 110,
              render: (val, _, idx) => (
                <Input
                  value={val}
                  onChange={(e) =>
                    updateTaoBBGNRow(idx, "maLo", e.target.value)
                  }
                  placeholder="Mã lô"
                />
              ),
            },
            {
              title: "Độ ẩm (%)",
              dataIndex: "doAm_W",
              width: 100,
              render: (val, _, idx) => (
                <InputNumber
                  value={val}
                  onChange={(v) => updateTaoBBGNRow(idx, "doAm_W", v ?? null)}
                  style={{ width: "100%" }}
                  precision={2}
                  min={0}
                  max={100}
                  placeholder="0.00"
                />
              ),
            },
            {
              title: "KL bên giao (Tấn)",
              dataIndex: "khoiLuong_BG",
              width: 140,
              render: (val, _, idx) => (
                <InputNumber
                  value={val}
                  onChange={(v) =>
                    updateTaoBBGNRow(idx, "khoiLuong_BG", v ?? null)
                  }
                  style={{ width: "100%" }}
                  precision={3}
                  min={0}
                  placeholder="0.000"
                />
              ),
            },
            {
              title: "Ghi chú",
              dataIndex: "ghiChu",
              width: 130,
              render: (val, _, idx) => (
                <Input
                  value={val}
                  onChange={(e) =>
                    updateTaoBBGNRow(idx, "ghiChu", e.target.value)
                  }
                  placeholder=""
                />
              ),
            },
            {
              title: "",
              width: 36,
              render: (_, __, idx) => (
                <Button
                  size="small"
                  danger
                  type="text"
                  onClick={() =>
                    setTaoBBGNRows((prev) => prev.filter((_, i) => i !== idx))
                  }
                >
                  ✕
                </Button>
              ),
            },
          ]}
          summary={(rows) => {
            const total = Array.from(rows).reduce(
              (s, r) => s + (r.khoiLuong_BG ?? 0),
              0,
            );
            return (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={6}>
                  <b>TỔNG</b>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6}>
                  <b>
                    {total.toLocaleString("en-US", {
                      minimumFractionDigits: 3,
                      maximumFractionDigits: 3,
                    })}{" "}
                    Tấn
                  </b>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={7} colSpan={2} />
              </Table.Summary.Row>
            );
          }}
        />
        <div style={{ marginTop: 10 }}>
          <Button icon={<PlusOutlined />} onClick={addTaoBBGNRow} size="small">
            Thêm dòng
          </Button>
        </div>
      </Modal>
    </Card>
  );
};

export default TaoPhieuBaoCaoSanLuongChiPhi;
