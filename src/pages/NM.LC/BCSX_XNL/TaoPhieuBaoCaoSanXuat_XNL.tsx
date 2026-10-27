/* eslint-disable @typescript-eslint/no-explicit-any */
import LC_BCSX_XNL from "../../../utils/BM_config/LC_BCSX_XNL.json";
import { Button, Card, Form, Input, Popconfirm, Typography, message } from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import CustomFormItem from "../../../components/CustomFormItem";
import { PhieuApi } from "../../../services/PhieuApi";
import { usePhieuNavigation } from "../../../hooks/usePhieuNavigation";
import { phieuActionService, type PheDuyetItem } from "../../../services/PhieuActionService";
import { TrangThaiPhieuConst } from "../../../utils/constants/TrangThaiPhieuConstant";
import LcPhieuTabs from "../../../components/LC_BCSX_XNL/LcPhieuTabs";
import { scopeToThanhPham, thanhPhamToScope, EMPTY_LC_PHIEU_TABLES, type LcPhieuTables } from "../../../components/LC_BCSX_XNL/lcTabsConfig";
import { LcCapLieuSiloApi } from "../../../services/LcCapLieuSiloApi";
import { LcPhoiTronApi } from "../../../services/LcPhoiTronApi";
import { LcSiloCocTonApi } from "../../../services/LcSiloCocTonApi";
import { LcXuatCapApi } from "../../../services/LcXuatCapApi";
import { LcTieuHaoApi } from "../../../services/LcTieuHaoApi";
import { LcChatLuongCocApi } from "../../../services/LcChatLuongCocApi";

/**
 * Trang Tạo / thao tác phiếu "Báo cáo sản xuất Xưởng Nguyên liệu" — dùng chung TP1/TP2.
 *
 * Giai đoạn này (UI trước, Backend sau — xem hội thoại, LC_02 mục 3 Giai đoạn B) chỉ vùng
 * "Cấp liệu & Silo" có bảng nhập liệu thật; các vùng khác hiện placeholder "Chưa triển
 * khai" (xem components/LC_BCSX_XNL/lcTabsConfig.ts). Khi API thật (PhieuApi, dùng chung
 * /api/Phieus) sẵn sàng, luồng Lưu/Gửi/Duyệt dưới đây sẽ hoạt động không cần đổi UI.
 */
