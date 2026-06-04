export type E2eTarget = "test" | "prod";

export const E2E_TARGETS: Record<
  E2eTarget,
  {
    apiBase: string;
    envFile: string;
    devCommand: string;
    port: number;
    authStorage: string;
  }
> = {
  test: {
    apiBase: "https://www.mahabehavioralhealth.com/mahaverse-backend-test",
    envFile: ".env.test",
    devCommand: "pnpm run dev:test",
    port: 3000,
    authStorage: "e2e/.auth/user-test.json",
  },
  prod: {
    apiBase: "https://www.mahabehavioralhealth.com/mahaverse-backend-logics",
    envFile: ".env.prod",
    devCommand: "pnpm run dev:prod",
    port: 3001,
    authStorage: "e2e/.auth/user-prod.json",
  },
};

export function parseE2eTarget(raw?: string): E2eTarget | "all" {
  if (raw === "prod") return "prod";
  if (raw === "test") return "test";
  return "all";
}

/** Default: test only. Use `E2E_TARGET=prod` or npm `test:e2e` for both. */
export function targetsToRun(raw?: string): E2eTarget[] {
  if (!raw || raw === "all") {
    if (raw === "all") return ["test", "prod"];
    return ["test"];
  }
  const t = parseE2eTarget(raw);
  return t === "all" ? ["test", "prod"] : [t];
}
