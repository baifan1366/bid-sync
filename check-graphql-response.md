# 检查 GraphQL 响应结构

从服务器日志可以看到：
```
versions_count: 23  // ✅ 查询到了23个版本
attachments_count: 0
```

但是最终返回：
```
versions_count: 0  // ❌ 返回的versions是0
```

## 问题分析

日志显示 `versions_count: 23` 是在 **section mapping** 阶段，说明我们成功查询到了版本。

但是最终的 `versions_count: 0` 是指 **proposal 级别的 versions**（`proposal_versions` 表），不是 section 级别的！

## 数据结构

正确的数据结构应该是：

```json
{
  "proposalDetail": {
    "sections": [
      {
        "id": "...",
        "title": "...",
        "content": "...",
        "versions": [  // ← section 的版本（来自 document_versions）
          { "id": "...", "versionNumber": 1, ... },
          { "id": "...", "versionNumber": 2, ... }
        ],
        "documents": [  // ← section 的附件（来自 section_attachments）
          { "id": "...", "name": "...", ... }
        ]
      }
    ],
    "documents": [],  // ← proposal 级别的文档（来自 documents 表）
    "versions": []    // ← proposal 级别的版本（来自 proposal_versions 表）
  }
}
```

## 需要检查

请在浏览器的 Network 标签中：
1. 找到 GraphQL 请求
2. 查看 Response
3. 检查 `sections[0].versions` 是否有数据
4. 检查 `sections[0].documents` 是否有数据

如果 `sections[0].versions` 是空数组，说明数据没有正确返回。
如果 `sections[0].versions` 有数据，说明前端没有正确显示。
