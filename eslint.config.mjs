import { defineConfig } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTs,
  {
    ignores: [".next/**", "node_modules/**", "e2e-review/**", ".pgdata/**"],
  },
]);
