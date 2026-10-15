import { Button, message, Modal, Tag } from "antd";
import dayjs from "dayjs";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { FilterFieldConfig } from "../../../components/PhieuFilterCard";
import ThongKePhieuCommon, {
  type ExtraActionsCtx,
  type TableRecord,
} from "../../../components/ThongKePhieuCommon";
import { DEFAULT_TINH_TRANG_OPTIONS } from "../../../utils/ConfigDefault/thongKePhieuDefaults";
import type { SearchPhieuRequest } from "../../../models/Phieu";
import type { PhieuFilterValues } from "../../../components/PhieuFilterCard";
import { getPhieuStatusConfig, PHOI_TAM_STATUS_CONFIG } from "../../../utils/constants/TrangThaiPhieuDisplay";
import { BM_CONFIG } from "../../../utils/configs/BieuMauConst";
import { NhaMayEnum } from "../../../services/MayDucServiceApi";
import { useMayDucOptions } from "../../../hooks/useMayDucOptions";
import { dlnmHRC2Api } from "../../../services/DLNMHRC2Api";

// Map maBm -> route chi tiết
const MABM_DETAIL_ROUTE: Record<string, string> = {
  HRC2_BB_NauLuyen_BOF: "/chitiettieuhaonauluyen_bof",
  HRC2_BB_NauLuyen_LF: "/chitiettieuhaonauluyen_lf",
  HRC2_BB_NauLuyen_RH: "/chitiettieuhaonauluyen_rh",
  HRC2_STD_NXT: "/tao-std",
  HRC2_BBGN_ThepLong: "/chitietgiaonhantheplong",
  HRC2_BBSL_PhoiTam: "/chitietbbgnphoitam",
};

const MABM_LIST: string[] = [
  BM_CONFIG.HRC2.HRC2_BB_NauLuyen_BOF,
  BM_CONFIG.HRC2.HRC2_BB_NauLuyen_LF,
  BM_CONFIG.HRC2.HRC2_BB_NauLuyen_RH,
  // BM_CONFIG.HRC2.HRC2_STD_NXT,
  BM_CONFIG.HRC2.HRC2_BBGN_ThepLong,
  BM_CONFIG.HRC2.HRC2_BBSL_PhoiTam,
];

const LOAI_BM_TO_MABM: Record<string, string> = {
  BOF: BM_CONFIG.HRC2.HRC2_BB_NauLuyen_BOF,
  LF: BM_CONFIG.HRC2.HRC2_BB_NauLuyen_LF,
  RH: BM_CONFIG.HRC2.HRC2_BB_NauLuyen_RH,
  BBGN_ThepLong: BM_CONFIG.HRC2.HRC2_BBGN_ThepLong,
  BBGN_PhoiTam: BM_CONFIG.HRC2.HRC2_BBSL_PhoiTam,
};

const SCOPE_OPTIONS: Record<string, { label: string; value: number }[]> = {
  BOF: [{ label: "Lò 6", value: 6 }, { label: "Lò 7", value: 7 }],
  RH: [{ label: "RH1", value: 1 }, { label: "RH2", value: 2 }],
};

const normalizeNum = (v: unknown): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
};

interface ThongKePhieuHRC2Props {
  type?: string; // "viecdentoi" | undefined
}

