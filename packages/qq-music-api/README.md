# qq-music-api

`qq-music-api` 是 `echo-music` 仓库中的独立 workspace 子项目，负责 QQ 音乐相关接口的适配、聚合和测试。

## 职责边界

这个子项目负责：

- 路由级调用入口：[`index.ts`](D:/dev/echo-music/packages/qq-music-api/index.ts)
- controller 层参数归一化与响应整形：[`routers/context`](D:/dev/echo-music/packages/qq-music-api/routers/context)
- 上游 QQ 音乐请求封装：[`module/apis`](D:/dev/echo-music/packages/qq-music-api/module/apis)
- 工具与响应封装：[`util`](D:/dev/echo-music/packages/qq-music-api/util)
- 单元测试与集成测试：[`tests`](D:/dev/echo-music/packages/qq-music-api/tests)

这个子项目不负责：

- 房间、聊天、Socket 广播等主项目业务
- 主项目页面状态管理
- 主项目服务端鉴权与房间持久化

## 目录建议

```text
packages/qq-music-api/
├─ index.ts                  # 子项目统一入口
├─ module/
│  └─ apis/                  # QQ 音乐上游接口封装
├─ routers/
│  └─ context/               # controller 与路由处理
├─ util/                     # 通用工具
├─ types/                    # 类型定义
└─ tests/                    # unit / integration tests
```

## 开发命令

```bash
npm run lint
npm run test
npm run test:unit
npm run test:integration
```

## 维护约定

- 新增 QQ 音乐能力时，优先放在 `module/apis`，再由 `routers/context` 暴露
- 主项目调用应尽量经过 `QQMusicApi.api(...)` 或明确的包导出，而不是跨目录直接引用内部文件
- 测试优先覆盖参数归一化、cookie 透传、错误响应格式和返回结构整形
