# Vercel Cron Jobs - Quick Start Guide

## 快速设置步骤

### 1. 生成 CRON_SECRET

```bash
# 使用 Node.js 生成随机密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. 在 Vercel 中设置环境变量

1. 访问 Vercel 项目仪表板
2. 进入 **Settings** → **Environment Variables**
3. 添加新变量：
   - **Name:** `CRON_SECRET`
   - **Value:** 粘贴步骤 1 生成的密钥
   - **Environments:** 选择所有环境（Production, Preview, Development）

### 3. 部署到 Vercel

```bash
# 提交更改
git add .
git commit -m "Add Vercel cron jobs"
git push

# 或者使用 Vercel CLI
vercel --prod
```

### 4. 验证 Cron Jobs 已设置

1. 在 Vercel 仪表板中，进入你的项目
2. 点击 **Settings** → **Cron Jobs**
3. 你应该看到 3 个 cron jobs：
   - `/api/cron/retention-policy` - 每天 2:00 AM UTC
   - `/api/cron/archive-deletion` - 每天 3:00 AM UTC
   - `/api/cron/export-cleanup` - 每天 4:00 AM UTC

## Cron Jobs 说明

### 1. Retention Policy (保留策略)
- **时间:** 每天 2:00 AM UTC
- **功能:** 检查过期的归档并标记为删除
- **通知:** 向相关人员发送删除通知

### 2. Archive Deletion (归档删除)
- **时间:** 每天 3:00 AM UTC
- **功能:** 删除已过宽限期的归档
- **审计:** 记录所有删除操作

### 3. Export Cleanup (导出清理)
- **时间:** 每天 4:00 AM UTC
- **功能:** 删除过期的导出文件（7天后）
- **存储:** 释放存储空间

## 手动测试

```bash
# 替换 YOUR_DOMAIN 和 YOUR_CRON_SECRET
curl -X GET https://YOUR_DOMAIN.vercel.app/api/cron/retention-policy \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

curl -X GET https://YOUR_DOMAIN.vercel.app/api/cron/archive-deletion \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

curl -X GET https://YOUR_DOMAIN.vercel.app/api/cron/export-cleanup \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## 监控

### 查看日志

1. Vercel 仪表板 → **Deployments** → **Functions**
2. 筛选 cron job 路径
3. 查看执行日志

### 数据库日志

所有操作都记录在 `operation_logs` 表中：

```sql
-- 查看最近的 cron 执行
SELECT * FROM operation_logs 
WHERE operation IN (
  'RETENTION_CHECK',
  'RETENTION_EXECUTE_DELETION',
  'EXPORT_CLEANUP'
)
ORDER BY timestamp DESC
LIMIT 20;
```

## 故障排除

### Cron Job 未运行

1. 检查 `vercel.json` 在根目录
2. 确认 `CRON_SECRET` 已设置
3. 重新部署项目

### 401 Unauthorized

1. 验证 `CRON_SECRET` 环境变量
2. 确保所有环境都设置了
3. 重新部署

### 超时错误

1. 检查 `maxDuration` 设置（最大 300 秒）
2. 优化操作（分批处理）
3. 考虑升级 Vercel 计划

## 更多信息

详细文档请参阅 [VERCEL-CRON-SETUP.md](./VERCEL-CRON-SETUP.md)
