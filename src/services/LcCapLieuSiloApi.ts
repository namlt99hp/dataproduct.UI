import apiService from "./ApiService";
import type { CapLieuRow, CoHatNghien1Row } from "../components/LC_BCSX_XNL/TabCapLieuSilo";

// Đọc/lưu trực tiếp bảng quan hệ (LC_CapLieu/LC_TonSilo/LC_KetQuaPhanTich) cho tab Cấp liệu
// & Silo — KHÔNG qua BmPhieu.DataJson (quyết định 2026-10-19: lưu JSON rủi ro lệch dữ liệu).
// Xem Repositories/NM.LC/LC_CapLieuSiloRepository.cs.

interface BackendCapLieuSiloRow {
  siloSo?: number; SiloSo?: number;
  stt?: number; Stt?: number;
  idVatTu?: number | null; IdVatTu?: number | null;
  vatLieuTen?: string | null; VatLieuTen?: string | null;
  idMaLo?: number | null; IdMaLo?: number | null;
  soHieuLo?: string | null; SoHieuLo?: string | null;
  khoiLuongKeHoach?: number | null; KhoiLuongKeHoach?: number | null;
  khoiLuongAmThucTe?: number | null; KhoiLuongAmThucTe?: number | null;
  doAm?: number | null; DoAm?: number | null;
  khoiLuongKhoThucTe?: number | null; KhoiLuongKhoThucTe?: number | null;
  luyKeQuyKho?: number | null; LuyKeQuyKho?: number | null;
  tonDauKyQuyKho?: number | null; TonDauKyQuyKho?: number | null;
  amSiloCuoiKy?: number | null; AmSiloCuoiKy?: number | null;
  klAmTonCuoi?: number | null; KLAmTonCuoi?: number | null;
  doAmSilo?: number | null; DoAmSilo?: number | null;
  klTonCuoiQuyKho?: number | null; KLTonCuoiQuyKho?: number | null;
  ghiChu?: string | null; GhiChu?: string | null;
}

interface BackendCoHatRow {
  nhomPhanTich?: string; NhomPhanTich?: string;
  lan1?: number | null; Lan1?: number | null;
  lan2?: number | null; Lan2?: number | null;
  lan3?: number | null; Lan3?: number | null;
  ghiChu?: string | null; GhiChu?: string | null;
}

interface BackendTabResponse {
  capLieu?: BackendCapLieuSiloRow[]; CapLieu?: BackendCapLieuSiloRow[];
  coHatNghien1?: BackendCoHatRow[]; CoHatNghien1?: BackendCoHatRow[];
}

const KICH_CO_BY_NHOM: Record<string, string> = {
  CO_HAT_1MM: "≤1mm",
  CO_HAT_3MM: "≤3mm",
};

const toCapLieuRow = (x: BackendCapLieuSiloRow, idx: number): CapLieuRow => {
  const stt = x.stt ?? x.Stt ?? 1;
  const siloSo = x.siloSo ?? x.SiloSo ?? idx + 1;
  return {
  key: `silo-${siloSo}-${stt}`,
  siloSo,
  stt,
  idVatTu: x.idVatTu ?? x.IdVatTu ?? null,
  vatLieuTen: x.vatLieuTen ?? x.VatLieuTen ?? null,
  idMaLo: x.idMaLo ?? x.IdMaLo ?? null,
  soHieuLo: x.soHieuLo ?? x.SoHieuLo ?? null,
  khoiLuongKeHoach: x.khoiLuongKeHoach ?? x.KhoiLuongKeHoach ?? null,
  khoiLuongAmThucTe: x.khoiLuongAmThucTe ?? x.KhoiLuongAmThucTe ?? null,
  doAm: x.doAm ?? x.DoAm ?? null,
  khoiLuongKhoThucTe: x.khoiLuongKhoThucTe ?? x.KhoiLuongKhoThucTe ?? null,
  luyKeQuyKho: x.luyKeQuyKho ?? x.LuyKeQuyKho ?? null,
  tonDauKyQuyKho: x.tonDauKyQuyKho ?? x.TonDauKyQuyKho ?? null,
  amSiloCuoiKy: x.amSiloCuoiKy ?? x.AmSiloCuoiKy ?? null,
  klAmTonCuoi: x.klAmTonCuoi ?? x.KLAmTonCuoi ?? null,
  doAmSilo: x.doAmSilo ?? x.DoAmSilo ?? null,
  klTonCuoiQuyKho: x.klTonCuoiQuyKho ?? x.KLTonCuoiQuyKho ?? null,
  ghiChu: x.ghiChu ?? x.GhiChu ?? null,
  };
};

