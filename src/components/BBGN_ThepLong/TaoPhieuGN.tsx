/* eslint-disable @typescript-eslint/no-explicit-any */
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Form, Input, Modal, Typography, message } from "antd";
import CustomFormItem from "../CustomFormItem";
import HRC1_BBGN_ThepLong from "../../utils/BM_config/HRC1_BBGN_ThepLong.json";
import HRC2_BBGN_ThepLong from "../../utils/BM_config/HRC2_BBGN_ThepLong.json";
import { usePhieuNavigation } from "../../hooks/usePhieuNavigation";
import { PhieuApi } from "../../services/PhieuApi";
import { phieuActionService, type PheDuyetItem } from "../../services/PhieuActionService";
import { TrangThaiPhieuConst } from "../../utils/constants/TrangThaiPhieuConstant";
import { FilterOutlined } from "@ant-design/icons";
import { bbgbThepLongApi } from "../../services/BBGNThepLongApi";
import type { BBGNThepLongBieuMau } from "./GiaoNhanThepLongList";
import BBGNThepLongTable, { type BBGNRow } from "./BBGNThepLongTable";
import BBGNExportButtons from "./BBGNExportButtons";
import { useMayDucOptions } from "../../hooks/useMayDucOptions";
import { validateBBGNRows } from "./bbgnThepLongValidation";
import { PhieuActionButtonKeys } from "../../utils/constants/PhieuActionButtonKeys";

const EDITABLE_FIELDS: (keyof BBGNRow)[] = [
  'me', 'idMacThep', 'thungSo', 'thoiGian',
  'klLFSauThep', 'klLan1', 'klLan2', 'klLan3', 'ghiChu',
  'tinhLuyenLenThang', 'isThuNghiem', 'klcau1', 'klcau2',
];
const isSameVal = (a: unknown, b: unknown) => (a == null ? null : a) === (b == null ? null : b);
const hasRowChanged = (cur: BBGNRow, init: BBGNRow) =>
  EDITABLE_FIELDS.some((f) => !isSameVal(cur[f], init[f]));

const CONFIG_MAP = {
  HRC1_BBGN_ThepLong: HRC1_BBGN_ThepLong,
  HRC2_BBGN_ThepLong: HRC2_BBGN_ThepLong,
} as const;

// Mã nhà máy suy từ bieuMau (bảng con / API fetch mẻ vẫn cần 1 | 2)
const NHAMAY_MAP: Record<BBGNThepLongBieuMau, number> = {
  HRC1_BBGN_ThepLong: 1,
  HRC2_BBGN_ThepLong: 2,
};

const normalizeHHmm = (value: unknown): string | null => {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  const parsed = dayjs(s);
  return parsed.isValid() ? parsed.format("HH:mm") : null;
};

const normalizeTableRows = (rows: unknown[]): BBGNRow[] => {
  return rows.map((raw, idx) => {
    const row = (raw ?? {}) as Record<string, unknown>;
    const existingKey = row.key;
    const id = row.id;
    const me = row.me;

    let key = "";
    if (typeof existingKey === "string" && existingKey.trim()) key = existingKey;
    else if (typeof existingKey === "number") key = String(existingKey);
    else if (typeof id === "string" && id.trim()) key = `id-${id}`;
    else if (typeof id === "number") key = `id-${id}`;
    else if (typeof me === "string" && me.trim()) key = `me-${me}-${idx}`;
    else key = `row-${idx}`;

    return {
      ...(row as BBGNRow),
      key,
      thoiGian: normalizeHHmm(row.thoiGian),
      klLFSauThep: (row.klLFSauThep ?? (row as Record<string, unknown>).kllfSauThep ?? null) as number | null,
      phanLoaiNhom: (row.phanLoaiNhom ?? (row as Record<string, unknown>).tenNhomPhanLoaiMacThep ?? null) as string | null,
    };
  });
};

interface TaoPhieuGNProps {
  bieuMau: BBGNThepLongBieuMau;
  storageKey?: string;   // default: "phieu_gn_theplong_id"
  routeList?: string;    // default: "/giaonhantheplong"
  routeCreate?: string;  // default: "/taophieugiaonhantheplong"
}

