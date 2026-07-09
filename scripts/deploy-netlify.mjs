import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteId = "ea63b436-d193-4b92-ad4f-4ecf71236465";
const siteName = "baidu-generator";
const prodUrl = "https://baidu-generator.netlify.app";

// 避免用户级 / 会话级 NETLIFY_SITE_ID 指向其他站点
process.env.NETLIFY_SITE_ID = siteId;

function quoteArg(value) {
  return /[\s"]/.test(value) ? `"${value.replaceAll('"', '\\"')}"` : value;
}

function run(command, { capture = false } = {}) {
  return execSync(command, {
    cwd: root,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    shell: true,
    env: process.env,
  });
}

function runNetlify(args) {
  const command = ["netlify", ...args].map(quoteArg).join(" ");
  return run(command, { capture: true });
}

function extractDeployId(output) {
  const fromDraftUrl = output.match(/Draft URL:\s*<?https:\/\/([a-f0-9]+)--/i);
  if (fromDraftUrl) return fromDraftUrl[1];

  const fromDeployId = output.match(/deployId:\s*([a-f0-9]+)/i);
  if (fromDeployId) return fromDeployId[1];

  throw new Error("无法从 netlify deploy 输出中解析 deploy ID");
}

console.log("Building (type-check + vite → dist/) ...");
run("npm run build");

console.log("Uploading dist/ (draft, no Netlify build) ...");
const deployOutput = runNetlify([
  "deploy",
  "--dir=dist",
  `--site=${siteId}`,
]);

const deployId = extractDeployId(deployOutput);
console.log(`Draft deploy ready: ${deployId}`);

console.log("Publishing to production (restoreSiteDeploy) ...");
runNetlify([
  "api",
  "restoreSiteDeploy",
  "--data",
  JSON.stringify({ site_id: siteId, deploy_id: deployId }),
]);

console.log(`Production live: ${prodUrl}`);
console.log(
  `Deploy: https://app.netlify.com/projects/${siteName}/deploys/${deployId}`,
);
