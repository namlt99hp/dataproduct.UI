import { useRef, useState } from "react";
import { Alert, Button, Input, InputNumber, Space, Tag, Typography } from "antd";
import { LcSiloTonApi } from "../../services/LcDanhMucApi";

/**
 * Ô nhập công thức tính khối lượng cho danh mục "Silo Tồn" — trực quan kiểu "máy tính":
 * các nút số/toán tử/hàm chèn trực tiếp vào vị trí con trỏ trong ô công thức, cộng khu vực
 * "Tính thử" gọi thẳng BE (NCalc, xem Utils/CongThucEvaluator.cs) để xác nhận công thức đúng
 * trước khi lưu.
 *
 * Biến DUY NHẤT dùng trong công thức là `H` — đại diện giá trị nhập (chiều cao hoặc bánh cốc).
 */

interface CongThucCalculatorInputProps {
  value: string;
  onChange: (value: string) => void;
}

interface ButtonSpec {
  label: string;
  insert: string;
  /** Vị trí con trỏ sau khi chèn, tính từ đầu đoạn vừa chèn. Mặc định = cuối đoạn chèn. */
  cursorOffset?: number;
  tooltip?: string;
}

const SO_HOC: ButtonSpec[] = [
  { label: "7", insert: "7" }, { label: "8", insert: "8" }, { label: "9", insert: "9" }, { label: "/", insert: "/" },
  { label: "4", insert: "4" }, { label: "5", insert: "5" }, { label: "6", insert: "6" }, { label: "*", insert: "*" },
  { label: "1", insert: "1" }, { label: "2", insert: "2" }, { label: "3", insert: "3" }, { label: "-", insert: "-" },
  { label: "0", insert: "0" }, { label: ".", insert: "." }, { label: "(", insert: "(" }, { label: ")", insert: ")" },
  { label: "+", insert: "+" },
];

const SO_SANH: ButtonSpec[] = [
  { label: ">", insert: ">" },
  { label: "<", insert: "<" },
  { label: ">=", insert: ">=" },
  { label: "<=", insert: "<=" },
  { label: "=", insert: "=" },
];

const HAM: ButtonSpec[] = [
  { label: "H", insert: "H", tooltip: "Biến giá trị nhập (chiều cao/bánh cốc)" },
  { label: "if(...)", insert: "if(,,)", cursorOffset: 3, tooltip: "if(điều kiện, đúng, sai)" },
  { label: "Round(...)", insert: "Round(,)", cursorOffset: 6, tooltip: "Round(giá trị, số chữ số thập phân)" },
  { label: "Sqrt(...)", insert: "Sqrt()", cursorOffset: 5, tooltip: "Sqrt(giá trị) — căn bậc 2" },
  { label: "Pow(...)", insert: "Pow(,)", cursorOffset: 4, tooltip: "Pow(cơ số, số mũ) — luỹ thừa, KHÔNG dùng ký hiệu ^" },
  { label: "Abs(...)", insert: "Abs()", cursorOffset: 4, tooltip: "Abs(giá trị) — giá trị tuyệt đối" },
  { label: "Min(...)", insert: "Min(,)", cursorOffset: 4, tooltip: "Min(a, b)" },
  { label: "Max(...)", insert: "Max(,)", cursorOffset: 4, tooltip: "Max(a, b)" },
];

const CongThucCalculatorInput = ({ value, onChange }: CongThucCalculatorInputProps) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const textAreaRef = useRef<any>(null);
  const [giaTriMau, setGiaTriMau] = useState<number | null>(5);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ketQua: number | null; loi: string | null } | null>(null);

  const insertAtCursor = (spec: ButtonSpec) => {
    const textarea: HTMLTextAreaElement | undefined = textAreaRef.current?.resizableTextArea?.textArea;
    const current = value ?? "";
    if (!textarea) {
      onChange(current + spec.insert);
      return;
    }
    const start = textarea.selectionStart ?? current.length;
    const end = textarea.selectionEnd ?? current.length;
    const newValue = current.slice(0, start) + spec.insert + current.slice(end);
    onChange(newValue);
    const newPos = start + (spec.cursorOffset ?? spec.insert.length);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(newPos, newPos);
    });
  };

  const handleTest = async () => {
    if (!value?.trim() || giaTriMau == null) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await LcSiloTonApi.testCongThuc(value, giaTriMau);
      setTestResult(res);
    } catch {
      setTestResult({ ketQua: null, loi: "Không gọi được API tính thử." });
    } finally {
      setTesting(false);
    }
  };

  const renderRow = (specs: ButtonSpec[], key: string) => (
    <Space key={key} wrap size={4} style={{ marginBottom: 4 }}>
      {specs.map((s) => (
        <Button key={s.label} size="small" title={s.tooltip} onClick={() => insertAtCursor(s)}>
          {s.label}
        </Button>
      ))}
    </Space>
  );

  return (
    <div>
      <Input.TextArea
        ref={textAreaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoSize={{ minRows: 2, maxRows: 4 }}
        placeholder="VD: Round(if(H>4.937, 100+51.5*(H-4.937), if(H>3,100,0)),3)"
        style={{ fontFamily: "monospace", marginBottom: 8 }}
      />
      <div style={{ background: "#fafafa", padding: 8, borderRadius: 6, marginBottom: 8 }}>
        {renderRow(SO_HOC, "so-hoc")}
        {renderRow(SO_SANH, "so-sanh")}
        {renderRow(HAM, "ham")}
      </div>
      <Space align="center" style={{ marginBottom: 8 }}>
        <Typography.Text type="secondary">Tính thử với H =</Typography.Text>
        <InputNumber size="small" value={giaTriMau} onChange={setGiaTriMau} style={{ width: 90 }} />
        <Button size="small" type="primary" loading={testing} onClick={handleTest} disabled={!value?.trim()}>
          Tính
        </Button>
        {testResult?.ketQua != null && <Tag color="success">Kết quả: {testResult.ketQua}</Tag>}
      </Space>
      {testResult?.loi && <Alert type="error" showIcon message={testResult.loi} style={{ marginBottom: 8 }} />}
    </div>
  );
};

export default CongThucCalculatorInput;
