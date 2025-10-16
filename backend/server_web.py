# backend/server_web.py
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.middleware.gzip import GZipMiddleware
from starlette.responses import RedirectResponse
import os, sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

# 引入你原有的后端 app（保持不变）
from server import app as api_app

app = FastAPI(title="Delta Brick Web", version="1.0")
app.add_middleware(GZipMiddleware, minimum_size=1024)

FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), "frontend", "static")
os.makedirs(FRONTEND_DIR, exist_ok=True)


class SPAStaticFiles(StaticFiles):
    """StaticFiles 派生版：未知路径回退到 index.html，支持直接访问 /web/foo。"""

    async def get_response(self, path: str, scope):  # type: ignore[override]
        try:
            response = await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code != 404 or not scope["path"].startswith("/web"):
                raise
            return self._spa_fallback(scope)

        if response.status_code != 404 or not scope["path"].startswith("/web"):
            return response
        return self._spa_fallback(scope)

    def _spa_fallback(self, scope):
        index_path, stat_result = self.lookup_path("index.html")
        if stat_result is None:
            raise StarletteHTTPException(status_code=404)
        return FileResponse(index_path, stat_result=stat_result, method=scope["method"])


# ① 先挂静态前端到 /web（一定要在 "/" 之前），并让未知路径回退到 index
app.mount("/web", SPAStaticFiles(directory=FRONTEND_DIR, html=True), name="web")

# ② 根路径重定向到 /web/
@app.middleware("http")
async def _root_redirect(request: Request, call_next):
    if request.url.path in ("", "/"):
        return RedirectResponse(url="/web/", status_code=307)
    return await call_next(request)

# ③ 最后把 API 挂到 "/"（路径保持不变）
app.mount("/", api_app)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server_web:app", host="0.0.0.0", port=8000, reload=True)
