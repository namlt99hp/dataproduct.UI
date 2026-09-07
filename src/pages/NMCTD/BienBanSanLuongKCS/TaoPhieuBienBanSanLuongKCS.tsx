/* eslint-disable @typescript-eslint/no-explicit-any */
import CTD_BB_SanLuong_KCS from "../../../utils/BM_config/CTD_BB_SanLuong_KCS.json";
import {
  Button,
  Card,
  Form,
  Input,
  Space,
  Table,
  Typography,
  message,
} from "antd";
import {
  DownloadOutlined,
  SaveOutlined,
  UndoOutlined,
  ReloadOutlined,
  RedoOutlined,
} from "@ant-design/icons";
import * as XLSX from "xlsx";
import dayjs from "dayjs";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CustomFormItem from "../../../components/CustomFormItem";
import { PhieuApi } from "../../../services/PhieuApi";
import type { PheDuyetItem } from "../../../services/PhieuActionService";
import { phieuActionService } from "../../../services/PhieuActionService";
import { PhieuActionButtonKeys } from "../../../utils/constants/PhieuActionButtonKeys";
import { bkcankphapi } from "../../../services/BKKCSCanApi";
import { TrangThaiPhieuConst } from "../../../utils/constants/TrangThaiPhieuConstant";
import { getThongTinUser } from "../../../utils/constants/GetThongTinLocalStore";

interface TableRow {
  key?: string;
  [key: string]: any;
}

