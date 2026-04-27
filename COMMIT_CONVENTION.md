# Git 提交规范 (Git Commit Convention)

本项目采用 [Conventional Commits](https://www.conventionalcommits.org/) 规范进行提交信息的管理。这有助于自动化生成变更日志 (Changelog) 并提高项目的维护效率。

## 提交格式

每个提交消息由 **Header** (必须)、**Body** (可选) 和 **Footer** (可选) 组成。

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 1. Header

Header 部分只有一行，包括三个字段：`type` (必填)、`scope` (可选) 和 `subject` (必填)。

#### Type (类型)

必须是以下类型之一：

- **feat**: 新功能 (feature)
- **fix**: 修补 bug
- **docs**: 文档 (documentation)
- **style**: 格式 (不影响代码运行的变动)
- **refactor**: 重构 (即不是新增功能，也不是修改 bug 的代码变动)
- **perf**: 性能优化
- **test**: 增加测试
- **chore**: 构建过程或辅助工具的变动
- **revert**: 回滚到上一个版本
- **build**: 影响构建系统或外部依赖关系的更改 (例如: gulp, npm, webpack)
- **ci**: 对 CI 配置文件和脚本的更改 (例如: Travis, Circle, BrowserStack, SauceLabs)

#### Scope (范围)

`scope` 用于说明 commit 影响的范围，比如 `server`, `ui`, `api` 等。

#### Subject (主题)

`subject` 是 commit 目的的简短描述，不超过 50 个字符。

- 以动词开头，使用第一人称现在时，比如 `change` 而不是 `changed` 或 `changes`
- 第一个字母小写
- 结尾不加句号 (.)

### 2. Body (正文)

Body 部分是对本次 commit 的详细描述，可以分成多行。应该说明修改的原因和修改前后的区别。

### 3. Footer (页脚)

Footer 部分只用于两种情况：

- **不兼容变动 (Breaking Change)**: 以 `BREAKING CHANGE:` 开头，后面是对变动的描述、以及变动理由和迁移方法。
- **关闭 Issue**: 如果当前 commit 针对某个 issue，可以在 Footer 部分关闭这个 issue，例如 `Closes #123`。

---

## 示例

### feat
```
feat(server): 增加 QQ 音乐搜索接口
```

### fix
```
fix(ui): 修复播放列表滚动条显示异常
```

### BREAKING CHANGE
```
feat(api): 重构 API 认证流程

BREAKING CHANGE: `auth` 接口现在需要传递 `token` 参数。
```

## 强制执行 (可选)

建议安装 `commitlint` 和 `husky` 来强制执行上述规范：

1. 安装依赖：
   ```bash
   npm install --save-dev @commitlint/config-conventional @commitlint/cli husky
   ```

2. 启用 husky：
   ```bash
   npx husky install
   ```

3. 添加 commit-msg 钩子：
   ```bash
   npx husky add .husky/commit-msg 'npx --no-install commitlint --edit "$1"'
   ```
