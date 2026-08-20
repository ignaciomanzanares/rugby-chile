import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // The standard "setLoading(true) / reset state before a fetch" effect
      // pattern used by our data hooks trips this React 19 rule; keep it as a
      // hint rather than a hard error.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Scripts de build (Node/CommonJS, se corren a mano con `node`): no son
    // código de app y usan require(), que la config TS marca como error.
    "scripts/**",
  ]),
]);

export default eslintConfig;
