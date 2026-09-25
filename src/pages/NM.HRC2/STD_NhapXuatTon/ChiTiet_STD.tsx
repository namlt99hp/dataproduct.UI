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
import HRC2_STD_NXT from "../../../utils/BM_config/HRC2_STD_NXT.json";
import { CheckOutlined, CloseOutlined, ReloadOutlined } from "@ant-design/icons";
import { PheDuyetApi } from "../../../services/PheDuyetApi";
import { dlnmHRC2Api } from "../../../services/DLNMHRC2Api";
import { STD_NXT_HRC2ServiceApi } from "../../../services/STD_NXT_HRC2ServiceApi";
import GroupedTableSTD from "../../../components/GroupedTableSTD";
import SummaryTableSTD from "../../../components/SummaryTableSTD";
import logoHP from "../../../assets/images/LogoPDF.png";

const { Title, Text } = Typography;

const ChiTiet_STD = () => {
  const location = useLocation();
  const { pheduyet, type } = location.state || {};
  // Vào từ mục "Xem" (vùng 3, xem thuần túy) — không cho thao tác Xác nhận/Từ chối, chỉ xem dữ liệu.
  const isReadOnlyView = type === "xemphieu";
  const { idphieu, safeGetDetail } = usePhieuNavigation(
    "std_nxt_hrc2_idphieu",
    "/std_nhapxuatton"
  );

  const config = HRC2_STD_NXT;

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
      // Thông tin phê duyệt
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

  //   if (!data) return null;

  const formData = data?.jsonData || {};

  // Cấu hình bảng hiển thị
  const layout1 = config.layout1?.[0];
  const layout2 = config.layout2?.[0];

  // "Làm mới" — gọi lại api/DLNMHRC2/filterSTD_NXT giống hệt nút Làm mới ở vùng 1 (Tao_STD.tsx) để BE
  // chạy sp_Init_XuatNhapTon_HRC2 cập nhật lại dữ liệu tiêu hao mới nhất từ NM cho đúng phiếu này, sau
  // đó tải lại chi tiết STD_NXT để đổ dữ liệu mới lên bảng — không chỉ đọc lại snapshot cũ như loadData.
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
      const headerKeyIds = [...new Set(
        table1Data
          .map((r: any) => r.idNguyenNhienLieu)
          .filter((id: any): id is number => id != null && Number(id) > 0)
      )];
      await dlnmHRC2Api.filterSTD_NXT({
        NgaySX: ngay,
        Ca: Number(caVal),
        idPhieu: idphieu,
        ...(headerKeyIds.length > 0 ? { headerKeyIds } : {}),
      });

      const detailRes: any = await STD_NXT_HRC2ServiceApi.getDetail(idphieu);
      const detail = detailRes?.data;

      const kvList = config.layout1?.[0]?.khuVucList || [];
      const getKhuVucByScope = (scope: number): string => {
        const kv = kvList.find((kv: any) => {
          const valueNum = kv?.value !== undefined ? Number(kv.value) : NaN;
          return !Number.isNaN(valueNum) && valueNum === scope;
        });
        return kv?.label ? String(kv.label) : String(scope);
      };

      const mappedDetails = (detail?.details || []).map((item: any, index: number) => {
        const scope = Number(item.scope) || 0;
        return {
          key: `${scope}_${item.id_HeaderKey}_${item.viTri}_${index}`,
          khuVuc: getKhuVucByScope(scope),
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

      const ngaySxStr = (detail?.ngaySX ?? detail?.NgaySX) != null
        ? (typeof (detail?.ngaySX ?? detail?.NgaySX) === "string"
            ? (detail?.ngaySX ?? detail?.NgaySX)
            : (detail?.ngaySX ?? detail?.NgaySX)?.format?.("YYYY-MM-DD"))
        : undefined;
      const caDetail = detail?.ca ?? detail?.Ca ?? undefined;
      const mappedSummary = (detail?.summary || []).map((item: any) => ({
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
        Ca: caDetail,
        tyLeBOF: item.tyLeBOF ?? item.TyLeBOF ?? null,
        tyLeTinhLuyen: item.tyLeTinhLuyen ?? item.TyLeTinhLuyen ?? null,
        tyLeRH: item.tyLeRH ?? item.TyLeRH ?? null,
        KLPB_BOF: item.klpB_BOF ?? item.klpb_BOF ?? item.KLPB_BOF ?? null,
        KLPB_TL: item.klpB_TL ?? item.klpb_TL ?? item.KLPB_TL ?? null,
        KLPB_RH: item.klpB_RH ?? item.klpb_RH ?? item.KLPB_RH ?? null,
        KLTK_BOF: item.kltK_BOF ?? item.kltk_BOF ?? item.KLTK_BOF ?? null,
        KLTK_LF: item.kltK_LF ?? item.kltk_LF ?? item.KLTK_LF ?? null,
        KLTK_RH: item.kltK_RH ?? item.kltk_RH ?? item.KLTK_RH ?? null,
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
  // xử lý phiếu
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
              {/* Nút Từ chối phiếu */}
              <Button
                danger
                icon={<CloseOutlined />}
                onClick={() => openModal("reject")}
              >
                Từ chối
              </Button>
            </>
          )}

          {/* Nút in / xuất PDF */}
          {/* <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
            In phiếu
          </Button> */}
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
        {/* Logo + tên công ty */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 12,
          }}
        >
          {/* Logo + tên công ty */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <img src={logoHP} alt="logo" style={{ height: "auto", width: 220 }} />
          </div>

          {/* Tiêu đề trung tâm */}
          {/* <div style={{ flex: 1, textAlign: "center" }}>
          <Typography.Title level={3} style={{ marginBottom: 0 }}>
            {config.title}
          </Typography.Title>
          {idphieu && <b>Số phiếu: {data?.soPhieu}</b>}
        </div> */}

          {/* ISO góc phải */}
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
          <Descriptions.Item label="Máy đúc">
            {formData?.mayduc || ""}
          </Descriptions.Item>
        </Descriptions>

        {/* Hiển thị bảng 1 - nhóm theo khu vực */}
        {layout1 && layout1.sectionType === "groupedTable" && (
          <div style={{ marginTop: 16 }}>
            <Typography.Title level={5}>{layout1.title}</Typography.Title>
            <GroupedTableSTD
              columns={layout1.columns || []}
              initialData={table1Data}
              khuVucList={layout1.khuVucList.map((k: any) => k?.label || k?.value || "")}
              defaultViTri={layout1.defaultViTri || 1}
              editable={false}
              loading={loading}
            />
          </div>
        )}

        {/* Hiển thị bảng 2 - tổng hợp */}
        {layout2 && layout2.sectionType === "summaryTable" && table2Data && table2Data.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Typography.Title level={5}>{layout2.title}</Typography.Title>
            <SummaryTableSTD
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

export default ChiTiet_STD;
