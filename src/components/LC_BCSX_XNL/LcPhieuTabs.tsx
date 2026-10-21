import { useMemo } from "react";
import { Tabs } from "antd";
import { getTabsForThanhPham, type ThanhPham, type LcPhieuTables } from "./lcTabsConfig";
import TabPlaceholder from "./TabPlaceholder";
import TabCapLieuSilo from "./TabCapLieuSilo";
import TabPhoiTron from "./TabPhoiTron";
import TabThapPheu from "./TabThapPheu";
import TabPhanTich from "./TabPhanTich";
import TabSuCo from "./TabSuCo";

export type { LcPhieuTables };

/**
 * Khung tab dùng chung cho TP1 và TP2 (LC_02_Prompt_Vibecoding_V5.md mục 2.1: "Mỗi vùng
 * = 1 tab UI... dùng chung TP1/TP2"). Dùng lại ở cả trang Tạo phiếu (editable=true) và
 * trang Chi tiết (editable=false).
 *
 * Mỗi bảng con của mọi vùng gộp vào 1 object `LcPhieuTables` (định nghĩa ở lcTabsConfig.ts)
 * để trang cha chỉ cần giữ 1 state, tránh tăng số lượng props mỗi khi thêm 1 vùng mới
 * (xem LC_02 mục 3 lộ trình từng lát cắt — còn 9 vùng nữa sẽ bổ sung dần).
 */
export interface LcPhieuTabsProps {
  thanhPham: ThanhPham | null | undefined;
  editable: boolean;
  tables: LcPhieuTables;
  onTablesChange: (patch: Partial<LcPhieuTables>) => void;
}

const LcPhieuTabs = ({ thanhPham, editable, tables, onTablesChange }: LcPhieuTabsProps) => {
  const tabs = useMemo(() => getTabsForThanhPham(thanhPham), [thanhPham]);

  const items = tabs.map((tab) => {
    let children;
    switch (tab.key) {
      case "capLieuSilo":
        children = (
          <TabCapLieuSilo
            thanhPham={thanhPham}
            editable={editable}
            capLieuRows={tables.capLieu}
            onCapLieuChange={(rows) => onTablesChange({ capLieu: rows })}
            coHatNghien1Rows={tables.coHatNghien1}
            onCoHatNghien1Change={(rows) => onTablesChange({ coHatNghien1: rows })}
          />
        );
        break;
      case "phoiTron":
        children = (
          <TabPhoiTron
            thanhPham={thanhPham}
            editable={editable}
            cards={tables.phoiTron}
            onChange={(cards) => onTablesChange({ phoiTron: cards })}
            capLieuRows={tables.capLieu}
          />
        );
        break;
      case "thapPheu":
        children = (
          <TabThapPheu
            thanhPham={thanhPham}
            editable={editable}
            pheuRows={tables.pheu}
            onPheuChange={(rows) => onTablesChange({ pheu: rows })}
            thapRows={tables.thap}
            onThapChange={(rows) => onTablesChange({ thap: rows })}
          />
        );
        break;
      case "phanTich":
        children = (
          <TabPhanTich
            editable={editable}
            rows={tables.phanTich}
            onChange={(rows) => onTablesChange({ phanTich: rows })}
          />
        );
        break;
      case "suCo":
        children = (
          <TabSuCo
            editable={editable}
            rows={tables.suCo}
            onChange={(rows) => onTablesChange({ suCo: rows })}
          />
        );
        break;
      default:
        children = <TabPlaceholder tab={tab} />;
    }
    return { key: tab.key, label: tab.label, children };
  });

  return <Tabs items={items} />;
};

export default LcPhieuTabs;
