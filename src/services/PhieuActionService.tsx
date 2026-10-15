/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import { Button, Popconfirm, message } from "antd";
import type { ButtonProps } from "antd";
import {
  EditOutlined,
  SendOutlined,
  CheckOutlined,
  CloseOutlined,
  UndoOutlined,
  LockOutlined,
  UnlockOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
} from "@ant-design/icons";
import { PhieuApi } from "./PhieuApi";
import { PheDuyetApi } from "./PheDuyetApi";
import {
  TrangThaiPhieuConst,
  TrangThaiXacNhanPhieuConst,
} from "../utils/constants/TrangThaiPhieuConstant";
import { PhieuActionButtonKeys } from "../utils/constants/PhieuActionButtonKeys";

// Các biên bản LGNL cho phép Xuất Excel ngay khi Đã gửi (trạng thái 1), không cần
// đợi Hoàn thành/Đã chốt như các biên bản khác — theo yêu cầu nghiệp vụ riêng cho
// Nạp liệu lò cao, Tồn silo lò cao, Phun than lò cao.
const MABM_EXPORT_EXCEL_KHI_DA_GUI = [
  "NMLG_BM_NapLieuLoCao",
  "NMLG_BM_TonSiLoLoCao",
  "NMLG_NK_VHPTLC",
];

export interface PhieuActionButton {
  key: string;
  label: string;
  icon?: React.ReactNode;
  type?: ButtonProps["type"];
  danger?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
  confirm?: {
    title: string;
    description?: string;
  };
  // Nếu có: chạy API check trước khi hiện Popconfirm. Return false → block, throw → block + message lỗi tự hiện
  preConfirmCheck?: () => Promise<boolean>;
  onClick: (
    phieuId: string,
    formData?: Record<string, unknown>,
  ) => Promise<void>;
}

export interface PheDuyetItem {
  nguoiDuyetId?: number | null;
  capDuyet?: number | null;
  tinhTrang?: number | null;
  maKyDuyet?: string | null;
}

export interface ActionSuccessContext {
  newPhieuId?: string;
}

export interface PhieuActionServiceParams {
  phieuId: string;
  tinhTrang: number;
  isClone?: boolean;
  formData?: Record<string, unknown>;
  // Cho phép gọi API bổ sung sau khi lưu phiếu (ví dụ lưu sang bảng khác)
  // Được gọi sau khi PhieuApi.postData hoặc PhieuApi.putData thành công
  customPutApi?: (
    idphieu: string,
    formData: Record<string, unknown>,
  ) => Promise<any>;
  // Callback được gọi sau khi thay đổi trạng thái thành công
  // Nhận vào idPhieu và trạng thái mới
  onStatusChange?: (idPhieu: string, newStatus: number) => void | Promise<void>;
  // Thông tin user hiện tại
  currentUserId?: number | null;
  currentUserPhongBanId?: number | null;
  currentUserTenNgan?: string | null;
  // Thông tin phiếu
  nguoiTaoId?: number | null;
  phieuPhongBanId?: number | null;
  phieuMaBm?: string | null;
  pheDuyet?: PheDuyetItem[];
  // Danh sách BM được phép chốt từ BM_QuyenXL (processingForms chứa maBm của phiếu)
  allowedChotBmList?: string[];
  // Luồng 1 người: bỏ qua phê duyệt, "Gửi" sẽ chuyển thẳng sang HoanThanh (2) để PKH chốt
  noApproval?: boolean;
  // API check trước khi chốt (nullable - chỉ truyền ở những chỗ cần). Return false → block, throw → block
  preConfirmCheck?: () => Promise<boolean>;
  // Callbacks
  onSuccess?: (context?: ActionSuccessContext) => void | Promise<void>;
  onError?: (error: unknown) => void;
  redirectToList?: (msg?: string) => void;
}

const STALE_PHIEU_ERROR_MARKERS = [
  "Phiếu đã bị khóa",
  "Phiếu đã bị xóa",
  "Vui lòng quay về danh sách",
];

const extractErrorMessage = (error: unknown): string | undefined => {
  if (!error) return undefined;
  if (typeof error === "string") return error;
  const err = error as any;
  return err?.message || err?.error || err?.response?.data?.message;
};

const resolveListPathFromCurrentUrl = (): string => {
  const pathname = window.location.pathname || "";
  const normalizedPath = pathname.replace(/\/+$/, "");
  const hasSanXuatBase = normalizedPath.startsWith("/sanxuat/");
  const withoutBase = hasSanXuatBase
    ? normalizedPath.slice("/sanxuat".length)
    : normalizedPath;
  const segments = withoutBase.split("/").filter(Boolean);
  if (segments.length === 0) return "/sanxuat";

  const first = segments[0].toLowerCase();
  if (first.startsWith("taophieu") || first.startsWith("chitiet")) {
    const listSegments = segments.slice(1);
    if (listSegments.length > 0) {
      return `/sanxuat/${listSegments.join("/")}`;
    }
  }

  return "/sanxuat";
};

const shouldRedirectToList = (error: unknown): boolean => {
  const messageText = extractErrorMessage(error);
  if (!messageText) return false;
  return STALE_PHIEU_ERROR_MARKERS.some((marker) =>
    messageText.includes(marker),
  );
};

