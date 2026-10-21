/* eslint-disable @typescript-eslint/no-explicit-any */
import CTD_STD_Sanxuat from "../../../utils/BM_config/CTD_STD_Sanxuat.json";
import { Button, Card, Form, Input, InputNumber, Modal, Select, Typography, message, Upload } from "antd";
import {
  FileExcelOutlined,
  DownloadOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { DonTrongPhoiServiceApi } from "../../../services/DonTrongPhoiServiceApi";
import type { DonTrongPhoi } from "../../../services/DonTrongPhoiServiceApi";
import * as XLSX from "xlsx";
import dayjs from "dayjs";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CustomFormItem from "../../../components/CustomFormItem";
import CustomFormTable from "../../../components/CustomFormTable";
import { PhieuApi } from "../../../services/PhieuApi";
import { phieuActionService } from "../../../services/PhieuActionService";
import type { PheDuyetItem } from "../../../services/PhieuActionService";
import { TrangThaiPhieuConst } from "../../../utils/constants/TrangThaiPhieuConstant";
import {
  canChotBm,
  getBmQuyenUiFlags,
  hasPermissionForBm,
} from "../../../utils/helpers/checkAdminRole";

interface TableRow {
  key?: string;
  [key: string]: any;
}

const TaoSoTheoDoiSanXuat = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const idphieu = id;

  const config = CTD_STD_Sanxuat;
  const [form] = Form.useForm();

  const [table1Data, setTable1Data] = useState<TableRow[]>([]);
  const [table2Data, setTable2Data] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [donTrongPhoiData, setDonTrongPhoiData] = useState<DonTrongPhoi[]>([]);
  const [soPhieu, setSoPhieu] = useState("");
  const [phieuInfo, setPhieuInfo] = useState<{
    tinhTrang?: number;
    nguoiTaoId?: number | null;
    idphongBan?: number | null;
    pheDuyet?: PheDuyetItem[];
    isClone?: boolean;
  }>({});
  const [themMacPhoiVisible, setThemMacPhoiVisible] = useState(false);
  const [themMacPhoiLoading, setThemMacPhoiLoading] = useState(false);
  const [themMacPhoiForm] = Form.useForm();

  const currentUserInfo = useMemo(() => {
    const stored = localStorage.getItem("userinfo");
    return stored ? JSON.parse(stored) : {};
  }, []);

  const currentTinhTrang = phieuInfo.tinhTrang ?? TrangThaiPhieuConst.DangLuu;
  const isSignatureReadonly = [
    TrangThaiPhieuConst.HoanThanh,
    TrangThaiPhieuConst.DangPheDuyet,
    TrangThaiPhieuConst.DaChot,
  ].includes(currentTinhTrang);

  const getUserInfo = useCallback(() => {
    const stored = localStorage.getItem("userinfo");
    return stored ? JSON.parse(stored) : {};
  }, []);

  // check user này có quyền chốt phiếu không -> xử lý sửa dữ liệu
  const canChotPhieu = canChotBm(currentUserInfo, config.code);

  const isFormLocked = !(
    currentTinhTrang === TrangThaiPhieuConst.DangLuu ||
    currentTinhTrang === TrangThaiPhieuConst.DaThuHoi ||
    currentTinhTrang === TrangThaiPhieuConst.HieuChinh ||
    // Allow editing if user has chốt permission and form is in HoanThanh state
    (canChotPhieu && currentTinhTrang !== TrangThaiPhieuConst.DaChot)
  );

  const table1DefaultData = useMemo(() => {
    const table1Layout = config.layout.find(
      (section: any) =>
        section.sectionType === "table" && section.key === "table1",
    );
    return ((table1Layout as any)?.initialData || []) as TableRow[];
  }, [config.layout]);

  const initData = useCallback(async () => {
    try {
      setLoading(true);

      if (idphieu) {
        const res = await PhieuApi.getDetail(idphieu);
        if (res) {
          setSoPhieu((res as any)?.soPhieu || "");
          const data = (res as any)?.jsonData || {};

          const signatureFields: Record<string, any> = {};
          const pheDuyetFromJson = data.pheDuyet || [];
          if (pheDuyetFromJson.length > 0) {
            pheDuyetFromJson.forEach((pd: any) => {
              if (pd.maKyDuyet && pd.nguoiDuyetId) {
                signatureFields[pd.maKyDuyet] = pd.nguoiDuyetId;
              }
            });
          } else {
            ((res as any)?.pheDuyet || []).forEach((pd: any) => {
              const sig = config.signatures.find(
                (s) => s.capDuyet === pd.capDuyet && s.type === "selectNguoiKy",
              );
              if (sig && pd.nguoiDuyetId) {
                signatureFields[sig.key] = pd.nguoiDuyetId;
              }
            });
          }

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

          if ((res as any)?.tinhTrang === TrangThaiPhieuConst.DangLuu) {
            const overrides: Record<string, any> = {};
            config.signatures
              .filter((sig) => sig.capDuyet === 0)
              .forEach((sig) => {
                overrides[sig.key] = currentUserInfo?.iD_TaiKhoan ?? null;
              });
            if (Object.keys(overrides).length > 0) {
              form.setFieldsValue(overrides);
            }
          }

          setTable1Data((formValues.table1 as TableRow[]) || table1DefaultData);
          setTable2Data((formValues.table2 as TableRow[]) || []);

          setPhieuInfo({
            tinhTrang: (res as any)?.tinhTrang ?? 0,
            nguoiTaoId: (res as any)?.nguoiTaoId ?? null,
            idphongBan: (res as any)?.idphongBan ?? null,
            pheDuyet: (res as any)?.pheDuyet || data.pheDuyet || [],
            isClone: (res as any)?.isClone ?? false,
          });
        }
      } else {
        setPhieuInfo({});
        setTable1Data(table1DefaultData);
        setTable2Data([]);

        setTimeout(() => {
          const overrides: Record<string, any> = {};
          config.signatures
            .filter((sig) => sig.capDuyet === 0)
            .forEach((sig) => {
              overrides[sig.key] = currentUserInfo?.iD_TaiKhoan ?? null;
            });
          if (Object.keys(overrides).length > 0) {
            form.setFieldsValue(overrides);
          }
        }, 200);
      }
    } catch {
      message.error("Không thể tải dữ liệu ban đầu!");
    } finally {
      setLoading(false);
    }
  }, [
    idphieu,
    form,
    config.signatures,
    config.headerFields,
    currentUserInfo,
    table1DefaultData,
  ]);

  useEffect(() => {
    initData();
  }, [initData]);

  useEffect(() => {
    DonTrongPhoiServiceApi.getAll({ excludeLocked: true })
      .then(setDonTrongPhoiData)
      .catch(() => {});
  }, []);

  const normalizeMacPhoiLoai = (value: any): 1 | 2 | 3 | null => {
    if (value == null || value === "") return null;
    if (typeof value === "number") {
      return value === 1 || value === 2 || value === 3 ? value : null;
    }

    const normalized = String(value)
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[.)]/g, "")
      .replace(/\s+/g, " ");

    if (["1", "i", "loai i", "loai 1", "a loai i"].includes(normalized))
      return 1;
    if (["2", "ii", "loai ii", "loai 2", "b loai ii"].includes(normalized))
      return 2;
    if (["3", "iii", "loai iii", "loai 3", "c loai iii"].includes(normalized))
      return 3;

    return null;
  };

  const getFormData = useCallback(async () => {
    const userInfo = getUserInfo();
    const formData = await form.validateFields();

    const pheDuyetFlow = config.signatures.map((s) => ({
      capDuyet: s.capDuyet,
      maKyDuyet: s.key,
      nguoiDuyetId: form.getFieldValue(s.key),
      tinhTrang: 0,
      ghiChu: "",
    }));

    const dateFields = config.headerFields
      .filter((f: any) => f.type === "date")
      .map((f: any) => f.key);
    const formattedDates: Record<string, any> = {};
    dateFields.forEach((k: string) => {
      if (formData[k]) {
        formattedDates[k] = formData[k].format("YYYY-MM-DD");
      }
    });

    const normalizeRows = (rows: TableRow[]) =>
      rows.map((row) => {
        const clone = { ...row };
        delete clone._isNewRow;
        delete clone.key;
        return clone;
      });

    const injectDonTrongId = (rows: TableRow[]) =>
      rows.map((row) => {
        const mac = row.macPhoi as string | undefined;
        const kt = row.kichThuoc as string | undefined;
        const match = donTrongPhoiData.find(
          (d) => d.mac === mac && d.kichThuoc === (kt || null)
        );
        return match ? { ...row, idDonTrongPhoi: match.id } : row;
      });

    const table1Section = config.layout.find(
      (section: any) =>
        section.sectionType === "table" && section.key === "table1",
    );
    const table1LabelKey =
      (table1Section as any)?.columns?.find((col: any) => col.isLabel)
        ?.dataIndex || "MacPhoiLoai";

    const normalizedTable1 = normalizeRows(injectDonTrongId(table1Data)).map((row, idx) => {
      const code = normalizeMacPhoiLoai((row as any)[table1LabelKey]);
      if (code === null) {
        message.warning(
          `Dòng ${idx + 1} có giá trị ${table1LabelKey} không hợp lệ. Chỉ chấp nhận Loại I/II/III.`,
        );
        throw new Error("MacPhoiLoai invalid");
      }
      return {
        ...row,
        [table1LabelKey]: code,
      };
    });

    return {
      ...formData,
      ...formattedDates,
      maBm: config.code,
      prefix: config.prefix,
      scope: formData.xuong ?? null,
      xuongId: userInfo.iD_PhanXuong ?? null,
      idphongBan: userInfo.iD_PhongBan ?? null,
      nguoiTaoId: userInfo.iD_TaiKhoan ?? null,
      table1: normalizedTable1,
      table2: normalizeRows(table2Data),
      pheDuyet: pheDuyetFlow,
    };
  }, [getUserInfo, form, config, table1Data, table2Data]);

  const handleActionSuccess = useCallback(
    async (context?: { newPhieuId?: string }) => {
      if (context?.newPhieuId) {
        navigate(`/taophieusotheodoisanxuat/${context.newPhieuId}`, {
          replace: true,
        });
        return;
      }
      await initData();
    },
    [navigate, initData],
  );

  // Handler for saving data when user has chốt permission
  const handleSaveData = useCallback(async () => {
    try {
      setLoading(true);
      const formData = await getFormData();
      // chỉ update bảng dữ liệu k cần update các trường khác vì khi chốt sẽ gọi API riêng để update tinhTrang
      // bỏ luồng phê duyệt luôn nên không cần gửi pheDuyet nữa
      delete formData.pheDuyet;
      console.log("Saving data with chốt permission, formData:", formData);

      // Use new putTableDataOnly API for updating table data only (no form status constraints)
      await PhieuApi.putTableDataOnly(idphieu || "", formData);
      message.success("Lưu dữ liệu thành công!");
    } catch (error: any) {
      console.error("Save error:", error);
      message.error(error?.message || "Lưu dữ liệu thất bại!");
    } finally {
      setLoading(false);
    }
  }, [idphieu, getFormData]);

  const handleExportPdf = async () => {
    if (!idphieu) {
      message.warning("Vui lòng lưu phiếu trước khi xuất PDF!");
      return;
    }
    try {
      setLoading(true);
      const response = await PhieuApi.exportDynamicPDF(idphieu, {});
      const blob = new Blob([response as any], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `So_theo_doi_san_xuat_${soPhieu || idphieu}_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success("Xuất PDF thành công!");
    } catch (error: any) {
      console.error("Export PDF failed:", error);
      message.error(error?.message || "Xuất file PDF thất bại!");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const table1Section = config.layout.find(
      (section: any) =>
        section.sectionType === "table" && section.key === "table1",
    );
    if (!table1Section) {
      message.error("Không tìm thấy cấu hình bảng!");
      return;
    }

    const labelColumn = table1Section.columns.find((col: any) => col.isLabel);
    const templateColumns = table1Section.columns.filter(
      (col: any) => !col.isLabel && col.dataIndex !== "loaiPhoi",
    );
    const labelKey = labelColumn?.dataIndex || "MacPhoiLoai";
    const initialRows: TableRow[] = table1Section.initialData || [];

    const headers = [
      [
        labelColumn?.title || "Loại mác phôi",
        ...templateColumns.map((col: any) => col.title),
        "Phôi nóng (Tích x)",
        "Phôi nguội (Tích x)",
      ],
    ];
    const dataRows = initialRows.map((row: TableRow) => [
      row[labelKey] ?? "",
      ...templateColumns.map(() => ""),
      "",
      "",
    ]);

    const ws = XLSX.utils.aoa_to_sheet([...headers, ...dataRows]);
    ws["!cols"] = [
      {
        wch: Math.min(labelColumn?.width ? labelColumn.width / 10 : 15, 30),
      },
      ...templateColumns.map((col: any) => ({
        wch: Math.min(col.width ? col.width / 10 : 15, 30),
      })),
      { wch: 16 },
      { wch: 16 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SoTheoDoiSanXuat");
    XLSX.writeFile(wb, "Template_SoTheoDoiSanXuat.xlsx");
    message.success("Tải template thành công!");
  };

  const handleImportExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (rows.length < 2) {
          message.warning("File không có dữ liệu!");
          return;
        }

        const table1Section = config.layout.find(
          (section: any) =>
            section.sectionType === "table" && section.key === "table1",
        );
        if (!table1Section) {
          message.error("Không tìm thấy cấu hình bảng!");
          return;
        }

        // Get columns separated by type
        const labelColumns = table1Section.columns.filter(
          (col: any) => col.isLabel,
        );
        const templateColumns = table1Section.columns.filter(
          (col: any) => !col.isLabel && col.dataIndex !== "loaiPhoi",
        );
        const columnKeys = templateColumns.map((col: any) => col.dataIndex);
        const loaiPhoiKey =
          table1Section.columns.find((col: any) => col.dataIndex === "loaiPhoi")
            ?.dataIndex || "loaiPhoi";

        // Get the header row to detect column mapping
        const headerRow = rows[0] || [];
        const headerTitles = headerRow.map((h: any) =>
          String(h ?? "")
            .trim()
            .toLowerCase(),
        );

        // Check if this is an imported file with 3-row fixed structure
        const isMacPhoiType =
          headerTitles.some((h) => h.includes("mác phôi")) ||
          headerTitles.some((h) => h.includes("mac phoi"));

        // Detect indices of checkbox columns
        const phoiNongColIndex = headerTitles.findIndex(
          (h) => h.includes("phôi nóng") || h.includes("phoi nong"),
        );
        const phoiNguoiColIndex = headerTitles.findIndex(
          (h) => h.includes("phôi nguội") || h.includes("phoi nguoi"),
        );
        const labelColIndex = headerTitles.findIndex(
          (h) =>
            h.includes("loại mác phôi") ||
            h.includes("loai mac phoi") ||
            h.includes("mác phôi") ||
            h.includes("mac phoi"),
        );
        const dataStartCol = labelColIndex >= 0 ? labelColIndex + 1 : 0;

        const dataRows = rows
          .slice(1)
          .filter((r) => r.some((c) => c !== undefined && c !== ""));

        // // For template with 3 fixed rows, allow only 3 rows; otherwise flexible
        // if (isMacPhoiType && dataRows.length !== 3) {
        //   message.warning(
        //     "File phải chứa đúng 3 dòng dữ liệu (Loại I, II, III)!",
        //   );
        //   return;
        // }

        const loaiTextByCode: Record<1 | 2 | 3, string> = {
          1: "Loại I",
          2: "Loại II",
          3: "Loại III",
        };

        const imported: TableRow[] = dataRows.map((r, idx) => {
          const row: TableRow = {
            key: `import-${Date.now()}-${idx}`,
          };

          // Set MacPhoiLoai for label column
          if (labelColumns.length > 0) {
            const labelKey = labelColumns[0].dataIndex || "MacPhoiLoai";
            const importedLabel =
              labelColIndex >= 0 ? String(r[labelColIndex] ?? "").trim() : "";
            const fallbackCode = ((idx % 3) + 1) as 1 | 2 | 3;
            const code = normalizeMacPhoiLoai(importedLabel) || fallbackCode;

            if (importedLabel && normalizeMacPhoiLoai(importedLabel) === null) {
              message.warning(
                `Dòng ${idx + 1} có Mác phôi loại không hợp lệ: "${importedLabel}".`,
              );
              throw new Error("MacPhoiLoai import invalid");
            }

            // Giữ text trên UI, sẽ đổi sang 1/2/3 ở bước gửi dữ liệu
            row[labelKey] = loaiTextByCode[code];
          }

          // Map template columns to row data
          columnKeys.forEach((key, colIdx) => {
            const value = r[colIdx + dataStartCol];
            if (
              [
                "soPhoiRaKhoiLo",
                "soPhoiHoiLo",
                "soPhoiCanRaSanPham",
                "soPhoiPheCongNghe",
              ].includes(key)
            ) {
              row[key] = Number(value) || 0;
            } else {
              row[key] = value ?? "";
            }
          });
          // Handle checkbox marking for phôi type (nóng/nguội)
          if (phoiNongColIndex >= 0 || phoiNguoiColIndex >= 0) {
            const phoiNongValue = String(r[phoiNongColIndex] ?? "")
              .trim()
              .toLowerCase();
            const phoiNguoiValue = String(r[phoiNguoiColIndex] ?? "")
              .trim()
              .toLowerCase();
            const isNongMarked = phoiNongValue === "x" || phoiNongValue === "1";
            const isNguoiMarked =
              phoiNguoiValue === "x" || phoiNguoiValue === "1";

            if (isNongMarked) {
              row[loaiPhoiKey] = 1; // Phôi nóng
            } else if (isNguoiMarked) {
              row[loaiPhoiKey] = 2; // Phôi nguội
            }
          }

          return row;
        });
        // Validate macPhoi + kichThuoc với danh sách DonTrongPhoi — block nếu không hợp lệ
        if (donTrongPhoiData.length > 0) {
          const errors: string[] = [];
          imported.forEach((row, i) => {
            const mp = row.macPhoi as string | undefined;
            const kt = row.kichThuoc as string | undefined;
            if (!mp) return;
            const macExists = donTrongPhoiData.some((d) => d.mac === mp);
            if (!macExists) {
              errors.push(`Dòng ${i + 1}: mác "${mp}" không có trong danh sách`);
            } else if (kt) {
              const ktExists = donTrongPhoiData.some(
                (d) => d.mac === mp && d.kichThuoc === kt,
              );
              if (!ktExists) {
                errors.push(
                  `Dòng ${i + 1}: kích thước "${kt}" không hợp lệ cho mác "${mp}"`,
                );
              }
            }
          });
          if (errors.length > 0) {
            Modal.error({
              title: `Import thất bại — ${errors.length} dòng không khớp danh mục`,
              content: (
                <ul style={{ maxHeight: 300, overflowY: "auto", paddingLeft: 16 }}>
                  {errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              ),
              width: 520,
            });
            return;
          }
        }

        setTable1Data(imported);
        message.success(`Import thành công ${imported.length} dòng dữ liệu!`);
      } catch (error) {
        console.error("Import failed:", error);
        message.error("Đọc file thất bại, vui lòng kiểm tra lại template!");
      }
    };
    reader.readAsArrayBuffer(file);
    return false;
  };

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
      onSuccess: handleActionSuccess,
      onError: (error) => {
        console.error("Action error:", error);
      },
    });

    if (buttons.length === 0) return null;
    return phieuActionService.renderActionButtons(
      buttons,
      idphieu || "",
      getFormData,
    );
  }, [getUserInfo, idphieu, phieuInfo, getFormData, handleActionSuccess]);

  const table1Section = config.layout.find(
    (section: any) =>
      section.sectionType === "table" && section.key === "table1",
  );
  const table2Section = config.layout.find(
    (section: any) =>
      section.sectionType === "table" && section.key === "table2",
  );

  // Khi macPhoi thay đổi → xóa kichThuoc nếu không còn hợp lệ
  const handleTable1CellChange = useCallback((rowIndex: number, dataIndex: string, _value: any, row: any) => {
    if (dataIndex === "macPhoi") {
      const validKichThuocs = donTrongPhoiData
        .filter((d) => d.mac === _value)
        .map((d) => d.kichThuoc)
        .filter(Boolean);
      if (row.kichThuoc && !validKichThuocs.includes(row.kichThuoc)) {
        setTable1Data((prev) =>
          prev.map((r, i) => (i === rowIndex ? { ...r, kichThuoc: null } : r)),
        );
      }
    }
  }, [donTrongPhoiData]);

  // Columns với Select động cho macPhoi và kichThuoc
  const table1ColumnsWithDynamic = useMemo(() => {
    if (!table1Section) return [];
    const uniqueMacs = [...new Set(donTrongPhoiData.map((d) => d.mac).filter(Boolean) as string[])].sort();
    return (table1Section.columns || []).map((col: any) => {
      if (col.dataIndex === "macPhoi") {
        return {
          ...col,
          renderCell: (record: any, _idx: number, onChange: (v: any) => void, disabled: boolean) => (
            <Select
              value={record.macPhoi || undefined}
              onChange={onChange}
              disabled={disabled}
              style={{ width: "100%" }}
              allowClear
              showSearch
              placeholder="Chọn mác"
              options={uniqueMacs.map((m) => ({ label: m, value: m }))}
            />
          ),
        };
      }
      if (col.dataIndex === "kichThuoc") {
        return {
          ...col,
          renderCell: (record: any, _idx: number, onChange: (v: any) => void, disabled: boolean) => {
            const kichThuocOptions = donTrongPhoiData
              .filter((d) => d.mac === record.macPhoi && d.kichThuoc)
              .map((d) => d.kichThuoc as string);
            const uniqueOptions = [...new Set(kichThuocOptions)].sort();
            return (
              <Select
                value={record.kichThuoc || undefined}
                onChange={onChange}
                disabled={disabled || !record.macPhoi}
                style={{ width: "100%" }}
                allowClear
                showSearch
                placeholder={record.macPhoi ? "Chọn kích thước" : "Chọn mác trước"}
                options={uniqueOptions.map((k) => ({ label: k, value: k }))}
              />
            );
          },
        };
      }
      return col;
    });
  }, [table1Section, donTrongPhoiData]);

  const handleThemMacPhoi = async () => {
    try {
      const values = await themMacPhoiForm.validateFields();
      const mac = values.mac?.trim() || null;
      const kichThuoc = values.kichThuoc?.trim() || null;
      const donTrong: number = values.donTrong ?? 0;

      const isDuplicate = donTrongPhoiData.some(
        (d) => d.mac === mac && d.kichThuoc === kichThuoc
      );
      if (isDuplicate) {
        message.warning(
          `Mác "${mac ?? ""}"${kichThuoc ? ` - Kích thước "${kichThuoc}"` : ""} đã tồn tại trong danh sách!`
        );
        return;
      }

      setThemMacPhoiLoading(true);
      const macPhoi = [mac, kichThuoc].filter(Boolean).join("_") || `MPC_${Date.now()}`;
      const newRecord = await DonTrongPhoiServiceApi.create({ macPhoi, mac, kichThuoc, donTrong });
      setDonTrongPhoiData((prev) => [...prev, newRecord]);
      message.success("Thêm mác phôi thành công!");
      setThemMacPhoiVisible(false);
      themMacPhoiForm.resetFields();
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "errorFields" in err) return;
      const errMsg =
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: string }).message)
          : "Không thể thêm mác phôi";
      message.error(errMsg);
    } finally {
      setThemMacPhoiLoading(false);
    }
  };

  const handleAddTable1Triplet = useCallback(() => {
    const ts = Date.now();
    const newRows: TableRow[] = [
      { key: `${ts}-L1`, MacPhoiLoai: "a. Loại I" },
      { key: `${ts}-L2`, MacPhoiLoai: "b. Loại II" },
      { key: `${ts}-L3`, MacPhoiLoai: "c. Loại III" },
    ];
    setTable1Data((prev) => [...prev, ...newRows]);
  }, []);

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
          {config.headerFields.map((f, idx) => (
            <CustomFormItem
              key={f.key || idx}
              field={f}
              idx={idx}
              disabled={isFormLocked}
            />
          ))}
        </div>

        <div
          style={{ marginTop: 16, marginBottom: 16, display: "flex", gap: 8 }}
        >
          {!isFormLocked && (
            <>
              <Button
                type="default"
                style={{
                  backgroundColor: "#faad14",
                  borderColor: "#faad14",
                  color: "#fff",
                }}
                icon={<DownloadOutlined />}
                onClick={handleDownloadTemplate}
              >
                Tải template
              </Button>
              <Upload
                accept=".xlsx,.xls"
                showUploadList={false}
                beforeUpload={handleImportExcel}
              >
                <Button
                  icon={<FileExcelOutlined />}
                  style={{
                    backgroundColor: "#007906",
                    borderColor: "#007906",
                    color: "#fff",
                  }}
                >
                  Import Excel
                </Button>
              </Upload>
              <Button
                icon={<PlusOutlined />}
                onClick={() => setThemMacPhoiVisible(true)}
              >
                Thêm mác phôi
              </Button>
            </>
          )}
          {/* Save button for users with chốt permission when form is in HoanThanh state */}
          {canChotPhieu &&
            currentTinhTrang !== TrangThaiPhieuConst.DaChot &&
            idphieu && (
              <Button
                type="primary"
                onClick={handleSaveData}
                loading={loading}
                style={{ backgroundColor: "#1890ff" }}
              >
                Lưu dữ liệu điều chỉnh
              </Button>
            )}
          {/* {idphieu &&
            (currentTinhTrang === TrangThaiPhieuConst.HoanThanh ||
              currentTinhTrang === TrangThaiPhieuConst.DaChot) && (
              <Button
                type="default"
                icon={<FilePdfOutlined />}
                onClick={handleExportPdf}
                loading={loading}
              >
                Xuất PDF
              </Button>
            )} */}
          {actionButtons}
        </div>

        {table1Section && (
          <div>
            <Typography.Title
              level={5}
              style={{ marginTop: 4, marginBottom: 2 }}
            >
              {table1Section.title}
            </Typography.Title>
            {!isFormLocked && (
              <Button
                type="dashed"
                onClick={handleAddTable1Triplet}
                style={{ marginTop: 8 }}
              >
                + Thêm bộ loại I/II/III
              </Button>
            )}
            <CustomFormTable
              columns={table1ColumnsWithDynamic}
              initialData={table1Data}
              onDataChange={(rows) => setTable1Data(rows as TableRow[])}
              onCellChange={handleTable1CellChange}
              loading={loading}
              editable={!isFormLocked}
              showAddButton={false}
              showDeleteButton={false}
              minRows={table1Data.length || 3}
            />
          </div>
        )}

        {table2Section && (
          <div>
            <Typography.Title
              level={5}
              style={{ marginTop: 16, marginBottom: 2 }}
            >
              {table2Section.title}
            </Typography.Title>
            <CustomFormTable
              columns={table2Section.columns || []}
              initialData={table2Data}
              onDataChange={(rows) => setTable2Data(rows as TableRow[])}
              addRowButtonText="+ Thêm diễn biến"
              loading={loading}
              editable={!isFormLocked}
              showAddButton={!isFormLocked}
              showDeleteButton={!isFormLocked}
              minRows={0}
            />
          </div>
        )}

        <div
          style={{
            marginTop: 40,
            display: "flex",
            justifyContent: "space-around",
            textAlign: "center",
          }}
        >
          {config.signatures?.map((sig, i) => {
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

      <Modal
        title="Thêm mác phôi"
        open={themMacPhoiVisible}
        onCancel={() => {
          setThemMacPhoiVisible(false);
          themMacPhoiForm.resetFields();
        }}
        onOk={handleThemMacPhoi}
        confirmLoading={themMacPhoiLoading}
        okText="Lưu"
        cancelText="Hủy"
        destroyOnClose
      >
        <Form form={themMacPhoiForm} layout="vertical">
          <Form.Item
            name="mac"
            label="Mác"
            rules={[
              { required: true, message: "Vui lòng nhập mác" },
              { whitespace: true, message: "Không được chỉ có khoảng trắng" },
              { max: 100, message: "Tối đa 100 ký tự" },
            ]}
          >
            <Input placeholder="Nhập mác thép (VD: CT3, SS400...)" />
          </Form.Item>
          <Form.Item
            name="kichThuoc"
            label="Kích thước"
            rules={[{ max: 100, message: "Tối đa 100 ký tự" }]}
          >
            <Input placeholder="VD: 150x150, 160x160..." />
          </Form.Item>
          <Form.Item name="donTrong" label="Đơn trọng (kg)">
            <InputNumber
              style={{ width: "100%" }}
              placeholder="Nhập đơn trọng (nếu có)"
              min={0}
              precision={3}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default TaoSoTheoDoiSanXuat;
