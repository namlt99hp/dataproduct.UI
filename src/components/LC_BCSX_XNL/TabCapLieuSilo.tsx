import { useEffect, useMemo } from "react";
import { Divider, Table, Typography } from "antd";
import CustomFormTable, { type FormColumnDef } from "../CustomFormTable";
import type { ThanhPham } from "./lcTabsConfig";
import { VAT_LIEU_OPTIONS, buildDefaultCapLieuRows, buildDefaultCoHatNghien1Rows } from "./lcMockOptions";

/**
 * Vùng "Cấp liệu & Silo" — lát cắt đầu tiên theo LC_02_Prompt_Vibecoding_V5.md mục 3.
 *
 * Layout khớp workbook thật (xem .claude/LuyenCoc/PhanTichLayout.md mục 2–3 và
 * LC_01_PhanTich_ThietKe_TP1_TP2.md mục 2.2 Vùng 2): MỘT bảng duy nhất, 1 dòng = 1 silo,
 * số dòng CỐ ĐỊNH theo thành phẩm (TP1: 16 silo, TP2: 20 silo) — không thêm/xóa dòng tự
 * do như trước đây (Excel không có nút thêm dòng ở vùng này). Có dòng "Tổng" ở cuối, và
 * bảng phụ "Cỡ hạt sau nghiền 1" (đúng 2 dòng ≤1mm/≤3mm) bên dưới.
 *
 * DB tương ứng (LC_03_Prompt_ThietKe_CSDL.md mục 3.3): #7 LC_CapLieu + #9 LC_TonSilo —
 * ở Excel 2 bảng này gộp làm 1 theo silo nên UI cũng gộp lại cho khớp; khi có backend,
 * 1 dòng UI sẽ tách thành 1 bản ghi LC_CapLieu + 1 bản ghi LC_TonSilo cùng SiloId.
 *
 * Các cột CALCULATED (KL khô thực tế, Lũy kế, Tồn đầu, KL ẩm/khô tồn cuối) để readonly/trống
 * — chưa có engine tính toán ở backend, hiển thị "—" theo quy ước NULL (LC_02 mục 2.7/7).
 */

export interface CapLieuRow {
  key?: string | number;
  siloSo: number;
  vatLieuTen?: string | null;
  soHieuLo?: string | null;
  khoiLuongKeHoach?: string | number | null;
  khoiLuongAmThucTe?: string | number | null;
  doAm?: string | number | null;
  khoiLuongKhoThucTe?: string | number | null;
  luyKeQuyKho?: string | number | null;
  tonDauKyQuyKho?: string | number | null;
  amSiloCuoiKy?: string | number | null;
  klAmTonCuoi?: string | number | null;
  doAmSilo?: string | number | null;
  klTonCuoiQuyKho?: string | number | null;
  ghiChu?: string | null;
}

export interface CoHatNghien1Row {
  key?: string | number;
  kichCo: string;
  lan1?: string | number | null;
  lan2?: string | number | null;
  lan3?: string | number | null;
  ghiChu?: string | null;
}

interface TabCapLieuSiloProps {
  thanhPham: ThanhPham | null | undefined;
  editable: boolean;
  capLieuRows: CapLieuRow[];
  onCapLieuChange: (rows: CapLieuRow[]) => void;
  coHatNghien1Rows: CoHatNghien1Row[];
  onCoHatNghien1Change: (rows: CoHatNghien1Row[]) => void;
}

