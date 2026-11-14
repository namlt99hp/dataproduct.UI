import { Fragment, useEffect, useMemo, useState } from "react";
import { Button, Card, Empty, Input, Modal, Popconfirm, Select, Space, Tag, message } from "antd";
import { CloseOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { LcSiloTonApi } from "../../services/LcDanhMucApi";
import type { LcSiloTon } from "../../models/LcDanhMucModel";
import { thanhPhamToScope, type ThanhPham } from "./lcTabsConfig";
import { NumberCell } from "./LcExcelGridCells";

/**
 * Vùng "Cốc tồn silo" (tab `tonCoc`) — layout mô phỏng ĐÚNG TP1.xlsx dòng 235-267: mỗi "cụm
 * hạng mục" (vd "Tồn cốc silo trong nhà sàng 2") là 1 khối, trong đó MỖI SILO là 1 CỘT (chọn
 * từ danh mục LC_SiloTon qua "+ Thêm silo"), luôn có đúng 4 DÒNG cố định: Tồn cuối ca quy khô /
 * Tồn đầu ca quy khô / Khối lượng chênh lệch cốc 10-80mm / Khối lượng chênh lệch cốc <10mm.
 * Nhập "Chiều cao" (hoặc "Bánh cốc") ở 2 dòng đầu → "Khối lượng" tự tính theo công thức của
 * silo đó (xem Utils/CongThucEvaluator.cs ở BE — tính thử qua LcSiloTonApi.testCongThuc để
 * preview ngay, BE sẽ tính lại + lưu snapshot thật khi Lưu phiếu).
 *
 * Cấu trúc (cụm nào, silo nào, thứ tự) được backend COPY FORWARD từ phiếu liền trước lúc tạo
 * phiếu — chỉ phiếu đầu tiên của Scope mới trống, cần tự "+ Thêm cụm hạng mục" từ đầu.
 *
 * SỬA 2026-11-02: bảng pivot (hạng mục × silo) KHÔNG còn dùng AntD `Table`/`InputNumber` — thay
 * bằng `<table>`/`<input>` HTML thường + Tailwind (cùng cách đã áp cho TabXuatCapCoc/TabPhoiTron/
 * TabCapLieuSilo), dùng lại `NumberCell` từ LcExcelGridCells.tsx. `onChange` (mỗi keystroke) +
 * `onBlur` (gọi API tính thử công thức) của InputNumber cũ gộp thành 1 `onCommit` (NumberCell chỉ
 * bắn lúc blur) — `handleTinhKhoiLuong` đổi sang nhận `giaTri` trực tiếp làm tham số thay vì đọc
 * lại từ `cums`, vì state cha chưa chắc đã cập nhật xong ngay trong cùng tick gọi.
 *
 * SỬA 2026-11-13: Modal "Thêm silo" đổi sang chọn NHIỀU silo 1 lần (`Select mode="multiple"`,
 * `addModalSelected` đổi từ `number | null` thành `number[]`) — trước đó chọn từng silo một, bấm
 * OK, mở lại modal... khá mất thời gian khi 1 cụm có nhiều silo. Bảng pivot giữ nguyên 2 cột con
 * "Giá trị"/"Khối lượng" mỗi silo như cũ, nhưng đổi sang `table-fixed` + `<colgroup>` theo %
 * (cột Hạng mục cố định 18%, còn lại chia đều N silo×2 cột con) — khoá cứng chiều rộng bảng theo
 * đúng div cha (Card), không còn tràn ra phải scroll ngang; nhiều silo thì mỗi cột tự hẹp lại
 * theo màn hình thay vì đẩy bảng rộng ra.
 */

export interface CocTonSiloCol {
  key: string;
  id: number; // 0 = cột mới, chưa lưu
  idSiloTon: number;
  tenSilo: string;
  loaiLieu: string; // 'MM_10_80' | 'MM_DUOI_10'
  tenNhapLieu: string;
  giaTriTonCuoiCa?: number | null;
  khoiLuongTonCuoiCa?: number | null;
  giaTriTonDauCa?: number | null;
  khoiLuongTonDauCa?: number | null;
  chenhLech1080?: number | null;
  chenhLechDuoi10?: number | null;
}

export interface CocTonCum {
  key: string;
  tenCum: string;
  silos: CocTonSiloCol[];
}

interface TabCocTonSiloProps {
  editable: boolean;
  thanhPham: ThanhPham | null | undefined;
  cums: CocTonCum[];
  onChange: (cums: CocTonCum[]) => void;
}

type HangMucKey = "tonCuoi" | "tonDau" | "chenh1080" | "chenhDuoi10";

const HANG_MUC_ROWS: { key: HangMucKey; label: string }[] = [
  { key: "tonCuoi", label: "Tồn cuối ca quy khô" },
  { key: "tonDau", label: "Tồn đầu ca quy khô" },
  { key: "chenh1080", label: "Khối lượng chênh lệch cốc 10-80mm" },
  { key: "chenhDuoi10", label: "Khối lượng chênh lệch cốc <10mm" },
];

let localKeySeq = 0;
const genKey = () => `local-${Date.now()}-${localKeySeq++}`;

const round3 = (v: number) => Math.round(v * 1000) / 1000;

const TabCocTonSilo = ({ editable, thanhPham, cums, onChange }: TabCocTonSiloProps) => {
  const scope = thanhPhamToScope(thanhPham);
  const [catalog, setCatalog] = useState<LcSiloTon[]>([]);
  const [addModalCumKey, setAddModalCumKey] = useState<string | null>(null);
  const [addModalSelected, setAddModalSelected] = useState<number[]>([]);
  const [computingKey, setComputingKey] = useState<string | null>(null);
  const catalogById = useMemo(() => new Map(catalog.map((c) => [c.id, c])), [catalog]);

  useEffect(() => {
    if (!scope) {
      setCatalog([]);
      return;
    }
    LcSiloTonApi.search(scope)
      .then(setCatalog)
      .catch((err) => console.error("Không thể tải danh mục Silo tồn:", err));
  }, [scope]);

  const updateCums = (next: CocTonCum[]) => onChange(next);

  const handleThemCum = () => {
    updateCums([...cums, { key: genKey(), tenCum: "", silos: [] }]);
  };

  const handleXoaCum = (cumKey: string) => {
    updateCums(cums.filter((c) => c.key !== cumKey));
  };

  const handleTenCumChange = (cumKey: string, value: string) => {
    updateCums(cums.map((c) => (c.key === cumKey ? { ...c, tenCum: value } : c)));
  };

  const openAddSiloModal = (cumKey: string) => {
    setAddModalCumKey(cumKey);
    setAddModalSelected([]);
  };

  const daDuocThemIds = useMemo(
    () => new Set(cums.flatMap((c) => c.silos.map((s) => s.idSiloTon))),
    [cums]
  );

  const handleXacNhanThemSilo = () => {
    if (!addModalCumKey || addModalSelected.length === 0) return;
    const newCols: CocTonSiloCol[] = addModalSelected.flatMap((id) => {
      const siloTon = catalogById.get(id);
      if (!siloTon) return [];
      return [
        {
          key: genKey(),
          id: 0,
          idSiloTon: siloTon.id,
          tenSilo: siloTon.tenSilo,
          loaiLieu: siloTon.loaiLieu,
          tenNhapLieu: siloTon.tenNhapLieu,
        },
      ];
    });
    updateCums(
      cums.map((c) => (c.key === addModalCumKey ? { ...c, silos: [...c.silos, ...newCols] } : c))
    );
    setAddModalCumKey(null);
    setAddModalSelected([]);
  };

  const handleXoaSilo = (cumKey: string, siloKey: string) => {
    updateCums(
      cums.map((c) => (c.key === cumKey ? { ...c, silos: c.silos.filter((s) => s.key !== siloKey) } : c))
    );
  };

  const recomputeChenhLech = (col: CocTonSiloCol): CocTonSiloCol => {
    if (col.khoiLuongTonCuoiCa == null || col.khoiLuongTonDauCa == null) {
      return { ...col, chenhLech1080: null, chenhLechDuoi10: null };
    }
    const chenh = round3(col.khoiLuongTonCuoiCa - col.khoiLuongTonDauCa);
    return {
      ...col,
      chenhLech1080: col.loaiLieu === "MM_10_80" ? chenh : null,
      chenhLechDuoi10: col.loaiLieu === "MM_DUOI_10" ? chenh : null,
    };
  };

  const handleGiaTriChange = (cumKey: string, siloKey: string, moc: "tonCuoi" | "tonDau", value: number | null) => {
    updateCums(
      cums.map((c) => {
        if (c.key !== cumKey) return c;
        return {
          ...c,
          silos: c.silos.map((s) => {
            if (s.key !== siloKey) return s;
            return moc === "tonCuoi" ? { ...s, giaTriTonCuoiCa: value } : { ...s, giaTriTonDauCa: value };
          }),
        };
      })
    );
  };

  // `giaTri` nhận trực tiếp làm tham số (KHÔNG đọc lại từ `cums`) — gọi ngay trong `onCommit` của
  // NumberCell cùng lúc với handleGiaTriChange. Giữa 2 lệnh gọi KHÔNG có `await` nào nên state cha
  // (cập nhật bất đồng bộ qua `onChange`) CHẮC CHẮN CHƯA kịp phản ánh patch của handleGiaTriChange
  // khi `cums` ở đây được đọc (y hệt bug "mất giá trị vừa nhập sau khi tính khối lượng" — patch
  // KHỐI LƯỢNG ghi SAU, dựa trên snapshot `cums` CŨ, đè mất patch GIÁ TRỊ ghi TRƯỚC). Vì vậy patch
  // cuối ở đây PHẢI tự gán lại đúng field giá trị (`giaTriTonCuoiCa`/`giaTriTonDauCa`) bằng `giaTri`
  // đã có sẵn, KHÔNG dựa vào việc đọc lại từ `cums`/`col`.
  const handleTinhKhoiLuong = async (cumKey: string, siloKey: string, moc: "tonCuoi" | "tonDau", giaTri: number | null) => {
    const cum = cums.find((c) => c.key === cumKey);
    const col = cum?.silos.find((s) => s.key === siloKey);
    if (!col) return;
    const siloTon = catalogById.get(col.idSiloTon);
    if (giaTri == null) return;
    if (!siloTon) {
      message.warning(`Silo '${col.tenSilo}' đã bị xoá khỏi danh mục, không thể tính khối lượng.`);
      return;
    }
    setComputingKey(siloKey + moc);
    try {
      const res = await LcSiloTonApi.testCongThuc(siloTon.congThuc, giaTri);
      if (res.loi) {
        message.error(res.loi);
        return;
      }
      updateCums(
        cums.map((c) => {
          if (c.key !== cumKey) return c;
          return {
            ...c,
            silos: c.silos.map((s) => {
              if (s.key !== siloKey) return s;
              const withGiaTri =
                moc === "tonCuoi" ? { ...s, giaTriTonCuoiCa: giaTri } : { ...s, giaTriTonDauCa: giaTri };
              const patched =
                moc === "tonCuoi"
                  ? { ...withGiaTri, khoiLuongTonCuoiCa: res.ketQua }
                  : { ...withGiaTri, khoiLuongTonDauCa: res.ketQua };
              return recomputeChenhLech(patched);
            }),
          };
        })
      );
    } catch (err) {
      console.error("Không gọi được tính thử công thức:", err);
      message.error("Không thể tính khối lượng, vui lòng thử lại.");
    } finally {
      setComputingKey(null);
    }
  };

  const siloOptionsForAdd = catalog
    .filter((s) => !daDuocThemIds.has(s.id))
    .map((s) => ({ value: s.id, label: `${s.tenSilo} (${s.loaiLieu === "MM_10_80" ? "10-80mm" : "<10mm"})` }));

  const renderGiaTriCell = (hangMuc: HangMucKey, cumKey: string, col: CocTonSiloCol) => {
    if (hangMuc === "tonCuoi" || hangMuc === "tonDau") {
      const value = hangMuc === "tonCuoi" ? col.giaTriTonCuoiCa : col.giaTriTonDauCa;
      return (
        <NumberCell
          value={value ?? null}
          disabled={!editable}
          onCommit={(v) => {
            handleGiaTriChange(cumKey, col.key, hangMuc, v);
            handleTinhKhoiLuong(cumKey, col.key, hangMuc, v);
          }}
        />
      );
    }
    return <span className="text-gray-300">-</span>;
  };

  const renderKhoiLuongCell = (hangMuc: HangMucKey, col: CocTonSiloCol) => {
    const loading = computingKey === col.key + (hangMuc === "tonCuoi" ? "tonCuoi" : "tonDau");
    if (hangMuc === "tonCuoi") return loading ? "..." : col.khoiLuongTonCuoiCa ?? "-";
    if (hangMuc === "tonDau") return loading ? "..." : col.khoiLuongTonDauCa ?? "-";
    if (hangMuc === "chenh1080") return col.loaiLieu === "MM_10_80" ? col.chenhLech1080 ?? "-" : <span style={{ color: "#bbb" }}>-</span>;
    return col.loaiLieu === "MM_DUOI_10" ? col.chenhLechDuoi10 ?? "-" : <span style={{ color: "#bbb" }}>-</span>;
  };

  return (
    <div>
      <Button type="dashed" icon={<PlusOutlined />} onClick={handleThemCum} disabled={!editable} style={{ marginBottom: 16 }}>
        Thêm cụm hạng mục
      </Button>

      {cums.length === 0 && <Empty description="Chưa có cụm hạng mục nào" />}

      <Space direction="vertical" style={{ width: "100%" }} size={16}>
        {cums.map((cum) => {
          return (
            <Card
              key={cum.key}
              size="small"
              title={
                <Input
                  value={cum.tenCum}
                  placeholder="VD: Tồn cốc silo trong nhà sàng 2"
                  disabled={!editable}
                  onChange={(e) => handleTenCumChange(cum.key, e.target.value)}
                  style={{ maxWidth: 420, fontWeight: 600 }}
                />
              }
              extra={
                editable && (
                  <Popconfirm title="Xoá cả cụm này?" okText="Xoá" cancelText="Hủy" onConfirm={() => handleXoaCum(cum.key)}>
                    <Button type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                )
              }
            >
              {cum.silos.length === 0 ? (
                <Empty description="Chưa có silo nào" />
              ) : (
                (() => {
                  // table-fixed + colgroup % — khoá cứng chiều rộng bảng theo đúng chiều rộng
                  // div cha (Card), KHÔNG tràn ra ngoài phải scroll ngang: cột Hạng mục cố định
                  // 18%, phần còn lại (82%) chia đều cho N silo × 2 cột con. Co giãn theo màn
                  // hình (table rộng/hẹp theo Card cha); nhiều silo → mỗi cột tự hẹp lại.
                  const labelPct = 18;
                  const subColPct = (100 - labelPct) / (cum.silos.length * 2);
                  return (
                    <table className="w-full table-fixed border-collapse text-xs">
                      <colgroup>
                        <col style={{ width: `${labelPct}%` }} />
                        {cum.silos.map((col) => (
                          <Fragment key={col.key}>
                            <col style={{ width: `${subColPct}%` }} />
                            <col style={{ width: `${subColPct}%` }} />
                          </Fragment>
                        ))}
                      </colgroup>
                      <thead>
                        <tr className="bg-gray-50">
                          <th rowSpan={2} className="border border-gray-300 px-2 py-1 text-center font-medium text-gray-700">
                            Hạng mục
                          </th>
                          {cum.silos.map((col) => (
                            <th key={col.key} colSpan={2} className="border border-gray-300 px-1 py-1.5 text-center font-medium text-gray-700">
                              <div className="flex flex-col items-center justify-center gap-0.5">
                                <span className="break-words leading-tight">{col.tenSilo}</span>
                                {editable && (
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<CloseOutlined />}
                                    onClick={() => handleXoaSilo(cum.key, col.key)}
                                    title="Xoá silo này"
                                    style={{ height: 18, width: 18, minWidth: 18, lineHeight: "18px" }}
                                  />
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                        <tr className="bg-gray-50">
                          {cum.silos.map((col) => (
                            <Fragment key={col.key}>
                              <th className="border border-gray-300 px-1 py-1 text-center text-[11px] font-normal text-gray-700">{col.tenNhapLieu}</th>
                              <th className="border border-gray-300 px-1 py-1 text-center text-[11px] font-normal text-gray-700">KL</th>
                            </Fragment>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {HANG_MUC_ROWS.map((r) => (
                          <tr key={r.key} className="hover:bg-blue-50/50">
                            <td className="border border-gray-300 px-2 py-1 text-center">{r.label}</td>
                            {cum.silos.map((col) => (
                              <Fragment key={col.key}>
                                <td className="border border-gray-300 p-0">{renderGiaTriCell(r.key, cum.key, col)}</td>
                                <td className="border border-gray-300 px-1 py-1 text-right">{renderKhoiLuongCell(r.key, col)}</td>
                              </Fragment>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()
              )}
              {editable && (
                <Button
                  type="link"
                  icon={<PlusOutlined />}
                  onClick={() => openAddSiloModal(cum.key)}
                  style={{ marginTop: 8, paddingLeft: 0 }}
                >
                  Thêm silo
                </Button>
              )}
            </Card>
          );
        })}
      </Space>

      <Modal
        title="Chọn Silo tồn"
        open={addModalCumKey != null}
        onCancel={() => setAddModalCumKey(null)}
        onOk={handleXacNhanThemSilo}
        okButtonProps={{ disabled: addModalSelected.length === 0 }}
        destroyOnHidden
      >
        {!scope ? (
          <Tag color="warning">Vui lòng chọn Thành phẩm (TP1/TP2) ở phần đầu phiếu trước.</Tag>
        ) : (
          <Select
            mode="multiple"
            showSearch
            style={{ width: "100%" }}
            placeholder="Tìm và chọn nhiều silo..."
            options={siloOptionsForAdd}
            value={addModalSelected}
            onChange={setAddModalSelected}
            filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
            notFoundContent={
              siloOptionsForAdd.length === 0 ? "Chưa có Silo tồn nào trong danh mục (hoặc đã thêm hết) — vào menu NM.LC > LC - Silo tồn để khai báo." : undefined
            }
          />
        )}
      </Modal>
    </div>
  );
};

export default TabCocTonSilo;
