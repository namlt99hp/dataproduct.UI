import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Col, Divider, Input, InputNumber, Modal, Popconfirm, Row, Select, Table, Typography } from "antd";
import { DeleteOutlined, PlusOutlined, SnippetsOutlined } from "@ant-design/icons";
import CustomFormTable, { type FormColumnDef } from "../CustomFormTable";
import { thanhPhamToScope, type ThanhPham } from "./lcTabsConfig";
import type { CapLieuRow } from "./TabCapLieuSilo";
import { LOAI_PHOI_TRON_OPTIONS } from "./lcMockOptions";
import { sttColumn } from "./lcColumnHelpers";
import { LcCumThapApi } from "../../services/LcDanhMucApi";
import type { LcCumThap } from "../../models/LcDanhMucModel";

/**
 * Vùng "Phối trộn" — LC_01_PhanTich_ThietKe_TP1_TP2.md mục 2.2 Vùng 3 / mục 4.2:
 * "Theo tháp: thẻ 1.1, 1.2, 1.3 thử nghiệm (+2.3/2.4); mỗi thẻ: header (YCCN, cân, độ ẩm) +
 * bảng silo". Đối chiếu trực tiếp với file Excel thật (TP1.xlsx dòng 37–158): mỗi cụm tháp
 * than (LC_CumThap) có N "thẻ" công thức phối, phân biệt bởi (LoaiPhoiTron, ThuTu) — mặc
 * định 1 thẻ "Sản xuất #1", nút "+ Thêm công thức phối" tạo thẻ Sản xuất kế tiếp (song song,
 * khớp cách Excel dùng 2 bảng cột A–K / L–R cho cùng 1 loại).
 *
 * Cột "Silo"/"Tên than" trong bảng con của mỗi thẻ KHÔNG nhập tay — đồng bộ 1:1 theo vị trí
 * (siloSo) từ `capLieuRows` (tab Cấp liệu & Silo), đúng yêu cầu nghiệp vụ: 1 danh sách than/
 * silo dùng chung cho mọi công thức phối của mọi cụm tháp.
 *
 * Lưu qua bảng quan hệ riêng (LC_PhoiTron/LC_PhoiTronChiTiet, LcPhoiTronApi) — KHÔNG qua
 * BmPhieu.DataJson, cùng nguyên tắc đã áp cho tab Cấp liệu & Silo.
 */

export interface PhoiTronChiTietRow {
  siloSo: number;
  /** Lớp liệu trong silo đó (khớp CapLieuRow.stt — "Tách liệu" ở tab Cấp liệu). 1 nếu không
   *  set (dữ liệu cũ trước khi có tách liệu). Cùng (siloSo, stt) với capLieuRows để ánh xạ
   *  đúng khi 1 silo có nhiều lớp. */
  stt?: number;
  /** Snapshot — readonly, luôn hiển thị theo capLieuRows hiện tại (xem displayCards). */
  vatLieuTen?: string | null;
  tyLeKeHoach?: string | number | null;
  tyLeThucTe?: string | number | null;
  /** CALCULATED F02 — backend tính khi lưu; FE preview tạm (xem computeKlQuyKho_PREVIEW). */
  klQuyKho?: string | number | null;
  /** CALCULATED (F03) — backend tính khi lưu, reset tại Ca 1 ngày 1 hàng tháng (xem
   *  LC_PhoiTronRepository.ComputeLuyKeQuyKhoAsync). FE không tự tính, chỉ hiển thị. */
  luyKeQuyKho?: string | number | null;
  ghiChu?: string | null;
}

export interface PhoiTronCard {
  /** 0/undefined = thẻ mới chưa lưu backend. */
  id?: number;
  cumThapMa: string;
  /** 'SAN_XUAT' | 'THU_NGHIEM' — xem LOAI_PHOI_TRON_OPTIONS. */
  loaiPhoiTron: string;
  thuTu: number;
  soPhieuYeuCau?: string | null;
  maMauThuNghiem?: string | null;
  ghiChuPhoi?: string | null;
  klCanAm?: string | number | null;
  doAm?: string | number | null;
  /** CALCULATED F01 — backend tính khi lưu; FE preview tạm. */
  klQuyKhoCan?: string | number | null;
  chiTiet: PhoiTronChiTietRow[];
}

