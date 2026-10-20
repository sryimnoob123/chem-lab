import { defineConfig } from "drizzle-kit";

// drizzle-kit 的 push/studio 需要真实 PG 连接（本地 portable PG，端口 5433）。
// 凭据一律走 .env.local 的 DATABASE_URL，不写死；日常开发走 PGlite（lib/db/index.ts）不需要它。
if (!process.env.DATABASE_URL) {
  console.warn("[drizzle-kit] DATABASE_URL 未设置，push/studio 将不可用");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
