import { describe, expect, it } from "vitest";
import { UTF8_BOM, csvCell, fileDateStamp, formatDateTime, toCsv } from "./csv";

describe("csv：导出序列化", () => {
  it("带 UTF-8 BOM，Excel 直开不乱码", () => {
    const text = toCsv([["学号", "姓名"]]);
    expect(text.startsWith(UTF8_BOM)).toBe(true);
    expect(text).toBe(`${UTF8_BOM}学号,姓名\r\n`);
  });

  it("逗号 / 双引号 / 换行 / 制表符 会被引号包裹并转义", () => {
    expect(csvCell("张,三")).toBe('"张,三"');
    expect(csvCell('他说"好"')).toBe('"他说""好"""');
    expect(csvCell("第一行\n第二行")).toBe('"第一行\n第二行"');
    expect(csvCell("a\tb")).toBe('"a\tb"');
  });

  it("普通值不加引号；null/undefined 输出空串", () => {
    expect(csvCell("张三")).toBe("张三");
    expect(csvCell(42)).toBe("42");
    expect(csvCell(0)).toBe("0");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("多行用 CRLF 连接，末尾带换行", () => {
    const text = toCsv([
      ["a", "b"],
      ["c", "d"],
    ]);
    expect(text).toBe(`${UTF8_BOM}a,b\r\nc,d\r\n`);
  });

  it("时间格式稳定", () => {
    expect(formatDateTime(null)).toBe("");
    expect(formatDateTime(new Date(2026, 9, 20, 8, 5))).toBe("2026-10-20 08:05");
    expect(fileDateStamp(new Date(2026, 9, 20))).toBe("20261020");
  });
});
