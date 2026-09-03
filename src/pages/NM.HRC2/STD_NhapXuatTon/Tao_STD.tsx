/* eslint-disable @typescript-eslint/no-explicit-any */
import HRC2_STD_NXT from "../../../utils/BM_config/HRC2_STD_NXT.json";
import { Card, Form, Input, Typography, message, Button, Tabs, Tag } from "antd";
import dayjs from "dayjs";
import { useState, useEffect, useCallback, useMemo } from "react";
import CustomFormItem from "../../../components/CustomFormItem";
import { PhieuApi } from "../../../services/PhieuApi";
import { usePhieuNavigation } from "../../../hooks/usePhieuNavigation";
// import GroupedTableSTD from "../../../components/GroupedTableSTD";
import GroupedTableSTD from "../../../components/GroupedTableSTD";
import SummaryTableSTD from "../../../components/SummaryTableSTD";
import type {
  STD_NXT_Table1Row,
  STD_NXT_Table2Row,
  STD_NXT_HRC2_UpsertDto,
  NXTSummaryDto,
  STD_NXT_HRC2_PhanBoDto,
  STD_NXT_RelatedPhieuTarget,
  STD_NXT_RelatedPhieuStatusItem,
  STD_NXT_HRC2_KhongPhanBoDto,
} from "../../../models/STD_NXT_Model";
import { STD_NXT_HRC2ServiceApi } from "../../../services/STD_NXT_HRC2ServiceApi";
import { dlnmHRC2Api } from "../../../services/DLNMHRC2Api";
import { PHIEU_STATUS_CONFIG } from "../../../utils/constants/TrangThaiPhieuDisplay";
import { FileExcelOutlined } from "@ant-design/icons";

