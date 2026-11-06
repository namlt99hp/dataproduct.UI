/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { HRCChildColumn, HRCParentColumn } from "../../../components/CustomTableHRC";
import {
  hrc1TableService,
  type AdjustColumnMeta,
  type DynamicColumnMeta,
} from "../../../services/HRC1TableService";
import { hrc1LFPhuLieuService } from "../../../services/HRC1LFPhuLieuService";
import { Button, Card, Descriptions, Table, Typography, Row, Col, message } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { formatNumberGroup } from "../../../utils/formatters/numberFormat";
import { usePhieuNavigation } from "../../../hooks/usePhieuNavigation";
import { PhieuApi } from "../../../services/PhieuApi";
import HRC1_BB_TieuHao_LF from "../../../utils/BM_config/HRC1_BB_TieuHao_LF.json";
import { getBmQuyenUiFlags } from "../../../utils/helpers/checkAdminRole";
import { phieuActionService } from "../../../services/PhieuActionService";
import { DETAIL_HIDDEN_BUTTON_KEYS } from "../../../utils/constants/PhieuActionButtonKeys";
import logoHP from "../../../assets/images/LogoPDF.png";
import HRC1ExportBienBanButtons from "../../../components/HRC1ExportBienBanButtons";

const { Title, Text } = Typography;

function isTrungMeRow(record: any): boolean {
  return record?.isTrungMeThoi === true || record?.IsTrungMeThoi === true;
}

// Khớp đúng logic buildMeSortKey/sortedRows trong CustomTableHRC.tsx (cho maBm HRC1_BB_TieuHao_LF):
// sắp theo thoiGianLF (giờ thực tế mẻ vào LF) thay vì meThoi (chỉ là số hiệu, không phản ánh đúng thứ
// tự thời gian) — ca đêm (ca=2) mà thoiGianLF < 20:00 nghĩa là đã sang ngày hôm sau, phải cộng thêm 1
// ngày khi ghép key để không bị xếp sai lên đầu.
function buildMeSortKeyLF(
  thoiGian: string | null | undefined,
  ca: number | null | undefined,
  ngaySX: string | Date | null | undefined
): string {
  if (!thoiGian || !ngaySX) return "9999-12-31 99:99";
  const isNextDay = ca === 2 && thoiGian < "20:00";
  const date = isNextDay
    ? dayjs(ngaySX).add(1, "day").format("YYYY-MM-DD")
    : dayjs(ngaySX).format("YYYY-MM-DD");
  return `${date} ${thoiGian}`;
}

function sortRowsByThoiGianLF(
  rows: any[],
  ca: number | null | undefined,
  ngaySX: string | Date | null | undefined
): any[] {
  return [...rows].sort((a, b) =>
    buildMeSortKeyLF(a?.thoiGianLF, ca, ngaySX).localeCompare(buildMeSortKeyLF(b?.thoiGianLF, ca, ngaySX))
  );
}

// Merge giá trị các cột "phụ liệu thêm tay" (table1DynamicColumns.adjust) vào rows đang hiển thị —
// khớp theo rowId (id mẻ) trước, fallback theo meThoi. Cần thiết vì LF không có API live nào trả
// ngược các cột "thêm tay" (khác BOF), snapshot đã lưu là nguồn duy nhất để biết cột nào tồn tại.
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

// Cột "Phân bổ" (phanBo_*) có thể không còn trong dynAdjust (chỉ lưu phần isManuallyAdded khi Lưu
// phiếu — xem TaoTieuHaoTinhLuyenLF.tsx) — suy ra trực tiếp từ key của row khi phải fallback về
// snapshot (không gọi được live). Mirror inferPhanBoMetasFromRows ở ChiTietBOF.tsx (HRC1).
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

