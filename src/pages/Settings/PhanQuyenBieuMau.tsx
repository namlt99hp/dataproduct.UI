import { useState, useEffect, useMemo } from "react";
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Select,
  message,
  Popconfirm,
  Space,
  Spin,
} from "antd";
import { PlusOutlined, DeleteOutlined, EditOutlined, MinusCircleOutlined } from "@ant-design/icons";
import { BmQuyenXlApi } from "../../services/BmQuyenXlApi";
import { TaiKhoanApi } from "../../services/TaiKhoanService";
import { bmQuyenConfig, type KhuVucQuyenItem } from "../../utils/configs/bmQuyenConfig";
import { isAdminUser } from "../../utils/helpers/checkAdminRole";
import { useBmScopes } from "../../hooks/useBmScopes";

const ALL_KHU_VUC = "ALL";

interface SubRow {
  key: string;
  maKhuVucs: string[];
  quyenChucNangs: number[];
}

interface BmRow {
  key: string;
  maBm?: string;
  subRows: SubRow[];
  khuVucPhus: string[];
}

// ── helpers ────────────────────────────────────────────────────────────────

// scopes: kết quả useBmScopes().getScope(maBm) — gồm cả scope động (scopeSource) lẫn tĩnh
const getScopeOptions = (scopes: KhuVucQuyenItem[]) => [
  { value: ALL_KHU_VUC, label: "Tất cả" },
  ...scopes.map((s) => ({ value: s.maKhuVuc, label: s.tenKhuVuc })),
];

const getKhuVucPhuOptions = (maBm?: string) => {
  const bm = bmQuyenConfig.danhSachBieuMau.find((b) => b.maBm === maBm);
  return (bm?.khuVucPhus ?? []).map((k) => ({ value: k.khuVucPhu, label: k.tenKhuVuc }));
};

const hasKhuVucPhu = (maBm?: string) => {
  const bm = bmQuyenConfig.danhSachBieuMau.find((b) => b.maBm === maBm);
  return (bm?.khuVucPhus?.length ?? 0) > 0;
};

// Quyền chức năng chung + quyền riêng của BM (extraQuyens) — chỉ hiện extra khi đang chọn đúng BM đó
const getQuyenChucNangOptions = (maBm?: string) => {
  const bm = bmQuyenConfig.danhSachBieuMau.find((b) => b.maBm === maBm);
  return [...bmQuyenConfig.danhSachQuyenChucNang, ...(bm?.extraQuyens ?? [])];
};

const getBmName = (maBm: string) =>
  bmQuyenConfig.danhSachBieuMau.find((b) => b.maBm === maBm)?.tenBm ?? maBm;

const getBmNhom = (maBm: string) =>
  bmQuyenConfig.danhSachBieuMau.find((b) => b.maBm === maBm)?.nhom ?? "";

const makeKey = () => Date.now().toString() + Math.random().toString(36).slice(2);
const makeSubRow = (): SubRow => ({ key: makeKey(), maKhuVucs: [], quyenChucNangs: [] });
const makeBmRow = (): BmRow => ({ key: makeKey(), subRows: [makeSubRow()], khuVucPhus: [] });

// Prefix dùng để nhận biết value khu vực phụ có targetMaBm trong maKhuVucs
const KVP_PREFIX = "kvp:";
const makeKvpVal = (khuVucPhu: string) => `${KVP_PREFIX}${khuVucPhu}`;

// True nếu BM có khuVucPhus với targetMaBm → gộp vào selector khu vực chính
const useMergedScopeMode = (maBm?: string): boolean => {
  const bm = bmQuyenConfig.danhSachBieuMau.find((b) => b.maBm === maBm);
  return (bm?.khuVucPhus ?? []).some((k) => !!k.targetMaBm);
};

// True nếu BM có khuVucPhus nhưng không có scope và không có targetMaBm
// → đưa khuVucPhus vào scope select thay vì render select riêng
const useKvpAsScopeMode = (maBm?: string): boolean => {
  const bm = bmQuyenConfig.danhSachBieuMau.find((b) => b.maBm === maBm);
  const kvps = bm?.khuVucPhus ?? [];
  return kvps.length > 0 && !(bm?.scope?.length) && !bm?.scopeSource && !kvps.some((k) => k.targetMaBm);
};