const handleActionError = (
  error: unknown,
  onError?: (error: unknown) => void,
  redirectToList?: (msg?: string) => void,
  fallbackMessage?: string,
) => {
  const errMsg = extractErrorMessage(error);
  const displayMsg = errMsg || fallbackMessage || "Thao tác thất bại";
  message.error(displayMsg);

  if (shouldRedirectToList(error)) {
    if (redirectToList) {
      window.setTimeout(() => redirectToList(displayMsg), 150);
    } else {
      const listPath = resolveListPathFromCurrentUrl();
      window.setTimeout(() => {
        window.location.href = listPath;
      }, 150);
    }
  }

  onError?.(error);
};

// Dùng cho các action chỉ gọi changeStatus (không save/put/post khác):
// nếu lỗi thì xử lý lỗi như cũ + reload lại trang hiện tại.
const handleStatusOnlyActionError = (
  error: unknown,
  onError?: (error: unknown) => void,
  redirectToList?: (msg?: string) => void,
  fallbackMessage?: string,
) => {
  handleActionError(error, onError, redirectToList, fallbackMessage);
  window.setTimeout(() => {
    window.location.reload();
  }, 150);
};

/**
 * Helper functions để kiểm tra quyền
 */
const checkPermission = {
  /**
   * Kiểm tra user có phải người tạo phiếu không
   */
  isCreatorZero: (
    currentUserId?: number | null,
    nguoiDuyet0Id?: number | null,
  ): boolean => {
    return (
      currentUserId !== undefined &&
      currentUserId !== null &&
      nguoiDuyet0Id !== undefined &&
      nguoiDuyet0Id !== null &&
      currentUserId === nguoiDuyet0Id
    );
  },

  /**
   * Kiểm tra user có trong danh sách được assign không
   */
  isAssignedUser: (
    currentUserId?: number | null,
    pheDuyet?: PheDuyetItem[],
  ): boolean => {
    if (!currentUserId || !pheDuyet || pheDuyet.length === 0) return false;
    return pheDuyet.some(
      (item) =>
        item.nguoiDuyetId === currentUserId &&
        item.capDuyet !== 0 &&
        item.tinhTrang === TrangThaiXacNhanPhieuConst.ChuaXacNhan,
    );
  },

  /**
   * Kiểm tra user có cùng phòng ban với phiếu không
   */
  isSamePhongBan: (
    currentUserPhongBanId?: number | null,
    phieuPhongBanId?: number | null,
  ): boolean => {
    return (
      currentUserPhongBanId !== undefined &&
      currentUserPhongBanId !== null &&
      phieuPhongBanId !== undefined &&
      phieuPhongBanId !== null &&
      currentUserPhongBanId === phieuPhongBanId
    );
  },

  /**
   * Kiểm tra user có phải phòng ban PKH không (iD_PhongBan = 70 và tenNgan = "P.KH")
   */
  isPKHPhongBan: (
    currentUserPhongBanId?: number | null,
    currentUserTenNgan?: string | null,
  ): boolean => {
    return currentUserPhongBanId === 70 || currentUserTenNgan === "P.KH";
  },

  /**
   * Kiểm tra user có quyền chốt phiếu cho BM cụ thể (từ BM_QuyenXL)
   * allowedChotBmList phải chứa maBm của phiếu
   */
  canChotByBmPermission: (
    phieuMaBm?: string | null,
    allowedChotBmList?: string[],
  ): boolean => {
    if (!phieuMaBm || !allowedChotBmList || allowedChotBmList.length === 0) {
      return false;
    }
    return allowedChotBmList.includes(phieuMaBm);
  },

  /**
   * Kiểm tra user có quyền chốt phiếu (PKH hoặc có quyền từ BM_QuyenXL)
   */
  canChotPhieu: (
    currentUserPhongBanId?: number | null,
    currentUserTenNgan?: string | null,
    phieuMaBm?: string | null,
    allowedChotBmList?: string[],
  ): boolean => {
    // PKH luôn được chốt
    if (
      checkPermission.isPKHPhongBan(currentUserPhongBanId, currentUserTenNgan)
    ) {
      return true;
    }
    // Hoặc có quyền chốt cho BM của phiếu
    return checkPermission.canChotByBmPermission(phieuMaBm, allowedChotBmList);
  },

  /**
   * Kiểm tra user có quyền duyệt (chỉ assigned user, không cần cùng phòng ban)
   */
  canApprove: (
    currentUserId?: number | null,
    pheDuyet?: PheDuyetItem[],
  ): boolean => {
    return checkPermission.isAssignedUser(currentUserId, pheDuyet);
  },
};

/**
 * Component nội bộ: Popconfirm có bước check API trước khi mở.
 * Click button → chạy preConfirmCheck() → nếu pass mới hiện Popconfirm.
 */
