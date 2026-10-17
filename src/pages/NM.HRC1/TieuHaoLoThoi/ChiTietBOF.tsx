/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { HRCChildColumn, HRCParentColumn } from "../../../components/CustomTableHRC";
import {
  hrc1TableService,
  type AdjustColumnMeta,
  type DynamicColumnMeta,
} from "../../../services/HRC1TableService";
import { Button, Card, Descriptions, Table, Tooltip, Typography, Row, Col, message } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { formatNumberGroup } from "../../../utils/formatters/numberFormat";
import { usePhieuNavigation } from "../../../hooks/usePhieuNavigation";
import { PhieuApi } from "../../../services/PhieuApi";
import HRC1_BB_TieuHao_BOF from "../../../utils/BM_config/HRC1_BB_TieuHao_BOF.json";
import { getBmQuyenUiFlags } from "../../../utils/helpers/checkAdminRole";
import { phieuActionService } from "../../../services/PhieuActionService";
import { DETAIL_HIDDEN_BUTTON_KEYS } from "../../../utils/constants/PhieuActionButtonKeys";
import { hrc1PhuLieuService } from "../../../services/HRC1PhuLieuService";
import logoHP from "../../../assets/images/LogoPDF.png";
import HRC1ExportBienBanButtons from "../../../components/HRC1ExportBienBanButtons";

const { Title, Text } = Typography;

function mergeAdjustColumnValuesIntoRows(
  rows: any[],
  adjustMetas: (DynamicColumnMeta & {
    values?: Array<{ rowId?: number | null; meThoi?: string | null; value?: string | number | null }>;
  })[] | undefined
): any[] {
  if (!rows?.length || !adjustMetas?.length) return rows || [];
  const list = rows.map((r) => ({ ...r }));
  adjustMetas.forEach((meta) => {
    const values = meta.values;
    if (!values?.length || !meta.dataIndex) return;
    values.forEach((v) => {
      const row = list.find(
        (r) => (v.rowId != null && r.id === v.rowId) || (v.meThoi != null && r.meThoi === v.meThoi)
      );
      if (row) row[meta.dataIndex] = v.value;
    });
  });
  return list;
}

function inferPhanBoMetasFromRows(rows: any[]): AdjustColumnMeta[] {
  if (!rows?.length) return [];
  const keys = new Set<string>();
  rows.forEach((r) => {
    Object.keys(r).forEach((k) => {
      if (k.startsWith("phanBo_") && !k.includes("__")) keys.add(k);
    });
  });
  return Array.from(keys).map((dataIndex) => ({
    key: dataIndex,
    dataIndex,
    headerKeyId: Number(String(dataIndex).replace(/^phanBo_/, "")) || null,
    headerKeyLabel: null,
    width: 100,
    isManuallyAdded: false,
  }));
}

function mapColumnsWithHighlight(cols: any[], applyHighlightRender: (col: any) => any): any[] {
  return cols.map((col) => {
    if (col.children?.length) {
      return { ...col, children: mapColumnsWithHighlight(col.children, applyHighlightRender) };
    }
    return applyHighlightRender(col);
  });
}

function isTrungMeRow(record: any): boolean {
  return record?.isTrungMeThoi === true || record?.IsTrungMeThoi === true;
}

function isManualCreatedRow(record: any): boolean {
  return record?.IsNM === false || record?.isNM === false;
}

const isSttDataIndex = (dataIndex: string) => dataIndex === "stt" || dataIndex === "STT";

const formatSum = (value: number): string => {
  const rounded = Math.round(value * 100) / 100;
  const sign = rounded < 0 ? "-" : "";
  const abs = Math.abs(rounded);
  const isInteger = Number.isInteger(abs);
  const [intRaw, fracRaw] = (isInteger ? abs.toFixed(0) : abs.toFixed(2)).split(".");
  const intFormatted = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return isInteger ? `${sign}${intFormatted}` : `${sign}${intFormatted}.${fracRaw}`;
};

