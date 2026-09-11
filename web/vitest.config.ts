import { defineConfig } from "vitest/config";
import path from "node:path";

// Las pruebas necesitan el mismo alias "@/" que usa la app (tsconfig paths);
// sin esto, cualquier módulo que importe con "@/..." no resuelve al testearlo.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
