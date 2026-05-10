const userAgent = process.env.npm_config_user_agent || "";
const execPath = process.env.npm_execpath || "";

if (!userAgent.includes("pnpm") && !execPath.includes("pnpm")) {
  console.error("Use pnpm instead of npm or yarn.");
  process.exit(1);
}
