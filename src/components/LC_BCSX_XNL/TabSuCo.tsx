import { useMemo } from "react";
import { DatePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import CustomFormTable, { type FormColumnDef } from "../CustomFormTable";
import { sttColumn } from "./lcColumnHelpers";

/**
 * Vùng "Sự cố" — mỗi dòng là một sự cố xảy ra trong ca: tình trạng, thời gian phát hiện,
 * cách khắc phục, thời gian bắt đầu/kết thúc khắc phục và nhân lực tham gia.
 * Khớp bảng LC_TP_SuCoTrongCa (Stt theo thứ tự dòng; các cột thời gian là DATETIME2(0)).
 */

const DATETIME_VALUE_FORMAT = "YYYY-MM-DDTHH:mm:ss";
const DATETIME_DISPLAY_FORMAT = "DD/MM/YYYY HH:mm";

/** Giá trị cũ dạng chữ tự do không parse được thì coi như chưa nhập */
const parseDateTime = (v: string | null | undefined): Dayjs | null => {
  if (!v) return null;
  const d = dayjs(v);
  return d.isValid() ? d : null;
};

export interface SuCoRow {
  key?: string | number;
  tinhTrangSuCo?: string | null;
  thoiGianPhatHien?: string | null;
  cachKhacPhuc?: string | null;
  thoiGianBatDau?: string | null;
  thoiGianKetThuc?: string | null;
  nhanLuc?: string | null;
}

interface TabSuCoProps {
  editable: boolean;
  rows: SuCoRow[];
  onChange: (rows: SuCoRow[]) => void;
}

const dateTimeColumn = (
  title: string,
  dataIndex: keyof SuCoRow,
  width: number
): FormColumnDef => ({
  title,
  dataIndex,
  width,
  renderCell: (record: SuCoRow, _idx, onChange, disabled) => {
    const value = parseDateTime(record[dataIndex] as string | null | undefined);
    // Thời gian kết thúc không được trước thời gian bắt đầu
    const start = parseDateTime(record.thoiGianBatDau);
    const invalid = dataIndex === "thoiGianKetThuc" && !!value && !!start && value.isBefore(start);
    return (
      <DatePicker
        showTime={{ format: "HH:mm" }}
        format={DATETIME_DISPLAY_FORMAT}
        value={value}
        disabled={disabled}
        status={invalid ? "error" : undefined}
        placeholder={title}
        style={{ width: "100%" }}
        onChange={(d) => onChange(d ? d.format(DATETIME_VALUE_FORMAT) : null)}
      />
    );
  },
});

const TabSuCo = ({ editable, rows, onChange }: TabSuCoProps) => {
  const columns: FormColumnDef[] = useMemo(
    () => [
      sttColumn(),
      { title: "Tình trạng sự cố", dataIndex: "tinhTrangSuCo", width: 260 },
      dateTimeColumn("Thời gian phát hiện sự cố", "thoiGianPhatHien", 190),
      { title: "Cách khắc phục", dataIndex: "cachKhacPhuc", width: 260 },
      dateTimeColumn("Thời gian bắt đầu", "thoiGianBatDau", 190),
      dateTimeColumn("Thời gian kết thúc", "thoiGianKetThuc", 190),
      { title: "Nhân lực", dataIndex: "nhanLuc", width: 160 },
    ],
    []
  );

  return (
    <CustomFormTable
      columns={columns}
      initialData={rows}
      onDataChange={(r) => onChange(r as SuCoRow[])}
      addRowButtonText="+ Thêm sự cố"
      showAddButton={editable}
      showDeleteButton={editable}
      editable={editable}
      minRows={0}
    />
  );
};

export default TabSuCo;