const getKvpAsScopeOptions = (maBm?: string) => {
  const bm = bmQuyenConfig.danhSachBieuMau.find((b) => b.maBm === maBm);
  return (bm?.khuVucPhus ?? []).map((k) => ({ value: makeKvpVal(k.khuVucPhu), label: k.tenKhuVuc }));
};

const getTargetBmLabel = (targetMaBm: string): string =>
  bmQuyenConfig.danhSachBieuMau.find((b) => b.maBm === targetMaBm)?.tenBm ?? targetMaBm;

// Trả grouped options: scope chính + các nhóm khuVucPhu-with-targetMaBm
const getMergedScopeOptions = (maBm: string | undefined, scopes: KhuVucQuyenItem[]) => {
  if (!maBm) return [{ value: ALL_KHU_VUC, label: "Tất cả" }];
  const bm = bmQuyenConfig.danhSachBieuMau.find((b) => b.maBm === maBm);
  const groups: { label: string; options: { value: string; label: string }[] }[] = [];

  if (scopes.length > 0 || bm?.scopeSource) {
    groups.push({
      label: "Máy đúc",
      options: [
        { value: ALL_KHU_VUC, label: "Tất cả (máy đúc)" },
        ...scopes.map((s) => ({ value: s.maKhuVuc, label: s.tenKhuVuc })),
      ],
    });
  }

  const byTarget = new Map<string, { label: string; options: { value: string; label: string }[] }>();
  for (const kvp of bm?.khuVucPhus ?? []) {
    if (kvp.targetMaBm) {
      if (!byTarget.has(kvp.targetMaBm))
        byTarget.set(kvp.targetMaBm, { label: getTargetBmLabel(kvp.targetMaBm), options: [] });
      byTarget.get(kvp.targetMaBm)!.options.push({ value: makeKvpVal(kvp.khuVucPhu), label: kvp.tenKhuVuc });
    }
  }
  for (const g of byTarget.values()) groups.push(g);

  return groups;
};

/**
 * Bảng reverse: (targetMaBm + targetScope) → { parentMaBm, khuVucPhu }
 * Dùng để gom các record HRC1_LoThoi / HRC1_TinhLuyen về BmRow cha (HRC1_BBGN_ThepLong).
 */
function buildKvpReverseMap(): Map<string, { parentMaBm: string; khuVucPhu: string }> {
  const map = new Map<string, { parentMaBm: string; khuVucPhu: string }>();
  for (const bm of bmQuyenConfig.danhSachBieuMau) {
    for (const kvp of bm.khuVucPhus ?? []) {
      if (kvp.targetMaBm && kvp.targetScope) {
        map.set(`${kvp.targetMaBm}:${kvp.targetScope}`, {
          parentMaBm: bm.maBm,
          khuVucPhu: kvp.khuVucPhu,
        });
      }
    }
  }
  return map;
}

/**
 * Reconstruct BmRows từ danh sách flat records của một user.
 * - Record có targetMaBm (HRC1_LoThoi/TinhLuyen) → displayVal = "kvp:<khuVucPhu>" trong subRow cha.
 * - Record old-style có khuVucPhu (HRC2) → giữ trong BmRow.khuVucPhus như cũ.
 */
