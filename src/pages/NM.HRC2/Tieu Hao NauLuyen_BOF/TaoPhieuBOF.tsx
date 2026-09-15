/* eslint-disable @typescript-eslint/no-explicit-any */
import HRC2_BB_NauLuyen_BOF from "../../../utils/BM_config/HRC2_BB_NauLuyen_BOF.json";
import { Button, Card, Form, Input, Typography, message } from "antd";
import { FilterOutlined, EyeOutlined, EyeInvisibleOutlined, PlusOutlined, CloseOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import CustomFormItem from "../../../components/CustomFormItem";
import { PhieuApi } from "../../../services/PhieuApi";
import { usePhieuNavigation } from "../../../hooks/usePhieuNavigation";
import CustomTableHRC from "../../../components/CustomTableHRC";
import type { HRCChildColumn, HRCTableRow, HRCParentColumn, CustomTableHRCHandle } from "../../../components/CustomTableHRC";
import CustomFormTable from "../../../components/CustomFormTable";
import { hrc2PhuLieuService } from "../../../services/HRC2PhuLieuService";
import HRC2ExportBienBanButtons from "../../../components/HRC2ExportBienBanButtons";
import {
  hrc2TableService,
  type DynamicColumnMeta,
  type AdjustColumnMeta,
} from "../../../services/HRC2TableService";
import HeaderMappingModal from "../../../components/HeaderMapping";
import HeaderKeyAutocomplete from "../../../components/HeaderKeyAutocomplete";
import type { HeaderKey } from "../../../models/HeaderKeyModel";
import type { HeaderMappingRecord } from "../../../components/HeaderMapping";
import { phieuActionService, type PheDuyetItem } from "../../../services/PhieuActionService";
import { TrangThaiPhieuConst } from "../../../utils/constants/TrangThaiPhieuConstant";

/**
 * Ghi giá trị các cột "Thêm cột điều chỉnh" (manual_col_*, lưu riêng ở
 * table1DynamicColumns.adjust[].values vì sanitizeRowsBeforeSubmit đã xoá field này
 * khỏi table1[] trước khi lưu) trở lại vào từng dòng khi khôi phục phiếu.
 * Đồng thời set cờ `${dataIndex}__IsManual = true` giống lúc user sửa tay trên UI
 * (xem CustomTableHRC) để applyManualOverrides giữ được giá trị này khi merge lại
 * với dữ liệu NM mới nhất ở loadFromNM() — nếu không, giá trị bị mất ngay khi
 * dữ liệu NM (không có field manual_col_*) ghi đè lên.
 */
function mergeAdjustColumnValuesIntoRows(
  rows: HRCTableRow[],
  adjustMetas:
    | (DynamicColumnMeta & {
        values?: Array<{
          rowId?: number | null;
          meThoi?: string | null;
          value?: string | number | null;
        }>;
      })[]
    | undefined
): HRCTableRow[] {
  if (!rows?.length || !adjustMetas?.length) return rows || [];
  const list = rows.map((r) => ({ ...r }));
  adjustMetas.forEach((meta) => {
    const values = meta.values;
    if (!values?.length || !meta.dataIndex) return;
    values.forEach((v) => {
      const row = list.find(
        (r) =>
          (v.rowId != null && r.id === v.rowId) ||
          (v.meThoi != null && r.meThoi === v.meThoi)
      );
      if (row) {
        (row as Record<string, unknown>)[meta.dataIndex] = v.value;
        (row as Record<string, unknown>)[`${meta.dataIndex}__IsManual`] = true;
      }
    });
  });
  return list;
}

const TaoPhieuTieuHaoNauLuyen_BOF = () => {
  const { idphieu, navigateToDetail, safeGetDetail, redirectToList } = usePhieuNavigation(
    "phieu_bof_id",
    "/tieuhaonauluyen_bof"
  );
  const hasExistingPhieu = Boolean(idphieu);
  const config = HRC2_BB_NauLuyen_BOF;
  const [form] = Form.useForm();

  const table1Ref = useRef<CustomTableHRCHandle>(null);
  const [tableData, setTableData] = useState<HRCTableRow[]>([]);
  const [table2Data, setTable2Data] = useState<HRCTableRow[]>([]);
  const [table1LyDo, setTable1LyDo] = useState("");
  const [phuGiaColumns, setPhuGiaColumns] = useState<HRCChildColumn[]>([]); // Phụ liệu loại PG (Phụ gia và chất khử oxy)
  const [khacColumns, setKhacColumns] = useState<HRCChildColumn[]>([]); // Phụ liệu chưa mapped → render vào "Khác"
  const [adjustColumnMetas, setAdjustColumnMetas] = useState<AdjustColumnMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [soPhieu, setSoPhieu] = useState("");
  const [mappingModalVisible, setMappingModalVisible] = useState(false);
  const [mappingRecord, setMappingRecord] = useState<HeaderMappingRecord | null>(null);
  const [showAdjustColumns, setShowAdjustColumns] = useState(false);
  // State để lưu thông tin phiếu cho action buttons
  const [phieuInfo, setPhieuInfo] = useState<{
    tinhTrang?: number;
    nguoiTaoId?: number | null;
    idphongBan?: number | null;
    pheDuyet?: PheDuyetItem[];
    isClone?: boolean;
  }>({});
  // Theo dõi thay đổi trên các field chính
  const ngaySX = Form.useWatch("NgaySX", form);
  const ca = Form.useWatch("ca", form);
  const scope = Form.useWatch("scope", form);
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

  // Thêm cột điều chỉnh mới — header sẽ là autocomplete chọn HeaderKey
  const addAdjustColumn = useCallback(() => {
    const dataIndex = `manual_col_${Date.now()}`;
    setAdjustColumnMetas((prev) => [
      ...prev,
      {
        key: dataIndex,
        dataIndex,
        headerKeyId: null,
        headerKeyLabel: null,
        width: 150,
        isManuallyAdded: true,
      },
    ]);
    setShowAdjustColumns(true);
  }, []);

  const handleRemoveAdjustColumn = useCallback((dataIndex: string) => {
    setAdjustColumnMetas((prev) => prev.filter((m) => m.dataIndex !== dataIndex));
    setTableData((prev) => prev.map((row) => hrc2TableService.removeRowColumnKey(row, dataIndex)));
  }, []);

  // Cập nhật headerKeyId, label và dataIndex (manual_col_{ID_HeaderKey}) khi user chọn header key
  const handleColumnHeaderChange = useCallback(
    (oldDataIndex: string, opt: HeaderKey | null) => {
      const headerKeyId = opt?.id ?? null;
      const headerLabel = opt?.tenHienThi ?? null;

      // Không có header được chọn → chỉ clear meta, không đổi dataIndex
      if (!headerKeyId) {
        setAdjustColumnMetas((prev) =>
          prev.map((m) =>
            m.dataIndex === oldDataIndex
              ? { ...m, headerKeyId: null, headerKeyLabel: null }
              : m
          )
        );
        return;
      }

      const newDataIndex = `manual_col_${headerKeyId}`;

      // 1) Cập nhật meta: dataIndex = manual_col_{ID_HeaderKey}
      setAdjustColumnMetas((prev) =>
        prev.map((m) =>
          m.dataIndex === oldDataIndex
            ? {
                ...m,
                key: newDataIndex,
                dataIndex: newDataIndex,
                headerKeyId,
                headerKeyLabel: headerLabel,
              }
            : m
        )
      );

      // 2) Đổi key trong tableData nếu cột đã có dữ liệu tạm trước đó
      setTableData((prev) =>
        prev.map((row) => {
          if (!(oldDataIndex in row)) return row;
          const next: HRCTableRow = { ...row };
          next[newDataIndex] = row[oldDataIndex];

          const oldOrigKey = `${oldDataIndex}__orig`;
          const newOrigKey = `${newDataIndex}__orig`;
          if (oldOrigKey in row) {
            (next as any)[newOrigKey] = (row as any)[oldOrigKey];
          }

          const oldManualFlagKey = `${oldDataIndex}__IsManual`;
          const newManualFlagKey = `${newDataIndex}__IsManual`;
          if (oldManualFlagKey in row) {
            (next as any)[newManualFlagKey] = (row as any)[oldManualFlagKey];
          }

          // Xoá key cũ sau khi copy
          delete (next as any)[oldDataIndex];
          delete (next as any)[oldOrigKey];
          delete (next as any)[oldManualFlagKey];

          return next;
        })
      );
    },
    []
  );

  const openMappingModalWithRecord = useCallback((record: HeaderMappingRecord) => {
    setMappingRecord({
      idPhuLieu: record.idPhuLieu ?? null,
      tenPhuLieu: record.tenPhuLieu ?? record.tenNguonDuLieu ?? "",
      tenNguonDuLieu: record.tenNguonDuLieu ?? record.tenPhuLieu ?? "",
      idHeaderKey: record.idHeaderKey ?? null,
      mappingId: record.mappingId ?? null,
      headerKeyName: record.headerKeyName ?? undefined,
    });
    setMappingModalVisible(true);
  }, []);

  // Render title cho các cột động (dùng khi restore từ jsonData.table1DynamicColumns)
  const renderDynamicColumnTitle = useCallback(
    (label: string, meta?: DynamicColumnMeta) => {
      const handleOpenMapping = () => {
        if (meta?.mappingPayload) {
          openMappingModalWithRecord(meta.mappingPayload);
        } else {
          const payload: HeaderMappingRecord = {
            idPhuLieu: null,
            tenPhuLieu: label,
            tenNguonDuLieu: label,
            idHeaderKey: null,
            mappingId: null,
          };
          openMappingModalWithRecord(payload);
        }
      };

      return (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span>{label}</span>
          {meta?.allowMapping && (
            <Button size="small" type="link" onClick={handleOpenMapping}>
              Map
            </Button>
          )}
        </div>
      );
    },
    [openMappingModalWithRecord]
  );

  // Cột phân bổ (phanBo_*) — tên phụ liệu, không editable, group header "Phân bổ" do buildColumnsWithAdjust render
  const phanBoChildColumns = useMemo<HRCChildColumn[]>(() => {
    return adjustColumnMetas
      .filter((meta) => meta.dataIndex.startsWith("phanBo_"))
      .map((meta) => ({
        title: meta.headerKeyLabel ?? "Phân bổ",
        dataIndex: meta.dataIndex,
        width: meta.width ?? 100,
        editable: false,
        variant: "adjust" as const,
        metaLabel: meta.headerKeyLabel ?? "Phân bổ",
        headerKeyId: meta.headerKeyId ?? null,
      }));
  }, [adjustColumnMetas]);

  // Cột điều chỉnh tay (manual_col_*) — autocomplete + nút xoá
  const adjustChildColumns = useMemo<HRCChildColumn[]>(() => {
    return adjustColumnMetas
      .filter((meta) => !meta.dataIndex.startsWith("phanBo_"))
      .map((meta) => ({
        title: meta.isManuallyAdded && !isFormLocked ? (
          <div style={{ position: "relative", minWidth: 140, paddingRight: 18 }}>
            <HeaderKeyAutocomplete
              value={meta.headerKeyId ?? null}
              defaultLabel={meta.headerKeyLabel ?? undefined}
              onSelectOption={(opt) => handleColumnHeaderChange(meta.dataIndex, opt)}
              size="small"
              placeholder="Chọn header key..."
              style={{ minWidth: 120 }}
              allowClear={false}
              allowCreateFromSearch
              loaiPhieu={config.code}
            />
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined />}
              onClick={() => handleRemoveAdjustColumn(meta.dataIndex)}
              style={{ position: "absolute", top: -6, right: -6, padding: 0, width: 18, height: 18 }}
            />
          </div>
        ) : (meta.headerKeyLabel ?? "Điều chỉnh"),
        dataIndex: meta.dataIndex,
        width: meta.width ?? 150,
        editable: meta.isManuallyAdded && !isFormLocked ? true : false,
        variant: meta.isManuallyAdded ? undefined : ("adjust" as const),
        metaLabel: meta.headerKeyLabel ?? "Điều chỉnh",
        headerKeyId: meta.headerKeyId ?? null,
      }));
  }, [adjustColumnMetas, config.code, handleColumnHeaderChange, handleRemoveAdjustColumn, isFormLocked]);

  const fetchPhuLieus = useCallback(async (params: { NgaySX?: string | null; Ca?: number | null; Scope?: number | null }) => {
    try {
      setLoading(true);
      
      // Lấy base columns từ config và chuẩn hóa align (JSON trả về string, cần "left"|"center"|"right")
      const alignType = (a: unknown): "left" | "center" | "right" | undefined =>
        a === "left" || a === "center" || a === "right" ? a : undefined;
      const rawBase = config.layout.find(
        (l) => l.sectionType === "table" && l.key === "table1"
      )?.columns || [];
      const baseColumns: HRCParentColumn[] = rawBase.map((col: any) => {
        if (Array.isArray(col.children)) {
          return {
            ...col,
            align: alignType(col.align),
            children: col.children.map((c: any) => ({
              ...c,
              align: alignType(c.align),
            })),
          };
        }
        return { ...col, align: alignType(col.align) };
      });

      // Xác định các field editable (theo config JSON) để preserve giá trị từ getDetail
      const editableFieldSet = new Set<string>();
      baseColumns.forEach((col: any) => {
        // Cột cha không có children
        if (col.dataIndex && !col.children && col.isLabel !== true) {
          const editable = col.editable !== false;
          if (editable) editableFieldSet.add(col.dataIndex);
        }

        // Cột con
        if (Array.isArray(col.children)) {
          col.children.forEach((child: any) => {
            if (!child.dataIndex) return;
            const editableParent = col.editable !== false;
            const editableChild = child.editable !== false;
            if (editableParent && editableChild) {
              editableFieldSet.add(child.dataIndex);
            }
          });
        }
      });
      const editableFields = Array.from(editableFieldSet);

      // Gọi service để xử lý dữ liệu phụ liệu
      const result = await hrc2PhuLieuService.fetchAndProcessPhuLieus(
        {
          NgaySX: params.NgaySX,
          Ca: params.Ca,
          LoaiBM: "BOF",
          Scope: params.Scope,
        },
        {
          onOpenMappingModal: openMappingModalWithRecord,
          baseColumns,
          mergeMappedPhuLieus: true,
        }
      );
      // Kiểm tra nếu không có dữ liệu (bao gồm trường hợp chỉ có item "row-empty")
      const isEmpty = !result.tableData || 
        result.tableData.length === 0 || 
        (result.tableData.length === 1 && result.tableData[0]?.key === "row-empty");
      
      if (isEmpty) {
        message.info("Không có dữ liệu phù hợp với điều kiện lọc.");
        setPhuGiaColumns([]);
        setKhacColumns([]);
        setAdjustColumnMetas([]);
        setTableData([]);
        return;
      }

      // Set columns và table data
      const readonlyPhuGia = (result.phuGiaColumns ?? []).map((col) => ({
        ...col,
        editable: false,
      }));
      const readonlyKhac = (result.khacColumns ?? []).map((col) => ({
        ...col,
        editable: false,
      }));

      setPhuGiaColumns(readonlyPhuGia);
      setKhacColumns(readonlyKhac);

      // Tự động tạo columns từ dữ liệu phân bổ (tách riêng) và cột điều chỉnh tay
      const phanBoMetas = (result.phanBoColumns ?? []).map((col) => ({
        key: col.dataIndex || `phanBo_${col.headerKeyId}`,
        dataIndex: col.dataIndex || `phanBo_${col.headerKeyId}`,
        headerKeyId: col.headerKeyId ?? null,
        headerKeyLabel: col.metaLabel || col.title?.toString() || undefined,
        width: col.width || 100,
      }));
      const manualMetas = (result.adjustColumns ?? []).map((col) => ({
        key: col.dataIndex || `manual_col_${col.headerKeyId}`,
        dataIndex: col.dataIndex || `manual_col_${col.headerKeyId}`,
        headerKeyId: col.headerKeyId ?? null,
        headerKeyLabel: col.metaLabel || col.title?.toString() || undefined,
        width: col.width || 150,
      }));
      const incomingMetas = [...phanBoMetas, ...manualMetas];
      if (incomingMetas.length > 0) {
        setAdjustColumnMetas((prev) => {
          const manual = (prev ?? []).filter((m) => m.isManuallyAdded === true);
          const merged = [...manual];
          const seen = new Set(manual.map((m) => m.dataIndex));
          incomingMetas.forEach((m) => {
            if (!seen.has(m.dataIndex)) merged.push(m);
          });
          return hrc2TableService.dedupeAdjustMetas(merged);
        });
        setShowAdjustColumns(true);
      } else {
        // Không xoá các cột thêm tay khi server không trả adjust columns
        setAdjustColumnMetas((prev) => (prev ?? []).filter((m) => m.isManuallyAdded === true));
      }

      // Merge dữ liệu mới từ server với dữ liệu đang nhập theo meThoi
      // Các field editable (config trong JSON) sẽ được preserve từ dữ liệu getDetail
      setTableData((prev) => {
        // applyManualOverrides phải chạy TRƯỚC mergeServerRows, dùng NM gốc (result.tableData) làm base
        // để so sánh với giá trị đã lưu ở phiếu (prev) — giống ChiTietBOF.tsx.
        // Lý do: nếu mergeServerRows chạy trước, nó sẽ ghi đè các field editable (vd klThepPhe) bằng
        // giá trị đã lưu NGAY TRÊN dòng NM gốc, khiến applyManualOverrides so sánh nhầm
        // serverAuto (đã bị ghi đè = giá trị đã sửa) với manualValue (cũng = giá trị đã sửa) →
        // tưởng "không còn khác nhau" → tắt highlight dù giá trị NM và giá trị đã lưu thực sự khác nhau.
        const rowsWithOverrides = hrc2TableService.applyManualOverrides(
          result.tableData || [],
          prev,
          {
            rowIdField: "id",
            fallbackKeyField: "meThoi",
          }
        );
        return hrc2TableService.mergeServerRows(
          rowsWithOverrides,
          prev,
          "meThoi",
          editableFields
        );
      });
    } catch (error) {
      console.error("Failed to fetch phu lieus:", error);
      message.error("Không thể tải danh sách dữ liệu nhà máy");
    } finally {
      setLoading(false);
    }
  }, [openMappingModalWithRecord, config.layout]);

  const handleMappingCancel = useCallback(() => {
    setMappingModalVisible(false);
    setMappingRecord(null);
  }, []);

  const table1Columns = useMemo(() => {
    const tableLayout = config.layout.find(
      (l) => l.sectionType === "table" && l.key === "table1"
    ) as { columns?: HRCParentColumn[] } | undefined;
    const alignType = (a: unknown): "left" | "center" | "right" | undefined =>
      a === "left" || a === "center" || a === "right" ? a : undefined;
    const normalizeAlign = (cols: any[]): HRCParentColumn[] =>
      cols.map((col) => {
        if (Array.isArray(col.children)) {
          return {
            ...col,
            align: alignType(col.align),
            children: col.children.map((c: any) => ({
              ...c,
              align: alignType(c.align),
            })),
          };
        }
        return { ...col, align: alignType(col.align) };
      });
    const baseColumns: HRCParentColumn[] = tableLayout?.columns
      ? normalizeAlign(tableLayout.columns as any[])
      : [];

    return hrc2TableService.buildColumnsWithAdjust({
      baseColumns,
      slotColumns: {
        BOF_PhuGia: phuGiaColumns,
        others: khacColumns,
      },
      showAdjustColumns,
      manualAdjustColumns: adjustChildColumns,
      phanBoColumns: phanBoChildColumns,
      generateAdjustColumnsFromBase: false,
    });
  }, [config.layout, phuGiaColumns, khacColumns, showAdjustColumns, adjustChildColumns, phanBoChildColumns]);

  // Hàm load dữ liệu NM theo các filter hiện tại (dùng chung cho init, mapping success, button)
  const loadFromNM = useCallback(async () => {
    if (!ngaySX || !ca || !scope) return;

    await fetchPhuLieus({
      NgaySX: dayjs(ngaySX).format("YYYY-MM-DD"),
      Ca: ca,
      Scope: scope,
    });
  }, [ngaySX, ca, scope, fetchPhuLieus]);

  /** Hàm xử lý khi bấm nút Filter */
  const handleFilter = useCallback(() => {
    if (!ngaySX || !ca || !scope) {
      message.warning("Vui lòng điền đầy đủ các thông tin: Ngày SX, Ca, và Scope");
      return;
    }
    loadFromNM();
  }, [ngaySX, ca, scope, loadFromNM]);

  const handleMappingSuccess = useCallback(async () => {
    setMappingModalVisible(false);
    setMappingRecord(null);
    await loadFromNM();
  }, [loadFromNM]);

  // Helper để lấy userInfo
  const getUserInfo = useCallback(() => {
    const stored = localStorage.getItem("userinfo");
    return stored ? JSON.parse(stored) : {};
  }, []);

  // Hàm khởi tạo dữ liệu ban đầu
  const initData = useCallback(async () => {
    // Phiếu đã Chốt: không auto-load lại từ NM (xem finally bên dưới) — chỉ dùng snapshot
    // table1DynamicColumns/table1 đã lưu, tránh "mất" cột phụ liệu nếu sau này ai đó đổi
    // config Excel/ThongKe của Header_Key (phiếu Chốt phải là dữ liệu lịch sử cố định).
    let loadedTinhTrang = TrangThaiPhieuConst.DangLuu;
    try {
      setLoading(true);
      // Gọi API lấy phiếu theo số phiếu
      const idPhieu = idphieu || ""; // Lấy từ state nếu có
      if (idPhieu) {
        const res = await safeGetDetail(() => PhieuApi.getDetail(idPhieu));

        if (res) {
          setSoPhieu((res as any)?.soPhieu);
          // data.Data là phần JSON đã parse (form động)
          const data = (res as any)?.jsonData || {};
          
          // Map pheDuyet vào form fields (giống như TaoPhieuPhoiNong.tsx)
          // Ưu tiên map từ jsonData.pheDuyet (có maKyDuyet), nếu không có thì map từ res.pheDuyet (chỉ có capDuyet)
          const signatureFields: Record<string, any> = {};
          
          // Map từ jsonData.pheDuyet (có maKyDuyet) - đây là dữ liệu mới nhất đã được lưu
          const pheDuyetFromJson = data.pheDuyet || [];
          if (pheDuyetFromJson.length > 0) {
            pheDuyetFromJson.forEach((pd: any) => {
              if (pd.maKyDuyet && pd.nguoiDuyetId) {
                signatureFields[pd.maKyDuyet] = pd.nguoiDuyetId;
              }
            });
          } else {
            // Fallback: map từ res.pheDuyet theo capDuyet (nếu jsonData không có pheDuyet)
            const pheDuyetFromApi = (res as any)?.pheDuyet || [];
            pheDuyetFromApi.forEach((pd: any) => {
              const signature = config.signatures.find(
                (s) => s.capduyet === pd.capDuyet && s.isChon
              );
              if (signature && pd.nguoiDuyetId) {
                signatureFields[signature.key] = pd.nguoiDuyetId;
              }
            });
          }
          
          // Chuyển chuỗi -> dayjs
          const tinhTrang = (res as any)?.tinhTrang ?? 0;
          loadedTinhTrang = tinhTrang;
          const formValues = {
            ...data,
            ...signatureFields, // Merge signature fields vào formValues (override nếu jsonData cũng có)
            idphieu: (res as any)?.idphieu || "",
            NgaySX: data.NgaySX ? dayjs(data.NgaySX, "YYYY-MM-DD") : null,
          };
          form.setFieldsValue(formValues);
          
          // Đồng bộ select cấp duyệt 0 theo đúng luồng:
          // - Nếu server trả về `nguoiTaoId` => set capduyet 0 = `nguoiTaoId`
          // - Nếu server chưa có `nguoiTaoId` và phiếu đang ở trạng thái DangLuu(0) => coi như phiếu tạo tự động => set capduyet 0 = currentUser
          const nguoiTaoIdFromRes = (res as any)?.nguoiTaoId ?? null;
          const hasNguoiTaoIdFromRes =
            nguoiTaoIdFromRes != null && Number(nguoiTaoIdFromRes) > 0;

          const cap0Signatures = config.signatures.filter(
            (s: any) => s.isChon && s.capduyet === 0
          );

          if (cap0Signatures.length > 0) {
            const overrideFields: Record<string, any> = {};
            if (
              tinhTrang === TrangThaiPhieuConst.DangLuu ||
              tinhTrang === TrangThaiPhieuConst.DaThuHoi ||
              tinhTrang === TrangThaiPhieuConst.HieuChinh
            ) {
              // Trạng thái 0/3/7: người đang thao tác là người tạo phiếu
              const currentUserInfo = getUserInfo();
              cap0Signatures.forEach((sig: any) => {
                overrideFields[sig.key] = currentUserInfo?.iD_TaiKhoan ?? null;
              });
            } else if (hasNguoiTaoIdFromRes) {
              cap0Signatures.forEach((sig: any) => {
                overrideFields[sig.key] = nguoiTaoIdFromRes;
              });
            }
            if (Object.keys(overrideFields).length > 0) {
              form.setFieldsValue(overrideFields);
            }
          }

          if (formValues.table1) {
            // Đảm bảo các dòng có flag IsNM
            // Dòng từ server không có IsNM -> mặc định là true (từ NM)
            // Dòng có IsNM = false -> giữ nguyên (thêm tay)
            const table1WithAdjustValues = mergeAdjustColumnValuesIntoRows(
              formValues.table1 as HRCTableRow[],
              (formValues.table1DynamicColumns as any)?.adjust
            );
            const processedTable1 = table1WithAdjustValues.map((row) => ({
              ...row,
              IsNM: row.IsNM !== undefined ? row.IsNM : true, // Mặc định là true nếu không có
            }));
            setTableData(processedTable1);
          } else {
            setTableData([]);
          }

          if (formValues.table2) {
            // Tương tự table1: chuẩn hóa flag IsNM cho bảng tồn (table2)
            const processedTable2 = (formValues.table2 as HRCTableRow[]).map((row) => ({
              ...row,
              IsNM: row.IsNM !== undefined ? row.IsNM : true,
            }));
            setTable2Data(processedTable2);
          } else {
            setTable2Data([]);
          }

          setTable1LyDo(formValues.table1_lyDo || "");
          
          // Khôi phục cấu hình cột động (nếu có) để hiển thị đúng phụ liệu đã lưu
          if (formValues.table1DynamicColumns) {
            const dyn = formValues.table1DynamicColumns as Record<
              string,
              DynamicColumnMeta[]
            >;
            const restored = hrc2TableService.restoreDynamicGroups(
              dyn,
              renderDynamicColumnTitle
            );
            setPhuGiaColumns(restored.BOF_PhuGia ?? []);
            setKhacColumns(restored.others ?? []);
            if (dyn.adjust) {
              setAdjustColumnMetas(
                hrc2TableService.dedupeAdjustMetas(
                  hrc2TableService.adjustMetaFromDynamic(dyn.adjust)
                )
              );
              // Có cột "Thêm cột điều chỉnh" đã lưu → hiện luôn, không chờ user bấm nút
              if (dyn.adjust.length > 0) {
                setShowAdjustColumns(true);
              }
            } else {
              setAdjustColumnMetas([]);
            }
          }


          // Lưu thông tin phiếu cho action buttons
          setPhieuInfo({
            tinhTrang: (res as any)?.tinhTrang ?? 0,
            nguoiTaoId: (res as any)?.nguoiTaoId ?? null,
            idphongBan: (res as any)?.idphongBan ?? null,
            pheDuyet: (res as any)?.pheDuyet || data.pheDuyet || [],
            isClone: (res as any)?.isClone ?? false,
          });

          // message.success("Đã tải dữ liệu phiếu!");
        }
      }
    } catch (err: any) {
      console.error("Lỗi khởi tạo dữ liệu:", err);
      message.error("Không thể tải dữ liệu ban đầu!");
    } finally {
      setLoading(false);
      // Khi vào component, luôn tự động load dữ liệu từ NM (nếu đủ filter) — TRỪ phiếu đã Chốt
      // (dùng snapshot đã restore ở trên, không load lại theo config hiện tại của Header_Key).
      if (loadedTinhTrang !== TrangThaiPhieuConst.DaChot) {
        await loadFromNM();
      }
    }
  }, [form, idphieu, loadFromNM, config.signatures, renderDynamicColumnTitle, getUserInfo, safeGetDetail]);

  /** Gọi khi load lần đầu */
  useEffect(() => {
    initData();
  }, [initData]);

  // Function để lấy formData mới nhất (được gọi mỗi khi click button)
  // actionKey: "save" | "saveAndSend" | ... để phân biệt lưu vs gửi
  const getFormData = useCallback(async (actionKey?: string) => {
    const userInfo = getUserInfo();
    const isSend = actionKey === "saveAndSend" || actionKey === "gui";
    const isCreateNew = !idphieu;
    const headerFieldKeys = config.headerFields.map((f: any) => f.key);
    const signatureKeys = config.signatures.filter((s) => s.isChon).map((s) => s.key);
    const fieldsToValidate = isSend ? [...headerFieldKeys, ...signatureKeys] : headerFieldKeys;
    await form.validateFields(fieldsToValidate);
    if (!(table1Ref.current?.validate() ?? true)) throw new Error("validation");
    const formData = form.getFieldsValue(true);

    const pheDuyetFlow = config.signatures
      .filter((s) => s.isChon)
      .map((s) => ({
        capDuyet: s.capduyet,
        maKyDuyet: s.key,
        nguoiDuyetId: form.getFieldValue(s.key),
        tinhTrang: 0,
        ghiChu: "",
      }));
    
    const hasCreator = config.signatures.find(
      (x) => x.isChon === false && x.capduyet === 1
    );
    if (hasCreator) {
      pheDuyetFlow.unshift({
        capDuyet: 1,
        maKyDuyet: hasCreator?.key || "",
        nguoiDuyetId: userInfo.iD_TaiKhoan ?? null,
        tinhTrang: 1,
        ghiChu: "Người tạo phiếu",
      });
    }

    // Đảm bảo các dòng có flag IsNM được gửi lên
    // Dòng từ NM: IsNM = true (hoặc undefined, mặc định là true)
    // Dòng thêm tay: IsNM = false
    // Giữ nguyên toàn bộ key trong row (kể cả *__orig) để BE nhận đủ phụ liệu manual (IsManual, KLPhuGia_Manual)
    const processedTable1 = hrc2PhuLieuService.sanitizeRowsBeforeSubmit(tableData);

    const dynamicColumnMap = hrc2TableService.buildDynamicColumnMap({
      BOF_PhuGia: phuGiaColumns,
      others: khacColumns,
    });
    // Chỉ lưu meta các cột điều chỉnh do user thêm (isManuallyAdded === true).
    // Các cột phân bổ/điều chỉnh phát sinh từ API (phanBo_*, manual_col_{id} do phân bổ) không lưu vào json phiếu.
    dynamicColumnMap.adjust = hrc2PhuLieuService.buildAdjustDynamicWithValues(
      adjustColumnMetas.filter((m) => m.isManuallyAdded === true),
      tableData
    );

    const processedTable2 = table2Data.map((row) => {
      const processedRow = { ...row };
      if (processedRow.IsNM === undefined) {
        processedRow.IsNM = true;
      }
      delete processedRow._isNewRow;
      return processedRow;
    });

    return {
      ...formData,
      NgaySX: formData.NgaySX ? formData.NgaySX.format("YYYY-MM-DD") : null,
      maBm: config.code,
      prefix: config.prefix,
      // Trạng thái 3/7: người đang thao tác trở thành nguoiTaoId (chuyển quyền sở hữu phiếu).
      // Các trạng thái khác khi đã có phiếu: giữ nguoiTaoId gốc.
      nguoiTaoId: isCreateNew ||
        phieuInfo.tinhTrang === TrangThaiPhieuConst.DaThuHoi ||
        phieuInfo.tinhTrang === TrangThaiPhieuConst.HieuChinh
          ? userInfo.iD_TaiKhoan ?? null
          : phieuInfo.nguoiTaoId ?? null,
      tenScope:  scope ? 'Lò thổi ' + scope : null,
      xuongId: userInfo.iD_PhanXuong ?? null,
      idphongBan: userInfo.iD_PhongBan ?? null,
      table1: processedTable1,
      table1_lyDo: table1LyDo,
      table2: processedTable2,
      table1DynamicColumns: dynamicColumnMap,
      pheDuyet: pheDuyetFlow,
    };
  }, [
    getUserInfo,
    form,
    config.headerFields,
    config.signatures,
    config.code,
    config.prefix,
    idphieu,
    phieuInfo.nguoiTaoId,
    scope,
    phuGiaColumns,
    khacColumns,
    adjustColumnMetas,
    tableData,
    table1LyDo,
    table2Data,
  ]);

  const handleAutoSave = useCallback(async () => {
    if (!idphieu) return;
    try {
      const formData = await getFormData("save");
      await PhieuApi.putData(idphieu, formData);
      message.success("Lưu phiếu thành công!");
      await initData();
    } catch (err) {
      console.error("Auto save error:", err);
      message.error("Không thể tự động lưu phiếu");
    }
  }, [idphieu, getFormData, initData]);

  // Render action buttons từ PhieuActionService
  const handleActionSuccess = useCallback(
    async (context?: { newPhieuId?: string }) => {
      if (context?.newPhieuId) {
        navigateToDetail(context.newPhieuId, "/taophieutieuhaonauluyen_bof");
        return;
      }
      await initData();
    },
    [navigateToDetail, initData]
  );

  const actionButtons = useMemo(() => {
    const userInfo = getUserInfo();
    // const filteredPheDuyet = (phieuInfo.pheDuyet ?? []).filter(
    //   (item) => (item.capDuyet ?? 0) !== 0
    // );
    const buttons = phieuActionService.getActionButtons({
      phieuId: idphieu || "",
      tinhTrang: phieuInfo.tinhTrang ?? 0,
      isClone: phieuInfo.isClone ?? false,
      currentUserId: userInfo.iD_TaiKhoan ?? null,
      currentUserPhongBanId: userInfo.iD_PhongBan ?? null,
      currentUserTenNgan: userInfo.tenNgan ?? null,
      nguoiTaoId: phieuInfo.nguoiTaoId ?? null,
      phieuPhongBanId: phieuInfo.idphongBan ?? null,
      pheDuyet: phieuInfo.pheDuyet ?? [],
      preConfirmCheck: async () => {
        const isChot = await hrc2TableService.checkChotPhieuTieuHao(dayjs(ngaySX).format("YYYY-MM-DD"), ca);
        if (isChot) {
          return true;
        }
        message.error("Sổ theo dõi nhập xuất tồn chưa được chốt.");
        return false;
      },
      redirectToList,
      onSuccess: handleActionSuccess,
      onError: (error) => {
        console.error("Action error:", error);
      },
    });

    if (buttons.length === 0) return null;
    
    return phieuActionService.renderActionButtons(buttons, idphieu || "", getFormData);
  }, [getUserInfo, idphieu, phieuInfo, getFormData, handleActionSuccess, redirectToList]);

  return (
    <>
    {idphieu && (
      <HRC2ExportBienBanButtons
        templateCode={config.code}
        bieuMau={config.loaiBm}
        idPhieu={idphieu}
        soPhieu={soPhieu}
        ngaySX={ngaySX}
        ca={ca}
        scope={scope}
        containerStyle={{ marginBottom: 8 }}
      />
    )}
    <Card style={{ margin: 24, boxShadow: "0 2px 8px #f0f1f2" }}>
      {/* Tiêu đề biên bản */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 12,
        }}
      >

        {/* Tiêu đề trung tâm */}
        <div style={{ flex: 1, textAlign: "center" }}>
          <Typography.Title level={3} style={{ marginBottom: 0 }}>
            {config.title}
          </Typography.Title>
          {idphieu && <b>Số phiếu: {soPhieu}</b>}
        </div>

        {/* ISO góc phải */}
        {config.isoInfo && (
          <div style={{ fontSize: 13, textAlign: "right", lineHeight: "20px" }}>
            <div>
              <b>{config.isoInfo.code}</b>
            </div>
            <div>Ngày hiệu lực: {config.isoInfo.effectiveDate}</div>
            <div>Lần sửa đổi: {config.isoInfo.revision}</div>
          </div>
        )}
      </div>

      <Form form={form} layout="vertical">
        <Form.Item name="idphieu" hidden>
          <Input type="hidden" />
        </Form.Item>
        {/* HEADER - các trường nhập đầu */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
          }}
        >
          {config.headerFields.map((f, idx) => (
            <CustomFormItem
              key={f.key || idx}
              field={f}
              idx={idx}
              disabled={hasExistingPhieu }
            />
          ))}
        </div>
        {/* Nút Filter */}
        <div style={{ marginTop: 16, marginBottom: 16, display: "flex", gap: 8 }}>
          <Button
            type="primary"
            icon={<FilterOutlined />}
            onClick={handleFilter}
            disabled={isFormLocked }
            loading={loading}
          >
            Làm mới dữ liệu
          </Button>
          <Button
            icon={showAdjustColumns ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            onClick={() => setShowAdjustColumns(!showAdjustColumns)}
          >
            {showAdjustColumns ? "Ẩn" : "Hiện"} điều chỉnh số liệu
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={addAdjustColumn}
            disabled={isFormLocked}
          >
            Thêm cột điều chỉnh
          </Button>
        </div>
        {/* TABLE - danh sách phôi */}
        {config.layout.map((layout, idx) => (
          <div key={idx}>
            {layout.sectionType === "table" && layout.key === "table1" ? (
              <>
              <CustomTableHRC
                maBm={config.code}
                ngaySX={ngaySX}
                ca={ca}
                scope={scope}
                bieuMau={"BOF"}
                isHasExistingPhieu={hasExistingPhieu}
                columns={table1Columns}
                initialData={tableData}
                onDataChange={setTableData}
                addRowButtonText="+ Thêm dòng"
                showAddButton={!isFormLocked}
                showDeleteButton={!isFormLocked}
                minRows={1}
                editable={!isFormLocked && (layout as any).editable !== false}
                allowEditMacThepOnNMRow
                loading={loading}
                stickyHeaders
                stickyFirstColumn
                stickyColumnKeys={["meThoi", "macThep"]}
                scrollX="1500px"
                lyDoLabel={(layout as any).lyDo?.label}
                lyDoValue={table1LyDo}
                onLyDoChange={setTable1LyDo}
                onSave={handleAutoSave}
                ref={table1Ref}
              />
              <div style={{ fontWeight: 600, marginTop: 12 }}>
                Phần điều chỉnh số liệu nằm ở cuối bảng (scroll ngang → cột "Điều chỉnh số liệu").
              </div>
              </>
            ) : (
              layout.sectionType === "table" && (
                <CustomFormTable
                  columns={(layout.columns || []) as any}
                  initialData={tableData}
                  onDataChange={(rows) => setTableData(rows as HRCTableRow[])}
                  addRowButtonText="+ Thêm dòng"
                  showAddButton={!isFormLocked}
                  showDeleteButton={!isFormLocked}
                  minRows={1}
                  editable={!isFormLocked && (layout as any).editable !== false}
                  loading={loading}
                />
              )
            )}
          </div>
        ))}
        {config.layout2.map((layout, idx) => (
          <div key={idx}>
            {layout.sectionType === "table" && (
              <CustomFormTable
                columns={(layout.columns || []) as any}
                initialData={table2Data}
                onDataChange={(rows) => setTable2Data(rows as HRCTableRow[])}
                className="w-full overflow-x-auto"
                addRowButtonText="+ Thêm dòng tồn"
                showAddButton={!isFormLocked}
                showDeleteButton={!isFormLocked}
                minRows={0}
                editable={!isFormLocked && (layout as any).editable !== false}
                loading={loading}
                compactWhenEmpty
              />
            )}
          </div>
        ))}

        {/* FOOTER - ghi chú */}
        {/* <div style={{ marginTop: 24 }}>
          <Typography.Text strong>Ghi chú:</Typography.Text>
          <ul>
            {config.footerNotes?.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div> */}

        {/* SIGNATURES - ký tên */}
        <div
          style={{
            marginTop: 40,
            display: "flex",
            justifyContent: "space-around",
            textAlign: "center",
          }}
        >
          {config.signatures
            .filter((x) => x.isChon)
            ?.map((sig, i) => {
              const isLevelZero = sig.capduyet === 0;
              const nguoiTaoIdFromPhiếu = phieuInfo.nguoiTaoId ?? null;
              const hasNguoiTaoIdFromPhiếu =
                nguoiTaoIdFromPhiếu != null && Number(nguoiTaoIdFromPhiếu) > 0;

              const shouldUseCurrentUser =
                isLevelZero &&
                (!idphieu ||
                  currentTinhTrang === TrangThaiPhieuConst.DangLuu ||
                  currentTinhTrang === TrangThaiPhieuConst.DaThuHoi ||
                  currentTinhTrang === TrangThaiPhieuConst.HieuChinh);

              const cap0InitialValue = isLevelZero
                ? shouldUseCurrentUser
                ? getUserInfo()?.iD_TaiKhoan ?? null
                  : hasNguoiTaoIdFromPhiếu
                    ? nguoiTaoIdFromPhiếu
                    : undefined
                : undefined;
              
              return (
                <div key={sig.key || i}>
                  <CustomFormItem
                    maBm={config.code}
                    field={sig}
                    idx={i}
                    disabled={isLevelZero || isSignatureReadonly || isFormLocked}
                    initialValue={cap0InitialValue}
                  />
                </div>
              );
            })}
          
        </div>

      </Form>
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
      <HeaderMappingModal
        open={mappingModalVisible}
        record={mappingRecord}
        onCancel={handleMappingCancel}
        onSuccess={handleMappingSuccess}
      />
    </Card>
    </>
  );
};

export default TaoPhieuTieuHaoNauLuyen_BOF;
