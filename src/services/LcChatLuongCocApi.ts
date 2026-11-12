import apiService from "./ApiService";
import type { ChatLuongCocRow } from "../components/LC_BCSX_XNL/TabChatLuongCoc";

// Đọc/lưu trực tiếp bảng quan hệ LC_TP_ChatLuongCocCa cho tab Chất lượng cốc — KHÔNG qua
// BmPhieu.DataJson (cùng nguyên tắc với LcTieuHaoApi). Xem LC_ThanhPhamController (mục 7).

const BASE = "/api/LC_ThanhPham";

export const SO_LAN_CHAT_LUONG_COC = 6;

export interface ChiTieuCocDto {
  id: number;
  ten: string;
  donVi?: string | null;
  coPhanLoai: boolean;
  thuTu?: number | null;
}

export interface TcnbCocDto {
  chiTieuId: number;
  loai: number;
  giaTriTCNB?: number | null;
}

export interface ChatLuongCocDanhMuc {
  chiTieu: ChiTieuCocDto[];
  tcnb: TcnbCocDto[];
}

interface ChatLuongCocDto {
  chiTieuId: number;
  lan: number;
  giaTri?: number | null;
  datYeuCau?: boolean | null;
}

const toNumberOrNull = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

type LanRecord = Record<string, number | string | null | undefined>;

export const LcChatLuongCocApi = {
  getDanhMuc: async (): Promise<ChatLuongCocDanhMuc> => {
    const res = (await apiService.get(`${BASE}/danh-muc-chat-luong-coc`)) as ChatLuongCocDanhMuc | undefined;
    return { chiTieu: res?.chiTieu ?? [], tcnb: res?.tcnb ?? [] };
  },

  /** DB lưu mỗi giá trị 1 dòng (chỉ tiêu, lần) → gộp lại thành 1 dòng UI / chỉ tiêu (lan1..lan6). */
  getByPhieu: async (phieuId: string, scope: number): Promise<ChatLuongCocRow[]> => {
    const list =
      ((await apiService.get(`${BASE}/chat-luong-coc`, { params: { phieuId, scope } })) as ChatLuongCocDto[]) ?? [];
    const byChiTieu = new Map<number, ChatLuongCocRow>();
    list.forEach((x) => {
      const row = byChiTieu.get(x.chiTieuId) ?? { key: `ct-${x.chiTieuId}`, chiTieuId: x.chiTieuId };
      if (x.lan >= 1 && x.lan <= SO_LAN_CHAT_LUONG_COC && x.giaTri !== null && x.giaTri !== undefined) {
        (row as unknown as LanRecord)[`lan${x.lan}`] = x.giaTri;
      }
      // "Đánh giá" của chỉ tiêu được lưu lặp trên các dòng của nó — lấy giá trị đầu tiên có
      if (row.danhGia === undefined && x.datYeuCau !== null && x.datYeuCau !== undefined) {
        row.danhGia = x.datYeuCau;
      }
      byChiTieu.set(x.chiTieuId, row);
    });
    return Array.from(byChiTieu.values());
  },

  /**
   * Thay toàn bộ kết quả của phiếu + scope. Chỉ gửi các ô đã nhập giá trị, mỗi dòng kèm "Đánh giá"
   * của chỉ tiêu; chỉ tiêu đã đánh giá mà chưa có giá trị nào thì gửi 1 dòng lần 1 (giá trị trống)
   * để không mất đánh giá.
   */
  save: async (phieuId: string, scope: number, rows: ChatLuongCocRow[]): Promise<void> => {
    const items = rows.flatMap((r) => {
      const datYeuCau = r.danhGia ?? null;
      const withValue = Array.from({ length: SO_LAN_CHAT_LUONG_COC }, (_, i) => ({
        chiTieuId: r.chiTieuId,
        lan: i + 1,
        giaTri: toNumberOrNull((r as unknown as LanRecord)[`lan${i + 1}`]),
        datYeuCau,
      })).filter((x) => x.giaTri !== null);
      if (withValue.length === 0 && datYeuCau !== null) {
        return [{ chiTieuId: r.chiTieuId, lan: 1, giaTri: null, datYeuCau }];
      }
      return withValue;
    });
    await apiService.put(`${BASE}/chat-luong-coc`, items, { params: { phieuId, scope } });
  },
};

// ─── Cỡ hạt cốc (LC_TP_CoHatCoc) — TP1 only, by-phieu (KHÔNG cần tham số scope: luôn = 1).
// TP2 không có mục này (có "Chất lượng cốc" ở trên thay thế) — xem TabChatLuongCoc.tsx. ───

export interface CoHatCocRow {
  key?: string | number;
  thoiGianLayMau?: string | null;
  viTriLayMau?: string | null;
  pctDuoi10mm?: string | number | null;
  pct10Den25mm?: string | number | null;
  pct25Den80mm?: string | number | null;
  pct40Den80mm?: string | number | null;
  pctTren80mm?: string | number | null;
}

interface CoHatCocDto {
  stt: number;
  thoiGianLayMau?: string | null;
  viTriLayMau?: string | null;
  pctDuoi10mm?: number | null;
  pct10Den25mm?: number | null;
  pct25Den80mm?: number | null;
  pct40Den80mm?: number | null;
  pctTren80mm?: number | null;
}

// <input type="datetime-local"> cần đúng "YYYY-MM-DDTHH:mm" (không giây/timezone)
const toDatetimeLocal = (v: string | null | undefined): string | null => (v ? v.slice(0, 16) : null);
const toIsoDatetime = (v: string | null | undefined): string | null => (v ? `${v}:00` : null);

export const LcCoHatCocApi = {
  getByPhieu: async (idPhieu: string): Promise<CoHatCocRow[]> => {
    const list = ((await apiService.get(`${BASE}/co-hat-coc/by-phieu/${idPhieu}`)) as CoHatCocDto[]) ?? [];
    return list.map((x) => ({
      key: `cht-${x.stt}`,
      thoiGianLayMau: toDatetimeLocal(x.thoiGianLayMau),
      viTriLayMau: x.viTriLayMau ?? null,
      pctDuoi10mm: x.pctDuoi10mm ?? null,
      pct10Den25mm: x.pct10Den25mm ?? null,
      pct25Den80mm: x.pct25Den80mm ?? null,
      pct40Den80mm: x.pct40Den80mm ?? null,
      pctTren80mm: x.pctTren80mm ?? null,
    }));
  },

  save: async (idPhieu: string, rows: CoHatCocRow[]): Promise<void> => {
    const items = rows.map((r, i) => ({
      stt: i + 1,
      thoiGianLayMau: toIsoDatetime(r.thoiGianLayMau),
      viTriLayMau: r.viTriLayMau || null,
      pctDuoi10mm: toNumberOrNull(r.pctDuoi10mm),
      pct10Den25mm: toNumberOrNull(r.pct10Den25mm),
      pct25Den80mm: toNumberOrNull(r.pct25Den80mm),
      pct40Den80mm: toNumberOrNull(r.pct40Den80mm),
      pctTren80mm: toNumberOrNull(r.pctTren80mm),
    }));
    await apiService.put(`${BASE}/co-hat-coc/by-phieu/${idPhieu}`, items);
  },
};
