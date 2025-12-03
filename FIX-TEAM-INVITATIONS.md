# 修复 Team Invitations 问题

## 🔴 问题

错误信息：`Only proposal leads can generate team invitations`

## 🎯 根本原因

1. **缺少数据**：`proposal_team_members` 表中没有 proposal lead 的记录
2. **权限检查失败**：系统检查 `proposal_team_members` 表，但找不到当前用户是 lead

## ✅ 解决方案

### 方法 1：运行修复脚本（推荐）

在 Supabase Dashboard 的 SQL Editor 中运行：

```bash
db/migrations/fix-proposal-team-members-data.sql
```

这个脚本会：
- ✅ 将所有现有 proposal 的 leads 添加到 `proposal_team_members` 表
- ✅ 创建触发器，自动为新 proposals 添加 lead
- ✅ 更新 RLS 策略支持 `proposal_id`
- ✅ 验证迁移结果

### 方法 2：手动修复（快速）

如果你只想快速修复当前用户，运行：

```sql
-- 将你的用户添加为 proposal lead
INSERT INTO public.proposal_team_members (proposal_id, user_id, role)
SELECT 
    p.id,
    p.lead_id,
    'lead'
FROM public.proposals p
WHERE p.lead_id = auth.uid()
ON CONFLICT (proposal_id, user_id) DO NOTHING;
```

## 🔍 验证修复

运行以下查询检查：

```sql
-- 检查你的 proposals 和 team members
SELECT 
    p.id as proposal_id,
    p.lead_id,
    u.email as lead_email,
    ptm.role,
    ptm.joined_at
FROM public.proposals p
LEFT JOIN auth.users u ON u.id = p.lead_id
LEFT JOIN public.proposal_team_members ptm ON ptm.proposal_id = p.id AND ptm.user_id = p.lead_id
WHERE p.lead_id = auth.uid();
```

应该看到：
- ✅ 每个 proposal 都有对应的 `proposal_team_members` 记录
- ✅ `role` 列显示 `'lead'`

## 🚨 网络连接问题

如果看到 `ENOTFOUND uypxkxwfiazobteixhkd.supabase.co` 错误：

1. **检查网络连接**
2. **检查 .env 文件**：
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://uypxkxwfiazobteixhkd.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```
3. **重启开发服务器**：
   ```bash
   npm run dev
   ```

## 📋 完整修复步骤

1. **停止开发服务器** (Ctrl+C)

2. **运行数据库修复**：
   - 打开 Supabase Dashboard
   - 进入 SQL Editor
   - 运行 `db/migrations/fix-proposal-team-members-data.sql`

3. **验证修复**：
   ```sql
   SELECT COUNT(*) as proposals_with_leads
   FROM public.proposals p
   INNER JOIN public.proposal_team_members ptm 
       ON ptm.proposal_id = p.id 
       AND ptm.user_id = p.lead_id
       AND ptm.role = 'lead';
   ```

4. **重启开发服务器**：
   ```bash
   npm run dev
   ```

5. **测试邀请功能**：
   - 访问 `/lead/team`
   - 点击 proposal 旁边的 "Invite" 按钮
   - 应该能成功生成邀请

## 🎉 完成

修复后，你应该能够：
- ✅ 生成团队邀请
- ✅ 查看团队成员
- ✅ 管理 proposal 团队

## 🔧 未来预防

触发器已创建，以后创建新 proposal 时会自动添加 lead 到 `proposal_team_members` 表。
