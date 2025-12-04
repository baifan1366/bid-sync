# Cron Jobs 配置

## 概述

本项目使用 **Vercel Cron Jobs** 来执行定期维护任务。

## 快速开始

### 1. 设置环境变量

在 Vercel 项目中添加 `CRON_SECRET` 环境变量：

```bash
# 生成密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 在 Vercel 中设置
# Settings → Environment Variables → Add
# Name: CRON_SECRET
# Value: <生成的密钥>
```

### 2. 部署

```bash
git push
```

就这么简单！Vercel 会自动识别 `vercel.json` 并设置 cron jobs。

## Cron Jobs 列表

| 任务 | 路径 | 时间 | 功能 |
|------|------|------|------|
| 保留策略 | `/api/cron/retention-policy` | 每天 2:00 AM UTC | 检查并标记过期归档 |
| 归档删除 | `/api/cron/archive-deletion` | 每天 3:00 AM UTC | 删除已过宽限期的归档 |
| 导出清理 | `/api/cron/export-cleanup` | 每天 4:00 AM UTC | 删除过期的导出文件 |
| 截止日期提醒 | `/api/cron/deadline-reminders` | 每天 9:00 AM UTC | 发送项目和章节截止日期提醒 |

## 监控

### Vercel 仪表板
1. 进入项目
2. Deployments → Functions
3. 筛选 cron 路径

### 数据库日志
```sql
SELECT * FROM operation_logs 
WHERE operation IN ('RETENTION_CHECK', 'RETENTION_EXECUTE_DELETION', 'EXPORT_CLEANUP')
ORDER BY timestamp DESC;
```

## 文档

- 📖 [完整设置指南](./VERCEL-CRON-SETUP.md)
- 🚀 [快速开始](./CRON-JOBS-QUICKSTART.md)
- 📝 [迁移说明](./CRON-MIGRATION-NOTES.md)

## 故障排除

### Cron Job 未运行
- 检查 `CRON_SECRET` 环境变量
- 确认 `vercel.json` 在根目录
- 重新部署项目

### 401 错误
- 验证 `CRON_SECRET` 已正确设置
- 确保所有环境都有该变量

## 手动测试

```bash
curl -X GET https://your-domain.vercel.app/api/cron/retention-policy \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## 支持

遇到问题？查看 [VERCEL-CRON-SETUP.md](./VERCEL-CRON-SETUP.md) 获取详细帮助。