const TabCapLieuSilo = ({
  thanhPham,
  editable,
  capLieuRows,
  onCapLieuChange,
  coHatNghien1Rows,
  onCoHatNghien1Change,
}: TabCapLieuSiloProps) => {
  // Excel không cho thêm/xóa silo — đảm bảo luôn đủ đúng số dòng theo thành phẩm,
  // giữ lại dữ liệu đã nhập nếu có (vd khi mới đổi "Thành phẩm" trên 1 phiếu chưa lưu).
  useEffect(() => {
    if (!thanhPham) return;
    const expected = thanhPham === "TP2" ? 20 : 16;
    if (capLieuRows.length === expected) return;
    const base = buildDefaultCapLieuRows(thanhPham);
    const merged = base.map((row, idx) => ({ ...row, ...capLieuRows[idx] }));
    onCapLieuChange(merged as CapLieuRow[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thanhPham, capLieuRows.length]);

  useEffect(() => {
    if (coHatNghien1Rows.length === 2) return;
    const base = buildDefaultCoHatNghien1Rows();
    const merged = base.map((row, idx) => ({ ...row, ...coHatNghien1Rows[idx] }));
    onCoHatNghien1Change(merged as CoHatNghien1Row[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coHatNghien1Rows.length]);

  const columns: FormColumnDef[] = useMemo(
    () => [
      {
        title: "Silo",
        dataIndex: "siloSo",
        width: 70,
        align: "center",
        type: "index",
        render: (_: unknown, record: CapLieuRow) => record.siloSo,
      } as FormColumnDef,
      { title: "Tên than", dataIndex: "vatLieuTen", width: 170, options: VAT_LIEU_OPTIONS },
      { title: "Số hiệu lô", dataIndex: "soHieuLo", width: 130 },
      {
        title: "Kế hoạch (tấn)",
        dataIndex: "khoiLuongKeHoach",
        width: 100,
        type: "float",
        align: "right",
      },
      {
        title: "KL ẩm thực tế (tấn)",
        dataIndex: "khoiLuongAmThucTe",
        width: 130,
        type: "float",
        align: "right",
      },
      { title: "Độ ẩm (%)", dataIndex: "doAm", width: 85, type: "float", align: "right" },
      {
        title: "KL khô thực tế (tấn)",
        dataIndex: "khoiLuongKhoThucTe",
        width: 130,
        align: "right",
        readonly: true,
      },
      {
        title: "Lũy kế quy khô (tấn)",
        dataIndex: "luyKeQuyKho",
        width: 130,
        align: "right",
        readonly: true,
      },
      {
        title: "Tồn đầu kíp quy khô (tấn)",
        dataIndex: "tonDauKyQuyKho",
        width: 150,
        align: "right",
        readonly: true,
      },
      {
        title: "Âm silo cuối kíp (m)",
        dataIndex: "amSiloCuoiKy",
        width: 130,
        type: "float",
        align: "right",
      },
      {
        title: "KL ẩm tồn cuối (tấn)",
        dataIndex: "klAmTonCuoi",
        width: 130,
        align: "right",
        readonly: true,
      },
      { title: "Độ ẩm silo (%)", dataIndex: "doAmSilo", width: 95, type: "float", align: "right" },
      {
        title: "KL khô tồn cuối (tấn)",
        dataIndex: "klTonCuoiQuyKho",
        width: 130,
        align: "right",
        readonly: true,
      },
      { title: "Ghi chú / vị trí bãi", dataIndex: "ghiChu", width: 160 },
    ],
    []
  );

  const renderSummary = () => {
    const sum = (key: keyof CapLieuRow) => {
      const total = capLieuRows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
      return total
        ? total.toLocaleString("en-US", { maximumFractionDigits: 3 })
        : "—";
    };
    return (
      <Table.Summary fixed>
        <Table.Summary.Row style={{ backgroundColor: "#fafafa", fontWeight: 600 }}>
          <Table.Summary.Cell index={0} colSpan={3} align="center">
            Tổng
          </Table.Summary.Cell>
          <Table.Summary.Cell index={3} align="right">
            {sum("khoiLuongKeHoach")}
          </Table.Summary.Cell>
          <Table.Summary.Cell index={4} align="right">
            {sum("khoiLuongAmThucTe")}
          </Table.Summary.Cell>
          <Table.Summary.Cell index={5} />
          <Table.Summary.Cell index={6} align="right">
            {sum("khoiLuongKhoThucTe")}
          </Table.Summary.Cell>
          <Table.Summary.Cell index={7} align="right">
            {sum("luyKeQuyKho")}
          </Table.Summary.Cell>
          <Table.Summary.Cell index={8} align="right">
            {sum("tonDauKyQuyKho")}
          </Table.Summary.Cell>
          <Table.Summary.Cell index={9} />
          <Table.Summary.Cell index={10} align="right">
            {sum("klAmTonCuoi")}
          </Table.Summary.Cell>
          <Table.Summary.Cell index={11} />
          <Table.Summary.Cell index={12} align="right">
            {sum("klTonCuoiQuyKho")}
          </Table.Summary.Cell>
          <Table.Summary.Cell index={13} />
        </Table.Summary.Row>
      </Table.Summary>
    );
  };

  const coHatColumns: FormColumnDef[] = useMemo(
    () => [
      { title: "Kích cỡ", dataIndex: "kichCo", width: 90, readonly: true },
      { title: "Lần 1", dataIndex: "lan1", width: 90, type: "float", align: "right" },
      { title: "Lần 2", dataIndex: "lan2", width: 90, type: "float", align: "right" },
      { title: "Lần 3", dataIndex: "lan3", width: 90, type: "float", align: "right" },
      { title: "Ghi chú", dataIndex: "ghiChu", width: 200 },
    ],
    []
  );

  return (
    <div>
      <Typography.Text type="secondary">
        Mỗi dòng ứng với 1 silo cố định ({thanhPham === "TP2" ? "20" : "16"} silo theo
        thành phẩm) — không thêm/xóa dòng, khớp bố cục trong workbook gốc. Các cột nền vàng
        (KL khô, lũy kế, tồn cuối...) là giá trị tính toán, sẽ do hệ thống tự tính khi có
        engine công thức ở backend; hiện để trống ("—").
      </Typography.Text>

      <Divider orientation="left" plain>
        Cấp liệu &amp; tồn silo
      </Divider>
      <CustomFormTable
        columns={columns}
        initialData={capLieuRows}
        onDataChange={(rows) => onCapLieuChange(rows as CapLieuRow[])}
        showAddButton={false}
        showDeleteButton={false}
        editable={editable}
        minRows={0}
        summary={renderSummary}
        scrollY={520}
        stickyHeader
      />

      <Divider orientation="left" plain>
        Cỡ hạt sau nghiền 1
      </Divider>
      <CustomFormTable
        columns={coHatColumns}
        initialData={coHatNghien1Rows}
        onDataChange={(rows) => onCoHatNghien1Change(rows as CoHatNghien1Row[])}
        showAddButton={false}
        showDeleteButton={false}
        editable={editable}
        minRows={0}
      />
    </div>
  );
};

export default TabCapLieuSilo;
