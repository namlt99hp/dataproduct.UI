import { useMemo } from "react";
import { Typography } from "antd";
import CustomFormTable, { type FormColumnDef } from "../CustomFormTable";
import { NHOM_PHAN_TICH_OPTIONS } from "./lcMockOptions";
import { sttColumn } from "./lcColumnHelpers";

/**
 * Vùng "Phân tích" — LC_01_PhanTich_ThietKe_TP1_TP2.md mục 2.2 Vùng 5
 * (cỡ hạt sau nghiền 2, độ ẩm than phối trộn — nhiều lần đo mỗi ca).
 * Dạng dòng, khớp LC_KetQuaPhanTich (LC_03_Prompt_ThietKe_CSDL.md mục 3.3 #14):
 * NhomPhanTich, LanPhanTich, GiaTri, ThoiGianLayMau, ViTriLayMau.
 */

export interface PhanTichRow {
  key?: string | number;
  nhomPhanTich?: string | null;
  lanPhanTich?: string | number | null;
  giaTri?: string | number | null;
  thoiGianLayMau?: string | null;
  viTriLayMau?: string | null;
  ghiChu?: string | null;
}

interface TabPhanTichProps {
  editable: boolean;
  rows: PhanTichRow[];
  onChange: (rows: PhanTichRow[]) => void;
}

const TabPhanTich = ({ editable, rows, onChange }: TabPhanTichProps) => {
  const columns: FormColumnDef[] = useMemo(
    () => [
      sttColumn(),
      { title: "Chỉ tiêu phân tích", dataIndex: "nhomPhanTich", width: 220, options: NHOM_PHAN_TICH_OPTIONS },
      { title: "Lần phân tích", dataIndex: "lanPhanTich", width: 100, type: "number", align: "right" },
      { title: "Giá trị", dataIndex: "giaTri", width: 100, type: "float", align: "right" },
      { title: "Thời gian lấy mẫu", dataIndex: "thoiGianLayMau", width: 140 },
      { title: "Vị trí lấy mẫu", dataIndex: "viTriLayMau", width: 160 },
      { title: "Ghi chú", dataIndex: "ghiChu", width: 160 },
    ],
    []
  );

  return (
    <div>
      <Typography.Text type="secondary">
        TP1: nhập tay trực tiếp. TP2: lấy từ BKMIS (ghi "(BKM)" trên biểu mẫu gốc) — tạm nhập
        tay cho tới khi tích hợp (xem LC_02_Prompt_Vibecoding_V5.md mục 2.4).
      </Typography.Text>
      <CustomFormTable
        columns={columns}
        initialData={rows}
        onDataChange={(r) => onChange(r as PhanTichRow[])}
        addRowButtonText="+ Thêm dòng phân tích"
        showAddButton={editable}
        showDeleteButton={editable}
        editable={editable}
        minRows={0}
      />
    </div>
  );
};

export default TabPhanTich;
