import { useMemo } from "react";
import { Typography } from "antd";
import CustomFormTable, { type FormColumnDef } from "../CustomFormTable";
import type { ThanhPham } from "./lcTabsConfig";
import { buildSiloOptions, buildCumThapOptions, LOAI_PHOI_TRON_OPTIONS } from "./lcMockOptions";
import { sttColumn } from "./lcColumnHelpers";

/**
 * Vùng "Phối trộn" — LC_01_PhanTich_ThietKe_TP1_TP2.md mục 2.2 Vùng 3.
 * Bảng phẳng gộp header phối trộn (LC_PhoiTron) + dòng silo (LC_PhoiTronChiTiet) thành
 * 1 dòng/silo cho đơn giản ở giai đoạn UI-first; khi có backend có thể tách lại thành
 * header + chi tiết nếu cần (xem LC_03_Prompt_ThietKe_CSDL.md mục 3.3 #10, #11).
 */

export interface PhoiTronRow {
  key?: string | number;
  cumThapMa?: string | null;
  loaiPhoiTron?: string | null;
  soPhieuYeuCau?: string | null;
  maMauThuNghiem?: string | null;
  siloId?: number | string | null;
  vatLieuTen?: string | null;
  tyLeKeHoach?: string | number | null;
  tyLeThucTe?: string | number | null;
  klCanAm?: string | number | null;
  doAm?: string | number | null;
  klQuyKho?: string | number | null;
  ghiChu?: string | null;
}

interface TabPhoiTronProps {
  thanhPham: ThanhPham | null | undefined;
  editable: boolean;
  rows: PhoiTronRow[];
  onChange: (rows: PhoiTronRow[]) => void;
}

const TabPhoiTron = ({ thanhPham, editable, rows, onChange }: TabPhoiTronProps) => {
  const siloOptions = useMemo(() => buildSiloOptions(thanhPham), [thanhPham]);
  const cumThapOptions = useMemo(() => buildCumThapOptions(thanhPham), [thanhPham]);

  const columns: FormColumnDef[] = useMemo(
    () => [
      sttColumn(),
      { title: "Tháp", dataIndex: "cumThapMa", width: 100, options: cumThapOptions },
      { title: "Loại phối trộn", dataIndex: "loaiPhoiTron", width: 130, options: LOAI_PHOI_TRON_OPTIONS },
      { title: "Số phiếu yêu cầu", dataIndex: "soPhieuYeuCau", width: 130 },
      { title: "Mã mẫu thử nghiệm", dataIndex: "maMauThuNghiem", width: 140 },
      { title: "Silo", dataIndex: "siloId", width: 110, options: siloOptions },
      { title: "Vật liệu / Than", dataIndex: "vatLieuTen", width: 160 },
      {
        title: "Tỷ lệ kế hoạch (%)",
        dataIndex: "tyLeKeHoach",
        width: 120,
        type: "float",
        align: "right",
      },
      {
        title: "Tỷ lệ thực tế (%)",
        dataIndex: "tyLeThucTe",
        width: 120,
        type: "float",
        align: "right",
      },
      {
        title: "KL cân (tấn)",
        dataIndex: "klCanAm",
        width: 110,
        type: "float",
        align: "right",
      },
      {
        title: "Độ ẩm (%)",
        dataIndex: "doAm",
        width: 90,
        type: "float",
        align: "right",
      },
      {
        title: "KL quy khô (tấn)",
        dataIndex: "klQuyKho",
        width: 120,
        align: "right",
        readonly: true,
      },
      { title: "Ghi chú", dataIndex: "ghiChu", width: 160 },
    ],
    [siloOptions, cumThapOptions]
  );

  return (
    <div>
      <Typography.Text type="secondary">
        1 dòng = 1 silo trong 1 phối trộn (vd tháp 1-2 có đơn 1.1, 1.2, thử nghiệm 1.3 — nhập
        "Số phiếu yêu cầu" giống nhau cho các dòng cùng đơn phối trộn). Cột "KL quy khô" tính
        tự động sau khi có engine công thức ở backend.
      </Typography.Text>
      <CustomFormTable
        columns={columns}
        initialData={rows}
        onDataChange={(r) => onChange(r as PhoiTronRow[])}
        addRowButtonText="+ Thêm dòng phối trộn"
        showAddButton={editable}
        showDeleteButton={editable}
        editable={editable}
        minRows={0}
      />
    </div>
  );
};

export default TabPhoiTron;
