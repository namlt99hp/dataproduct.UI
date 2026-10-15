import { useCallback, useEffect, useState } from "react";
import type { MayDuc } from "../services/MayDucServiceApi";
import { bmQuyenConfig, type KhuVucQuyenItem } from "../utils/configs/bmQuyenConfig";
import { loadMayDucs, toMayDucLabel, useMayDucCacheVersion } from "./useMayDucOptions";

// Các nhà máy có BM dùng scopeSource "mayDuc" — tính 1 lần từ config
const MAY_DUC_NHA_MAYS = [...new Set(
  bmQuyenConfig.danhSachBieuMau
    .filter((b) => b.scopeSource?.type === "mayDuc")
    .map((b) => b.scopeSource!.nhaMay)
)];

/**
 * Resolve danh sách scope của 1 BM: `scopeSource` động (bảng MayDuc) nếu có, ngược lại `scope` tĩnh.
 * Scope động chỉ gồm máy đang dùng (IsLock = false).
 */
export const useBmScopes = () => {
  const [mayDucByNhaMay, setMayDucByNhaMay] = useState<Map<number, MayDuc[]>>(new Map());
  const [loading, setLoading] = useState(MAY_DUC_NHA_MAYS.length > 0);
  const version = useMayDucCacheVersion();

  useEffect(() => {
    if (MAY_DUC_NHA_MAYS.length === 0) return;
    let cancelled = false;
    setLoading(true);
    Promise.all(MAY_DUC_NHA_MAYS.map((nm) => loadMayDucs(nm).catch(() => [] as MayDuc[])))
      .then((lists) => {
        if (cancelled) return;
        setMayDucByNhaMay(new Map(MAY_DUC_NHA_MAYS.map((nm, i) => [nm, lists[i]])));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [version]);

  /**
   * keepValues: maKhuVuc đang có sẵn (vd quyền cũ của user) — máy đã khóa chỉ được giữ lại nếu nằm
   * trong đây (label "(ngừng)"), để hiện tên thay vì Id; ngoài ra máy đã khóa không xuất hiện.
   */
  const getScope = useCallback((maBm?: string, keepValues?: string[]): KhuVucQuyenItem[] => {
    const bm = bmQuyenConfig.danhSachBieuMau.find((b) => b.maBm === maBm);
    if (!bm) return [];
    if (bm.scopeSource?.type === "mayDuc") {
      const keep = new Set(keepValues ?? []);
      return [...(mayDucByNhaMay.get(bm.scopeSource.nhaMay) ?? [])]
        .filter((m) => !m.isLock || keep.has(String(m.id)))
        .sort((a, b) => a.id - b.id)
        .map((m) => ({ maKhuVuc: String(m.id), tenKhuVuc: toMayDucLabel(m) }));
    }
    return bm.scope ?? [];
  }, [mayDucByNhaMay]);

  return { getScope, loading };
};
