function parseInt10(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export const config = {
  automationSharedApiKeys: (process.env.AUTOMATION_SHARED_API_KEYS ?? process.env.AUTOMATION_SHARED_API_KEY ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0),
  freeUserTotalDemos: parseInt10(process.env.FREE_USER_TOTAL_DEMOS, 1),
  proUserDailyEnrichments: parseInt10(process.env.PRO_USER_DAILY_ENRICHMENTS, 25),
  signupsRequireApproval: (process.env.SIGNUPS_REQUIRE_APPROVAL ?? "true") !== "false",
  initialAdminEmails: (process.env.INITIAL_ADMIN_EMAILS ?? process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0),
  usageResetTimezone: process.env.USAGE_RESET_TIMEZONE || "America/New_York",
  appBaseUrl: process.env.APP_BASE_URL || "",
  supportEmail: process.env.SUPPORT_EMAIL || "",
};

/**
 * Returns the YYYY-MM-DD "today" in the configured usage timezone.
 * Uses Intl APIs so DST transitions are handled correctly.
 */
export function getUsageDateString(now: Date = new Date()): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: config.usageResetTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return fmt.format(now); // "en-CA" gives YYYY-MM-DD
  } catch {
    return now.toISOString().slice(0, 10);
  }
}
