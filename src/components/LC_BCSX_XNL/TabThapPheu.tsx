import { useMemo } from "react";
import { Divider, Typography } from "antd";
import CustomFormTable, { type FormColumnDef } from "../CustomFormTable";
import type { ThanhPham } from "./lcTabsConfig";
import { buildCumThapOptions } from "./lcMockOptions";
import { sttColumn } from "./lcColumnHelpers";

/**
 * Vùng "Tháp / Phễu" — LC_01_PhanTich_ThietKe_TP1_TP2.md mục 2.2 Vùng 4.
 * 2 bảng, tương ứng LC_03_Prompt_ThietKe_CSDL.md mục 3.3:
 * - Phễu  -> LC_TonPheu (#12)
 * - Tháp  -> LC_CapThap (#13) — "Than nạp lò" chưa rõ nguồn (OQ-06, LC_01 mục 7), tạm nhập tay.
 */

export interface PheuRow {
  key?: string | number;
  cumThapMa?: string | null;
  pheuMa?: string | null;
  klTonDauQuyKho?: string | number | null;
  mucRadar?: string | number | null;
  klAmTonCuoi?: string | number | null;
  klTonCuoiQuyKho?: string | number | null;
  ghiChu?: string | null;
}

export interface ThapRow {
  key?: string | number;
  cumThapMa?: string | null;
  doAmThap?: string | number | null;
  capLenThapQuyKho?: string | number | null;
  luyKeCapLenThap?: string | number | null;
  napLoQuyKho?: string | number | null;
  luyKeNapLo?: string | number | null;
  ghiChu?: string | null;
}

interface TabThapPheuProps {
  thanhPham: ThanhPham | null | undefined;
  editable: boolean;
  pheuRows: PheuRow[];
  onPheuChange: (rows: PheuRow[]) => void;
  thapRows: ThapRow[];
  onThapChange: (rows: ThapRow[]) => void;
}

const TabThapPheu = ({
  thanhPham,
  editable,
  pheuRows,
  onPheuChange,
  thapRows,
  onThapChange,
}: TabThapPheuProps) => {
  const cumThapOptions = useMemo(() => buildCumThapOptions(thanhPham), [thanhPham]);

  const pheuColumns: FormColumnDef[] = useMemo(
    () => [
      sttColumn(),
      { title: "Tháp", dataIndex: "cumThapMa", width: 100, options: cumThapOptions },
      { title: "Phễu", dataIndex: "pheuMa", width: 100 },
      {
        title: "Tồn đầu kíp quy khô (tấn)",
        dataIndex: "klTonDauQuyKho",
        width: 160,
        align: "right",
        readonly: true,
      },
      {
        title: "Mức đo radar (m)",
        dataIndex: "mucRadar",
        width: 110,
        type: "float",
        align: "right",
      },
      {
        title: "KL ẩm tồn cuối (tấn)",
        dataIndex: "klAmTonCuoi",
        width: 140,
        align: "right",
        readonly: true,
      },
      {
        title: "KL khô tồn cuối (tấn)",
        dataIndex: "klTonCuoiQuyKho",
        width: 140,
        align: "right",
        readonly: true,
      },
      { title: "Ghi chú", dataIndex: "ghiChu", width: 160 },
    ],
    [cumThapOptions]
  );

  const thapColumns: FormColumnDef[] = useMemo(
    () => [
      sttColumn(),
      { title: "Tháp", dataIndex: "cumThapMa", width: 100, options: cumThapOptions },
      {
        title: "Độ ẩm tháp (%)",
        dataIndex: "doAmThap",
        width: 110,
        type: "float",
        align: "right",
      },
      {
        title: "Than cấp lên tháp quy khô (tấn)",
        dataIndex: "capLenThapQuyKho",
        width: 180,
        align: "right",
        readonly: true,
      },
      {
        title: "Lũy kế cấp lên tháp (tấn)",
        dataIndex: "luyKeCapLenThap",
        width: 160,
        align: "right",
        readonly: true,
      },
      {
        title: "Than nạp lò quy khô (tấn)",
        dataIndex: "napLoQuyKho",
        width: 160,
        type: "float",
        align: "right",
      },
      {
        title: "Lũy kế nạp lò (tấn)",
        dataIndex: "luyKeNapLo",
        width: 140,
        align: "right",
        readonly: true,
      },
      { title: "Ghi chú", dataIndex: "ghiChu", width: 160 },
    ],
    [cumThapOptions]
  );

  return (
    <div>
      <Typography.Text type="secondary">
        "Than cấp lên tháp" tổng hợp từ vùng Phối trộn (cross-region) — tính tự động sau khi
        có engine ở backend. "Than nạp lò" tạm nhập tay vì nguồn dữ liệu chưa xác nhận (xem
        OQ-06, LC_01 mục 7).
      </Typography.Text>

      <Divider orientation="left" plain>
        Phễu
      </Divider>
      <CustomFormTable
        columns={pheuColumns}
        initialData={pheuRows}
        onDataChange={(r) => onPheuChange(r as PheuRow[])}
        addRowButtonText="+ Thêm dòng phễu"
        showAddButton={editable}
        showDeleteButton={editable}
        editable={editable}
        minRows={0}
      />

      <Divider orientation="left" plain>
        Tháp
      </Divider>
      <CustomFormTable
        columns={thapColumns}
        initialData={thapRows}
        onDataChange={(r) => onThapChange(r as ThapRow[])}
        addRowButtonText="+ Thêm dòng tháp"
        showAddButton={editable}
        showDeleteButton={editable}
        editable={editable}
        minRows={0}
      />
    </div>
  );
};

export default TabThapPheu;
