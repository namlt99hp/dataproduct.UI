import { useEffect, useRef, useState } from "react";

/**
 * Ô nhập dạng "ô Excel" dùng chung cho các tab LC_BCSX_XNL khi bỏ AntD Table/InputNumber cho lưới
 * dữ liệu dày đặc (xem comment đầu TabXuatCapCoc.tsx — SỬA 2026-11-02). Tách ra file riêng từ lần
 * dùng thứ 2 (TabPhoiTron.tsx) để khỏi lặp lại `NumberCell`/`TextCell` ở mỗi tab.
 *
 * Nguyên tắc: state cục bộ bằng `useState`, CHỈ gọi `onCommit` lúc blur — gõ nhanh không kéo theo
 * `onChange(cards/slots.map(...))` ở component cha (rất tốn vì map lại toàn bộ mảng) mỗi keystroke.
 * PHẢI dùng ở module-level (không định nghĩa lồng trong component khác) — nếu lồng, mỗi lần cha
 * render sẽ tạo lại component mới, React coi là component khác → input đang gõ bị mất focus.
 *
 * SỬA 2026-11-14: ô bình thường (1 input = 1 `<td>`) đủ viền nhờ `<td>` bọc ngoài, giữ nguyên
 * `cellInputClass` (`border-0 bg-transparent`). Nhưng input nằm trong `<td rowSpan>` (merge nhiều
 * dòng — TabThapPheu "Độ ẩm tháp"/"Ghi chú" rowSpan 2-5, TabPhoiTron "Cân 2A/Độ ẩm" rowSpan theo
 * silo) thì nổi giữa 1 vùng trắng to, không còn viền riêng để biết đây là ô bấm vào nhập được —
 * dùng `cellInputMergedClass` (viền tĩnh, không chỉ lúc focus) qua prop `merged` cho riêng các ô đó.
 */
export const cellInputClass =
  "w-full border-0 bg-transparent px-1 py-0.5 text-xs outline-none focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 disabled:bg-transparent disabled:text-gray-500";

export const cellInputMergedClass =
  "w-full border border-gray-300 bg-white px-1 py-0.5 text-xs outline-none hover:border-blue-400 focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 focus:border-blue-400 disabled:border-transparent disabled:bg-transparent disabled:text-gray-500";

export const NumberCell = ({
  value,
  step,
  disabled,
  merged,
  onCommit,
}: {
  value: number | null;
  step?: number;
  disabled?: boolean;
  /** true khi ô nằm trong `<td rowSpan>` — dùng viền tĩnh `cellInputMergedClass` thay vì
   *  `cellInputClass` để không bị lẫn vào vùng merge xung quanh (xem SỬA 2026-11-14). */
  merged?: boolean;
  onCommit: (value: number | null) => void;
}) => {
  const [local, setLocal] = useState(value == null ? "" : String(value));
  const editingRef = useRef(false);

  useEffect(() => {
    if (!editingRef.current) setLocal(value == null ? "" : String(value));
  }, [value]);

  const commit = () => {
    editingRef.current = false;
    const trimmed = local.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    const next = parsed != null && Number.isNaN(parsed) ? null : parsed;
    if (next !== value) onCommit(next);
    else setLocal(value == null ? "" : String(value));
  };

  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      className={`${merged ? cellInputMergedClass : cellInputClass} text-right`}
      value={local}
      disabled={disabled}
      onFocus={() => (editingRef.current = true)}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
};

/** Ô chọn 1 giá trị cố định (vd "Đạt"/"Không đạt") dạng "ô Excel" — commit ngay khi onChange,
 * không cần buffer cục bộ như NumberCell/TextCell vì select không phát sinh nhiều sự kiện mỗi
 * ký tự gõ. */
export const SelectCell = <T extends string>({
  value,
  options,
  placeholder,
  disabled,
  onCommit,
}: {
  value: T | null;
  options: { label: string; value: T }[];
  placeholder?: string;
  disabled?: boolean;
  onCommit: (value: T | null) => void;
}) => (
  <select
    className={cellInputClass}
    value={value ?? ""}
    disabled={disabled}
    onChange={(e) => onCommit((e.target.value || null) as T | null)}
  >
    <option value="">{placeholder ?? ""}</option>
    {options.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </select>
);

export const TextCell = ({
  value,
  disabled,
  merged,
  onCommit,
}: {
  value: string | null;
  disabled?: boolean;
  /** true khi ô nằm trong `<td rowSpan>` — xem NumberCell. */
  merged?: boolean;
  onCommit: (value: string | null) => void;
}) => {
  const [local, setLocal] = useState(value ?? "");
  const editingRef = useRef(false);

  useEffect(() => {
    if (!editingRef.current) setLocal(value ?? "");
  }, [value]);

  const commit = () => {
    editingRef.current = false;
    const next = local.trim() === "" ? null : local;
    if (next !== value) onCommit(next);
  };

  return (
    <input
      type="text"
      className={merged ? cellInputMergedClass : cellInputClass}
      value={local}
      disabled={disabled}
      onFocus={() => (editingRef.current = true)}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
};
