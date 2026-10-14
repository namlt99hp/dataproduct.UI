import { Empty } from "antd";
import type { LcTabDef } from "./lcTabsConfig";

/**
 * Component đại diện cho mọi vùng (tab) chưa triển khai — dùng chung cho TP1 và TP2.
 * Khi một vùng được triển khai thật (vd "Phối trộn"), thay entry tương ứng trong
 * lcTabsConfig.ts sang implemented=true và tạo component Tab riêng như TabCapLieuSilo.
 */
const TabPlaceholder = ({ tab }: { tab: LcTabDef }) => (
  <Empty
    description={
      <span>
        Vùng <b>{tab.label}</b> chưa triển khai.
        {tab.note ? <div style={{ marginTop: 8, color: "#999" }}>{tab.note}</div> : null}
      </span>
    }
    style={{ padding: "48px 0" }}
  />
);

export default TabPlaceholder;
