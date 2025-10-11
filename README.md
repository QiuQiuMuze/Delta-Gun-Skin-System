模拟三角洲的枪皮抽卡系统

## 快速注册模式切换指南

后端通过 `feature_flags` 表中的 `quick_register_enabled` 标志位在“普通注册模式”和“快速注册模式”之间切换。默认情况下该标志为 `0`（普通模式）。您可以使用以下两种方式切换模式：

### 方式一：调用后端接口（推荐）
1. 使用管理员账号完成登录，获取 `/auth/login/verify` 返回的 JWT。普通账号需要先在注册时勾选“申请管理员”并通过 `/auth/admin-verify` 验证才能成为管理员。
2. 发送 `GET /public/quick-register`（无需鉴权）可查看当前是否启用快速注册，返回 `{ "enabled": true|false }`。
3. 发送 `POST /admin/quick-register`，在 `Authorization: Bearer <JWT>` 请求头中携带管理员令牌，并在请求体提供：
   ```json
   { "enabled": true }
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
