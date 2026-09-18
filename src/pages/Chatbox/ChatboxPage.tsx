import { useEffect, useRef, useState } from "react";
import { Avatar, Button, Card, Input, Spin, Typography, message as antdMessage } from "antd";
import { RobotOutlined, SendOutlined, UserOutlined } from "@ant-design/icons";
import { ChatboxApi } from "../../services/ChatboxApi";
import { ResponseRenderer } from "../../components/ResponseRenderer";
import type { ChatUsage, ResponseBlock } from "../../types/ChatResponseContract";

const { Text } = Typography;

type ChatMessage =
  | { role: "user"; blocks: ResponseBlock[] }
  | { role: "assistant"; blocks: ResponseBlock[]; usage?: ChatUsage };

const textBlocks = (markdown: string): ResponseBlock[] => [{ type: "text", markdown }];

const ChatboxPage = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      blocks: textBlocks(
        'Xin chào, tôi là trợ lý tra cứu dữ liệu sản xuất HPDQ. Bạn có thể hỏi ví dụ: "Có bao nhiêu bảng trong database PRODUCT_FORM?"',
      ),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: "user", blocks: textBlocks(text) }]);
    setInput("");
    setLoading(true);

    try {
      const envelope = await ChatboxApi.ask(text);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", blocks: envelope.blocks, usage: envelope.usage },
      ]);
    } catch (err) {
      const errMsg =
        (err as { message?: string })?.message ?? "Không kết nối được tới AI Gateway.";
      antdMessage.error(errMsg);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", blocks: textBlocks(`Xin lỗi, có lỗi xảy ra: ${errMsg}`) },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: 16, gap: 16 }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        Tra cứu dữ liệu sản xuất (Demo)
      </Typography.Title>

      <Card
        style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}
        styles={{ body: { flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 } }}
      >
        {messages.map((m, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              gap: 8,
              flexDirection: m.role === "user" ? "row-reverse" : "row",
              alignItems: "flex-start",
            }}
          >
            <Avatar icon={m.role === "user" ? <UserOutlined /> : <RobotOutlined />} />
            <div
              style={{
                maxWidth: m.role === "user" ? "70%" : "92%",
                width: m.role === "assistant" ? "92%" : undefined,
                background: m.role === "user" ? "#1677ff" : "#f5f5f5",
                color: m.role === "user" ? "#fff" : "inherit",
                borderRadius: 8,
                padding: "8px 12px",
              }}
            >
              <ResponseRenderer blocks={m.blocks} />
              {m.role === "assistant" && m.usage && (
                <div style={{ marginTop: 4, fontSize: 11, opacity: 0.55 }}>
                  {m.usage.totalTokens.toLocaleString("vi-VN")} token
                  {" "}(in {m.usage.inputTokens.toLocaleString("vi-VN")}, out{" "}
                  {m.usage.outputTokens.toLocaleString("vi-VN")}
                  {m.usage.cacheReadInputTokens > 0
                    ? `, cache ${m.usage.cacheReadInputTokens.toLocaleString("vi-VN")}`
                    : ""}
                  ) · {m.usage.turns} turn
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Avatar icon={<RobotOutlined />} />
            <Spin size="small" />
            <Text type="secondary">Đang truy vấn dữ liệu...</Text>
          </div>
        )}
        <div ref={bottomRef} />
      </Card>

      <div style={{ display: "flex", gap: 8 }}>
        <Input.TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Hỏi về sản lượng, tồn kho, chất lượng... (Enter để gửi, Shift+Enter xuống dòng)"
          autoSize={{ minRows: 1, maxRows: 4 }}
          disabled={loading}
        />
        <Button type="primary" icon={<SendOutlined />} onClick={handleSend} loading={loading}>
          Gửi
        </Button>
      </div>
    </div>
  );
};

export default ChatboxPage;
