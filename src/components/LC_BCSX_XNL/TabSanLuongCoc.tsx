import { Fragment } from "react";
import { Divider, Typography } from "antd";
import { NumberCell } from "./LcExcelGridCells";
import type { ThanhPham } from "./lcTabsConfig";

/**
 * Vùng "Sản lượng cốc + Dập cốc" — TP1.xlsx dòng 218-234/264-267, TP2.xlsx dòng 178-191.
 * - Dập cốc: nhập tay Bánh cốc tiếp nhận + Khối lượng cốc trong ca theo từng vị trí (Tháp
 *   dập/CDQ), danh mục cố định theo Scope (LC_TP_ViTriDapCoc, N vị trí mỗi cụm sản xuất).
 * - Cốc chuyển qua X.NL,TP2 (CHỈ TP1): Tồn đầu/Tồn cuối 2 nhà sàng, dùng để tính Sản lượng
 *   cốc (xem backend LC_SanLuongCocRepository).
 * - Sản lượng cốc: CALCULATED hoàn toàn ở backend (cân bằng khối lượng từ Dập cốc + Cốc tồn
 *   silo + Cấp cốc + Cốc chuyển) — tab này CHỈ hiển thị, không có ô nhập.
 *
 * LƯU Ý (xem .claude/state/LuyenCoc.md): việc tách Sản lượng cốc theo 2 cụm sản xuất phụ
 * thuộc trường "Cụm sản xuất" gắn trên danh mục Silo tồn/Nơi nhận Cấp cốc (mặc định NULL =
 * dùng chung 2 cụm) — số liệu theo cụm (cột theo từng cụm dưới đây) chỉ đúng SAU KHI người
 * quản trị gán đúng cụm cho từng silo/nơi nhận; Tổng trong ca/Tổng lũy kế không phụ thuộc
 * việc gán này.
 */

export interface DapCocRow {
  key?: string | number;
  idViTri?: number | null;
  idCumSanXuat?: number | null;
  cumSanXuatTen?: string | null;
  loai?: string | null; // 'THAP_DAP' | 'CDQ'
  ten?: string | null;
  banhCocTiepNhan?: string | number | null;
  luyKeBanhCocTiepNhan?: string | number | null;
  khoiLuongCocTrongCa?: string | number | null;
  luyKeKhoiLuongCocTrongCa?: string | number | null;
}

export interface CocChuyenNhaSangRow {
  key?: string | number;
  nhaSang?: string | null; // 'NS2' | 'NS3'
  tonCuoi?: string | number | null;
  tonDau?: string | number | null;
  luyKe?: string | number | null;
}

export interface SanLuongCocCumCell {
  idCumSanXuat?: number | null;
  cumSanXuatTen?: string | null;
  trongCa?: string | number | null;
  luyKe?: string | number | null;
}

export interface SanLuongCocRow {
  loaiCoc?: string | null;
  tongTrongCa?: string | number | null;
  luyKeTong?: string | number | null;
  theoCum?: SanLuongCocCumCell[];
}

interface TabSanLuongCocProps {
  thanhPham: ThanhPham | null | undefined;
  editable: boolean;
  dapCoc: DapCocRow[];
  onDapCocChange: (rows: DapCocRow[]) => void;
  cocChuyenNhaSang: CocChuyenNhaSangRow[];
  onCocChuyenNhaSangChange: (rows: CocChuyenNhaSangRow[]) => void;
  sanLuong: SanLuongCocRow[];
}

const NHA_SANG_TEN: Record<string, string> = { NS2: "Nhà sàng 2", NS3: "Nhà sàng 3" };

const fmt = (v: string | number | null | undefined) => {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 3 }) : String(v);
};

const toNumOrNull = (v: string | number | null | undefined): number | null =>
  v === null || v === undefined || v === "" ? null : Number(v);

const th = "border border-gray-300 px-2 py-1 text-center font-medium text-gray-700";
const td = "border border-gray-300 px-2 py-1";