function buildBaseColumnsAndEditableFields(layoutConfig: typeof HRC1_BB_TieuHao_BOF): {
  baseColumns: HRCParentColumn[];
  editableFields: string[];
} {
  const alignType = (a: unknown): "left" | "center" | "right" | undefined =>
    a === "left" || a === "center" || a === "right" ? a : undefined;
  const rawBase =
    layoutConfig.layout.find((l: any) => l.sectionType === "table" && l.key === "table1")?.columns || [];
  const baseColumns: HRCParentColumn[] = rawBase.map((col: any) => {
    if (Array.isArray(col.children)) {
      return { ...col, align: alignType(col.align), children: col.children.map((c: any) => ({ ...c, align: alignType(c.align) })) };
    }
    return { ...col, align: alignType(col.align) };
  });
  const editableFieldSet = new Set<string>();
  baseColumns.forEach((col: any) => {
    if (col.dataIndex && !col.children && col.isLabel !== true) {
      const editable = col.editable !== false;
      if (editable) editableFieldSet.add(col.dataIndex);
    }
    if (Array.isArray(col.children)) {
      col.children.forEach((child: any) => {
        if (!child.dataIndex) return;
        const editableParent = col.editable !== false;
        const editableChild = child.editable !== false;
        if (editableParent && editableChild) editableFieldSet.add(child.dataIndex);
      });
    }
  });
  return { baseColumns, editableFields: Array.from(editableFieldSet) };
}

type NmColumnsPack = {
  phuGiaColumns: HRCChildColumn[];
  adjustMetas: AdjustColumnMeta[];
};

