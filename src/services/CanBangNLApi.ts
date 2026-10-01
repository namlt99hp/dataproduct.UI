/**
 * Cân bằng nguyên liệu (Kho dữ liệu) — so sánh dữ liệu GIAO NHẬN (Generator)
 * với dữ liệu VÀO LÒ (Consumer) để tính Balance loss / Loss rate.
 *
 * Nguồn dữ liệu + mapping cấu hình động ở backend: wwwroot/canbang-nl-config.json
 * (xem cấu hình đang áp dụng: GET /api/CanBangNL/config).
 */
import apiService from "./ApiService";

export type CanBangNLFilter = {
  ngay: string; // YYYY-MM-DD
  ca?: number; // 1: Ca ngày, 2: Ca đêm, undefined: cả ngày
  coAm: boolean; // true: khối lượng ẩm, false: khô
  idLoCao?: number; // undefined: tất cả lò cao
};

export type BalanceItem = {
  /** Tên nguồn cấp / nơi tiêu thụ, vd "Than coke 10-85mm", "Coke DQ2" */
  name: string;
  /** Mô tả nguồn dữ liệu, vd "BBGN", "SUM tất cả mẻ xuất vào lò" */
  source: string;
  /** Khối lượng (theo đơn vị của material); null = chưa có dữ liệu */
  value: number | null;
};

export type MaterialBalance = {
  /** Mã rule trong config, vd "COKE" */
  key: string;
  material: string;
  unit: string;
  generators: BalanceItem[];
  consumers: BalanceItem[];
  /** Ngưỡng loss rate (%) */
  standardLossRate: number;
  /** "<" | "<=" */
  standardOperator: string;
  /** true: so sánh |loss rate| */
  standardAbsolute: boolean;
  /** Cảnh báo từ backend, vd nguồn chưa tách được theo lò cao */
  notes: string[];
};

export type TrendPoint = {
  label: string; // vd "25/09 C1"
  generator: number;
  consumer: number;
  /** null khi Generator = 0 */
  lossRate: number | null;
};

/** Loss rate đạt tiêu chuẩn theo cấu hình của material */
export const isDat = (lossRate: number, m: Pick<MaterialBalance, "standardLossRate" | "standardOperator" | "standardAbsolute">) => {
  const v = m.standardAbsolute ? Math.abs(lossRate) : lossRate;
  return m.standardOperator === "<" ? v < m.standardLossRate : v <= m.standardLossRate;
};

export const canBangNLApi = {
  // apiService đã unwrap response.data trong interceptor
  getCanBang: (filter: CanBangNLFilter) =>
    apiService.get("/api/CanBangNL", { params: filter }) as unknown as Promise<MaterialBalance[]>,

  /** material = key của MaterialBalance (mã rule) */
  getTrend: (filter: CanBangNLFilter & { material: string; soNgay: number }) =>
    apiService.get("/api/CanBangNL/trend", { params: filter }) as unknown as Promise<TrendPoint[]>,
};
