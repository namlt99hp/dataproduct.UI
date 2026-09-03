/* eslint-disable @typescript-eslint/no-explicit-any */
import HRC1_STD_NXT from "../../../utils/BM_config/HRC1_STD_NXT.json";
import { Card, Form, Input, Typography, message, Button, Tabs, Tag } from "antd";
import dayjs from "dayjs";
import { useState, useEffect, useCallback, useMemo } from "react";
import CustomFormItem from "../../../components/CustomFormItem";
import { PhieuApi } from "../../../services/PhieuApi";
import { usePhieuNavigation } from "../../../hooks/usePhieuNavigation";
import GroupedTableSTD_HRC1 from "../../../components/GroupedTableSTD_HRC1";
import SummaryTableSTD_HRC1 from "../../../components/SummaryTableSTD_HRC1";
import type {
  STD_NXT_HRC1_Table1Row,
  STD_NXT_HRC1_Table2Row,
  STD_NXT_HRC1_UpsertDto,
  NXTSummaryDto_HRC1,
  STD_NXT_HRC1_PhanBoDto,
  STD_NXT_HRC1_KhongPhanBoDto,
} from "../../../models/STD_NXT_HRC1_Model";
import type {
  STD_NXT_RelatedPhieuTarget,
  STD_NXT_RelatedPhieuStatusItem,
} from "../../../models/STD_NXT_Model";
import { STD_NXT_HRC1ServiceApi } from "../../../services/STD_NXT_HRC1ServiceApi";
import { dlnmHRC1Api } from "../../../services/DLNMHRC1Api";
import { PHIEU_STATUS_CONFIG } from "../../../utils/constants/TrangThaiPhieuDisplay";
import { TrangThaiPhieuConst } from "../../../utils/constants/TrangThaiPhieuConstant";

