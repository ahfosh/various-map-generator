# Project rules

## Release workflow

完成就提交；提交必推送；推送必部署。

1. **完成**功能或修复后：`git add` + `git commit`（不要只改不提交）
2. **提交后立刻** `git push origin main`（不要只提交不推送）
3. **推送后立刻** `npm run deploy:netlify`（本机构建 `dist/` → CLI 直传 → 生产）

生产地址：https://baidu-generator.netlify.app  
站点 ID：`ea63b436-d193-4b92-ad4f-4ecf71236465`

详情见 `DEPLOY.md`。
