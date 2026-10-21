import { describe, expect, it } from "vitest";
import { parseRosterCsv } from "./roster-csv";

describe("roster-csv：名单导入解析", () => {
  it("无表头：学号,姓名,班级", () => {
    const result = parseRosterCsv("2023001,张三,化学2301\n2023002,李四,化学2301");
    expect(result.errors).toEqual([]);
    expect(result.skipped).toBe(0);
    expect(result.rows).toEqual([
      { studentNo: "2023001", name: "张三", className: "化学2301" },
      { studentNo: "2023002", name: "李四", className: "化学2301" },
    ]);
  });

  it("有表头：自动跳过", () => {
    const result = parseRosterCsv("学号,姓名,班级\r\n2023001,张三,化学2301\r\n");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.studentNo).toBe("2023001");
  });

  it("英文表头也识别", () => {
    const result = parseRosterCsv("studentNo,name,className\n2023003,王五,化学2302");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.className).toBe("化学2302");
  });

  it("全角逗号 / 制表符 / 全角空格都能分列", () => {
    const result = parseRosterCsv("2023004，赵六，化学2303\n2023005\t钱七\t化学2303");
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { studentNo: "2023004", name: "赵六", className: "化学2303" },
      { studentNo: "2023005", name: "钱七", className: "化学2303" },
    ]);
  });

  it("允许缺班级列", () => {
    const result = parseRosterCsv("2023006,孙八");
    expect(result.rows[0]).toEqual({ studentNo: "2023006", name: "孙八", className: "" });
  });

  it("缺姓名/缺学号的行报错但不中断其余行", () => {
    const result = parseRosterCsv("2023007,周九,化学2301\n,无学号,化学2301\n2023009,,化学2301");
    expect(result.rows).toHaveLength(1);
    expect(result.errors).toEqual(["LINE_2:MISSING_STUDENT_NO", "LINE_3:MISSING_NAME"]);
  });

  it("文件内重复学号：保留首行，skipped +1", () => {
    const result = parseRosterCsv("2023001,张三,化学2301\n2023001,张三丰,化学2301");
    expect(result.rows).toHaveLength(1);
    expect(result.skipped).toBe(1);
    expect(result.errors).toEqual(["LINE_2:DUPLICATE_STUDENT_NO"]);
  });

  it("忽略空行与 UTF-8 BOM", () => {
    const result = parseRosterCsv("\uFEFF2023001,张三,化学2301\n\n   \n2023002,李四,化学2301\n");
    expect(result.rows).toHaveLength(2);
    expect(result.errors).toEqual([]);
  });
});
