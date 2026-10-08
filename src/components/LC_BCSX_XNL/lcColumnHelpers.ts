import type { FormColumnDef } from "../CustomFormTable";

/** CustomFormTable đọc col.render khi type="index" (không khai báo trong FormColumnDef,
 *  truy cập qua `as any` ở phía CustomFormTable) — cột STT dùng chung cho mọi tab LC. */
export function sttColumn(): FormColumnDef {
  return {
    title: "STT",
    dataIndex: "stt",
    type: "index",
    width: 50,
    render: (_: unknown, __: unknown, index: number) => index + 1,
  } as FormColumnDef;
}