const PreCheckPopconfirmButton: React.FC<{
  btn: PhieuActionButton;
  phieuId: string;
  getFormData?: (
    actionKey?: string,
  ) => Record<string, unknown> | Promise<Record<string, unknown>>;
}> = ({ btn, phieuId, getFormData }) => {
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleButtonClick = async () => {
    if (!btn.preConfirmCheck) {
      setOpen(true);
      return;
    }
    setChecking(true);
    try {
      const canProceed = await btn.preConfirmCheck();
      if (canProceed) setOpen(true);
    } catch {
      // lỗi đã được xử lý bên trong preConfirmCheck (message.error)
    } finally {
      setChecking(false);
    }
  };

  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    // Chặn double-submit: Popconfirm.onConfirm có thể bị gọi lại trước khi request trước hoàn tất
    // (vd double-click nhanh) — nếu không chặn, mỗi lần gọi đều gửi 1 request lưu riêng, và với
    // các dòng dữ liệu mới (chưa có id) thì mỗi request đều bị BE insert thành 1 record riêng
    // biệt thay vì update, gây sinh nhiều dòng trùng nhau.
    if (submitting) return;
    setOpen(false);
    setSubmitting(true);
    try {
      const formData = getFormData ? await getFormData(btn.key) : undefined;
      await btn.onClick(phieuId, formData);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Popconfirm
      title={btn.confirm!.title}
      description={btn.confirm!.description}
      open={open}
      onConfirm={handleConfirm}
      onCancel={() => setOpen(false)}
      okText="Xác nhận"
      cancelText="Hủy"
      okButtonProps={{ danger: btn.danger, loading: submitting }}
    >
      <Button
        type={btn.type}
        danger={btn.danger}
        icon={btn.icon}
        disabled={btn.disabled || submitting}
        loading={checking || submitting}
        htmlType="button"
        onClick={handleButtonClick}
      >
        {btn.label}
      </Button>
    </Popconfirm>
  );
};

/**
 * Button hành động đơn giản (không có preConfirmCheck, không cần Popconfirm).
 * Tự khóa (disabled + loading) trong lúc onClick đang chạy để chặn double-submit.
 */
const SimpleActionButton: React.FC<{
  btn: PhieuActionButton;
  phieuId: string;
  getFormData?: (
    actionKey?: string,
  ) => Record<string, unknown> | Promise<Record<string, unknown>>;
}> = ({ btn, phieuId, getFormData }) => {
  const [submitting, setSubmitting] = useState(false);

  const handleClick = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const formData = getFormData ? await getFormData(btn.key) : undefined;
      await btn.onClick(phieuId, formData);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Button
      type={btn.type}
      danger={btn.danger}
      icon={btn.icon}
      disabled={btn.disabled || submitting}
      loading={submitting}
      style={btn.style}
      htmlType="button"
      onClick={handleClick}
    >
      {btn.label}
    </Button>
  );
};

/**
 * Button hành động có Popconfirm nhưng không có preConfirmCheck.
 * Tự khóa (disabled + loading) trong lúc onClick đang chạy để chặn double-submit.
 */
const SimpleConfirmActionButton: React.FC<{
  btn: PhieuActionButton;
  phieuId: string;
  getFormData?: (
    actionKey?: string,
  ) => Record<string, unknown> | Promise<Record<string, unknown>>;
}> = ({ btn, phieuId, getFormData }) => {
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const formData = getFormData ? await getFormData(btn.key) : undefined;
      await btn.onClick(phieuId, formData);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Popconfirm
      title={btn.confirm!.title}
      description={btn.confirm!.description}
      onConfirm={handleConfirm}
      okText="Xác nhận"
      cancelText="Hủy"
      okButtonProps={{ danger: btn.danger, loading: submitting }}
    >
      <Button
        type={btn.type}
        danger={btn.danger}
        icon={btn.icon}
        disabled={btn.disabled || submitting}
        loading={submitting}
        style={btn.style}
        htmlType="button"
      >
        {btn.label}
      </Button>
    </Popconfirm>
  );
};

/**
 * Service quản lý các action buttons cho phiếu dựa trên trạng thái, isClone và quyền của user
 *
 * Logic kiểm tra quyền theo trạng thái:
 *
 * Trạng thái 0 (Đang lưu):
 * - Chỉ nguoiTaoId thấy: Sửa, Xóa, Gửi
 * - Người trong pheDuyet không thấy button gì
 *
 * Trạng thái 1 (Đã gửi):
 * - NguoiTaoId thấy: Thu hồi (sửa trực tiếp trên phiếu), Lưu, Gửi khi đã thu hồi
 * - Người trong pheDuyet thấy: Xác nhận, Từ chối
 *
 * Trạng thái 2 (Hoàn thành) / 6 (Đang phê duyệt):
 * - NguoiTaoId thấy: Đề nghị hiệu chỉnh (clone phiếu, gán phiếu gốc = Hiệu chỉnh 7, redirect sang phiếu clone)
 * - P.KH hoặc user có quyền chốt cho BM của phiếu thấy: Chốt (khi Hoàn thành)
 *
 * Trạng thái 5 (Đã chốt):
 * - NguoiTaoId không thấy: Sửa, Gửi
 * - P.KH hoặc user có quyền chốt thấy: Hủy chốt
 *
 * Clone: Tất cả (không cần kiểm tra quyền)
 *
 * @example
 * const userInfo = JSON.parse(localStorage.getItem("userinfo") || "{}");
 * const phieuData = await PhieuApi.getById(phieuId);
 * // Lấy danh sách BM được phép chốt (nếu user không phải PKH)
 * const permissions = await BmQuyenXlApi.getMenuPermissions(userInfo.iD_TaiKhoan);
 * const buttons = phieuActionService.getActionButtons({
 *   phieuId: phieuData.idphieu,
 *   tinhTrang: phieuData.tinhTrang,
 *   currentUserId: userInfo.iD_TaiKhoan,
 *   currentUserPhongBanId: userInfo.iD_PhongBan,
 *   currentUserTenNgan: userInfo.tenNgan,
 *   nguoiTaoId: phieuData.nguoiTaoId,
 *   phieuPhongBanId: phieuData.idphongBan,
 *   phieuMaBm: phieuData.maBm,
 *   pheDuyet: phieuData.pheDuyet,
 *   allowedChotBmList: permissions.processingForms, // Danh sách BM được phép xử lý (chốt)
 * });
 */