const TaoPhieuGN = ({
  bieuMau,
  storageKey = "phieu_gn_theplong_id",
  routeList = "/giaonhantheplong",
  routeCreate = "/taophieugiaonhantheplong",
}: TaoPhieuGNProps) => {
  const { idphieu, navigateToDetail, safeGetDetail, redirectToList } = usePhieuNavigation(
    storageKey,
    routeList
  );
  const config = CONFIG_MAP[bieuMau];
  const nhaMay = NHAMAY_MAP[bieuMau];
  const [form] = Form.useForm();

  const hasExistingPhieu = Boolean(idphieu);
  const [loading, setLoading] = useState(false);
  const [soPhieu, setSoPhieu] = useState("");
  const [tableData, setTableData] = useState<BBGNRow[]>([]);
  const initialTableDataRef = useRef<BBGNRow[]>([]);
  const { getOptions: getMayDucOptions, getTen: getTenMayDuc } = useMayDucOptions(nhaMay);

  const scopeValue = Form.useWatch("scope", form);
  const ngaySXValue = Form.useWatch("NgaySX", form);
  const caValue = Form.useWatch("ca", form);

  const currentUserInfo = useMemo(() => {
    const stored = localStorage.getItem("userinfo");
    return stored ? JSON.parse(stored) : {};
  }, []);

  const DETAIL_HIDDEN_BUTTON_KEYS = new Set<string>([
    PhieuActionButtonKeys.SaveAndSend,
    PhieuActionButtonKeys.Recall,
    PhieuActionButtonKeys.RequestEdit,
  ]);

  const UserLoThoi = useMemo(() => {
    const maBm = nhaMay === 1 ? "HRC1_BBGN_ThepLong" : "HRC2_BBGN_ThepLong";
    const info = (() => { try { return JSON.parse(localStorage.getItem("userinfo") ?? "{}"); } catch { return {}; } })();
    const quyenTheoLo = Array.isArray(info.quyenTheoLo)
      ? (info.quyenTheoLo as { maBm?: unknown; khuVucPhus?: unknown[] }[])
      : [];
    const entry = quyenTheoLo.find((x) => x.maBm === maBm);
    const khuVucPhus = (entry?.khuVucPhus ?? []).map(String);
    // const hasTL = khuVucPhus.includes("TL");
    const hasLoThoi = khuVucPhus.some((v) => Number.isFinite(parseInt(v, 10)));
    return hasLoThoi && !khuVucPhus.includes("TL");
  }, [nhaMay])

  const [phieuInfo, setPhieuInfo] = useState<{
    tinhTrang?: number;
    nguoiTaoId?: number | null;
    idphongBan?: number | null;
    pheDuyet?: PheDuyetItem[];
    isClone?: boolean;
    kip?: string | null;
  }>({});

  const currentTinhTrang = phieuInfo.tinhTrang ?? TrangThaiPhieuConst.DangLuu;
  const isFormLocked = !(
    currentTinhTrang === TrangThaiPhieuConst.DangLuu ||
    currentTinhTrang === TrangThaiPhieuConst.DaThuHoi ||
    currentTinhTrang === TrangThaiPhieuConst.HieuChinh
  );

  const loadDetail = useCallback(async () => {
    if (!idphieu) return;
    const res = await safeGetDetail(() => PhieuApi.getDetail(idphieu));
    if (!res) return;
    const detail: any = (res as any)?.data ?? res;

    setSoPhieu(detail?.soPhieu ?? "");
    setPhieuInfo({
      tinhTrang: detail?.tinhTrang ?? 0,
      nguoiTaoId: detail?.nguoiTaoId ?? null,
      idphongBan: detail?.idphongBan ?? null,
      pheDuyet: detail?.pheDuyet ?? [],
      isClone: detail?.isClone ?? false,
      kip: detail?.kip ?? null,
    });

    const json = detail?.jsonData ?? {};
    form.setFieldsValue({
      ...json,
      NgaySX: json?.NgaySX ? dayjs(json.NgaySX) : undefined,
    });
    setTableData(Array.isArray(json?.table1) ? normalizeTableRows(json.table1) : []);

    // Đồng bộ cấp duyệt 0: nếu server có nguoiTaoId thì set theo server,
    // nếu không có và đang DangLuu thì set theo currentUser
    const nguoiTaoIdFromRes = detail?.nguoiTaoId ?? null;
    const hasNguoiTaoId = nguoiTaoIdFromRes != null && Number(nguoiTaoIdFromRes) > 0;
    const tinhTrang = detail?.tinhTrang ?? 0;
    const cap0Sigs = (config.signatures || []).filter(
      (s: any) => s.isChon && s.capduyet === 0
    );
    if (cap0Sigs.length > 0) {
      const overrideFields: Record<string, unknown> = {};
      if (hasNguoiTaoId) {
        cap0Sigs.forEach((s: any) => { overrideFields[s.key] = nguoiTaoIdFromRes; });
      } else if (tinhTrang === TrangThaiPhieuConst.DangLuu) {
        cap0Sigs.forEach((s: any) => { overrideFields[s.key] = currentUserInfo?.iD_TaiKhoan ?? null; });
      }
      if (Object.keys(overrideFields).length > 0) {
        form.setFieldsValue(overrideFields);
      }
    }
  }, [form, idphieu, safeGetDetail, config.signatures, currentUserInfo]);

  /** Lấy bảng mẻ từ API load (ghost + sync PhanLoai). Cần NgaySX + ca; IdPhieu có thể null (phiếu chưa lưu). */
  const fetchBbgnTableFromServer = useCallback(
    async (opts?: { notify?: boolean }) => {
      const ngaySX = form.getFieldValue("NgaySX")?.format("YYYY-MM-DD");
      const ca = form.getFieldValue("ca");
      if (!ngaySX || ca == null || ca === "") return;

      try {
        const res = await bbgbThepLongApi.load({
          IdPhieu: idphieu || null,
          NgaySX: ngaySX,
          Ca: ca,
          BieuMau: bieuMau,
        });
        const data = (res as any)?.data ?? res;
        if (Array.isArray(data)) {
          const rows = normalizeTableRows(data);
          setTableData(rows);
          initialTableDataRef.current = rows;
          if (opts?.notify) message.success("Lấy dữ liệu thành công");
          return;
        }
        if (opts?.notify) message.error("Lấy dữ liệu thất bại");
      } catch (e) {
        console.error(e);
        if (opts?.notify) message.error("Lấy dữ liệu thất bại");
      }
    },
    [bieuMau, form, idphieu]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        if (idphieu) {
          try {
            await loadDetail();
          } catch (e) {
            console.error(e);
            if (!cancelled) message.error("Không thể tải dữ liệu phiếu");
            return;
          }
          if (cancelled) return;
          try {
            await fetchBbgnTableFromServer({ notify: false });
          } catch (e) {
            console.error(e);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [idphieu, loadDetail, fetchBbgnTableFromServer]);

  // Máy đã khóa không hiển thị; chỉ giữ lại khi là máy của phiếu đã tạo (ô bị khóa) để hiện tên
  const mayDucOptions = useMemo(
    () => getMayDucOptions(hasExistingPhieu && scopeValue != null ? [Number(scopeValue)] : []),
    [getMayDucOptions, hasExistingPhieu, scopeValue]
  );

  const headerFields = useMemo(() => {
    return (config.headerFields || []).map((f: any) => {
      if (f.key !== "scope" || f.type !== "select") return f;
      return {
        ...f,
        options: mayDucOptions,
      };
    });
  }, [config.headerFields, mayDucOptions]);

  // Tên máy (không kèm "(ngừng)") — được lưu làm tenScope của phiếu
  const selectedMayDucLabel = useMemo(
    () => getTenMayDuc(scopeValue != null ? Number(scopeValue) : null) ?? null,
    [getTenMayDuc, scopeValue]
  );

  const getUserInfo = useCallback(() => {
    const stored = localStorage.getItem("userinfo");
    return stored ? JSON.parse(stored) : {};
  }, []);

  const getFormData = useCallback(
    async (actionKey?: string) => {
      const userInfo = getUserInfo();
      const isSend = actionKey === "saveAndSend" || actionKey === "gui";

      const headerFieldKeys = (config.headerFields || []).map((f: any) => f.key);
      const signatureKeys = (config.signatures || [])
        .filter((s: any) => s.isChon)
        .map((s: any) => s.key);
      const fieldsToValidate = isSend ? [...headerFieldKeys, ...signatureKeys] : headerFieldKeys;
      await form.validateFields(fieldsToValidate);

      const values = form.getFieldsValue(true);
      const phieuScope = typeof values?.scope === "number" ? values.scope : scopeValue ?? null;
      const kip = typeof values?.kip === "string" ? values.kip : phieuInfo.kip ?? null;
      const tenScope = typeof values?.tenScope === "string" ? values.tenScope : selectedMayDucLabel ?? null;
      const tableError = validateBBGNRows(tableData, {
        mode: isSend ? "send" : "save",
        scopeLabel: selectedMayDucLabel,
        scopeValue: phieuScope,
      });
      if (tableError) {
        message.error(tableError);
        throw new Error(tableError);
      }

      // Với HRC1: nếu user có quyền một phần (TL hoặc lò thổi), fetch server mới nhất
      // rồi merge để tránh ghi đè fields mà user không có quyền sửa.
      let mergedTableData = tableData;
      if (nhaMay === 1) {
        const userInfo = getUserInfo();
        const quyenTheoLo = Array.isArray(userInfo.quyenTheoLo)
          ? (userInfo.quyenTheoLo as { maBm?: unknown; khuVucPhus?: unknown[] }[])
          : [];
        const entry = quyenTheoLo.find((x) => x.maBm === "HRC1_BBGN_ThepLong");
        const khuVucPhus = (entry?.khuVucPhus ?? []).map(String);
        const canEditKlLan = khuVucPhus.includes("TL");
        const canEditOthers = khuVucPhus.some((v) => Number.isFinite(parseInt(v, 10)));

        if (!(canEditKlLan && canEditOthers)) {
          try {
            const ngaySX = form.getFieldValue("NgaySX")?.format("YYYY-MM-DD");
            const ca = form.getFieldValue("ca");
            if (ngaySX && ca != null) {
              const res = await bbgbThepLongApi.load({ IdPhieu: idphieu || null, NgaySX: ngaySX, Ca: ca, BieuMau: bieuMau });
              const serverData = (res as any)?.data ?? res;
              // if (Array.isArray(serverData)) {
              //   const serverRows = normalizeTableRows(serverData);
              //   mergedTableData = serverRows.map((serverRow) => {
              //     const local = tableData.find((r) =>
              //       (r.id != null && r.id === serverRow.id) || r.key === serverRow.key
              //     );
              //     if (!local) return serverRow;
              //     if (canEditKlLan) {
              //       // TL: base server, chỉ ghi đè klLan1/klLan2 từ local
              //       return { ...serverRow, klLan1: local.klLan1, klLan2: local.klLan2, klThepLong: local.klThepLong };
              //     } else {
              //       // Lò thổi: base local (giữ mọi thứ user sửa), chỉ lấy klLan1/klLan2 từ server
              //       return { ...local, klLan1: serverRow.klLan1, klLan2: serverRow.klLan2, klThepLong: serverRow.klThepLong };
              //     }
              //   });
              // }
              if (Array.isArray(serverData)) {
                const serverRows = normalizeTableRows(serverData);
  
                // =========================
                // Build local map
                // =========================
                const localMap = new Map();
  
                tableData.forEach((row) => {
                  const key = row.id ?? row.key;
                  localMap.set(key, row);
                });
  
                // =========================
                // Merge rows từ server
                // =========================
                const mergedRows = serverRows.map((serverRow) => {
                  const key = serverRow.id ?? serverRow.key;

                  const local = localMap.get(key);

                  if (!local) {
                    return serverRow;
                  }

                  // User TL
                  if (canEditKlLan) {
                    return {
                      ...serverRow,
                      klLan1: local.klLan1,
                      klLan2: local.klLan2,
                      klThepLong: local.klThepLong,
                      klcau1: local.klcau1,
                      klcau2: local.klcau2,
                    };
                  }

                  // User lò thổi
                  return {
                    ...local,
                    klLan1: serverRow.klLan1,
                    klLan2: serverRow.klLan2,
                    klThepLong: local.klThepLong,
                  };
                });
  
                // =========================
                // Thêm các dòng mới local
                // chưa tồn tại trên server
                // =========================
                const serverKeySet = new Set(
                  serverRows.map((x) => x.id ?? x.key)
                );
  
                const newLocalRows = tableData.filter((localRow) => {
                  const key = localRow.id ?? localRow.key;
  
                  return !serverKeySet.has(key);
                });
  
                mergedTableData = [
                  ...mergedRows,
                  ...newLocalRows,
                ];
              }
            }
          } catch (e) {
            console.error("Warning: could not fetch fresh table for merge, saving local state", e);
          }
        }
      }

      const tablePayload: BBGNRow[] = mergedTableData.map((row) => {
        const initialRow = initialTableDataRef.current.find(
          (r) => (row.id != null && r.id === row.id) || r.key === row.key
        );
        const changed = !initialRow || hasRowChanged(row, initialRow);
        return {
          ...row,
          scope: phieuScope,
          ...(changed && {
            lastIdUserEdit: userInfo?.iD_TaiKhoan ?? null,
            lastNameUserEdit: userInfo?.hoVaTen ?? null,
          }),
        };
      });

      const pheDuyetFlow = (config.signatures || [])
        .filter((s: any) => s.isChon)
        .map((s: any) => ({
          capDuyet: s.capduyet,
          maKyDuyet: s.key,
          nguoiDuyetId: form.getFieldValue(s.key),
          tinhTrang: 0,
          ghiChu: "",
        }));

      return {
        ...values,
        NgaySX: values?.NgaySX ? dayjs(values.NgaySX).format("YYYY-MM-DD") : null,
        maBm: config.code,
        kip,
        prefix: config.prefix,
        scope: phieuScope,
        tenScope: tenScope,
        xuongId: userInfo.iD_PhanXuong ?? null,
        idphongBan: userInfo.iD_PhongBan ?? null,
        table1: tablePayload,
        pheDuyet: pheDuyetFlow,
      };
    },
    [bieuMau, config.code, config.headerFields, config.prefix, config.signatures, form, getUserInfo, idphieu, nhaMay, scopeValue, selectedMayDucLabel, tableData]
  );

  const handleActionSuccess = useCallback(
    async (context?: { newPhieuId?: string }) => {
      if (context?.newPhieuId) {
        navigateToDetail(context.newPhieuId, routeCreate);
        return;
      }
      if (idphieu) {
        await loadDetail();
        await fetchBbgnTableFromServer({ notify: false });
      }
    },
    [fetchBbgnTableFromServer, idphieu, loadDetail, navigateToDetail, routeCreate]
  );

  // Dòng mới thêm (chưa có id) hoặc dòng đã sửa nhưng chưa Lưu — "Làm mới dữ liệu" sẽ ghi đè
  // toàn bộ tableData bằng dữ liệu server, làm mất các dòng/thay đổi này. Nếu người dùng nhập
  // lại sau khi mất, dòng cũ (đang được Lưu dở ở request trước, nếu có) và dòng nhập lại sẽ
  // trở thành 2 record trùng nhau trong DB một khi cả hai request đều được lưu.
  const hasUnsavedChanges = useMemo(
    () =>
      tableData.some((row) => {
        if (row.id == null) return true;
        const initial = initialTableDataRef.current.find((r) => r.id === row.id);
        return !initial || hasRowChanged(row, initial);
      }),
    [tableData]
  );

  const handleFetch = useCallback(async () => {
    const ngaySX = form.getFieldValue("NgaySX")?.format("YYYY-MM-DD");
    const ca = form.getFieldValue("ca");
    if (!ngaySX || !ca) {
      message.warning("Vui lòng chọn Ngày và Ca trước khi làm mới dữ liệu");
      return;
    }

    const doFetch = async () => {
      try {
        setLoading(true);
        await fetchBbgnTableFromServer({ notify: true });
      } finally {
        setLoading(false);
      }
    };

    if (hasUnsavedChanges) {
      Modal.confirm({
        title: "Dữ liệu chưa lưu sẽ bị mất",
        content:
          "Bạn đang có dòng mới hoặc thay đổi chưa Lưu. Làm mới dữ liệu sẽ bỏ các thay đổi này. Bạn nên bấm Lưu trước. Vẫn tiếp tục làm mới?",
        okText: "Làm mới (bỏ thay đổi)",
        okButtonProps: { danger: true },
        cancelText: "Hủy",
        onOk: doFetch,
      });
      return;
    }

    await doFetch();
  }, [fetchBbgnTableFromServer, form, hasUnsavedChanges]);

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
      redirectToList,
      onSuccess: handleActionSuccess,
      onError: (error) => console.error("Action error:", error),
    });
    const filteredButtons = buttons.filter((btn) => UserLoThoi ? !DETAIL_HIDDEN_BUTTON_KEYS.has(btn.key) : true);
    if (filteredButtons.length === 0) return null;
    // if (buttons.length === 0) return null;
    return phieuActionService.renderActionButtons(filteredButtons, idphieu || "", getFormData);
  }, [getFormData, getUserInfo, handleActionSuccess, idphieu, phieuInfo, redirectToList]);

  return (
    <>
      <div style={{ margin: "24px 24px 0", display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button
          type="primary"
          icon={<FilterOutlined />}
          onClick={handleFetch}
          disabled={isFormLocked}
          loading={loading}
        >
          Làm mới dữ liệu
        </Button>
        <BBGNExportButtons
          idPhieu={idphieu || null}
          templateCode={config.code}
          soPhieu={soPhieu}
          disabled={isFormLocked && !idphieu}
        />
      </div>
      <Card style={{ margin: 24, boxShadow: "0 2px 8px #f0f1f2" }} loading={loading}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div style={{ flex: 1, textAlign: "center" }}>
            <Typography.Title level={3} style={{ marginBottom: 0 }}>
              {config.title}
            </Typography.Title>
            {idphieu && <b>Số phiếu: {soPhieu}</b>}
          </div>
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

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {headerFields.map((f: any, idx: number) => (
            <CustomFormItem key={f.key || idx} field={f} idx={idx} disabled={hasExistingPhieu || isFormLocked} />
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          <BBGNThepLongTable
            value={tableData}
            onChange={(rows) => setTableData(rows)}
            disabled={isFormLocked}
            scopeValue={scopeValue}
            scopeLabel={selectedMayDucLabel}
            ngaySX={ngaySXValue ? dayjs(ngaySXValue).format("YYYY-MM-DD") : null}
            ca={caValue}
            nhaMay={nhaMay}
            loading={loading}
          />
        </div>

        <div style={{ marginTop: 40, display: "flex", justifyContent: "space-around", textAlign: "center" }}>
          {(config.signatures || [])
            .filter((x: any) => x.isChon)
            .map((sig: any, i: number) => {
              const isLevelZero = sig.capduyet === 0;
              const nguoiTaoIdFromPhieu = phieuInfo.nguoiTaoId ?? null;
              const hasNguoiTaoId = nguoiTaoIdFromPhieu != null && Number(nguoiTaoIdFromPhieu) > 0;

              // cap0: khi tạo mới hoặc DangLuu chưa có nguoiTaoId → fill currentUser
              const shouldUseCurrentUser =
                isLevelZero &&
                (!idphieu || (currentTinhTrang === TrangThaiPhieuConst.DangLuu && !hasNguoiTaoId));

              const cap0InitialValue = isLevelZero
                ? shouldUseCurrentUser
                  ? currentUserInfo?.iD_TaiKhoan ?? null
                  : hasNguoiTaoId
                    ? nguoiTaoIdFromPhieu
                    : undefined
                : undefined;

              return (
                <div key={sig.key || i}>
                  <CustomFormItem
                    maBm={config.code}
                    field={sig}
                    idx={i}
                    disabled={isLevelZero || isFormLocked}
                    initialValue={cap0InitialValue}
                  />
                </div>
              );
            })}
        </div>
      </Form>

      <div style={{ textAlign: "center", marginTop: 32, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
        {actionButtons}
      </div>
      </Card>
    </>
  );
};

export default TaoPhieuGN;
