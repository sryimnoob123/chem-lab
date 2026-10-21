import { describe, expect, it } from "vitest";
import {
  SESSION_COOKIE,
  TEACHER_COOKIE,
  cookieOptions,
  signSessionValue,
  signTeacherValue,
  verifySessionValue,
  verifyTeacherValue,
} from "./session-token";

describe("session-token：cookie 签名", () => {
  it("学生令牌签发后可验签还原学号", () => {
    const value = signSessionValue("2023001");
    expect(value).toContain(".");
    expect(verifySessionValue(value)).toBe("2023001");
  });

  it("篡改 payload 一律拒绝", () => {
    const value = signSessionValue("2023001");
    const [payload, signature] = value.split(".");
    const tamperedPayload = payload.slice(0, -2) + (payload.endsWith("A") ? "BB" : "AA");
    expect(verifySessionValue(`${tamperedPayload}.${signature}`)).toBeNull();
  });

  it("篡改签名一律拒绝", () => {
    const value = signSessionValue("2023001");
    const [payload, signature] = value.split(".");
    const tampered = signature.slice(0, -1) + (signature.endsWith("A") ? "B" : "A");
    expect(verifySessionValue(`${payload}.${tampered}`)).toBeNull();
  });

  it("格式垃圾 / 空值 / 长度不符都返回 null", () => {
    expect(verifySessionValue(undefined)).toBeNull();
    expect(verifySessionValue(null)).toBeNull();
    expect(verifySessionValue("")).toBeNull();
    expect(verifySessionValue("nodot")).toBeNull();
    expect(verifySessionValue(".abc")).toBeNull();
    expect(verifySessionValue("abc.")).toBeNull();
    expect(verifySessionValue("abc.def")).toBeNull();
  });

  it("换 SESSION_SECRET 后旧令牌失效", () => {
    const previous = process.env.SESSION_SECRET;
    try {
      delete process.env.SESSION_SECRET;
      const value = signSessionValue("2023002");
      process.env.SESSION_SECRET = "another-secret-for-test";
      expect(verifySessionValue(value)).toBeNull();
    } finally {
      if (previous === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = previous;
    }
  });

  it("教师令牌不能当学生令牌用，反之亦然", () => {
    const teacher = signTeacherValue();
    expect(verifyTeacherValue(teacher)).toBe(true);
    expect(verifySessionValue(teacher)).toBeNull();
    expect(verifyTeacherValue(signSessionValue("2023001"))).toBe(false);
  });

  it("cookie 属性：httpOnly / lax / 7 天 / 根路径", () => {
    const options = cookieOptions();
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
    expect(options.maxAge).toBe(7 * 24 * 60 * 60);
    expect(SESSION_COOKIE).toBe("chem_sid");
    expect(TEACHER_COOKIE).toBe("chem_teacher");
  });
});
