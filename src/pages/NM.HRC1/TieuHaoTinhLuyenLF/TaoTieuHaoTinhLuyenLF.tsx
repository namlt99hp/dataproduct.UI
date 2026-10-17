/* eslint-disable @typescript-eslint/no-explicit-any */
import HRC1_BB_TieuHao_LF from "../../../utils/BM_config/HRC1_BB_TieuHao_LF.json";
import { Button, Card, Form, Input, Typography, message } from "antd";
import { FilterOutlined, PlusOutlined, CloseOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import CustomFormItem from "../../../components/CustomFormItem";
import { PhieuApi } from "../../../services/PhieuApi";
import { usePhieuNavigation } from "../../../hooks/usePhieuNavigation";
import CustomTableHRC from "../../../components/CustomTableHRC";
import type { HRCChildColumn, HRCTableRow, HRCParentColumn, CustomTableHRCHandle } from "../../../components/CustomTableHRC";
import CustomFormTable from "../../../components/CustomFormTable";
import { hrc1LFPhuLieuService } from "../../../services/HRC1LFPhuLieuService";
import { hrc1PhuLieuService } from "../../../services/HRC1PhuLieuService";
import { dlnmHRC1Api } from "../../../services/DLNMHRC1Api";
import {
  hrc1TableService,
  type DynamicColumnMeta,
  type AdjustColumnMeta,
} from "../../../services/HRC1TableService";
import { CommonAutocomplete, type AutocompleteSearchParams } from "../../../components/CommonAutocomplete";
import { Hrc1PhuLieuNmServiceApi, type Hrc1PhuLieuNm } from "../../../services/Hrc1PhuLieuNmServiceApi";
import { hrc1MeThoiMacThepServiceApi } from "../../../services/Hrc1MeThoiMacThepServiceApi";
import { phieuActionService, type PheDuyetItem } from "../../../services/PhieuActionService";
import { TrangThaiPhieuConst } from "../../../utils/constants/TrangThaiPhieuConstant";
import HRC1ExportBienBanButtons from "../../../components/HRC1ExportBienBanButtons";

const TaoTieuHaoTinhLuyenLF = () => {
  const { idphieu, navigateToDetail, safeGetDetail, redirectToList } = usePhieuNavigation(
    "phieu_hrc1_lf_id",
    "/hrc1_tieuhaotinhluyenlf"
  );
  const hasExistingPhieu = Boolean(idphieu);
  const config = HRC1_BB_TieuHao_LF;
  const [form] = Form.useForm();

  const table1Ref = useRef<CustomTableHRCHandle>(null);
  const [tableData, setTableData] = useState<HRCTableRow[]>([]);
  const [table2Data, setTable2Data] = useState<HRCTableRow[]>([]);
  const [table1LyDo, setTable1LyDo] = useState("");
  const [phuGiaColumns, setPhuGiaColumns] = useState<HRCChildColumn[]>([]);
  const [adjustColumnMetas, setAdjustColumnMetas] = useState<AdjustColumnMeta[]>([]);
  // Snapshot cột phụ liệu LF_PhuGia đã lưu (khác null = phiếu đã tồn tại và đã có snapshot) — khi có,
  // fetchPhuLieus KHÔNG được ghi đè phuGiaColumns bằng danh mục live hiện tại, để giữ đúng bộ + thứ tự
  // phụ liệu tại thời điểm lưu (tránh mất/lệch cột khi danh mục HRC1_PhuLieuNM đổi sau này).
  const savedPhuGiaSnapshotRef = useRef<HRCChildColumn[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [soPhieu, setSoPhieu] = useState("");
  const [phieuInfo, setPhieuInfo] = useState<{
    tinhTrang?: number;
    nguoiTaoId?: number | null;
    idphongBan?: number | null;
    pheDuyet?: PheDuyetItem[];
    isClone?: boolean;
  }>({});

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

  // Render title cho cột phụ liệu khi restore từ jsonData.table1DynamicColumns — LF không có nút Map
  // (danh mục HRC1_PhuLieuNM cố định theo BieuMau, không cần Header Mapping như HRC2).
  const renderDynamicColumnTitle = useCallback((label: string) => <span>{label}</span>, []);

  // Thêm cột điều chỉnh mới — header là autocomplete chọn (hoặc TẠO MỚI) 1 phụ liệu trong danh mục
  // HRC1_PhuLieuNM. Khác BOF (hrc1PhuLieuService chỉ hiện cột nào có dữ liệu khác 0 trong ca/lò đang
  // lọc, nên luôn còn phụ liệu "chưa dùng" để autocomplete chọn): ở LF, hrc1LFPhuLieuService luôn lấy
  // TOÀN BỘ danh mục active làm cột mặc định (không lọc theo "đã có dữ liệu") — nghĩa là mọi phụ liệu
  // hiện có ĐỀU đã có cột sẵn, danh sách "chưa dùng" luôn rỗng. Vì vậy allowCreate là bắt buộc: đây là
  // cách DUY NHẤT để thêm 1 phụ liệu MỚI (autocomplete cho gõ tên → POST /api/Hrc1PhuLieuNm). Xoá
  // allowCreate sẽ khiến nút này vô dụng với LF (dropdown luôn rỗng, không có gì để chọn).
  // Khi chọn/tạo xong, dataIndex đổi thành phuLieu_{PhuLieuID} — tái dùng đúng pipeline Loại A (đã có
  // sẵn ở BuildLFPhuLieus, đọc gộp cả nhóm LF_PhuGia lẫn adjust).
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
  }, []);

  const handleRemoveAdjustColumn = useCallback((dataIndex: string) => {
    setAdjustColumnMetas((prev) => prev.filter((m) => m.dataIndex !== dataIndex));
    setTableData((prev) => prev.map((row) => hrc1TableService.removeRowColumnKey(row, dataIndex)));
  }, []);

  const handleColumnHeaderChange = useCallback(
    (oldDataIndex: string, opt: Hrc1PhuLieuNm | null) => {
      const phuLieuId = opt?.id ?? null;
      const phuLieuLabel = opt?.tenPhuLieu ?? null;

      if (!phuLieuId) {
        setAdjustColumnMetas((prev) =>
          prev.map((m) =>
            m.dataIndex === oldDataIndex
              ? { ...m, headerKeyId: null, headerKeyLabel: null }
              : m
          )
        );
        return;
      }

      const newDataIndex = `phuLieu_${phuLieuId}`;

      setAdjustColumnMetas((prev) =>
        prev.map((m) =>
          m.dataIndex === oldDataIndex
            ? { ...m, key: newDataIndex, dataIndex: newDataIndex, headerKeyId: phuLieuId, headerKeyLabel: phuLieuLabel }
            : m
        )
      );

      setTableData((prev) =>
        prev.map((row) => hrc1TableService.renameRowColumnKey(row, oldDataIndex, newDataIndex))
      );
    },
    []
  );

  // Phụ liệu đã có cột hiển thị (danh mục mặc định hoặc cột điều chỉnh khác) — loại khỏi danh sách
  // chọn để tránh trùng dataIndex.
  const usedPhuLieuIds = useMemo(() => {
    const ids = new Set<number>();
    phuGiaColumns.forEach((c) => {
      if (typeof c.headerKeyId === "number") ids.add(c.headerKeyId);
    });
    adjustColumnMetas.forEach((m) => {
      if (m.dataIndex.startsWith("phuLieu_") && typeof m.headerKeyId === "number") ids.add(m.headerKeyId);
    });
    return ids;
  }, [phuGiaColumns, adjustColumnMetas]);

  // Phụ liệu đang được quản lý ở cột "thêm tay" (Điều chỉnh số liệu) — loại khỏi nhóm danh mục mặc
  // định để tránh render 2 cột cho cùng 1 phụ liệu (vd sau khi tạo mới, lần "Làm mới dữ liệu" kế tiếp
  // sẽ thấy phụ liệu đó xuất hiện lại trong danh mục active).
  const manuallyManagedPhuLieuIds = useMemo(() => {
    const ids = new Set<number>();
    adjustColumnMetas.forEach((m) => {
      if (m.isManuallyAdded === true && m.dataIndex.startsWith("phuLieu_") && typeof m.headerKeyId === "number") {
        ids.add(m.headerKeyId);
      }
    });
    return ids;
  }, [adjustColumnMetas]);

  const effectivePhuGiaColumns = useMemo(() => {
    if (manuallyManagedPhuLieuIds.size === 0) return phuGiaColumns;
    return phuGiaColumns.filter(
      (c) => !(typeof c.headerKeyId === "number" && manuallyManagedPhuLieuIds.has(c.headerKeyId))
    );
  }, [phuGiaColumns, manuallyManagedPhuLieuIds]);

  // Cột "Phân bổ" (phanBo_*) — tên phụ liệu, không editable, group header "Phân bổ" do
  // buildColumnsWithAdjust render. Mirror TaoTieuHaoLoThoi.tsx (BOF) — giá trị đến từ record
  // IsPhanBo=true riêng (PhanBoAsync), phải tách khỏi cột phụ liệu đo thật (phuLieu_*).
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
        sum: true,
      }));
  }, [adjustColumnMetas]);

  const adjustChildColumns = useMemo<HRCChildColumn[]>(() => {
    return adjustColumnMetas
      .filter((meta) => !meta.dataIndex.startsWith("phanBo_"))
      .map((meta) => {
      const searchPhuLieu = async (params: AutocompleteSearchParams) => {
        const list = await Hrc1PhuLieuNmServiceApi.getAll({
          dangSuDung: true,
          searchKey: params.searchKey,
        });
        const filtered = list.filter((pl) => pl.id === meta.headerKeyId || !usedPhuLieuIds.has(pl.id));
        return { data: filtered, totalRecords: filtered.length };
      };

      return {
        title: meta.isManuallyAdded ? (
          <div style={{ position: "relative", minWidth: 140, paddingRight: 18 }}>
            <CommonAutocomplete<Hrc1PhuLieuNm>
              value={meta.headerKeyId ?? null}
              onChange={(_value, opt) => handleColumnHeaderChange(meta.dataIndex, opt)}
              searchApi={searchPhuLieu}
              mapOption={(item) => ({ value: item.id, label: item.tenPhuLieu })}
              fallbackLabelBuilder={() => meta.headerKeyLabel ?? "Phụ liệu"}
              allowCreate
              onCreate={async (name) => {
                try {
                  return await Hrc1PhuLieuNmServiceApi.create({ tenPhuLieu: name });
                } catch (e: unknown) {
                  // apiService reject bằng error.response.data ({message}) thay vì Error instance
                  const msg =
                    typeof e === "object" && e !== null && "message" in e &&
                    typeof (e as { message?: unknown }).message === "string"
                      ? (e as { message: string }).message
                      : "Không tạo được phụ liệu mới";
                  message.error(msg);
                  return null;
                }
              }}
              createOptionLabel={(text) => `+ Tạo phụ liệu mới: "${text}"`}
              size="small"
              placeholder="Gõ tên để tạo phụ liệu mới..."
              style={{ minWidth: 120 }}
              allowClear={false}
              disabled={isFormLocked}
            />
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined />}
              onClick={() => handleRemoveAdjustColumn(meta.dataIndex)}
              disabled={isFormLocked}
              style={{ position: "absolute", top: -6, right: -6, padding: 0, width: 18, height: 18 }}
            />
          </div>
        ) : (meta.headerKeyLabel ?? "Điều chỉnh"),
        dataIndex: meta.dataIndex,
        width: meta.width ?? 150,
        editable: meta.isManuallyAdded ? true : false,
        variant: meta.isManuallyAdded ? undefined : ("adjust" as const),
        metaLabel: meta.headerKeyLabel ?? "Điều chỉnh",
        headerKeyId: meta.headerKeyId ?? null,
        sum: true,
      };
    });
  }, [adjustColumnMetas, usedPhuLieuIds, handleColumnHeaderChange, handleRemoveAdjustColumn, isFormLocked]);

  const fetchPhuLieus = useCallback(async (paramsIn: { NgaySX?: string | null; Ca?: number | null; Scope?: number | null }) => {
    try {
      setLoading(true);

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
            children: col.children.map((c: any) => ({ ...c, align: alignType(c.align) })),
          };
        }
        return { ...col, align: alignType(col.align) };
      });

      const result = await hrc1LFPhuLieuService.fetchAndProcessPhuLieus(
        { NgaySX: paramsIn.NgaySX, Ca: paramsIn.Ca, Scope: paramsIn.Scope },
        { baseColumns }
      );

      // Cột phụ liệu LF luôn hiển thị đủ (lấy từ danh mục), kể cả khi chưa có mẻ nào — khác BOF
      // (không early-return xóa cột khi trống, vì người dùng cần cột trống để bắt đầu nhập).
      // Nếu phiếu đã có snapshot LF_PhuGia (đã lưu ít nhất 1 lần), giữ nguyên cột theo snapshot thay vì
      // ghi đè bằng danh mục live hiện tại — xem comment tại khai báo savedPhuGiaSnapshotRef.
      setPhuGiaColumns(savedPhuGiaSnapshotRef.current ?? result.phuGiaColumns);

      // Cột "Phân bổ" (phanBo_*) — tái dùng adjustColumnMetas làm nơi lưu, giống hệt cơ chế BOF
      // (TaoTieuHaoLoThoi.tsx). Giữ nguyên các cột "Thêm cột điều chỉnh" (isManuallyAdded=true) đã có,
      // chỉ merge/replace phần phanBo_* theo dữ liệu mới nhất từ server.
      const keepManual = (m: AdjustColumnMeta) => m.isManuallyAdded === true;
      const phanBoMetas = (result.phanBoColumns ?? []).map((col) => ({
        key: col.dataIndex || `phanBo_${col.headerKeyId}`,
        dataIndex: col.dataIndex || `phanBo_${col.headerKeyId}`,
        headerKeyId: col.headerKeyId ?? null,
        headerKeyLabel: col.metaLabel || col.title?.toString() || undefined,
        width: col.width || 100,
      }));
      if (phanBoMetas.length > 0) {
        setAdjustColumnMetas((prev) => {
          const manual = (prev ?? []).filter(keepManual);
          const merged = [...manual];
          const seen = new Set(manual.map((m) => m.dataIndex));
          phanBoMetas.forEach((m) => {
            if (!seen.has(m.dataIndex)) merged.push(m);
          });
          return hrc1TableService.dedupeAdjustMetas(merged);
        });
      } else {
        setAdjustColumnMetas((prev) => (prev ?? []).filter(keepManual));
      }

      // Bảng CHỈ render từ live api/DLNMHRC1/filter — không dùng hrc1TableService.mergeServerRows
      // (hàm đó coi mọi dòng IsNM=false trong state cũ là "thêm tay cần giữ lại" khi không thấy trên
      // server; nhưng ở LF MỌI dòng đều IsNM=false theo quy ước riêng — nếu dùng chung sẽ khiến mẻ đã
      // bị xóa thật (vd TL hủy nhận bên BBGN_ThepLong) bị "hồi sinh" lại mỗi lần Làm mới dữ liệu).
      // Chỉ giữ lại đúng những dòng user vừa "+ Thêm dòng" nhưng CHƯA lưu (_isNewRow, xem
      // CustomTableHRC.handleAddRow) — KHÔNG dùng "chưa có id" để nhận diện: DataJson.table1 lưu
      // verbatim payload FE gửi lên (PhieuService), còn id thật của dòng thêm tay mới chỉ được gán
      // SAU ĐÓ khi RunJsonInitializersAsync ghi vào bảng Hrc1TieuHao — id này không bao giờ được ghi
      // ngược lại vào DataJson, nên dòng thêm tay đã lưu vẫn mãi "không có id" trong JSON, khiến check
      // theo id coi nó là draft vĩnh viễn → trùng dòng với chính nó đọc từ filter (có id thật).
      const isEmpty = !result.tableData ||
        result.tableData.length === 0 ||
        (result.tableData.length === 1 && result.tableData[0]?.key === "row-empty");

      if (isEmpty) {
        message.info("Chưa có dữ liệu đã lưu cho Ngày/Ca/Tinh luyện này — có thể bắt đầu thêm dòng mới.");
        setTableData((prev) =>
          hrc1TableService.sortRowsByMeThoi(prev.filter((row) => row._isNewRow === true))
        );
        return;
      }

      setTableData((prev) => {
        const unsavedNewRows = prev.filter((row) => row._isNewRow === true);
        return hrc1TableService.sortRowsByMeThoi([...(result.tableData || []), ...unsavedNewRows]);
      });
    } catch (error) {
      console.error("Failed to fetch phu lieus:", error);
      message.error("Không thể tải danh sách dữ liệu đã lưu");
    } finally {
      setLoading(false);
    }
  }, [config.layout]);

  const table1Columns = useMemo(() => {
    const tableLayout = config.layout.find(
      (l) => l.sectionType === "table" && l.key === "table1"
    ) as { columns?: HRCParentColumn[] } | undefined;
    const alignType = (a: unknown): "left" | "center" | "right" | undefined =>
      a === "left" || a === "center" || a === "right" ? a : undefined;
    const normalizeAlign = (cols: any[]): HRCParentColumn[] =>
      cols.map((col) => {
        if (Array.isArray(col.children)) {
          return { ...col, align: alignType(col.align), children: col.children.map((c: any) => ({ ...c, align: alignType(c.align) })) };
        }
        return { ...col, align: alignType(col.align) };
      });
    const baseColumns: HRCParentColumn[] = tableLayout?.columns ? normalizeAlign(tableLayout.columns as any[]) : [];

    return hrc1TableService.buildColumnsWithAdjust({
      baseColumns,
      slotColumns: { LF_PhuGia: effectivePhuGiaColumns },
      manualAdjustColumns: adjustChildColumns,
      phanBoColumns: phanBoChildColumns,
      generateAdjustColumnsFromBase: false,
    });
  }, [config.layout, effectivePhuGiaColumns, adjustChildColumns, phanBoChildColumns]);

  const loadFromNM = useCallback(async () => {
    if (!ngaySX || !ca || !scope) return;
    await fetchPhuLieus({ NgaySX: dayjs(ngaySX).format("YYYY-MM-DD"), Ca: ca, Scope: scope });
  }, [ngaySX, ca, scope, fetchPhuLieus]);

  const handleFilter = useCallback(() => {
    if (!ngaySX || !ca || !scope) {
      message.warning("Vui lòng điền đầy đủ các thông tin: Ngày SX, Ca, và Tinh luyện");
      return;
    }
    loadFromNM();
  }, [ngaySX, ca, scope, loadFromNM]);

  const getUserInfo = useCallback(() => {
    const stored = localStorage.getItem("userinfo");
    return stored ? JSON.parse(stored) : {};
  }, []);

  const initData = useCallback(async () => {
    try {
      setLoading(true);
      const idPhieu = idphieu || "";
      if (idPhieu) {
        const res = await safeGetDetail(() => PhieuApi.getDetail(idPhieu));

        if (res) {
          setSoPhieu((res as any)?.soPhieu);
          const data = (res as any)?.jsonData || {};

          const signatureFields: Record<string, any> = {};
          const pheDuyetFromJson = data.pheDuyet || [];
          if (pheDuyetFromJson.length > 0) {
            pheDuyetFromJson.forEach((pd: any) => {
              if (pd.maKyDuyet && pd.nguoiDuyetId) signatureFields[pd.maKyDuyet] = pd.nguoiDuyetId;
            });
          } else {
            const pheDuyetFromApi = (res as any)?.pheDuyet || [];
            pheDuyetFromApi.forEach((pd: any) => {
              const signature = config.signatures.find((s) => s.capduyet === pd.capDuyet && s.isChon);
              if (signature && pd.nguoiDuyetId) signatureFields[signature.key] = pd.nguoiDuyetId;
            });
          }

          const tinhTrang = (res as any)?.tinhTrang ?? 0;
          const formValues = {
            ...data,
            ...signatureFields,
            idphieu: (res as any)?.idphieu || "",
            NgaySX: data.NgaySX ? dayjs(data.NgaySX, "YYYY-MM-DD") : null,
          };
          form.setFieldsValue(formValues);

          const nguoiTaoIdFromRes = (res as any)?.nguoiTaoId ?? null;
          const hasNguoiTaoIdFromRes = nguoiTaoIdFromRes != null && Number(nguoiTaoIdFromRes) > 0;
          const cap0Signatures = config.signatures.filter((s: any) => s.isChon && s.capduyet === 0);

          if (cap0Signatures.length > 0) {
            const overrideFields: Record<string, any> = {};
            if (
              tinhTrang === TrangThaiPhieuConst.DangLuu ||
              tinhTrang === TrangThaiPhieuConst.DaThuHoi ||
              tinhTrang === TrangThaiPhieuConst.HieuChinh
            ) {
              const currentUserInfo = getUserInfo();
              cap0Signatures.forEach((sig: any) => {
                overrideFields[sig.key] = currentUserInfo?.iD_TaiKhoan ?? null;
              });
            } else if (hasNguoiTaoIdFromRes) {
              cap0Signatures.forEach((sig: any) => {
                overrideFields[sig.key] = nguoiTaoIdFromRes;
              });
            }
            if (Object.keys(overrideFields).length > 0) form.setFieldsValue(overrideFields);
          }

          // KHÔNG seed tableData từ snapshot jsonData.table1 — bảng chỉ render từ live
          // api/DLNMHRC1/filter (gọi ngay sau ở loadFromNM() trong finally bên dưới). Seed từ snapshot
          // ở đây chỉ gây hiện chớp nhoáng dữ liệu cũ, và nếu quên bỏ merge thì mẻ đã xóa (vd TL hủy
          // nhận bên BBGN_ThepLong) sẽ hiện lại — xem comment trong fetchPhuLieus.

          if (formValues.table2) {
            const processedTable2 = (formValues.table2 as HRCTableRow[]).map((row) => ({
              ...row,
              IsNM: row.IsNM !== undefined ? row.IsNM : true,
            }));
            setTable2Data(processedTable2);
          } else {
            setTable2Data([]);
          }

          setTable1LyDo(formValues.table1_lyDo || "");

          if (formValues.table1DynamicColumns) {
            const dyn = formValues.table1DynamicColumns as Record<string, DynamicColumnMeta[]>;
            const restored = hrc1TableService.restoreDynamicGroups(dyn, renderDynamicColumnTitle);
            const savedPhuGia = restored.LF_PhuGia ?? [];
            setPhuGiaColumns(savedPhuGia);
            savedPhuGiaSnapshotRef.current = savedPhuGia.length > 0 ? savedPhuGia : null;
            if (dyn.adjust) {
              setAdjustColumnMetas(
                hrc1TableService.dedupeAdjustMetas(hrc1TableService.adjustMetaFromDynamic(dyn.adjust))
              );
            } else {
              setAdjustColumnMetas([]);
            }
          } else {
            savedPhuGiaSnapshotRef.current = null;
          }

          setPhieuInfo({
            tinhTrang: (res as any)?.tinhTrang ?? 0,
            nguoiTaoId: (res as any)?.nguoiTaoId ?? null,
            idphongBan: (res as any)?.idphongBan ?? null,
            pheDuyet: (res as any)?.pheDuyet || data.pheDuyet || [],
            isClone: (res as any)?.isClone ?? false,
          });
        }
      }
    } catch (err: any) {
      console.error("Lỗi khởi tạo dữ liệu:", err);
      message.error("Không thể tải dữ liệu ban đầu!");
    } finally {
      setLoading(false);
      await loadFromNM();
    }
  }, [form, idphieu, loadFromNM, config.signatures, renderDynamicColumnTitle, getUserInfo, safeGetDetail]);

  useEffect(() => {
    initData();
  }, [initData]);

  const getFormData = useCallback(async (actionKey?: string) => {
    const userInfo = getUserInfo();
    const isSend = actionKey === "saveAndSend" || actionKey === "gui";
    const isCreateNew = !idphieu;
    const headerFieldKeys = config.headerFields.map((f: any) => f.key);
    const signatureKeys = config.signatures.filter((s) => s.isChon).map((s) => s.key);
    const fieldsToValidate = isSend ? [...headerFieldKeys, ...signatureKeys] : headerFieldKeys;
    await form.validateFields(fieldsToValidate);
    if (!(table1Ref.current?.validate() ?? true)) throw new Error("validation");

    // Chặn lưu nếu còn cột "Thêm cột điều chỉnh" chưa chọn phụ liệu — không tự động loại bỏ cột này
    // (số liệu người dùng đã nhập vào đó vẫn còn), để người dùng chủ động chọn phụ liệu và lưu lại,
    // hoặc tự bấm nút xóa (x) trên cột nếu không cần nữa.
    const unresolvedAdjustColumns = adjustColumnMetas.filter(
      (m) => m.isManuallyAdded === true && m.headerKeyId == null
    );
    if (unresolvedAdjustColumns.length > 0) {
      message.error(
        `Có ${unresolvedAdjustColumns.length} cột "Điều chỉnh số liệu" chưa chọn phụ liệu. ` +
          `Vui lòng chọn phụ liệu cho cột này rồi lưu lại, hoặc bấm nút xóa (x) trên cột đó nếu không cần nữa.`
      );
      throw new Error("validation");
    }

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

    const hasCreator = config.signatures.find((x) => x.isChon === false && x.capduyet === 1);
    if (hasCreator) {
      pheDuyetFlow.unshift({
        capDuyet: 1,
        maKyDuyet: hasCreator?.key || "",
        nguoiDuyetId: userInfo.iD_TaiKhoan ?? null,
        tinhTrang: 1,
        ghiChu: "Người tạo phiếu",
      });
    }

    const processedTable1 = hrc1LFPhuLieuService.sanitizeRowsBeforeSubmit(tableData);

    // Dùng effectivePhuGiaColumns (đã loại phụ liệu đang được quản lý ở nhóm "adjust") — tránh 1 phụ
    // liệu vừa tạo/chọn qua "Thêm cột điều chỉnh" bị lưu trùng 2 lần (vừa ở LF_PhuGia vừa ở adjust).
    const dynamicColumnMap = hrc1TableService.buildDynamicColumnMap({ LF_PhuGia: effectivePhuGiaColumns });
    dynamicColumnMap.adjust = hrc1PhuLieuService.buildAdjustDynamicWithValues(
      adjustColumnMetas.filter((m) => m.isManuallyAdded === true),
      tableData
    );

    const processedTable2 = table2Data.map((row) => {
      const processedRow = { ...row };
      if (processedRow.IsNM === undefined) processedRow.IsNM = true;
      delete processedRow._isNewRow;
      return processedRow;
    });

    return {
      ...formData,
      NgaySX: formData.NgaySX ? formData.NgaySX.format("YYYY-MM-DD") : null,
      maBm: config.code,
      prefix: config.prefix,
      nguoiTaoId: isCreateNew ||
        phieuInfo.tinhTrang === TrangThaiPhieuConst.DaThuHoi ||
        phieuInfo.tinhTrang === TrangThaiPhieuConst.HieuChinh
          ? userInfo.iD_TaiKhoan ?? null
          : phieuInfo.nguoiTaoId ?? null,
      tenScope: scope ? "Tinh luyện " + scope : null,
      xuongId: userInfo.iD_PhanXuong ?? null,
      idphongBan: userInfo.iD_PhongBan ?? null,
      table1: processedTable1,
      table1_lyDo: table1LyDo,
      table2: processedTable2,
      table1DynamicColumns: dynamicColumnMap,
      pheDuyet: pheDuyetFlow,
    };
  }, [
    getUserInfo, form, config.headerFields, config.signatures, config.code, config.prefix,
    idphieu, phieuInfo.nguoiTaoId, phieuInfo.tinhTrang, scope, effectivePhuGiaColumns, adjustColumnMetas, tableData, table1LyDo, table2Data,
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

  const handleActionSuccess = useCallback(
    async (context?: { newPhieuId?: string }) => {
      if (context?.newPhieuId) {
        navigateToDetail(context.newPhieuId, "/hrc1_taotieuhaotinhluyenlf");
        return;
      }
      await initData();
    },
    [navigateToDetail, initData]
  );

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
      pheDuyet: phieuInfo.pheDuyet ?? [],
      preConfirmCheck: async () => {
        const { ok, negativePhuLieus } = await hrc1TableService.checkNoNegativeThongKe(
          dayjs(ngaySX).format("YYYY-MM-DD"), ca, "LF"
        );
        if (!ok) {
          message.error(`Thống kê phụ liệu ${negativePhuLieus.join(", ")} đang âm (phân bổ chênh lệch âm vượt quá lượng thực tế đã dùng). Vui lòng kiểm tra lại trước khi chốt.`);
          return false;
        }
        return true;
      },
      redirectToList,
      // Nhân bản riêng dòng Hrc1TieuHao/Hrc1PhuLieu cho phiếu clone "Đề nghị hiệu chỉnh" — BE tự no-op
      // nếu không phải phiếu clone, an toàn khi cũng bị gọi ở các lần Lưu bình thường.
      customPutApi: (idphieu) => dlnmHRC1Api.cloneTieuHaoData(idphieu),
      onSuccess: handleActionSuccess,
      onError: (error) => {
        console.error("Action error:", error);
      },
    });

    if (buttons.length === 0) return null;
    return phieuActionService.renderActionButtons(buttons, idphieu || "", getFormData);
  }, [getUserInfo, idphieu, phieuInfo, getFormData, handleActionSuccess, redirectToList, ngaySX, ca]);

  return (
    <>
      {idphieu && (
        <HRC1ExportBienBanButtons
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div style={{ flex: 1, textAlign: "center" }}>
            <Typography.Title level={3} style={{ marginBottom: 0 }}>
              {config.title}
            </Typography.Title>
            {idphieu && <b>Số phiếu: {soPhieu}</b>}
          </div>

          {config.isoInfo && (
            <div style={{ fontSize: 13, textAlign: "right", lineHeight: "20px" }}>
              <div><b>{config.isoInfo.code}</b></div>
              <div>Ngày hiệu lực: {config.isoInfo.effectiveDate}</div>
              <div>Lần sửa đổi: {config.isoInfo.revision}</div>
            </div>
          )}
        </div>

        <Form form={form} layout="vertical">
          <Form.Item name="idphieu" hidden>
            <Input type="hidden" />
          </Form.Item>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {config.headerFields.map((f, idx) => (
              <CustomFormItem key={f.key || idx} field={f} idx={idx} disabled={hasExistingPhieu} />
            ))}
          </div>

          <div style={{ marginTop: 16, marginBottom: 16, display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <Button type="primary" icon={<FilterOutlined />} onClick={handleFilter} disabled={isFormLocked} loading={loading}>
              Làm mới dữ liệu
            </Button>
            <Button icon={<PlusOutlined />} onClick={addAdjustColumn} disabled={isFormLocked}>
              Thêm cột điều chỉnh
            </Button>
            {actionButtons}
          </div>

          {config.layout.map((layout, idx) => (
            <div key={idx}>
              {layout.sectionType === "table" && layout.key === "table1" ? (
                <>
                <CustomTableHRC
                  maBm={config.code}
                  ngaySX={ngaySX}
                  ca={ca}
                  scope={scope}
                  bieuMau={"LF"}
                  isHasExistingPhieu={hasExistingPhieu}
                  columns={table1Columns}
                  initialData={tableData}
                  onDataChange={setTableData}
                  addRowButtonText="+ Thêm dòng"
                  showAddButton={false}
                  showDeleteButton={false}
                  minRows={1}
                  editable={!isFormLocked && (layout as any).editable !== false}
                  loading={loading}
                  stickyHeaders
                  stickyFirstColumn
                  stickyColumnKeys={["meThoi", "macThep"]}
                  disableRowHover
                  meThoiSearchApi={hrc1MeThoiMacThepServiceApi.searchMeThoi}
                  macThepSearchApi={hrc1MeThoiMacThepServiceApi.searchMacThep}
                  scrollX="1500px"
                  lyDoLabel={(layout as any).lyDo?.label}
                  lyDoValue={table1LyDo}
                  onLyDoChange={setTable1LyDo}
                  onSave={handleAutoSave}
                  deleteApi={dlnmHRC1Api}
                  chuyenMeThoiApi={dlnmHRC1Api}
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

          <div style={{ marginTop: 40, display: "flex", justifyContent: "space-around", textAlign: "center" }}>
            {config.signatures
              .filter((x) => x.isChon)
              ?.map((sig, i) => {
                const isLevelZero = sig.capduyet === 0;
                const nguoiTaoIdFromPhieu = phieuInfo.nguoiTaoId ?? null;
                const hasNguoiTaoIdFromPhieu = nguoiTaoIdFromPhieu != null && Number(nguoiTaoIdFromPhieu) > 0;

                const shouldUseCurrentUser =
                  isLevelZero &&
                  (!idphieu ||
                    currentTinhTrang === TrangThaiPhieuConst.DangLuu ||
                    currentTinhTrang === TrangThaiPhieuConst.DaThuHoi ||
                    currentTinhTrang === TrangThaiPhieuConst.HieuChinh);

                const cap0InitialValue = isLevelZero
                  ? shouldUseCurrentUser
                    ? getUserInfo()?.iD_TaiKhoan ?? null
                    : hasNguoiTaoIdFromPhieu
                      ? nguoiTaoIdFromPhieu
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
                      scope={scope}
                    />
                  </div>
                );
              })}
          </div>
        </Form>
      </Card>
    </>
  );
};

export default TaoTieuHaoTinhLuyenLF;
