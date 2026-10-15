import { Button, message, Tooltip } from "antd";
import dayjs from "dayjs";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { FilterFieldConfig } from "../../../components/PhieuFilterCard";
import ThongKePhieuCommon, {
  type ChotResult,
  type ExtraActionsCtx,
  type TableRecord,
} from "../../../components/ThongKePhieuCommon";
import { DEFAULT_TINH_TRANG_OPTIONS } from "../../../utils/ConfigDefault/thongKePhieuDefaults";
import type { SearchPhieuRequest } from "../../../models/Phieu";
import type { PhieuFilterValues } from "../../../components/PhieuFilterCard";
import { PhieuApi } from "../../../services/PhieuApi";
import { getPhieuStatusConfig, PHOI_TAM_STATUS_CONFIG } from "../../../utils/constants/TrangThaiPhieuDisplay";
import { BM_CONFIG } from "../../../utils/configs/BieuMauConst";
import { TrangThaiPhieuConst } from "../../../utils/constants/TrangThaiPhieuConstant";
import { NhaMayEnum } from "../../../services/MayDucServiceApi";
import { useMayDucOptions } from "../../../hooks/useMayDucOptions";
import { HRC1Api } from "../../../services/HRC1_BBGNApi";
import { Tag, Modal } from "antd";
import { dlnmHRC1Api } from "../../../services/DLNMHRC1Api";

const MABM_DETAIL_ROUTE: Record<string, string> = {
  HRC1_BB_Lothoi: "/taotieuhaolothoi",
  HRC1_TinhLuyen: "/taophieugiaonhantheplong_hrc1",
  HRC1_BBGN_ThepLong: "/chitietgiaonhantheplong_hrc1",
  HRC1_BBSL_PhoiTam: "/chitietbbgnphoitam_hrc1",
  HRC1_BB_TieuHao_BOF: "/hrc1_chitiettieuhaolothoi_bof",
  HRC1_BB_TieuHao_LF: "/hrc1_chitiettieuhaotinhluyenlf",
};

const MABM_LIST: string[] = [
  // BM_CONFIG.HRC1.HRC1_BB_Lothoi,
  // BM_CONFIG.HRC1.HRC1_TinhLuyen,
  BM_CONFIG.HRC1.HRC1_BBGN_ThepLong,
  BM_CONFIG.HRC1.HRC1_BBSL_PhoiTam,
  BM_CONFIG.HRC1.HRC1_BB_TieuHao_BOF,
  BM_CONFIG.HRC1.HRC1_BB_TieuHao_LF,
];

const LOAI_BM_TO_MABM: Record<string, string> = {
  LoThoi: BM_CONFIG.HRC1.HRC1_BB_Lothoi,
  TinhLuyen: BM_CONFIG.HRC1.HRC1_TinhLuyen,
  BBGN_ThepLong: BM_CONFIG.HRC1.HRC1_BBGN_ThepLong,
  BBGN_PhoiTam: BM_CONFIG.HRC1.HRC1_BBSL_PhoiTam,
  BB_TieuHao_BOF: BM_CONFIG.HRC1.HRC1_BB_TieuHao_BOF,
  BB_TieuHao_LF: BM_CONFIG.HRC1.HRC1_BB_TieuHao_LF,
};

const normalizeNum = (v: unknown): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
};

interface ThongKePhieuHRC1Props {
  type?: string;
}