const ChiTietTieuHaoTinhLuyenLF = () => {
  const { idphieu, navigateToDetail, safeGetDetail, redirectToList } = usePhieuNavigation(
    "phieu_hrc1_lf_id",
    "/viecdentoi/hrc1_tieuhaotinhluyenlf"
  );

  const config = HRC1_BB_TieuHao_LF;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  // Dữ liệu Tiêu hao LF hiện tại (live) khớp Ngày/Ca/Tinh luyện của phiếu — khác snapshot jsonData.table1
  // (chỉ là ảnh chụp lúc Lưu). LF có thể bị mất/thêm dòng sau đó do liên kết 1 chiều từ BBGN_ThepLong
  // (TL nhận/hủy nhận mẻ), nên trang xem chi tiết PHẢI đọc lại dữ liệu sống mỗi lần load/Làm mới —
  // nếu chỉ đọc snapshot sẽ hiển thị nhầm mẻ đã bị hủy nhận (đã xóa khỏi Hrc1TieuHao) là còn tồn tại.
  const [table1DisplayRows, setTable1DisplayRows] = useState<any[]>([]);
  const [livePhuGiaColumns, setLivePhuGiaColumns] = useState<HRCChildColumn[] | null>(null);
  // Cột "Phân bổ" (phanBo_*) lấy từ live fetch — KHÔNG được lưu vào snapshot table1DynamicColumns.adjust
  // (xem TaoTieuHaoTinhLuyenLF.tsx: chỉ lưu phần isManuallyAdded), nên phải tách riêng khỏi adjustMetas.
  const [livePhanBoColumns, setLivePhanBoColumns] = useState<HRCChildColumn[] | null>(null);
  // Cột "phụ liệu thêm tay" (Hrc1PhuLieuNm mới tạo, chưa được admin cấu hình ThuTu_Excel_LF) — LF
  // không có API live nào trả lại các cột này (khác BOF), nên phải phục hồi từ snapshot đã lưu
  // (jsonData.table1DynamicColumns.adjust) mỗi lần load, kể cả khi phần còn lại của bảng đọc live.
  const [adjustMetas, setAdjustMetas] = useState<AdjustColumnMeta[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setTable1DisplayRows([]);
      setLivePhuGiaColumns(null);
      setLivePhanBoColumns(null);
      setAdjustMetas([]);
      if (!idphieu) return;
      const res = await safeGetDetail(() => PhieuApi.getDetail(idphieu));
      if (!res) return;
      const payload = (res as any)?.data ?? res;
      setData(payload);

      const fd = payload?.jsonData || {};
      const savedRows = fd.table1 || [];
      const dynAdjust = fd.table1DynamicColumns?.adjust as
        | (DynamicColumnMeta & {
            values?: Array<{ rowId?: number | null; meThoi?: string | null; value?: string | number | null }>;
          })[]
        | undefined;
      const adjustMetasFromSaved = dynAdjust?.length
        ? hrc1TableService.dedupeAdjustMetas(hrc1TableService.adjustMetaFromDynamic(dynAdjust))
        : [];
      setAdjustMetas(adjustMetasFromSaved);

      const ngay = fd.NgaySX;
      const ca = fd.ca;
      const scope = fd.scope;
      if (!ngay || ca == null || scope == null) {
        setTable1DisplayRows(
          hrc1TableService.sortRowsByMeThoi(mergeAdjustColumnValuesIntoRows(savedRows, dynAdjust))
        );
        return;
      }

      try {
        const tableLayout = config.layout.find((l: any) => l.sectionType === "table" && l.key === "table1");
        const baseColumns = (tableLayout?.columns || []) as any[];
        const result = await hrc1LFPhuLieuService.fetchAndProcessPhuLieus(
          { NgaySX: dayjs(ngay).format("YYYY-MM-DD"), Ca: Number(ca), Scope: Number(scope) },
          { baseColumns }
        );

        // Live trả rỗng (mọi mẻ đã bị hủy nhận/xóa) LÀ trạng thái thật, không phải lỗi — phải hiển thị
        // đúng là rỗng, KHÔNG fallback về snapshot cũ (nếu không sẽ hiện lại mẻ đã xóa, đúng bug đã gặp).
        // Chỉ fallback về snapshot khi bản thân lệnh gọi live thất bại (lỗi mạng/API — xem catch bên dưới).
        const liveRows = (result.tableData || []).filter((r) => r?.key !== "row-empty");
        setTable1DisplayRows(
          sortRowsByThoiGianLF(mergeAdjustColumnValuesIntoRows(liveRows, dynAdjust), ca, ngay)
        );
        setLivePhuGiaColumns(result.phuGiaColumns);
        setLivePhanBoColumns(result.phanBoColumns ?? []);
      } catch (liveErr) {
        console.error("Lỗi tải dữ liệu Tiêu hao LF hiện tại (live):", liveErr);
        setTable1DisplayRows(
          sortRowsByThoiGianLF(mergeAdjustColumnValuesIntoRows(savedRows, dynAdjust), ca, ngay)
        );
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
    const savedPhuGiaCols = dyn.LF_PhuGia;

    // Ưu tiên snapshot LF_PhuGia đã lưu (đúng bộ + thứ tự phụ liệu tại thời điểm lưu phiếu) — KHÔNG dùng
    // danh mục live hiện tại (livePhuGiaColumns, luôn lọc theo dangSuDung:true của danh mục HRC1_PhuLieuNM
    // hiện tại), tránh mất/lệch cột khi danh mục đổi sau này (tắt DangSuDung, đổi ThuTu_Excel_LF, bớt/thêm
    // phụ liệu...). Chỉ fallback về live cho phiếu cũ lưu trước khi có snapshot này.
    let phuGiaCols: HRCChildColumn[];
    if (savedPhuGiaCols?.length) {
      phuGiaCols = hrc1TableService.columnsFromMeta(savedPhuGiaCols, renderDynamicColumnTitle);
    } else if (livePhuGiaColumns) {
      phuGiaCols = livePhuGiaColumns;
    } else {
      phuGiaCols = [];
    }

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

    const adjustChildColumns: HRCChildColumn[] = adjustMetas.map((meta) => ({
      title: meta.headerKeyLabel ?? "Phụ liệu",
      dataIndex: meta.dataIndex,
      width: meta.width ?? 150,
      format: "number-group",
      editable: false,
      variant: "adjust" as const,
      metaLabel: meta.headerKeyLabel ?? "Phụ liệu",
      headerKeyId: meta.headerKeyId ?? null,
      sum: true,
    }));

    // Cột "Phân bổ" (phanBo_*) — tách riêng khỏi phụ liệu đo thật, mirror ChiTietBOF.tsx (HRC1)/
    // các màn HRC2. Ưu tiên live (luôn tính lại mới nhất mỗi lần load); fallback suy ra từ key của
    // row đang hiển thị khi phiếu chưa có Ngày/Ca/Scope để gọi live (xem nhánh fallback trong loadData).
    const phanBoMetas: AdjustColumnMeta[] = livePhanBoColumns?.length
      ? livePhanBoColumns.map((col) => ({
          key: col.dataIndex,
          dataIndex: col.dataIndex,
          headerKeyId: col.headerKeyId ?? null,
          headerKeyLabel: col.metaLabel || (typeof col.title === "string" ? col.title : undefined),
          width: col.width,
          isManuallyAdded: false,
        }))
      : inferPhanBoMetasFromRows(table1DisplayRows);

    const phanBoChildColumns: HRCChildColumn[] = phanBoMetas.map((meta) => ({
      title: meta.headerKeyLabel ?? "Phân bổ",
      dataIndex: meta.dataIndex,
      width: meta.width ?? 100,
      editable: false,
      variant: "adjust" as const,
      metaLabel: meta.headerKeyLabel ?? "Phân bổ",
      headerKeyId: meta.headerKeyId ?? null,
      sum: true,
    }));

    const built = hrc1TableService.buildColumnsWithAdjust({
      baseColumns,
      slotColumns: { LF_PhuGia: phuGiaCols },
      showAdjustColumns: adjustChildColumns.length > 0,
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
          const displayed = baseRender ? baseRender(value) : value !== undefined && value !== null ? String(value) : "";
          if (isDuplicateMe) return <span style={{ color: "red", fontWeight: 600 }}>{displayed}</span>;
          return displayed;
        },
      };
    };

    const mapColumnsWithHighlight = (cols: any[]): any[] =>
      cols.map((col) => {
        if (col.children?.length) {
          return { ...col, children: mapColumnsWithHighlight(col.children) };
        }
        return applyHighlightRender(col);
      });

    return mapColumnsWithHighlight(built as any[]);
  }, [
    formData?.table1DynamicColumns,
    livePhuGiaColumns,
    livePhanBoColumns,
    table1DisplayRows,
    adjustMetas,
    renderDynamicColumnTitle,
    config.layout,
  ]);

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
        navigateToDetail(context.newPhieuId, "/hrc1_taotieuhaotinhluyenlf");
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
          dayjs(formData?.NgaySX).format("YYYY-MM-DD"), formData?.ca, "LF"
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
    // ngoại lệ hiện ExportExcel ở đây nữa, mirror HRC2 ChiTietBOF.tsx / HRC1 ChiTietBOF.tsx.
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
        <Descriptions.Item label="Tinh luyện">{"Tinh luyện " + formData?.scope || ""}</Descriptions.Item>
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

export default ChiTietTieuHaoTinhLuyenLF;