const TabSanLuongCoc = ({
  thanhPham,
  editable,
  dapCoc,
  onDapCocChange,
  cocChuyenNhaSang,
  onCocChuyenNhaSangChange,
  sanLuong,
}: TabSanLuongCocProps) => {
  const isTP1 = thanhPham === "TP1";

  const patchDapCoc = (idViTri: number, patch: Partial<DapCocRow>) =>
    onDapCocChange(dapCoc.map((r) => (r.idViTri === idViTri ? { ...r, ...patch } : r)));

  const patchChuyen = (nhaSang: string, patch: Partial<CocChuyenNhaSangRow>) =>
    onCocChuyenNhaSangChange(
      cocChuyenNhaSang.map((r) => (r.nhaSang === nhaSang ? { ...r, ...patch } : r))
    );

  // Nhóm liên tiếp theo Cụm sản xuất để rowSpan cột Cụm (danh mục đã trả về đúng thứ tự).
  const cumSpans: { start: number; len: number }[] = [];
  dapCoc.forEach((r, i) => {
    if (i > 0 && dapCoc[i - 1].idCumSanXuat === r.idCumSanXuat) {
      cumSpans[cumSpans.length - 1].len += 1;
    } else {
      cumSpans.push({ start: i, len: 1 });
    }
  });
  const spanStartByIndex = new Map(cumSpans.map((s) => [s.start, s.len]));

  const cumColumns = sanLuong[0]?.theoCum ?? [];
  const tongTatCaTrongCa = sanLuong.reduce((acc, r) => acc + (Number(r.tongTrongCa) || 0), 0);
  const tongTatCaLuyKe = sanLuong.reduce((acc, r) => acc + (Number(r.luyKeTong) || 0), 0);

  return (
    <div>
      <Divider orientation="left" plain>
        Dập cốc
      </Divider>
      <div className="overflow-x-auto">
        <table className="border-collapse text-xs" style={{ minWidth: 760 }}>
          <thead>
            <tr className="bg-gray-50">
              <th style={{ width: 130 }} className={th}>Cụm sản xuất</th>
              <th style={{ width: 100 }} className={th}>Hạng mục</th>
              <th style={{ width: 130 }} className={th}>Vị trí</th>
              <th style={{ width: 150 }} className={th}>Bánh cốc tiếp nhận, (tấn)</th>
              <th style={{ width: 130 }} className={th}>Lũy kế, (tấn)</th>
              <th style={{ width: 160 }} className={th}>Khối lượng cốc trong ca, (tấn)</th>
              <th style={{ width: 130 }} className={th}>Lũy kế, (tấn)</th>
            </tr>
          </thead>
          <tbody>
            {dapCoc.map((row, i) => {
              const span = spanStartByIndex.get(i);
              return (
                <tr key={row.key ?? row.idViTri} className="hover:bg-blue-50/50">
                  {span && (
                    <td className={`${td} text-center font-medium`} rowSpan={span}>
                      {row.cumSanXuatTen}
                    </td>
                  )}
                  <td className={`${td} text-center`}>{row.loai === "CDQ" ? "CDQ" : "Tháp dập"}</td>
                  <td className={`${td} text-center`}>{row.ten}</td>
                  <td className="border border-gray-300 p-0">
                    <NumberCell
                      value={toNumOrNull(row.banhCocTiepNhan)}
                      disabled={!editable}
                      onCommit={(v) => row.idViTri != null && patchDapCoc(row.idViTri, { banhCocTiepNhan: v })}
                    />
                  </td>
                  <td className={`${td} text-right`}>{fmt(row.luyKeBanhCocTiepNhan)}</td>
                  <td className="border border-gray-300 p-0">
                    <NumberCell
                      value={toNumOrNull(row.khoiLuongCocTrongCa)}
                      disabled={!editable}
                      onCommit={(v) => row.idViTri != null && patchDapCoc(row.idViTri, { khoiLuongCocTrongCa: v })}
                    />
                  </td>
                  <td className={`${td} text-right`}>{fmt(row.luyKeKhoiLuongCocTrongCa)}</td>
                </tr>
              );
            })}
            {dapCoc.length === 0 && (
              <tr>
                <td colSpan={7} className={`${td} text-center text-gray-400`}>
                  Chưa có danh mục vị trí dập
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isTP1 && (
        <>
          <Divider orientation="left" plain>
            Cốc chuyển qua bên X.NL,TP2
          </Divider>
          <div className="overflow-x-auto">
            <table className="border-collapse text-xs" style={{ width: 620 }}>
              <thead>
                <tr className="bg-gray-50">
                  <th style={{ width: 120 }} className={th}>Nhà sàng</th>
                  <th style={{ width: 130 }} className={th}>Tồn đầu, (tấn)</th>
                  <th style={{ width: 130 }} className={th}>Tồn cuối, (tấn)</th>
                  <th style={{ width: 130 }} className={th}>Chênh lệch, (tấn)</th>
                  <th style={{ width: 110 }} className={th}>Lũy kế, (tấn)</th>
                </tr>
              </thead>
              <tbody>
                {cocChuyenNhaSang.map((row) => {
                  const chenhLech =
                    row.tonCuoi == null && row.tonDau == null
                      ? null
                      : (Number(row.tonCuoi) || 0) - (Number(row.tonDau) || 0);
                  return (
                    <tr key={row.key ?? row.nhaSang} className="hover:bg-blue-50/50">
                      <td className={`${td} text-center`}>
                        {NHA_SANG_TEN[row.nhaSang ?? ""] ?? row.nhaSang}
                      </td>
                      <td className="border border-gray-300 p-0">
                        <NumberCell
                          value={toNumOrNull(row.tonDau)}
                          disabled={!editable}
                          onCommit={(v) => row.nhaSang && patchChuyen(row.nhaSang, { tonDau: v })}
                        />
                      </td>
                      <td className="border border-gray-300 p-0">
                        <NumberCell
                          value={toNumOrNull(row.tonCuoi)}
                          disabled={!editable}
                          onCommit={(v) => row.nhaSang && patchChuyen(row.nhaSang, { tonCuoi: v })}
                        />
                      </td>
                      <td className={`${td} text-right`}>{fmt(chenhLech)}</td>
                      <td className={`${td} text-right`}>{fmt(row.luyKe)}</td>
                    </tr>
                  );
                })}
                {cocChuyenNhaSang.length === 0 && (
                  <tr>
                    <td colSpan={5} className={`${td} text-center text-gray-400`}>
                      Chưa có dữ liệu
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Divider orientation="left" plain>
        Sản lượng cốc
      </Divider>
      <Typography.Text type="secondary">
        Tính tự động từ Dập cốc + Cốc tồn silo + Cấp cốc{isTP1 ? " + Cốc chuyển qua X.NL,TP2" : ""} —
        không nhập tay. Số liệu theo từng cụm chỉ đúng sau khi gán "Cụm sản xuất" cho silo/nơi nhận
        liên quan (trang quản lý Silo tồn / Nơi nhận Cấp cốc).
      </Typography.Text>
      <div className="overflow-x-auto" style={{ marginTop: 12 }}>
        <table className="border-collapse text-xs" style={{ minWidth: 640 }}>
          <thead>
            <tr className="bg-gray-50">
              <th style={{ width: 120 }} className={th}>Loại cốc</th>
              <th style={{ width: 130 }} className={th}>Tổng trong ca, (tấn)</th>
              <th style={{ width: 130 }} className={th}>Tổng lũy kế, (tấn)</th>
              {cumColumns.map((c) => (
                <th key={c.idCumSanXuat} style={{ width: 120 }} className={th} colSpan={2}>
                  {c.cumSanXuatTen}
                </th>
              ))}
            </tr>
            {cumColumns.length > 0 && (
              <tr className="bg-gray-50">
                <th className={th} colSpan={3} />
                {cumColumns.map((c) => (
                  <Fragment key={c.idCumSanXuat}>
                    <th className={th}>Trong ca</th>
                    <th className={th}>Lũy kế</th>
                  </Fragment>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {sanLuong.map((row) => (
              <tr key={row.loaiCoc} className="hover:bg-blue-50/50">
                <td className={`${td} text-center`}>{row.loaiCoc}</td>
                <td className={`${td} text-right`}>{fmt(row.tongTrongCa)}</td>
                <td className={`${td} text-right`}>{fmt(row.luyKeTong)}</td>
                {(row.theoCum ?? []).map((c) => (
                  <Fragment key={c.idCumSanXuat}>
                    <td className={`${td} text-right`}>{fmt(c.trongCa)}</td>
                    <td className={`${td} text-right`}>{fmt(c.luyKe)}</td>
                  </Fragment>
                ))}
              </tr>
            ))}
            {sanLuong.length > 0 && (
              <tr className="bg-gray-50 font-semibold">
                <td className={`${td} text-center`}>Tổng</td>
                <td className={`${td} text-right`}>{fmt(tongTatCaTrongCa)}</td>
                <td className={`${td} text-right`}>{fmt(tongTatCaLuyKe)}</td>
                <td className={td} colSpan={cumColumns.length * 2} />
              </tr>
            )}
            {sanLuong.length === 0 && (
              <tr>
                <td colSpan={3 + cumColumns.length * 2} className={`${td} text-center text-gray-400`}>
                  Chưa có dữ liệu
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TabSanLuongCoc;
