/** Tiện ích số học dùng chung cho các preview FE ở các tab LC_BCSX_XNL (tách riêng khỏi
 *  LcExcelGridCells.tsx — file đó chỉ export component, theo yêu cầu react-refresh/only-export-
 *  components). */
export const round3 = (v: number): number => Math.round(v * 1000) / 1000;
