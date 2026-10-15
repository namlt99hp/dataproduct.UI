import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { PhieuApi } from "../services/PhieuApi";
import type { SearchPhieuByUserRequest, SearchPhieuResponseModel } from "../models/Phieu";
import type { PhieuFilterValues } from "../components/PhieuFilterCard";
import { getThongTinUser } from "../utils/constants/GetThongTinLocalStore";
import { BmQuyenXlApi, type BmQuyenXlModel } from "../services/BmQuyenXlApi";
import { bmQuyenConfig } from "../utils/configs/bmQuyenConfig";
import { useBmScopes } from "./useBmScopes";

// Keyed by React Router location.key — tự động clear khi user navigate forward (key mới),
// tự động restore khi user bấm Back (key cũ). Per-tab vì module scope.
const _requestCache = new Map<string, SearchPhieuByUserRequest>();

interface PagedResponse<T> {
  data?: T[];
  Data?: T[];
  totalRecords?: number;
  TotalRecords?: number;
  page?: number;
  Page?: number;
  pageSize?: number;
  PageSize?: number;
  totalPages?: number;
  TotalPages?: number;
}

export interface UsePhieuSearchListOptions {
  maBm?: string;
  maBmList?: string[];
  initialPageSize?: number;
  fixedFilters?: Partial<SearchPhieuByUserRequest>;
  autoLoad?: boolean;
  transformFilters?: (filters: PhieuFilterValues) => Partial<SearchPhieuByUserRequest>;
  /** Persist last search request to sessionStorage.
   *  true  → auto key from window.location.pathname
   *  string → use as explicit key */
  persistKey?: string | true;
}

const normalizeNumber = (value: string | number | undefined): number | null => {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
};

const defaultTransform = (filters: PhieuFilterValues): Partial<SearchPhieuByUserRequest> => ({
  tuNgay: (filters.ngaySXFrom || filters.fromDate || null) as string | null,
  denNgay: (filters.ngaySXTo || filters.toDate || null) as string | null,
  ca: normalizeNumber(filters.ca),
  kip: (filters.kip as string | null | undefined) || null,
  scope: normalizeNumber(filters.scope),
  mayDuc: normalizeNumber(filters.mayDuc),
  tinhTrang: normalizeNumber(filters.tinhTrang),
  searchText: (filters.soPhieu || filters.searchText || null) as string | null,
});

