import { Menu } from "antd";
import { menuConfig } from "../utils/configs/menuConfig";
import { bmQuyenConfig } from "../utils/configs/bmQuyenConfig";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isAdminUser } from "../utils/helpers/checkAdminRole";
import {
  BmQuyenXlApi,
  type MenuPermissionsResponse,
} from "../services/BmQuyenXlApi";

const SidebarMenu = () => {
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [menuPermissions, setMenuPermissions] =
    useState<MenuPermissionsResponse | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("userinfo");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        setUser(null);
      }
    } else {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const raw =
      user?.iD_TaiKhoan ??
      user?.ID_TaiKhoan ??
      user?.idTaiKhoan ??
      user?.IdTaiKhoan;
    const idTaiKhoan = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(idTaiKhoan) || idTaiKhoan <= 0) {
      setMenuPermissions(null);
      return;
    }
    BmQuyenXlApi.getMenuPermissions(idTaiKhoan)
      .then((res) =>
        setMenuPermissions(
          res ?? {
            processingForms: [],
            approvingForms: [],
            viewingForms: [],
            chotPhieuForms: [],
          },
        ),
      )
      .catch(() => setMenuPermissions(null));
  }, [user]);

  /**
   * Lọc item theo maBM: item có maBM thì hiển thị khi maBM nằm trong allowedSet (hoặc allowAll).
   *
   * `strictMaBM: true` trên item → KHÔNG bypass cho admin/P.KH (allowAll bị bỏ qua), chỉ dựa
   * đúng vào allowedSet thực tế — dùng cho các item đã có đường vào không giới hạn khác (vd
   * "Thống kê dữ liệu HRC1/HRC2" ở vùng 3 đã có bản gốc không giới hạn ở vùng 4).
   * Vẫn fail-open khi `menuPermissions` chưa tải xong/lỗi (null) để tránh ẩn nhầm.
   */
  const filterByMaBM = useCallback(
    (
      items: {
        key?: string;
        maBM?: string;
        strictMaBM?: boolean;
        children?: unknown[];
        [k: string]: unknown;
      }[],
      allowedSet: Set<string>,
      allowAll: boolean,
    ): typeof items => {
      return items
        .filter((item) => {
          const roles = item.roles as string[] | undefined;
          if (Array.isArray(roles) && roles.includes("admin"))
            return isAdminUser(user);
          if (Array.isArray(roles) && roles.includes("PKH"))
            return user?.tenNgan === "P.KH";
          if (item.maBM != null && item.maBM !== "") {
            const effectiveAllowAll = item.strictMaBM
              ? menuPermissions === null
              : allowAll;
            return effectiveAllowAll || allowedSet.has(item.maBM);
          }
          return true;
        })
        .map((item) => {
          if (item.children && Array.isArray(item.children)) {
            const filteredChildren = filterByMaBM(
              item.children as {
                key?: string;
                maBM?: string;
                strictMaBM?: boolean;
                children?: unknown[];
                [k: string]: unknown;
              }[],
              allowedSet,
              allowAll,
            );
            return { ...item, children: filteredChildren };
          }
          return item;
        })
        .filter((item) => {
          if (
            item.children &&
            Array.isArray(item.children) &&
            item.children.length === 0
          )
            return false;
          return true;
        });
    },
    [user, menuPermissions],
  );

  const filteredMenu = useMemo(() => {
    if (!user) return [];
    const isAdmin = isAdminUser(user);
    const isPKH = user?.tenNgan === "P.KH";
    const showAll = isAdmin || isPKH || menuPermissions === null;

    // vung 1 = xử lý, vung 2 = phê duyệt, vung 3 = chỉ xem — luôn là danh sách thật
    // (không wildcard), để các item `strictMaBM` vẫn kiểm tra được đúng quyền thật
    // ngay cả khi admin/P.KH thường được bypass (showAll) ở các item khác.
    const vungSets: Record<number, Set<string>> = {
      1: new Set<string>(menuPermissions?.processingForms ?? []),
      2: new Set<string>(menuPermissions?.approvingForms ?? []),
      3: new Set<string>(menuPermissions?.viewingForms ?? []),
      4: new Set<string>(menuPermissions?.chotPhieuForms ?? []),
      5: new Set<string>(menuPermissions?.kdlForms ?? []),
      6: new Set<string>(menuPermissions?.qtriForms ?? []),
    };

    // Quyền mở rộng riêng theo BM (value >= 6, vd "Xác nhận PCN") — BE chỉ trả raw
    // (maBm, quyenChucNang), FE tự tra `extraQuyens[].vung` trong bmQuyenConfig.ts
    // để biết cộng maBm này vào đúng vungSets nào.
    for (const eq of menuPermissions?.extraQuyens ?? []) {
      const bm = bmQuyenConfig.danhSachBieuMau.find((b) => b.maBm === eq.maBm);
      const def = bm?.extraQuyens?.find((q) => q.value === eq.quyenChucNang);
      if (def?.vung != null) {
        if (!vungSets[def.vung]) vungSets[def.vung] = new Set<string>();
        vungSets[def.vung].add(eq.maBm);
      }
    }

    type Item = {
      key?: string;
      vung?: number;
      maBM?: string;
      strictMaBM?: boolean;
      children?: unknown[];
      [k: string]: unknown;
    };

    const filterMenuItems = (items: Item[]): Item[] => {
      return items
        .filter((item) => {
          const roles = item.roles as string[] | undefined;
          if (Array.isArray(roles)) {
            const passesRoles =
              (roles.includes("admin") && isAdmin) ||
              (roles.includes("PKH") && user?.tenNgan === "P.KH");
            if (passesRoles) return true;
            // Fallback: nếu item có vung và user có quyền trong vung đó → vẫn cho xem parent
            const vung = item.vung as number | undefined;
            if (vung != null) {
              const set = vungSets[vung];
              return set != null && set.size > 0;
            }
            return false;
          }
          return true;
        })
        .map((item) => {
          if (item.children && Array.isArray(item.children)) {
            const vung = item.vung as number | undefined;
            const set = vung != null ? vungSets[vung] : undefined;
            const filteredChildren =
              set != null
                ? filterByMaBM(item.children as Item[], set, showAll)
                : filterMenuItems(item.children as Item[]);
            return { ...item, children: filteredChildren };
          }
          return item;
        })
        .filter((item) => {
          if (
            item.children &&
            Array.isArray(item.children) &&
            item.children.length === 0
          )
            return false;
          return true;
        });
    };

    const filtered = filterMenuItems(
      menuConfig as {
        key?: string;
        vung?: number;
        maBM?: string;
        children?: unknown[];
        [k: string]: unknown;
      }[],
    );

    // Xóa custom props (maBM, roles) để tránh React warning khi antd spread xuống DOM
    const stripCustomProps = (items: typeof filtered): typeof filtered =>
      items?.map((item) => {
        const { children, ...rest } = item as Record<string, unknown>;
        const clean = { ...rest } as Record<string, unknown>;
        delete clean.maBM;
        delete clean.roles;
        delete clean.strictMaBM;
        return {
          ...clean,
          ...(children
            ? { children: stripCustomProps(children as typeof filtered) }
            : {}),
        };
      });

    return stripCustomProps(filtered) as React.ComponentProps<
      typeof Menu
    >["items"];
  }, [user, menuPermissions, filterByMaBM]);

  if (!user) return null;

  return (
    <Menu
      theme="light"
      mode="inline"
      defaultSelectedKeys={["1"]}
      items={filteredMenu}
    />
  );
};

export default SidebarMenu;