function buildBmRowsFromRecords(records: any[]): BmRow[] {
  const reverseMap = buildKvpReverseMap();

  type NRec = { parentMaBm: string; displayVal: string; quyenChucNang: number; khuVucPhu?: string };
  const normalized: NRec[] = [];

  for (const rec of records) {
    const maBm: string     = rec.maBm ?? "";
    const maKhuVuc: string = rec.maKhuVuc ?? "";
    const quyenChucNang    = rec.quyenChucNang as number;
    const khuVucPhu        = (rec.khuVucPhu ?? rec.KhuVucPhu) as string | undefined;
    const reverse          = reverseMap.get(`${maBm}:${maKhuVuc}`);

    if (reverse) {
      // targetMaBm record → hiện lại là kvp value trong BmRow cha (merged mode)
      normalized.push({ parentMaBm: reverse.parentMaBm, displayVal: makeKvpVal(reverse.khuVucPhu), quyenChucNang });
    } else if (useKvpAsScopeMode(maBm) && khuVucPhu) {
      // kvpAsScope mode (vd HRC2_BBSL_PhoiTam): khuVucPhu → hiện trong scope select
      normalized.push({ parentMaBm: maBm, displayVal: makeKvpVal(khuVucPhu), quyenChucNang });
    } else {
      normalized.push({ parentMaBm: maBm, displayVal: maKhuVuc || ALL_KHU_VUC, quyenChucNang, khuVucPhu });
    }
  }

  const byBm = new Map<string, NRec[]>();
  for (const r of normalized) {
    if (!byBm.has(r.parentMaBm)) byBm.set(r.parentMaBm, []);
    byBm.get(r.parentMaBm)!.push(r);
  }

  return Array.from(byBm.entries()).map(([maBm, recs]) => {
    const byQuyen = new Map<number, string[]>();
    for (const r of recs) {
      if (!byQuyen.has(r.quyenChucNang)) byQuyen.set(r.quyenChucNang, []);
      byQuyen.get(r.quyenChucNang)!.push(r.displayVal);
    }

    const byKvSet = new Map<string, { kvs: string[]; quyens: number[] }>();
    for (const [quyen, kvs] of byQuyen) {
      const kvsSorted = [...new Set(kvs)].sort();
      const key = kvsSorted.join("|");
      if (!byKvSet.has(key)) byKvSet.set(key, { kvs: kvsSorted, quyens: [] });
      byKvSet.get(key)!.quyens.push(quyen);
    }

    const subRows: SubRow[] = byKvSet.size > 0
      ? Array.from(byKvSet.values()).map(({ kvs, quyens }) => ({
          key: makeKey(), maKhuVucs: kvs, quyenChucNangs: quyens,
        }))
      : [makeSubRow()];

    // Old-style khuVucPhus cho BMs không dùng merged mode (HRC2, v.v.)
    const oldStyleKvps = [...new Set(recs.filter((r) => r.khuVucPhu).map((r) => r.khuVucPhu!))];

    return { key: makeKey(), maBm, subRows, khuVucPhus: oldStyleKvps };
  });
}

// ── styles ─────────────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: "4px 8px",
  textAlign: "left",
  color: "#8c8c8c",
  fontWeight: 400,
  fontSize: 13,
  borderBottom: "1px solid #f0f0f0",
};

const tdStyle: React.CSSProperties = { padding: "4px 8px", verticalAlign: "top" };

// ── component ──────────────────────────────────────────────────────────────