interface TabPhoiTronProps {
  thanhPham: ThanhPham | null | undefined;
  editable: boolean;
  cards: PhoiTronCard[];
  onChange: (cards: PhoiTronCard[]) => void;
  /** Dòng silo đã khai ở tab Cấp liệu — nguồn DUY NHẤT cho Silo/Tên than ở mọi thẻ. */
  capLieuRows: CapLieuRow[];
}

function buildEmptyCard(
  cumThapMa: string,
  capLieuRows: CapLieuRow[],
  loaiPhoiTron = "SAN_XUAT",
  thuTu = 1
): PhoiTronCard {
  return {
    cumThapMa,
    loaiPhoiTron,
    thuTu,
    chiTiet: capLieuRows.map((r) => ({ siloSo: r.siloSo, stt: r.stt ?? 1, vatLieuTen: r.vatLieuTen ?? null })),
  };
}

const capLieuKey = (siloSo: number, stt?: number): string => `${siloSo}-${stt ?? 1}`;

/**
 * F01 PREVIEW (ngoại lệ đã được chấp nhận — xem computeKhoiLuongKhoThucTe_PREVIEW ở
 * TabCapLieuSilo.tsx, cùng lý do/quy ước NULL): KL quy khô cân = KL cân ẩm × (100 − Độ ẩm)/100.
 * Giá trị chính thức do backend tính lúc Lưu (LC_PhoiTronRepository.ComputeKlQuyKhoCan).
 */
function computeKlQuyKhoCan_PREVIEW(klCanAm: PhoiTronCard["klCanAm"], doAm: PhoiTronCard["doAm"]): number | null {
  if (klCanAm === null || klCanAm === undefined || klCanAm === "" || doAm === null || doAm === undefined || doAm === "")
    return null;
  const amNum = Number(klCanAm);
  const doAmNum = Number(doAm);
  if (!Number.isFinite(amNum) || !Number.isFinite(doAmNum)) return null;
  return Math.round(((amNum * (100 - doAmNum)) / 100) * 1000) / 1000;
}

/** F02 PREVIEW — xem comment trên. KL quy khô = Tỷ lệ thực tế × KL quy khô cân / 100. */
function computeKlQuyKho_PREVIEW(
  tyLeThucTe: PhoiTronChiTietRow["tyLeThucTe"],
  klQuyKhoCan: number | null
): number | null {
  if (tyLeThucTe === null || tyLeThucTe === undefined || tyLeThucTe === "" || klQuyKhoCan === null) return null;
  const tyLeNum = Number(tyLeThucTe);
  if (!Number.isFinite(tyLeNum)) return null;
  return Math.round(((tyLeNum * klQuyKhoCan) / 100) * 1000) / 1000;
}

const toNum = (v: string | number | null | undefined): number | undefined =>
  v === null || v === undefined || v === "" ? undefined : Number(v);

const loaiLabel = (value: string): string => LOAI_PHOI_TRON_OPTIONS.find((o) => o.value === value)?.label ?? value;

/** Các cột cho phép "Paste từ Excel" ở bảng chi tiết mỗi thẻ — xem GroupedTableSTD.tsx (bản gốc). */
const PASTE_COLUMNS = new Set(["tyLeKeHoach", "tyLeThucTe"]);

const renderChiTietSummary = (data: readonly PhoiTronChiTietRow[]) => {
  const sum = (key: keyof PhoiTronChiTietRow) => {
    const total = data.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
    return total ? total.toLocaleString("en-US", { maximumFractionDigits: 3 }) : "—";
  };
  return (
    <Table.Summary fixed>
      <Table.Summary.Row style={{ backgroundColor: "#fafafa", fontWeight: 600 }}>
        <Table.Summary.Cell index={0} colSpan={3} align="center">
          Tổng
        </Table.Summary.Cell>
        <Table.Summary.Cell index={3} align="right">
          {sum("tyLeKeHoach")}
        </Table.Summary.Cell>
        <Table.Summary.Cell index={4} align="right">
          {sum("tyLeThucTe")}
        </Table.Summary.Cell>
        <Table.Summary.Cell index={5} align="right">
          {sum("klQuyKho")}
        </Table.Summary.Cell>
        <Table.Summary.Cell index={6} />
        <Table.Summary.Cell index={7} />
      </Table.Summary.Row>
    </Table.Summary>
  );
};

