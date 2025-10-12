模拟三角洲的枪皮抽卡系统

## 快速注册模式切换指南

后端通过 `feature_flags` 表中的 `quick_register_enabled` 标志位在“普通注册模式”和“快速注册模式”之间切换。默认情况下该标志为 `0`（普通模式）。您可以使用以下两种方式切换模式：

### 方式一：调用后端接口（推荐）
1. 使用管理员账号完成登录，获取 `/auth/login/verify` 返回的 JWT。普通账号需要先在注册时勾选“申请管理员”并通过 `/auth/admin-verify` 验证才能成为管理员。
   ```bash
   # 第一步：提交用户名、密码（举例）
   curl -X POST http://localhost:8000/auth/login/start \
     -H 'Content-Type: application/json' \
     -d '{"username":"admin","password":"Passw0rd!"}'

   # 第二步：输入短信验证码换取 JWT（123456 仅示例）
   curl -X POST http://localhost:8000/auth/login/verify \
     -H 'Content-Type: application/json' \
     -d '{"username":"admin","code":"123456"}'
   ```
   服务器会返回一个 `token` 字段，即管理员 JWT。
2. 发送 `GET /public/quick-register`（无需鉴权）可查看当前是否启用快速注册，返回 `{ "enabled": true|false }`。例如：
   ```bash
   curl http://localhost:8000/public/quick-register
   ```
3. 发送 `POST /admin/quick-register`，在 `Authorization: Bearer <JWT>` 请求头中携带管理员令牌，并在请求体提供：
   ```bash
   curl -X POST http://localhost:8000/admin/quick-register \
     -H 'Authorization: Bearer <JWT>' \
     -H 'Content-Type: application/json' \
     -d '{"enabled": false}'
   ```
   * `true` 表示打开快速注册模式；
   * `false`（或省略）表示恢复到普通注册模式。
4. 切换后，新的注册请求即可按照最新模式执行。快速模式下：
   * 后端会忽略手机号与验证码校验；
   * 自动为用户名追加 "★" 后缀；
   * 立即登录并下发 JWT；
   * 赠送 20000 法币。

### 方式二：直接操作 SQLite 数据库
如果无法通过接口调用，也可以直接修改数据库文件 `backend/delta_brick.db`：
```bash
sqlite3 backend/delta_brick.db "INSERT OR REPLACE INTO feature_flags(key, value) VALUES('quick_register_enabled', '1');"
```
将 `'1'` 替换为 `'0'` 即可关闭快速注册模式。修改完成后无需重启服务，后端会在下一次请求时读取最新值。

> 提示：若数据库中尚未存在 `feature_flags` 表或 `quick_register_enabled` 记录，首次调用切换接口或执行上述 SQL 会自动创建对应记录。

## 验证新的登录/注册校验逻辑的操作步骤

如果你已经修改了登录或注册的校验逻辑，并希望确认它确实生效，可以按照以下顺序操作：

1. **确认快速注册当前是否开启。** 在浏览器刷新登录页，观察手机号、验证码输入框是否被隐藏；或在终端执行 `curl http://localhost:8000/public/quick-register` 查看 `enabled` 字段。
2. **如已开启，请先关闭快速注册。** 使用上文介绍的接口或数据库方式，将 `quick_register_enabled` 设为 `0`。关闭后重新刷新前端页面，确保手机号/验证码输入框重新出现。
3. **清除旧的本地状态。** 如果你之前已经在快速模式下注册过账号，请在浏览器里退出登录（或清理 `sessionStorage` 中的 `token`），以免后续请求仍携带旧会话。
4. **按常规流程重新注册/登录。**
   * 注册时需要依次完成“发送注册验证码 → 输入验证码 → 提交注册”三步，后端会走普通分支代码，并触发你新增的校验逻辑。【F:frontend/static/components/auth.js†L120-L159】【F:backend/server.py†L654-L699】
   * 登录时依旧是两步验证码流程，若你调整了 `/auth/login/start` 或 `/auth/login/verify` 的逻辑，这一步就会体现出来。
5. **验证失败提示。** 如果校验不通过，后端会返回 `4xx` 错误，前端会弹出具体的提示信息；此时说明你的校验已经生效。如果成功通过，则可以继续后续流程（例如成为管理员、进入抽卡页面等）。

完成上述步骤后，所有与手机号、验证码、密码强度等相关的自定义校验都会被执行；若仍未生效，请再确认数据库中的 `quick_register_enabled` 值是否保持为 `0`，或查看服务器日志定位问题。

## 为什么我的前端界面还是旧版？

浏览器会缓存 `frontend/static` 目录下的 JS/CSS。如果你部署过旧版本的前端，单纯刷新可能仍会读取缓存文件，从而看不到最新的 UI。

* 本仓库的 `index.html` 现已为所有静态资源增加查询参数（例如 `auth.js?v=20240507`）。请确认你在浏览器里访问的是最新的 `index.html` 文件；只要 HTML 文件被重新加载，浏览器就会因为查询参数不同而重新请求最新脚本。
* 如果你怀疑浏览器仍使用旧缓存，可以在浏览器开发者工具中勾选“Disable cache”，或执行一次强制刷新（Windows 上 `Ctrl+F5`，macOS 上 `Command+Shift+R`）。
* 若你有额外的反向代理/OSS/CDN，也需要清理这些层级的缓存，确保最新静态文件能够被下发。

## 遇到 `AttributeError: module 'bcrypt' has no attribute '__about__'`？

`passlib[bcrypt]==1.7.4` 与最新版 `bcrypt` 4.x 不兼容，会触发上述异常。`backend/requirements.txt` 已经锁定了兼容的 `bcrypt>=3.2,<4`。请重新安装后端依赖：

```bash
cd backend
pip install -r requirements.txt
```

若你使用的是虚拟环境，请在激活虚拟环境后再执行安装。完成后重启后端服务即可。

## 为什么修改登录/注册校验后看不到效果？

登录与注册流程会根据“快速注册”开关走不同的代码路径：

* **前端** 会在加载登录页时调用 `/public/quick-register`，如果后端返回 `enabled: true`，就会把 `AuthPage._quickMode` 设为 `true` 并隐藏手机号、验证码等输入框，此时点击“注册”只会提交用户名和密码。【F:frontend/static/components/auth.js†L53-L111】
* **后端** 的 `/auth/register` 在检测到快速模式被启用且请求体中的 `quick_mode` 为 `true` 时，会直接跳转到 `快速注册` 分支，忽略你在常规分支里新增的手机号/验证码校验逻辑，并立即创建账号。【F:backend/server.py†L628-L667】

因此，如果快速注册模式是开启状态，你在普通注册流程里增加或调整的校验不会触发，看起来就像“没有任何变化”。要验证你的修改，请先通过管理员接口或直接操作数据库把 `quick_register_enabled` 设为 `0`，确保当前处于普通注册模式，再重新尝试登录/注册流程。
