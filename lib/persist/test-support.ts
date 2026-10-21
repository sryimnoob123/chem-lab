/**
 * lib/persist/test-support.ts —— vitest 用的 PGlite 临时库
 *
 * 用法（必须**先**设 PGLITE_DIR 再 import 本文件，`lib/db` 在模块加载时读环境变量）：
 *   process.env.PGLITE_DIR = mkdtempSync(path.join(tmpdir(), "chemlab-"));
 *   const { setupTestDb } = await import("./test-support");
 *   const { cleanup } = await setupTestDb();
 *
 * 不碰项目里的 `./.pgdata`；跑完 close + 删临时目录。
 */

import fs from "node:fs";
import path from "node:path";

export interface TestDbHandle {
  dir: string;
  cleanup: () => Promise<void>;
}

export async function setupTestDb(): Promise<TestDbHandle> {
  const dir = process.env.PGLITE_DIR;
  if (!dir) {
    throw new Error("PGLITE_DIR 必须在 import test-support 之前设置");
  }

  const { client } = await import("@/lib/db");
  const ddlPath = path.resolve(process.cwd(), "db/migrations/0001_init.sql");
  await client.exec(fs.readFileSync(ddlPath, "utf8"));

  return {
    dir,
    cleanup: async () => {
      await client.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
