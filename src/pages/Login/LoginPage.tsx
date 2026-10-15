import {
  Form,
  Input,
  Button,
  Typography,
  Checkbox,
  Card,
  Row,
  Col,
  Divider,
} from "antd";
import { useDispatch } from "react-redux";
import { useNavigate, useLocation, Link } from "react-router-dom";
import type { AppDispatch } from "../../store";
import { loginSuccess } from "../../store/authSlice";
import { showNotification } from "../../store/NotificationSlice";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { images } from "../../assets/images";
import { useState } from "react";
import { TaiKhoanApi } from "../../services/TaiKhoanService";

const { Title } = Typography;

const LoginPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || "/";
  const [submitting, setSubmitting] = useState(false);

  const onFinish = async (values: { username: string; password: string }) => {
    const { username, password } = values;
    setSubmitting(true);
    try {
      // const { token, user } = await fakeAuthApi.login(username, password);
      // dispatch(loginSuccess({ token, user }));
      // localStorage.setItem('token', token);
      // localStorage.setItem('user', JSON.stringify(user));
      // localStorage.setItem('username', user.name);

      // Thay thế đoạn trên bằng API thực tế
      const res = await TaiKhoanApi.postLogin({ username, password });
      const token = (res as any).token as string;
      const user = {
        id: (res as any).iD_TaiKhoan || "",
        username: (res as any).tenTaiKhoan || "",
        name: (res as any).hoVaTen || "",
        role: (res as any).role || "admin",
      };
      dispatch(loginSuccess({ token, user }));
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("username", user.name);
      localStorage.setItem("userinfo", JSON.stringify(res));

      // Lấy quyền riêng sau khi login
      try {
        const quyenData = await TaiKhoanApi.getQuyen(user.username) as any;
        localStorage.setItem("bmQuyenXlList", JSON.stringify(quyenData.bmQuyenXlList || []));
        const userinfo = {
          ...res,
          bmQuyenXlList: quyenData.bmQuyenXlList || [],
          quyenTheoLo: quyenData.quyenTheoLo || [],
          quyenTheoScope: quyenData.quyenTheoScope || [],
        };
        localStorage.setItem("userinfo", JSON.stringify(userinfo));
      } catch {
        // fail silently
      }

      dispatch(
        showNotification({
          message: "Đăng nhập thành công",
          description: `Chào mừng ${user.name}!`,
          type: "success",
        }),
      );
      navigate(from, { replace: true });
    } catch (e: any) {
      dispatch(
        showNotification({
          message: "Đăng nhập thất bại",
          description: e?.message || "Kiểm tra lại tài khoản và mật khẩu!",
          type: "error",
        }),
      );
    }
    setSubmitting(false);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundImage: `url(${images.backgroundHP})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <Row style={{ width: "100%" }} justify="center">
        <Col xs={24} sm={20} md={12} lg={8} xl={6}>
          <Card
            variant="borderless"
            style={{
              borderRadius: 12,
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <img
                src={images.logoHP}
                alt="Hòa Phát"
                style={{ height: 48, objectFit: "contain", marginBottom: 8 }}
              />
              <Title level={4} style={{ margin: 0 }}>
                Đăng nhập hệ thống
              </Title>
              <div style={{ color: "#8c8c8c" }}>
                Nhập thông tin tài khoản để tiếp tục
              </div>
            </div>
            <Divider style={{ margin: "12px 0 16px" }} />

            <Form
              name="login_form"
              layout="vertical"
              onFinish={onFinish}
              autoComplete="on"
              initialValues={{ remember: true }}
            >
              <Form.Item
                label="Mã nhân viên"
                name="username"
                rules={[
                  { required: true, message: "Vui lòng nhập mã nhân viên!" },
                ]}
              >
                <Input
                  prefix={<UserOutlined />}
                  placeholder="Nhập mã nhân viên"
                  autoComplete="username"
                />
              </Form.Item>

              <Form.Item
                label="Mật khẩu"
                name="password"
                rules={[{ required: true, message: "Vui lòng nhập mật khẩu!" }]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="Nhập mật khẩu"
                  autoComplete="current-password"
                />
              </Form.Item>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 16,
                }}
              >
                <Form.Item name="remember" valuePropName="checked" noStyle>
                  <Checkbox>Nhớ tài khoản</Checkbox>
                </Form.Item>
                <Link to="#">Quên mật khẩu?</Link>
              </div>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  loading={submitting}
                >
                  Đăng nhập
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default LoginPage;
