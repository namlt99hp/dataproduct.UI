/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import {
  Card,
  Descriptions,
  Typography,
  Row,
  Col,
  message,
  Space,
  Button,
  Modal,
  Input,
} from "antd";
import dayjs from "dayjs";
import { useLocation } from "react-router-dom";
import { usePhieuNavigation } from "../../../hooks/usePhieuNavigation";
import { PhieuApi } from "../../../services/PhieuApi";
import HRC1_STD_NXT from "../../../utils/BM_config/HRC1_STD_NXT.json";
import { CheckOutlined, CloseOutlined, ReloadOutlined } from "@ant-design/icons";
import { PheDuyetApi } from "../../../services/PheDuyetApi";
import { dlnmHRC1Api } from "../../../services/DLNMHRC1Api";
import { STD_NXT_HRC1ServiceApi } from "../../../services/STD_NXT_HRC1ServiceApi";
import GroupedTableSTD_HRC1 from "../../../components/GroupedTableSTD_HRC1";
import SummaryTableSTD_HRC1 from "../../../components/SummaryTableSTD_HRC1";
import logoHP from "../../../assets/images/LogoPDF.png";

const { Title, Text } = Typography;

const ChiTiet_STD_HRC1 = () => {
  const location = useLocation();
  const { pheduyet, type } = location.state || {};
  // Vào từ mục "Xem" (vùng 3, xem thuần túy) — không cho thao tác Xác nhận/Từ chối, chỉ xem dữ liệu.
  const isReadOnlyView = type === "xemphieu";
  const { idphieu, safeGetDetail } = usePhieuNavigation(
    "std_nxt_hrc1_idphieu",
    "/hrc1_std_nhapxuatton"
  );

  const config = HRC1_STD_NXT;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  // Dữ liệu bảng hiện đang hiển thị — khởi tạo từ snapshot đã lưu (jsonData.table1/table2) khi tải phiếu,
  // và được ghi đè bằng dữ liệu NM mới nhất khi bấm "Làm mới" (xem handleRefreshFromNM).
  const [table1Data, setTable1Data] = useState<any[]>([]);
  const [table2Data, setTable2Data] = useState<any[]>([]);

  // thông tin phê duyệt
  const [datapheduyet, setDataPheDuyet] = useState<any>(null);
  const [action, setAction] = useState(""); // "approve" hoặc "reject"
  const [open, setOpen] = useState(false);
  const [ghiChu, setGhiChu] = useState("");

  const loadData = useCallback(async () => {
    if (!idphieu) return;
    try {
      if (pheduyet != null) {
        setDataPheDuyet(pheduyet);
      }
      setLoading(true);
      const res = await safeGetDetail(() => PhieuApi.getDetail(idphieu));
      if (!res) return;
      setData(res);
      const jsonData = (res as any)?.jsonData || {};
      setTable1Data(jsonData.table1 || []);
      setTable2Data(jsonData.table2 || []);
    } catch (err: any) {
      console.error("Lỗi tải dữ liệu phiếu:", err);
      message.error("Không thể tải phiếu.");
    } finally {
      setLoading(false);
    }
  }, [idphieu, pheduyet, safeGetDetail]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formData = data?.jsonData || {};

  const layout1 = config.layout1?.[0];
  const layout2 = config.layout2?.[0];

  // "Làm mới" — gọi lại api/DLNMHRC1/filterSTD_NXT giống hệt nút Làm mới ở vùng 1 (Tao_STD.tsx) để BE
  // chạy sp_Init cập nhật lại dữ liệu tiêu hao mới nhất từ NM cho đúng phiếu này, sau đó tải lại chi
  // tiết STD_NXT để đổ dữ liệu mới lên bảng — không chỉ đọc lại snapshot cũ như loadData.
  const handleRefreshFromNM = useCallback(async () => {
    if (!idphieu) return;
    const ngay = formData?.NgaySX ? dayjs(formData.NgaySX).format("YYYY-MM-DD") : null;
    const caVal = formData?.ca;
    if (!ngay || caVal == null) {
      message.warning("Phiếu chưa có Ngày SX/Ca để làm mới dữ liệu.");
      return;
    }
    try {
      setLoading(true);
      const phuLieuIds = [...new Set(
        table1Data
          .map((r: any) => r.idPhuLieu)
          .filter((id: any): id is number => id != null && Number(id) > 0)
      )];
      await dlnmHRC1Api.filterSTD_NXT({
        NgaySX: ngay,
        Ca: Number(caVal),
        idPhieu: idphieu,
        ...(phuLieuIds.length > 0 ? { PhuLieuIds: phuLieuIds } : {}),
      });

      const detailRes: any = await STD_NXT_HRC1ServiceApi.getDetail(idphieu);
      const detail = detailRes?.data;

      const kvList = config.layout1?.[0]?.khuVucList || [];
      const getKhuVucByScope = (scope: number): string => {
        const idx = scope - 1;
        const kv = kvList[idx];
        return kv?.label ? String(kv.label) : String(scope);
      };

      const mappedDetails = (detail?.details || []).map((item: any, index: number) => {
        const scope = Number(item.scope ?? item.Scope) || 0;
        return {
          key: `${scope}_${item.phuLieuID ?? item.PhuLieuID}_${item.viTri ?? item.ViTri}_${index}`,
          khuVuc: getKhuVucByScope(scope),
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

      const ngaySxStr = (detail?.ngaySX ?? detail?.NgaySX) != null
        ? (typeof (detail?.ngaySX ?? detail?.NgaySX) === "string"
            ? (detail?.ngaySX ?? detail?.NgaySX)
            : (detail?.ngaySX ?? detail?.NgaySX)?.format?.("YYYY-MM-DD"))
        : undefined;
      const caDetail = detail?.ca ?? detail?.Ca ?? undefined;
      const mappedSummary = (detail?.summary || []).map((item: any) => ({
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
        Ca: caDetail,
        tyLeBOF: item.tyLeBOF ?? item.TyLeBOF ?? null,
        tyLeLF: item.tyLeLF ?? item.TyLeLF ?? null,
        KLPB_BOF: item.klpB_BOF ?? item.klpb_BOF ?? item.KLPB_BOF ?? null,
        KLPB_LF: item.klpB_LF ?? item.klpb_LF ?? item.KLPB_LF ?? null,
        KLTK_BOF: item.kltK_BOF ?? item.kltk_BOF ?? item.KLTK_BOF ?? null,
        KLTK_LF: item.kltK_LF ?? item.kltk_LF ?? item.KLTK_LF ?? null,
      }));

      setTable1Data(mappedDetails);
      setTable2Data(mappedSummary);
      message.success("Đã làm mới dữ liệu từ NM.");
    } catch (error: any) {
      console.error("Làm mới dữ liệu từ NM thất bại:", error);
      message.error(error?.message || "Không thể làm mới dữ liệu.");
    } finally {
      setLoading(false);
    }
  }, [idphieu, formData?.NgaySX, formData?.ca, table1Data, config.layout1]);

  const handleSubmit = async () => {
    if (!action) return;
    try {
      setLoading(true);
      await PheDuyetApi.putData(pheduyet?.id, {
        ...pheduyet,
        tinhTrang: action === "approve" ? 1 : 2,
        ghiChu: ghiChu,
      });
      message.success(
        action === "approve"
          ? "Xác nhận phiếu thành công!"
          : "Đã từ chối phiếu!"
      );
      setOpen(false);
      setGhiChu("");
    } catch (error) {
      console.error("Lỗi khi gửi phê duyệt:", error);
      message.error("Lỗi khi gửi phê duyệt, vui lòng thử lại!");
    } finally {
      setLoading(false);
    }
  };

  const openModal = (type: any) => {
    setAction(type);
    setOpen(true);
  };

  return (
    <>
      <div style={{ textAlign: "right" }}>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void handleRefreshFromNM()} loading={loading}>
            Làm mới
          </Button>
          {!isReadOnlyView && datapheduyet && datapheduyet?.tinhTrang === 0 && (
            <>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => openModal("approve")}
              >
                Xác nhận
              </Button>
              <Button
                danger
                icon={<CloseOutlined />}
                onClick={() => openModal("reject")}
              >
                Từ chối
              </Button>
            </>
          )}
        </Space>

        <Modal
          title={
            action === "approve"
              ? "Nhập nội dung phê duyệt"
              : "Nhập lý do từ chối"
          }
          open={open}
          okText={
            action === "approve" ? "Xác nhận phê duyệt" : "Xác nhận từ chối"
          }
          cancelText="Hủy"
          confirmLoading={loading}
          onOk={handleSubmit}
          onCancel={() => setOpen(false)}
        >
          <Input.TextArea
            rows={3}
            placeholder={
              action === "approve"
                ? "Nhập ghi chú phê duyệt (nếu có)..."
                : "Nhập lý do từ chối..."
            }
            value={ghiChu}
            onChange={(e) => setGhiChu(e.target.value)}
          />
        </Modal>
      </div>
      <Card
        bordered
        style={{ padding: 24, background: "#fff" }}
        loading={loading}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <img src={logoHP} alt="logo" style={{ height: "auto", width: 220 }} />
          </div>

          {config.isoInfo && (
            <div
              style={{ fontSize: 13, textAlign: "right", lineHeight: "20px" }}
            >
              <div>
                <b>{config.isoInfo.code}</b>
              </div>
              <div>Ngày hiệu lực: {config.isoInfo.effectiveDate}</div>
              <div>Lần sửa đổi: {config.isoInfo.revision}</div>
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <Title level={4} style={{ marginBottom: 0 }}>
            {config.title}
          </Title>
          {idphieu && <b>Số phiếu: {data?.soPhieu}</b>}
        </div>
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="Số phiếu">
            {data?.soPhieu || ""}
          </Descriptions.Item>
          <Descriptions.Item label="Ngày SX">
            {formData?.NgaySX
              ? dayjs(formData.NgaySX).format("DD/MM/YYYY")
              : ""}
          </Descriptions.Item>
          <Descriptions.Item label="Ca sản xuất">
            {formData?.ca || ""}
          </Descriptions.Item>
        </Descriptions>

        {/* Hiển thị bảng 1 - nhóm theo khu vực */}
        {layout1 && layout1.sectionType === "groupedTable" && (
          <div style={{ marginTop: 16 }}>
            <Typography.Title level={5}>{layout1.title}</Typography.Title>
            <GroupedTableSTD_HRC1
              columns={layout1.columns || []}
              initialData={table1Data}
              khuVucList={layout1.khuVucList.map((k: any) => k?.label || k?.value || "")}
              defaultViTri={layout1.defaultViTri || 1}
              editable={false}
              loading={loading}
              nhaMay={1}
            />
          </div>
        )}

        {/* Hiển thị bảng 2 - tổng hợp */}
        {layout2 && layout2.sectionType === "summaryTable" && table2Data && table2Data.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Typography.Title level={5}>{layout2.title}</Typography.Title>
            <SummaryTableSTD_HRC1
              columns={layout2.columns || []}
              table1Data={table1Data}
              initialData={table2Data}
              editable={false}
              loading={loading}
            />
          </div>
        )}
        {/* Khu vực ký duyệt */}
        <Row
          justify="space-around"
          align="top"
          style={{ textAlign: "center", marginTop: 30 }}
        >
          {config.signatures.map((sig) => {
            const duyet = data?.pheDuyet?.find(
              (p: any) => p.capDuyet === sig.capduyet
            );
            return (
              <Col>
                <Text strong>{sig.label}</Text>
                <br />
                <Text type="secondary" key={sig.capduyet}>
                  <Text>{duyet?.tinhTrang === 1 ? "Đã ký" : "Chưa xử lý"}</Text>
                  <br />
                  {duyet?.tenNguoiDuyet}
                </Text>
              </Col>
            );
          })}
        </Row>
      </Card>
    </>
  );
};

export default ChiTiet_STD_HRC1;
