# 启用 Realtime 完整指南

## 问题
Chat 消息不会实时显示，需要刷新页面才能看到新消息。

## 原因
Supabase Realtime 需要两个条件才能工作：
1. ✅ 表必须启用 RLS (Row Level Security) - 已完成
2. ❌ 表必须启用 REPLICA IDENTITY - **缺失**
3. ❌ 表必须添加到 `supabase_realtime` publication - **缺失**

## 需要启用 Realtime 的表

### 核心功能表

1. **chat_messages** - 聊天消息实时更新
   - 用途：即时聊天
   - 优先级：🔴 高

2. **proposals** - Proposal 状态更新
   - 用途：状态变更通知
   - 优先级：🟡 中

3. **notifications** - 通知实时推送
   - 用途：系统通知
   - 优先级：🟡 中

4. **notification_queue** - 通知队列
   - 用途：通知处理
   - 优先级：🟡 中

### 协作编辑表

5. **document_versions** - 文档版本更新
   - 用途：协作编辑
   - 优先级：🟢 低

6. **collaboration_sessions** - 用户在线状态
   - 用途：显示谁在编辑
   - 优先级：🟢 低

7. **section_locks** - 章节锁定状态
   - 用途：防止编辑冲突
   - 优先级：🟢 低

## 解决方案

### 方法 1: 运行 SQL 脚本（推荐）

1. 打开 Supabase Dashboard
2. 进入 SQL Editor
3. 运行 `enable-realtime-for-chat.sql` 脚本
4. 重启应用

```bash
# 重启开发服务器
# Ctrl+C 停止
npm run dev
```

### 方法 2: 手动在 Supabase Dashboard 配置

#### 步骤 1: 启用 Realtime Replication

1. 登录 Supabase Dashboard
2. 选择你的项目
3. 进入 **Database** → **Replication**
4. 找到以下表并启用 Realtime：
   - ✅ chat_messages
   - ✅ proposals
   - ✅ notifications
   - ✅ notification_queue
   - ✅ document_versions
   - ✅ collaboration_sessions
   - ✅ section_locks

#### 步骤 2: 验证配置

在 SQL Editor 运行：

```sql
-- 查看哪些表启用了 Realtime
SELECT 
    schemaname,
    tablename,
    'Enabled' as realtime_status
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public'
ORDER BY tablename;
```

应该看到所有上述表都在列表中。

## 验证 Realtime 是否工作

### 测试 1: Chat 消息

1. 打开两个浏览器窗口
2. 窗口 A: 以 client 身份登录
3. 窗口 B: 以 bidding lead 身份登录
4. 两个窗口都打开同一个 proposal 的 chat
5. 在窗口 A 发送消息
6. **验证**: 窗口 B 应该**立即**看到消息（无需刷新）

### 测试 2: 连接状态

1. 打开 chat section
2. 查看右上角的连接状态指示器
3. **期望**: 显示绿色的 "Connected" 状态
4. **如果显示红色**: Realtime 未正确配置

### 测试 3: 浏览器控制台

打开浏览器控制台，应该看到：

```javascript
// 成功连接
[Realtime] Connected to channel: chat:project:xxx:proposal:yyy

// 收到新消息
[Realtime] New message received: { id: '...', content: '...' }
```

## 常见问题

### Q1: 连接状态显示 "Connecting" 或 "Disconnected"

**原因**: Realtime 未启用或配置错误

**解决**:
1. 运行 `enable-realtime-for-chat.sql`
2. 在 Supabase Dashboard 检查 Replication 设置
3. 重启应用

### Q2: 消息发送后不显示

**原因**: 可能是 RLS 策略问题

**解决**:
```sql
-- 检查 chat_messages 的 RLS 策略
SELECT * FROM pg_policies 
WHERE tablename = 'chat_messages';
```

确保有 SELECT 策略允许用户读取消息。

### Q3: 只有发送者能看到消息，接收者看不到

**原因**: Realtime 订阅的过滤条件不正确

**解决**: 检查 `use-realtime-messages.ts` 中的过滤逻辑：

```typescript
// 确保过滤条件正确
.on(
  "postgres_changes",
  {
    event: "INSERT",
    schema: "public",
    table: "chat_messages",
    filter: `project_id=eq.${projectId}`,  // ✅ 正确
  },
  (payload) => {
    // 在回调中进一步过滤
    if (proposalId && newMessage.proposal_id !== proposalId) {
      return
    }
    // 处理消息
  }
)
```

### Q4: Realtime 在本地工作，但在生产环境不工作

**原因**: 生产数据库可能没有启用 Realtime

**解决**:
1. 在生产数据库运行 `enable-realtime-for-chat.sql`
2. 检查生产环境的 Supabase 项目设置
3. 确保 API keys 正确

## 性能优化

### 1. 限制订阅范围

只订阅需要的数据：

```typescript
// ✅ 好 - 只订阅特定 project
filter: `project_id=eq.${projectId}`

// ❌ 差 - 订阅所有数据
filter: undefined
```

### 2. 使用 Channel 名称

为不同的聊天创建不同的 channel：

```typescript
const channelName = proposalId
  ? `chat:project:${projectId}:proposal:${proposalId}`
  : `chat:project:${projectId}`
```

### 3. 清理订阅

组件卸载时取消订阅：

```typescript
useEffect(() => {
  const channel = supabase.channel(channelName).subscribe()
  
  return () => {
    channel.unsubscribe()  // ✅ 清理
  }
}, [])
```

## 调试工具

### 1. 浏览器控制台

查看 Realtime 连接日志：

```javascript
// 在浏览器控制台运行
localStorage.setItem('supabase.realtime.debug', 'true')
// 刷新页面
```

### 2. Supabase Dashboard

查看 Realtime 连接：
1. Dashboard → Logs → Realtime
2. 查看连接和消息日志

### 3. Network 标签

查看 WebSocket 连接：
1. DevTools → Network → WS
2. 应该看到 `realtime` WebSocket 连接
3. 查看消息流

## 快速修复命令

```bash
# 1. 运行 SQL 脚本
# 在 Supabase Dashboard SQL Editor 中运行 enable-realtime-for-chat.sql

# 2. 重启开发服务器
# Ctrl+C 停止
npm run dev

# 3. 清除浏览器缓存
# Ctrl+Shift+R (Windows) 或 Cmd+Shift+R (Mac)

# 4. 测试 chat 功能
```

## 相关文件

- ✅ `enable-realtime-for-chat.sql` - SQL 脚本
- ✅ `hooks/use-realtime-messages.ts` - Realtime hook
- ✅ `components/client/chat-section.tsx` - Chat 组件
- 📝 `ENABLE-REALTIME-完整指南.md` - 本文档

## 总结

启用 Realtime 需要：

1. ✅ 运行 `enable-realtime-for-chat.sql` 脚本
2. ✅ 或在 Supabase Dashboard 手动启用
3. ✅ 重启应用
4. ✅ 测试验证

完成后，chat 消息应该实时显示，无需刷新页面！