const TabPhoiTron = ({ thanhPham, editable, cards, onChange, capLieuRows }: TabPhoiTronProps) => {
  const cardsRef = useRef(cards);
  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);
  const capLieuRowsRef = useRef(capLieuRows);
  useEffect(() => {
    capLieuRowsRef.current = capLieuRows;
  }, [capLieuRows]);

  const [cumThaps, setCumThaps] = useState<LcCumThap[]>([]);
  const scope = useMemo(() => thanhPhamToScope(thanhPham), [thanhPham]);

  useEffect(() => {
    if (scope == null) {
      setCumThaps([]);
      return;
    }
    let active = true;
    LcCumThapApi.search(scope)
      .then((list) => {
        if (active) setCumThaps(list);
      })
      .catch(() => {
        if (active) setCumThaps([]);
      });
    return () => {
      active = false;
    };
  }, [scope]);

  // (a) Đảm bảo mỗi cụm tháp luôn có ít nhất 1 thẻ mặc định (Sản xuất #1) — bình thường
  // backend đã seed sẵn (LC_PhoiTronRepository.InitializeLC_BCSX_XNL_TP_PhoiTronAsync) lúc
  // tạo phiếu, nhánh này chỉ cần cho phiếu MỚI (chưa có idphieu nên chưa gọi API riêng).
  // (b) Đồng bộ `chiTiet` của MỌI thẻ theo danh sách lớp liệu hiện tại của Cấp liệu (thêm
  // dòng khi 1 silo vừa được "Tách liệu", bỏ dòng khi 1 lớp vừa bị "Xoá lớp") — khớp đúng
  // yêu cầu "Phối trộn ánh xạ đúng với list silo liệu". Giữ nguyên tỷ lệ đã nhập cho lớp nào
  // còn tồn tại (match theo siloSo+stt), không reset toàn bộ thẻ.
  useEffect(() => {
    if (cumThaps.length === 0) return;
    const currentCapLieu = capLieuRowsRef.current;
    let changed = false;
    let next = cardsRef.current;

    const missingCum = cumThaps.filter((c) => !next.some((card) => card.cumThapMa === c.ma));
    if (missingCum.length > 0) {
      next = [...next, ...missingCum.map((c) => buildEmptyCard(c.ma, currentCapLieu))];
      changed = true;
    }

    const reconciled = next.map((card) => {
      const existingByKey = new Map(card.chiTiet.map((r) => [capLieuKey(r.siloSo, r.stt), r]));
      const nextChiTiet = currentCapLieu.map((r) => {
        const existing = existingByKey.get(capLieuKey(r.siloSo, r.stt));
        return existing ?? { siloSo: r.siloSo, stt: r.stt ?? 1, vatLieuTen: r.vatLieuTen ?? null };
      });
      const sameShape =
        nextChiTiet.length === card.chiTiet.length &&
        card.chiTiet.every((r, i) => capLieuKey(r.siloSo, r.stt) === capLieuKey(nextChiTiet[i].siloSo, nextChiTiet[i].stt));
      if (sameShape) return card;
      changed = true;
      return { ...card, chiTiet: nextChiTiet };
    });

    if (changed) onChange(reconciled);
  }, [cumThaps, capLieuRows, onChange]);

  const handleAddCard = useCallback(
    (cumThapMa: string) => {
      const sameLoai = cardsRef.current.filter((c) => c.cumThapMa === cumThapMa && c.loaiPhoiTron === "SAN_XUAT");
      const nextThuTu = sameLoai.length > 0 ? Math.max(...sameLoai.map((c) => c.thuTu)) + 1 : 1;
      const newCard = buildEmptyCard(cumThapMa, capLieuRowsRef.current, "SAN_XUAT", nextThuTu);
      onChange([...cardsRef.current, newCard]);
    },
    [onChange]
  );

  const handleDeleteCard = useCallback(
    (cumThapMa: string, loaiPhoiTron: string, thuTu: number) => {
      onChange(
        cardsRef.current.filter((c) => !(c.cumThapMa === cumThapMa && c.loaiPhoiTron === loaiPhoiTron && c.thuTu === thuTu))
      );
    },
    [onChange]
  );

  const updateCard = useCallback(
    (cumThapMa: string, loaiPhoiTron: string, thuTu: number, patch: Partial<PhoiTronCard>) => {
      onChange(
        cardsRef.current.map((c) =>
          c.cumThapMa === cumThapMa && c.loaiPhoiTron === loaiPhoiTron && c.thuTu === thuTu ? { ...c, ...patch } : c
        )
      );
    },
    [onChange]
  );

  const updateCardChiTiet = useCallback(
    (cumThapMa: string, loaiPhoiTron: string, thuTu: number, rows: PhoiTronChiTietRow[]) => {
      onChange(
        cardsRef.current.map((c) =>
          c.cumThapMa === cumThapMa && c.loaiPhoiTron === loaiPhoiTron && c.thuTu === thuTu ? { ...c, chiTiet: rows } : c
        )
      );
    },
    [onChange]
  );

  /* ================= PASTE FROM EXCEL (clone từ GroupedTableSTD.tsx) ================= */
  const [pasteModal, setPasteModal] = useState<{
    open: boolean;
    cumThapMa: string;
    loaiPhoiTron: string;
    thuTu: number;
    columnKey: string;
    columnTitle: string;
  }>({ open: false, cumThapMa: "", loaiPhoiTron: "", thuTu: 0, columnKey: "", columnTitle: "" });
  const [pasteText, setPasteText] = useState("");

  const handlePasteConfirm = useCallback(() => {
    const { cumThapMa, loaiPhoiTron, thuTu, columnKey } = pasteModal;
    const card = cardsRef.current.find(
      (c) => c.cumThapMa === cumThapMa && c.loaiPhoiTron === loaiPhoiTron && c.thuTu === thuTu
    );
    if (card) {
      const currentRows = card.chiTiet;
      const lines = pasteText
        .split("\n")
        .map((line) => line.split("\t")[0].trim())
        .filter((line, index) => line !== "" || index < currentRows.length);

      const next = currentRows.map((row, i) => {
        if (lines[i] === undefined || lines[i] === "") return row;
        const num = parseFloat(lines[i].replace(/,/g, ""));
        if (Number.isNaN(num)) return row;
        return { ...row, [columnKey]: num };
      });
      updateCardChiTiet(cumThapMa, loaiPhoiTron, thuTu, next);
    }
    setPasteModal({ open: false, cumThapMa: "", loaiPhoiTron: "", thuTu: 0, columnKey: "", columnTitle: "" });
    setPasteText("");
  }, [pasteModal, pasteText, updateCardChiTiet]);

  /** Title có nút "Paste từ Excel" cho các cột trong PASTE_COLUMNS (chỉ khi editable) —
   *  gắn kèm identity của thẻ đang chứa cột đó để paste đúng thẻ, không lẫn giữa các thẻ. */
  const renderPasteableTitle = useCallback(
    (rawTitle: string, dataIndex: string, card: PhoiTronCard) => {
      if (!editable || !PASTE_COLUMNS.has(dataIndex)) return rawTitle;
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
          <span>{rawTitle}</span>
          <Button
            size="small"
            type="primary"
            ghost
            icon={<SnippetsOutlined />}
            title="Paste từ Excel"
            style={{ lineHeight: 1, padding: "0 6px" }}
            onClick={(e) => {
              e.stopPropagation();
              setPasteModal({
                open: true,
                cumThapMa: card.cumThapMa,
                loaiPhoiTron: card.loaiPhoiTron,
                thuTu: card.thuTu,
                columnKey: dataIndex,
                columnTitle: rawTitle,
              });
              setPasteText("");
            }}
          />
        </div>
      );
    },
    [editable]
  );

  const buildChiTietColumns = useCallback(
    (card: PhoiTronCard): FormColumnDef[] => [
      sttColumn(),
      { title: "Silo", dataIndex: "siloSo", width: 70, align: "center", readonly: true },
      { title: "Tên than", dataIndex: "vatLieuTen", width: 180, readonly: true },
      {
        title: renderPasteableTitle("Tỷ lệ kế hoạch (%)", "tyLeKeHoach", card),
        dataIndex: "tyLeKeHoach",
        width: 120,
        type: "float",
        min: 0,
        align: "right",
      },
      {
        title: renderPasteableTitle("Tỷ lệ quy khô thực tế (%)", "tyLeThucTe", card),
        dataIndex: "tyLeThucTe",
        width: 120,
        type: "float",
        min: 0,
        align: "right",
      },
      { title: "KL quy khô (tấn)", dataIndex: "klQuyKho", width: 120, align: "right", readonly: true },
      { title: "Lũy kế quy khô (tấn)", dataIndex: "luyKeQuyKho", width: 140, align: "right", readonly: true },
      { title: "Ghi chú", dataIndex: "ghiChu", width: 160 },
    ],
    [renderPasteableTitle]
  );

  // Tên than luôn lấy LIVE theo capLieuRows (không dùng snapshot đã lưu) — tránh lệch khi
  // người dùng sửa Cấp liệu sau khi đã mở tab Phối trộn. KL quy khô cân/KL quy khô: preview
  // FE (F01/F02), không mutate `cards` gốc — giống pattern displayRows ở TabCapLieuSilo.
  const siloVatLieuMap = useMemo(() => {
    const map = new Map<string, string | null | undefined>();
    for (const row of capLieuRows) map.set(capLieuKey(row.siloSo, row.stt), row.vatLieuTen);
    return map;
  }, [capLieuRows]);

  const displayCards = useMemo(
    () =>
      cards.map((card) => {
        const klQuyKhoCan = computeKlQuyKhoCan_PREVIEW(card.klCanAm, card.doAm);
        return {
          ...card,
          klQuyKhoCan,
          chiTiet: card.chiTiet.map((row) => ({
            ...row,
            vatLieuTen: siloVatLieuMap.get(capLieuKey(row.siloSo, row.stt)) ?? row.vatLieuTen,
            klQuyKho: computeKlQuyKho_PREVIEW(row.tyLeThucTe, klQuyKhoCan),
          })),
        };
      }),
    [cards, siloVatLieuMap]
  );

  const cardsByCum = useMemo(() => {
    const map = new Map<string, PhoiTronCard[]>();
    for (const card of displayCards) {
      const list = map.get(card.cumThapMa) ?? [];
      list.push(card);
      map.set(card.cumThapMa, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.loaiPhoiTron.localeCompare(b.loaiPhoiTron) || a.thuTu - b.thuTu);
    }
    return map;
  }, [displayCards]);

  return (
    <div>
      {/* <Typography.Text type="secondary">
        Mỗi cụm tháp than hiển thị sẵn 1 công thức phối "Sản xuất #1" — bấm "+ Thêm công thức
        phối" để tạo thêm (song song hoặc thử nghiệm, đổi "Loại" trên thẻ). Cột "Silo"/"Tên
        than" đồng bộ tự động theo tab Cấp liệu &amp; Silo, không nhập tay. "KL quy khô cân"/"KL
        quy khô" đang preview tạm ở trình duyệt, giá trị chính thức tính lại khi Lưu.
      </Typography.Text> */}

      {cumThaps.map((cum) => {
        const cardsOfCum = cardsByCum.get(cum.ma) ?? [];
        return (
          <div key={cum.ma} style={{ marginTop: 20 }}>
            <Divider orientation="left">{cum.ten || `Tháp ${cum.ma}`}</Divider>

            {cardsOfCum.map((card) => (
              <Card
                key={`${card.cumThapMa}-${card.loaiPhoiTron}-${card.thuTu}`}
                size="small"
                style={{ marginBottom: 12 }}
                title={`${loaiLabel(card.loaiPhoiTron)} #${card.thuTu}`}
                extra={
                  editable && cardsOfCum.length > 1 ? (
                    <Popconfirm
                      title="Xoá công thức phối này?"
                      okText="Xoá"
                      cancelText="Hủy"
                      onConfirm={() => handleDeleteCard(card.cumThapMa, card.loaiPhoiTron, card.thuTu)}
                    >
                      <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                    </Popconfirm>
                  ) : null
                }
              >
                <Row gutter={12}>
                  <Col span={4}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Loại
                    </Typography.Text>
                    <Select
                      value={card.loaiPhoiTron}
                      options={LOAI_PHOI_TRON_OPTIONS}
                      disabled={!editable}
                      style={{ width: "100%" }}
                      onChange={(v) => updateCard(card.cumThapMa, card.loaiPhoiTron, card.thuTu, { loaiPhoiTron: v })}
                    />
                  </Col>
                  <Col span={card.loaiPhoiTron === "THU_NGHIEM" ? 5 : 8}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Số phiếu yêu cầu
                    </Typography.Text>
                    <Input
                      value={card.soPhieuYeuCau ?? ""}
                      disabled={!editable}
                      placeholder="Số YCCN/YCTN..."
                      onChange={(e) => updateCard(card.cumThapMa, card.loaiPhoiTron, card.thuTu, { soPhieuYeuCau: e.target.value })}
                    />
                  </Col>
                  {card.loaiPhoiTron === "THU_NGHIEM" && (
                    <Col span={5}>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        Mã mẫu thử nghiệm
                      </Typography.Text>
                      <Input
                        value={card.maMauThuNghiem ?? ""}
                        disabled={!editable}
                        onChange={(e) =>
                          updateCard(card.cumThapMa, card.loaiPhoiTron, card.thuTu, { maMauThuNghiem: e.target.value })
                        }
                      />
                    </Col>
                  )}
                  <Col span={3}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      KL cân 2A (tấn)
                    </Typography.Text>
                    <InputNumber
                      style={{ width: "100%" }}
                      value={toNum(card.klCanAm)}
                      disabled={!editable}
                      onChange={(v) => updateCard(card.cumThapMa, card.loaiPhoiTron, card.thuTu, { klCanAm: v })}
                    />
                  </Col>
                  <Col span={3}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Độ ẩm (%)
                    </Typography.Text>
                    <InputNumber
                      style={{ width: "100%" }}
                      min={0}
                      value={toNum(card.doAm)}
                      disabled={!editable}
                      onChange={(v) => updateCard(card.cumThapMa, card.loaiPhoiTron, card.thuTu, { doAm: v })}
                    />
                  </Col>
                  <Col span={3}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      KL quy khô cân 2A (tấn)
                    </Typography.Text>
                    <Input value={card.klQuyKhoCan ?? "—"} readOnly style={{ backgroundColor: "#fffbe6" }} />
                  </Col>
                </Row>

                <Divider style={{ margin: "10px 0" }} />

                <CustomFormTable
                  columns={buildChiTietColumns(card)}
                  initialData={card.chiTiet}
                  onDataChange={(rows) =>
                    updateCardChiTiet(card.cumThapMa, card.loaiPhoiTron, card.thuTu, rows as PhoiTronChiTietRow[])
                  }
                  showAddButton={false}
                  showDeleteButton={false}
                  editable={editable}
                  minRows={0}
                  summary={renderChiTietSummary}
                />
              </Card>
            ))}

            {editable && (
              <Button type="dashed" icon={<PlusOutlined />} onClick={() => handleAddCard(cum.ma)} style={{ width: "100%" }}>
                + Thêm công thức phối
              </Button>
            )}
          </div>
        );
      })}

      <Modal
        title={`Paste dữ liệu - ${pasteModal.columnTitle}`}
        open={pasteModal.open}
        onOk={handlePasteConfirm}
        onCancel={() => {
          setPasteModal({ open: false, cumThapMa: "", loaiPhoiTron: "", thuTu: 0, columnKey: "", columnTitle: "" });
          setPasteText("");
        }}
        okText="Xác nhận"
        cancelText="Hủy"
        destroyOnClose
      >
        <Input.TextArea
          autoFocus
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="Paste dữ liệu từ Excel vào đây..."
          rows={8}
        />
      </Modal>
    </div>
  );
};

export default TabPhoiTron;
