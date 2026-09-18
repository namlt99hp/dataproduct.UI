// Bảng màu categorical đã validate CVD (references/palette.md của skill dataviz) —
// giữ đúng thứ tự, không đảo, không tự sinh thêm hue.
export const CATEGORICAL_PALETTE = [
  "#2a78d6", // 1 blue
  "#eb6834", // 2 orange
  "#1baf7a", // 3 aqua
  "#eda100", // 4 yellow
  "#e87ba4", // 5 magenta
  "#008300", // 6 green
  "#4a3aa7", // 7 violet
  "#e34948", // 8 red
];

export const STATUS_COLORS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
};

/** Cắt tối đa 8 màu (token ceiling) — quá 8 nhóm nên gộp "Khác" ở tầng tạo dữ liệu, không sinh thêm hue ở đây. */
export const paletteFor = (count: number) => CATEGORICAL_PALETTE.slice(0, Math.max(1, count));
