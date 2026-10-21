import { useCallback, useEffect, useRef, useState } from "react";
import { Select, Spin } from "antd";
import { LcVatTuMaLoLookupApi } from "../../services/LcVatTuMaLoLookupApi";

/**
 * 2 cell tùy biến cho cột "Tên than" / "Số hiệu lô" ở TabCapLieuSilo:
 * - Chọn than (autocomplete, gõ để tìm qua API) → reset lô đã chọn (lô đổi theo liệu).
 * - Lô: load theo idVatTu đã chọn (CHỈ lô đang active — BE đã filter ID_TinhTrang=1); nếu
 *   than đó chỉ có đúng 1 lô → tự chọn và hiển thị luôn, không cần người dùng bấm chọn.
 * Cả 2 cập nhật thẳng qua `onUpdateRow` (patch nhiều field 1 lúc: id + tên snapshot), bỏ qua
 * cơ chế onChange 1-field của CustomFormTable.
 */

export interface VatTuMaLoCellPatch {
  idVatTu?: number | null;
  vatLieuTen?: string | null;
  idMaLo?: number | null;
  soHieuLo?: string | null;
}

interface CellBaseProps {
  idx: number;
  disabled?: boolean;
  onUpdateRow: (idx: number, patch: VatTuMaLoCellPatch) => void;
}

interface VatTuCellProps extends CellBaseProps {
  idVatTu?: number | null;
  vatLieuTen?: string | null;
}

export function VatTuAutoCompleteCell({ idx, disabled, onUpdateRow, idVatTu, vatLieuTen }: VatTuCellProps) {
  const [options, setOptions] = useState<Array<{ label: string; value: number }>>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Giữ option hiện tại (từ dữ liệu đã có) để Select hiển thị đúng nhãn kể cả khi chưa search.
  useEffect(() => {
    if (idVatTu == null || !vatLieuTen) return;
    setOptions((prev) => (prev.some((o) => o.value === idVatTu) ? prev : [{ label: vatLieuTen, value: idVatTu }, ...prev]));
  }, [idVatTu, vatLieuTen]);

  const runSearch = (keyword: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const list = await LcVatTuMaLoLookupApi.searchVatTu(keyword);
        setOptions(list.map((x) => ({ label: x.tenVatTu ?? `#${x.idVatTu}`, value: x.idVatTu })));
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  return (
    <Select
      showSearch
      allowClear
      placeholder="Tìm than..."
      value={idVatTu ?? undefined}
      filterOption={false}
      notFoundContent={searching ? <Spin size="small" /> : "Không có kết quả"}
      onSearch={runSearch}
      onFocus={() => {
        if (options.length === 0) runSearch("");
      }}
      onChange={(value, option) => {
        if (value == null) {
          onUpdateRow(idx, { idVatTu: null, vatLieuTen: null, idMaLo: null, soHieuLo: null });
          return;
        }
        const label = (option as { label?: string } | undefined)?.label ?? null;
        // Đổi than → lô cũ không còn hợp lệ, reset để chọn lại theo than mới.
        onUpdateRow(idx, { idVatTu: Number(value), vatLieuTen: label, idMaLo: null, soHieuLo: null });
      }}
      options={options}
      disabled={disabled}
      style={{ width: "100%" }}
    />
  );
}

interface MaLoCellProps extends CellBaseProps {
  idVatTu?: number | null;
  idMaLo?: number | null;
  /** Options đã resolve từ cache chung (xem useMaLoBatchCache ở TabCapLieuSilo) — mỗi cell
   *  KHÔNG tự gọi API riêng nữa, tránh N+1 khi load phiếu có sẵn nhiều dòng đã chọn than. */
  options: Array<{ label: string; value: number }>;
  loading?: boolean;
}

export function MaLoAutoCompleteCell({ idx, disabled, onUpdateRow, idVatTu, idMaLo, options, loading }: MaLoCellProps) {
  return (
    <Select
      showSearch
      allowClear
      placeholder={idVatTu ? "Chọn lô" : "Chọn than trước"}
      value={idMaLo ?? undefined}
      loading={loading}
      disabled={disabled || idVatTu == null}
      options={options}
      filterOption={(input, option) => (option?.label ?? "").toLowerCase().includes(input.toLowerCase())}
      onChange={(value, option) => {
        if (value == null) {
          onUpdateRow(idx, { idMaLo: null, soHieuLo: null });
          return;
        }
        const label = (option as { label?: string } | undefined)?.label ?? null;
        onUpdateRow(idx, { idMaLo: Number(value), soHieuLo: label });
      }}
      style={{ width: "100%" }}
    />
  );
}

type MaLoOption = { label: string; value: number };

/**
 * Cache chung cho options "lô" theo idVatTu, dùng ở component cha (vd TabCapLieuSilo) —
 * gọi getMaLoByVatTuBatch 1 LẦN cho mọi idVatTu đã có sẵn khi load phiếu, thay vì mỗi
 * MaLoAutoCompleteCell tự gọi getMaLoByVatTu riêng (N+1 — mấy chục dòng = mấy chục request).
 * Vật tư mới chọn (chưa có trong cache) sẽ được thêm vào lần fetch kế tiếp khi idVatTuList đổi.
 */
export function useMaLoBatchCache(idVatTuList: Array<number | null | undefined>) {
  const [cache, setCache] = useState<Map<number, MaLoOption[]>>(new Map());
  const fetchedRef = useRef<Set<number>>(new Set());

  const idsKey = [...new Set(idVatTuList.filter((x): x is number => x != null))]
    .sort((a, b) => a - b)
    .join(",");

  useEffect(() => {
    const ids = idsKey ? idsKey.split(",").map(Number) : [];
    const missing = ids.filter((id) => !fetchedRef.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => fetchedRef.current.add(id));
    LcVatTuMaLoLookupApi.getMaLoByVatTuBatch(missing).then((map) => {
      setCache((prev) => {
        const next = new Map(prev);
        missing.forEach((id) => {
          const list = map[id] ?? [];
          next.set(id, list.map((x) => ({ label: x.tenMaLo ?? `#${x.idMaLo}`, value: x.idMaLo })));
        });
        return next;
      });
    });
  }, [idsKey]);

  const getOptions = useCallback(
    (idVatTu?: number | null): MaLoOption[] => (idVatTu == null ? [] : cache.get(idVatTu) ?? []),
    [cache]
  );

  const isLoading = useCallback(
    (idVatTu?: number | null): boolean => idVatTu != null && !cache.has(idVatTu),
    [cache]
  );

  return { getOptions, isLoading };
}