const TaoPhieuBaoCaoSanXuat_XNL = () => {
  const { idphieu, navigateToDetail, safeGetDetail, redirectToList } = usePhieuNavigation(
    "phieu_bcsx_xnl_id",
    "/baocaosanxuat_xnl"
  );
  const hasExistingPhieu = Boolean(idphieu);
  const config = LC_BCSX_XNL;
  const [form] = Form.useForm();

  const [tables, setTables] = useState<LcPhieuTables>(EMPTY_LC_PHIEU_TABLES);
  const handleTablesChange = useCallback(
    (patch: Partial<LcPhieuTables>) => setTables((prev) => ({ ...prev, ...patch })),
    []
  );
  const [loading, setLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [soPhieu, setSoPhieu] = useState("");
  const [phieuInfo, setPhieuInfo] = useState<{
    tinhTrang?: number;
    nguoiTaoId?: number | null;
    idphongBan?: number | null;
    pheDuyet?: PheDuyetItem[];
    isClone?: boolean;
  }>({});

  const scope = Form.useWatch("scope", form);
  const thanhPham = useMemo(() => scopeToThanhPham(scope), [scope]);
  const ngaySXWatch = Form.useWatch("NgaySX", form);
  const ngaySXStr = useMemo(() => (ngaySXWatch ? ngaySXWatch.format("YYYY-MM-DD") : null), [ngaySXWatch]);
  const caWatch = Form.useWatch("ca", form);

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

  const getUserInfo = useCallback(() => {
    const stored = localStorage.getItem("userinfo");
    return stored ? JSON.parse(stored) : {};
  }, []);

  const initData = useCallback(async () => {
    if (!idphieu) return;
    try {
      setLoading(true);
      const res = await safeGetDetail(() => PhieuApi.getDetail(idphieu));
      if (!res) return;

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

      form.setFieldsValue({
        ...data,
        ...signatureFields,
        idphieu: (res as any)?.idphieu || "",
        NgaySX: data.NgaySX ? dayjs(data.NgaySX, "YYYY-MM-DD") : null,
      });

      setTables({
        capLieu: data.table_capLieu || [],
        coHatNghien1: data.table_coHatNghien1 || [],
        phoiTron: data.table_phoiTron || [],
        pheu: data.table_pheu || [],
        thap: data.table_thap || [],
        phanTich: data.table_phanTich || [],
        suCo: data.table_suCo || [],
        tonCoc: [],
        xuatCapCoc: [],
        tieuHao: [],
        chatLuongCoc: [],
      });

      // Ghi đè bằng giá trị THẬT đã tính ở BE (TonDauKyQuyKho/LuyKeQuyKho/KhoiLuongKhoThucTe,
      // kế thừa từ kíp trước) — bản trong DataJson chỉ là cái FE gửi lên lúc Lưu, không có
      // các cột tính toán này (xem LcCapLieuSiloApi.ts). Không chặn load phiếu nếu lỗi.
      const resIdPhieu = (res as any)?.idphieu;
      if (resIdPhieu) {
        try {
          const authoritative = await LcCapLieuSiloApi.getByPhieu(resIdPhieu);
          setTables((prev) => ({
            ...prev,
            capLieu: authoritative.capLieu,
            coHatNghien1: authoritative.coHatNghien1,
          }));
        } catch (err) {
          console.error("Không thể tải dữ liệu Cấp liệu & Silo (bảng quan hệ):", err);
        }

        try {
          const phoiTronCards = await LcPhoiTronApi.getByPhieu(resIdPhieu);
          setTables((prev) => ({ ...prev, phoiTron: phoiTronCards }));
        } catch (err) {
          console.error("Không thể tải dữ liệu Phối trộn (bảng quan hệ):", err);
        }

        try {
          const tonCocRows = await LcSiloCocTonApi.getByPhieu(resIdPhieu);
          setTables((prev) => ({ ...prev, tonCoc: tonCocRows }));
        } catch (err) {
          console.error("Không thể tải dữ liệu Tồn cốc silo (bảng quan hệ):", err);
        }

        try {
          const xuatCapRows = await LcXuatCapApi.getByPhieu(resIdPhieu);
          setTables((prev) => ({ ...prev, xuatCapCoc: xuatCapRows }));
        } catch (err) {
          console.error("Không thể tải dữ liệu Xuất/Cấp cốc (bảng quan hệ):", err);
        }

        try {
          const tieuHaoScope = Number(data.scope);
          if (tieuHaoScope) {
            const tieuHaoRows = await LcTieuHaoApi.getByPhieu(resIdPhieu, tieuHaoScope);
            setTables((prev) => ({ ...prev, tieuHao: tieuHaoRows }));
          }
        } catch (err) {
          console.error("Không thể tải dữ liệu Tiêu hao (bảng quan hệ):", err);
        }

        try {
          const chatLuongScope = Number(data.scope);
          if (chatLuongScope) {
            const chatLuongRows = await LcChatLuongCocApi.getByPhieu(resIdPhieu, chatLuongScope);
            setTables((prev) => ({ ...prev, chatLuongCoc: chatLuongRows }));
          }
        } catch (err) {
          console.error("Không thể tải dữ liệu Chất lượng cốc (bảng quan hệ):", err);
        }
      }

      setPhieuInfo({
        tinhTrang: (res as any)?.tinhTrang ?? 0,
        nguoiTaoId: (res as any)?.nguoiTaoId ?? null,
        idphongBan: (res as any)?.idphongBan ?? null,
        pheDuyet: (res as any)?.pheDuyet || data.pheDuyet || [],
        isClone: (res as any)?.isClone ?? false,
      });
    } catch (err) {
      console.error("Lỗi khởi tạo dữ liệu phiếu BCSX_XNL:", err);
      message.error("Không thể tải dữ liệu phiếu (backend chưa sẵn sàng?)");
    } finally {
      setLoading(false);
    }
  }, [idphieu, safeGetDetail, form, config.signatures]);

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

    return {
      ...formData,
      NgaySX: formData.NgaySX ? formData.NgaySX.format("YYYY-MM-DD") : null,
      maBm: config.code,
      prefix: config.prefix,
      nguoiTaoId:
        isCreateNew ||
        phieuInfo.tinhTrang === TrangThaiPhieuConst.DaThuHoi ||
        phieuInfo.tinhTrang === TrangThaiPhieuConst.HieuChinh
          ? userInfo.iD_TaiKhoan ?? null
          : phieuInfo.nguoiTaoId ?? null,
      tenScope: thanhPham ?? null,
      xuongId: userInfo.iD_PhanXuong ?? null,
      idphongBan: userInfo.iD_PhongBan ?? null,
      // table_capLieu/table_coHatNghien1/table_phoiTron/table_tonCoc KHÔNG gửi qua DataJson
      // nữa (rủi ro lệch dữ liệu) — lưu trực tiếp vào bảng quan hệ riêng qua
      // LcCapLieuSiloApi.save / LcPhoiTronApi.save / LcSiloCocTonApi.save trong
      // handleActionSuccess bên dưới.
      table_pheu: tables.pheu,
      table_thap: tables.thap,
      table_phanTich: tables.phanTich,
      table_suCo: tables.suCo,
      pheDuyet: pheDuyetFlow,
    };
  }, [getUserInfo, form, config, idphieu, phieuInfo, thanhPham, tables]);

  const handleActionSuccess = useCallback(
    async (context?: { newPhieuId?: string }) => {
      const targetId = context?.newPhieuId || idphieu;
      const isCreatingNew = Boolean(context?.newPhieuId);
      if (targetId) {
        // Lúc mới tạo phiếu, nếu người dùng chưa đụng vào tab nào đó thì state FE của tab
        // đó vẫn đang rỗng (initData chỉ nạp capLieu/phoiTron/tonCoc THẬT từ server khi đã
        // có idphieu — tức là SAU lần tạo này). Gọi save với mảng rỗng sẽ bị SaveTabAsync
        // hiểu là "không còn dòng nào" và xoá sạch dữ liệu mặc định mà Initializer backend
        // vừa copy-forward/khởi tạo lúc tạo phiếu (BE-xxx: LC_BCSX_XNL_TPInitializer). Nên
        // chỉ gọi save cho tab nào người dùng đã thực sự nhập liệu (mảng không rỗng), hoặc
        // khi đây là lần Lưu cập nhật phiếu đã tồn tại (tables lúc đó đã được nạp thật).
        if (!isCreatingNew || tables.capLieu.length > 0 || tables.coHatNghien1.length > 0) {
          try {
            await LcCapLieuSiloApi.save(targetId, {
              capLieu: tables.capLieu,
              coHatNghien1: tables.coHatNghien1,
            });
          } catch (err) {
            console.error("Không thể lưu Cấp liệu & Silo:", err);
            message.error("Đã lưu phiếu nhưng lưu dữ liệu Cấp liệu & Silo thất bại, vui lòng kiểm tra lại.");
          }
        }

        if (!isCreatingNew || tables.phoiTron.length > 0) {
          try {
            await LcPhoiTronApi.save(targetId, tables.phoiTron);
          } catch (err) {
            console.error("Không thể lưu Phối trộn:", err);
            message.error("Đã lưu phiếu nhưng lưu dữ liệu Phối trộn thất bại, vui lòng kiểm tra lại.");
          }
        }

        if (!isCreatingNew || tables.tonCoc.length > 0) {
          try {
            await LcSiloCocTonApi.save(targetId, tables.tonCoc);
          } catch (err) {
            console.error("Không thể lưu Tồn cốc silo:", err);
            message.error("Đã lưu phiếu nhưng lưu dữ liệu Tồn cốc silo thất bại, vui lòng kiểm tra lại.");
          }
        }

        if (!isCreatingNew || tables.xuatCapCoc.length > 0) {
          try {
            await LcXuatCapApi.save(
              targetId,
              tables.xuatCapCoc.map((s) => ({ idDanhMucChiTiet: s.idDanhMucChiTiet, khoiLuongAm: s.khoiLuongAm, doAm: s.doAm, tyKhoi: s.tyKhoi, ghiChu: s.ghiChu }))
            );
          } catch (err) {
            console.error("Không thể lưu Xuất/Cấp cốc:", err);
            message.error("Đã lưu phiếu nhưng lưu dữ liệu Xuất/Cấp cốc thất bại, vui lòng kiểm tra lại.");
          }
        }

        try {
          const tieuHaoScope = thanhPhamToScope(thanhPham);
          if (tieuHaoScope) await LcTieuHaoApi.save(targetId, tieuHaoScope, tables.tieuHao);
        } catch (err) {
          console.error("Không thể lưu Tiêu hao:", err);
          message.error("Đã lưu phiếu nhưng lưu dữ liệu Tiêu hao thất bại, vui lòng kiểm tra lại.");
        }

        try {
          const chatLuongScope = thanhPhamToScope(thanhPham);
          if (chatLuongScope) await LcChatLuongCocApi.save(targetId, chatLuongScope, tables.chatLuongCoc);
        } catch (err: any) {
          console.error("Không thể lưu Chất lượng cốc:", err);
          message.error(
            err?.response?.data?.message ||
              "Đã lưu phiếu nhưng lưu dữ liệu Chất lượng cốc thất bại, vui lòng kiểm tra lại."
          );
        }
      }
      if (context?.newPhieuId) {
        navigateToDetail(context.newPhieuId, "/taophieubaocaosanxuat_xnl");
        return;
      }
      await initData();
    },
    [navigateToDetail, initData, idphieu, tables, thanhPham]
  );

  /**
   * "Làm mới" — tính lại Tồn đầu/Lũy kế của tab Cấp liệu & Silo và tab Phối trộn theo dữ
   * liệu MỚI NHẤT của kíp liền trước (trường hợp kíp trước đã tạo xong rồi mới bị sửa lại).
   * Chỉ tính lại 2 cột dẫn xuất đó — KHÔNG gửi dữ liệu đang nhập ở FE lên, nên các ô khác
   * (KL ẩm thực tế, độ ẩm, tỷ lệ phối...) không bị ảnh hưởng. Vì đọc lại từ DB, các thay đổi
   * CHƯA LƯU ở chính 2 tab này sẽ bị nạp lại theo bản đã lưu gần nhất — đã cảnh báo ở Popconfirm.
   */
  const handleLamMoiTuCaTruoc = useCallback(async () => {
    if (!idphieu) return;
    setRefreshLoading(true);
    try {
      const [capLieuRes, phoiTronRes] = await Promise.all([
        LcCapLieuSiloApi.refreshTuCaTruoc(idphieu),
        LcPhoiTronApi.refreshTuCaTruoc(idphieu),
      ]);
      setTables((prev) => ({
        ...prev,
        capLieu: capLieuRes.capLieu,
        coHatNghien1: capLieuRes.coHatNghien1,
        phoiTron: phoiTronRes,
      }));
      message.success("Đã làm mới Tồn đầu/Lũy kế theo dữ liệu mới nhất của kíp liền trước.");
    } catch (err: any) {
      console.error("Làm mới từ kíp trước thất bại:", err);
      message.error(err?.message || "Không thể làm mới dữ liệu từ kíp trước.");
    } finally {
      setRefreshLoading(false);
    }
  }, [idphieu]);

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
      onError: (error) => {
        console.error("Action error:", error);
        message.error((error as any)?.message ?? "Không thể thực hiện thao tác (backend chưa sẵn sàng?)");
      },
    });

    if (buttons.length === 0) return null;
    return phieuActionService.renderActionButtons(buttons, idphieu || "", getFormData);
  }, [getUserInfo, idphieu, phieuInfo, getFormData, handleActionSuccess, redirectToList]);

  return (
    <Card style={{ margin: 24, boxShadow: "0 2px 8px #f0f1f2" }} loading={loading}>
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
        {config.isoInfo && (
          <div style={{ fontSize: 13, textAlign: "right", lineHeight: "20px" }}>
            <div>
              <b>{config.isoInfo.code}</b>
            </div>
          </div>
        )}
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
            <CustomFormItem key={f.key || idx} field={f} idx={idx} disabled={hasExistingPhieu} />
          ))}
        </div>

        {idphieu && !isFormLocked && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
            <Popconfirm
              title="Làm mới từ kíp liền trước?"
              description="Tồn đầu/Lũy kế của tab Cấp liệu & Silo và Phối trộn sẽ được nạp lại theo dữ liệu kíp trước MỚI NHẤT. Các thay đổi CHƯA LƯU ở 2 tab này sẽ bị mất."
              okText="Làm mới"
              cancelText="Hủy"
              onConfirm={handleLamMoiTuCaTruoc}
            >
              <Button loading={refreshLoading}>Làm mới</Button>
            </Popconfirm>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <LcPhieuTabs
            thanhPham={thanhPham}
            editable={!isFormLocked}
            tables={tables}
            onTablesChange={handleTablesChange}
            idPhieu={idphieu}
            ngaySX={ngaySXStr}
            caPhieu={caWatch}
          />
        </div>

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
            .map((sig, i) => {
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
    </Card>
  );
};

export default TaoPhieuBaoCaoSanXuat_XNL;
