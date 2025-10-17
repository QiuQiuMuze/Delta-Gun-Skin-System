# Delta Gun Skin System

使用 **React + Next.js + TypeScript + Tailwind CSS + React Query** 打造的前端界面，并搭配 **FastAPI + MongoDB** 的后端服务，为“三角洲抽砖”提供现代化的全栈体验。项目同时提供抽卡模拟、皮肤管理、玩家仓库等核心功能示例，方便二次开发扩展。

## 技术栈

- 前端：Next.js 14、React 18、Tailwind CSS、@tanstack/react-query、Axios
- 后端：FastAPI、Motor（MongoDB 驱动）、Pydantic v2、JWT 认证
- 数据库：MongoDB（默认连接 `mongodb://localhost:27017/delta_gun`）

## 功能概览

- 🔐 用户注册、登录、获取个人信息，支持 JWT 鉴权。
- 🎮 抽卡模拟：根据稀有度权重在 MongoDB 中的皮肤池抽取，并同步更新玩家仓库与钥匙数量。
- 📦 仓库浏览：玩家可查看自己的抽卡记录，管理员可查看任意玩家仓库。
- 🧰 皮肤管理：管理员可通过 API 新增、更新、删除皮肤。

## 快速开始

### 1. 启动后端（FastAPI）

```bash
bash run.sh
```

> 脚本会创建虚拟环境并安装 `backend/requirements.txt` 中的依赖，然后以开发模式启动 `uvicorn app.main:app`，默认监听 `http://localhost:8000`。

### 2. 启动前端（Next.js）

```bash
cd frontend
npm install
npm run dev
```

前端开发服务器默认运行在 `http://localhost:3000`，并通过 `NEXT_PUBLIC_API_BASE_URL` 环境变量访问后端 API（默认为 `http://localhost:8000/api`）。

## 环境变量

后端配置均可通过环境变量覆盖（详见 `backend/app/config.py`）：

- `DELTA_MONGO_URL`：MongoDB 连接字符串，默认为 `mongodb://localhost:27017`
- `DELTA_MONGO_DB`：数据库名称，默认为 `delta_gun`
- `DELTA_JWT_SECRET`：JWT 密钥
- `DELTA_JWT_ALGORITHM`：JWT 加密算法，默认为 `HS256`
- `DELTA_JWT_EXPIRE_MINUTES`：令牌有效时间，默认 1440 分钟（24 小时）

前端可通过 `.env.local` 设置：

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api
```

## 常用 API

| 方法 | 路径 | 说明 |
| ---- | ---- | ---- |
| `POST` | `/api/users` | 注册新玩家 |
| `POST` | `/api/auth/token` | 账号登录，返回 JWT |
| `GET` | `/api/auth/me` | 获取当前用户信息 |
| `GET` | `/api/skins` | 列出全部皮肤 |
| `POST` | `/api/skins` | 新增皮肤（需管理员）|
| `POST` | `/api/gacha/draw` | 抽卡，消耗钥匙并返回结果 |

详细数据模型可参考 `backend/app/schemas.py`。

## 目录结构

```
backend/
  app/
    main.py            # FastAPI 入口
    config.py          # 环境配置
    db.py              # Mongo 连接管理
    routes/            # API 路由（auth、users、skins、gacha）
    schemas.py         # Pydantic 模型
    services/          # 业务逻辑（抽卡权重）
frontend/
  app/                 # Next.js App Router 页面
  components/          # UI 组件
  lib/                 # React Query Provider 与 API 封装
```

## 开发建议

- 首次运行前请确保已安装 MongoDB，并且服务运行在 `DELTA_MONGO_URL` 指定的地址。
- 抽卡依赖皮肤池数据，可通过管理员身份调用 `/api/skins` 相关接口进行维护。
- 若需部署生产环境，请为 JWT 设置强随机密钥，并在前后端设置正确的跨域与 HTTPS 配置。