const Tao_STD = () => {
  const { idphieu, navigateToDetail, safeGetDetail } =
    usePhieuNavigation("std_nxt_hrc2_idphieu", "/std_nhapxuatton");

  const config = HRC2_STD_NXT;
  const [form] = Form.useForm();

  const [table1Data, setTable1Data] = useState<STD_NXT_Table1Row[]>([]);
  const [table2Data, setTable2Data] = useState<STD_NXT_Table2Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [relatedStatusMap, setRelatedStatusMap] = useState<Record<string, STD_NXT_RelatedPhieuStatusItem>>({});
  const [canPhanBo, setCanPhanBo] = useState(true);
  const [isLockedByChot, setIsLockedByChot] = useState(false);
  /** Loading riêng cho nút "Làm mới" */
  const [filterLoading, setFilterLoading] = useState(false);
  /** Loading riêng cho nút "Đồng bộ lại từ NM" */
  const [forceSyncLoading, setForceSyncLoading] = useState(false);
  /** Tăng khi BE trả canPhanBo = false để remount SummaryTableSTD, đồng bộ UI với trạng thái khóa phân bổ */
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

  // Map khu vực -> scope int (lấy từ config.khuVucList value), hỗ trợ key là label hoặc value
  const scopeMap = useMemo(() => {
    const map = new Map<string, number>();
    const kvList = config.layout1?.[0]?.khuVucList || [];
    kvList.forEach((kv: any) => {
      const key = kv?.label ? String(kv.label) : "";
      const valNum = kv?.value !== undefined ? Number(kv.value) : NaN;
      if (!Number.isNaN(valNum)) {
        if (key) map.set(key, valNum);
        const valKey = kv?.value !== undefined ? String(kv.value) : "";
        if (valKey) map.set(valKey, valNum);
      }
    });
    return map;
  }, [config.layout1]);

  // Helper build payload DTO cho API lưu riêng (STD_XUAT_NHAP_TON_HRC2s & STD_NXT_TOTAL_HRC2)
  const buildNxtUpsertPayload = useCallback(
    (formValues: any): STD_NXT_HRC2_UpsertDto => {
      // Details
      const details = (table1Data || []).map((row) => {
        const khuVucKey = row.khuVuc ? String(row.khuVuc) : "";
        const scopeVal = khuVucKey && scopeMap.has(khuVucKey) ? scopeMap.get(khuVucKey) || 0 : 0;
        return {
          Scope: scopeVal,
          ViTri: row.viTri ?? 0,
          Id_HeaderKey: row.idNguyenNhienLieu ?? 0,
          IDSilo: row.siloId ?? null,
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
          LuongSuDungKiemKe: row.luongSuDungKiemKe != null && row.luongSuDungKiemKe !== "" ? Number(row.luongSuDungKiemKe) : null,
        };
      });

      // Map TenNguyenLieu -> Id_HeaderKey từ details
      const idByName: Record<string, number | undefined> = {};
      details.forEach((d) => {
        if (d.TenNguyenLieu) {
          idByName[d.TenNguyenLieu] = d.Id_HeaderKey || idByName[d.TenNguyenLieu];
        }
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
            id: d.Id_HeaderKey || 0,
            tonDau: 0,
            nhap: 0,
            tonCuoi: 0,
            sdss: 0,
          };
        }
        grouped[name].id = d.Id_HeaderKey || grouped[name].id;
        grouped[name].tonDau += d.TonDauCa || 0;
        grouped[name].nhap += d.NhapVaoTrongCa || 0;
        grouped[name].tonCuoi += d.TonCuoiCa || 0;
        grouped[name].sdss += d.TongThucTe || 0; // giả sử TongThucTe là số sổ sách
      });

      const summary: NXTSummaryDto[] = Object.keys(grouped).map((name) => {
        const g = grouped[name];
        const tongSuDung = g.tonDau + g.nhap - g.tonCuoi;
        const chenh = Math.abs(tongSuDung - g.sdss);
        return {
          Id_HeaderKey: g.id,
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
        Scope: 0,
        BieuMau: config.code,
        Details: details,
        Summary: summary,
      };
    },
    [config.code, scopeMap, table1Data]
  );

  // Hàm khởi tạo dữ liệu ban đầu
  const initData = useCallback(async () => {
    try {
      setLoading(true);
      if (idphieu) {
        const res = await safeGetDetail(() => PhieuApi.getDetail(idphieu));
        if (!res) return;

        const phieuPayload = (res as any)?.data ?? res;
        const formData = phieuPayload?.jsonData || {};

        // Khôi phục form values (ưu tiên jsonData). Tách NgaySX/ca để tránh bị override bởi spread.
        const { NgaySX, ca, ...restFormData } = formData;
        form.setFieldsValue({
          idphieu: phieuPayload?.idphieu,
          NgaySX: NgaySX ? dayjs(NgaySX) : null,
          ca: ca ?? phieuPayload?.ca,
          ...restFormData,
        });

        const detailRes: any = await STD_NXT_HRC2ServiceApi.getDetail(idphieu);
        const data = detailRes?.data;

        // Helper: Map scope -> khuVuc (label từ khuVucList)
        const getKhuVucByScope = (scope: number): string => {
          const kvList = config.layout1?.[0]?.khuVucList || [];
          const kv = kvList.find((kv: any) => {
            const valueNum = kv?.value !== undefined ? Number(kv.value) : NaN;
            return !Number.isNaN(valueNum) && valueNum === scope;
          });
          return kv?.label ? String(kv.label) : String(scope);
        };

        // Map details từ BE sang format frontend
        const mappedDetails: STD_NXT_Table1Row[] = (data?.details || []).map((item: any, index: number) => {
          const scope = Number(item.scope) || 0;
          const khuVuc = getKhuVucByScope(scope);
          
          return {
            key: `${scope}_${item.id_HeaderKey}_${item.viTri}_${index}`,
            khuVuc: khuVuc,
            viTri: Number(item.viTri) || 1,
            nguyenNhienLieu: item.tenNguyenLieu || "",
            idNguyenNhienLieu: item.id_HeaderKey || null,
            isUnmapped: !item.id_HeaderKey, // Nếu có id_HeaderKey thì isUnmapped = false
            siloId: item.idSilo ?? item.IDSilo ?? item.siloId ?? null,
            tenSilo: item.tenSilo ?? item.TenSilo ?? null,
            tonDauCa: item.tonDauCa ?? null,
            tuongQuanDauCa: item.tuongQuanDauCa ?? "",
            mucLieu: item.mucLieu ?? null,
            theTich: item.theTich ?? null,
            tyTrong: item.tyTrong ?? null,
            nhapTrongCa: item.nhapVaoTrongCa ?? null,
            tonCuoiCa: item.tonCuoiCa ?? null,
            tuongQuanCuoiCa: item.tuongQuanCuoiCa ?? "",
            tongThucTe: item.tongThucTe ?? null,
            luongSuDungKiemKe: item.luongSuDungKiemKe ?? null,
          };
        });

        // Map summary từ BE sang format frontend (gồm HasPhanBo, Id_HeaderKey, NgaySX, Ca cho SummaryTableSTD)
        const ngaySxStr = (data?.ngaySX ?? data?.NgaySX) != null ? (typeof (data?.ngaySX ?? data?.NgaySX) === "string" ? (data?.ngaySX ?? data?.NgaySX) : (data?.ngaySX ?? data?.NgaySX)?.format?.("YYYY-MM-DD")) : undefined;
        const caVal = data?.ca ?? data?.Ca ?? undefined;
        const mappedSummary: STD_NXT_Table2Row[] = (data?.summary || []).map((item: any) => ({
          key: `summary_${item.id_HeaderKey ?? item.Id_HeaderKey}`,
          totalNguyenNhienLieu: item.tenNguyenLieu ?? item.TenNguyenLieu ?? "",
          totalTonDauCa: item.tongTonDauCa ?? item.TongTonDauCa ?? null,
          totalNhapTrongCa: item.tongTonNhapTrongCa ?? item.TongTonNhapTrongCa ?? null,
          totalTonCuoiCa: item.tongTonCuoiCa ?? item.TongTonCuoiCa ?? null,
          totalSuDung: item.tongSuDung ?? item.TongSuDung ?? null,
          totalSDTrongSoSach: item.tongSDTrenSoSach ?? item.TongSDTrenSoSach ?? null,
          totalChenhLech: item.chenhLech ?? item.ChenhLech ?? null,
          HasPhanBo: item.hasPhanBo ?? item.HasPhanBo ?? null,
          Id_HeaderKey: item.id_HeaderKey ?? item.Id_HeaderKey ?? null,
          NgaySX: ngaySxStr,
          Ca: caVal,
          tyLeBOF: item.tyLeBOF ?? item.TyLeBOF ?? null,
          tyLeTinhLuyen: item.tyLeTinhLuyen ?? item.TyLeTinhLuyen ?? null,
          tyLeRH: item.tyLeRH ?? item.TyLeRH ?? null,
          KLPB_BOF: item.klpB_BOF ?? item.klpb_BOF ?? item.KLPB_BOF ?? null,
          KLPB_TL: item.klpB_TL ?? item.klpb_TL ?? item.KLPB_TL ?? null,
          KLPB_RH: item.klpB_RH ?? item.klpb_RH ?? item.KLPB_RH ?? null,
        }));

        setTable1Data(mappedDetails);
        setTable2Data(mappedSummary);

      }

      // Chữ ký capduyet=0: luôn mặc định current user mỗi lần vào phiếu, để lưu lại đúng người sửa cuối cùng khi lưu
      const sigOverrides: Record<string, any> = {};
      config.signatures
        .filter((sig: any) => sig.isChon && sig.capduyet === 0)
        .forEach((sig: any) => {
          sigOverrides[sig.key] = currentUserInfo?.iD_TaiKhoan ?? null;
        });
      if (Object.keys(sigOverrides).length > 0) form.setFieldsValue(sigOverrides);
    } catch (err: any) {
      console.error("Lỗi khởi tạo dữ liệu:", err);
      message.error("Không thể tải dữ liệu ban đầu!");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, idphieu, safeGetDetail, currentUserInfo?.iD_TaiKhoan]);

  const getFormData = useCallback(async (skipValidation = false) => {
    const userInfo = getUserInfo();
    if (!skipValidation) {
      const headerFieldKeys = config.headerFields.map((f: any) => f.key);
      await form.validateFields(headerFieldKeys);
    }
    // Lấy toàn bộ giá trị form (kể cả idphieu, chữ ký) để build payload đầy đủ
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
      // Validation: Tất cả dòng phải chọn Silo
      const missingSiloRows = table1Normalized.filter((row) => !row.siloId && row.viTri !== 2);
      if (missingSiloRows.length > 0) {
        const byTab = missingSiloRows.reduce<Record<string, string[]>>((acc, r: any) => {
          const tab = String(r?.khuVuc ?? "Không xác định");
          const name = String(r?.nguyenNhienLieu ?? "").trim() || "(không tên)";
          (acc[tab] ||= []).push(name);
          return acc;
        }, {});

        const detailLines = Object.entries(byTab)
          .map(([tab, names]) => `- Tab ${tab}: ${names.join(", ")}`)
          .join("\n");

        message.error(
          `Vui lòng chọn Silo cho tất cả loại liệu trước khi gửi.\nCác dòng chưa chọn theo tab:\n${detailLines}`
        );
        throw new Error("Validation failed: thiếu Silo");
      }

      // Validation: luongSuDungKiemKe phải nhất quán với tongThucTe
      const inconsistentKiemKeRows = table1Normalized.filter((row) => {
        const thucTe = Number(row.tongThucTe);
        const kiemKe = row.luongSuDungKiemKe;
        const kiemKeNum = kiemKe === null || kiemKe === undefined ? 0 : Number(kiemKe);
        if (Number.isNaN(kiemKeNum)) return false;
        return (thucTe === 0 && kiemKeNum !== 0) || (thucTe !== 0 && kiemKeNum === 0);
      });
      if (inconsistentKiemKeRows.length > 0) {
        const byTabKiemKe = inconsistentKiemKeRows.reduce<Record<string, string[]>>((acc, r: any) => {
          const tab = String(r?.khuVuc ?? "Không xác định");
          const name = String(r?.nguyenNhienLieu ?? "").trim() || "(không tên)";
          (acc[tab] ||= []).push(name);
          return acc;
        }, {});
        const detailLinesKiemKe = Object.entries(byTabKiemKe)
          .map(([tab, names]) => `- Tab ${tab}: ${names.join(", ")}`)
          .join("\n");
        message.error(
          `Lượng sử dụng kiểm kê không nhất quán với lượng thực tế sử dụng.\nVui lòng kiểm tra lại theo tab:\n${detailLinesKiemKe}`
        );
        throw new Error("Validation failed: luongSuDungKiemKe không nhất quán với tongThucTe");
      }

      // Validation: các cột số không được âm
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
      for (const { field, label } of numericFields) {
        const negRows = table1Normalized.filter((row) => isNeg(row[field]));
        if (negRows.length > 0) {
          const tenNguyenLieu = negRows.map((r) => r.nguyenNhienLieu || "(không tên)").join(", ");
          message.error(`${label} không được âm. Vui lòng kiểm tra lại: ${tenNguyenLieu}`);
          throw new Error(`Validation failed: ${field} âm`);
        }
      }

      // Validation: Khi SoSuDung = 0 và SoNhapVe = 0 thì SoTonCuoi phải bằng SoTonDau
      const invalidRows = table1Normalized.filter((row) => {
        const soSuDung = row.tongThucTe;
        const soNhapVe = row.nhapTrongCa;
        const soTonDau = row.tonDauCa;
        const soTonCuoi = row.tonCuoiCa;
        return soSuDung === 0 && soNhapVe === 0 && soTonCuoi !== soTonDau;
      });

      if (invalidRows.length > 0) {
        const tenNguyenLieu = invalidRows.map((r) => r.nguyenNhienLieu || "(không tên)").join(", ");
        message.error(
          `Dữ liệu tồn kho không hợp lệ.\nKhi số sử dụng = 0 và số nhập về = 0 thì số tồn cuối phải bằng số tồn đầu.\nVui lòng kiểm tra lại: ${tenNguyenLieu}`
        );
        throw new Error("Validation failed: tồn cuối không bằng tồn đầu");
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
      tyLeTinhLuyen: row.tyLeTinhLuyen != null ? Number(row.tyLeTinhLuyen) : null,
    }));

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
      nxtPayload: buildNxtUpsertPayload(values),
    };
  }, [getUserInfo, form, config.headerFields, config.code, config.prefix, table1Data, table2Data, buildNxtUpsertPayload]);

  const handleSave = useCallback(async () => {
    try {
      setLoading(true);
      const formData = await getFormData(true);
      const nxtPayload = (formData as any)?.nxtPayload as STD_NXT_HRC2_UpsertDto | undefined;
      if (idphieu) {
        await PhieuApi.putData(idphieu, formData as Record<string, unknown>);
        if (nxtPayload) {
          nxtPayload.IdPhieu = idphieu;
          await STD_NXT_HRC2ServiceApi.upsert(nxtPayload);
        }
        message.success("Lưu thành công!");
        await initData();
      } else {
        const res = await PhieuApi.postData(formData as Record<string, unknown>);
         const newId = (res as any)?.idphieu || (res as any)?.data?.idphieu;
        // if (nxtPayload && newId) {
        //   nxtPayload.IdPhieu = newId;
        //   await STD_NXT_HRC2ServiceApi.upsert(nxtPayload);
        // }
        message.success("Lưu thành công!");
        if (newId) navigateToDetail(newId, "/tao-std");
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
      const res: any = await STD_NXT_HRC2ServiceApi.getRelatedPhieuStatuses({
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
    async (dto: STD_NXT_HRC2_PhanBoDto) => {
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
          message.warning("Không thể phân bổ vì có ít nhất 1 phiếu ở tab nấu luyện chưa hoàn thành.");
          return;
        }
        const payload: STD_NXT_HRC2_PhanBoDto = {
          NgaySX: ngay,
          Ca: Number(caVal),
          Id_HeaderKey: dto.Id_HeaderKey,
          ChenhLech: dto.ChenhLech,
          IdPhieu: idphieu,
          TyLeBOF: dto.TyLeBOF ?? null,
          TyLeTinhLuyen: dto.TyLeTinhLuyen ?? null,
          TyLeRH: dto.TyLeRH ?? null,
        };
        setLoading(true);
        try {
          const res = await STD_NXT_HRC2ServiceApi.phanBo(payload);
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
    async (dto: STD_NXT_HRC2_PhanBoDto) => {
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
        const payload: STD_NXT_HRC2_PhanBoDto = {
          NgaySX: ngay,
          Ca: Number(caVal),
          Id_HeaderKey: dto.Id_HeaderKey,
          ChenhLech: dto.ChenhLech,
          IdPhieu: idphieu,
          TyLeBOF: dto.TyLeBOF ?? null,
          TyLeTinhLuyen: dto.TyLeTinhLuyen ?? null,
          TyLeRH: dto.TyLeRH ?? null,
        };
        setLoading(true);
        try {
          const res = await STD_NXT_HRC2ServiceApi.thuHoiPhanBo(payload);
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
    async (dto: STD_NXT_HRC2_PhanBoDto) => {
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
        const payload: STD_NXT_HRC2_KhongPhanBoDto = {
          NgaySX: ngay,
          Ca: Number(caVal),
          Id_HeaderKey: dto.Id_HeaderKey,
          IdPhieu: idphieu,
        };
        setLoading(true);
        try {
          const res = await STD_NXT_HRC2ServiceApi.khongPhanBo(payload);
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
    [form, idphieu, refreshSummaryAndStatus]
  );

  const handleResetAllSummary = useCallback(
    async (rows: Array<STD_NXT_HRC2_PhanBoDto & { IsPhanBo: boolean }>) => {
      if (!idphieu || rows.length === 0) return;
      setLoading(true);
      try {
        await Promise.all(
          rows.map((r) =>
            r.IsPhanBo
              ? STD_NXT_HRC2ServiceApi.thuHoiPhanBo({
                  NgaySX: r.NgaySX,
                  Ca: r.Ca,
                  Id_HeaderKey: r.Id_HeaderKey,
                  ChenhLech: r.ChenhLech,
                  IdPhieu: idphieu,
                  TyLeBOF: 0,
                  TyLeTinhLuyen: 0,
                  TyLeRH: 0,
                })
              : STD_NXT_HRC2ServiceApi.khongPhanBo({
                  NgaySX: r.NgaySX,
                  Ca: r.Ca,
                  Id_HeaderKey: r.Id_HeaderKey,
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

  /** Khu vực có phiếu liên quan (BOF/LF/RH) đang Đã chốt (5) thì không làm mới dữ liệu của riêng khu vực đó */
  const isKhuVucLocked = useCallback(
    (khuVucLabel: string) => {
      const statusItem = relatedStatusMap[`kv_${khuVucLabel}`];
      const status = statusItem?.tinhTrang ?? (statusItem as any)?.TinhTrang;
      return status === 5;
    },
    [relatedStatusMap]
  );

  const handleFilterData = useCallback(async () => {
    setFilterLoading(true);
    try {
      // Chỉ validate Ngày và Ca để tránh yêu cầu các trường ký tên
      const values = await form.validateFields(["NgaySX", "ca"]);
      const ngay = values.NgaySX ? values.NgaySX.format("YYYY-MM-DD") : null;
      const caVal = values.ca;
      if (!ngay || !caVal) {
        message.warning("Vui lòng chọn Ngày và Ca trước khi lọc dữ liệu");
        return;
      }
      const idphieuVal = form.getFieldValue("idphieu") ?? idphieu;
      const headerKeyIds = [...new Set(
        table1Data
          .map((r) => r.idNguyenNhienLieu)
          .filter((id): id is number => id != null && id !== undefined && Number(id) > 0)
      )];
      const res = await dlnmHRC2Api.filterSTD_NXT({
        NgaySX: ngay,
        Ca: Number(caVal),
        ...(idphieuVal ? { idPhieu: idphieuVal } : {}),
        ...(headerKeyIds.length > 0 ? { headerKeyIds } : {}),
      });
      // Map dữ liệu trả về từ filter
      const payload = (res as any)?.data ?? res;
      const resultDataAll = Array.isArray(payload) ? (payload as any[]) : [];

      const kvList = config.layout1?.[0]?.khuVucList || [];
      const findKhuVucLabel = (bieuMau: string | null | undefined, scope: number | null | undefined) => {
        const match = kvList.find((kv: any) => kv?.bieuMau === bieuMau && Number(kv?.scope) === Number(scope));
        return match?.label || match?.value || "";
      };
      // Bỏ qua các item thuộc khu vực đang bị khóa (phiếu liên quan Đã chốt)
      const resultData = resultDataAll.filter((item: any) => {
        const khuVucLabel = findKhuVucLabel(item.bieuMau, item.scope);
        return khuVucLabel ? !isKhuVucLocked(khuVucLabel) : true;
      });
      const lockedKhuVucLabels = new Set(
        kvList
          .map((kv: any) => String(kv?.label || kv?.value || ""))
          .filter((label: string) => label && isKhuVucLocked(label))
      );
      const getKhuVucByScope = (scope: number): string => {
        const kv = kvList.find((kv: any) => {
          const valueNum = kv?.value !== undefined ? Number(kv.value) : NaN;
          return !Number.isNaN(valueNum) && valueNum === scope;
        });
        return kv?.label ? String(kv.label) : String(scope);
      };
      const viTriDefault = config.layout1?.[0]?.defaultViTri ?? 1;
      const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

      // Khi có idphieu: BE đã chạy Init và cập nhật DB → load lại detail từ BE rồi mới đổ resultData lên
      if (idphieuVal) {
        const detailRes: any = await STD_NXT_HRC2ServiceApi.getDetail(idphieuVal);
        const data = detailRes?.data;
        const mappedDetails: STD_NXT_Table1Row[] = (data?.details || []).map((item: any, index: number) => {
          const scope = Number(item.scope) || 0;
          const khuVuc = getKhuVucByScope(scope);
          return {
            key: `${scope}_${item.id_HeaderKey}_${item.viTri}_${index}`,
            khuVuc,
            viTri: Number(item.viTri) || 1,
            nguyenNhienLieu: item.tenNguyenLieu || "",
            idNguyenNhienLieu: item.id_HeaderKey || null,
            isUnmapped: !item.id_HeaderKey,
            siloId: item.idSilo ?? item.IDSilo ?? item.siloId ?? null,
            tenSilo: item.tenSilo ?? item.TenSilo ?? null,
            tonDauCa: item.tonDauCa ?? null,
            tuongQuanDauCa: item.tuongQuanDauCa ?? "",
            mucLieu: item.mucLieu ?? null,
            theTich: item.theTich ?? null,
            tyTrong: item.tyTrong ?? null,
            nhapTrongCa: item.nhapVaoTrongCa ?? null,
            tonCuoiCa: item.tonCuoiCa ?? null,
            tuongQuanCuoiCa: item.tuongQuanCuoiCa ?? "",
            tongThucTe: item.tongThucTe ?? null,
            luongSuDungKiemKe: item.luongSuDungKiemKe ?? null,
          };
        });
        const ngaySxStr = (data?.ngaySX ?? data?.NgaySX) != null ? (typeof (data?.ngaySX ?? data?.NgaySX) === "string" ? (data?.ngaySX ?? data?.NgaySX) : (data?.ngaySX ?? data?.NgaySX)?.format?.("YYYY-MM-DD")) : undefined;
        const caVal = data?.ca ?? data?.Ca ?? undefined;
        const mappedSummary: STD_NXT_Table2Row[] = (data?.summary || []).map((item: any) => ({
          key: `summary_${item.id_HeaderKey ?? item.Id_HeaderKey}`,
          totalNguyenNhienLieu: item.tenNguyenLieu ?? item.TenNguyenLieu ?? "",
          totalTonDauCa: item.tongTonDauCa ?? item.TongTonDauCa ?? null,
          totalNhapTrongCa: item.tongTonNhapTrongCa ?? item.TongTonNhapTrongCa ?? null,
          totalTonCuoiCa: item.tongTonCuoiCa ?? item.TongTonCuoiCa ?? null,
          totalSuDung: item.tongSuDung ?? item.TongSuDung ?? null,
          totalSDTrongSoSach: item.tongSDTrenSoSach ?? item.TongSDTrenSoSach ?? null,
          totalChenhLech: item.chenhLech ?? item.ChenhLech ?? null,
          HasPhanBo: item.hasPhanBo ?? item.HasPhanBo ?? null,
          Id_HeaderKey: item.id_HeaderKey ?? item.Id_HeaderKey ?? null,
          NgaySX: ngaySxStr,
          Ca: caVal,
          tyLeBOF: item.tyLeBOF ?? item.TyLeBOF ?? null,
          tyLeTinhLuyen: item.tyLeTinhLuyen ?? item.TyLeTinhLuyen ?? null,
          tyLeRH: item.tyLeRH ?? item.TyLeRH ?? null,
          KLPB_BOF: item.klpB_BOF ?? item.klpb_BOF ?? item.KLPB_BOF ?? null,
          KLPB_TL: item.klpB_TL ?? item.klpb_TL ?? item.KLPB_TL ?? null,
          KLPB_RH: item.klpB_RH ?? item.klpb_RH ?? item.KLPB_RH ?? null,
        }));

        // Giữ lại các dòng thêm tay (isManualNew) chưa lưu lên BE
        const manualNewRows = table1Data
          .filter((r: any) => r.isManualNew === true)
          .map((r: any) => ({ ...r, tongThucTe: 0 }));

        const currentRows = [
          ...mappedDetails.map((r) =>
            lockedKhuVucLabels.has(r.khuVuc) ? r : { ...r, tongThucTe: 0 }
          ),
          ...manualNewRows,
        ];
        const newUnmappedRows: STD_NXT_Table1Row[] = [];

        resultData.forEach((item: any) => {
          const khuVucLabel = findKhuVucLabel(item.bieuMau, item.scope);
          if (!khuVucLabel) return;
          const targetHeaderId = (item.headerKeyId ?? item.HeaderKeyId) as number | null;
          const targetHeaderName = item.headerKeyName ?? item.HeaderKeyName;
          const totalKL = (item.totalKLPhuGia ?? item.TotalKLPhuGia ?? 0) as number;
          const phuLieus = Array.isArray(item.phuLieus ?? item.PhuLieus) ? (item.phuLieus ?? item.PhuLieus) : [];

          if (targetHeaderId) {
            currentRows.forEach((row, idx) => {
              if (row.khuVuc !== khuVucLabel) return;
              if (row.idNguyenNhienLieu === targetHeaderId || (!row.idNguyenNhienLieu && targetHeaderName && norm(row.nguyenNhienLieu) === norm(targetHeaderName))) {
                currentRows[idx] = { ...currentRows[idx], tongThucTe: totalKL ?? 0, isUnmapped: false, idNguyenNhienLieu: currentRows[idx].idNguyenNhienLieu ?? targetHeaderId };
              }
            });
            return;
          }
          phuLieus.forEach((pl: any) => {
            const fallbackName = pl?.tenPhuLieu ?? pl?.TenPhuLieu ?? "";
            const idPhuLieu = pl?.iD_PhuLieu ?? pl?.ID_PhuLieu ?? null;
            if (!idPhuLieu) return;
            const existingUnmappedIndex = currentRows.findIndex((row) => row.isUnmapped && row.idPhuLieu === idPhuLieu && row.khuVuc === khuVucLabel);
            if (existingUnmappedIndex >= 0) {
              currentRows[existingUnmappedIndex] = { ...currentRows[existingUnmappedIndex], tongThucTe: totalKL ?? 0, rawTenPhuLieu: currentRows[existingUnmappedIndex].rawTenPhuLieu || fallbackName, nguyenNhienLieu: currentRows[existingUnmappedIndex].nguyenNhienLieu || fallbackName, isUnmapped: true };
              return;
            }
            if (!newUnmappedRows.some((row) => row.idPhuLieu === idPhuLieu && row.khuVuc === khuVucLabel)) {
              newUnmappedRows.push({
                key: `${khuVucLabel}_unmapped_${idPhuLieu}_${Date.now()}`,
                khuVuc: khuVucLabel,
                viTri: viTriDefault,
                nguyenNhienLieu: fallbackName,
                idNguyenNhienLieu: null,
                rawTenPhuLieu: fallbackName,
                isUnmapped: true,
                idPhuLieu: idPhuLieu,
                tonDauCa: "", tuongQuanDauCa: "", nhapTrongCa: "", tonCuoiCa: "", tuongQuanCuoiCa: "",
                tongThucTe: totalKL ?? 0,
              });
            }
          });
        });

        setTable1Data([...currentRows, ...newUnmappedRows]);
        setTable2Data(mappedSummary);
      } else {
        // Không có phiếu: giữ logic cũ, đổ filter lên prev
        setTable1Data((prev: STD_NXT_Table1Row[]) => {
          const currentRows = prev.map((r) =>
            lockedKhuVucLabels.has(r.khuVuc) ? r : { ...r, tongThucTe: 0 }
          );
          const newUnmappedRows: STD_NXT_Table1Row[] = [];

          resultData.forEach((item: any) => {
            const khuVucLabel = findKhuVucLabel(item.bieuMau, item.scope);
            if (!khuVucLabel) return;
            const targetHeaderId = (item.headerKeyId ?? item.HeaderKeyId) as number | null;
            const targetHeaderName = item.headerKeyName ?? item.HeaderKeyName;
            const totalKL = (item.totalKLPhuGia ?? item.TotalKLPhuGia ?? 0) as number;
            const phuLieus = Array.isArray(item.phuLieus ?? item.PhuLieus) ? (item.phuLieus ?? item.PhuLieus) : [];

            if (targetHeaderId) {
              currentRows.forEach((row, idx) => {
                if (row.khuVuc !== khuVucLabel) return;
                if (row.idNguyenNhienLieu === targetHeaderId || (!row.idNguyenNhienLieu && targetHeaderName && norm(row.nguyenNhienLieu) === norm(targetHeaderName))) {
                  currentRows[idx] = { ...currentRows[idx], tongThucTe: totalKL ?? 0, isUnmapped: false, idNguyenNhienLieu: currentRows[idx].idNguyenNhienLieu ?? targetHeaderId };
                }
              });
              return;
            }
            phuLieus.forEach((pl: any) => {
              const fallbackName = pl?.tenPhuLieu ?? pl?.TenPhuLieu ?? "";
              const idPhuLieu = pl?.iD_PhuLieu ?? pl?.ID_PhuLieu ?? null;
              if (!idPhuLieu) return;
              const existingUnmappedIndex = currentRows.findIndex((row) => row.isUnmapped && row.idPhuLieu === idPhuLieu && row.khuVuc === khuVucLabel);
              if (existingUnmappedIndex >= 0) {
                currentRows[existingUnmappedIndex] = { ...currentRows[existingUnmappedIndex], tongThucTe: totalKL ?? 0, rawTenPhuLieu: currentRows[existingUnmappedIndex].rawTenPhuLieu || fallbackName, nguyenNhienLieu: currentRows[existingUnmappedIndex].nguyenNhienLieu || fallbackName, isUnmapped: true };
                return;
              }
              if (!newUnmappedRows.some((row) => row.idPhuLieu === idPhuLieu && row.khuVuc === khuVucLabel)) {
                newUnmappedRows.push({
                  key: `${khuVucLabel}_unmapped_${idPhuLieu}_${Date.now()}`,
                  khuVuc: khuVucLabel,
                  viTri: viTriDefault,
                  nguyenNhienLieu: fallbackName,
                  idNguyenNhienLieu: null,
                  rawTenPhuLieu: fallbackName,
                  isUnmapped: true,
                  idPhuLieu: idPhuLieu,
                  tonDauCa: "", tuongQuanDauCa: "", nhapTrongCa: "", tonCuoiCa: "", tuongQuanCuoiCa: "",
                  tongThucTe: totalKL ?? 0,
                });
              }
            });
          });
          return [...currentRows, ...newUnmappedRows];
        });
      }

      if (resultDataAll.length === 0) {
        message.info("Không có dữ liệu phụ liệu cho Ngày/Ca đã chọn (đã reset Tổng thực tế sử dụng = 0)");
      } else if (resultData.length === 0) {
        message.info("Các khu vực đều đang ở trạng thái Đã chốt nên không có dữ liệu nào được làm mới.");
      } else if (lockedKhuVucLabels.size > 0) {
        message.success(
          `Đã làm mới dữ liệu phụ liệu theo ngày/ca (bỏ qua khu vực: ${[...lockedKhuVucLabels].join(", ")} do đã Chốt).`
        );
      } else {
        message.success("Đã lọc dữ liệu phụ liệu theo ngày/ca");
      }

      // Sau khi lọc dữ liệu, cập nhật lại trạng thái phiếu theo tab
      await loadRelatedPhieuStatuses();
    } catch (error: any) {
      console.error("Lọc dữ liệu thất bại:", error);
      message.error(error?.message || "Không thể lọc dữ liệu");
    } finally {
      setFilterLoading(false);
    }
  }, [form, config.layout1, setTable1Data, table1Data, idphieu, loadRelatedPhieuStatuses, isKhuVucLocked]);

  /**
   * Ép đồng bộ trực tiếp từ NM (bỏ qua cache/cooldown DB) rồi làm mới lại bảng.
   * Dùng khi nghi ngờ dữ liệu cũ/thiếu mà "Làm mới" (chỉ đọc DB) không phản ánh đúng —
   * ví dụ NM vừa cập nhật/sửa lại mẻ mà job đồng bộ định kỳ (5 phút/lần) chưa kịp chạy.
   */
  const handleForceSyncFromNM = useCallback(async () => {
    setForceSyncLoading(true);
    try {
      const values = await form.validateFields(["NgaySX", "ca"]);
      const ngay = values.NgaySX ? values.NgaySX.format("YYYY-MM-DD") : null;
      const caVal = values.ca;
      if (!ngay || !caVal) {
        message.warning("Vui lòng chọn Ngày và Ca trước khi đồng bộ.");
        return;
      }
      await dlnmHRC2Api.forceSyncStdNxt({ NgaySX: ngay, Ca: Number(caVal) });
      message.success("Đã đồng bộ lại dữ liệu từ NM.");
      await handleFilterData();
    } catch (error: any) {
      if (error?.errorFields) return;
      console.error("Đồng bộ lại từ NM thất bại:", error);
      message.error(error?.message || "Không thể đồng bộ lại từ NM.");
    } finally {
      setForceSyncLoading(false);
    }
  }, [form, handleFilterData]);

  const handleExportExcelTieuHaoTheoCa = useCallback(async () => {
    try {
      const ngay = watchedNgaySX.format("YYYY-MM-DD");
      // apiService trả thẳng response.data — với responseType: "blob" đây là Blob, không có .data
      const raw = await dlnmHRC2Api.exportExcelTieuHaoTheoCa({ ngay, ca: watchedCa });
      if (raw == null) {
        message.error("Không nhận được dữ liệu Excel từ server.");
        return;
      }
      const blob =
        raw instanceof Blob
          ? raw
          : new Blob([raw as unknown as BlobPart], {
              type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });
      if (blob.size === 0) {
        message.error("File Excel tải về rỗng.");
        return;
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = watchedNgaySX.format("DDMMYYYY");
      a.download = `TieuHao_HRC2_Ca${watchedCa}_${dateStr}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      message.success("Đã tải file Excel");
    } catch (error: unknown) {
      console.error("Xuất Excel thất bại:", error);
      const msg =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message?: unknown }).message === "string"
          ? (error as { message: string }).message
          : "Xuất Excel thất bại";
      message.error(msg);
    }
  }, [watchedNgaySX, watchedCa]);
  return (

    <>
    <Button type="primary" icon={<FileExcelOutlined />}
        style={{ backgroundColor: "#217346", borderColor: "#217346", color: "#fff" }}
        onClick={handleExportExcelTieuHaoTheoCa}
        loading={loading}
        disabled={filterLoading || forceSyncLoading}
      >
      Xuất Excel
    </Button>
    
    <Card className="mt-6 shadow-md">
      {/* Tiêu đề biên bản */}
      <div className="mb-6 flex items-start justify-between">
        {/* Logo + tên công ty */}
        {/* <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <img
            src="https://report.hoaphatdungquat.vn/img/logoHP.png"
            alt="logo"
            style={{ height: "auto", width: 150 }}
          />
          {config.headerInfo && (
            <>
              <Typography.Text strong>
                {config.headerInfo.subCompany}
              </Typography.Text>
              <Typography.Text>{config.headerInfo.company}</Typography.Text>
            </>
          )}
        </div> */}

        {/* Tiêu đề trung tâm */}
        <div className="flex-1 text-center">
          <Typography.Title level={3} className="mb-0">
            {config.title}
          </Typography.Title>
        </div>

        {/* ISO góc phải */}
        {/* {config.isoInfo && (
          <div className="text-right leading-5 text-[13px]">
            <div>
              <b>{config.isoInfo.code}</b>
            </div>
            <div>Ngày hiệu lực: {config.isoInfo.effectiveDate}</div>
            <div>Lần sửa đổi: {config.isoInfo.revision}</div>
          </div>
        )} */}
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
              loading={filterLoading}
              disabled={forceSyncLoading}
              style={{
                height: 35,
                width: "100%",
                borderRadius: 8,
              }}
            >
              Làm mới
            </Button>
          </div>
          <div style={{ flex: "0 0 180px", maxWidth: 200 }}>
            <Button
              onClick={handleForceSyncFromNM}
              loading={forceSyncLoading}
              disabled={filterLoading}
              title="Dùng khi nghi ngờ dữ liệu cũ/thiếu — bấm nút này sẽ chậm hơn 'Làm mới' vì đồng bộ trực tiếp từ NM."
              style={{
                height: 35,
                width: "100%",
                borderRadius: 8,
              }}
            >
              Đồng bộ lại từ NM
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
                      <SummaryTableSTD
                        key={`summary-std-${idphieu ?? "new"}-${summaryTableRemountKey}`}
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
                        editable={!(filterLoading || forceSyncLoading)}
                        loading={loading}
                        lockedTooltip={isLockedByChot ? "Đã có phiếu được chốt" : undefined}
                      />
                    ),
                  },
                ]
              : []),
            // Tab per khuVuc
            ...(layout1 && layout1.sectionType === "groupedTable"
              ? kvLabels.map((kvLabel) => {
                  const statusItem = relatedStatusMap[`kv_${kvLabel}`];
                  const kvStatus =
                    statusItem?.tinhTrang ?? (statusItem as any)?.TinhTrang;
                  return {
                  key: `kv_${kvLabel}`,
                  label: (
                    <span>
                      {kvLabel}
                      {(() => {
                        const statusKey =
                          kvStatus !== undefined && kvStatus !== null
                            ? String(kvStatus)
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
                            ({tinhTrangLabel(kvStatus)})
                          </span>
                        );
                      })()}
                    </span>
                  ),
                  children: (
                    <GroupedTableSTD
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
                      editable={!(filterLoading || forceSyncLoading)}
                      loading={loading}
                      ngaySX={form.getFieldValue("NgaySX")}
                      khuVucConfig={kvList}
                      nhaMay={2}
                      khuVucStatusMap={{ [kvLabel]: kvStatus }}
                    />
                  ),
                  };
                })
              : []),
          ];

          return (
            <Tabs
              style={{ marginTop: 24 }}
              items={tabItems}
              type="card"
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
                    maBm={config.code}
                  />
                </div>
              );
            })}
        </div>
        <div style={{ textAlign: "center", marginTop: 16, display: "flex", gap: 8, justifyContent: "center" }}>
          {!idphieu && (
            <Button type="primary" onClick={handleSave} loading={loading} disabled={filterLoading || forceSyncLoading}>
              Tạo phiếu
            </Button>
          )}
          {idphieu && (
            <Button type="primary" onClick={handleSave} loading={loading} disabled={filterLoading || forceSyncLoading}>
              Lưu
            </Button>
          )}
        </div>
      </Form>
    </Card>
    </>
  );
};

export default Tao_STD;
