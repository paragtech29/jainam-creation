import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Enforce userId scoping: only repository modules may talk to the raw
  // Drizzle client/schema. See docs/DATA-ACCESS.md for the full contract.
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/db/client", "@/lib/db/schema"],
              message:
                "Import the entity repository from @/lib/db/repositories/* instead of the raw Drizzle client/schema. This keeps every query userId-scoped.",
            },
          ],
        },
      ],
    },
  },
  // Exemption: repository modules, dev scripts, and drizzle.config.ts
  // legitimately talk to the raw Drizzle client/schema directly.
  {
    files: ["src/lib/db/repositories/**", "scripts/**", "drizzle.config.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
]);

export default eslintConfig;
