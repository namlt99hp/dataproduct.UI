import { useEffect, useMemo, useState } from "react";
import { Empty, InputNumber, Spin, Table, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { LcTieuHaoApi, type DanhMucTieuHaoDto } from "../../services/LcTieuHaoApi";

/**
 * Vùng "Tiêu hao" — mỗi hạng mục trong danh mục (LC_TP_DanhMucTieuHao) là 1 dòng cố định,
 * gom thành từng bảng theo "Nhóm". Mỗi dòng nhập: chỉ số đầu ca, cuối ca, trong ca, tổng
 * nhà máy, lũy kế và tiêu hao trên tấn (khớp bảng LC_TP_TieuHao).
 *
 * Quy ước khoá: key = `hm-${hangMucId}`. Dữ liệu lưu vào bảng quan hệ riêng (LcTieuHaoApi),
 * không qua DataJson của phiếu.
 */

export interface TieuHaoRow {
  key?: string | number;
  hangMucId: number;
  chiSoDauCa?: string | number | null;
  chiSoCuoiCa?: string | number | null;
  trongCa?: string | number | null;
  tongNhaMay?: string | number | null;
  luyKe?: string | number | null;
  tieuHaoTrenTan?: string | number | null;
}

interface TabTieuHaoProps {
  editable: boolean;
  rows: TieuHaoRow[];
  onChange: (rows: TieuHaoRow[]) => void;
}

const NHOM_KHAC = "Khác";

const fmt = (v: string | number | null | undefined) => {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 4 }) : String(v);
};

const toNumOrNull = (v: string | number | null | undefined): number | null =>
  v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null;

type NumField = "chiSoDauCa" | "chiSoCuoiCa" | "trongCa" | "tongNhaMay" | "luyKe" | "tieuHaoTrenTan";

const TabTieuHao = ({ editable, rows, onChange }: TabTieuHaoProps) => {
  const [danhMuc, setDanhMuc] = useState<DanhMucTieuHaoDto[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    LcTieuHaoApi.getDanhMuc()
      .then((list) => !cancelled && setDanhMuc(list))
      .catch(() => message.error("Không tải được danh mục hạng mục tiêu hao"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Bổ sung dòng còn thiếu cho mỗi hạng mục khi danh mục tải xong (hoặc khi phiếu nạp lại
  // dữ liệu đã lưu — chỉ có các hạng mục đã nhập số liệu).
  useEffect(() => {
    if (!danhMuc.length) return;
    const missing = danhMuc.filter((d) => !rows.some((r) => r.hangMucId === d.id));
    if (missing.length) {
      onChange([...rows, ...missing.map((d) => ({ key: `hm-${d.id}`, hangMucId: d.id }))]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [danhMuc, rows]);

  const patchRow = (hangMucId: number, patch: Partial<TieuHaoRow>) =>
    onChange(rows.map((r) => (r.hangMucId === hangMucId ? { ...r, ...patch } : r)));

  // Sửa đầu ca / cuối ca thì gợi ý luôn "Trong ca" = cuối - đầu (vẫn sửa tay được).
  const onChiSoChange = (row: TieuHaoRow, field: "chiSoDauCa" | "chiSoCuoiCa", val: number | null) => {
    const next = { ...row, [field]: val };
    const dau = toNumOrNull(next.chiSoDauCa);
    const cuoi = toNumOrNull(next.chiSoCuoiCa);
    const patch: Partial<TieuHaoRow> = { [field]: val };
    if (dau !== null && cuoi !== null) patch.trongCa = Number((cuoi - dau).toFixed(2));
    patchRow(row.hangMucId, patch);
  };

  const nhomList = useMemo(() => {
    // Gom theo NhomId (thứ tự nhóm theo Id, nhóm "Khác" cuối cùng); tên nhóm lấy từ LC_TP_NhomTieuHao
    const groups = new Map<number | null, { ten: string; items: DanhMucTieuHaoDto[] }>();
    danhMuc.forEach((d) => {
      const id = d.nhomId ?? null;
      const g = groups.get(id) ?? { ten: d.tenNhom?.trim() || NHOM_KHAC, items: [] };
      g.items.push(d);
      groups.set(id, g);
    });
    return Array.from(groups.entries())
      .sort(([a], [b]) => (a ?? Infinity) - (b ?? Infinity))
      .map(([id, g]) => [String(id ?? "none"), g.ten, g.items] as const);
  }, [danhMuc]);

  const rowByHangMuc = useMemo(() => new Map(rows.map((r) => [r.hangMucId, r])), [rows]);

  const numberCell = (field: NumField, step: number, onValue?: (row: TieuHaoRow, v: number | null) => void) =>
    (_: unknown, hm: DanhMucTieuHaoDto) => {
      const row = rowByHangMuc.get(hm.id);
      if (!row) return null;
      if (!editable) return fmt(row[field]);
      return (
        <InputNumber
          size="small"
          step={step}
          value={toNumOrNull(row[field])}
          onChange={(val) => (onValue ? onValue(row, val) : patchRow(hm.id, { [field]: val }))}
          style={{ width: "100%" }}
        />
      );
    };

  const columns: ColumnsType<DanhMucTieuHaoDto> = [
    {
      title: "Hạng mục",
      dataIndex: "ten",
      width: 220,
      render: (v: string, hm) => (
        <>
          {v}
          {hm.donVi ? <Typography.Text type="secondary"> ({hm.donVi})</Typography.Text> : null}
        </>
      ),
    },
    {
      title: "Chỉ số đầu ca",
      width: 130,
      align: "right",
      render: numberCell("chiSoDauCa", 0.01, (row, v) => onChiSoChange(row, "chiSoDauCa", v)),
    },
    {
      title: "Chỉ số cuối ca",
      width: 130,
      align: "right",
      render: numberCell("chiSoCuoiCa", 0.01, (row, v) => onChiSoChange(row, "chiSoCuoiCa", v)),
    },
    { title: "Trong ca", width: 130, align: "right", render: numberCell("trongCa", 0.01) },
    { title: "Tổng nhà máy", width: 130, align: "right", render: numberCell("tongNhaMay", 0.01) },
    { title: "Lũy kế", width: 130, align: "right", render: numberCell("luyKe", 0.01) },
    {
      title: "Tiêu hao trên tấn",
      width: 170,
      align: "right",
      render: (_: unknown, hm) => (
        <>
          {numberCell("tieuHaoTrenTan", 0.0001)(_, hm)}
          {hm.donViTieuHao ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {hm.donViTieuHao}
            </Typography.Text>
          ) : null}
        </>
      ),
    },
  ];

  if (loading && !danhMuc.length) return <Spin />;
  if (!danhMuc.length) {
    return <Empty description="Chưa có danh mục hạng mục tiêu hao" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <>
      {nhomList.map(([nhomKey, nhom, items], index) => (
        <div key={nhomKey} style={{ marginBottom: 20 }}>
          <Typography.Text strong style={{ display: "block", padding: "4px 0" }}>
            {index + 1}. {nhom}
          </Typography.Text>
          <Table<DanhMucTieuHaoDto>
            size="small"
            bordered
            pagination={false}
            rowKey="id"
            columns={columns}
            dataSource={items}
            scroll={{ x: "max-content" }}
          />
        </div>
      ))}
    </>
  );
};

export default TabTieuHao;
