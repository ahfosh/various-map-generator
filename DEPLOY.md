# 部署流程（Git → 上线）

本项目为 **Vue 3 + Vite** 前端。本机先 `npm run build` 产出 `dist/`，再经 **Netlify CLI 直传** 上线，**不**走 Git 触发的 Build 队列，从而**不消耗 Netlify 构建额度**。

生产地址：https://baidu-generator.netlify.app  
站点 ID：`ea63b436-d193-4b92-ad4f-4ecf71236465`（项目名 `baidu-generator`）

---

## 0. 前置条件（只需做一次）

| 项 | 说明 |
|----|------|
| 仓库 | `git clone` 本仓库，具备 push 权限 |
| Node.js | 已安装（建议 22+） |
| 依赖 | `pnpm i` 或 `npm i` |
| Netlify CLI | `npm i -g netlify-cli` |
| 登录 | `netlify login`（浏览器授权） |
| 站点关联 | 仓库根目录存在 `.netlify/state.json`，指向上述站点 |

若尚未 link：

```powershell
netlify link --id ea63b436-d193-4b92-ad4f-4ecf71236465
```

**不要**在用户级环境变量里固定 `NETLIFY_SITE_ID`（会覆盖各仓库本地 link，多站点时容易连错）。各项目用各自的 `.netlify/state.json`；部署脚本也会强制使用本站 ID。

---

## 1. 改代码

按需修改 `src/`、`public/`、`index.html` 等源码。本地预览：

```powershell
pnpm dev
# 或 npm run dev
```

---

## 2. Git 提交并推送

```powershell
git add <相关文件>
git commit -m "简要说明本次改动"
git push origin main
```

说明：`git push` 只更新 GitHub 备份，**不会**自动把站点变成最新生产版本（本站不依赖 Git 触发的 Netlify Build）。

---

## 3. 真正上线：CLI 直部署

在仓库根目录执行：

```powershell
npm run deploy:netlify
```

等价于 `scripts/deploy-netlify.mjs`：

1. **本机构建**  
   `npm run build`（type-check + `vite build` → `dist/`）

2. **上传草稿**  
   `netlify deploy --dir=dist --site=<本站 ID>`  
   - 只上传已构建的静态文件  
   - **不跑** Netlify Git Build，不占构建分钟数  

3. **发布到生产**  
   `netlify api restoreSiteDeploy`（传入 `site_id` + 本次 `deploy_id`）  
   - 将草稿 deploy 设为当前生产  
   - 原因：部分站点对 `netlify deploy --prod` 可能返回 `Forbidden`，故用 API restore  

成功时控制台类似：

```text
Building (type-check + vite → dist/) ...
Uploading dist/ (draft, no Netlify build) ...
Draft deploy ready: <deployId>
Publishing to production (restoreSiteDeploy) ...
Production live: https://baidu-generator.netlify.app
Deploy: https://app.netlify.com/projects/baidu-generator/deploys/<deployId>
```

---

## 4. 验收

1. 打开 https://baidu-generator.netlify.app（必要时 Ctrl+F5 硬刷新）
2. 确认本次改动是否生效
3. 可在 Netlify Deploy 链接中确认对应 `deployId`

---

## 流程简图

```text
改代码 → git commit → git push（备份到 GitHub）
                    ↓
         npm run deploy:netlify
                    ↓
         本机 build → dist/
                    ↓
         上传 dist/（draft，无 Netlify build）
                    ↓
         restoreSiteDeploy（切生产）
                    ↓
         https://baidu-generator.netlify.app 已更新
```

---

## 为什么能绕过构建额度

| 方式 | 是否占 Netlify Build 额度 |
|------|---------------------------|
| Git push 触发 Netlify 自动 Build | 是（build minutes） |
| `npm run deploy:netlify` CLI 直传 | **否**（本机构建，只上传 `dist/`） |

第三者只要具备：**本机 Node + 依赖已装 + 已 `netlify login` 的 CLI + 本站权限**，即可按第 1–4 步独立完成上线，无需在 Netlify 网页上点 Deploy，也无需可用的 Build 额度。

---

## 相关路径

| 路径 | 职责 |
|------|------|
| `src/` / `public/` / `index.html` | 源码与静态资源 |
| `dist/` | Vite 构建产物（发布目录，已 gitignore） |
| `scripts/deploy-netlify.mjs` | 本机构建 + 上传草稿 + 发布生产 |
| `netlify.toml` | publish / SPA 回退 / 安全响应头 |
| `.netlify/state.json` | CLI 关联的站点 ID（本地，已 gitignore） |
