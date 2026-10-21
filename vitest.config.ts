import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "db/**/*.test.ts", "experiments/**/*.test.ts"],
    // 本机 15.8G 内存：默认按核数开线程池会跟着 Next build 一起把内存顶爆，压到 4
    maxWorkers: 4,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
