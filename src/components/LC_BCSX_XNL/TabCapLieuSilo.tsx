import { useMemo } from "react";
import { Divider, Typography } from "antd";
import CustomFormTable, { type FormColumnDef } from "../CustomFormTable";
import type { ThanhPham } from "./lcTabsConfig";
import { buildSiloOptions } from "./lcMockOptions";
import { sttColumn } from "./lcColumnHelpers";

/**
 * Vùng "Cấp liệu & Silo" — lát cắt đầu tiên theo LC_02_Prompt_Vibecoding_V5.md mục 3
 * (Giai đoạn B, bước B2: engine + API + UI cho vùng này trước khi làm các vùng khác).
 *
 * 2 bảng con, tương ứng LC_03_Prompt_ThietKe_CSDL.md mục 3.3:
 * - Cấp liệu theo silo  -> LC_CapLieu   (1 silo có thể nhiều dòng/đợt cấp = nhiều Stt;
 *                          than cấp ngoài silo = để SiloId trống, chỉ chọn Vật liệu)
 * - Tồn silo            -> LC_TonSilo
 *
 * Các cột CALCULATED (KL khô, tồn cuối...) để readonly/trống — chưa có engine tính toán
 * (giai đoạn này chỉ làm UI, backend làm sau), hiển thị "—" theo quy ước NULL ở LC_02 mục 2.7/7.
 */

export interface CapLieuRow {
  key?: string | number;
  siloId?: number | string | null;
  vatLieuTen?: string | null;
  soHieuLo?: string | null;
  khoiLuongKeHoach?: string | number | null;
  khoiLuongAmThucTe?: string | number | null;
  doAm?: string | number | null;
  khoiLuongKhoThucTe?: string | number | null;
  ghiChu?: string | null;
}

export interface TonSiloRow {
  key?: string | number;
  siloId?: number | string | null;
  klTonDauQuyKho?: string | number | null;
  mucRadar?: string | number | null;
  amSilo?: string | number | null;
  doAmSilo?: string | number | null;
  klAmTonCuoi?: string | number | null;
  klTonCuoiQuyKho?: string | number | null;
  ghiChu?: string | null;
}

interface TabCapLieuSiloProps {
  thanhPham: ThanhPham | null | undefined;
  editable: boolean;
  capLieuRows: CapLieuRow[];
  onCapLieuChange: (rows: CapLieuRow[]) => void;
  tonSiloRows: TonSiloRow[];
  onTonSiloChange: (rows: TonSiloRow[]) => void;
}

const TabCapLieuSilo = ({
  thanhPham,
  editable,
  capLieuRows,
  onCapLieuChange,
  tonSiloRows,
  onTonSiloChange,
}: TabCapLieuSiloProps) => {
  const siloOptions = useMemo(() => buildSiloOptions(thanhPham), [thanhPham]);

  const capLieuColumns: FormColumnDef[] = useMemo(
    () => [
      sttColumn(),
      {
        title: "Silo",
        dataIndex: "siloId",
        width: 120,
        options: siloOptions,
      },
      { title: "Vật liệu / Than", dataIndex: "vatLieuTen", width: 180 },
      { title: "Số hiệu lô", dataIndex: "soHieuLo", width: 140 },
      {
        title: "Kế hoạch (tấn)",
        dataIndex: "khoiLuongKeHoach",
        width: 110,
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
      {
        title: "Độ ẩm (%)",
        dataIndex: "doAm",
        width: 90,
        type: "float",
        align: "right",
      },
      {
        title: "KL khô thực tế (tấn)",
        dataIndex: "khoiLuongKhoThucTe",
        width: 140,
        align: "right",
        readonly: true,
      },
      { title: "Ghi chú / vị trí bãi", dataIndex: "ghiChu", width: 160 },
    ],
    [siloOptions]
  );

  const tonSiloColumns: FormColumnDef[] = useMemo(
    () => [
      sttColumn(),
      {
        title: "Silo",
        dataIndex: "siloId",
        width: 120,
        options: siloOptions,
      },
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
        width: 120,
        type: "float",
        align: "right",
      },
      {
        title: "Âm silo (m)",
        dataIndex: "amSilo",
        width: 110,
        type: "float",
        align: "right",
      },
      {
        title: "Độ ẩm silo (%)",
        dataIndex: "doAmSilo",
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
    [siloOptions]
  );

  return (
    <div>
      <Typography.Text type="secondary">
        Các cột đánh dấu nền vàng (KL khô, tồn cuối...) là giá trị tính toán — sẽ được hệ
        thống tự tính khi có engine công thức ở backend; hiện để trống ("—").
      </Typography.Text>

      <Divider orientation="left" plain>
        Cấp liệu theo silo
      </Divider>
      <CustomFormTable
        columns={capLieuColumns}
        initialData={capLieuRows}
        onDataChange={(rows) => onCapLieuChange(rows as CapLieuRow[])}
        addRowButtonText="+ Thêm dòng cấp liệu"
        showAddButton={editable}
        showDeleteButton={editable}
        editable={editable}
        minRows={0}
      />

      <Divider orientation="left" plain>
        Tồn silo cuối kíp
      </Divider>
      <CustomFormTable
        columns={tonSiloColumns}
        initialData={tonSiloRows}
        onDataChange={(rows) => onTonSiloChange(rows as TonSiloRow[])}
        addRowButtonText="+ Thêm dòng tồn silo"
        showAddButton={editable}
        showDeleteButton={editable}
        editable={editable}
        minRows={0}
      />
    </div>
  );
};

export default TabCapLieuSilo;