const ChiTietTieuHaoLoThoi_BOF = () => {
  const { idphieu, navigateToDetail, safeGetDetail, redirectToList } = usePhieuNavigation(
    "phieu_hrc1_bof_id",
    "/viecdentoi/hrc1_tieuhaolothoi"
  );

  const config = HRC1_BB_TieuHao_BOF;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [table1DisplayRows, setTable1DisplayRows] = useState<any[]>([]);
  const [nmColumnsPack, setNmColumnsPack] = useState<NmColumnsPack | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setNmColumnsPack(null);
      setTable1DisplayRows([]);
      if (!idphieu) return;
      const res = await safeGetDetail(() => PhieuApi.getDetail(idphieu));
      if (!res) return;
      const payload = (res as any)?.data ?? res;
      setData(payload);

      const fd = payload?.jsonData || {};
      const savedWithAdjust = mergeAdjustColumnValuesIntoRows(
        fd.table1 || [],
        fd.table1DynamicColumns?.adjust as
          | (DynamicColumnMeta & {
              values?: Array<{ rowId?: number | null; meThoi?: string | null; value?: string | number | null }>;
            })[]
          | undefined
      );

      const ngay = fd.NgaySX;
      const ca = fd.ca;
      const scope = fd.scope;
      if (!ngay || ca == null || scope == null) {
        setTable1DisplayRows(hrc1TableService.sortRowsByMeThoi(savedWithAdjust));
        setNmColumnsPack(null);
        return;
      }

      try {
        const { baseColumns } = buildBaseColumnsAndEditableFields(config);
        const result = await hrc1PhuLieuService.fetchAndProcessPhuLieus(
          { NgaySX: dayjs(ngay).format("YYYY-MM-DD"), Ca: Number(ca), Scope: Number(scope) },
          { baseColumns }
        );

        // Trang Chi tiết CHỈ render thẳng từ live api/DLNMHRC1/filter — không merge với savedWithAdjust
        // (JSON đã lưu trên phiếu). Filter API đã là nguồn sự thật đầy đủ (BE lưu thẳng macThep/
        // klThepPhe/phụ liệu đã sửa tay + IsManual/*Orig vào chính dòng Hrc1TieuHao, kể cả dòng thêm
        // tay đã lưu — filter đọc lại đúng, không cần FE tự merge lại). Trang này không có form nhập/
        // "+ Thêm dòng" nên không có draft cần giữ. Merge theo JSON cũ trước đây khiến mẻ đã bị xóa/
        // đổi ở nơi khác (JSON không tự cập nhật ngoài luồng Lưu) vẫn hiện lại.
        const isPlaceholderRow =
          result.tableData?.length === 1 && result.tableData[0]?.key === "row-empty";
        const finalRows = hrc1TableService.sortRowsByMeThoi(isPlaceholderRow ? [] : result.tableData || []);

        const phanBoMetas: AdjustColumnMeta[] = (result.phanBoColumns ?? []).map((col: any) => ({
          key: col.dataIndex || `phanBo_${col.headerKeyId}`,
          dataIndex: col.dataIndex || `phanBo_${col.headerKeyId}`,
          headerKeyId: col.headerKeyId ?? null,
          headerKeyLabel: col.metaLabel || col.title?.toString() || undefined,
          width: col.width || 100,
          isManuallyAdded: false,
        }));
        const manualMetasFromApi: AdjustColumnMeta[] = (result.adjustColumns ?? []).map((col: any) => ({
          key: col.dataIndex || `manual_col_${col.headerKeyId}`,
          dataIndex: col.dataIndex || `manual_col_${col.headerKeyId}`,
          headerKeyId: col.headerKeyId ?? null,
          headerKeyLabel: col.metaLabel || col.title?.toString() || undefined,
          width: col.width || 150,
          isManuallyAdded: false,
        }));

        // Cột "thêm tay" (phuLieu_*) đã lưu luôn giữ nguyên trong nhóm điều chỉnh, không tự gộp/ẩn khi có dữ liệu —
        // loại trùng với cột phụ liệu tự động (nếu id trùng) được xử lý riêng ở tableColumns (effectivePhuGiaCols).
        const dynAdjust = fd.table1DynamicColumns?.adjust as DynamicColumnMeta[] | undefined;
        const fromSavedAdjust = dynAdjust?.length ? hrc1TableService.adjustMetaFromDynamic(dynAdjust) : [];
        const manualOnlyFromSaved = fromSavedAdjust.filter((m) => m.isManuallyAdded);
        const mergedAdjustMetas = hrc1TableService.dedupeAdjustMetas(
          hrc1TableService.mergeAdjustMetas([...phanBoMetas, ...manualMetasFromApi], manualOnlyFromSaved)
        );

        setTable1DisplayRows(finalRows);
        setNmColumnsPack({
          phuGiaColumns: (result.phuGiaColumns ?? []).map((c) => ({ ...c, editable: false })),
          adjustMetas: mergedAdjustMetas,
        });
      } catch (nmErr) {
        console.error("Lỗi tải/merge dữ liệu NM (filter):", nmErr);
        setTable1DisplayRows(hrc1TableService.sortRowsByMeThoi(savedWithAdjust));
        setNmColumnsPack(null);
      }
    } catch (error) {
      console.error("Lỗi tải dữ liệu phiếu:", error);
      message.error("Không thể tải dữ liệu phiếu");
    } finally {
      setLoading(false);
    }
  }, [idphieu, safeGetDetail, config]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formData = data?.jsonData || {};
  const table2Data = formData?.table2 || [];

  const tableSection = config.layout.find((section: any) => section.sectionType === "table" && section.key === "table1");

  const renderDynamicColumnTitle = useCallback((label: string) => label, []);

  const tableColumns = useMemo(() => {
    const dyn = (formData?.table1DynamicColumns as Record<string, DynamicColumnMeta[]> | undefined) || {};
    const { adjust: adjustFromDyn, BOF_PhuGia: savedPhuGiaCols } = dyn;

    // Ưu tiên snapshot BOF_PhuGia đã lưu (đúng bộ + thứ tự phụ liệu tại thời điểm lưu phiếu) cho nhóm cột
    // phụ liệu CHUẨN — KHÔNG dùng danh mục live hiện tại (nmColumnsPack.phuGiaColumns, luôn lọc theo
    // DangSuDung/ThuTu_Excel_BOF hiện tại), tránh mất/lệch cột khi danh mục HRC1_PhuLieuNM đổi sau này.
    // Nhóm Phân bổ/Điều chỉnh tay (adjustMetas) vẫn ưu tiên live vì bản chất động hơn (Phân bổ tính lại
    // mỗi lần load) — chỉ fallback về snapshot khi live thất bại/rỗng, như trước.
    const phuGiaCols: HRCChildColumn[] = savedPhuGiaCols?.length
      ? hrc1TableService.columnsFromMeta(savedPhuGiaCols, renderDynamicColumnTitle)
      : nmColumnsPack?.phuGiaColumns ?? [];

    let adjustMetas: AdjustColumnMeta[];
    if (nmColumnsPack) {
      adjustMetas = nmColumnsPack.adjustMetas;
    } else {
      adjustMetas = adjustFromDyn?.length
        ? hrc1TableService.dedupeAdjustMetas(hrc1TableService.adjustMetaFromDynamic(adjustFromDyn))
        : [];

      adjustMetas = hrc1TableService.dedupeAdjustMetas(
        hrc1TableService.mergeAdjustMetas(adjustMetas, inferPhanBoMetasFromRows(table1DisplayRows))
      );
    }

    const phanBoChildColumns: HRCChildColumn[] = adjustMetas
      .filter((m) => m.dataIndex.startsWith("phanBo_"))
      .map((meta) => ({
        title: meta.headerKeyLabel ?? "Phân bổ",
        dataIndex: meta.dataIndex,
        width: meta.width ?? 100,
        editable: false,
        variant: "adjust" as const,
        metaLabel: meta.headerKeyLabel ?? "Phân bổ",
        headerKeyId: meta.headerKeyId ?? null,
        sum: true,
      }));

    const adjustChildColumns: HRCChildColumn[] = adjustMetas
      .filter((m) => !m.dataIndex.startsWith("phanBo_"))
      .map((meta) => ({
        title: meta.headerKeyLabel ?? "Điều chỉnh",
        dataIndex: meta.dataIndex,
        width: meta.width ?? 150,
        editable: false,
        variant: "adjust" as const,
        metaLabel: meta.headerKeyLabel ?? "Điều chỉnh",
        headerKeyId: meta.headerKeyId ?? null,
        sum: true,
      }));

    const tableLayout = config.layout.find((l: any) => l.sectionType === "table" && l.key === "table1");
    const alignType = (a: unknown): "left" | "center" | "right" | undefined =>
      a === "left" || a === "center" || a === "right" ? a : undefined;
    const normalizeAlign = (cols: any[]): HRCParentColumn[] =>
      cols.map((col) => {
        if (Array.isArray(col.children)) {
          return { ...col, align: alignType(col.align), children: col.children.map((c: any) => ({ ...c, align: alignType(c.align) })) };
        }
        return { ...col, align: alignType(col.align) };
      });
    const baseColumns: HRCParentColumn[] = normalizeAlign((tableLayout?.columns || []) as any[]);

    const showAdjustColumns = adjustChildColumns.length > 0;

    // Phụ liệu đang được quản lý ở cột "thêm tay" (Điều chỉnh số liệu) — loại khỏi nhóm phụ liệu tự động (BOF_PhuGia)
    // để tránh render 2 cột cho cùng 1 phụ liệu. Cột thêm tay luôn đứng riêng, không gộp vào nhóm NM dù đã có dữ liệu.
    const manuallyManagedPhuLieuIds = new Set(
      adjustMetas
        .filter((m) => m.isManuallyAdded === true && m.dataIndex.startsWith("phuLieu_") && typeof m.headerKeyId === "number")
        .map((m) => m.headerKeyId as number)
    );
    const effectivePhuGiaCols =
      manuallyManagedPhuLieuIds.size === 0
        ? phuGiaCols
        : phuGiaCols.filter((c) => !(typeof c.headerKeyId === "number" && manuallyManagedPhuLieuIds.has(c.headerKeyId)));

    const built = hrc1TableService.buildColumnsWithAdjust({
      baseColumns,
      slotColumns: { BOF_PhuGia: effectivePhuGiaCols },
      showAdjustColumns,
      manualAdjustColumns: adjustChildColumns,
      phanBoColumns: phanBoChildColumns,
      generateAdjustColumnsFromBase: false,
    });

    const applyHighlightRender = (col: any) => {
      if (!col || !col.dataIndex) return col;
      const dataIndex = col.dataIndex;
      const baseRender = col.format === "number-group" ? (value: unknown) => formatNumberGroup(value) : undefined;
      return {
        ...col,
        render: (value: any, record: any) => {
          const isDuplicateMe = dataIndex === "meThoi" && isTrungMeRow(record);
          const isManualRow = isManualCreatedRow(record) && dataIndex !== "stt";
          const origValue = record[`${dataIndex}__orig`];
          const isManualFlag = record[`${dataIndex}__IsManual`] === true;
          const isCellChanged =
            isManualFlag || (origValue !== undefined && String(value ?? "") !== String(origValue ?? ""));
          const displayed = baseRender ? baseRender(value) : value !== undefined && value !== null ? String(value) : "";
          if (isCellChanged) {
            const editedLabel = value !== undefined && value !== null && value !== "" ? String(value) : "(đã xóa)";
            return (
              <Tooltip title={`Tự động: ${String(origValue ?? "")} | Chỉnh sửa: ${editedLabel}`}>
                <span
                  style={{
                    backgroundColor: "#fff7b3",
                    display: "block",
                    color: isDuplicateMe ? "red" : undefined,
                    fontWeight: isDuplicateMe ? 600 : undefined,
                  }}
                >
                  {displayed}
                </span>
              </Tooltip>
            );
          }

          if (isManualRow) {
            return (
              <span
                style={{
                  backgroundColor: "#fff7b3",
                  display: "block",
                  color: isDuplicateMe ? "red" : undefined,
                  fontWeight: isDuplicateMe ? 600 : undefined,
                }}
              >
                {displayed}
              </span>
            );
          }

          if (isDuplicateMe) return <span style={{ color: "red", fontWeight: 600 }}>{displayed}</span>;
          return displayed;
        },
      };
    };

    return mapColumnsWithHighlight(built as any[], applyHighlightRender);
  }, [formData?.table1DynamicColumns, table1DisplayRows, nmColumnsPack, renderDynamicColumnTitle, config.layout]);

  const leafColumns = useMemo(() => {
    const result: Array<{ dataIndex: string; sum?: boolean; align?: string }> = [];
    (tableColumns as any[]).forEach((col: any) => {
      if (col.children) {
        col.children.forEach((child: any) => {
          if (child.dataIndex) result.push({ dataIndex: child.dataIndex, sum: child.sum, align: child.align });
        });
      } else if (col.dataIndex) {
        result.push({ dataIndex: col.dataIndex, sum: col.sum, align: col.align });
      }
    });
    return result;
  }, [tableColumns]);

  const columnSums = useMemo(() => {
    const sums: Record<string, number> = {};
    leafColumns.forEach(({ dataIndex, sum }) => {
      if (!sum || isSttDataIndex(dataIndex)) return;
      sums[dataIndex] = table1DisplayRows.reduce((acc: number, row: any) => {
        const val = parseFloat(String(row[dataIndex] ?? "").replace(/,/g, ""));
        return acc + (isNaN(val) ? 0 : val);
      }, 0);
    });
    return sums;
  }, [leafColumns, table1DisplayRows]);

  const tableSection2 = config.layout2.find((section: any) => section.sectionType === "table" && section.key === "table2");

  const columns2 = useMemo(() => {
    const raw = (tableSection2?.columns || []) as any[];
    const alignType = (a: unknown): "left" | "center" | "right" | undefined =>
      a === "left" || a === "center" || a === "right" ? a : undefined;
    return raw.map((col) => {
      if (Array.isArray(col.children)) {
        return { ...col, align: alignType(col.align), children: col.children.map((c: any) => ({ ...c, align: alignType(c.align) })) };
      }
      return { ...col, align: alignType(col.align) };
    });
  }, [tableSection2?.columns]);

  const getUserInfo = useCallback(() => {
    const stored = localStorage.getItem("userinfo");
    return stored ? JSON.parse(stored) : {};
  }, []);

  const handleActionSuccess = useCallback(
    async (context?: { newPhieuId?: string }) => {
      if (context?.newPhieuId) {
        navigateToDetail(context.newPhieuId, "/taotieuhaolothoi");
        return;
      }
      await loadData();
    },
    [loadData, navigateToDetail]
  );

  const actionButtons = useMemo(() => {
    if (!data || !idphieu) return null;
    const userInfo = getUserInfo();
    if (getBmQuyenUiFlags(config.code, userInfo).isView) return null;
    const buttons = phieuActionService.getActionButtons({
      phieuId: idphieu,
      tinhTrang: data.tinhTrang ?? 0,
      isClone: data.isClone ?? false,
      currentUserId: userInfo.iD_TaiKhoan ?? null,
      currentUserPhongBanId: userInfo.iD_PhongBan ?? null,
      currentUserTenNgan: userInfo.tenNgan ?? null,
      nguoiTaoId: data.nguoiTaoId ?? null,
      phieuPhongBanId: data.idphongBan ?? null,
      pheDuyet: data.pheDuyet ?? [],
      preConfirmCheck: async () => {
        const { ok, negativePhuLieus } = await hrc1TableService.checkNoNegativeThongKe(
          dayjs(formData?.NgaySX).format("YYYY-MM-DD"), formData?.ca, "BOF"
        );
        if (!ok) {
          message.error(`Thống kê phụ liệu ${negativePhuLieus.join(", ")} đang âm (phân bổ chênh lệch âm vượt quá lượng thực tế đã dùng). Vui lòng kiểm tra lại trước khi chốt.`);
          return false;
        }
        return true;
      },
      redirectToList,
      onSuccess: handleActionSuccess,
      onError: (error) => {
        console.error("Action error:", error);
        message.error((error as any)?.message ?? "Không thể thực hiện thao tác");
      },
    });

    // ExportExcel nằm trong DETAIL_HIDDEN_BUTTON_KEYS (dùng chung cho mọi trang Chi tiết) — HRC1_BB_
    // TieuHao_BOF/LF giờ đã có HRC1ExportBienBanButtons riêng (xem return bên dưới) nên không cần giữ
    // ngoại lệ hiện ExportExcel ở đây nữa, mirror HRC2 ChiTietBOF.tsx.
    const filteredButtons = buttons.filter((btn) => !DETAIL_HIDDEN_BUTTON_KEYS.has(btn.key));
    if (filteredButtons.length === 0) return null;
    return phieuActionService.renderActionButtons(filteredButtons, idphieu || "");
  }, [data, idphieu, config.code, getUserInfo, handleActionSuccess, redirectToList, formData?.NgaySX, formData?.ca]);

  return (
    <Card bordered style={{ padding: 24, background: "#fff" }} loading={loading}>
      {idphieu && (
        <HRC1ExportBienBanButtons
          templateCode={config.code}
          bieuMau={config.loaiBm}
          idPhieu={idphieu}
          soPhieu={data?.soPhieu}
          ngaySX={formData?.NgaySX}
          ca={formData?.ca ?? null}
          scope={formData?.scope ?? null}
          containerStyle={{ marginBottom: 8 }}
        />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <img src={logoHP} alt="logo" style={{ height: "auto", width: 220 }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Button type="primary" icon={<ReloadOutlined />} onClick={() => void loadData()} loading={loading}>
              Làm mới
            </Button>
            {actionButtons}
          </div>
          {config.isoInfo && (
            <div style={{ fontSize: 13, textAlign: "right", lineHeight: "20px" }}>
              <div><b>{config.isoInfo.code}</b></div>
              <div>Ngày hiệu lực: {config.isoInfo.effectiveDate}</div>
              <div>Lần sửa đổi: {config.isoInfo.revision}</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <Title level={4} style={{ marginBottom: 0 }}>{config.title}</Title>
        {idphieu && <b>Số phiếu: {data?.soPhieu}</b>}
      </div>
      <Descriptions bordered size="small" column={2}>
        <Descriptions.Item label="Số phiếu">{data?.soPhieu || ""}</Descriptions.Item>
        <Descriptions.Item label="Ngày SX">
          {formData?.NgaySX ? dayjs(formData.NgaySX).format("DD/MM/YYYY") : ""}
        </Descriptions.Item>
        <Descriptions.Item label="Ca sản xuất">{formData?.ca == 1 ? "Ca ngày" : "Ca đêm"}</Descriptions.Item>
        <Descriptions.Item label="Lò thổi">{"Lò thổi " + formData?.scope || ""}</Descriptions.Item>
      </Descriptions>

      <Table
        bordered
        columns={tableColumns}
        dataSource={table1DisplayRows?.map((r: any, i: number) => ({ key: i, stt: i + 1, ...r }))}
        pagination={false}
        size="small"
        scroll={{ x: "max-content" }}
        sticky={{ offsetHeader: 0 }}
        summary={() => {
          const hasSumColumn = leafColumns.some((c) => c.sum);
          if (!hasSumColumn) return null;
          const tongLabelIndex = (() => {
            const i = leafColumns.findIndex((c) => !isSttDataIndex(c.dataIndex));
            return i < 0 ? 0 : i;
          })();
          return (
            <Table.Summary fixed>
              <Table.Summary.Row>
                {leafColumns.map(({ dataIndex, sum, align }, idx) => (
                  <Table.Summary.Cell key={dataIndex} index={idx} align={(align as "left" | "center" | "right") ?? "right"}>
                    {idx === tongLabelIndex ? (
                      <strong>Tổng</strong>
                    ) : sum && columnSums[dataIndex] !== undefined ? (
                      <strong>{formatSum(columnSums[dataIndex])}</strong>
                    ) : null}
                  </Table.Summary.Cell>
                ))}
              </Table.Summary.Row>
            </Table.Summary>
          );
        }}
      />
      {formData?.table1_lyDo && (
        <div style={{ marginTop: 12, display: "flex", alignItems: "flex-start", gap: 8 }}>
          <span style={{ whiteSpace: "nowrap", fontWeight: 500, paddingTop: 4 }}>
            {(tableSection as any)?.lyDo?.label ?? "Lý do điều chỉnh"}:
          </span>
          <span style={{ paddingTop: 4 }}>{formData.table1_lyDo}</span>
        </div>
      )}
      {table2Data && table2Data.length > 0 && (
        <Table
          bordered
          style={{ marginTop: 16 }}
          columns={columns2}
          dataSource={table2Data?.map((r: any, i: number) => ({ key: i, stt: i + 1, ...r }))}
          pagination={false}
          size="small"
        />
      )}
      <Row justify="space-around" align="top" style={{ textAlign: "center", marginTop: 30 }}>
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
      </Row>
    </Card>
  );
};

export default ChiTietTieuHaoLoThoi_BOF;
