import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, Card, Descriptions, Empty, Select, Space, Spin, Typography, message } from "antd";
import { FileExcelOutlined, FilePdfOutlined, ReloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useLocation } from "react-router-dom";
import { HRC1Api, type HRC1_PhieuDataVm } from "../../../services/HRC1_BBGNApi";
import { LoThoiPanel, TinhLuyenPanel, DucPanel, getScopeName, getGroupLabel } from "./TaoPhieuGN";
import { getThongTinUser } from "../../../utils/constants/GetThongTinLocalStore";
import { isAdminUser } from "../../../utils/helpers/checkAdminRole";
import { BmQuyenXlApi, type BmQuyenXlModel } from "../../../services/BmQuyenXlApi";
import { BM_CONFIG } from "../../../utils/configs/BieuMauConst";
import { PhieuApi } from "../../../services/PhieuApi";

const { Title } = Typography;

const LO_SCOPE_OPTS = [1, 2, 3, 4, 5].map((n) => ({ label: `Lò thổi ${n}`, value: n }));
const TL_SCOPE_OPTS = [1, 2, 3, 4, 5].map((n) => ({ label: `Tinh luyện ${n}`, value: n }));

const ChiTietGN = () => {
  const location = useLocation();
  const idphieu = (location.state as { idphieu?: string } | null)?.idphieu;

  const [data, setData] = useState<HRC1_PhieuDataVm | null>(null);
  const [loading, setLoading] = useState(false);
  const [ducExtraControls, setDucExtraControls] = useState<ReactNode>(null);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  // Quyền của user cho HRC1_BBGN_ThepLong theo từng scope (maKhuVuc = TSC/Đúc) — lọc theo
  // scope của phiếu đang xem, không suy ra true/false 1 lần cho mọi scope (nhất quán với TaoPhieuGN).
  const [bbgnQuyenRows, setBbgnQuyenRows] = useState<Array<{ maKhuVuc: string; quyenChucNang: number }>>([]);

  const [loSo, setLoSo] = useState<number | null>(null);
  const [tlSo, setTlSo] = useState<number | null>(null);

  const isPKHAdmin = useMemo(() => {
    const u = getThongTinUser();
    return u.tenNgan === "P.KH" || u.iD_PhongBan === 70 || isAdminUser(u);
  }, []);

  // Kiểm tra quyền một lần khi mount
  useEffect(() => {
    const u = getThongTinUser();
    const userId = u.iD_TaiKhoan;
    if (!userId) return;
    let cancelled = false;
    BmQuyenXlApi.getByTaiKhoan(userId)
      .then((res) => {
        if (cancelled) return;
        const arr: BmQuyenXlModel[] = Array.isArray(res) ? res : ((res as unknown as { data?: BmQuyenXlModel[] })?.data ?? []);
        setBbgnQuyenRows(
          arr
            .filter((r) => r.maBm === BM_CONFIG.HRC1.HRC1_BBGN_ThepLong)
            .map((r) => ({ maKhuVuc: String(r.maKhuVuc ?? ""), quyenChucNang: Number(r.quyenChucNang) }))
        );
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Scope (máy đúc) của phiếu đang xem — quyền phải khớp đúng scope này, hoặc "ALL"
  const bbgnScope = data?.scope != null ? String(data.scope) : null;
  const hasQuyenForScope = useCallback(
    (quyenChucNang: number) =>
      bbgnScope != null &&
      bbgnQuyenRows.some(
        (r) => r.quyenChucNang === quyenChucNang && (r.maKhuVuc === "ALL" || r.maKhuVuc === bbgnScope)
      ),
    [bbgnQuyenRows, bbgnScope]
  );
  const hasQuyenXacNhan = hasQuyenForScope(2); // quyenChucNang=2 (PHEDUYET)
  const hasQuyenChot = hasQuyenForScope(3);    // quyenChucNang=3 (CHOT)

  // loadData dùng loSo/tlSo làm dependency → tự reload khi scope thay đổi
  const loadData = useCallback(async () => {
    if (!idphieu) return;
    setLoading(true);
    try {
      const res = await HRC1Api.getPhieu(idphieu, {
        loSo:       loSo  ?? undefined,
        scopePhieu: tlSo  ?? undefined,
      });
      setData(res);
    } catch {
      message.error("Không tải được dữ liệu phiếu");
    } finally {
      setLoading(false);
    }
  }, [idphieu, loSo, tlSo]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleReload = useCallback(async () => {
    const maMes = (data?.danhSachMe ?? [])
      .filter((m) => m.isChot !== true && m.isGhost !== true && m.maMe)
      .map((m) => m.maMe!);
    if (maMes.length > 0) {
      try {
        await HRC1Api.syncPhanLoaiMeThep(maMes);
      } catch {
        // không block reload nếu sync lỗi
      }
    }
    await loadData();
  }, [loadData, data]);

  const effectiveCanChot =  hasQuyenChot;
  const canDoAnything = effectiveCanChot || hasQuyenXacNhan;

  const congDoanLabel = data ? getGroupLabel(data.maBm ?? "") : "";
  const scopeName = data ? getScopeName(data.maBm ?? "", data.scope ?? 0, data.tenScope, data.danhSachMayDuc) : "";

  const downloadBlob = (raw: unknown, filename: string) => {
    const blob = raw instanceof Blob ? raw : new Blob([raw as BlobPart]);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const buildExportFilename = (ext: "xlsx" | "pdf") => {
    if (!data) return `HRC1_export.${ext}`;
    const label = getGroupLabel(data.maBm ?? "").replace(/\s/g, "_");
    const ngay = data.ngaySX ? data.ngaySX.toString().replace(/-/g, "") : "";
    const ca = data.ca === 1 ? "CaNgay" : data.ca === 2 ? "CaDem" : "";
    return `HRC1_${label}_${ngay}_${ca}.${ext}`;
  };

  const handleExportExcel = async () => {
    if (!data) return;
    setExportingExcel(true);
    try {
      const raw = await PhieuApi.exportDetailExcel(data.idPhieu);
      downloadBlob(raw, buildExportFilename("xlsx"));
      message.success("Đã tải file Excel");
    } catch (e: unknown) {
      const err = e instanceof Blob
        ? await e.text()
        : typeof e === "string" ? e : (e as { message?: string })?.message ?? "Lỗi xuất Excel";
      message.error(err, 6);
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportPdf = async () => {
    if (!data) return;
    setExportingPdf(true);
    try {
      const raw = await PhieuApi.exportDynamicPDF(data.idPhieu, {});
      downloadBlob(raw, buildExportFilename("pdf"));
      message.success("Đã tải file PDF");
    } catch (e: unknown) {
      const err = e instanceof Blob
        ? await e.text()
        : typeof e === "string" ? e : (e as { message?: string })?.message ?? "Lỗi xuất PDF";
      message.error(err, 6);
    } finally {
      setExportingPdf(false);
    }
  };

  const exportButtons = (
    <>
      <Button
        size="small"
        icon={<ReloadOutlined />}
        loading={loading}
        onClick={() => void handleReload()}
      >
        Làm mới
      </Button>
      <Button
        size="small"
        icon={<FileExcelOutlined />}
        loading={exportingExcel}
        disabled={!data}
        onClick={() => void handleExportExcel()}
        style={{ backgroundColor: "#217346", borderColor: "#217346", color: "#fff" }}
      >
        Excel
      </Button>
      <Button
        size="small"
        icon={<FilePdfOutlined />}
        loading={exportingPdf}
        disabled={!data}
        onClick={() => void handleExportPdf()}
        danger
      >
        PDF
      </Button>
    </>
  );

  return (
    <Card style={{ margin: 24 }} loading={loading}>
      {!idphieu ? (
        <Empty description="Không có thông tin phiếu" />
      ) : (
        <Spin spinning={loading}>
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <Title level={4} style={{ marginBottom: 4 }}>
              HRC1 — Biên bản giao nhận thép lỏng
            </Title>
            {data?.soPhieu && <b>Số phiếu: {data.soPhieu}</b>}
          </div>

          <Descriptions bordered size="small" column={3} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Ngày SX">
              {data?.ngaySX ? dayjs(data.ngaySX).format("DD/MM/YYYY") : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Ca">
              {data?.ca === 1 ? "Ca ngày" : data?.ca === 2 ? "Ca đêm" : "-"}
              {data?.kip ? ` — Kíp ${data.kip}` : ""}
            </Descriptions.Item>
            <Descriptions.Item label="Công đoạn / Thiết bị">
              {data ? `${congDoanLabel} — ${scopeName}` : "-"}
            </Descriptions.Item>
          </Descriptions>

          {data && (
            <>
              {data.congDoan === "lo_thoi" && (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <Space>
                      <span>Lò thổi:</span>
                      <Select
                        size="small"
                        style={{ width: 140 }}
                        placeholder="Tất cả lò thổi"
                        value={loSo ?? undefined}
                        options={LO_SCOPE_OPTS}
                        onChange={(v) => setLoSo(v ?? null)}
                        allowClear
                      />
                      {exportButtons}
                    </Space>
                  </div>
                  <LoThoiPanel
                    phieuData={data}
                    readOnly
                    loSo={loSo}
                    onReload={handleReload}
                  />
                </>
              )}
              {data.congDoan === "tinh_luyen" && (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <Space>
                      <span>Tinh luyện:</span>
                      <Select
                        size="small"
                        style={{ width: 150 }}
                        placeholder="Tất cả tinh luyện"
                        value={tlSo ?? undefined}
                        options={TL_SCOPE_OPTS}
                        onChange={(v) => setTlSo(v ?? null)}
                        allowClear
                      />
                      {exportButtons}
                    </Space>
                  </div>
                  <TinhLuyenPanel
                    phieuData={data}
                    readOnly
                    tlSo={tlSo}
                    onReload={handleReload}
                  />
                </>
              )}
              {data.congDoan === "duc" && (
                <>
                  <div style={{ marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {canDoAnything && ducExtraControls}
                    {exportButtons}
                  </div>
                  <DucPanel
                    phieuData={data}
                    readOnly={!canDoAnything}
                    onReload={handleReload}
                    onExtraChange={canDoAnything ? setDucExtraControls : undefined}
                    canXacNhan={hasQuyenXacNhan}
                    canChot={effectiveCanChot}
                    tableScrollY="calc(100vh - 440px)"
                  />
                </>
              )}
            </>
          )}
        </Spin>
      )}
    </Card>
  );
};

export default ChiTietGN;