export const phieuActionService = {
  /**
   * Lấy danh sách các action buttons có thể hiển thị
   *
   * Logic kiểm tra quyền theo trạng thái:
   * - Trạng thái 0: Chỉ nguoiTaoId thấy Sửa/Xóa/Gửi
   * - Trạng thái 1: NguoiTaoId thấy Sửa/Gửi, người trong pheDuyet thấy Xác nhận/Từ chối
   * - Trạng thái 2: NguoiTaoId thấy Sửa/Gửi, cả phòng ban thấy Chốt
   * - Trạng thái 5: NguoiTaoId không thấy Sửa/Gửi
   */
  getActionButtons(params: PhieuActionServiceParams): PhieuActionButton[] {
    const {
      phieuId,
      tinhTrang,
      isClone,
      customPutApi,
      onStatusChange,
      currentUserId,
      currentUserPhongBanId,
      currentUserTenNgan,
      phieuMaBm,
      pheDuyet,
      allowedChotBmList,
      noApproval = false,
      preConfirmCheck,
      onSuccess,
      onError,
      redirectToList,
    } = params;
    const buttons: PhieuActionButton[] = [];
    const isAssigned = checkPermission.isAssignedUser(currentUserId, pheDuyet);
    const isPKH = checkPermission.isPKHPhongBan(
      currentUserPhongBanId,
      currentUserTenNgan,
    );
    const canChot = checkPermission.canChotPhieu(
      currentUserPhongBanId,
      currentUserTenNgan,
      phieuMaBm,
      allowedChotBmList,
    );
    const nguoiDuyet0Id = pheDuyet?.filter((x) => x.capDuyet === 0)?.[0]
      ?.nguoiDuyetId;
    const isCreatorZero = checkPermission.isCreatorZero(
      currentUserId,
      nguoiDuyet0Id,
    );
    const hasPhieuId = phieuId !== "";
    // noApproval: "Gửi" đi thẳng HoanThanh (2), PKH chốt luôn mà không cần bước phê duyệt
    const sendTargetStatus = noApproval
      ? TrangThaiPhieuConst.HoanThanh
      : TrangThaiPhieuConst.DaGui;
    const sendLabel = noApproval ? "Lưu và Gửi PKH" : "Lưu và Gửi phiếu";
    const sendConfirmDesc = noApproval
      ? "Phiếu sẽ được gửi thẳng đến PKH để chốt. Bạn có chắc chắn?"
      : "Bạn có chắc chắn muốn lưu và gửi phiếu này?";

    // Quy tắc cho PKH hoặc user có quyền chốt: chỉ thấy Chốt/Hủy chốt ở trạng thái phù hợp
    if (isPKH || canChot) {
      if (tinhTrang === TrangThaiPhieuConst.HoanThanh) {
        buttons.push({
          key: PhieuActionButtonKeys.Lock,
          label: "Chốt",
          icon: <LockOutlined />,
          type: "primary",
          confirm: {
            title: "Xác nhận chốt",
            description:
              "Bạn có chắc chắn muốn chốt phiếu này? Sau khi chốt, phiếu sẽ không thể chỉnh sửa.",
          },
          preConfirmCheck,
          onClick: async () => {
            try {
              await PhieuApi.changeStatus(
                phieuId,
                TrangThaiPhieuConst.DaChot,
                currentUserId ?? null,
              );
              message.success("Chốt phiếu thành công!");
              await onStatusChange?.(phieuId, TrangThaiPhieuConst.DaChot);
              onSuccess?.();
            } catch (error) {
              handleStatusOnlyActionError(
                error,
                onError,
                redirectToList,
                "Không thể chốt phiếu",
              );
            }
          },
        });
      } else if (tinhTrang === TrangThaiPhieuConst.DaChot) {
        buttons.push({
          key: PhieuActionButtonKeys.Unlock,
          label: "Hủy Chốt",
          icon: <UnlockOutlined />,
          type: "default",
          confirm: {
            title: "Xác nhận hủy chốt",
            description: "Bạn có chắc chắn muốn hủy chốt phiếu này?",
          },
          onClick: async () => {
            try {
              await PhieuApi.changeStatus(
                phieuId,
                TrangThaiPhieuConst.HoanThanh,
                currentUserId ?? null,
              );
              message.success("Hủy chốt phiếu thành công!");
              await onStatusChange?.(phieuId, TrangThaiPhieuConst.HoanThanh);
              onSuccess?.();
            } catch (error) {
              handleStatusOnlyActionError(
                error,
                onError,
                redirectToList,
                "Không thể hủy chốt phiếu",
              );
            }
          },
        });
      }
      // return buttons;
    }

    // ========== BUTTONS KHI CHƯA CÓ PHIEU ID (TẠO MỚI) ==========
    if (!hasPhieuId) {
      // Button Lưu
      buttons.push({
        key: PhieuActionButtonKeys.Save,
        label: "Tạo mới",
        icon: <EditOutlined />,
        type: "default",
        onClick: async (_phieuIdParam, formDataParam) => {
          try {
            if (!formDataParam) {
              message.error("Không có dữ liệu để lưu");
              return;
            }

            // Chưa có idphieu, tạo mới (luôn gọi PhieuApi, thêm customPutApi nếu truyền)
            const res = await PhieuApi.postData(formDataParam);
            const resData = res as { idphieu?: string; soPhieu?: string } | undefined;
            message.success(`Tạo phiếu thành công: ${resData?.soPhieu || ""}`);
            onSuccess?.(resData?.idphieu ? { newPhieuId: String(resData.idphieu) } : undefined);
          } catch (error) {
            handleActionError(
              error,
              onError,
              redirectToList,
              "Không thể tạo phiếu",
            );
          }
        },
      });

      // Button Lưu và Gửi
      buttons.push({
        key: PhieuActionButtonKeys.SaveAndSend,
        label: sendLabel,
        icon: <SendOutlined />,
        type: "primary",
        confirm: {
          title: "Xác nhận",
          description: sendConfirmDesc,
        },
        onClick: async (_phieuIdParam, formDataParam) => {
          try {
            if (!formDataParam) {
              message.error("Không có dữ liệu để lưu");
              return;
            }
            const res = await PhieuApi.postData(formDataParam);
            const resData = res as
              | { idphieu?: string; soPhieu?: string }
              | undefined;
            if (resData?.idphieu) {
              await PhieuApi.changeStatus(
                resData.idphieu,
                sendTargetStatus,
                currentUserId ?? null,
              );
              await onStatusChange?.(resData.idphieu, sendTargetStatus);
            }
            message.success(
              `Tạo và gửi phiếu thành công: ${resData?.soPhieu || ""}`,
            );
            onSuccess?.(resData?.idphieu ? { newPhieuId: String(resData.idphieu) } : undefined);
          } catch (error) {
            handleActionError(
              error,
              onError,
              redirectToList,
              "Không thể tạo và gửi phiếu",
            );
          }
        },
      });

      return buttons; // Trả về ngay khi chưa có phieuId
    }

    // ========== BUTTONS CHO NGUOI TAO ID ==========
    // if (isCreatorZero) {
    // Trạng thái 0 - Đang lưu: Xóa, Lưu, Lưu và Gửi
    if (tinhTrang === TrangThaiPhieuConst.DangLuu) {
      // Button Lưu
      buttons.push({
        key: PhieuActionButtonKeys.Save,
        label: "Lưu",
        icon: <EditOutlined />,
        type: "default",
        onClick: async (phieuIdParam, formDataParam) => {
          try {
            if (!formDataParam) {
              message.error("Không có dữ liệu để lưu");
              return;
            }
            // Đã có idphieu, cập nhật (luôn gọi PhieuApi, thêm customPutApi nếu truyền)
            const response = await PhieuApi.putData(
              phieuIdParam,
              formDataParam,
            );
            if (
              response &&
              (response as any).warnings &&
              (response as any).warnings.length > 0
            ) {
              message.warning((response as any).warnings.join(", ")); // Hiển thị cảnh báo nếu có
            }

            if (customPutApi) {
              await customPutApi(
                phieuIdParam,
                formDataParam as Record<string, unknown>,
              );
            }
            message.success("Lưu phiếu thành công!");
            onSuccess?.();
          } catch (error) {
            handleActionError(
              error,
              onError,
              redirectToList,
              "Không thể lưu phiếu",
            );
          }
        },
      });

      // Button Lưu và Gửi
      buttons.push({
        key: PhieuActionButtonKeys.SaveAndSend,
        label: sendLabel,
        icon: <SendOutlined />,
        type: "primary",
        confirm: {
          title: "Xác nhận",
          description: sendConfirmDesc,
        },
        onClick: async (phieuIdParam, formDataParam) => {
          try {
            if (!formDataParam) {
              message.error("Không có dữ liệu để lưu");
              return;
            }
            await PhieuApi.putData(phieuIdParam, formDataParam);
            if (customPutApi) {
              await customPutApi(
                phieuIdParam,
                formDataParam as Record<string, unknown>,
              );
            }
            await PhieuApi.changeStatus(
              phieuIdParam,
              sendTargetStatus,
              currentUserId ?? null,
            );
            await onStatusChange?.(phieuIdParam, sendTargetStatus);
            message.success("Lưu và gửi phiếu thành công!");
            onSuccess?.();
          } catch (error) {
            handleActionError(
              error,
              onError,
              redirectToList,
              "Phiếu đã được gửi, vui lòng kiểm tra lại",
            );
          }
        },
      });
    }
    // Trạng thái 1 - Đã gửi: Thu hồi (sửa trực tiếp trên phiếu đó)
    if (tinhTrang === TrangThaiPhieuConst.DaGui && isCreatorZero) {
      buttons.push({
        key: PhieuActionButtonKeys.Recall,
        label: "Thu hồi",
        icon: <UndoOutlined />,
        type: "default",
        confirm: {
          title: "Xác nhận thu hồi",
          description:
            "Bạn có chắc chắn muốn thu hồi phiếu này? Sau khi thu hồi có thể chỉnh sửa trực tiếp trên phiếu.",
        },
        onClick: async () => {
          try {
            await PhieuApi.changeStatus(
              phieuId,
              TrangThaiPhieuConst.DaThuHoi,
              currentUserId ?? null,
            );
            await onStatusChange?.(phieuId, TrangThaiPhieuConst.DaThuHoi);
            message.success("Thu hồi phiếu thành công!");
            onSuccess?.();
          } catch (error) {
            handleStatusOnlyActionError(
              error,
              onError,
              redirectToList,
              "Không thể thu hồi phiếu",
            );
          }
        },
      });
    }

    // noApproval + HoanThanh: chỉ cần Thu hồi đơn giản về DangLuu để sửa lại (không clone)
    if (
      noApproval &&
      tinhTrang === TrangThaiPhieuConst.HoanThanh &&
      isCreatorZero
    ) {
      buttons.push({
        key: PhieuActionButtonKeys.Recall,
        label: "Thu hồi",
        icon: <UndoOutlined />,
        type: "default",
        confirm: {
          title: "Xác nhận thu hồi",
          description:
            "Thu hồi phiếu về trạng thái đang lưu để chỉnh sửa. Bạn có chắc chắn?",
        },
        onClick: async () => {
          try {
            await PhieuApi.changeStatus(
              phieuId,
              TrangThaiPhieuConst.DangLuu,
              currentUserId ?? null,
            );
            await onStatusChange?.(phieuId, TrangThaiPhieuConst.DangLuu);
            message.success("Thu hồi phiếu thành công!");
            onSuccess?.();
          } catch (error) {
            handleStatusOnlyActionError(
              error,
              onError,
              redirectToList,
              "Không thể thu hồi phiếu",
            );
          }
        },
      });
    }

    // Trạng thái 6 - Đang phê duyệt hoặc 2 - Hoàn thành: Đề nghị hiệu chỉnh (cho cả phiếu clone nếu cần)
    if (
      !noApproval &&
      (tinhTrang === TrangThaiPhieuConst.DangPheDuyet ||
        tinhTrang === TrangThaiPhieuConst.HoanThanh) &&
      isCreatorZero
    ) {
      buttons.push({
        key: PhieuActionButtonKeys.RequestEdit,
        label: "Đề nghị hiệu chỉnh",
        icon: <EditOutlined />,
        type: "default",
        confirm: {
          title: "Xác nhận đề nghị hiệu chỉnh",
          description:
            "Sẽ tạo bản sao phiếu để chỉnh sửa. Phiếu hiện tại sẽ bị ẩn (khóa). Bạn có chắc chắn?",
        },
        onClick: async (_phieuIdParam, formDataParam) => {
          try {
            if (!formDataParam) {
              message.error(
                "Không có dữ liệu form. Vui lòng tải lại trang và thử lại.",
              );
              onError?.(new Error("Missing formData for clone"));
              return;
            }
            const res = await PhieuApi.clone(phieuId, formDataParam);
            const newPhieuId =
              (res as any)?.idphieu ??
              (res as any)?.data?.idphieu ??
              (res as any)?.IdPhieu;
            if (!newPhieuId) {
              message.error(
                "Tạo phiếu hiệu chỉnh thất bại: không nhận được ID phiếu mới.",
              );
              onError?.(new Error("Clone response missing idphieu"));
              return;
            }
            if (customPutApi) {
              await customPutApi(
                newPhieuId,
                formDataParam as Record<string, unknown>,
              );
            }
            message.success(
              "Đề nghị hiệu chỉnh thành công! Đang chuyển sang phiếu mới.",
            );
            onSuccess?.({ newPhieuId: String(newPhieuId) });
          } catch (error) {
            handleActionError(
              error,
              onError,
              redirectToList,
              "Không thể đề nghị hiệu chỉnh.",
            );
          }
        },
      });
    }

    // Trạng thái 7 - Hiệu chỉnh (phiếu clone): Lưu không đổi trạng thái, Lưu và Gửi thì đi luồng bình thường
    if (tinhTrang === TrangThaiPhieuConst.HieuChinh) {
      buttons.push({
        key: PhieuActionButtonKeys.Save,
        label: "Lưu",
        icon: <EditOutlined />,
        type: "default",
        onClick: async (phieuIdParam, formDataParam) => {
          try {
            if (!formDataParam) {
              message.error("Không có dữ liệu để lưu");
              return;
            }
            await PhieuApi.putData(phieuIdParam, formDataParam);
            if (customPutApi) {
              await customPutApi(
                phieuIdParam,
                formDataParam as Record<string, unknown>,
              );
            }
            message.success("Lưu phiếu thành công!");
            onSuccess?.();
          } catch (error) {
            handleActionError(
              error,
              onError,
              redirectToList,
              "Không thể lưu phiếu",
            );
          }
        },
      });
      buttons.push({
        key: PhieuActionButtonKeys.SaveAndSend,
        label: sendLabel,
        icon: <SendOutlined />,
        type: "primary",
        confirm: {
          title: "Xác nhận",
          description: sendConfirmDesc,
        },
        onClick: async (phieuIdParam, formDataParam) => {
          try {
            if (!formDataParam) {
              message.error("Không có dữ liệu để lưu");
              return;
            }
            await PhieuApi.putData(phieuIdParam, formDataParam);
            if (customPutApi) {
              await customPutApi(
                phieuIdParam,
                formDataParam as Record<string, unknown>,
              );
            }
            await PhieuApi.changeStatus(
              phieuIdParam,
              sendTargetStatus,
              currentUserId ?? null,
            );
            await onStatusChange?.(phieuIdParam, sendTargetStatus);
            message.success("Lưu và gửi phiếu thành công!");
            onSuccess?.();
          } catch (error) {
            handleActionError(
              error,
              onError,
              redirectToList,
              "Phiếu đã được gửi, vui lòng kiểm tra lại",
            );
          }
        },
      });
    }

    // Trạng thái 3 - Đã thu hồi: Lưu, Lưu và Gửi (sửa trực tiếp, không clone)
    if (tinhTrang === TrangThaiPhieuConst.DaThuHoi) {
      // Button Lưu (sửa trực tiếp, không clone)
      buttons.push({
        key: PhieuActionButtonKeys.Save,
        label: "Lưu",
        icon: <EditOutlined />,
        type: "default",
        onClick: async (phieuIdParam, formDataParam) => {
          try {
            if (!formDataParam) {
              message.error("Không có dữ liệu để lưu");
              return;
            }
            // Đã có idphieu, cập nhật trực tiếp (không clone)
            await PhieuApi.putData(phieuIdParam, formDataParam);
            if (customPutApi) {
              await customPutApi(
                phieuIdParam,
                formDataParam as Record<string, unknown>,
              );
            }
            message.success("Lưu phiếu thành công!");
            onSuccess?.();
          } catch (error) {
            handleActionError(
              error,
              onError,
              redirectToList,
              "Không thể lưu phiếu",
            );
          }
        },
      });

      // Button Lưu và Gửi (sửa trực tiếp, không clone)
      buttons.push({
        key: PhieuActionButtonKeys.SaveAndSend,
        label: sendLabel,
        icon: <SendOutlined />,
        type: "primary",
        confirm: {
          title: "Xác nhận",
          description: sendConfirmDesc,
        },
        onClick: async (phieuIdParam, formDataParam) => {
          try {
            if (!formDataParam) {
              message.error("Không có dữ liệu để lưu");
              return;
            }
            await PhieuApi.putData(phieuIdParam, formDataParam);
            if (customPutApi) {
              await customPutApi(
                phieuIdParam,
                formDataParam as Record<string, unknown>,
              );
            }
            await PhieuApi.changeStatus(
              phieuIdParam,
              sendTargetStatus,
              currentUserId ?? null,
            );
            await onStatusChange?.(phieuIdParam, sendTargetStatus);
            message.success("Lưu và gửi phiếu thành công!");
            onSuccess?.();
          } catch (error) {
            handleActionError(
              error,
              onError,
              redirectToList,
              "Phiếu đã được gửi, vui lòng kiểm tra lại",
            );
          }
        },
      });
    }

    // Trạng thái 5 - Đã chốt: Không hiện button nào
    // }

    // ========== NÚT XUẤT PDF Phiếu (cho tất cả mọi người khi phiếu ở trạng thái Hoàn thành hoặc Đã chốt) ==========
    if (
      tinhTrang === TrangThaiPhieuConst.HoanThanh ||
      tinhTrang === TrangThaiPhieuConst.DaChot
    ) {
      buttons.push({
        key: PhieuActionButtonKeys.ExportPdf,
        label: "Xuất PDF",
        icon: <FilePdfOutlined />,
        type: "default",
        onClick: async (phieuIdParam) => {
          try {
            // Gọi API Phiếu để lấy maBM trước, sau đó gọi API export với maBM để xuất đúng template (nếu có)
            const phieuData = await PhieuApi.getDetail(phieuIdParam);
            const response = await PhieuApi.exportDynamicPDF(phieuIdParam, {});
            const blob = new Blob([response as any], {
              type: "application/pdf",
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download =
              `${(phieuData as any).soPhieu}_${new Date().toISOString().slice(0, 10)}.pdf` ||
              `Phieu_${phieuIdParam}_${new Date().toISOString().slice(0, 10)}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            message.success("Xuất PDF thành công!");
          } catch (error) {
            message.error((error as any)?.message ?? "Xuất PDF thất bại!");
            onError?.(error);
          }
        },
      });
    }

    // ========== NÚT XUẤT EXCEL Phiếu ==========
    // Mặc định: chỉ Hoàn thành / Đã chốt (như Xuất PDF).
    // Riêng 3 biên bản LGNL (Nạp liệu, Tồn silo, Phun than lò cao): cho xuất thêm ở
    // trạng thái Đã gửi, theo yêu cầu nghiệp vụ riêng của nhóm biên bản này.
    const choXuatExcelKhiDaGui =
      tinhTrang === TrangThaiPhieuConst.DaGui &&
      !!phieuMaBm &&
      MABM_EXPORT_EXCEL_KHI_DA_GUI.includes(phieuMaBm);
    if (
      tinhTrang === TrangThaiPhieuConst.HoanThanh ||
      tinhTrang === TrangThaiPhieuConst.DaChot ||
      choXuatExcelKhiDaGui
    ) {
      buttons.push({
        key: PhieuActionButtonKeys.ExportExcel,
        label: "Xuất Excel",
        icon: <FileExcelOutlined />,
        type: "default",
        style: {
          // color: "#52c41a",
          backgroundColor: "#64c503",
          // borderColor: "#b7eb8f",
        },
        onClick: async (phieuIdParam) => {
          try {
            const response =
              await PhieuApi.exportDynamicExcelPhieu(phieuIdParam);
            // Gọi API Phiếu để lấy maBM trước, sau đó gọi API export với maBM để xuất đúng template (nếu có)
            const phieuData = await PhieuApi.getDetail(phieuIdParam);
            const blob = new Blob([response as any], {
              type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download =
              `${(phieuData as any).soPhieu}_${new Date().toISOString().slice(0, 10)}.xlsx` ||
              `Phieu_${phieuIdParam}_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            message.success("Xuất Excel thành công!");
          } catch (error) {
            message.error((error as any)?.message ?? "Xuất Excel thất bại!");
            onError?.(error);
          }
        },
      });
    }

    // ========== BUTTONS CHO CẤP PHÊ DUYỆT (trừ cấp 0): Xác nhận luôn; Không xác nhận chỉ khi phiếu là clone ==========
    const canApprovePhieu =
      (tinhTrang === TrangThaiPhieuConst.DaGui ||
        tinhTrang === TrangThaiPhieuConst.DangPheDuyet) &&
      isAssigned;

    if (canApprovePhieu) {
      buttons.push({
        key: PhieuActionButtonKeys.Approve,
        label: "Xác nhận",
        icon: <CheckOutlined />,
        type: "primary",
        confirm: {
          title: "Xác nhận phiếu",
          description: "Bạn có chắc chắn muốn xác nhận phiếu này?",
        },
        onClick: async () => {
          try {
            if (!currentUserId) {
              message.error("Không tìm thấy thông tin người dùng");
              return;
            }
            await PheDuyetApi.updateTinhTrang(
              phieuId,
              currentUserId,
              TrangThaiXacNhanPhieuConst.DaXacNhan,
            );
            message.success("Xác nhận phiếu thành công!");
            onSuccess?.();
          } catch (error) {
            handleActionError(
              error,
              onError,
              redirectToList,
              "Không thể xác nhận phiếu",
            );
          }
        },
      });
      // Chỉ phiếu clone mới hiện nút Không xác nhận (xóa clone và lôi phiếu gốc lên)
      if (isClone) {
        buttons.push({
          key: PhieuActionButtonKeys.Reject,
          label: "Không xác nhận",
          icon: <CloseOutlined />,
          type: "default",
          danger: true,
          confirm: {
            title: "Xác nhận không xác nhận",
            description:
              "Bạn có chắc chắn muốn từ chối phiếu này? Phiếu hiệu chỉnh sẽ bị xóa và phiếu gốc sẽ được hiển thị lại.",
          },
          onClick: async () => {
            try {
              if (!currentUserId) {
                message.error("Không tìm thấy thông tin người dùng");
                return;
              }
              await PheDuyetApi.updateTinhTrang(
                phieuId,
                currentUserId,
                TrangThaiXacNhanPhieuConst.KhongXacNhan,
              );
              message.success("Từ chối phiếu thành công!");
              onSuccess?.();
            } catch (error) {
              handleActionError(
                error,
                onError,
                redirectToList,
                "Không thể từ chối phiếu",
              );
            }
          },
        });
      }
    }

    return buttons;
  },

  /**
   * Render các action buttons dưới dạng React components
   * @param getFormData - Function để lấy formData mới nhất (được gọi mỗi khi click button, nhận actionKey để phân biệt loại action)
   */
  renderActionButtons(
    buttons: PhieuActionButton[],
    phieuId: string,
    getFormData?: (
      actionKey?: string,
    ) => Record<string, unknown> | Promise<Record<string, unknown>>,
  ): React.ReactNode[] {
    return buttons.map((btn) => {
      if (btn.confirm) {
        // Nếu có preConfirmCheck: dùng controlled Popconfirm, check API trước khi mở
        if (btn.preConfirmCheck) {
          return (
            <PreCheckPopconfirmButton
              key={btn.key}
              btn={btn}
              phieuId={phieuId}
              getFormData={getFormData}
            />
          );
        }

        return (
          <SimpleConfirmActionButton
            key={btn.key}
            btn={btn}
            phieuId={phieuId}
            getFormData={getFormData}
          />
        );
      }

      return (
        <SimpleActionButton
          key={btn.key}
          btn={btn}
          phieuId={phieuId}
          getFormData={getFormData}
        />
      );
    });
  },
};
