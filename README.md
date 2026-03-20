# Echo Music

Echo Music 是一个多人实时同步听歌房间应用，前端基于 React + Vite，后端基于 Express + Socket.IO，并集成 QQ 音乐相关能力。

## 功能概览

- 多人房间与实时状态同步
- 点歌队列、自动播放下一首
- QQ 音乐搜索、歌单、电台、歌词、播放链接
- 房主 Cookie 绑定与房间级鉴权
- `qq-music-api` 子项目独立维护、独立测试

## 项目结构

```text
echo-music/
├─ server/                     # 主服务端代码
│  ├─ routes/                  # HTTP 路由
│  ├─ services/                # 业务服务
│  └─ socket/                  # Socket 事件处理
├─ packages/
│  └─ qq-music-api/            # 独立 workspace 子项目，负责 QQ 音乐 API 适配
├─ src/                        # 前端代码
├─ scripts/                    # 项目级脚本
├─ Dockerfile
└─ package.json
```

## Workspace 说明

仓库采用 workspace 方式管理：

- 根项目 `echo-music` 负责前端、主服务端和整体运行脚本
- 子项目 [packages/qq-music-api](/D:/dev/echo-music/packages/qq-music-api) 负责 QQ 音乐 API 封装、测试和构建
- 根项目通过本地 workspace 依赖使用 `qq-music-api`

## 本地开发

### 环境要求

- Node.js 20+
- npm 10+

### 安装依赖

```bash
npm install
```

### 启动开发环境

```bash
npm run dev
```

默认访问地址：

- `http://localhost:3000`

## Docker 一键部署

推荐直接使用预构建镜像：

```bash
docker pull ghcr.io/veegn/echo-music:latest
docker run -d \
  --name echo-music \
  -p 3000:3000 \
  -v echo-music-data:/app/server/storage \
  ghcr.io/veegn/echo-music:latest
```

启动后访问：

- `http://localhost:3000`

### Docker Compose 示例

```yaml
services:
  echo-music:
    image: ghcr.io/veegn/echo-music:latest
    container_name: echo-music
    ports:
      - "3000:3000"
    volumes:
      - echo-music-data:/app/server/storage
    restart: unless-stopped

volumes:
  echo-music-data:
```

### 持久化说明

房间信息默认写入容器内的 `/app/server/storage`。  
如果需要保留房间和 Cookie 元数据，请挂载该目录。

## 常用命令

### 根项目

```bash
npm run dev
npm run build
npm run lint
npm run lint:all
npm run test
npm run test:qqmusic-api
npm run test:qqmusic-api:replay
npm run test:integration
npm run test:integration:qqmusic
npm run test:integration:qqmusic:real
npm run record:qqmusic-api:fixtures
```

### `packages/qq-music-api`

```bash
cd packages/qq-music-api
npm run lint
npm run test
npm run test:unit
npm run test:integration
npm run test:replay
npm run record:fixtures
```

## 测试说明

项目当前测试分为三层：

- 单元测试：参数校验、路由映射、响应归一化
- 录制回放测试：优先覆盖公开 QQ 音乐接口，避免测试直接依赖实时外网
- 真实 Cookie 冒烟测试：覆盖需要登录态的业务接口

真实 Cookie 冒烟依赖以下环境变量：

- `QQMUSIC_REAL_COOKIE`
- `QQMUSIC_REAL_UIN`

录制回放测试使用的夹具位于：

- [packages/qq-music-api/tests/cassettes](/D:/dev/echo-music/packages/qq-music-api/tests/cassettes)

## 子项目边界

[packages/qq-music-api](/D:/dev/echo-music/packages/qq-music-api) 的职责：

- 提供统一的 `QQMusicApi.api(...)` 调用入口
- 维护 `musicu.fcg`、歌手、歌单、搜索、排行榜、电台等适配逻辑
- 管理自身的测试、TypeScript 配置和录制回放夹具

主项目应通过包入口或服务层调用它，不建议把主业务逻辑继续直接塞进该目录。