const toCoHatRow = (x: BackendCoHatRow, idx: number): CoHatNghien1Row => {
  const nhom = x.nhomPhanTich ?? x.NhomPhanTich ?? "";
  return {
    key: `co-hat-${nhom || idx}`,
    kichCo: KICH_CO_BY_NHOM[nhom] ?? nhom,
    lan1: x.lan1 ?? x.Lan1 ?? null,
    lan2: x.lan2 ?? x.Lan2 ?? null,
    lan3: x.lan3 ?? x.Lan3 ?? null,
    ghiChu: x.ghiChu ?? x.GhiChu ?? null,
  };
};

const toNumberOrNull = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const NHOM_BY_KICH_CO: Record<string, string> = {
  "≤1mm": "CO_HAT_1MM",
  "≤3mm": "CO_HAT_3MM",
};

const fromResponse = (res: BackendTabResponse): { capLieu: CapLieuRow[]; coHatNghien1: CoHatNghien1Row[] } => {
  const capLieuArr = res.capLieu ?? res.CapLieu ?? [];
  const coHatArr = res.coHatNghien1 ?? res.CoHatNghien1 ?? [];
  return {
    capLieu: capLieuArr.map(toCapLieuRow),
    coHatNghien1: coHatArr.map(toCoHatRow),
  };
};

export const LcCapLieuSiloApi = {
  getByPhieu: async (idPhieu: string): Promise<{ capLieu: CapLieuRow[]; coHatNghien1: CoHatNghien1Row[] }> => {
    const res = (await apiService.get(`/api/LC_CapLieuSilo/by-phieu/${idPhieu}`)) as BackendTabResponse;
    return fromResponse(res);
  },

  save: async (
    idPhieu: string,
    payload: { capLieu: CapLieuRow[]; coHatNghien1: CoHatNghien1Row[] }
  ): Promise<{ capLieu: CapLieuRow[]; coHatNghien1: CoHatNghien1Row[] }> => {
    const body = {
      capLieu: payload.capLieu.map((r) => ({
        siloSo: r.siloSo,
        stt: r.stt ?? 1,
        idVatTu: r.idVatTu ?? null,
        vatLieuTen: r.vatLieuTen ?? null,
        idMaLo: r.idMaLo ?? null,
        soHieuLo: r.soHieuLo ?? null,
        khoiLuongKeHoach: toNumberOrNull(r.khoiLuongKeHoach),
        khoiLuongAmThucTe: toNumberOrNull(r.khoiLuongAmThucTe),
        doAm: toNumberOrNull(r.doAm),
        amSiloCuoiKy: toNumberOrNull(r.amSiloCuoiKy),
        klAmTonCuoi: toNumberOrNull(r.klAmTonCuoi),
        doAmSilo: toNumberOrNull(r.doAmSilo),
        klTonCuoiQuyKho: toNumberOrNull(r.klTonCuoiQuyKho),
        ghiChu: r.ghiChu ?? null,
      })),
      coHatNghien1: payload.coHatNghien1.map((r) => ({
        nhomPhanTich: NHOM_BY_KICH_CO[r.kichCo] ?? r.kichCo,
        lan1: toNumberOrNull(r.lan1),
        lan2: toNumberOrNull(r.lan2),
        lan3: toNumberOrNull(r.lan3),
        ghiChu: r.ghiChu ?? null,
      })),
    };
    const res = (await apiService.put(`/api/LC_CapLieuSilo/by-phieu/${idPhieu}`, body)) as BackendTabResponse;
    return fromResponse(res);
  },

  /** "Làm mới" — tính lại Tồn đầu/Lũy kế theo dữ liệu MỚI NHẤT của kíp liền trước (không
   *  gửi dữ liệu đang nhập của FE lên, không đổi cấu trúc dòng/lớp liệu). */
  refreshTuCaTruoc: async (idPhieu: string): Promise<{ capLieu: CapLieuRow[]; coHatNghien1: CoHatNghien1Row[] }> => {
    const res = (await apiService.post(`/api/LC_CapLieuSilo/by-phieu/${idPhieu}/lam-moi`, {})) as BackendTabResponse;
    return fromResponse(res);
  },
};
