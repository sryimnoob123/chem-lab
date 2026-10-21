import { describe, expect, it } from "vitest";
import { errorMessage, retryLabel, sanitizeForStudents } from "./messages";

describe("E3 系统错误：分类成人话，不泄漏技术错误码", () => {
  it("网络异常 → 网络断了（提示可重试）", () => {
    const copy = errorMessage(new TypeError("Failed to fetch"));
    expect(copy.kind).toBe("network");
    expect(copy.retryable).toBe(true);
    expect(copy.message).not.toMatch(/fetch|TypeError|ECONN/i);
    expect(copy.message).toContain("Wi-Fi");
  });

  it("5xx → 服务器没响应；原始错误码不出现在文案里", () => {
    const copy = errorMessage({ status: 500, message: "ERR_500 internal" });
    expect(copy.kind).toBe("server");
    expect(copy.message).not.toMatch(/ERR_500|500/);
    expect(copy.message).toContain("3 秒");
  });

  it("401 → 登录过期，且不算可重试", () => {
    const copy = errorMessage({ statusCode: 401, message: "Unauthorized" });
    expect(copy.kind).toBe("auth");
    expect(copy.retryable).toBe(false);
    expect(copy.message).toContain("重新登录");
  });

  it("未知异常 → 仍给出学生能做的动作", () => {
    expect(errorMessage(undefined).kind).toBe("unknown");
    expect(errorMessage(null).message).toContain("再点一次");
  });
});

describe("错误文案清洗", () => {
  it("技术错误原文整个人话兜底，不拼接原文", () => {
    const cleaned = sanitizeForStudents("TypeError: Failed to fetch at foo (bar.tsx:12)");
    expect(cleaned).toBe("这一步没完成，再点一次；还不行就告诉老师");
  });

  it("化学数字（500 mL / pH 7.00）不被误伤", () => {
    expect(sanitizeForStudents("倒入 500 mL 蒸馏水")).toBe("倒入 500 mL 蒸馏水");
    expect(sanitizeForStudents("pH 7.00 时终点")).toBe("pH 7.00 时终点");
  });
});

describe("重试按钮文案", () => {
  it("登录过期给「重新登录」，其余给「重试」", () => {
    expect(retryLabel("auth")).toBe("重新登录");
    expect(retryLabel("network")).toBe("重试");
  });
});
