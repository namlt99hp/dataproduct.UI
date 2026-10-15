import { useEffect, useMemo, useState } from "react";
import { MayDucServiceApi, type MayDuc } from "../services/MayDucServiceApi";

/**
 * Danh sách máy đúc theo nhà máy, lấy động từ bảng MayDuc (nguồn duy nhất).
 * Quy ước: MayDuc.Id = BmPhieu.Scope = BmQuyenXl.MaKhuVuc của biên bản giao nhận thép lỏng.
 *
 * Cache theo nhaMay ở module để nhiều màn hình chỉ gọi API 1 lần; Settings/MayDuc gọi
 * invalidateMayDucCache() sau khi thêm/sửa/khóa để các màn hình khác thấy máy mới.
 */

export interface MayDucOption {
  label: string;
  value: number;
  disabled?: boolean;
}

const _cache = new Map<number, Promise<MayDuc[]>>();
const _listeners = new Set<() => void>();

export const loadMayDucs = (nhaMay: number): Promise<MayDuc[]> => {
  let p = _cache.get(nhaMay);
  if (!p) {
    // Không truyền isLock → lấy cả máy đã khóa (chỉ để tra tên cho phiếu/quyền cũ; options tự lọc bỏ)
    p = MayDucServiceApi.search({ nhaMay, page: 1, pageSize: 200 })
      .then((res) => res.data)
      .catch((e) => {
        _cache.delete(nhaMay);
        throw e;
      });
    _cache.set(nhaMay, p);
  }
  return p;
};

export const invalidateMayDucCache = () => {
  _cache.clear();
  _listeners.forEach((fn) => fn());
};

/** Tăng version mỗi khi cache bị invalidate — dùng làm dependency để nạp lại */
export const useMayDucCacheVersion = () => {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const fn = () => setVersion((v) => v + 1);
    _listeners.add(fn);
    return () => { _listeners.delete(fn); };
  }, []);
  return version;
};

export const toMayDucLabel = (m: Pick<MayDuc, "tenMayDuc" | "isLock">) =>
  m.isLock ? `${m.tenMayDuc} (ngừng)` : m.tenMayDuc;

/**
 * Máy đã khóa không hiển thị trong options. Ngoại lệ: Id nằm trong `keepIds` (giá trị đang có sẵn
 * của phiếu/mẻ/quyền) → vẫn giữ nhưng disabled, để Select hiện tên thay vì Id trần.
 */
export const buildMayDucOptions = <T extends { id: number; tenMayDuc: string; isLock?: boolean | null }>(
  mayDucs: T[],
  keepIds?: Array<number | null | undefined>,
): MayDucOption[] => {
  const keep = new Set((keepIds ?? []).filter((x): x is number => x != null).map(Number));
  return mayDucs
    .filter((m) => !m.isLock || keep.has(m.id))
    .map((m) => ({ label: toMayDucLabel(m), value: m.id, disabled: !!m.isLock }));
};

export const useMayDucOptions = (nhaMay: number | null | undefined) => {
  const [mayDucs, setMayDucs] = useState<MayDuc[]>([]);
  const [loading, setLoading] = useState(false);
  const version = useMayDucCacheVersion();

  useEffect(() => {
    if (nhaMay == null) { setMayDucs([]); return; }
    let cancelled = false;
    setLoading(true);
    loadMayDucs(nhaMay)
      .then((data) => { if (!cancelled) setMayDucs(data); })
      .catch((e) => { console.error("Load máy đúc failed:", e); if (!cancelled) setMayDucs([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [nhaMay, version]);

  return useMemo(() => {
    const sorted = [...mayDucs].sort((a, b) => a.id - b.id);
    const tenById = new Map(sorted.map((m) => [m.id, m.tenMayDuc]));
    return {
      mayDucs: sorted,
      loading,
      /** Options: chỉ máy đang dùng — máy đã khóa (IsLock) không hiển thị để chọn */
      options: buildMayDucOptions(sorted),
      /** Như `options`, nhưng giữ thêm máy đã khóa nếu đang là giá trị sẵn có (disabled, để hiện tên thay vì Id) */
      getOptions: (keepIds?: Array<number | null | undefined>) => buildMayDucOptions(sorted, keepIds),
      /** Tên máy theo Id (kể cả đã khóa) — dùng hiển thị phiếu/mẻ cũ */
      getTen: (id: number | null | undefined) => (id != null ? tenById.get(id) : undefined),
    };
  }, [mayDucs, loading]);
};