const TaoPhieuBienBanSanLuongKCS = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const idphieu = id;

  const config = CTD_BB_SanLuong_KCS as any;
  const [form] = Form.useForm();

  const [tableData, setTableData] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [soPhieu, setSoPhieu] = useState("");
  const [phieuInfo, setPhieuInfo] = useState<{
    tinhTrang?: number;
    nguoiTaoId?: number | null;
    idphongBan?: number | null;
    pheDuyet?: any[];
    lsx?: string;
  }>({});

  // ★ Ref snapshot – đọc trong closure mà không bao giờ bị stale
  const phieuInfoRef = useRef(phieuInfo);
  const handleRefreshRef = useRef<any>(null);

  useEffect(() => {
    phieuInfoRef.current = phieuInfo;
  }, [phieuInfo]);

  // ★ currentUserInfo: Đọc thông tin user từ localStorage
  //   Hỗ trợ cả 2 format: iD_TaiKhoan (PascalCase) + id_TaiKhoan (camelCase)
  //   Không bao giờ throw, không bao giờ trả null
  const currentUserInfo = useMemo(() => getThongTinUser(), []);

  const currentTinhTrang = phieuInfo.tinhTrang ?? TrangThaiPhieuConst.DangLuu;
  const isSignatureReadonly = [
    TrangThaiPhieuConst.HoanThanh,
    TrangThaiPhieuConst.DangPheDuyet,
    TrangThaiPhieuConst.DaChot,
  ].includes(currentTinhTrang);
  const isFormLocked = !(
    currentTinhTrang === TrangThaiPhieuConst.DangLuu ||
    currentTinhTrang === TrangThaiPhieuConst.DaThuHoi
  );

  // ★ getUserInfo: Wrapper callback để đọc user info
  //   Dùng getThongTinUser() - hỗ trợ cả 2 format key
  const getUserInfo = useCallback(() => getThongTinUser(), []);

  // ─────────────────────────────────────────────────────────────────────────
  //  parsePhieuNumber - Parse số phiếu để extract ngày XL, ca, and xuong
  //  Format: CTD_KPH202603242C_202603231C_CAN1_001040004090
  //  - Index 2 (202603231C): ngày XL = 20260323, caXL = 1
  //  - Index 3 (CAN1): xuong = 1
  // ─────────────────────────────────────────────────────────────────────────
  const parsePhieuNumber = useCallback((soPhieu: string) => {
    const result: Record<string, any> = {};

    try {
      const parts = soPhieu.split("_");
      if (parts.length >= 3) {
        // Part 3 (index 2): 202603231C = YYYYMMDD + caXL
        const xLPart = parts[2]; // e.g., "202603231C"
        const solenh = parts[4];
        if (xLPart && xLPart.length >= 9) {
          // Extract date: 8 ký tự đầu = YYYYMMDD
          const dateStr = xLPart.substring(0, 8);
          const year = dateStr.substring(0, 4);
          const month = dateStr.substring(4, 6);
          const day = dateStr.substring(6, 8);
          const ngayXL = `${year}-${month}-${day}`;

          if (dayjs(ngayXL).isValid()) {
            result.NgayXL = dayjs(ngayXL);
          }

          // Extract caXL: ký tự ở vị trí 8 = ca
          const caStr = xLPart.substring(8, 9);
          if (caStr && !isNaN(Number(caStr))) {
            result.caXL = Number(caStr);
          }
        }

        // Part 4 (index 3): CAN1 = extract ký tự số để lấy xuong
        if (parts.length >= 4) {
          const xuongPart = parts[3]; // e.g., "CAN1"
          const xuongNum = xuongPart.replace(/\D/g, ""); // extract only numbers
          if (xuongNum) {
            result.xuong = Number(xuongNum);
          }
        }
        if (solenh) {
          result.LSX = solenh;
        }
      }
    } catch (error) {
      console.error("Error parsing phieu number:", error);
    }

    return result;
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  //  initData
  // ─────────────────────────────────────────────────────────────────────────
  const initData = useCallback(async (options?: { skipTableLoad?: boolean }) => {
    try {
      setLoading(true);
      const idPhieu = idphieu || "";
      if (idPhieu) {
        const res = await PhieuApi.getDetail(idPhieu);
        if (res) {
          const SoPhieu = (res as any)?.soPhieu || "";
          setSoPhieu((res as any)?.soPhieu);
          const data = (res as any)?.jsonData || {};
          // set signature fields based on config.signatures and API response pheDuyet
          const signatureFields: Record<string, any> = {};
          ((res as any)?.pheDuyet || []).forEach((pd: any) => {
            const sig = config.signatures.find(
              (s: any) =>
                s.capDuyet === pd.capDuyet && s.type === "selectNguoiKy",
            );
            if (sig && pd.nguoiDuyetId)
              signatureFields[sig.key] = pd.nguoiDuyetId;
          });

          const tinhTrang = (res as any)?.tinhTrang ?? 0;
          const dateFields = config.headerFields
            .filter((f: any) => f.type === "date")
            .map((f: any) => f.key);
          const parsedDates: Record<string, any> = {};
          dateFields.forEach((k: string) => {
            if (data[k]) {
              const parsed = dayjs(data[k]);
              parsedDates[k] = parsed.isValid() ? parsed : null;
            }
          });

          const formValues = {
            ...data,
            ...signatureFields,
            ...parsedDates,
            idphieu: (res as any)?.idphieu || "",
          };
          form.setFieldsValue(formValues);

          // ★ Explicitly read and set CaXL, NgayXL, xuong from API response or parsed phieu number
          const apiCa = data.ca ?? (res as any)?.ca;
          const apiNgaySX =
            data.NgaySX ??
            data.ngaySX ??
            (res as any)?.ngaySX ??
            (res as any)?.NgaySX;
          const apiXuong = data.mayDuc ?? (res as any)?.mayDuc;

          //   set các giá trị default từ số phiếu, ưu tiên giá trị đã parse được, sau đó mới đến giá trị API
          const explicitValues: Record<string, any> = {};

          // Try to parse from soPhieu first
          const parsedFromPhieu = parsePhieuNumber(SoPhieu);

          // Set CaXL: prefer parsed value, then API value
          if (parsedFromPhieu.caXL !== undefined) {
            explicitValues.caXL = parsedFromPhieu.caXL;
          }
          if (apiCa !== undefined && apiCa !== null) {
            explicitValues.ca = apiCa;
          }

          // Set NgayXL: prefer parsed value, then API value
          if (parsedFromPhieu.NgayXL) {
            explicitValues.NgayXL = parsedFromPhieu.NgayXL;
          }
          if (apiNgaySX) {
            explicitValues.NgaySX = dayjs(apiNgaySX);
          }

          // Set xuong: prefer parsed value, then API value
          if (parsedFromPhieu.xuong !== undefined) {
            explicitValues.xuong = parsedFromPhieu.xuong;
          } else if (apiXuong !== undefined && apiXuong !== null) {
            explicitValues.xuong = apiXuong;
          }

          // Set LSX (solenh): prefer parsed value
          if (parsedFromPhieu.LSX !== undefined) {
            explicitValues.LSX = parsedFromPhieu.LSX;
          }

          if (Object.keys(explicitValues).length > 0) {
            form.setFieldsValue(explicitValues);
          }

          if (tinhTrang === TrangThaiPhieuConst.DangLuu) {
            const overrides: Record<string, any> = {};
            config.signatures
              .filter((sig: any) => sig.capDuyet === 0)
              .forEach((sig: any) => {
                overrides[sig.key] = currentUserInfo?.iD_TaiKhoan ?? null;
              });
            if (Object.keys(overrides).length > 0)
              form.setFieldsValue(overrides);
          }

          if (!options?.skipTableLoad) {
            if (!formValues.table1 && !Array.isArray(formValues.table1)) {
              form.setFieldsValue({ LSX: parsedFromPhieu.LSX || "" });
              setTimeout(() => {
                handleRefreshRef.current?.();
              }, 100);
            } else {
              setTableData(formValues.table1 || []);
            }
          }

          // Rebuild pheDuyet từ form fields nếu API không trả về đầy đủ
          const pheDuyetData = (res as any)?.pheDuyet || data.pheDuyet || [];
          setPhieuInfo({
            tinhTrang: tinhTrang,
            nguoiTaoId: (res as any)?.nguoiTaoId ?? null,
            idphongBan: (res as any)?.idphongBan ?? null,
            pheDuyet: pheDuyetData,
            lsx: parsedFromPhieu.LSX || "",
          });
        }
      } else {
        // Create new: set default Ca and NgaySX
        setPhieuInfo({});
        setTimeout(() => {
          const caField = config.headerFields?.find((f: any) => f.key === "ca");
          const caDefault = caField?.options?.[0]?.value ?? 1; // Default to first option or 1

          const defaultValues: Record<string, any> = {
            ca: caDefault,
            NgaySX: dayjs(),
          };

          config.signatures
            .filter((sig: any) => sig.capDuyet === 0)
            .forEach((sig: any) => {
              defaultValues[sig.key] = currentUserInfo?.iD_TaiKhoan ?? null;
            });

          if (Object.keys(defaultValues).length > 0)
            form.setFieldsValue(defaultValues);
        }, 300);
      }
    } catch {
      message.error("Không thể tải dữ liệu ban đầu!");
    } finally {
      setLoading(false);
    }
  }, [
    form,
    idphieu,
    config.signatures,
    config.headerFields,
    currentUserInfo,
    parsePhieuNumber,
  ]);

  useEffect(() => {
    initData();
  }, [initData]);

  const getFormData = useCallback(async () => {
    const userInfo = getUserInfo();
    const formData = await form.validateFields();
    const pheDuyetFlow = config.signatures.map((s: any) => ({
      capDuyet: s.capDuyet,
      maKyDuyet: s.key,
      nguoiDuyetId: form.getFieldValue(s.key),
      tinhTrang: 0,
      ghiChu: "",
    }));
    const processedTable1 = tableData.map((row) => {
      const r = { ...row };
      delete r._isNewRow;
      delete r.key;
      // Giữ lại id từ API để khi lưu có thể cập nhật
      return r;
    });
    const dateFields = config.headerFields
      .filter((f: any) => f.type === "date")
      .map((f: any) => f.key);
    const formattedDates: Record<string, any> = {};
    dateFields.forEach((k: string) => {
      if (formData[k]) formattedDates[k] = formData[k].format("YYYY-MM-DD");
    });
    return {
      ...formData,
      ...formattedDates,
      maBm: config.code,
      xuongId: userInfo.iD_PhanXuong ?? null,
      idphongBan: userInfo.iD_PhongBan ?? null,
      nguoiTaoId: userInfo.iD_TaiKhoan ?? null,
      table1: processedTable1,
      pheDuyet: pheDuyetFlow,
      prefix: config.prefix,
    };
  }, [getUserInfo, form, config, tableData]);

  // ─────────────────────────────────────────────────────────────────────────
  //  handleStatusChange
  // ─────────────────────────────────────────────────────────────────────────
  const handleStatusChange = useCallback(
    async (idPhieu: string, newStatus: number) => {
      //   const { isClone, idPhieuGoc } = phieuInfoRef.current; // ★ luôn fresh

      try {
        const formValues = await form.validateFields();

        // ── HoanThanh → INSERT ─────────────────────────────────────────────
        // if (newStatus === TrangThaiPhieuConst.HoanThanh) {
        //   await phoiNapNguoiApi.insertSanLuongPhoi({
        //     idPhieu,
        //     soPhieu: soPhieu || "",
        //     ngaySX: formValues.NgaySX
        //       ? formValues.NgaySX.format("YYYY-MM-DD")
        //       : "",
        //     kip: formValues.kip || "",
        //     ca: formValues.ca || 0,
        //     mayDuc: formValues.mayDuc || 0,
        //     table1: tableData.map((row) => ({
        //       kipNgay: row.kipNgay || "",
        //       macThep: row.macThep || "",
        //       kichThuoc: row.kichThuoc || "",
        //       stLoai1: Number(row.stLoai1) || 0,
        //       klLoai1: Number(row.klLoai1) || 0,
        //       stPhoiNgan: Number(row.stPhoiNgan) || 0,
        //       klPhoiNgan: Number(row.klPhoiNgan) || 0,
        //       stLoai2: Number(row.stLoai2) || 0,
        //       klLoai2: Number(row.klLoai2) || 0,
        //       stLoai3: Number(row.stLoai3) || 0,
        //       klLoai3: Number(row.klLoai3) || 0,
        //       tongSoThanh: Number(row.tongSoThanh) || 0,
        //       tongKhoiLuong: Number(row.tongKhoiLuong) || 0,
        //     })),
        //   });
        //   message.success("Đã insert dữ liệu sản lượng phôi thành công!");
        //   return;
        // }

        // ── DaThuHoi → DELETE (+ RESTORE cha nếu là clone) ────────────────
        // if (newStatus === TrangThaiPhieuConst.DaThuHoi) {
        //   await phoiNapNguoiApi.deleteSanLuongPhoiByIdPhieu(idPhieu);
        //   message.success("Đã xóa dữ liệu sản lượng phôi!");
        //   if (isClone && idPhieuGoc) {
        //     await phoiNapNguoiApi.restoreSanLuongPhoiByIdPhieu(idPhieuGoc);
        //     message.success("Đã khôi phục dữ liệu phiếu cha!");
        //   }
        //   return;
        // }

        // ── KhongXacNhan → DELETE clone + RESTORE cha ─────────────────────
        // if (newStatus === TrangThaiPhieuConst.KhongXacNhan) {
        //   if (isClone && idPhieuGoc) {
        //     try {
        //       await phoiNapNguoiApi.deleteSanLuongPhoiByIdPhieu(idPhieu);
        //     } catch {
        //       // clone chưa có data → không sao
        //     }
        //     await phoiNapNguoiApi.restoreSanLuongPhoiByIdPhieu(idPhieuGoc);
        //     message.success(
        //       "Đã khôi phục dữ liệu sản lượng phôi của phiếu cha!",
        //     );
        //   }
        // }
      } catch (error: any) {
        console.error("❌ Error in handleStatusChange:", error);
        message.error(
          `Lỗi: ${error?.response?.data?.message || error?.message || "Không xác định"}`,
        );
      }
    },
    [form, soPhieu, tableData],
    // ★ KHÔNG đưa phieuInfo vào deps – đọc từ phieuInfoRef.current
  );

  // ─────────────────────────────────────────────────────────────────────────
  //  handleActionSuccess
  //
  //  DeNghiHieuChinh  → navigate sang clone (không làm gì với TTHD vì
  //                     phiếu cha có thể chưa có data lúc này)
  //  HoanThanh        → INSERT data + HIDE cha (nếu là clone)
  //                     ★ check prevStatus để tránh gọi lại khi đã HoanThanh
  //  KhongXacNhan     → handleStatusChange đã xử lý TRƯỚC navigate → skip
  // ─────────────────────────────────────────────────────────────────────────
  const handleActionSuccess = useCallback(
    async (context?: { newPhieuId?: string }) => {
      // ── DeNghiHieuChinh ───────────────────────────────────────────────────
      if (context?.newPhieuId) {
        navigate(`/taophieuxulykph/${context.newPhieuId}`, {
          replace: true,
        });
        return;
      }

      if (!idphieu) return;

      try {
        // ★ Đọc prevStatus từ ref (không phải state) để luôn fresh
        const prevStatus = phieuInfoRef.current.tinhTrang;
        const res: any = await PhieuApi.getDetail(idphieu);
        const newStatus = res?.tinhTrang;
        // ── HoanThanh ─────────────────────────────────────────────────────
        // ★ Guard prevStatus: chỉ xử lý khi VỪA chuyển sang HoanThanh,
        //    tránh gọi lại INSERT + HIDE mỗi lần component re-render
        if (
          newStatus === TrangThaiPhieuConst.HoanThanh &&
          prevStatus !== TrangThaiPhieuConst.HoanThanh
        ) {
          // INSERT data phiếu hiện tại (TTHD = 1)
          await handleStatusChange(idphieu, TrangThaiPhieuConst.HoanThanh);
        }
        // ── KhongXacNhan → đã xử lý trong handleStatusChange, skip ────────
      } catch {
        // bỏ qua lỗi fetch
      }

      await initData();
    },
    [navigate, initData, idphieu, handleStatusChange],
    // phieuInfoRef không cần deps – dùng ref
  );

  const handleRefresh = useCallback(async () => {
    try {
      setLoading(true);
      const formData = form.getFieldsValue();
      console.log("Current form data before refresh:", formData);
      // Get parameters from form
      const ngaySX = formData.NgaySX
        ? dayjs(formData.NgaySX).format("YYYY-MM-DD")
        : null;
      // Get order (LSX) from form data first, fallback to phieuInfo.lsx
      const xuongCan = formData.xuong ?? null;
      const ca = formData.ca ?? null;
      console.log("Refresh params:", {
        ngaySX,
        xuongCan,
        ca,
      });

      if (!ngaySX || xuongCan === null || ca === null) {
        message.warning("Vui lòng điền đầy đủ Ngày sản xuất, ca và Xưởng!");
        setLoading(false);
        return;
      }

      // Call API to get fresh data
      const response = await bkcankphapi.getDataSanLuong({
        ngaySX: ngaySX,
        ca: ca,
        idXuongCan: xuongCan,
      });

      if (response) {
        // Handle response as array or single object
        const apiDataArray = Array.isArray(response) ? response : [response];

        // Map first record to form fields
        const firstRecord = apiDataArray[0] as any;
        if (firstRecord) {
          const mappedData: Record<string, any> = {
            NgaySX: firstRecord.ngaySX ? dayjs(firstRecord.ngaySX) : null,
            xuong: formData.xuong ?? firstRecord.idXuongCan ?? xuongCan,
            ca: formData.ca ?? ca,
          };

          form.setFieldsValue(mappedData);
        }

        // Map all API records to table rows
        const tableRows: TableRow[] = apiDataArray.map(
          (apiData: any, index: number) => ({
            key: apiData.id || `row-${Date.now()}-${index}`,
            id: apiData.id || null,
            sanPham: apiData.sanPham,
            macThep: apiData.macThep,
            chieuDai: apiData.chieuDai,
            soBo: apiData.soBo,
            klCan: apiData.khoiLuong,
            soThanh: apiData.soThanh,
            tenPhanLoai: apiData.tenPhanLoai,
            ghiChu: "",
          }),
        );

        // Update table data with all API records
        setTableData(tableRows);

        message.success("Làm mới dữ liệu thành công!");
      }
    } catch (error: any) {
      console.error("Refresh error:", error);
      message.error(
        `Lỗi: ${error?.response?.data?.message || error?.message || "Không thể làm mới dữ liệu"}`,
      );
    } finally {
      setLoading(false);
    }
  }, [form]);

  // Store handleRefresh in ref for use in initData without circular dependency
  useEffect(() => {
    handleRefreshRef.current = handleRefresh;
  }, [handleRefresh]);

  const actionButtons = useMemo(() => {
    const userInfo = getUserInfo();
    const buttons = phieuActionService.getActionButtons({
      phieuId: idphieu || "",
      tinhTrang: phieuInfo.tinhTrang ?? 0,
      isClone: false,
      currentUserId: userInfo.iD_TaiKhoan ?? null,
      currentUserPhongBanId: userInfo.iD_PhongBan ?? null,
      currentUserTenNgan: userInfo.tenNgan ?? null,
      nguoiTaoId: phieuInfo.nguoiTaoId ?? null,
      phieuPhongBanId: phieuInfo.idphongBan ?? null,
      pheDuyet: phieuInfo.pheDuyet ?? [],
      onStatusChange: handleStatusChange,
      onSuccess: handleActionSuccess,
      onError: (error) => {
        console.error("Action error:", error);
      },
    });

    // Bỏ nút "Đề nghị hiệu chỉnh"
    const filteredButtons = buttons.filter(
      (btn) => btn.key !== PhieuActionButtonKeys.RequestEdit,
    );

    if (filteredButtons.length === 0) return null;
    return phieuActionService.renderActionButtons(
      filteredButtons,
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
  ]);

  const handleReset = useCallback(async () => {
    if (!idphieu) {
      message.warning("Vui lòng lưu phiếu trước khi reset!");
      return;
    }
    try {
      setLoading(true);
      await PhieuApi.resetPhieu(idphieu);
      message.success("Reset phiếu thành công!");
      await initData({ skipTableLoad: true });
      await handleRefresh();
    } catch (error: any) {
      console.error("Reset phiếu failed:", error);
      message.error(error?.message || "Reset phiếu thất bại!");
    } finally {
      setLoading(false);
    }
  }, [idphieu, initData, handleRefresh]);

  // Group table data by tenPhanLoai (stored in ghiChu)
  const groupedAndFlattenedData = useMemo(() => {
    if (tableData.length === 0) return [];

    // Group by ghiChu (which contains tenPhanLoai)
    const groups: Record<string, any[]> = {};
    // sap xep lai neu tenphanloai co ton tai so 1 thì sắp xếp lên trên
    tableData.sort((a, b) => {
      // Kiểm tra xem chuỗi có chứa số '1' hay không
      const aHasOne = a.tenPhanLoai && a.tenPhanLoai.includes("1");
      const bHasOne = b.tenPhanLoai && b.tenPhanLoai.includes("1");

      if (aHasOne && !bHasOne) return -1; // a có '1', b không có -> đưa a lên trên
      if (!aHasOne && bHasOne) return 1; // b có '1', a không có -> đưa b lên trên
      return 0; // cả hai đều có hoặc đều không có -> giữ nguyên vị trí
    });
    tableData.forEach((row) => {
      const groupKey = row.tenPhanLoai || "Khác";
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(row);
    });

    const result: any[] = [];
    let globalStt = 0;
    let totalSoBo = 0;
    let totalKlCan = 0;
    let totalSoThanh = 0;

    // Process each group
    Object.entries(groups).forEach(([groupName, rows]) => {
      // 1. Group header row
      result.push({
        key: `header-${groupName}`,
        isGroupHeader: true,
        stt: "",
        sanPham: groupName,
        macThep: "",
        chieuDai: "",
        soBo: "",
        klCan: "",
        soThanh: "",
        ghiChu: "",
      });

      // 2. Calculate group totals and add data rows
      let groupSoBo = 0;
      let groupKlCan = 0;
      let groupSoThanh = 0;

      rows.forEach((row) => {
        globalStt++;
        const bo = parseInt(String(row.soBo)) || 0;
        const kl = parseFloat(String(row.klCan)) || 0;
        const thanh = parseInt(String(row.soThanh)) || 0;

        groupSoBo += bo;
        groupKlCan += kl;
        groupSoThanh += thanh;
        totalSoBo += bo;
        totalKlCan += kl;
        totalSoThanh += thanh;

        result.push({
          ...row,
          key: row.key || `row-${globalStt}`,
          stt: globalStt,
          isDataRow: true,
        });
      });

      // 3. Group subtotal row
      result.push({
        key: `subtotal-${groupName}`,
        isSubtotal: true,
        stt: "",
        sanPham: `Tổng ${groupName}`,
        macThep: "",
        chieuDai: "",
        soBo: groupSoBo,
        klCan: parseFloat(groupKlCan.toFixed(3)),
        soThanh: parseFloat(groupSoThanh.toFixed(3)),
        ghiChu: "",
      });
    });

    // 4. Total row
    result.push({
      key: "total-row",
      isTotal: true,
      stt: "",
      sanPham: "Tổng sản lượng",
      macThep: "",
      chieuDai: "",
      soBo: totalSoBo,
      klCan: parseFloat(totalKlCan.toFixed(3)),
      soThanh: parseFloat(totalSoThanh.toFixed(3)),
      ghiChu: "",
    });

    return result;
  }, [tableData]);

  // Get table section config
  const tableSection = useMemo(() => {
    return config.layout.find(
      (section: any) =>
        section.sectionType === "table" && section.key === "table1",
    );
  }, [config]);

  // Custom columns with render function for styling
  const displayColumns = useMemo(() => {
    return (tableSection?.columns || []).map((col: any) => ({
      ...col,
      align:
        col.dataIndex === "stt" ||
        col.dataIndex === "soBo" ||
        col.dataIndex === "klCan" ||
        col.dataIndex === "soThanh"
          ? "right"
          : "left",
      render:
        col.dataIndex === "klCan" || col.dataIndex === "soThanh"
          ? (value: any) => {
              if (value === "" || value === undefined || value === null)
                return "";
              const num = parseFloat(value);
              return isNaN(num)
                ? value
                : num.toLocaleString("en-US", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 3,
                  });
            }
          : col.render,
    }));
  }, [tableSection]);

  return (
    <Card style={{ margin: 24, boxShadow: "0 2px 8px #f0f1f2" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 12,
        }}
      >
        <div style={{ flex: 1, textAlign: "center" }}>
          <Typography.Title level={3} style={{ marginBottom: 0 }}>
            {config.title}
          </Typography.Title>
          {idphieu && <b>Số phiếu: {soPhieu}</b>}
        </div>
      </div>

      <Form form={form} layout="vertical">
        <Form.Item name="idphieu" hidden>
          <Input type="hidden" />
        </Form.Item>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
          }}
        >
          {config.headerFields.map((f: any, idx: any) => (
            <CustomFormItem
              key={f.key || idx}
              field={f}
              idx={idx}
              disabled={
                isFormLocked ||
                f.key === "ca" ||
                f.key === "NgaySX" ||
                f.key === "xuong"
              }
            />
          ))}
        </div>

        <div
          style={{ marginTop: 16, marginBottom: 16, display: "flex", gap: 8 }}
        >
          <Space
            style={{ marginTop: 24, justifyContent: "center", width: "100%" }}
          >
            {!isFormLocked && idphieu && (
              <Button
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
                loading={loading}
              >
                Làm mới
              </Button>
            )}
            {idphieu &&
              currentTinhTrang !== TrangThaiPhieuConst.DaChot &&
              getThongTinUser().iD_TaiKhoan === phieuInfo.nguoiTaoId && (
                <Button
                  type="default"
                  icon={<RedoOutlined />}
                  onClick={handleReset}
                  loading={loading}
                >
                  Reset Phiếu
                </Button>
              )}
            {actionButtons}
            <Button
              icon={<UndoOutlined />}
              onClick={() => navigate("/sanluongkcs")}
            >
              Quay Lại
            </Button>
          </Space>
        </div>

        {config.layout.map((layout: any, idx: any) => (
          <div key={idx}>
            {layout.sectionType === "table" && (
              <div
                style={{ width: "100%", overflowX: "auto", marginBottom: 24 }}
              >
                <Table
                  columns={displayColumns}
                  dataSource={groupedAndFlattenedData}
                  pagination={false}
                  loading={loading}
                  size="small"
                  bordered
                  rowKey={(record) => record.key}
                  rowClassName={(record) => {
                    if (record.isGroupHeader) return "group-header-row";
                    if (record.isSubtotal) return "subtotal-row";
                    if (record.isTotal) return "total-row";
                    return "data-row";
                  }}
                  style={{ minWidth: 1000 }}
                />
                <style>{`
                  .group-header-row {
                    background-color: #e6f7ff !important;
                    font-weight: bold !important;
                  }
                  .subtotal-row {
                    background-color: #f0f0f0 !important;
                    font-weight: bold !important;
                  }
                  .total-row {
                    background-color: #ffd666 !important;
                    font-weight: bold !important;
                  }
                `}</style>
              </div>
            )}
          </div>
        ))}

        <div
          style={{
            marginTop: 40,
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
                  <div style={{ marginTop: 8 }}>
                    <Typography.Text type="secondary">
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
    </Card>
  );
};

export default TaoPhieuBienBanSanLuongKCS;
