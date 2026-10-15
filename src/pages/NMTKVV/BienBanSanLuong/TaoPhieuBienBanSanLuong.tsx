/* eslint-disable @typescript-eslint/no-explicit-any */

import TKVV_BB_SanLuong from "../../../utils/BM_config/TKVV_BB_SanLuong.json";

import { Button, Card, Form, Input, Space, Typography, message } from "antd";

import { ReloadOutlined, UndoOutlined } from "@ant-design/icons";

import dayjs from "dayjs";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";

import { useNavigate, useParams } from "react-router-dom";

import CustomFormItem from "../../../components/CustomFormItem";

import TKVVBBSLTable, {
  type FormColumnDef,
} from "../../../components/TKVVBBSLTable";

import { PhieuApi } from "../../../services/PhieuApi";
import { phieuActionService } from "../../../services/PhieuActionService";

import { TrangThaiPhieuConst } from "../../../utils/constants/TrangThaiPhieuConstant";

import { getThongTinUser } from "../../../utils/constants/GetThongTinLocalStore";

import {
  tkvvNvlApi,
  tkvvChiTietApi,
  tkvvTongTuDongApi,
  type TKVVNguyenVatLieuDto,
  type TKVVChiTietDto,
} from "../../../services/TKVVApi";

interface TableRow {
  key: string | number;

  thuTuDong?: number;

  thoiGian?: string;

  tenSanPham?: number | null;

  donViTinh?: string;

  ghiChu?: string;

  "1"?: number | string;
  "2"?: number | string;
  "3"?: number | string;
  "4"?: number | string;

  [key: string]: any;
}

const PHAN_LOAI_KEYS = ["1", "2", "3", "4"] as const;

// Số dòng mặc định khi tạo phiếu mới
const SO_DONG_MAC_DINH = 4;

// Khung giờ cố định theo Ca, gán theo vị trí dòng (dòng 1 → mốc giờ 1, ...)
const CA_TIME_SLOTS: Record<number, string[]> = {
  1: ["08:30", "11:30", "14:30", "17:30"],
  2: ["20:30", "23:30", "02:30", "05:30"],
};

// Chưa gán NVL ở đây vì danh mục (nvlOptions) chưa tải xong lúc khởi tạo dòng;
// sản phẩm đầu tiên sẽ được tự động gán bởi effect "hasAutoFilledSanPhamRef"
// ngay khi danh mục sẵn sàng.
const buildBlankRow = (idx: number): TableRow => ({
  key: `blank-${idx}-${Date.now()}`,

  thuTuDong: idx,

  thoiGian: "",

  tenSanPham: null,

  donViTinh: "",

  ghiChu: "",

  "1": "",
  "2": "",
  "3": "",
  "4": "",
});

