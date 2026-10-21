import { useEffect, useMemo, useState } from "react";
import { Empty, InputNumber, Spin, Table, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { thanhPhamToScope, type ThanhPham } from "./lcTabsConfig";
import { lcThapThanApi, type NhomThapThanDto, type PheuDto } from "../../services/LCThapThanApi";

/**
 * Vùng "Tháp / Phễu" — render theo nhóm tháp than (danh mục từ backend), mỗi nhóm 1 bảng:
 * các phễu của nhóm + cột gộp ô theo tháp (độ ẩm, than cấp lên tháp, than nạp lò) + dòng Tổng.
 * - Phễu  -> LC_TonPheu (#12)
 * - Tháp  -> LC_CapThap (#13) — "Than nạp lò" chưa rõ nguồn (OQ-06, LC_01 mục 7), tạm nhập tay.
 *
 * Quy ước khoá: cumThapMa = String(nhom.id); pheuMa = String(pheu.id).
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

const fmt = (v: string | number | null | undefined) => {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 3 }) : String(v);
};

const sum = (rows: PheuRow[], field: keyof PheuRow) =>
  rows.reduce((acc, r) => acc + (Number(r[field]) || 0), 0);

const TabThapPheu = ({ thanhPham, editable, pheuRows, onPheuChange, thapRows, onThapChange }: TabThapPheuProps) => {
  const [nhomList, setNhomList] = useState<NhomThapThanDto[]>([]);
  const [pheuList, setPheuList] = useState<PheuDto[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const scope = thanhPhamToScope(thanhPham);
    Promise.all([lcThapThanApi.getNhom(scope), lcThapThanApi.getPheu(undefined, undefined, scope)])
      .then(([nhom, pheu]) => {
        if (cancelled) return;
        setNhomList(nhom);
        setPheuList(pheu);
      })
      .catch(() => message.error("Không tải được danh mục tháp than / phễu"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [thanhPham]);

  // Bổ sung dòng còn thiếu cho mỗi phễu / mỗi nhóm tháp than khi danh mục tải xong
  useEffect(() => {
    if (!nhomList.length) return;

    const missingPheu = pheuList.filter(
      (p) => !pheuRows.some((r) => r.pheuMa === String(p.id) && r.cumThapMa === String(p.thapThanId))
    );
    if (missingPheu.length) {
      onPheuChange([
        ...pheuRows,
        ...missingPheu.map((p) => ({
          key: `pheu-${p.id}`,
          cumThapMa: String(p.thapThanId),
          pheuMa: String(p.id),
        })),
      ]);
    }

    const missingThap = nhomList.filter((n) => !thapRows.some((r) => r.cumThapMa === String(n.id)));
    if (missingThap.length) {
      onThapChange([
        ...thapRows,
        ...missingThap.map((n) => ({ key: `thap-${n.id}`, cumThapMa: String(n.id) })),
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nhomList, pheuList]);

  const patchPheu = (pheuId: number, patch: Partial<PheuRow>) =>
    onPheuChange(pheuRows.map((r) => (r.pheuMa === String(pheuId) ? { ...r, ...patch } : r)));

  const patchThap = (nhomId: number, patch: Partial<ThapRow>) =>
    onThapChange(thapRows.map((r) => (r.cumThapMa === String(nhomId) ? { ...r, ...patch } : r)));

  const pheuNameById = useMemo(
    () => new Map(pheuList.map((p) => [String(p.id), p.tenPheu ?? `Phễu ${p.id}`])),
    [pheuList]
  );

  const renderNhom = (nhom: NhomThapThanDto, index: number) => {
    const rows = pheuRows.filter((r) => r.cumThapMa === String(nhom.id));
    const thap = thapRows.find((r) => r.cumThapMa === String(nhom.id));

    // Ô gộp theo tháp: dòng đầu rowSpan = số phễu, các dòng còn lại ẩn
    const spanFirst = (rowIndex: number) => ({ rowSpan: rowIndex === 0 ? rows.length : 0 });

    const columns: ColumnsType<PheuRow> = [
      {
        title: "Phễu tháp than",
        dataIndex: "pheuMa",
        width: 120,
        align: "center",
        render: (v: string) => pheuNameById.get(v) ?? v,
      },
      {
        title: "Khối lượng tồn đầu kíp quy khô, (tấn)",
        dataIndex: "klTonDauQuyKho",
        width: 170,
        align: "right",
        render: fmt,
      },
      {
        title: "Mức liệu phễu cuối kíp, (m)",
        dataIndex: "mucRadar",
        width: 150,
        align: "right",
        render: (v, row) =>
          editable ? (
            <InputNumber
              size="small"
              min={0}
              step={0.01}
              value={v === null || v === undefined || v === "" ? null : Number(v)}
              onChange={(val) => patchPheu(Number(row.pheuMa), { mucRadar: val })}
              style={{ width: "100%" }}
            />
          ) : (
            fmt(v)
          ),
      },
      {
        title: "Khối lượng ẩm tồn cuối kíp, (tấn)",
        dataIndex: "klAmTonCuoi",
        width: 170,
        align: "right",
        render: fmt,
      },
      {
        title: "Độ ẩm tháp than cuối kíp, (W%)",
        width: 150,
        align: "center",
        onCell: (_, i) => spanFirst(i ?? 0),
        render: () =>
          editable ? (
            <InputNumber
              size="small"
              min={0}
              max={100}
              step={0.01}
              value={thap?.doAmThap === null || thap?.doAmThap === undefined || thap?.doAmThap === "" ? null : Number(thap.doAmThap)}
              onChange={(val) => patchThap(nhom.id, { doAmThap: val })}
              style={{ width: "100%" }}
            />
          ) : (
            fmt(thap?.doAmThap)
          ),
      },
      {
        title: "Khối lượng tồn cuối kíp quy khô, (tấn)",
        dataIndex: "klTonCuoiQuyKho",
        width: 180,
        align: "right",
        render: fmt,
      },
      {
        title: "Khối lượng than cấp lên tháp quy khô theo cân 2A, (tấn)",
        width: 200,
        align: "center",
        onCell: (_, i) => spanFirst(i ?? 0),
        render: () => fmt(thap?.capLenThapQuyKho),
      },
      {
        title: "Lũy kế than cấp lên tháp, (tấn)",
        width: 160,
        align: "center",
        onCell: (_, i) => spanFirst(i ?? 0),
        render: () => fmt(thap?.luyKeCapLenThap),
      },
      {
        title: "Khối lượng than nạp lò quy khô, (tấn)",
        width: 180,
        align: "center",
        onCell: (_, i) => spanFirst(i ?? 0),
        render: () =>
          editable ? (
            <InputNumber
              size="small"
              min={0}
              step={0.001}
              value={thap?.napLoQuyKho === null || thap?.napLoQuyKho === undefined || thap?.napLoQuyKho === "" ? null : Number(thap.napLoQuyKho)}
              onChange={(val) => patchThap(nhom.id, { napLoQuyKho: val })}
              style={{ width: "100%" }}
            />
          ) : (
            fmt(thap?.napLoQuyKho)
          ),
      },
      {
        title: "Lũy kế than nạp lò, (tấn)",
        width: 150,
        align: "center",
        onCell: (_, i) => spanFirst(i ?? 0),
        render: () => fmt(thap?.luyKeNapLo),
      },
    ];

    return (
      <div key={nhom.id} style={{ marginBottom: 20 }}>
        <Typography.Text strong style={{ display: "block", padding: "4px 0" }}>
          {index + 1}. {nhom.ten}
        </Typography.Text>
        <Table<PheuRow>
          size="small"
          bordered
          pagination={false}
          rowKey={(r) => String(r.key ?? `${r.cumThapMa}-${r.pheuMa}`)}
          columns={columns}
          dataSource={rows}
          scroll={{ x: "max-content" }}
          locale={{ emptyText: <Empty description="Nhóm tháp than chưa có phễu" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          summary={() =>
            rows.length ? (
              <Table.Summary.Row style={{ fontWeight: 600 }}>
                <Table.Summary.Cell index={0} align="center">
                  Tổng
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  {fmt(sum(rows, "klTonDauQuyKho"))}
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} />
                <Table.Summary.Cell index={3} align="right">
                  {fmt(sum(rows, "klAmTonCuoi"))}
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4} />
                <Table.Summary.Cell index={5} align="right">
                  {fmt(sum(rows, "klTonCuoiQuyKho"))}
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6} colSpan={4} />
              </Table.Summary.Row>
            ) : null
          }
        />
      </div>
    );
  };

  return (
    <div>
      <Typography.Text type="secondary">
        "Than cấp lên tháp" tổng hợp từ vùng Phối trộn (cross-region) — tính tự động sau khi có engine ở
        backend. "Than nạp lò" tạm nhập tay vì nguồn dữ liệu chưa xác nhận (xem OQ-06, LC_01 mục 7).
      </Typography.Text>

      <Spin spinning={loading}>
        <div style={{ marginTop: 12 }}>
          {nhomList.length === 0 && !loading ? (
            <Empty description="Chưa có nhóm tháp than nào" />
          ) : (
            nhomList.map(renderNhom)
          )}
        </div>
      </Spin>
    </div>
  );
};

export default TabThapPheu;
