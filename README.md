# Echo Music - 多人实时同步听歌房

<p align="center">
  <img src="https://img.shields.io/badge/Echo%20Music-v3.0.0-emerald?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react" alt="React">
  <img src="https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite" alt="Vite">
  <img src="https://img.shields.io/badge/Tailwind-4-38B2AC?style=for-the-badge&logo=tailwind-css" alt="Tailwind">
</p>

## 🌟 项目简介

`Echo Music` 是一个极致简约、质感考究的实时多人在线音乐播放室。它不仅让音乐得以共享，更让听众在同一个节拍下产生共鸣。

基于 **React 19**、**Vite 7** 和 **Express** 构建，通过 **Socket.io** 实现毫米级的播放同步。无论相隔多远，只要进入同一个房间，你们听到的节奏就是完全一致的。

## ✨ 核心特性

- 🎵 **极致同步**：利用 WebSocket 技术，实现多端播放进度、状态（播放/暂停/切歌）的强实时同步。
- 🎨 **高级美学**：沉浸式毛玻璃（Glassmorphism）视觉设计，配合动感的背景光晕与流畅的 Framer Motion 动画。
- 📂 **智能队列**：支持点播、切歌、队列重排，更有房主专享的“猜你喜欢”电台自动填充，让音乐永不停歇。
- 💬 **互动社交**：内置实时聊天气泡、用户加入/离开动态提醒。
- 🔑 **VIP 互助**：房主连接 QQ 音乐 VIP Cookie 后，全房间用户即可共享播放 VIP 音乐及无损音质。
- 🐳 **云端部署**：提供精简化的 Dockerfile 支持，配合 GitHub Actions 实现全自动 CI/CD 构建与推送。

## 🛠️ 技术架构

### 前端 (Frontend)
- **React 19**：使用最新的 React 特性，渲染性能更强。
- **Zustand**：极简的状态管理方案。
- **Tailwind CSS 4**：下一代 CSS 框架，支持更强大的样式定义。
- **Framer Motion**：丝滑的交互与入场动画。
- **Lucide React**：清爽的图标系统。

### 后端 (Backend)
- **Node.js + Express**：轻量高效的后端处理。
- **Socket.io**：提供稳定的全双工通信环境。
- **qq-music-api**：深度集成的 QQ 音乐数据支持。
- **TSX**：直接运行 TypeScript 代码，开发体验极佳。

## 📁 项目结构

```text
echo-music/
├── server/                 # 后端逻辑层
│   ├── services/           # 业务逻辑 (房间管理、QQ音乐通讯)
│   ├── routes/             # API 路由
│   ├── socket/             # WebSocket 事件处理
│   └── index.ts            # 入口文件
├── src/                    # 前端源代码
│   ├── components/         # 模块化组件 (MusicPanel, ChatBox, Dialogs 等)
│   ├── store.ts            # 全局状态 (Zustand)
│   ├── App.tsx             # 应用主入口
│   └── index.css           # 设计系统与全局样式
├── .github/workflows/      # GitHub Actions 自动化脚本
└── Dockerfile              # 容器化构建配置
```

## 🚀 快速开始

### 1. 本地开发
```bash
# 安装依赖
npm install

# 启动开发服务器 (自动运行后端及 Vite 预览)
npm run dev
```

### 2. 生产环境部署
你可以使用 Docker 以最精简的方式部署：
```bash
# 构建镜像
docker build -t echo-music .

# 运行镜像
docker run -d -p 3000:3000 -v ./storage:/app/server/storage echo-music
```

## 🔑 获取 Cookie 说明

为了开启 VIP 音乐支持与电台推荐功能：
1. 在浏览器登录 [QQ 音乐网页版](https://y.qq.com/)。
2. `F12` 打开控制台 -> `Network`。
3. 刷新页面，找到任意请求，在 `Request Headers` 中复制完整的 `cookie` 字符串。
4. 在 Echo Music 房间内，房主点击“连接 VIP”并粘贴即可。

## 📄 开源协议
本项目采用 MIT 协议。
