/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, Col, Descriptions, Row, Typography, message } from "antd";
import dayjs from "dayjs";
import LC_BCSX_XNL from "../../../utils/BM_config/LC_BCSX_XNL.json";
import { usePhieuNavigation } from "../../../hooks/usePhieuNavigation";
import { PhieuApi } from "../../../services/PhieuApi";
import { phieuActionService } from "../../../services/PhieuActionService";
import { DETAIL_HIDDEN_BUTTON_KEYS } from "../../../utils/constants/PhieuActionButtonKeys";
import { getBmQuyenUiFlags } from "../../../utils/helpers/checkAdminRole";
import LcPhieuTabs from "../../../components/LC_BCSX_XNL/LcPhieuTabs";
import { scopeToThanhPham, EMPTY_LC_PHIEU_TABLES, type LcPhieuTables } from "../../../components/LC_BCSX_XNL/lcTabsConfig";

const { Title, Text } = Typography;

/**
 * Trang Chi tiết phiếu "Báo cáo sản xuất Xưởng Nguyên liệu" — readonly, dùng chung TP1/TP2.
 * Dùng lại LcPhieuTabs (editable=false) để khỏi lặp lại cấu trúc tab với trang Tạo phiếu.
 */
const ChiTietBaoCaoSanXuat_XNL = () => {
  const { idphieu, navigateToDetail, safeGetDetail, redirectToList } = usePhieuNavigation(
    "phieu_bcsx_xnl_id",
    "/viecdentoi/baocaosanxuat_xnl"
  );

  const config = LC_BCSX_XNL;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tables, setTables] = useState<LcPhieuTables>(EMPTY_LC_PHIEU_TABLES);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      if (!idphieu) return;
      const res = await safeGetDetail(() => PhieuApi.getDetail(idphieu));
      if (!res) return;
      setData(res);

      const fd = (res as any)?.jsonData || {};
      setTables({
        capLieu: fd.table_capLieu || [],
        coHatNghien1: fd.table_coHatNghien1 || [],
        phoiTron: fd.table_phoiTron || [],
        pheu: fd.table_pheu || [],
        thap: fd.table_thap || [],
        phanTich: fd.table_phanTich || [],
      });
    } catch (error) {
      console.error("Lỗi tải dữ liệu phiếu BCSX_XNL:", error);
      message.error("Không thể tải dữ liệu phiếu");
    } finally {
      setLoading(false);
    }
  }, [idphieu, safeGetDetail]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formData = data?.jsonData || {};
  const thanhPham = useMemo(() => scopeToThanhPham(formData?.scope), [formData?.scope]);

  const handleActionSuccess = useCallback(
    async (context?: { newPhieuId?: string }) => {
      if (context?.newPhieuId) {
        navigateToDetail(context.newPhieuId, "/taophieubaocaosanxuat_xnl");
        return;
      }
      await loadData();
    },
    [loadData, navigateToDetail]
  );

  const actionButtons = useMemo(() => {
    if (!data || !idphieu) return null;
    const userInfoStr = localStorage.getItem("userinfo");
    const userInfo = userInfoStr ? JSON.parse(userInfoStr) : {};
    if (getBmQuyenUiFlags(config.code, userInfo).isView) return null;

    const buttons = phieuActionService.getActionButtons({
      phieuId: idphieu,
      tinhTrang: data.tinhTrang ?? 0,
      isClone: data.isClone ?? false,
      currentUserId: userInfo.iD_TaiKhoan ?? null,
      currentUserPhongBanId: userInfo.iD_PhongBan ?? null,
      currentUserTenNgan: userInfo.tenNgan ?? null,
      nguoiTaoId: data.nguoiTaoId ?? null,
      phieuPhongBanId: data.idphongBan ?? null,
      pheDuyet: data.pheDuyet ?? [],
      redirectToList,
      onSuccess: handleActionSuccess,
      onError: (error) => {
        console.error("Action error:", error);
        message.error((error as any)?.message ?? "Không thể thực hiện thao tác");
      },
    });

    const filteredButtons = buttons.filter((btn) => !DETAIL_HIDDEN_BUTTON_KEYS.has(btn.key));
    if (filteredButtons.length === 0) return null;
    return phieuActionService.renderActionButtons(filteredButtons, idphieu);
  }, [data, idphieu, config.code, handleActionSuccess, redirectToList]);

  return (
    <Card bordered style={{ padding: 24, background: "#fff" }} loading={loading}>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <Title level={4} style={{ marginBottom: 0 }}>
          {config.title}
        </Title>
        {idphieu && <b>Số phiếu: {data?.soPhieu}</b>}
      </div>

      <Descriptions bordered size="small" column={2}>
        <Descriptions.Item label="Số phiếu">{data?.soPhieu || ""}</Descriptions.Item>
        <Descriptions.Item label="Thành phẩm">{thanhPham ?? "-"}</Descriptions.Item>
        <Descriptions.Item label="Ngày SX">
          {formData?.NgaySX ? dayjs(formData.NgaySX).format("DD/MM/YYYY") : ""}
        </Descriptions.Item>
        <Descriptions.Item label="Ca / Kíp">
          {(formData?.ca == 1 ? "Ca ngày" : formData?.ca == 2 ? "Ca đêm" : "-") +
            (formData?.kip ? ` / Kíp ${formData.kip}` : "")}
        </Descriptions.Item>
      </Descriptions>

      <div style={{ marginTop: 16 }}>
        <LcPhieuTabs
          thanhPham={thanhPham}
          editable={false}
          tables={tables}
          onTablesChange={() => {}}
        />
      </div>

      <Row justify="space-around" align="top" style={{ textAlign: "center", marginTop: 30 }}>
        {config.signatures.map((sig) => {
          const duyet = data?.pheDuyet?.find((p: any) => p.capDuyet === sig.capduyet);
          return (
            <Col key={sig.capduyet}>
              <Text strong>{sig.label}</Text>
              <br />
              <Text type="secondary">
                <Text>{duyet?.tinhTrang === 1 ? "Đã ký" : "Chưa xử lý"}</Text>
                <br />
                {duyet?.tenNguoiDuyet}
              </Text>
            </Col>
          );
        })}
      </Row>

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

export default ChiTietBaoCaoSanXuat_XNL;