const TaoPhieuBienBanSanLuong = () => {
  const { id } = useParams<{ id: string }>();

  const navigate = useNavigate();

  const idphieu = id;

  const config = TKVV_BB_SanLuong as any;

  const [form] = Form.useForm();

  // ─────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────

  const [tableData, setTableData] = useState<TableRow[]>([]);

  const [loading, setLoading] = useState(false);

  const [loadingTongTuDong, setLoadingTongTuDong] = useState(false);

  // Tổng duy nhất lấy từ PLC/EMS
  const [tongTuDongPLC, setTongTuDongPLC] = useState<number | null>(null);
  const autoCalculatedRef = useRef<{
    rowKey: string | number | null;
    columnKey: string | null;
    value: number | null;
  }>({
    rowKey: null,
    columnKey: null,
    value: null,
  });

  const [soPhieu, setSoPhieu] = useState("");

  const [nvlOptions, setNvlOptions] = useState<TKVVNguyenVatLieuDto[]>([]);

  const [phieuInfo, setPhieuInfo] = useState<{
    tinhTrang?: number;

    nguoiTaoId?: number | null;

    idphongBan?: number | null;

    pheDuyet?: any[];

    isClone?: boolean;

    idPhieuGoc?: string | null;
  }>({});

  const phieuInfoRef = useRef(phieuInfo);

  useEffect(() => {
    phieuInfoRef.current = phieuInfo;
  }, [phieuInfo]);

  const currentUserInfo = useMemo(() => getThongTinUser(), []);

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

  const getUserInfo = useCallback(() => getThongTinUser(), []);

  // ─────────────────────────────────────────────────────────────
  // NVL
  // ─────────────────────────────────────────────────────────────

  const nvlById = useMemo(() => {
    const map = new Map<number, TKVVNguyenVatLieuDto>();

    nvlOptions.forEach((n) => map.set(n.id, n));

    return map;
  }, [nvlOptions]);

  const scopeValue = Form.useWatch("scope", form);

  // ─────────────────────────────────────────────────────────────
  // KHUNG GIỜ THEO CA
  // Ca ngày (1): 8h30, 11h30, 14h30, 17h30
  // Ca đêm (2): 20h30, 23h30, 02h30, 05h30
  // ─────────────────────────────────────────────────────────────

  const caValue = Form.useWatch("ca", form);

  useEffect(() => {
    // Chỉ tự động điền khi tạo phiếu mới, không đụng vào dữ liệu đã lưu
    if (idphieu) {
      return;
    }

    const slots = CA_TIME_SLOTS[Number(caValue)];

    if (!slots) {
      return;
    }

    setTableData((prev) =>
      prev.map((row, idx) =>
        slots[idx] !== undefined ? { ...row, thoiGian: slots[idx] } : row,
      ),
    );
  }, [caValue, idphieu]);

  // ─────────────────────────────────────────────────────────────
  // LOAD NVL THEO BM + SCOPE
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!scopeValue) {
      setNvlOptions([]);

      return;
    }

    tkvvNvlApi
      .getListnvlbyBM({
        maBM: config.code,
        scope: scopeValue,
      })

      .then((list) => {
        setNvlOptions((list || []).filter((n) => n.trangThai));
      })

      .catch(() => message.error("Không thể tải danh mục sản lượng!"));
  }, [config.code, scopeValue]);

  // ─────────────────────────────────────────────────────────────
  // HIỂN THỊ TÊN SCOPE
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const opt = config.headerFields
      .find((f: any) => f.key === "scope")
      ?.options?.find((o: any) => o.value === scopeValue);

    if (opt?.tenScope) {
      form.setFieldsValue({
        tenScope: opt.tenScope,
      });
    }
  }, [scopeValue, config, form]);

  // ─────────────────────────────────────────────────────────────
  // DB → TABLE
  // ─────────────────────────────────────────────────────────────

  const chiTietToRows = useCallback(
    (chiTiet: TKVVChiTietDto[]): TableRow[] => {
      return [...chiTiet]

        .sort((a, b) => (a.thuTuDong ?? 0) - (b.thuTuDong ?? 0))

        .map((c) => ({
          key: `row-${c.id}`,

          thuTuDong: c.thuTuDong ?? undefined,

          thoiGian: c.thoiGian ?? "",

          tenSanPham: c.nguyenVatLieuID,

          // donViTinh được đồng bộ riêng khi nvlOptions tải xong (xem effect bên dưới)
          donViTinh: "",

          ghiChu: c.ghiChu ?? "",

          "1": c.loai1 ?? "",

          "2": c.loai2 ?? "",

          "3": c.loai3 ?? "",

          "4": c.phePham ?? "",
        }));
    },
    [],
  );

  // Đồng bộ ĐVT khi danh mục NVL tải/thay đổi, không re-init toàn bộ form/table
  useEffect(() => {
    if (nvlOptions.length === 0) {
      return;
    }

    setTableData((prev) =>
      prev.map((row) => {
        const nvlId = Number(row.tenSanPham) || null;

        const dvt = nvlId ? (nvlById.get(nvlId)?.donViTinh ?? "") : "Tấn";

        return dvt !== row.donViTinh
          ? {
              ...row,
              donViTinh: dvt,
            }
          : row;
      }),
    );
  }, [nvlById, nvlOptions.length]);

  // Tự động gắn sản phẩm đầu tiên trong danh mục vào cột "Sản lượng" cho các
  // dòng chưa chọn, ngay khi danh mục NVL vừa tải xong lúc mở phiếu.
  // Chỉ chạy 1 lần/phiếu nên nếu người dùng chọn lại sản phẩm khác sau đó
  // sẽ không bị ghi đè.
  const hasAutoFilledSanPhamRef = useRef(false);

  useEffect(() => {
    if (hasAutoFilledSanPhamRef.current || nvlOptions.length === 0) {
      return;
    }

    hasAutoFilledSanPhamRef.current = true;

    setTableData((prev) =>
      prev.map((row) =>
        row.tenSanPham
          ? row
          : {
              ...row,
              tenSanPham: nvlOptions[0].id,
            },
      ),
    );
  }, [nvlOptions]);

  // ─────────────────────────────────────────────────────────────
  // INIT DATA
  // ─────────────────────────────────────────────────────────────

  const initData = useCallback(async () => {
    try {
      setLoading(true);

      if (idphieu) {
        const res: any = await PhieuApi.getDetail(idphieu);

        if (res) {
          setSoPhieu(res.soPhieu || "");

          const data = res.jsonData || {};

          const signatureFields: Record<string, any> = {};

          (res.pheDuyet || []).forEach((pd: any) => {
            const sig = config.signatures.find(
              (s: any) =>
                s.capDuyet === pd.capDuyet && s.type === "selectNguoiKy",
            );

            if (sig && pd.nguoiDuyetId) {
              signatureFields[sig.key] = pd.nguoiDuyetId;
            }
          });

          const tinhTrang = res.tinhTrang ?? 0;

          // Phiếu tạo tự động từ BM có thể không có Ngày/Ca/Kíp/Xưởng trong
          // jsonData → lấy từ các cột của chính phiếu.
          const headerFromPhieu: Record<string, any> = {
            NgaySX: data.NgaySX ?? res.ngaySX,
            ca: data.ca ?? res.ca,
            scope: data.scope ?? res.scope,
          };

          const dateFields = config.headerFields

            .filter((f: any) => f.type === "date")

            .map((f: any) => f.key);

          const parsedDates: Record<string, any> = {};

          dateFields.forEach((k: string) => {
            const raw = headerFromPhieu[k] ?? data[k];

            if (raw) {
              const parsed = dayjs(raw);

              parsedDates[k] = parsed.isValid() ? parsed : null;
            }
          });

          form.setFieldsValue({
            ...data,
            ...headerFromPhieu,
            ...signatureFields,
            ...parsedDates,
          });

          if (tinhTrang === TrangThaiPhieuConst.DangLuu) {
            const overrides: Record<string, any> = {};

            config.signatures

              .filter((sig: any) => sig.capDuyet === 0)

              .forEach((sig: any) => {
                overrides[sig.key] = currentUserInfo?.iD_TaiKhoan ?? null;
              });

            if (Object.keys(overrides).length > 0) {
              form.setFieldsValue(overrides);
            }
          }

          const chiTiet = await tkvvChiTietApi.getByPhieu(idphieu);

          let rows = chiTietToRows(chiTiet || []);

          // Phiếu tạo tự động chưa có dòng chi tiết / dòng chưa có giờ →
          // dựng sẵn khung giờ theo Ca như khi tạo phiếu mới (chỉ khi còn sửa được).
          const isEditable =
            tinhTrang === TrangThaiPhieuConst.DangLuu ||
            tinhTrang === TrangThaiPhieuConst.DaThuHoi ||
            tinhTrang === TrangThaiPhieuConst.HieuChinh;
          const slots = CA_TIME_SLOTS[Number(headerFromPhieu.ca)];

          if (isEditable) {
            if (rows.length === 0) {
              rows = Array.from({ length: SO_DONG_MAC_DINH }, (_, i) =>
                buildBlankRow(i + 1),
              );
            }

            if (slots) {
              rows = rows.map((row, idx) =>
                !row.thoiGian && slots[idx] !== undefined
                  ? { ...row, thoiGian: slots[idx] }
                  : row,
              );
            }
          }

          setTableData(rows);

          setPhieuInfo({
            tinhTrang,

            nguoiTaoId: res.nguoiTaoId ?? null,

            idphongBan: res.idphongBan ?? null,

            pheDuyet: res.pheDuyet || data.pheDuyet || [],

            isClone: res.isClone ?? false,

            idPhieuGoc:
              res.idPhieuGoc ?? res.iD_PhieuGoc ?? res.ID_PhieuGoc ?? null,
          });
        }
      } else {
        setPhieuInfo({});

        setTableData(
          Array.from(
            {
              length: SO_DONG_MAC_DINH,
            },
            (_, i) => buildBlankRow(i + 1),
          ),
        );

        setTimeout(() => {
          const overrides: Record<string, any> = {
            ca: 1,

            NgaySX: dayjs(),
          };

          config.signatures

            .filter((sig: any) => sig.capDuyet === 0)

            .forEach((sig: any) => {
              overrides[sig.key] = currentUserInfo?.iD_TaiKhoan ?? null;
            });

          form.setFieldsValue(overrides);
        }, 300);
      }
    } catch {
      message.error("Không thể tải dữ liệu ban đầu!");
    } finally {
      setLoading(false);
    }
  }, [
    idphieu,
    config.signatures,
    config.headerFields,
    currentUserInfo,
    chiTietToRows,
  ]);

  useEffect(() => {
    initData();
  }, [initData]);

  // ─────────────────────────────────────────────────────────────
  // TỔNG PLC / EMS
  //
  // Chỉ lấy 01 số theo:
  //
  //     Ngày + Ca + Scope
  //
  // Không còn Mapping.
  //
  // Không cho người dùng sửa.
  //
  // Chưa tự động tính dòng cuối.
  // ─────────────────────────────────────────────────────────────

  // Không tự động gọi API khi Ngày/Ca/Xưởng thay đổi.
  // Chỉ gọi khi người dùng bấm nút "Tải dữ liệu" (xem handleTaiDuLieu).

  // ─────────────────────────────────────────────────────────────
  // TẢI LẠI TỔNG PLC
  // ─────────────────────────────────────────────────────────────

  const handleTaiDuLieu = useCallback(async () => {
    const formData = form.getFieldsValue();

    const ngay = formData.NgaySX
      ? dayjs(formData.NgaySX).format("YYYY-MM-DD")
      : null;

    const ca = formData.ca ?? null;

    const scope = formData.scope ?? null;

    if (!ngay || ca === null || scope === null) {
      message.warning("Vui lòng chọn Ngày sản xuất, Ca và Xưởng trước!");

      return;
    }

    try {
      setLoadingTongTuDong(true);

      const res = await tkvvTongTuDongApi.get({
        ngay,
        ca,
        scope,
      });

      // Chưa có dữ liệu Ngày + Ca + Xưởng
      if (!res.hasData) {
        setTongTuDongPLC(null);

        message.warning(res.message || "Chưa có dữ liệu sản lượng.");

        return;
      }

      // Đã có dữ liệu → lấy Tổng PLC
      const tong = res.tongTuDong ?? 0;

      setTongTuDongPLC(tong);

      message.success("Đã tải dữ liệu tổng sản lượng mới nhất.");
    } catch (error: any) {
      message.error(
        error?.response?.data?.message ||
          error?.message ||
          "Không thể tải dữ liệu!",
      );
    } finally {
      setLoadingTongTuDong(false);
    }
  }, [form]);

  // ─────────────────────────────────────────────────────────────
  // THÊM DÒNG
  // ─────────────────────────────────────────────────────────────

  const handleAddRow = useCallback(() => {
    setTableData((prev) => {
      const updated = [...prev];

      // =====================================================
      // 1. Xóa giá trị tự động của dòng cuối cũ
      // =====================================================

      const autoRowKey = autoCalculatedRef.current.rowKey;

      const autoColumnKey = autoCalculatedRef.current.columnKey;

      if (autoRowKey !== null && autoColumnKey !== null) {
        const autoRowIndex = updated.findIndex((row) => row.key === autoRowKey);

        if (autoRowIndex >= 0) {
          updated[autoRowIndex] = {
            ...updated[autoRowIndex],

            [autoColumnKey]: "",
          };
        }
      }

      // =====================================================
      // 2. Xóa thông tin auto
      // =====================================================

      autoCalculatedRef.current = {
        rowKey: null,
        columnKey: null,
        value: null,
      };

      // =====================================================
      // 3. Thêm dòng mới
      // =====================================================

      updated.push(buildBlankRow(updated.length + 1));

      return updated;
    });
  }, []);

  // ─────────────────────────────────────────────────────────────
  // TABLE CHANGE
  // ─────────────────────────────────────────────────────────────

  const handleTableChange = useCallback(
    (rows: any[]) => {
      const synced = rows.map((r) => {
        const nvlId = Number(r.tenSanPham) || null;

        const dvt = nvlId ? (nvlById.get(nvlId)?.donViTinh ?? "") : "";

        return dvt !== r.donViTinh
          ? {
              ...r,
              donViTinh: dvt,
            }
          : r;
      });

      // Chỉ bỏ trạng thái AUTO khi giá trị thực tế khác
      // với giá trị mà hệ thống vừa tự tính.
      const autoRowKey = autoCalculatedRef.current.rowKey;
      const autoColumnKey = autoCalculatedRef.current.columnKey;
      const autoValue = autoCalculatedRef.current.value;

      if (autoRowKey !== null && autoColumnKey !== null && autoValue !== null) {
        const autoRow = synced.find((row) => row.key === autoRowKey);

        if (autoRow) {
          const currentValue = Number(autoRow[autoColumnKey]);

          if (!Number.isFinite(currentValue) || currentValue !== autoValue) {
            autoCalculatedRef.current = {
              rowKey: null,
              columnKey: null,
              value: null,
            };
          }
        }
      }

      setTableData(synced);
    },
    [nvlById],
  );

  const getRowTotal = useCallback((row: TableRow): number => {
    return PHAN_LOAI_KEYS.reduce((sum, k) => {
      const v = Number(row[k]);
      if (!Number.isFinite(v)) {
        return sum;
      }
      return sum + v;
    }, 0);
  }, []);

  useEffect(() => {
    // Phiếu đã khóa thì không tự động tính
    if (isFormLocked) {
      return;
    }

    // Chưa có Tổng PLC
    if (tongTuDongPLC === null) {
      return;
    }

    // Không đủ 2 dòng
    if (tableData.length < 2) {
      return;
    }

    const lastIndex = tableData.length - 1;
    const lastRow = tableData[lastIndex];

    // =========================================================
    // 1. Tính tổng tất cả các dòng phía trên
    // =========================================================

    const tongCacDongTruoc = tableData
      .slice(0, lastIndex)
      .reduce((sum, row) => {
        return sum + getRowTotal(row);
      }, 0);

    // =========================================================
    // 2. Tính phần còn lại
    // =========================================================

    const giaTriConLai =
      Math.round((tongTuDongPLC - tongCacDongTruoc) * 1000) / 1000;

    // Nếu tổng các dòng phía trên đã >= Tổng PLC
    if (giaTriConLai < 0) {
      return;
    }

    // =========================================================
    // 3. Xác định cột phân loại nhận phần còn lại
    //
    // Ưu tiên:
    // - Cột mà các dòng phía trên đang sử dụng
    // - Nếu chưa có thì mặc định Loại 1
    // =========================================================

    let targetKey: (typeof PHAN_LOAI_KEYS)[number] = "1";

    for (const key of PHAN_LOAI_KEYS) {
      const hasValue = tableData.slice(0, lastIndex).some((row) => {
        const value = Number(row[key]);

        return Number.isFinite(value) && value !== 0;
      });

      if (hasValue) {
        targetKey = key;
        break;
      }
    }

    // =========================================================
    // 4. Nếu người dùng đã nhập các loại khác ở dòng cuối
    // thì phải trừ chúng ra
    // =========================================================

    const tongDaNhapDongCuoi = PHAN_LOAI_KEYS.reduce((sum, key) => {
      if (key === targetKey) {
        return sum;
      }

      const value = Number(lastRow[key]);

      if (!Number.isFinite(value)) {
        return sum;
      }

      return sum + value;
    }, 0);

    const giaTriAuto =
      Math.round((giaTriConLai - tongDaNhapDongCuoi) * 1000) / 1000;

    if (giaTriAuto < 0) {
      return;
    }

    // =========================================================
    // 5. Nếu giá trị đã đúng → không update
    // =========================================================

    const currentValue = Number(lastRow[targetKey]);

    if (Number.isFinite(currentValue) && currentValue === giaTriAuto) {
      return;
    }

    // =========================================================
    // 6. Cập nhật dòng cuối
    // =========================================================

    setTableData((prev) => {
      if (prev.length < 2) {
        return prev;
      }

      const index = prev.length - 1;
      const currentLastRow = prev[index];

      const current = Number(currentLastRow[targetKey]);

      if (Number.isFinite(current) && current === giaTriAuto) {
        return prev;
      }

      autoCalculatedRef.current = {
        rowKey: currentLastRow.key,
        columnKey: targetKey,
        value: giaTriAuto,
      };

      const updated = [...prev];

      updated[index] = {
        ...currentLastRow,
        [targetKey]: giaTriAuto,
      };

      return updated;
    });
  }, [tableData, tongTuDongPLC, isFormLocked, getRowTotal]);
  const hasRowsToDelete = tableData.length > 0;

  // ─────────────────────────────────────────────────────────────
  // getFormData
  // ─────────────────────────────────────────────────────────────

  const getFormData = useCallback(async () => {
    const userInfo = getUserInfo();

    const formData = await form.validateFields();

    // Không lưu / không gửi tổng điều chỉnh.
    delete formData.tongCongDieuChinh;

    const pheDuyetFlow = config.signatures.map((s: any) => ({
      capDuyet: s.capDuyet,

      maKyDuyet: s.key,

      nguoiDuyetId: form.getFieldValue(s.key),

      tinhTrang: 0,

      ghiChu: "",
    }));

    // Kiểm tra dòng có dữ liệu nhưng chưa chọn NVL
    const rowsMissingSanPham = tableData

      .map((row, idx) => ({
        idx,
        row,
      }))

      .filter(
        ({ row }) =>
          !row.tenSanPham &&
          PHAN_LOAI_KEYS.some(
            (k) => row[k] !== undefined && row[k] !== "" && row[k] !== null,
          ),
      );

    if (nvlOptions.length === 0) {
      message.error(
        'Xưởng này chưa có sản phẩm nào trong danh mục. Vào "Kho dữ liệu → NM.TKVV → Quản lý NVL & Mapping" để thêm trước khi lưu.',
      );

      throw new Error("Thiếu danh mục sản phẩm (NVL) cho xưởng này");
    }

    if (rowsMissingSanPham.length > 0) {
      const soDong = rowsMissingSanPham.map(({ idx }) => idx + 1).join(", ");

      message.error(
        `Dòng ${soDong} đã nhập số liệu nhưng chưa chọn "Sản lượng" — chọn sản phẩm trước khi lưu.`,
      );

      throw new Error("Có dòng chưa chọn Sản lượng");
    }

    // Tổng các dòng đã nhập phải khớp với TỔNG CỘNG (PLC/EMS) mới cho lưu.
    // Chỉ áp dụng khi phiếu còn chỉnh sửa được — phiếu đã khóa thì số liệu
    // không còn sửa được và Tổng cộng cũng không được tải lại ở đây.
    if (!isFormLocked) {
      if (tongTuDongPLC === null) {
        message.error(
          "Vui lòng bấm \"Tải dữ liệu\" để lấy Tổng cộng (PLC/EMS) trước khi lưu!",
        );

        throw new Error("Chưa tải dữ liệu Tổng cộng");
      }

      const tongCacDong = tableData.reduce(
        (sum, row) => sum + getRowTotal(row),
        0,
      );

      const lechTong = Math.round((tongCacDong - tongTuDongPLC) * 1000) / 1000;

      if (Math.abs(lechTong) > 0.001) {
        message.error(
          `Tổng các dòng đã nhập (${tongCacDong.toLocaleString("en-US", { maximumFractionDigits: 3 })}) chưa khớp với Tổng cộng (${tongTuDongPLC.toLocaleString("en-US", { maximumFractionDigits: 3 })}). Vui lòng kiểm tra lại số liệu!`,
        );

        throw new Error("Tổng các dòng chưa khớp Tổng cộng");
      }
    }

    const processedTable1 = tableData.map((row, idx) => {
      const r: Record<string, any> = {
        thuTu: idx + 1,

        thoiGian: row.thoiGian ?? "",

        nguyenVatLieuID: Number(row.tenSanPham) || null,

        ghiChu: row.ghiChu ?? "",
      };

      PHAN_LOAI_KEYS.forEach((k) => {
        if (row[k] !== undefined && row[k] !== "") {
          r[k] = row[k];
        }

        if (row[`_manual_${k}`]) {
          r[`_manual_${k}`] = true;

          r[`_goc_${k}`] = row[`_goc_${k}`] ?? null;
        }
      });

      return r;
    });

    const dateFields = config.headerFields

      .filter((f: any) => f.type === "date")

      .map((f: any) => f.key);

    const formattedDates: Record<string, any> = {};

    dateFields.forEach((k: string) => {
      if (formData[k]) {
        formattedDates[k] = formData[k].format("YYYY-MM-DD");
      }
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
  }, [
    getUserInfo,
    form,
    config,
    tableData,
    nvlOptions,
    isFormLocked,
    tongTuDongPLC,
    getRowTotal,
  ]);

  // ─────────────────────────────────────────────────────────────
  // ACTION
  // ─────────────────────────────────────────────────────────────

  const handleActionSuccess = useCallback(
    async (context?: { newPhieuId?: string }) => {
      if (context?.newPhieuId) {
        navigate(`/taophieusanluongtkvv/${context.newPhieuId}`, {
          replace: true,
        });

        return;
      }

      await initData();
    },
    [navigate, initData],
  );

  const handleStatusChange = useCallback(async () => {
    try {
      await form.validateFields();
    } catch (error: any) {
      message.error(
        error?.message || "Vui lòng kiểm tra dữ liệu trước khi đổi trạng thái",
      );
    }
  }, [form]);

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

      phieuMaBm: config.code,

      pheDuyet: phieuInfo.pheDuyet ?? [],

      onStatusChange: handleStatusChange,

      onSuccess: handleActionSuccess,

      onError: (error) => console.error("Action error:", error),
    });

    if (buttons.length === 0) {
      return null;
    }

    return phieuActionService.renderActionButtons(
      buttons,
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
    config.code,
  ]);

  // ─────────────────────────────────────────────────────────────
  // TABLE COLUMNS
  // ─────────────────────────────────────────────────────────────

  const tableColumns: FormColumnDef[] = useMemo(
    () => [
      {
        title: "Thời gian",

        dataIndex: "thoiGian",

        width: 110,

        align: "center",

        type: "time",
      },

      {
        title: "Sản lượng",

        dataIndex: "tenSanPham",

        width: 200,

        options: nvlOptions.map((n) => ({
          label: n.tenNVL,

          value: n.id,
        })),
      },

      {
        title: "ĐVT",

        dataIndex: "donViTinh",

        width: 70,

        align: "center",

        readonly: true,
      },

      {
        title: "Loại 1",

        dataIndex: "1",

        width: 100,

        type: "float",

        align: "right",
      },

      {
        title: "Loại 2",

        dataIndex: "2",

        width: 100,

        type: "float",

        align: "right",
      },

      {
        title: "Loại 3",

        dataIndex: "3",

        width: 100,

        type: "float",

        align: "right",
      },

      {
        title: "Phế phẩm",

        dataIndex: "4",

        width: 100,

        type: "float",

        align: "right",
      },

      {
        title: "Ghi chú",

        dataIndex: "ghiChu",

        width: 180,
      },
    ],

    [nvlOptions],
  );

  // ─────────────────────────────────────────────────────────────
  // TABLE SUMMARY
  // ─────────────────────────────────────────────────────────────

  const tableSummary = useCallback(
    (data: readonly any[]) => {
      const totals: Record<string, number> = {
        "1": 0,
        "2": 0,
        "3": 0,
        "4": 0,
      };

      data.forEach((row) => {
        PHAN_LOAI_KEYS.forEach((k) => {
          const v = Number(row[k]);

          if (!Number.isNaN(v)) {
            totals[k] += v;
          }
        });
      });

      return (
        <>
          {/* Tổng từng loại */}

          <tr>
            <td
              style={{
                fontWeight: 600,

                textAlign: "center",
              }}
              colSpan={3}
            >
              TỔNG
            </td>

            {PHAN_LOAI_KEYS.map((k) => (
              <td
                key={k}
                style={{
                  fontWeight: 600,

                  textAlign: "right",
                }}
              >
                {totals[k]
                  ? totals[k].toLocaleString("en-US", {
                      maximumFractionDigits: 3,
                    })
                  : ""}
              </td>
            ))}

            <td />
          </tr>

          {/* Tổng PLC/EMS - chỉ đọc */}

          <tr>
            <td
              style={{
                fontWeight: 700,

                textAlign: "center",
              }}
              colSpan={3}
            >
              TỔNG CỘNG
            </td>

            <td
              colSpan={4}
              style={{
                fontWeight: 700,

                textAlign: "right",

                fontSize: 16,
              }}
            >
              {tongTuDongPLC !== null
                ? tongTuDongPLC.toLocaleString("en-US", {
                    minimumFractionDigits: 3,

                    maximumFractionDigits: 3,
                  })
                : ""}
            </td>

            <td />
          </tr>
        </>
      );
    },

    [tongTuDongPLC],
  );

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────

  return (
    <Card
      style={{
        margin: 24,
        boxShadow: "0 2px 8px #f0f1f2",
      }}
    >
      <div
        style={{
          textAlign: "center",

          marginBottom: 12,
        }}
      >
        <Typography.Title
          level={3}
          style={{
            marginBottom: 0,
          }}
        >
          {config.title}
        </Typography.Title>

        {idphieu && <b>Số phiếu: {soPhieu}</b>}
      </div>

      <Form form={form} layout="vertical">
        <Form.Item name="idphieu" hidden>
          <Input type="hidden" />
        </Form.Item>

        <Form.Item name="tenScope" hidden>
          <Input type="hidden" />
        </Form.Item>

        <div
          style={{
            display: "grid",

            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",

            gap: 12,
          }}
        >
          {config.headerFields.map((f: any, idx: number) => (
            <CustomFormItem
              key={f.key || idx}
              field={f}
              idx={idx}
              disabled={isFormLocked || !!idphieu }
            />
          ))}
        </div>

        <div
          style={{
            marginTop: 16,

            marginBottom: 16,
          }}
        >
          <Space
            style={{
              justifyContent: "center",

              width: "100%",
            }}
          >
            {!isFormLocked && (
              <Button
                icon={<ReloadOutlined />}
                loading={loadingTongTuDong}
                onClick={handleTaiDuLieu}
              >
                Tải dữ liệu
              </Button>
            )}

            {actionButtons}

            <Button
              icon={<UndoOutlined />}
              onClick={() => navigate("/sanluongtkvv")}
            >
              Quay lại
            </Button>
          </Space>
        </div>

        <div
          style={{
            width: "100%",

            overflowX: "auto",

            marginBottom: 8,
          }}
        >
          <TKVVBBSLTable
            columns={tableColumns}
            initialData={tableData}
            onDataChange={handleTableChange}
            editable={!isFormLocked}
            loading={loading}
            minRows={0}
            showAddButton={false}
            showDeleteButton={!isFormLocked && hasRowsToDelete}
            manualTrackPattern={/^[1-4]$/}
            summary={tableSummary}
            isCellReadonly={(record, dataIndex, rowIndex) => {
              const lastIndex = tableData.length - 1;

              return (
                rowIndex === lastIndex &&
                autoCalculatedRef.current.rowKey === record.key &&
                autoCalculatedRef.current.columnKey === dataIndex
              );
            }}
          />
        </div>

        {tableData.length > 0 && (
          <div
            style={{
              marginBottom: 8,

              fontSize: 12,

              color: "#888",
            }}
          >
            * TỔNG CỘNG được lấy tự động từ dữ liệu PLC/EMS theo Ngày sản xuất +
            Ca + Xưởng. Người dùng không được sửa giá trị này.
          </div>
        )}

        {!isFormLocked && (
          <Button
            onClick={handleAddRow}
            type="dashed"
            style={{
              marginBottom: 24,
            }}
          >
            + Thêm dòng
          </Button>
        )}

        {config.footerNotes?.length > 0 && (
          <div
            style={{
              marginBottom: 16,

              fontSize: 13,

              color: "#666",
            }}
          >
            {config.footerNotes.map((note: string, i: number) => (
              <div key={i}>* {note}</div>
            ))}
          </div>
        )}

        <div
          style={{
            marginTop: 24,

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
                  <div
                    style={{
                      marginTop: 8,
                    }}
                  >
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

export default TaoPhieuBienBanSanLuong;