const PhanQuyenBieuMau = () => {
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingUserRecordIds, setEditingUserRecordIds] = useState<number[]>([]);
  const [form] = Form.useForm();
  const [bmRows, setBmRows] = useState<BmRow[]>([]);
  const [filterBmInModal, setFilterBmInModal] = useState<string | undefined>();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [filterTaiKhoan, setFilterTaiKhoan] = useState<number | undefined>();
  const { getScope } = useBmScopes();

  useEffect(() => {
    const userStr = localStorage.getItem("userinfo");
    if (userStr) setCurrentUser(JSON.parse(userStr));
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await BmQuyenXlApi.getAll();
      const arr = Array.isArray(res) ? res : (res as any)?.data ?? [];
      setDataSource(arr);
    } catch {
      message.error("Không thể tải dữ liệu phân quyền");
      setDataSource([]);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await TaiKhoanApi.getData();
      setUsers(Array.isArray(res) ? res : (res as any)?.data ?? []);
    } catch {
      message.error("Không thể tải danh sách tài khoản");
    }
  };

  useEffect(() => {
    loadData();
    loadUsers();
  }, []);

  // ── group dataSource theo user ─────────────────────────────────────────────

  const userRows = useMemo(() => {
    const byUser = new Map<number, any[]>();
    for (const item of dataSource) {
      const id = item.idTaiKhoan ?? item.IdTaiKhoan;
      if (id == null) continue;
      if (!byUser.has(id)) byUser.set(id, []);
      byUser.get(id)!.push(item);
    }
    return Array.from(byUser.entries()).map(([idTaiKhoan, records]) => ({
      idTaiKhoan,
      soLuong: records.length,
    }));
  }, [dataSource]);

  const filteredUserRows = useMemo(
    () =>
      filterTaiKhoan
        ? userRows.filter((r) => r.idTaiKhoan === filterTaiKhoan)
        : userRows,
    [userRows, filterTaiKhoan]
  );

  // ── BmRow helpers ──────────────────────────────────────────────────────────

  const addBmRow = () => {
    setFilterBmInModal(undefined);
    setBmRows((prev) => [...prev, makeBmRow()]);
  };

  const removeBmRow = (bmKey: string) =>
    setBmRows((prev) => prev.filter((r) => r.key !== bmKey));

  const updateBmRow = (bmKey: string, patch: Partial<BmRow>) =>
    setBmRows((prev) => prev.map((r) => (r.key === bmKey ? { ...r, ...patch } : r)));

  const addSubRow = (bmKey: string) =>
    setBmRows((prev) =>
      prev.map((r) => (r.key === bmKey ? { ...r, subRows: [...r.subRows, makeSubRow()] } : r))
    );

  const removeSubRow = (bmKey: string, subKey: string) =>
    setBmRows((prev) =>
      prev.map((r) => {
        if (r.key !== bmKey || r.subRows.length <= 1) return r;
        return { ...r, subRows: r.subRows.filter((s) => s.key !== subKey) };
      })
    );

  const updateSubRow = (bmKey: string, subKey: string, patch: Partial<SubRow>) =>
    setBmRows((prev) =>
      prev.map((r) =>
        r.key !== bmKey
          ? r
          : { ...r, subRows: r.subRows.map((s) => (s.key === subKey ? { ...s, ...patch } : s)) }
      )
    );

  const handleKhuVucChange = (bmKey: string, subKey: string, newValues: string[]) => {
    const prev        = bmRows.find((r) => r.key === bmKey)?.subRows.find((s) => s.key === subKey)?.maKhuVucs ?? [];
    const kvpVals     = newValues.filter((v) => v.startsWith(KVP_PREFIX));
    const regularNew  = newValues.filter((v) => !v.startsWith(KVP_PREFIX));
    const prevRegular = prev.filter((v) => !v.startsWith(KVP_PREFIX));
    let resultRegular = regularNew;
    if (regularNew.includes(ALL_KHU_VUC) && regularNew.length > 1) {
      resultRegular = !prevRegular.includes(ALL_KHU_VUC)
        ? [ALL_KHU_VUC]
        : regularNew.filter((v) => v !== ALL_KHU_VUC);
    }
    updateSubRow(bmKey, subKey, { maKhuVucs: [...resultRegular, ...kvpVals] });
  };

  // ── Modal helpers ──────────────────────────────────────────────────────────

  const openCreateModal = () => {
    setIsEditing(false);
    setEditingUserRecordIds([]);
    form.resetFields();
    setBmRows([makeBmRow()]);
    setFilterBmInModal(undefined);
    setModalOpen(true);
  };

  const handleEdit = async (idTaiKhoan: number) => {
    setIsEditing(true);
    setFilterBmInModal(undefined);
    form.setFieldsValue({ idTaiKhoan });
    setModalOpen(true);
    setModalLoading(true);
    try {
      const res = await BmQuyenXlApi.getByTaiKhoan(idTaiKhoan);
      const records: any[] = Array.isArray(res) ? res : (res as any)?.data ?? [];
      const ids = records.map((r: any) => r.id ?? r.Id).filter(Boolean);
      setEditingUserRecordIds(ids);
      setBmRows(buildBmRowsFromRecords(records));
    } catch {
      message.error("Không thể tải dữ liệu quyền của tài khoản");
      setModalOpen(false);
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setIsEditing(false);
    setEditingUserRecordIds([]);
    form.resetFields();
    setBmRows([]);
    setFilterBmInModal(undefined);
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    try {
      await form.validateFields();
      const invalid = bmRows.some(
        (bmRow) =>
          !bmRow.maBm ||
          bmRow.subRows.some(
            (s) =>
              (s.maKhuVucs.length === 0 && bmRow.khuVucPhus.length === 0) ||
              s.quyenChucNangs.length === 0
          )
      );
      if (invalid) {
        message.warning("Vui lòng điền đủ thông tin cho tất cả các biểu mẫu");
        return;
      }

      const { idTaiKhoan } = form.getFieldsValue();

      const expandedItems = bmRows.flatMap((bmRow) => {
        const bm     = bmQuyenConfig.danhSachBieuMau.find((b) => b.maBm === bmRow.maBm);
        const merged = useMergedScopeMode(bmRow.maBm);
        const items: any[] = [];

        const kvpAsScope = useKvpAsScopeMode(bmRow.maBm);

        if (merged) {
          // Merged mode: maKhuVucs chứa cả scope thường lẫn "kvp:" items
          for (const subRow of bmRow.subRows) {
            if (subRow.quyenChucNangs.length === 0) continue;
            const regularKvs = subRow.maKhuVucs.filter((v) => !v.startsWith(KVP_PREFIX));
            const kvpVals    = subRow.maKhuVucs.filter((v) => v.startsWith(KVP_PREFIX));

            if (regularKvs.length > 0)
              items.push({ maBm: bmRow.maBm!, maKhuVucs: regularKvs, quyenChucNangs: subRow.quyenChucNangs, khuVucPhus: [] });

            const byTarget = new Map<string, string[]>();
            for (const kvpVal of kvpVals) {
              const khuVucPhu = kvpVal.slice(KVP_PREFIX.length);
              const def = (bm?.khuVucPhus ?? []).find((k) => k.khuVucPhu === khuVucPhu);
              if (def?.targetMaBm && def?.targetScope) {
                if (!byTarget.has(def.targetMaBm)) byTarget.set(def.targetMaBm, []);
                byTarget.get(def.targetMaBm)!.push(def.targetScope);
              }
            }
            for (const [targetMaBm, scopes] of byTarget)
              items.push({ maBm: targetMaBm, maKhuVucs: scopes, quyenChucNangs: subRow.quyenChucNangs, khuVucPhus: [] });
          }
        } else if (kvpAsScope) {
          // kvpAsScope mode: scope select chứa kvp values, lưu theo khuVucPhu field
          for (const subRow of bmRow.subRows) {
            if (subRow.quyenChucNangs.length === 0) continue;
            const kvpVals = subRow.maKhuVucs
              .filter((v) => v.startsWith(KVP_PREFIX))
              .map((v) => v.slice(KVP_PREFIX.length));
            if (kvpVals.length > 0)
              items.push({ maBm: bmRow.maBm!, maKhuVucs: [ALL_KHU_VUC], quyenChucNangs: subRow.quyenChucNangs, khuVucPhus: kvpVals });
          }
        } else {
          // Old-style: khuVucPhus không có targetMaBm
          const oldStyleKvps = bmRow.khuVucPhus.filter((v) => {
            const def = (bm?.khuVucPhus ?? []).find((k) => k.khuVucPhu === v);
            return !def?.targetMaBm;
          });
          bmRow.subRows.filter((s) => s.maKhuVucs.length > 0).forEach((subRow) => {
            items.push({ maBm: bmRow.maBm!, maKhuVucs: subRow.maKhuVucs, quyenChucNangs: subRow.quyenChucNangs, khuVucPhus: oldStyleKvps });
          });
        }

        return items;
      });

      await BmQuyenXlApi.bulkSave({
        idTaiKhoan,
        idsToDelete: editingUserRecordIds,
        items: expandedItems,
      });

      message.success(isEditing ? "Cập nhật quyền thành công" : "Thêm quyền thành công");
      closeModal();
      loadData();
    } catch (err: any) {
      message.error(err?.response?.data ?? "Có lỗi xảy ra");
    }
  };

  // ── Delete toàn bộ quyền của user ─────────────────────────────────────────

  const handleDeleteUser = async (idTaiKhoan: number) => {
    if (!isAdminUser(currentUser)) {
      message.error("Bạn không có quyền thực hiện thao tác này");
      return;
    }
    try {
      await BmQuyenXlApi.deleteByTaiKhoan(idTaiKhoan);
      message.success("Đã xóa toàn bộ quyền của tài khoản");
      loadData();
    } catch {
      message.error("Không thể xóa quyền");
    }
  };

  // ── Modal search options ───────────────────────────────────────────────────

  const modalBmSearchOptions = useMemo(
    () =>
      bmRows
        .filter((r) => !!r.maBm)
        .map((r) => ({
          value: r.maBm!,
          label: `[${getBmNhom(r.maBm!)}] ${getBmName(r.maBm!)}`,
        })),
    [bmRows]
  );

  const visibleBmRows = useMemo(
    () => (filterBmInModal ? bmRows.filter((r) => r.maBm === filterBmInModal) : bmRows),
    [bmRows, filterBmInModal]
  );

  // ── Main table columns ─────────────────────────────────────────────────────

  const columns = [
    {
      title: "STT",
      key: "stt",
      width: 60,
      render: (_: any, __: any, i: number) => i + 1,
    },
    {
      title: "Tài khoản",
      dataIndex: "idTaiKhoan",
      key: "idTaiKhoan",
      render: (id: number) => {
        const u = users.find((u) => u.iD_TaiKhoan === id);
        return u ? `${u.tenTaiKhoan} - ${u.hoVaTen}` : id;
      },
    },
    {
      title: "Số quyền",
      dataIndex: "soLuong",
      key: "soLuong",
      width: 110,
      render: (n: number) => `${n} quyền`,
    },
    {
      title: "Thao tác",
      key: "action",
      width: 120,
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record.idTaiKhoan)}
            title="Xem / chỉnh sửa quyền"
          />
          <Popconfirm
            title="Xóa toàn bộ quyền của tài khoản này?"
            onConfirm={() => handleDeleteUser(record.idTaiKhoan)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 24 }}>
      {/* Main table */}
      <Card
        title="Phân quyền xử lý biểu mẫu"
        extra={
          <Space>
            <Select
              placeholder="Lọc theo tài khoản"
              allowClear
              style={{ width: 260 }}
              value={filterTaiKhoan}
              onChange={setFilterTaiKhoan}
              showSearch
              optionFilterProp="label"
              filterOption={(input, opt) =>
                (opt?.label ?? "").toLowerCase().includes(input.toLowerCase())
              }
              options={users.map((u) => ({
                value: u.iD_TaiKhoan,
                label: `${u.tenTaiKhoan} - ${u.hoVaTen}`,
              }))}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              Thêm quyền
            </Button>
          </Space>
        }
      >
        <Table
          loading={loading}
          dataSource={filteredUserRows}
          columns={columns}
          rowKey="idTaiKhoan"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (t) => `Tổng: ${t} tài khoản`,
          }}
        />
      </Card>

      {/* Modal thêm / sửa */}
      <Modal
        title={isEditing ? "Cập nhật quyền xử lý" : "Thêm quyền xử lý"}
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSave}
        okText={isEditing ? "Cập nhật" : "Thêm"}
        cancelText="Hủy"
        width="90vw"
        style={{ maxWidth: 1400 }}
        destroyOnClose
        okButtonProps={{ disabled: modalLoading }}
      >
        <Spin spinning={modalLoading}>
          <Form form={form} layout="vertical">
            <Form.Item
              name="idTaiKhoan"
              label="Tài khoản"
              rules={[{ required: true, message: "Vui lòng chọn tài khoản" }]}
            >
              <Select
                showSearch
                placeholder="Chọn tài khoản"
                optionFilterProp="label"
                disabled={isEditing}
                filterOption={(input, opt) =>
                  (opt?.label ?? "").toLowerCase().includes(input.toLowerCase())
                }
                options={users.map((u) => ({
                  value: u.iD_TaiKhoan,
                  label: `${u.tenTaiKhoan} - ${u.hoVaTen}`,
                }))}
              />
            </Form.Item>
          </Form>

          {/* Tìm nhanh biểu mẫu trong modal */}
          {bmRows.some((r) => r.maBm) && (
            <div style={{ marginBottom: 8 }}>
              <Select
                allowClear
                showSearch
                style={{ width: "100%" }}
                placeholder="Tìm nhanh biểu mẫu trong danh sách..."
                value={filterBmInModal}
                onChange={setFilterBmInModal}
                optionFilterProp="label"
                options={modalBmSearchOptions}
              />
            </div>
          )}

          {/* Bảng phân quyền */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: "30%" }}>Biểu mẫu</th>
                <th style={{ ...thStyle, width: "34%" }}>Khu vực</th>
                <th style={{ ...thStyle, width: "24%" }}>Quyền chức năng</th>
                <th style={{ ...thStyle, width: "12%" }} />
              </tr>
            </thead>
            <tbody>
              {visibleBmRows.flatMap((bmRow) =>
                bmRow.subRows.map((subRow, subIdx) => (
                  <tr
                    key={subRow.key}
                    style={
                      subIdx === 0 && bmRows.indexOf(bmRow) > 0
                        ? { borderTop: "2px solid #f0f0f0" }
                        : undefined
                    }
                  >
                    {subIdx === 0 && (
                      <td
                        rowSpan={bmRow.subRows.length}
                        style={{ ...tdStyle, borderRight: "1px solid #f0f0f0" }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
                          <Select
                            style={{ flex: 1, minWidth: 0 }}
                            placeholder="Chọn biểu mẫu"
                            showSearch
                            optionFilterProp="label"
                            value={bmRow.maBm}
                            onChange={(v) => updateBmRow(bmRow.key, { maBm: v, khuVucPhus: [] })}
                            options={bmQuyenConfig.danhSachBieuMau.map((bm) => ({
                              value: bm.maBm,
                              label: `[${bm.nhom}] ${bm.tenBm}`,
                            }))}
                          />
                          <Button
                            type="text"
                            danger
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={() => removeBmRow(bmRow.key)}
                            title="Xóa biểu mẫu này"
                          />
                        </div>
                        {hasKhuVucPhu(bmRow.maBm) && !useMergedScopeMode(bmRow.maBm) && !useKvpAsScopeMode(bmRow.maBm) && (
                          <Select
                            mode="multiple"
                            style={{ width: "100%", marginTop: 4 }}
                            placeholder="Chọn khu vực phụ"
                            value={bmRow.khuVucPhus}
                            options={getKhuVucPhuOptions(bmRow.maBm)}
                            onChange={(vals) => updateBmRow(bmRow.key, { khuVucPhus: vals })}
                          />
                        )}
                      </td>
                    )}

                    <td style={tdStyle}>
                      <Select
                        mode="multiple"
                        style={{ width: "100%" }}
                        placeholder={bmRow.maBm ? "Chọn khu vực" : "Chọn biểu mẫu trước"}
                        disabled={!bmRow.maBm}
                        value={subRow.maKhuVucs}
                        options={
                          (useKvpAsScopeMode(bmRow.maBm)
                            ? getKvpAsScopeOptions(bmRow.maBm)
                            : useMergedScopeMode(bmRow.maBm)
                              ? getMergedScopeOptions(bmRow.maBm, getScope(bmRow.maBm, subRow.maKhuVucs))
                              : getScopeOptions(getScope(bmRow.maBm, subRow.maKhuVucs))
                          ) as { value: string; label: string }[]
                        }
                        onChange={(vals) => handleKhuVucChange(bmRow.key, subRow.key, vals)}
                      />
                    </td>

                    <td style={tdStyle}>
                      <Select
                        mode="multiple"
                        style={{ width: "100%" }}
                        placeholder="Chọn quyền"
                        value={subRow.quyenChucNangs}
                        onChange={(vals) =>
                          updateSubRow(bmRow.key, subRow.key, { quyenChucNangs: vals })
                        }
                        options={getQuyenChucNangOptions(bmRow.maBm)}
                      />
                    </td>

                    <td style={{ ...tdStyle, textAlign: "center", whiteSpace: "nowrap" }}>
                      {subIdx === 0 && (
                        <Button
                          type="text"
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() => addSubRow(bmRow.key)}
                          title="Thêm quyền con"
                        />
                      )}
                      {bmRow.subRows.length > 1 && (
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<MinusCircleOutlined />}
                          onClick={() => removeSubRow(bmRow.key, subRow.key)}
                          title="Xóa dòng quyền này"
                        />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={addBmRow}
            style={{ width: "100%" }}
          >
            Thêm biểu mẫu
          </Button>
        </Spin>
      </Modal>
    </div>
  );
};

export default PhanQuyenBieuMau;
