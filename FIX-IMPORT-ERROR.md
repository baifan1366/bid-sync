# 修复 "Cannot use import statement outside a module" 错误

## 问题描述
在运行时遇到 `SyntaxError: Cannot use import statement outside a module` 错误。

## 可能的原因

1. **浏览器缓存** - 旧的编译代码仍在缓存中
2. **Next.js构建缓存** - `.next`文件夹包含过期的构建文件
3. **Node modules问题** - 新安装的包未正确编译

## 解决方案

### 方案1: 清除缓存并重新构建（推荐）

```bash
# 停止开发服务器（如果正在运行）
# Ctrl+C

# 删除.next文件夹
rmdir /s /q .next

# 删除node_modules/.cache（如果存在）
rmdir /s /q node_modules\.cache

# 重新安装依赖（可选，如果问题持续）
rmdir /s /q node_modules
npm install

# 重新启动开发服务器
npm run dev
```

### 方案2: 清除浏览器缓存

1. 打开浏览器开发者工具（F12）
2. 右键点击刷新按钮
3. 选择"清空缓存并硬性重新加载"

### 方案3: 检查package.json

确保`package.json`中有正确的type设置：

```json
{
  "type": "module"  // 如果使用ES modules
}
```

或者确保没有这个字段（Next.js默认配置）。

### 方案4: 检查新安装的包

我们刚刚安装了`@tiptap/extension-character-count`。确保它正确安装：

```bash
npm list @tiptap/extension-character-count
```

如果显示错误，重新安装：

```bash
npm uninstall @tiptap/extension-character-count
npm install @tiptap/extension-character-count
```

## 验证修复

1. 启动开发服务器：
   ```bash
   npm run dev
   ```

2. 打开浏览器访问workspace页面

3. 选择一个proposal并切换到编辑模式

4. 检查是否能看到section tabs

5. 尝试切换sections并编辑内容

## 如果问题仍然存在

### 检查控制台错误

打开浏览器控制台（F12），查看完整的错误堆栈：
- 错误发生在哪个文件？
- 错误发生在哪一行？

### 检查网络请求

在开发者工具的Network标签中：
- 检查是否有失败的请求
- 检查JavaScript文件是否正确加载

### 临时回退

如果需要临时回退到之前的版本：

```bash
# 撤销workspace-section-editor.tsx
git checkout HEAD -- components/client/workspace-section-editor.tsx

# 撤销workspace-content.tsx的section相关更改
git checkout HEAD -- components/client/workspace-content.tsx

# 撤销use-tiptap-editor.ts的更改
git checkout HEAD -- hooks/use-tiptap-editor.ts
```

## 预防措施

1. **定期清理缓存**
   ```bash
   npm run clean  # 如果有这个脚本
   ```

2. **使用.gitignore**
   确保`.next`和`node_modules`在`.gitignore`中

3. **重启开发服务器**
   在安装新包后总是重启开发服务器

## 相关文件

- `components/client/workspace-section-editor.tsx` - 新建的section编辑器
- `components/client/workspace-content.tsx` - 添加了section切换功能
- `hooks/use-tiptap-editor.ts` - 添加了CharacterCount扩展
- `package.json` - 包含新安装的依赖

## 技术支持

如果以上方案都无法解决问题，请提供：
1. 完整的错误堆栈
2. 浏览器控制台截图
3. `npm list`的输出
4. Node.js版本（`node -v`）
5. npm版本（`npm -v`）
