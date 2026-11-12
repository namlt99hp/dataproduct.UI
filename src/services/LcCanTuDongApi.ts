import apiService from "./ApiService";

// "Cân tự động" cho TabCapLieuSilo — đọc dữ liệu cân thô (LC_CanTuDongRawLog) đúng slot của
// phiếu rồi "Gán" SUM vào KhoiLuongAmThucTe của LC_CapLieu, ghi NGAY không qua nút Lưu phiếu.
// Xem Controllers/NM.LC/LC_CanTuDongController.cs và [[lc-bcsx-xnl-cantudong-design]].

export interface CanTuDongRawLogRow {
  id: number;
  ngayGio: string;
  tenCan: string | null;
  loaiLieuTen: string | null;
  khoiLuong: number;
  isDaGan: boolean;
}

export interface CanTuDongGanResult {
  siloSo: number;
  stt: number;
  khoiLuongAmThucTe: number;
  khoiLuongAmThucTeCanTuDong: number;
  rawLogRows: CanTuDongRawLogRow[];
}

interface BackendRawLogRow {
  id?: number; Id?: number;
  ngayGio?: string; NgayGio?: string;
  tenCan?: string | null; TenCan?: string | null;
  loaiLieuTen?: string | null; LoaiLieuTen?: string | null;
  khoiLuong?: number; KhoiLuong?: number;
  isDaGan?: boolean; IsDaGan?: boolean;
}

interface BackendGanResult {
  siloSo?: number; SiloSo?: number;
  stt?: number; Stt?: number;
  khoiLuongAmThucTe?: number; KhoiLuongAmThucTe?: number;
  khoiLuongAmThucTeCanTuDong?: number; KhoiLuongAmThucTeCanTuDong?: number;
  rawLogRows?: BackendRawLogRow[]; RawLogRows?: BackendRawLogRow[];
}

const toRawLogRow = (x: BackendRawLogRow): CanTuDongRawLogRow => ({
  id: x.id ?? x.Id ?? 0,
  ngayGio: x.ngayGio ?? x.NgayGio ?? "",
  tenCan: x.tenCan ?? x.TenCan ?? null,
  loaiLieuTen: x.loaiLieuTen ?? x.LoaiLieuTen ?? null,
  khoiLuong: x.khoiLuong ?? x.KhoiLuong ?? 0,
  isDaGan: x.isDaGan ?? x.IsDaGan ?? false,
});

export const LcCanTuDongApi = {
  /** Đọc thuần dữ liệu đã có trong LC_CanTuDongRawLog, KHÔNG chạy SP đồng bộ — dùng để tự
   *  render khi mở tab/phiếu. */
  getByPhieu: async (idPhieu: string): Promise<CanTuDongRawLogRow[]> => {
    const res = (await apiService.get(`/api/LC_CanTuDong/by-phieu/${idPhieu}`)) as BackendRawLogRow[];
    return Array.isArray(res) ? res.map(toRawLogRow) : [];
  },

  /** Chủ động chạy SP đồng bộ (đúng Scope của phiếu) rồi đọc lại — chỉ gọi khi người dùng bấm
   *  "Làm mới dữ liệu cân". */
  sync: async (idPhieu: string): Promise<CanTuDongRawLogRow[]> => {
    const res = (await apiService.post(`/api/LC_CanTuDong/by-phieu/${idPhieu}/sync`, {})) as BackendRawLogRow[];
    return Array.isArray(res) ? res.map(toRawLogRow) : [];
  },

  gan: async (
    idPhieu: string,
    req: { siloSo: number; stt: number; rawLogIds: number[] }
  ): Promise<CanTuDongGanResult> => {
    const res = (await apiService.post(`/api/LC_CanTuDong/by-phieu/${idPhieu}/gan`, req)) as BackendGanResult;
    return {
      siloSo: res.siloSo ?? res.SiloSo ?? req.siloSo,
      stt: res.stt ?? res.Stt ?? req.stt,
      khoiLuongAmThucTe: res.khoiLuongAmThucTe ?? res.KhoiLuongAmThucTe ?? 0,
      khoiLuongAmThucTeCanTuDong: res.khoiLuongAmThucTeCanTuDong ?? res.KhoiLuongAmThucTeCanTuDong ?? 0,
      rawLogRows: (res.rawLogRows ?? res.RawLogRows ?? []).map(toRawLogRow),
    };
  },

  /** "Bỏ gán" — undo toàn bộ (KhoiLuongAmThucTe + snapshot về null), mở khoá lại các dòng
   *  RawLog đã dùng cho lần Gán đó. Trả về danh sách RawLog đã làm mới (IsDaGan đã mở lại). */
  boGan: async (idPhieu: string, req: { siloSo: number; stt: number }): Promise<CanTuDongRawLogRow[]> => {
    const res = (await apiService.post(`/api/LC_CanTuDong/by-phieu/${idPhieu}/bo-gan`, req)) as BackendRawLogRow[];
    return Array.isArray(res) ? res.map(toRawLogRow) : [];
  },
};
