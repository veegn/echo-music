# 使用 Node.js 20 官方 Alpine 镜像作为基础镜像 (非常精简)
FROM node:20-alpine AS builder

WORKDIR /app

# 安装构建依赖（如果需要编译部分原生模块）
# RUN apk add --no-cache python3 make g++

# 复制依赖配置
COPY package*.json ./

# 安装所有依赖 (包括 devDependencies 需要用于 vite build)
RUN npm install

# 复制源代码
COPY . .

# 执行 Vite 构建生成静态资源 (输出到 dist/)
RUN npm run build

# --- 运行阶段 ---
FROM node:20-alpine

WORKDIR /app

# 设置生产环境环境变量
ENV NODE_ENV=production

# 复制 package.json 用于运行脚本
COPY --from=builder /app/package*.json ./

# 仅安装生产环境依赖
RUN npm install --omit=dev

# 复制文件
COPY --from=builder /app/server ./server
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# 暴露端口 (默认 3000)
EXPOSE 3000

# 记录数据持久化目录
VOLUME ["/app/server/storage"]

# 启动命令
CMD ["npm", "run", "start"]
