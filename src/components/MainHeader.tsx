import { Layout, Button, Avatar, Dropdown, Space } from "antd";
import {
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  UserOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { logout } from "../store/authSlice";

const { Header } = Layout;

const userMenu = [
  {
    key: "profile",
    label: "Thông tin cá nhân",
    icon: <UserOutlined />,
  },
  {
    key: "logout",
    label: "Đăng xuất",
    icon: <LogoutOutlined />,
  },
];

const MainHeader = ({ collapsed, setCollapsed }: any) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key === "logout") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("username");
      localStorage.removeItem("userinfo");
      localStorage.removeItem("bmQuyenXlList");
      dispatch(logout());
      navigate("/login");
    }

    if (key === "profile") {
      window.open(
        "https://report.hoaphatdungquat.vn/DangNhap/ThongTinTaiKhoan",
        "_blank",
      );
    }
  };
  const userString = localStorage.getItem("user");
  const username = userString ? JSON.parse(userString) : { name: "" };
  return (
    <Header
      style={{
        height: 70,
        lineHeight: "70px",
        padding: "0 16px",
        background: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between", // căn 2 bên
        borderBottom: "1px solid #e5e5e5", //viền dưới
      }}
    >
      {/* Nút toggle sidebar */}
      <Button
        type="text"
        icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        onClick={() => setCollapsed(!collapsed)}
        style={{ fontSize: "16px", width: 64, height: "100%" }}
      />

      {/* User account */}
      <Dropdown
        menu={{ items: userMenu, onClick: handleMenuClick }}
        placement="bottomRight"
        trigger={["click"]}
      >
        <Space style={{ cursor: "pointer" }}>
          <Avatar />
          <span style={{ fontWeight: 500 }}>{username.name}</span>
        </Space>
      </Dropdown>
    </Header>
  );
};

export default MainHeader;