const Tao_STD_HRC1 = () => {
  const { idphieu, navigateToDetail, safeGetDetail } =
    usePhieuNavigation("std_nxt_hrc1_idphieu", "/hrc1_std_nhapxuatton");

  const config = HRC1_STD_NXT;
  const [form] = Form.useForm();

  const [table1Data, setTable1Data] = useState<STD_NXT_HRC1_Table1Row[]>([]);
  const [table2Data, setTable2Data] = useState<STD_NXT_HRC1_Table2Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [relatedStatusMap, setRelatedStatusMap] = useState<Record<string, STD_NXT_RelatedPhieuStatusItem>>({});
  const [canPhanBo, setCanPhanBo] = useState(true);
  const [isLockedByChot, setIsLockedByChot] = useState(false);
  /** Tăng khi BE trả canPhanBo = false để remount SummaryTableSTD_HRC1, đồng bộ UI với trạng thái khóa phân bổ */
  const [summaryTableRemountKey, setSummaryTableRemountKey] = useState(0);
  const watchedNgaySX = Form.useWatch("NgaySX", form);
  const watchedCa = Form.useWatch("ca", form);

  const getUserInfo = useCallback(() => {
    const stored = localStorage.getItem("userinfo");
    return stored ? JSON.parse(stored) : {};
  }, []);

  const currentUserInfo = useMemo(() => {
    const stored = localStorage.getItem("userinfo");
    return stored ? JSON.parse(stored) : {};
  }, []);

  // Map khu vực -> scope int (giá trị enum ToHopSTDNXT_HRC1 1-10, lấy từ index trong khuVucList)
  const scopeMap = useMemo(() => {
    const map = new Map<string, number>();
    const kvList = config.layout1?.[0]?.khuVucList || [];
    kvList.forEach((kv: any, idx: number) => {
      const key = kv?.label ? String(kv.label) : "";
      const valNum = idx + 1; // enum ToHopSTDNXT_HRC1: đúng theo thứ tự khai báo trong JSON (1-10)
      if (key) map.set(key, valNum);
    });
    return map;
  }, [config.layout1]);

  // Helper build payload DTO cho API lưu riêng (STD_XUAT_NHAP_TON_HRC1s & STD_NXT_TOTAL_HRC1)
  const buildNxtUpsertPayload = useCallback(
    (formValues: any): STD_NXT_HRC1_UpsertDto => {
      // Đếm thứ tự dòng theo từng Scope để BE lưu ThuTu, giữ đúng vị trí người dùng sắp xếp trên UI
      const scopeOrderCounters = new Map<number, number>();
      const details = (table1Data || []).map((row) => {
        const khuVucKey = row.khuVuc ? String(row.khuVuc) : "";
        const scopeVal = khuVucKey && scopeMap.has(khuVucKey) ? scopeMap.get(khuVucKey) || 0 : 0;
        const thuTu = scopeOrderCounters.get(scopeVal) ?? 0;
        scopeOrderCounters.set(scopeVal, thuTu + 1);
        return {
          Scope: scopeVal,
          ViTri: row.viTri ?? 0,
          ThuTu: thuTu,
          PhuLieuID: row.idPhuLieu ?? 0,
          TenNguyenLieu: row.nguyenNhienLieu ?? "",
          TonDauCa: row.tonDauCa ? Number(row.tonDauCa) : 0,
          TuongQuanDauCa: row.tuongQuanDauCa ?? "",
          NhapVaoTrongCa: row.nhapTrongCa ? Number(row.nhapTrongCa) : 0,
          MucLieu: row.mucLieu ? Number(row.mucLieu) : 0,
          TheTich: row.theTich ? Number(row.theTich) : 0,
          TyTrong: row.tyTrong ? Number(row.tyTrong) : 0,
          TonCuoiCa: row.tonCuoiCa ? Number(row.tonCuoiCa) : 0,
          TuongQuanCuoiCa: row.tuongQuanCuoiCa ?? "",
          TongThucTe: row.tongThucTe ? Number(row.tongThucTe) : 0,
          IDSilo: row.siloId ?? null,
          LuongSuDungKiemKe: row.luongSuDungKiemKe != null && row.luongSuDungKiemKe !== "" ? Number(row.luongSuDungKiemKe) : null,
        };
      });

      // Summary: tổng hợp trực tiếp từ details (group theo TenNguyenLieu)
      const grouped: Record<
        string,
        { id: number; tonDau: number; nhap: number; tonCuoi: number; sdss: number }
      > = {};
      details.forEach((d) => {
        const name = d.TenNguyenLieu || "";
        if (!name) return;
        if (!grouped[name]) {
          grouped[name] = {
            id: d.PhuLieuID || 0,
            tonDau: 0,
            nhap: 0,
            tonCuoi: 0,
            sdss: 0,
          };
        }
        grouped[name].id = d.PhuLieuID || grouped[name].id;
        grouped[name].tonDau += d.TonDauCa || 0;
        grouped[name].nhap += d.NhapVaoTrongCa || 0;
        grouped[name].tonCuoi += d.TonCuoiCa || 0;
        grouped[name].sdss += d.TongThucTe || 0;
      });

      const summary: NXTSummaryDto_HRC1[] = Object.keys(grouped).map((name) => {
        const g = grouped[name];
        const tongSuDung = g.tonDau + g.nhap - g.tonCuoi;
        const chenh = Math.abs(tongSuDung - g.sdss);
        return {
          PhuLieuID: g.id,
          TenNguyenLieu: name,
          TongTonDauCa: g.tonDau,
          TongNhapTrongCa: g.nhap,
          TongTonCuoiCa: g.tonCuoi,
          TongSuDung: tongSuDung,
          TongSDTrenSoSach: g.sdss,
          ChenhLech: chenh,
        };
      });

      return {
        IdPhieu: formValues.idphieu || null,
        NgaySX: formValues.NgaySX ? formValues.NgaySX.format("YYYY-MM-DD") : null,
        Ca: formValues.ca ?? 0,
        BieuMau: config.code,
        Details: details,
        Summary: summary,
      };
    },
    [config.code, scopeMap, table1Data]
  );

  const mapDetailsResponse = useCallback((rawDetails: any[]): STD_NXT_HRC1_Table1Row[] => {
    const kvList = config.layout1?.[0]?.khuVucList || [];
    const getKhuVucByScope = (scope: number): string => {
      const idx = scope - 1;
      const kv = kvList[idx];
      return kv?.label ? String(kv.label) : String(scope);
    };
    return (rawDetails || []).map((item: any, index: number) => {
      const scope = Number(item.scope ?? item.Scope) || 0;
      const khuVuc = getKhuVucByScope(scope);
      return {
        key: `${scope}_${item.phuLieuID ?? item.PhuLieuID}_${item.viTri ?? item.ViTri}_${index}`,
        khuVuc,
        viTri: Number(item.viTri ?? item.ViTri) || 1,
        nguyenNhienLieu: item.tenNguyenLieu ?? item.TenNguyenLieu ?? "",
        idPhuLieu: item.phuLieuID ?? item.PhuLieuID ?? null,
        siloId: item.idSilo ?? item.IDSilo ?? item.siloId ?? null,
        tenSilo: item.tenSilo ?? item.TenSilo ?? null,
        tonDauCa: item.tonDauCa ?? item.TonDauCa ?? null,
        tuongQuanDauCa: item.tuongQuanDauCa ?? item.TuongQuanDauCa ?? "",
        mucLieu: item.mucLieu ?? item.MucLieu ?? null,
        theTich: item.theTich ?? item.TheTich ?? null,
        tyTrong: item.tyTrong ?? item.TyTrong ?? null,
        nhapTrongCa: item.nhapVaoTrongCa ?? item.NhapVaoTrongCa ?? null,
        tonCuoiCa: item.tonCuoiCa ?? item.TonCuoiCa ?? null,
        tuongQuanCuoiCa: item.tuongQuanCuoiCa ?? item.TuongQuanCuoiCa ?? "",
        tongThucTe: item.tongThucTe ?? item.TongThucTe ?? null,
        luongSuDungKiemKe: item.luongSuDungKiemKe ?? item.LuongSuDungKiemKe ?? null,
      };
    });
  }, [config.layout1]);

  const mapSummaryResponse = useCallback((rawSummary: any[], ngaySxStr?: string, caVal?: number): STD_NXT_HRC1_Table2Row[] => {
    return (rawSummary || []).map((item: any) => ({
      key: `summary_${item.phuLieuID ?? item.PhuLieuID}`,
      totalNguyenNhienLieu: item.tenNguyenLieu ?? item.TenNguyenLieu ?? "",
      totalTonDauCa: item.tongTonDauCa ?? item.TongTonDauCa ?? null,
      totalNhapTrongCa: item.tongTonNhapTrongCa ?? item.TongTonNhapTrongCa ?? null,
      totalTonCuoiCa: item.tongTonCuoiCa ?? item.TongTonCuoiCa ?? null,
      totalSuDung: item.tongSuDung ?? item.TongSuDung ?? null,
      totalSDTrongSoSach: item.tongSDTrenSoSach ?? item.TongSDTrenSoSach ?? null,
      totalChenhLech: item.chenhLech ?? item.ChenhLech ?? null,
      HasPhanBo: item.hasPhanBo ?? item.HasPhanBo ?? null,
      PhuLieuID: item.phuLieuID ?? item.PhuLieuID ?? null,
      NgaySX: ngaySxStr,
      Ca: caVal,
      tyLeBOF: item.tyLeBOF ?? item.TyLeBOF ?? null,
      tyLeLF: item.tyLeLF ?? item.TyLeLF ?? null,
      KLPB_BOF: item.klpB_BOF ?? item.klpb_BOF ?? item.KLPB_BOF ?? null,
      KLPB_LF: item.klpB_LF ?? item.klpb_LF ?? item.KLPB_LF ?? null,
    }));
  }, []);

  // Hàm khởi tạo dữ liệu ban đầu
  const initData = useCallback(async () => {
    try {
      setLoading(true);
      let tinhTrangFromRes: number = TrangThaiPhieuConst.DangLuu;
      let nguoiTaoIdFromRes: number | null = null;
      if (idphieu) {
        const res = await safeGetDetail(() => PhieuApi.getDetail(idphieu));
        if (!res) return;

        const phieuPayload = (res as any)?.data ?? res;
        tinhTrangFromRes = (phieuPayload as any)?.tinhTrang ?? TrangThaiPhieuConst.DangLuu;
        nguoiTaoIdFromRes = (phieuPayload as any)?.nguoiTaoId ?? null;
        const formData = phieuPayload?.jsonData || {};

        const { NgaySX, ca, ...restFormData } = formData;
        form.setFieldsValue({
          idphieu: phieuPayload?.idphieu,
          NgaySX: NgaySX ? dayjs(NgaySX) : null,
          ca: ca ?? phieuPayload?.ca,
          ...restFormData,
        });

        const detailRes: any = await STD_NXT_HRC1ServiceApi.getDetail(idphieu);
        const data = detailRes?.data;

        const mappedDetails = mapDetailsResponse(data?.details || []);
        const ngaySxStr = (data?.ngaySX ?? data?.NgaySX) != null ? (typeof (data?.ngaySX ?? data?.NgaySX) === "string" ? (data?.ngaySX ?? data?.NgaySX) : (data?.ngaySX ?? data?.NgaySX)?.format?.("YYYY-MM-DD")) : undefined;
        const caVal = data?.ca ?? data?.Ca ?? undefined;
        const mappedSummary = mapSummaryResponse(data?.summary || [], ngaySxStr, caVal);

        setTable1Data(mappedDetails);
        setTable2Data(mappedSummary);
      }

      const shouldUseCurrentUser =
        !idphieu ||
        tinhTrangFromRes === TrangThaiPhieuConst.DangLuu ||
        tinhTrangFromRes === TrangThaiPhieuConst.DaThuHoi ||
        tinhTrangFromRes === TrangThaiPhieuConst.HieuChinh;
      const hasNguoiTaoId = nguoiTaoIdFromRes != null && Number(nguoiTaoIdFromRes) > 0;
      const sigOverrides: Record<string, any> = {};
      config.signatures
        .filter((sig: any) => sig.isChon && sig.capduyet === 0)
        .forEach((sig: any) => {
          if (shouldUseCurrentUser)
            sigOverrides[sig.key] = currentUserInfo?.iD_TaiKhoan ?? null;
          else if (hasNguoiTaoId)
            sigOverrides[sig.key] = nguoiTaoIdFromRes;
        });
      if (Object.keys(sigOverrides).length > 0) form.setFieldsValue(sigOverrides);
    } catch (err: any) {
      console.error("Lỗi khởi tạo dữ liệu:", err);
      message.error("Không thể tải dữ liệu ban đầu!");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, idphieu, safeGetDetail, currentUserInfo?.iD_TaiKhoan, mapDetailsResponse, mapSummaryResponse]);

  const getFormData = useCallback(async (skipValidation = false) => {
    const userInfo = getUserInfo();
    if (!skipValidation) {
      const headerFieldKeys = config.headerFields.map((f: any) => f.key);
      await form.validateFields(headerFieldKeys);
    }
    const values = form.getFieldsValue(true);

    const table1Normalized = (table1Data || []).map((row) => ({
      ...row,
      tonDauCa: Number(row.tonDauCa || 0),
      tuongQuanDauCa: row.tuongQuanDauCa ?? "",
      nhapTrongCa: Number(row.nhapTrongCa || 0),
      tonCuoiCa: Number(row.tonCuoiCa || 0),
      tuongQuanCuoiCa: row.tuongQuanCuoiCa ?? "",
      tongThucTe: Number(row.tongThucTe || 0),
      luongSuDungKiemKe: row.luongSuDungKiemKe != null && row.luongSuDungKiemKe !== "" ? Number(row.luongSuDungKiemKe) : null,
    }));

    if (!skipValidation) {
      // Chỉ chặn lưu khi có ô dữ liệu âm — không bắt buộc Silo/kiểm kê nhất quán/tồn cuối khớp tồn đầu
      // nữa, để cho phép lưu thoải mái theo tiến độ nhập liệu thực tế (nhập tới đâu lưu tới đó).
      const isNeg = (v: unknown) => {
        if (v === null || v === undefined || v === "") return false;
        const num = typeof v === "number" ? v : Number(v);
        return !Number.isNaN(num) && num < 0;
      };
      const numericFields: { field: keyof typeof table1Normalized[0]; label: string }[] = [
        { field: "tonDauCa", label: "Tồn đầu ca" },
        { field: "nhapTrongCa", label: "Nhập trong ca" },
        { field: "tonCuoiCa", label: "Tồn cuối ca" },
        { field: "tongThucTe", label: "Tổng thực tế" },
        { field: "luongSuDungKiemKe", label: "Lượng sử dụng kiểm kê" },
      ];
      console.log("Kiểm tra dữ liệu âm trong table1:", table1Normalized);
      for (const { field, label } of numericFields) {
        const negRows = table1Normalized.filter((row) => isNeg(row[field]));
        if (negRows.length > 0) {
          const tenNguyenLieu = negRows.map((r) => r.nguyenNhienLieu || "(không tên)").join(", ");
          message.error(`${label} không được âm. Vui lòng kiểm tra lại: ${tenNguyenLieu}`);
          throw new Error(`Validation failed: ${field} âm`);
        }
      }
    }

    const table2Normalized = (table2Data || []).map((row) => ({
      ...row,
      totalTonDauCa: Number(row.totalTonDauCa || 0),
      totalNhapTrongCa: Number(row.totalNhapTrongCa || 0),
      totalTonCuoiCa: Number(row.totalTonCuoiCa || 0),
      totalSuDung: Number(row.totalSuDung || 0),
      totalSDTrongSoSach: Number(row.totalSDTrongSoSach || 0),
      totalChenhLech: Number(row.totalChenhLech || 0),
      tyLeBOF: row.tyLeBOF != null ? Number(row.tyLeBOF) : null,
      tyLeLF: row.tyLeLF != null ? Number(row.tyLeLF) : null,
    }));

    // Tính nxtPayload TRƯỚC khi validate, vì Summary của nó luôn được tính lại trực tiếp từ table1Data
    // (nguồn dữ liệu mới nhất) — khác với table2Data (state của SummaryTableSTD_HRC1), chỉ được đồng bộ
    // khi người dùng sửa tay ô "Tổng SD sổ sách" hoặc tỷ lệ BOF/LF trên bảng tổng hợp. Nếu người dùng chỉ
    // sửa số liệu ở Bảng 1 (chi tiết) để hết âm, table2Data không được cập nhật theo nên vẫn giữ giá trị
    // âm cũ dù UI đã hiển thị đúng, khiến validate chặn lưu oan. Dùng nxtPayload.Summary để validate cho
    // khớp với dữ liệu thực sự sẽ được lưu.
    const nxtPayload = buildNxtUpsertPayload(values);

    if (!skipValidation) {
      const isNegSummary = (v: unknown) => {
        if (v === null || v === undefined || v === "") return false;
        const num = typeof v === "number" ? v : Number(v);
        return !Number.isNaN(num) && num < 0;
      };
      const summaryNumericFields: { field: keyof NXTSummaryDto_HRC1; label: string }[] = [
        { field: "TongTonDauCa", label: "Tổng khối lượng tồn đầu ca" },
        { field: "TongNhapTrongCa", label: "Tổng khối lượng nhập trong ca" },
        { field: "TongTonCuoiCa", label: "Tổng khối lượng tồn cuối ca" },
        { field: "TongSuDung", label: "Tổng sử dụng" },
      ];
      for (const { field, label } of summaryNumericFields) {
        const negRows = nxtPayload.Summary.filter((row) => isNegSummary(row[field]));
        if (negRows.length > 0) {
          const tenNguyenLieu = negRows.map((r) => r.TenNguyenLieu || "(không tên)").join(", ");
          message.error(`${label} đang âm. Vui lòng kiểm tra lại: ${tenNguyenLieu}`);
          throw new Error(`Validation failed: ${field} âm (table2)`);
        }
      }
    }

    return {
      ...values,
      NgaySX: values.NgaySX ? values.NgaySX.format("YYYY-MM-DD") : null,
      maBm: config.code,
      prefix: config.prefix,
      scope: 0,
      nguoiTaoId: userInfo.iD_TaiKhoan ?? null,
      xuongId: userInfo.iD_PhanXuong ?? null,
      idphongBan: userInfo.iD_PhongBan ?? null,
      table1: table1Normalized,
      table2: table2Normalized,
      nxtPayload,
    };
  }, [getUserInfo, form, config.headerFields, config.code, config.prefix, table1Data, table2Data, buildNxtUpsertPayload]);

  const handleSave = useCallback(async () => {
    try {
      setLoading(true);
      const formData = await getFormData();
      const nxtPayload = (formData as any)?.nxtPayload as STD_NXT_HRC1_UpsertDto | undefined;
      console.log("Lưu phiếu với dữ liệu:", formData, "và payload NXT:", nxtPayload);
      if (idphieu) {
        await PhieuApi.putData(idphieu, formData as Record<string, unknown>);
        if (nxtPayload) {
          nxtPayload.IdPhieu = idphieu;
          await STD_NXT_HRC1ServiceApi.upsert(nxtPayload);
        }
        message.success("Lưu thành công!");
        await initData();
      } else {
        const res = await PhieuApi.postData(formData as Record<string, unknown>);
        const newId = (res as any)?.idphieu || (res as any)?.data?.idphieu;
        message.success("Lưu thành công!");
        if (newId) navigateToDetail(newId, "/tao_std_hrc1");
      }
    } catch (err: any) {
      if (err?.message?.startsWith("Validation")) return;
      message.error("Lưu thất bại!");
    } finally {
      setLoading(false);
    }
  }, [getFormData, idphieu, navigateToDetail, initData]);

  /** Gọi khi load lần đầu */
  useEffect(() => {
    initData();
  }, [initData]);

  const layout1Raw = config.layout1?.[0];
  const layout1 = layout1Raw
    ? {
        ...layout1Raw,
        columns: (layout1Raw.columns || [])
          .filter((col: any) => !col.hidden)
          .map((col: any) =>
            col.children
              ? { ...col, children: col.children.filter((c: any) => !c.hidden) }
              : col
          ),
      }
    : undefined;
  const layout2 = config.layout2?.[0];

  const getRelatedTargets = useCallback((): STD_NXT_RelatedPhieuTarget[] => {
    const kvList = config.layout1?.[0]?.khuVucList || [];
    return kvList
      .filter((kv: any) => kv?.bieuMau && kv?.scope != null)
      .map((kv: any) => ({
        tabKey: `kv_${String(kv?.label || kv?.value || "")}`,
        label: String(kv?.label || kv?.value || ""),
        bieuMau: String(kv?.bieuMau || ""),
        scope: Number(kv?.scope),
      }));
  }, [config.layout1]);

  const tinhTrangLabel = useCallback((status: number | null | undefined) => {
    switch (status) {
      case 0:
        return "Đang lưu";
      case 1:
        return "Đã gửi";
      case 2:
        return "Hoàn thành";
      case 5:
        return "Đã chốt";
      case 7:
        return "Đang hiệu chỉnh";
      default:
        return status == null ? "Chưa có phiếu" : `Trạng thái ${status}`;
    }
  }, []);

  const loadRelatedPhieuStatuses = useCallback(async (): Promise<boolean> => {
    try {
      const ngayValue = form.getFieldValue("NgaySX");
      const caValue = form.getFieldValue("ca");
      const ngay = ngayValue ? dayjs(ngayValue).format("YYYY-MM-DD") : null;
      const ca = caValue != null ? Number(caValue) : null;
      if (!ngay || !ca) {
        setRelatedStatusMap({});
        setCanPhanBo(true);
        setIsLockedByChot(false);
        return true;
      }

      const targets = getRelatedTargets();
      const res: any = await STD_NXT_HRC1ServiceApi.getRelatedPhieuStatuses({
        NgaySX: ngay,
        Ca: ca,
        Targets: targets,
      });

      const payload = (res as any)?.data ?? res;
      const data = payload?.data ?? payload;
      const items = (data?.items ?? data?.Items ?? []) as STD_NXT_RelatedPhieuStatusItem[];
      const canPhanBoFromServer =
        (data?.canPhanBo ?? data?.CanPhanBo ?? true) as boolean;

      const nextMap: Record<string, STD_NXT_RelatedPhieuStatusItem> = {};
      items.forEach((x) => {
        const key = String(x?.tabKey ?? (x as any)?.TabKey ?? "");
        if (key) nextMap[key] = x;
      });
      setRelatedStatusMap(nextMap);
      setCanPhanBo(Boolean(canPhanBoFromServer));
      const hasChot = items.some((x) => (x?.tinhTrang ?? (x as any)?.TinhTrang) === 5);
      setIsLockedByChot(hasChot);
      if (!canPhanBoFromServer) {
        setSummaryTableRemountKey((k) => k + 1);
      }
      return Boolean(canPhanBoFromServer);
    } catch (error) {
      console.error("Không thể tải trạng thái phiếu theo tab:", error);
      setRelatedStatusMap({});
      setCanPhanBo(true);
      setIsLockedByChot(false);
      return true;
    }
  }, [form, getRelatedTargets]);

  useEffect(() => {
    loadRelatedPhieuStatuses();
  }, [loadRelatedPhieuStatuses, watchedNgaySX, watchedCa]);

  const refreshSummaryAndStatus = useCallback(async () => {
    if (idphieu) {
      await initData();
    }
    await loadRelatedPhieuStatuses();
  }, [idphieu, initData, loadRelatedPhieuStatuses]);

  const handlePhanBoSummary = useCallback(
    async (dto: STD_NXT_HRC1_PhanBoDto) => {
      try {
        if (!idphieu) {
          message.warning("Vui lòng lưu phiếu trước khi phân bổ.");
          return;
        }
        const values = await form.validateFields(["NgaySX", "ca"]);
        const ngay = values.NgaySX ? values.NgaySX.format("YYYY-MM-DD") : null;
        const caVal = values.ca;
        if (!ngay || !caVal) {
          message.warning("Vui lòng chọn Ngày và Ca trước khi phân bổ.");
          return;
        }
        const canPhanBo = await loadRelatedPhieuStatuses();
        if (!canPhanBo) {
          message.warning("Không thể phân bổ vì có ít nhất 1 phiếu tiêu hao BOF/LF chưa hoàn thành.");
          return;
        }
        const payload: STD_NXT_HRC1_PhanBoDto = {
          NgaySX: ngay,
          Ca: Number(caVal),
          PhuLieuID: dto.PhuLieuID,
          ChenhLech: dto.ChenhLech,
          IdPhieu: idphieu,
          TyLeBOF: dto.TyLeBOF ?? null,
          TyLeLF: dto.TyLeLF ?? null,
        };
        setLoading(true);
        try {
          const res = await STD_NXT_HRC1ServiceApi.phanBo(payload);
          const ok = (res as any)?.data ?? res;
          if (ok === true) {
            message.success("Phân bổ chênh lệch thành công.");
            await refreshSummaryAndStatus();
          } else {
            message.warning("Phân bổ không thành công.");
            await refreshSummaryAndStatus();
          }
        } catch (apiError: any) {
          console.error("Phân bổ thất bại:", apiError);
          message.error(apiError?.message || apiError || "Không thể phân bổ. Vui lòng thử lại.");
          await refreshSummaryAndStatus();
        } finally {
          setLoading(false);
        }
      } catch (error: any) {
        if (error?.errorFields) {
          return;
        }
        console.error("Phân bổ thất bại:", error);
        message.error(error?.message || error || "Không thể phân bổ. Vui lòng thử lại.");
      }
    },
    [form, idphieu, loadRelatedPhieuStatuses, refreshSummaryAndStatus]
  );

  const handleThuHoiSummary = useCallback(
    async (dto: STD_NXT_HRC1_PhanBoDto) => {
      try {
        if (!idphieu) {
          message.warning("Vui lòng lưu phiếu trước khi thu hồi phân bổ.");
          return;
        }
        const values = await form.validateFields(["NgaySX", "ca"]);
        const ngay = values.NgaySX ? values.NgaySX.format("YYYY-MM-DD") : null;
        const caVal = values.ca;
        if (!ngay || !caVal) {
          message.warning("Vui lòng chọn Ngày và Ca trước khi thu hồi phân bổ.");
          return;
        }
        const payload: STD_NXT_HRC1_PhanBoDto = {
          NgaySX: ngay,
          Ca: Number(caVal),
          PhuLieuID: dto.PhuLieuID,
          ChenhLech: dto.ChenhLech,
          IdPhieu: idphieu,
          TyLeBOF: dto.TyLeBOF ?? null,
          TyLeLF: dto.TyLeLF ?? null,
        };
        setLoading(true);
        try {
          const res = await STD_NXT_HRC1ServiceApi.thuHoiPhanBo(payload);
          const ok = (res as any)?.data ?? res;
          if (ok === true) {
            message.success("Thu hồi phân bổ thành công.");
            await refreshSummaryAndStatus();
          } else {
            message.warning("Thu hồi phân bổ không thành công.");
            await refreshSummaryAndStatus();
          }
        } catch (apiError: any) {
          console.error("Thu hồi phân bổ thất bại:", apiError);
          message.error(apiError?.message || "Không thể thu hồi phân bổ. Vui lòng thử lại.");
          await refreshSummaryAndStatus();
        } finally {
          setLoading(false);
        }
      } catch (error: any) {
        if (error?.errorFields) {
          return;
        }
        console.error("Thu hồi phân bổ thất bại:", error);
        message.error(error?.message || "Không thể thu hồi phân bổ. Vui lòng thử lại.");
      }
    },
    [form, idphieu, refreshSummaryAndStatus]
  );

  const handleKhongPhanBoSummary = useCallback(
    async (dto: STD_NXT_HRC1_PhanBoDto) => {
      try {
        if (!idphieu) {
          message.warning("Vui lòng lưu phiếu trước khi không phân bổ.");
          return;
        }
        const values = await form.validateFields(["NgaySX", "ca"]);
        const ngay = values.NgaySX ? values.NgaySX.format("YYYY-MM-DD") : null;
        const caVal = values.ca;
        if (!ngay || !caVal) {
          message.warning("Vui lòng chọn Ngày và Ca trước khi không phân bổ.");
          return;
        }
        const canPhanBo = await loadRelatedPhieuStatuses();
        if (!canPhanBo) {
          message.warning("Không thể thực hiện vì có ít nhất 1 phiếu tiêu hao BOF/LF chưa hoàn thành.");
          return;
        }
        const payload: STD_NXT_HRC1_KhongPhanBoDto = {
          NgaySX: ngay,
          Ca: Number(caVal),
          PhuLieuID: dto.PhuLieuID,
          IdPhieu: idphieu,
        };
        setLoading(true);
        try {
          const res = await STD_NXT_HRC1ServiceApi.khongPhanBo(payload);
          const ok = (res as any)?.data ?? res;
          if (ok === true) {
            message.success("Không phân bổ thành công.");
            await refreshSummaryAndStatus();
          } else {
            message.warning("Không phân bổ không thành công.");
            await refreshSummaryAndStatus();
          }
        } catch (apiError: any) {
          console.error("Không phân bổ thất bại:", apiError);
          message.error(apiError?.message || "Không thể không phân bổ. Vui lòng thử lại.");
          await refreshSummaryAndStatus();
        } finally {
          setLoading(false);
        }
      } catch (error: any) {
        if (error?.errorFields) {
          return;
        }
        console.error("Không phân bổ thất bại:", error);
        message.error(error?.message || "Không thể không phân bổ. Vui lòng thử lại.");
      }
    },
    [form, idphieu, loadRelatedPhieuStatuses, refreshSummaryAndStatus]
  );

  const handleResetAllSummary = useCallback(
    async (rows: Array<STD_NXT_HRC1_PhanBoDto & { IsPhanBo: boolean }>) => {
      if (!idphieu || rows.length === 0) return;
      setLoading(true);
      try {
        await Promise.all(
          rows.map((r) =>
            r.IsPhanBo
              ? STD_NXT_HRC1ServiceApi.thuHoiPhanBo({
                  NgaySX: r.NgaySX,
                  Ca: r.Ca,
                  PhuLieuID: r.PhuLieuID,
                  ChenhLech: r.ChenhLech,
                  IdPhieu: idphieu,
                  TyLeBOF: 0,
                  TyLeLF: 0,
                })
              : STD_NXT_HRC1ServiceApi.khongPhanBo({
                  NgaySX: r.NgaySX,
                  Ca: r.Ca,
                  PhuLieuID: r.PhuLieuID,
                  IdPhieu: idphieu,
                })
          )
        );
        message.success(`Đã reset ${rows.length} phụ liệu về trạng thái ban đầu.`);
      } catch (err: any) {
        message.error(err?.message || "Reset tất cả thất bại. Vui lòng thử lại.");
      } finally {
        await refreshSummaryAndStatus();
        setLoading(false);
      }
    },
    [idphieu, refreshSummaryAndStatus]
  );

  const handleFilterData = useCallback(async () => {
    try {
      const values = await form.validateFields(["NgaySX", "ca"]);
      const ngay = values.NgaySX ? values.NgaySX.format("YYYY-MM-DD") : null;
      const caVal = values.ca;
      if (!ngay || !caVal) {
        message.warning("Vui lòng chọn Ngày và Ca trước khi lọc dữ liệu");
        return;
      }
      const idphieuVal = form.getFieldValue("idphieu") ?? idphieu;
      const phuLieuIds = [...new Set(
        table1Data
          .map((r) => r.idPhuLieu)
          .filter((id): id is number => id != null && id !== undefined && Number(id) > 0)
      )];
      const res = await dlnmHRC1Api.filterSTD_NXT({
        NgaySX: ngay,
        Ca: Number(caVal),
        ...(idphieuVal ? { idPhieu: idphieuVal } : {}),
        ...(phuLieuIds.length > 0 ? { PhuLieuIds: phuLieuIds } : {}),
      });
      const payload = (res as any)?.data ?? res;
      const resultData = Array.isArray(payload) ? (payload as any[]) : [];

      const kvList = config.layout1?.[0]?.khuVucList || [];
      const findKhuVucLabel = (bieuMau: string | null | undefined, scope: number | null | undefined) => {
        const match = kvList.find((kv: any) => kv?.bieuMau === bieuMau && Number(kv?.scope) === Number(scope));
        return match?.label || match?.value || "";
      };

      // Khi có idphieu: BE đã chạy Init và cập nhật DB → load lại detail từ BE rồi mới đổ resultData lên
      if (idphieuVal) {
        const detailRes: any = await STD_NXT_HRC1ServiceApi.getDetail(idphieuVal);
        const data = detailRes?.data;
        const mappedDetails = mapDetailsResponse(data?.details || []);
        const ngaySxStr = (data?.ngaySX ?? data?.NgaySX) != null ? (typeof (data?.ngaySX ?? data?.NgaySX) === "string" ? (data?.ngaySX ?? data?.NgaySX) : (data?.ngaySX ?? data?.NgaySX)?.format?.("YYYY-MM-DD")) : undefined;
        const caValResp = data?.ca ?? data?.Ca ?? undefined;
        const mappedSummary = mapSummaryResponse(data?.summary || [], ngaySxStr, caValResp);

        // Giữ lại các dòng thêm tay (isManualNew) chưa lưu lên BE
        const manualNewRows = table1Data
          .filter((r: any) => r.isManualNew === true)
          .map((r: any) => ({ ...r, tongThucTe: 0 }));

        const currentRows = [
          ...mappedDetails.map((r) => ({ ...r, tongThucTe: 0 })),
          ...manualNewRows,
        ];

        resultData.forEach((item: any) => {
          const bieuMau = item.bieuMau ?? item.BieuMau;
          const scope = item.scope ?? item.Scope;
          const khuVucLabel = findKhuVucLabel(bieuMau, scope);
          if (!khuVucLabel) return;
          const targetPhuLieuId = item.phuLieuID ?? item.PhuLieuID ?? null;
          if (!targetPhuLieuId) return;
          const totalKL = (item.totalKLPhuGia ?? item.TotalKLPhuGia ?? 0) as number;

          currentRows.forEach((row, idx) => {
            if (row.khuVuc !== khuVucLabel) return;
            if (row.idPhuLieu === targetPhuLieuId) {
              currentRows[idx] = { ...currentRows[idx], tongThucTe: totalKL ?? 0 };
            }
          });
        });

        setTable1Data(currentRows);
        setTable2Data(mappedSummary);
      } else {
        // Không có phiếu: giữ logic cũ, đổ filter lên prev
        setTable1Data((prev: STD_NXT_HRC1_Table1Row[]) => {
          const currentRows = prev.map((r) => ({ ...r, tongThucTe: 0 }));

          resultData.forEach((item: any) => {
            const bieuMau = item.bieuMau ?? item.BieuMau;
            const scope = item.scope ?? item.Scope;
            const khuVucLabel = findKhuVucLabel(bieuMau, scope);
            if (!khuVucLabel) return;
            const targetPhuLieuId = item.phuLieuID ?? item.PhuLieuID ?? null;
            if (!targetPhuLieuId) return;
            const totalKL = (item.totalKLPhuGia ?? item.TotalKLPhuGia ?? 0) as number;

            currentRows.forEach((row, idx) => {
              if (row.khuVuc !== khuVucLabel) return;
              if (row.idPhuLieu === targetPhuLieuId) {
                currentRows[idx] = { ...currentRows[idx], tongThucTe: totalKL ?? 0 };
              }
            });
          });
          return currentRows;
        });
      }

      if (resultData.length === 0) {
        message.info("Không có dữ liệu phụ liệu cho Ngày/Ca đã chọn (đã reset Tổng thực tế sử dụng = 0)");
      } else {
        message.success("Đã lọc dữ liệu phụ liệu theo ngày/ca");
      }

      await loadRelatedPhieuStatuses();
    } catch (error: any) {
      console.error("Lọc dữ liệu thất bại:", error);
      message.error(error?.message || "Không thể lọc dữ liệu");
    }
  }, [form, config.layout1, setTable1Data, table1Data, idphieu, loadRelatedPhieuStatuses, mapDetailsResponse, mapSummaryResponse]);

  return (
    <Card className="mt-6 shadow-md">
      {/* Tiêu đề biên bản */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex-1 text-center">
          <Typography.Title level={3} className="mb-0">
            {config.title}
          </Typography.Title>
        </div>
      </div>

      <Form form={form} layout="vertical">
        <Form.Item name="idphieu" hidden>
          <Input type="hidden" />
        </Form.Item>

        {/* HEADER - các trường nhập đầu */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            maxWidth: 900,
            margin: "0 auto",
            padding: "8px 0",
          }}
        >
          {config.headerFields.map((f, idx) => (
            <div key={f.key || idx} style={{ flex: "0 0 260px", maxWidth: 320 }}>
              <CustomFormItem field={f} idx={idx} disabled={false}/>
            </div>
          ))}
          <div style={{ flex: "0 0 160px", maxWidth: 160 }}>
            <Button
              type="primary"
              onClick={handleFilterData}
              style={{
                height: 35,
                width: "100%",
                borderRadius: 8,
              }}
            >
              Làm mới
            </Button>
          </div>
        </div>

        {/* TABS: summaryTable + mỗi khuVuc 1 tab */}
        {(() => {
          const kvList = layout1?.khuVucList || [];
          const kvLabels: string[] = kvList
            .map((k: any) => k?.label || k?.value || "")
            .filter((x: string) => !!x);

          const tabItems = [
            // Tab 0: Tổng hợp (summaryTable)
            ...(layout2 && layout2.sectionType === "summaryTable"
              ? [
                  {
                    key: "summary",
                    label: layout2.title || "Tổng hợp",
                    children: (
                      <SummaryTableSTD_HRC1
                        key={`summary-std-hrc1-${idphieu ?? "new"}-${summaryTableRemountKey}`}
                        columns={layout2.columns || []}
                        table1Data={table1Data}
                        initialData={table2Data}
                        onDataChange={setTable2Data}
                        onPhanBo={handlePhanBoSummary}
                        onThuHoi={handleThuHoiSummary}
                        onKhongPhanBo={handleKhongPhanBoSummary}
                        onResetAll={handleResetAllSummary}
                        canPhanBo={canPhanBo}
                        idPhieu={idphieu ?? undefined}
                        editable={true}
                        loading={loading}
                        lockedTooltip={isLockedByChot ? "Đã có phiếu được chốt" : undefined}
                      />
                    ),
                  },
                ]
              : []),
            // Tab per khuVuc
            ...(layout1 && layout1.sectionType === "groupedTable"
              ? kvLabels.map((kvLabel) => ({
                  key: `kv_${kvLabel}`,
                  label: (
                    <span>
                      {kvLabel}
                      {(() => {
                        const key = `kv_${kvLabel}`;
                        const statusItem = relatedStatusMap[key];
                        const status =
                          statusItem?.tinhTrang ??
                          (statusItem as any)?.TinhTrang;
                        const statusKey =
                          status !== undefined && status !== null
                            ? String(status)
                            : undefined;
                        const cfg = statusKey
                          ? PHIEU_STATUS_CONFIG[statusKey]
                          : undefined;
                        return cfg ? (
                          <Tag
                            color={cfg.color}
                            style={{ marginLeft: 6, fontSize: 12 }}
                          >
                            {cfg.text}
                          </Tag>
                        ) : (
                          <span
                            style={{
                              marginLeft: 6,
                              fontSize: 12,
                              opacity: 0.85,
                            }}
                          >
                            ({tinhTrangLabel(status)})
                          </span>
                        );
                      })()}
                    </span>
                  ),
                  children: (
                    <GroupedTableSTD_HRC1
                      columns={layout1.columns || []}
                      initialData={table1Data.filter(
                        (r: any) => r.khuVuc === kvLabel
                      )}
                      onDataChange={(kvRows: any[]) =>
                        setTable1Data((prev: any[]) => [
                          ...prev.filter((r: any) => r.khuVuc !== kvLabel),
                          ...kvRows,
                        ])
                      }
                      khuVucList={[kvLabel]}
                      defaultNguyenNhienLieu={[]}
                      defaultViTri={layout1.defaultViTri || 1}
                      editable={true}
                      loading={loading}
                      khuVucConfig={kvList}
                      nhaMay={1}
                    />
                  ),
                }))
              : []),
          ];

          return (
            <Tabs
              style={{ marginTop: 24 }}
              items={tabItems}
              type="card"
              size="small"
            />
          );
        })()}

        {/* SIGNATURES - ký tên */}
        <div
          style={{
            marginTop: 40,
            display: "flex",
            justifyContent: "space-around",
            gap: 24,
          }}
        >
          {config.signatures
            .filter((x) => x.isChon)
            ?.map((sig, i) => {
              return (
                <div key={sig.key || i}>
                  <CustomFormItem
                    field={sig}
                    idx={i}
                  />
                </div>
              );
            })}
        </div>
        <div style={{ textAlign: "center", marginTop: 16, display: "flex", gap: 8, justifyContent: "center" }}>
          {!idphieu && (
            <Button type="primary" onClick={handleSave} loading={loading}>
              Tạo phiếu
            </Button>
          )}
          {idphieu && (
            <Button type="primary" onClick={handleSave} loading={loading}>
              Lưu
            </Button>
          )}
        </div>
      </Form>
    </Card>
  );
};

export default Tao_STD_HRC1;