export const usePhieuSearchListHRC = ({
  maBm,
  maBmList,
  initialPageSize = 10,
  fixedFilters = {},
  autoLoad = true,
  transformFilters = defaultTransform,
  persistKey,
}: UsePhieuSearchListOptions) => {
  const location = useLocation();
  const locationKey = location.key;
  // Kiểm tra user có phải PKH không (tenNgan = "P.KH" hoặc iD_PhongBan = 70)
  const isPKH = useMemo(() => {
    const user = getThongTinUser();
    return user.tenNgan === "P.KH" || user.iD_PhongBan === 70;
  }, []);

  // PKH: bỏ userId để backend không lọc theo quyền cá nhân.
  // ThongKe pages tự set loaiVung=4+isThongKeUser=true nên backend trả hết phiếu.
  // Non-ThongKe pages (loaiVung 1/2/3) không có userId → backend trả rỗng (đúng hành vi).
  const effectiveFixedFilters = useMemo(() => {
    // if (isPKH) {
    //   const rest = { ...(fixedFilters as Record<string, unknown>) };
    //   delete rest.userId;
    //   return rest;
    // }
    return fixedFilters;
  }, [isPKH, fixedFilters]);

  // ── Permission records: fetched once per userId, used to filter scope options ──
  const [userQuyenRecords, setUserQuyenRecords] = useState<BmQuyenXlModel[] | null>(null);

  const effectiveUserId = useMemo(
    () => (effectiveFixedFilters as Record<string, unknown>).userId as number | undefined,
    [effectiveFixedFilters]
  );

  useEffect(() => {
    if (!effectiveUserId || effectiveUserId <= 0) {
      setUserQuyenRecords(null);
      return;
    }
    BmQuyenXlApi.getByTaiKhoan(effectiveUserId)
      .then((res) => {
        const arr: BmQuyenXlModel[] = Array.isArray(res) ? res : ((res as any)?.data ?? []);
        setUserQuyenRecords(arr);
      })
      .catch(() => setUserQuyenRecords(null));
  }, [effectiveUserId]);

  // Scope của BM: động (scopeSource, vd máy đúc từ bảng MayDuc) hoặc tĩnh (bmQuyenConfig.scope)
  const { getScope } = useBmScopes();

  /** Quyền mở rộng (extraQuyens) của 1 maBm khớp đúng vùng đang xét — xem bmQuyenConfig.ts */
  const getExtraQuyenValuesForVung = (maBm: string, loaiVung: number): number[] => {
    const bmDef = bmQuyenConfig.danhSachBieuMau.find((b) => b.maBm === maBm);
    return (bmDef?.extraQuyens ?? [])
      .filter((q) => q.vung === loaiVung)
      .map((q) => q.value);
  };

  /**
   * Trả về options cho filter scope của một BM, đã lọc theo MaKhuVuc của user.
   * - isThongKeUser / chưa load records → trả tất cả options trong bmQuyenConfig.
   * - MaKhuVuc="ALL" → trả tất cả.
   * - Không có record nào cho BM đó → fallback trả tất cả (graceful).
   */
  const getAllowedScopeOptions = useCallback(
    (maBm: string, customAllOptions?: Array<{ label: string; value: number }>): Array<{ label: string; value: number }> => {
      const allOptions = customAllOptions ?? getScope(maBm).map((s) => ({
        value: Number(s.maKhuVuc),
        label: s.tenKhuVuc,
      }));

      if (allOptions.length === 0) return [];

      const ctx = effectiveFixedFilters as Record<string, unknown>;
      if (ctx.isThongKeUser === true || !userQuyenRecords) return allOptions;

      const loaiVung = Number(ctx.loaiVung ?? 1);
      const extraValues = getExtraQuyenValuesForVung(maBm, loaiVung);
      const relevantQuyens =
        loaiVung === 2 ? new Set([2, 4, ...extraValues]) :
        loaiVung === 3 ? new Set([5, ...extraValues]) :
        new Set([1, 4, ...extraValues]); // default loaiVung=1

      const bmRecords = userQuyenRecords.filter(
        (r) =>
          r.maBm === maBm &&
          r.quyenChucNang != null &&
          relevantQuyens.has(Number(r.quyenChucNang))
      );

      if (bmRecords.length === 0) return allOptions;
      if (bmRecords.some((r) => !r.maKhuVuc || r.maKhuVuc === "ALL")) return allOptions;

      const allowed = new Set(bmRecords.map((r) => r.maKhuVuc));
      return allOptions.filter((opt) => allowed.has(String(opt.value)));
    },
    [userQuyenRecords, effectiveFixedFilters, getScope]
  );

  const getAllowedBmOptions = useCallback(
    (bmOptions: Array<{ label: string; value: string }>): Array<{ label: string; value: string }> => {
      const ctx = effectiveFixedFilters as Record<string, unknown>;
      if (ctx.isThongKeUser === true || !userQuyenRecords) return bmOptions;

      const loaiVung = Number(ctx.loaiVung ?? 1);
      const baseQuyens =
        loaiVung === 2 ? new Set([2, 4]) :
        loaiVung === 3 ? new Set([5]) :
        new Set([1, 4]);

      const accessibleBms = new Set(
        userQuyenRecords
          .filter((r) => {
            if (r.quyenChucNang == null || !r.maBm) return false;
            const q = Number(r.quyenChucNang);
            if (baseQuyens.has(q)) return true;
            return getExtraQuyenValuesForVung(r.maBm, loaiVung).includes(q);
          })
          .map((r) => r.maBm)
          .filter(Boolean)
      );

      if (accessibleBms.size === 0) return bmOptions;
      return bmOptions.filter((opt) => accessibleBms.has(opt.value));
    },
    [userQuyenRecords, effectiveFixedFilters]
  );

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SearchPhieuResponseModel[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: initialPageSize,
    total: 0,
  });
  const [currentFilter, setCurrentFilter] = useState<SearchPhieuByUserRequest | null>(null);

  const buildRequest = useCallback(
    (page: number, pageSize: number, overrides?: Partial<SearchPhieuByUserRequest>): SearchPhieuByUserRequest => {
      const merged = { ...effectiveFixedFilters, ...overrides } as Record<string, unknown>;
      const rawLv = merged.loaiVung;
      const loaiVung =
        rawLv === null || rawLv === undefined || rawLv === ""
          ? 1
          : Number.isFinite(Number(rawLv))
            ? Number(rawLv)
            : 1;

      // Quyền mở rộng (extraQuyens) khớp đúng vùng đang query, gộp cho mọi maBm liên quan —
      // FE tự tính từ bmQuyenConfig.ts, BE chỉ dùng raw list này để lọc, không hard-code giá trị.
      const relevantMaBms = maBmList ?? (maBm ? [maBm] : []);
      const extraQuyenChucNangs = [...new Set(
        relevantMaBms.flatMap((bm) => getExtraQuyenValuesForVung(bm, loaiVung))
      )];

      return {
        page,
        pageSize,
        maBm: maBmList ? undefined : maBm,
        maBmList: maBmList ?? undefined,
        tuNgay: null,
        denNgay: null,
        ca: null,
        kip: null,
        scope: null,
        mayDuc: null,
        searchText: null,
        tinhTrang: null,
        ...effectiveFixedFilters,
        ...overrides,
        loaiVung,
        extraQuyenChucNangs: extraQuyenChucNangs.length > 0 ? extraQuyenChucNangs : undefined,
      };
    },
    [effectiveFixedFilters, maBm, maBmList]
  );

  const fetchData = useCallback(async (request: SearchPhieuByUserRequest) => {
    if (persistKey) _requestCache.set(locationKey, request);
    setLoading(true);
    try {
      const res = await PhieuApi.searchByUser(request);
      const payload = res as PagedResponse<SearchPhieuResponseModel>;
      const responseData = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.Data)
        ? payload.Data
        : [];

      const normalizedData = isPKH
        ? responseData.filter((item: SearchPhieuResponseModel) => {
            const row = item as unknown as Record<string, unknown>;
            const isDelete = row.isDelete === true || row.IsDelete === true || row.isDelete === 1 || row.IsDelete === 1;
            const isLock = row.isLock === true || row.IsLock === true || row.isLock === 1 || row.IsLock === 1;
            return !(isDelete && isLock);
          })
        : responseData;
      setData(normalizedData);
      setCurrentFilter(request);

      const totalRecords = payload?.totalRecords ?? payload?.TotalRecords ?? responseData.length;
      setPagination((prev) => ({
        current: payload?.page ?? payload?.Page ?? request.page ?? prev.current,
        pageSize: payload?.pageSize ?? payload?.PageSize ?? request.pageSize ?? prev.pageSize,
        total: totalRecords ?? prev.total,
      }));
    } catch (error) {
      console.error("usePhieuSearchList.fetchData error:", error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [isPKH]);

  const handleFilter = useCallback(
    (filters: PhieuFilterValues) => {
      const transformed = transformFilters(filters);
      const request = buildRequest(1, pagination.pageSize, {
        ...transformed,
      });
      fetchData(request);
    },
    [buildRequest, fetchData, pagination.pageSize, transformFilters]
  );

  const handleClearFilter = useCallback(() => {
    if (persistKey) _requestCache.delete(locationKey);
    const request = buildRequest(1, pagination.pageSize);
    fetchData(request);
  }, [buildRequest, fetchData, locationKey, pagination.pageSize, persistKey]);

  const onPageChange = useCallback(
    (page: number, pageSize: number) => {
      const base = currentFilter ?? buildRequest(page, pageSize);
      fetchData({ ...base, page, pageSize });
    },
    [buildRequest, currentFilter, fetchData]
  );

  useEffect(() => {
    if (!autoLoad) return;
    if (persistKey) {
      const cached = _requestCache.get(locationKey);
      if (cached) { fetchData(cached); return; }
    }
    fetchData(buildRequest(1, initialPageSize));
  }, [autoLoad, buildRequest, fetchData, initialPageSize, locationKey, persistKey]);

  return {
    data,
    loading,
    pagination,
    handleFilter,
    handleClearFilter,
    onPageChange,
    getAllowedScopeOptions,
    getAllowedBmOptions,
    refetch: () => {
      if (currentFilter) {
        fetchData(currentFilter);
      } else {
        handleClearFilter();
      }
    },
  };
};