const ThongKePhieuHRC2 = ({ type }: ThongKePhieuHRC2Props) => {
  const navigate = useNavigate();
  const [selectedLoaiBM, setSelectedLoaiBM] = useState<string[]>([]);
  const { options: mayDucOptions } = useMayDucOptions(NhaMayEnum.HRC2);
  const [gangMetricsLoading, setGangMetricsLoading] = useState(false);

  const transformFilters = useCallback((filters: PhieuFilterValues): Partial<SearchPhieuRequest> => {
    const loaiBMList = (filters.loaiBM as (string | number)[] | undefined) ?? [];
    const maBmList = loaiBMList.length > 0
      ? loaiBMList.map((k) => LOAI_BM_TO_MABM[String(k)]).filter(Boolean)
      : null;
    // LF luôn dùng scope 6
    const scopeOverride = loaiBMList.length === 1 && loaiBMList[0] === "LF" ? 6 : normalizeNum(filters.scope);
    return {
      tuNgay: (filters.ngaySXFrom || filters.fromDate || null) as string | null,
      denNgay: (filters.ngaySXTo || filters.toDate || null) as string | null,
      ca: normalizeNum(filters.ca),
      scope: scopeOverride,
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
          { label: "Lò thổi BOF", value: "BOF" },
          { label: "Tinh luyện LF", value: "LF" },
          { label: "Tinh luyện RH", value: "RH" },
          { label: "Giao nhận thép lỏng", value: "BBGN_ThepLong" },
          { label: "Biên bản sản lượng phôi tấm", value: "BBGN_PhoiTam" },
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

    // Gom scope options theo các loaiBM đã chọn (hỗ trợ multi-select)
    const scopeOptionsMap: Record<string, { label: string; value: number }[]> = {
      BOF: SCOPE_OPTIONS.BOF,
      LF: [{ label: "Tinh luyện 6", value: 6 }],
      RH: SCOPE_OPTIONS.RH,
      BBGN_ThepLong: mayDucOptions,
    };
    const defaultScopeOptions = [
      { label: "Lò 6", value: 6 },
      { label: "Lò 7", value: 7 },
      { label: "RH 1", value: 1 },
      { label: "RH 2", value: 2 },
    ];
    const scopeOptions = selectedLoaiBM.length === 0
      ? defaultScopeOptions
      : selectedLoaiBM.length === 1
        ? (scopeOptionsMap[selectedLoaiBM[0]] ?? defaultScopeOptions)
        : (() => {
            const seen = new Set<number>();
            return selectedLoaiBM.flatMap((k) => scopeOptionsMap[k] ?? []).filter((o) => {
              if (seen.has(o.value)) return false;
              seen.add(o.value);
              return true;
            });
          })();
    fields.push({ key: "scope", label: "Lò thổi", type: "select", options: scopeOptions });
    // Biên bản sản lượng phôi tấm (HRC2_BBSL_PhoiTam) dùng thang trạng thái tổng hợp riêng
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
          onClick={() => {
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
      render: (value: string | null | undefined, record: { scope?: number | string | null; maBm?: string | null }) => {
        if (value) return value;
        if (record.scope !== null && record.scope !== undefined) {
          return record.maBm === BM_CONFIG.HRC2.HRC2_BB_NauLuyen_BOF
            ? "Lò thổi " + String(record.scope)
            : record.maBm === BM_CONFIG.HRC2.HRC2_BB_NauLuyen_LF
              ? "Tinh luyện " + String(record.scope)
              : record.maBm === BM_CONFIG.HRC2.HRC2_BB_NauLuyen_RH
                ? "RH " + String(record.scope)
                : null;
        }
        return null;
      },
    },
    { title: "Người tạo", dataIndex: "nguoiTaoId", key: "nguoiTaoId", width: 200, ellipsis: true },
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

  const handleRefreshGangMetrics = useCallback(({ selectedKeys, data }: ExtraActionsCtx) => {
    if (selectedKeys.length === 0) return;

    const selectedRecords = data.filter((r) => selectedKeys.includes(r.idphieu));
    const nonBofRecords = selectedRecords.filter((r) => r.maBm !== BM_CONFIG.HRC2.HRC2_BB_NauLuyen_BOF);

    if (nonBofRecords.length > 0) {
      message.warning(`Chỉ hỗ trợ phiếu HRC2_BB_NauLuyen_BOF. ${nonBofRecords.length} phiếu không hợp lệ sẽ bị bỏ qua.`);
    }

    const bofIds = selectedRecords
      .filter((r) => r.maBm === BM_CONFIG.HRC2.HRC2_BB_NauLuyen_BOF)
      .map((r) => r.idphieu);

    if (bofIds.length === 0) {
      message.error("Không có phiếu BOF nào được chọn.");
      return;
    }

    if (bofIds.length > 10) {
      message.error("Tối đa 10 phiếu BOF mỗi lần làm mới. Vui lòng bỏ chọn bớt.");
      return;
    }

    Modal.confirm({
      title: "Làm mới dữ liệu gang",
      content: `Cập nhật KL gang lỏng CCT và KL thép phế gang cho ${bofIds.length} phiếu BOF đã chọn. Tiếp tục?`,
      okText: "Làm mới",
      cancelText: "Hủy",
      onOk: async () => {
        try {
          setGangMetricsLoading(true);
          const res = await dlnmHRC2Api.refreshGangMetrics(bofIds);
          const result = (res as { updatedRows?: number; skippedPhieu?: number; message?: string }) ?? {};
          message.success(result.message ?? `Đã làm mới ${result.updatedRows ?? 0} mẻ.`);
          if ((result.skippedPhieu ?? 0) > 0)
            message.warning(`${result.skippedPhieu} phiếu không phải BOF đã bị bỏ qua.`);
        } catch {
          message.error("Làm mới dữ liệu gang thất bại. Vui lòng thử lại.");
        } finally {
          setGangMetricsLoading(false);
        }
      },
    });
  }, []);

  const renderExtraActions = useCallback((ctx: ExtraActionsCtx) => (
    <Button
      disabled={ctx.selectedKeys.length === 0}
      loading={gangMetricsLoading}
      onClick={() => handleRefreshGangMetrics(ctx)}
    >
      Làm mới dữ liệu gang ({ctx.selectedKeys.length})
    </Button>
  ), [gangMetricsLoading, handleRefreshGangMetrics]);

  return (
    <ThongKePhieuCommon
      maBmList={MABM_LIST}
      title="Tổng hợp phiếu HRC2"
      type={type}
      mabmDetailRoute={MABM_DETAIL_ROUTE}
      columns={columns}
      filterFields={filterFieldsConfig}
      transformFilters={transformFilters}
      onFilterFieldChange={(key, value) => {
        if (key === "loaiBM") setSelectedLoaiBM(Array.isArray(value) ? value.map(String) : []);
      }}
      renderExtraActions={renderExtraActions}
    />
  );
};

export default ThongKePhieuHRC2;