const ThongKePhieuHRC1 = ({ type }: ThongKePhieuHRC1Props) => {
  const navigate = useNavigate();
  const [selectedLoaiBM, setSelectedLoaiBM] = useState<string[]>([]);
  const { options: mayDucOptions } = useMayDucOptions(NhaMayEnum.HRC1);
  const [exportLoading, setExportLoading] = useState(false);
  const [gangMetricsLoading, setGangMetricsLoading] = useState(false);


  const transformFilters = useCallback((filters: PhieuFilterValues): Partial<SearchPhieuRequest> => {
    const loaiBMList = (filters.loaiBM as (string | number)[] | undefined) ?? [];
    const maBmList = loaiBMList.length > 0
      ? loaiBMList.map((k) => LOAI_BM_TO_MABM[String(k)]).filter(Boolean)
      : null;
    return {
      tuNgay: (filters.ngaySXFrom || filters.fromDate || null) as string | null,
      denNgay: (filters.ngaySXTo || filters.toDate || null) as string | null,
      ca: normalizeNum(filters.ca),
      scope: normalizeNum(filters.scope),
      searchText: (filters.soPhieu || null) as string | null,
      tinhTrang: normalizeNum(filters.tinhTrang),
      ...(maBmList ? { maBmList, maBm: null } : {}),
    };
  }, []);

  const filterFieldsConfig = useMemo<FilterFieldConfig[]>(() => {
    const fields: FilterFieldConfig[] = [
      {
        key: "loaiBM",
        label: "Loại biểu mẫu",
        type: "multiselect",
        options: [
          { label: "Lò thổi", value: "LoThoi" },
          { label: "Tinh luyện", value: "TinhLuyen" },
          { label: "Giao nhận thép lỏng", value: "BBGN_ThepLong" },
          { label: "Biên bản sản lượng phôi tấm", value: "BBGN_PhoiTam" },
          { label: "Tiêu hao lò thổi BOF", value: "BB_TieuHao_BOF" },
          { label: "Tiêu hao tinh luyện LF", value: "BB_TieuHao_LF" },
        ],
      },
      { key: "ngaySX", label: "Ngày sản xuất", type: "dateRange", placeholder: "Khoảng ngày" },
      {
        key: "ca",
        label: "Ca",
        type: "select",
        options: [
          { label: "Ca ngày (1)", value: 1 },
          { label: "Ca đêm (2)", value: 2 },
        ],
      },
      { key: "soPhieu", label: "Số phiếu", type: "text", placeholder: "Số phiếu..." },
    ];

    // Scope options: LoThoi không có scope, BBGN_ThepLong dùng máy đúc
    const scopeOptionsMap: Record<string, { label: string; value: number }[]> = {
      BBGN_ThepLong: mayDucOptions,
    };
    const scopeOptions = selectedLoaiBM.length === 0
      ? mayDucOptions
      : selectedLoaiBM.length === 1
        ? (scopeOptionsMap[selectedLoaiBM[0]] ?? [])
        : (() => {
            const seen = new Set<number>();
            return selectedLoaiBM
              .flatMap((k) => scopeOptionsMap[k] ?? [])
              .filter((o) => {
                if (seen.has(o.value)) return false;
                seen.add(o.value);
                return true;
              });
          })();

    if (scopeOptions.length > 0) {
      fields.push({ key: "scope", label: "Máy đúc", type: "select", options: scopeOptions });
    }

    // Biên bản sản lượng phôi tấm (HRC1_BBSL_PhoiTam) dùng thang trạng thái tổng hợp riêng
    // (11/12, xem PHOI_TAM_STATUS_CONFIG) thay vì TrangThaiPhieuConst chuẩn — gộp thêm vào đây
    // để lọc được tình trạng cho mã BM này.
    const tinhTrangOptions = [
      ...DEFAULT_TINH_TRANG_OPTIONS,
      ...Object.entries(PHOI_TAM_STATUS_CONFIG).map(([value, cfg]) => ({
        label: `${cfg.text} (Phôi tấm)`,
        value: Number(value),
      })),
    ];
    fields.push({ key: "tinhTrang", label: "Tình trạng", type: "select", options: tinhTrangOptions });

    return fields;
  }, [mayDucOptions, selectedLoaiBM]);

  const columns = useMemo(() => [
    {
      title: <b>Số Phiếu</b>,
      dataIndex: "soPhieu",
      key: "soPhieu",
      width: 300,
      render: (text: string, record: TableRecord) => (
        <b
          style={{ color: "#1976d2", cursor: "pointer" }}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            const route = MABM_DETAIL_ROUTE[record.maBm as string];
            if (!route) return;
            if (type === "viecdentoi") {
              navigate(route, { state: { idphieu: record.idphieu, pheduyet: record?.pheDuyet?.[0] ?? null } });
            } else {
              navigate(route, { state: { idphieu: record.idphieu } });
            }
          }}
        >
          {text}
        </b>
      ),
    },
    { title: "Quy trình", dataIndex: "maBm", key: "maBm", width: 250, ellipsis: true },
    {
      title: "Ngày lập phiếu",
      dataIndex: "ngaySX",
      key: "ngaySX",
      width: 200,
      render: (value: string) => (value ? dayjs(value).format("DD/MM/YYYY") : "-"),
    },
    {
      title: "Ca",
      dataIndex: "ca",
      key: "ca",
      width: 200,
      render: (value: number) => (value === 1 ? "(1) Ca Ngày" : value === 2 ? "(2) Ca Đêm" : "-"),
    },
    {
      title: "Khu vực",
      dataIndex: "tenScope",
      key: "tenScope",
      width: 200,
      ellipsis: true,
      render: (value: string | null | undefined, record: { scope?: number | string | null }) => {
        if (value) return value;
        if (record.scope !== null && record.scope !== undefined) return record.scope;
        return null;
      },
    },
    {
      title: "Số mẻ",
      key: "nguoiTaoOrSoMe",
      width: 200,
      ellipsis: true,
      render: (_: unknown, record: TableRecord) => {
        if (record.maBm === BM_CONFIG.HRC1.HRC1_BBGN_ThepLong) {
          const count = (record as TableRecord & { soLuongMe?: number | null }).soLuongMe;
          return count != null ? <span>{count} mẻ </span> : "-";
        }
        return record.nguoiTaoId ?? "-";
      },
    },
    {
      title: "Trạng thái",
      dataIndex: "tinhTrang",
      key: "tinhTrang",
      width: 200,
      render: (status: number, record: TableRecord) => {
        const cfg = getPhieuStatusConfig(record.maBm, status);
        return <Tag color={cfg?.color || "default"}>{cfg?.text || status}</Tag>;
      },
    },
  ], [navigate, type]);

  const handleChotBatch = useCallback(async (ids: string[], dataMap: Map<string, TableRecord>): Promise<ChotResult> => {
    const bbgnIds = ids.filter((id) => dataMap.get(id)?.maBm === BM_CONFIG.HRC1.HRC1_BBGN_ThepLong);
    const otherIds = ids.filter((id) => dataMap.get(id)?.maBm !== BM_CONFIG.HRC1.HRC1_BBGN_ThepLong);

    const failures: ChotResult["failures"] = [];
    let successCount = 0;

    if (bbgnIds.length > 0) {
      const result = await HRC1Api.chotPhieuBatch(bbgnIds);
      successCount += result.thanhCong.length;
      failures.push(...result.thatBai);
    }
    if (otherIds.length > 0) {
      await PhieuApi.chotNhieuPhieu(otherIds, TrangThaiPhieuConst.DaChot);
      successCount += otherIds.length;
    }
    return { successCount, failures };
  }, []);

  const handleHuyChotBatch = useCallback(async (ids: string[], dataMap: Map<string, TableRecord>): Promise<ChotResult> => {
    const bbgnIds = ids.filter((id) => dataMap.get(id)?.maBm === BM_CONFIG.HRC1.HRC1_BBGN_ThepLong);
    const otherIds = ids.filter((id) => dataMap.get(id)?.maBm !== BM_CONFIG.HRC1.HRC1_BBGN_ThepLong);

    const failures: ChotResult["failures"] = [];
    let successCount = 0;

    if (bbgnIds.length > 0) {
      const result = await HRC1Api.huyChotPhieuBatch(bbgnIds);
      successCount += result.thanhCong.length;
      failures.push(...result.thatBai);
    }
    if (otherIds.length > 0) {
      await PhieuApi.chotNhieuPhieu(otherIds, TrangThaiPhieuConst.HoanThanh);
      successCount += otherIds.length;
    }
    return { successCount, failures };
  }, []);

  const handleExportBulk = useCallback(async (selectedKeys: string[]) => {
    try {
      setExportLoading(true);
      await HRC1Api.exportBulkExcel(selectedKeys);
    } catch (e) {
      message.error(e instanceof Error ? e.message : "Xuất Excel thất bại.");
    } finally {
      setExportLoading(false);
    }
  }, []);

  const handleRefreshGangMetrics = useCallback((ctx: ExtraActionsCtx) => {
    const { selectedKeys, data } = ctx;
    if (selectedKeys.length === 0) return;

    const selectedRecords = data.filter((r) => selectedKeys.includes(r.idphieu));
    const supportedMaBm = [BM_CONFIG.HRC1.HRC1_BB_TieuHao_BOF, BM_CONFIG.HRC1.HRC1_BB_TieuHao_LF];
    const unsupportedRecords = selectedRecords.filter((r) => !supportedMaBm.includes(r.maBm as string));

    if (unsupportedRecords.length > 0) {
      message.warning(`Chỉ hỗ trợ phiếu HRC1_BB_TieuHao_BOF/LF. ${unsupportedRecords.length} phiếu không hợp lệ sẽ bị bỏ qua.`);
    }

    const ids = selectedRecords
      .filter((r) => supportedMaBm.includes(r.maBm as string))
      .map((r) => r.idphieu);

    if (ids.length === 0) {
      message.error("Không có phiếu BOF/LF nào được chọn.");
      return;
    }

    if (ids.length > 10) {
      message.error("Tối đa 10 phiếu mỗi lần làm mới. Vui lòng bỏ chọn bớt.");
      return;
    }

    Modal.confirm({
      title: "Làm mới dữ liệu gang",
      content: `Cập nhật KL gang lỏng CCT/KL thép phế gang (BOF) và KL thép lỏng (LF) cho ${ids.length} phiếu đã chọn. Tiếp tục?`,
      okText: "Làm mới",
      cancelText: "Hủy",
      onOk: async () => {
        try {
          setGangMetricsLoading(true);
          const res = await dlnmHRC1Api.refreshGangMetrics(ids);
          const result = (res as { updatedRows?: number; skippedPhieu?: number; message?: string }) ?? {};
          message.success(result.message ?? `Đã làm mới ${result.updatedRows ?? 0} mẻ.`);
          if ((result.skippedPhieu ?? 0) > 0)
            message.warning(`${result.skippedPhieu} phiếu không hợp lệ đã bị bỏ qua.`);
        } catch {
          message.error("Làm mới dữ liệu gang thất bại. Vui lòng thử lại.");
        } finally {
          setGangMetricsLoading(false);
        }
      },
    });
  }, []);

  const renderExtraActions = useCallback((ctx: ExtraActionsCtx) => (
    <>
    <Tooltip title={ctx.selectedKeys.length > 0 && !ctx.selectedMaBm ? "Chỉ xuất được nhiều phiếu cùng loại biểu mẫu" : undefined}>
      <Button
        disabled={ctx.selectedKeys.length === 0 || !ctx.selectedMaBm}
        loading={exportLoading}
        onClick={() => handleExportBulk(ctx.selectedKeys)}
      >
        Export Excel ({ctx.selectedKeys.length})
      </Button>
    </Tooltip>
    <Button
      disabled={ctx.selectedKeys.length === 0}
      loading={gangMetricsLoading}
      onClick={() => handleRefreshGangMetrics(ctx)}
    >
      Làm mới dữ liệu gang ({ctx.selectedKeys.length})
    </Button>
    </>
  ), [exportLoading, handleExportBulk, handleRefreshGangMetrics, gangMetricsLoading]);

  return (
    <ThongKePhieuCommon
      maBmList={MABM_LIST} 
      title="Tổng hợp phiếu HRC1"
      type={type}
      mabmDetailRoute={MABM_DETAIL_ROUTE}
      columns={columns}
      filterFields={filterFieldsConfig}
      transformFilters={transformFilters}
      onFilterFieldChange={(key, value) => {
        if (key === "loaiBM") setSelectedLoaiBM(Array.isArray(value) ? value.map(String) : []);
      }}
      onChotPhieu={handleChotBatch}
      onHuyChotPhieu={handleHuyChotBatch}
      renderExtraActions={renderExtraActions}
      rowClickToggleSelect
    />
  );
};

export default ThongKePhieuHRC1;
