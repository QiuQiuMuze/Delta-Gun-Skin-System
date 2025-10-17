# 三角洲砖皮系统

基于 **FastAPI + MongoDB** 的后端与 **Next.js + React Query + Tailwind CSS** 的前端，提供三角洲抽砖赛季与皮肤资料的现代化展示。

## 技术栈

- **前端**：React、Next.js 14、TypeScript、Tailwind CSS、@tanstack/react-query
- **后端**：FastAPI、Motor (MongoDB 驱动)、Pydantic v2、Uvicorn
- **数据库**：MongoDB（默认连接 `mongodb://localhost:27017`）

## 本地运行

### 后端

```bash
# 启动 FastAPI 后端
./run.sh
```

脚本会创建虚拟环境并安装依赖，随后以 `uvicorn app.main:app --reload` 方式启动服务，默认端口为 `8000`。如需修改 MongoDB 地址，可在根目录创建 `.env` 文件并设置：

```
DELTA_MONGODB_URI=mongodb://localhost:27017
DELTA_MONGODB_DB_NAME=delta_gun_skin
DELTA_ALLOWED_ORIGINS=["http://localhost:3000"]
```

依赖中已锁定 `motor==3.3.1` 与 `pymongo==4.3.3`，避免了 `_QUERY_OPTIONS` 导入错误。

### 前端

```bash
cd frontend
npm install
npm run dev
```

默认向 `http://localhost:8000/api` 请求赛季数据，可通过设置 `NEXT_PUBLIC_API_BASE_URL` 指向不同的后端地址。

## 项目结构

```
backend/      # FastAPI 应用（app.main、Mongo 数据访问、赛季路由）
frontend/     # Next.js 14 前端（App Router + Tailwind + React Query）
run.sh        # 便捷脚本：创建虚拟环境并启动后端
```

欢迎根据需要扩展赛季数据、鉴权或运营后台等高级功能。
