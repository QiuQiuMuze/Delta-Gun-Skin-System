# server.py — FastAPI + SQLite + SQLAlchemy + JWT + 手机验证码 + 合成 + 交易行
# 本版在你现有基础上“只增加不删减”：
# A) 账户体系：支持“申请管理员”+ 管理员验证码校验；/me 返回 is_admin
# B) 钱包：法币充值改为两段式（/wallet/topup/request + /wallet/topup/confirm）；兑换固定 1:10（保留原路由路径）
# C) 管理员：搜索用户 / 发放法币（JWT 鉴权，仅 is_admin=1 可用）
# D) 兼容性：保留你原有全部接口；新增逻辑以 Router 追加，不覆盖既有路由
# E) 重要修正：扩展段的 JWT 解析按 sub=用户名（与你原 token 一致），避免 401
from __future__ import annotations
from fastapi import FastAPI, Depends, HTTPException, Header, Query, Path
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, Literal, List
from datetime import datetime, timedelta
import time, os, secrets, jwt, re

from passlib.context import CryptContext
from sqlalchemy import (
    create_engine, Column, Integer, String, Boolean, Float,
    ForeignKey
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session
import sqlite3

# ------------------ Config ------------------
DB_PATH_FS = os.path.join(os.path.dirname(__file__), "delta_brick.db")
DB_URL = os.environ.get("DELTA_DB", "sqlite:///./delta_brick.db")
JWT_SECRET = os.environ.get("DELTA_JWT_SECRET", "dev-secret-change-me")
ADMIN_KEY = os.environ.get("DELTA_ADMIN_KEY", "dev-admin-key")
OTP_EXPIRE_SEC = 300  # 5 分钟
OTP_FILE = "sms_codes.txt"

engine = create_engine(DB_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
Base = declarative_base()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
http_bearer = HTTPBearer()

# ------------------ ORM ------------------
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    phone = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    fiat = Column(Integer, default=0)
    coins = Column(Integer, default=0)
    keys = Column(Integer, default=0)
    unopened_bricks = Column(Integer, default=0)
    pity_brick = Column(Integer, default=0)
    pity_purple = Column(Integer, default=0)
    is_admin = Column(Boolean, default=False)
    # ★ 新增：会话版本，用于单点登录
    session_ver = Column(Integer, default=0)

class Skin(Base):
    __tablename__ = "skins"
    id = Column(Integer, primary_key=True)
    skin_id = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    rarity = Column(String, nullable=False)  # BRICK/PURPLE/BLUE/GREEN
    active = Column(Boolean, default=True)

class Inventory(Base):
    __tablename__ = "inventory"
    id = Column(Integer, primary_key=True)  # inv_id
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    skin_id = Column(String, ForeignKey("skins.skin_id"))
    name = Column(String)
    rarity = Column(String)       # BRICK/PURPLE/BLUE/GREEN
    exquisite = Column(Boolean)   # 仅 BRICK 有意义；其余恒为 False
    wear_bp = Column(Integer)     # 0..500 (0~5.00)
    grade = Column(String)        # S/A/B/C
    serial = Column(String)       # 全局 8 位编号 = id 格式化
    acquired_at = Column(Integer) # 时间戳
    on_market = Column(Boolean, default=False)

class PoolConfig(Base):
    __tablename__ = "pool_config"
    id = Column(Integer, primary_key=True)
    pool_id = Column(String, default="default", unique=True)
    brick_price = Column(Integer, default=100)
    key_price = Column(Integer, default=60)
    p_brick_base = Column(Float, default=0.3)
    p_purple_base = Column(Float, default=2.7)
    p_blue_base = Column(Float, default=20.0)
    p_green_base = Column(Float, default=77.0)
    brick_pity_max = Column(Integer, default=75)
    brick_ramp_start = Column(Integer, default=65)
    purple_pity_max = Column(Integer, default=20)
    compression_alpha = Column(Float, default=0.5)

class SmsCode(Base):
    __tablename__ = "sms_code"
    id = Column(Integer, primary_key=True)
    phone = Column(String, index=True)
    purpose = Column(String)  # login|reset|login2
    code_hash = Column(String)
    expire_ts = Column(Integer)

class MarketItem(Base):
    __tablename__ = "market"
    id = Column(Integer, primary_key=True, index=True)
    inv_id = Column(Integer, ForeignKey("inventory.id"), unique=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    price = Column(Integer)      # 三角币价格
    created_at = Column(Integer, default=lambda: int(time.time()))
    active = Column(Boolean, default=True)

def _ensure_user_sessionver():
    con = sqlite3.connect(DB_PATH_FS)
    cur = con.cursor()
    cur.execute("PRAGMA table_info(users)")
    cols = [row[1] for row in cur.fetchall()]
    if "session_ver" not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN session_ver INTEGER NOT NULL DEFAULT 0")
        con.commit()
    con.close()

Base.metadata.create_all(engine)
_ensure_user_sessionver()

# ------------------ Pydantic ------------------
RarityT = Literal["BRICK", "PURPLE", "BLUE", "GREEN"]

class RegisterIn(BaseModel):
    username: str
    phone: str
    password: str
    reg_code: str  # ★ 新增：注册短信验证码
    # 新增：是否申请管理员（默认否，保持兼容）
    want_admin: bool = False

class LoginStartIn(BaseModel):
    username: str
    password: str

class LoginVerifyIn(BaseModel):
    username: str
    code: str

class SendCodeIn(BaseModel):
    phone: str
    purpose: Literal["login", "reset", "register"]   # ★ 新增 register


class ResetPwdIn(BaseModel):
    phone: str
    code: str
    new_password: str

class WalletOp(BaseModel):
    amount_fiat: int
    coin_rate: int = 10  # 保留字段以兼容旧前端；实际按固定 1:10 处理

class CountIn(BaseModel):
    count: int = 1

class PoolConfigIn(BaseModel):
    brick_price: int = 100
    key_price: int = 60
    p_brick_base: float = 0.3
    p_purple_base: float = 2.7
    p_blue_base: float = 20.0
    p_green_base: float = 77.0
    brick_pity_max: int = 75
    brick_ramp_start: int = 65
    purple_pity_max: int = 20
    compression_alpha: float = 0.5

class SkinIn(BaseModel):
    skin_id: str
    name: str
    rarity: RarityT
    active: bool = True

class ComposeIn(BaseModel):
    from_rarity: Literal["GREEN", "BLUE", "PURPLE"]
    inv_ids: List[int]  # 20 个 inv_id

class MarketListIn(BaseModel):
    inv_id: int
    price: int

class MarketBrowseOut(BaseModel):
    id: int
    inv_id: int
    seller: str
    price: int
    name: str
    skin_id: str
    rarity: str
    exquisite: bool
    grade: str
    wear: float
    serial: str
    created_at: int

# ------------------ App & Utils ------------------
app = FastAPI(title="三角洲砖皮模拟器 (SQLite+JWT+手机验证码+合成+交易行)")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def hash_pw(p: str) -> str:
    return pwd_context.hash(p)

def verify_pw(p: str, h: str) -> bool:
    return pwd_context.verify(p, h)

def mk_jwt(username: str, session_ver: int, exp_min: int = 60*24) -> str:
    payload = {"sub": username, "sv": int(session_ver), "exp": datetime.utcnow() + timedelta(minutes=exp_min)}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

# ---- OTP 发送频率限制（同一 purpose+tag 60 秒一次）----
import sqlite3 as _sqlite3

def _sms_rate_guard(purpose: str, tag: str, min_interval: int = 60):
    """
    purpose: 验证码用途；tag: 手机号或用户名（视用途而定）
    若 60s 内同一 (purpose, tag) 已发送过，则抛出 429。
    """
    db_path = DB_PATH_FS  # 复用现有数据库
    con = _sqlite3.connect(db_path)
    cur = con.cursor()
    cur.execute("""CREATE TABLE IF NOT EXISTS sms_rate(
        purpose TEXT NOT NULL,
        tag     TEXT NOT NULL,
        last_ts INTEGER NOT NULL,
        PRIMARY KEY (purpose, tag)
    )""")
    now = int(time.time())
    cur.execute("SELECT last_ts FROM sms_rate WHERE purpose=? AND tag=?", (purpose, tag))
    row = cur.fetchone()
    if row:
        last_ts = int(row[0])
        remain = min_interval - (now - last_ts)
        if remain > 0:
            con.close()
            raise HTTPException(status_code=429, detail=f"发送过于频繁，请 {remain} 秒后再试")
    # 允许发送：更新最后发送时间
    cur.execute("REPLACE INTO sms_rate(purpose, tag, last_ts) VALUES (?,?,?)", (purpose, tag, now))
    con.commit(); con.close()


def user_from_token(creds: HTTPAuthorizationCredentials = Depends(http_bearer),
                    db: Session = Depends(get_db)) -> User:
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
        username = payload.get("sub")
        token_sv = int(payload.get("sv", -1))
    except Exception:
        raise HTTPException(401, "令牌无效，请重新登录")
    user = db.query(User).filter_by(username=username).first()
    if not user:
        raise HTTPException(401, "用户不存在")
    # ★ 关键：单点登录校验
    if int(user.session_ver or 0) != token_sv:
        raise HTTPException(status_code=401, detail="SESSION_REVOKED")
    return user


# ---- Password/Phone checks ----
SPECIAL_RE = re.compile(r"[^A-Za-z0-9]")
UPPER_RE = re.compile(r"[A-Z]")
LOWER_RE = re.compile(r"[a-z]")
DIGIT_SEQ_RE = re.compile(r"012345|123456|234567|345678|456789|987654|876543|765432|654321|543210")
PHONE_RE = re.compile(r"^1\d{10}$")  # 以1开头的11位纯数字

def check_password_complexity(p: str):
    if len(p) < 8:
        raise HTTPException(400, "密码过短：至少 8 位")
    if DIGIT_SEQ_RE.search(p):
        raise HTTPException(400, "密码过于简单：包含连续数字序列")
    if not UPPER_RE.search(p):
        raise HTTPException(400, "密码需要至少 1 个大写字母")
    if not SPECIAL_RE.search(p):
        raise HTTPException(400, "密码需要至少 1 个特殊符号（如 !@#￥% 等）")
    if not LOWER_RE.search(p):
        raise HTTPException(400, "密码需要至少 1 个小写字母")

# ---- OTP ----
def write_sms_line(phone: str, code: str, purpose: str):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(OTP_FILE, "a", encoding="utf-8") as f:
        f.write(f"phone={phone} purpose={purpose} code={code} ts={ts}\n")

def save_otp(db: Session, phone: str, purpose: str, code: str):
    """
    保存验证码前，先删除同手机号+同 purpose 的旧验证码，
    确保数据库里“当前有效验证码”只有一条。
    """
    # 先清掉旧的（无论是否过期）
    db.query(SmsCode).filter(
        SmsCode.phone == phone,
        SmsCode.purpose == purpose
    ).delete(synchronize_session=False)

    # 新验证码入库
    h = hash_pw(code)
    expire_ts = int(time.time()) + OTP_EXPIRE_SEC
    db.add(SmsCode(phone=phone, purpose=purpose, code_hash=h, expire_ts=expire_ts))
    db.commit()


def verify_otp(db: Session, phone: str, purpose: str, code: str) -> bool:
    now = int(time.time())
    rows = db.query(SmsCode).filter(
        SmsCode.phone==phone, SmsCode.purpose==purpose, SmsCode.expire_ts>=now
    ).all()
    for r in rows:
        if verify_pw(code, r.code_hash):
            # ★ 命中即视为“已使用”，删除该条记录（可选：同 purpose 其他旧记录也可删）
            db.delete(r)
            db.commit()
            return True
    return False


# ---- Seed ----
with SessionLocal() as _db:
    if not _db.query(PoolConfig).first():
        _db.add(PoolConfig())
    if _db.query(Skin).count() == 0:
        skins = []
        skins.append(Skin(skin_id="BRK_M7_PRISM2", name="M7战斗步枪-棱镜攻势2", rarity="BRICK"))
        skins += [
            Skin(skin_id="EPI_AUG_DESTINY",  name="AUG突击步枪-天命", rarity="PURPLE"),
            Skin(skin_id="EPI_P90_DESTINY",  name="P90冲锋枪-天命",   rarity="PURPLE"),
            Skin(skin_id="EPI_SR25_DESTINY", name="SR-25射手步枪-天命", rarity="PURPLE"),
        ]
        skins += [
            Skin(skin_id="RAR_PTR32_GRANITE", name="PTR-32突击步枪-花岗岩", rarity="BLUE"),
            Skin(skin_id="RAR_ASVAL_HORIZON", name="AS Val突击步枪-地平线", rarity="BLUE"),
            Skin(skin_id="RAR_SR3M_GRANITE",  name="SR-3M紧凑突击步枪-花岗岩", rarity="BLUE"),
            Skin(skin_id="RAR_QCQ171_HORIZON",name="QCQ171冲锋枪-地平线", rarity="BLUE"),
            Skin(skin_id="RAR_M1014_GRANITE", name="M1014散弹枪-花岗岩", rarity="BLUE"),
            Skin(skin_id="RAR_M870_HORIZON",  name="M870散弹枪-地平线", rarity="BLUE"),
        ]
        skins += [
            Skin(skin_id="UNC_ASVAL_BEAST",   name="AS Val突击步枪-猛兽", rarity="GREEN"),
            Skin(skin_id="UNC_AUG_BEAST",     name="AUG突击步枪-猛兽",  rarity="GREEN"),
            Skin(skin_id="UNC_M4A1_BEAST",    name="M4A1突击步枪-猛兽", rarity="GREEN"),
            Skin(skin_id="UNC_AK12_OLDIND",   name="AK-12突击步枪-旧工业", rarity="GREEN"),
            Skin(skin_id="UNC_SCARH_OLDIND",  name="SCAR-H突击步枪-旧工业", rarity="GREEN"),
            Skin(skin_id="UNC_WARRIORSMG_OLDIND", name="勇士冲锋枪-旧工业", rarity="GREEN"),
        ]
        for s in skins:
            _db.add(s)
    _db.commit()

# ---- RNG & Grades ----
def grade_from_wear_bp(wear_bp: int) -> str:
    # 0–0.40 S, 0.40–1.22 A, 1.22–2.50 B, 2.50–5.00 C  （wear_bp = 0..500）
    if wear_bp < 40:   return "S"
    if wear_bp < 122:  return "A"
    if wear_bp < 250:  return "B"
    return "C"

def wear_random_bp() -> int:
    return secrets.randbelow(501)

def rng_ppm() -> int: return secrets.randbelow(1_000_000)
def ppm(percent: float) -> int: return int(round(percent * 10_000))

from pydantic import BaseModel as _BM
class OddsOut(_BM):
    brick: float; purple: float; blue: float; green: float
    force_brick_next: bool; force_purple_next: bool
    pity_brick: int; pity_purple: int

def pick_skin(db: Session, rarity: str) -> Skin:
    rows = db.query(Skin).filter_by(rarity=rarity, active=True).all()
    if not rows: raise HTTPException(500, f"当前没有可用的 {rarity} 皮肤")
    return secrets.choice(rows)

def compute_odds(u: User, cfg: PoolConfig) -> OddsOut:
    n = u.pity_brick; m = u.pity_purple
    p_brick = cfg.p_brick_base; p_purple = cfg.p_purple_base
    p_blue = cfg.p_blue_base;   p_green = cfg.p_green_base
    # 65~75 抽动态提升砖皮 & 压缩其他
    if n >= cfg.brick_ramp_start and n < cfg.brick_pity_max:
        p_brick = p_brick + (100.0 - p_brick) * ((n - cfg.brick_ramp_start + 1) / (cfg.brick_pity_max - cfg.brick_ramp_start))
        step = min(cfg.brick_pity_max - 1, n) - cfg.brick_ramp_start
        if step > 0:
            frac = max(0.0, min(1.0, step / (cfg.brick_pity_max - cfg.brick_ramp_start)))
            c = 1.0 - cfg.compression_alpha * frac
            p_purple_c = p_purple * c; p_blue_c = p_blue * c; p_green_c = p_green * c
            delta = (p_purple + p_blue + p_green) - (p_purple_c + p_blue_c + p_green_c)
            p_brick = min(100.0, p_brick + delta)
            p_purple, p_blue, p_green = p_purple_c, p_blue_c, p_green_c
    total = p_brick + p_purple + p_blue + p_green
    if abs(total - 100.0) > 1e-9:
        scale = 100.0 / total
        p_brick *= scale; p_purple *= scale; p_blue *= scale; p_green *= scale
    force_brick = (n + 1) >= cfg.brick_pity_max
    force_purple = (m + 1) >= cfg.purple_pity_max
    return OddsOut(brick=round(p_brick,6), purple=round(p_purple,6),
                   blue=round(p_blue,6), green=round(p_green,6),
                   force_brick_next=force_brick, force_purple_next=force_purple,
                   pity_brick=n, pity_purple=m)

# ------------------ Auth ------------------
@app.post("/auth/register")
def register(data: RegisterIn, db: Session = Depends(get_db)):
    if db.query(User).filter_by(username=data.username).first():
        raise HTTPException(400, "用户名已存在，请更换用户名")

    # 手机号校验：以1开头11位
    if not PHONE_RE.fullmatch(data.phone):
        raise HTTPException(400, "手机号无效：必须以1开头且为11位纯数字")
    # 不能占用已绑定手机号
    if db.query(User).filter_by(phone=data.phone).first():
        raise HTTPException(400, "手机号已被绑定，请使用其他手机号")

    # 先做密码强度校验（失败不消耗验证码）
    check_password_complexity(data.password)

    # ★ 最后一步才校验并消耗“注册验证码”
    if not verify_otp(db, data.phone, "register", data.reg_code):
        raise HTTPException(401, "注册验证码错误或已过期")

    u = User(username=data.username, phone=data.phone, password_hash=hash_pw(data.password))
    db.add(u); db.commit()

    # 若申请管理员：下发管理员验证码（写入 admin_pending）
    try:
        if data.want_admin:
            put_admin_pending(data.username)
            return {"ok": True, "admin_verify_required": True, "msg": "已申请管理员，请查看 sms_codes.txt 并在登录页验证"}
    except NameError:
        pass

    return {"ok": True, "msg": "注册成功，请登录"}


@app.post("/auth/login/start")
def login_start(data: LoginStartIn, db: Session = Depends(get_db)):
    u = db.query(User).filter_by(username=data.username).first()
    if not u: raise HTTPException(401, "用户不存在")
    if not verify_pw(data.password, u.password_hash):
        raise HTTPException(401, "密码错误")
    # 60s 限流：同一手机号 login2
    _sms_rate_guard("login2", u.phone)
    code = f"{secrets.randbelow(1_000_000):06d}"
    write_sms_line(u.phone, code, "login2")
    save_otp(db, u.phone, "login2", code)
    return {"ok": True, "msg": "验证码已发送到绑定手机号（查看 sms_codes.txt）"}

@app.post("/auth/login/verify")
def login_verify(data: LoginVerifyIn, db: Session = Depends(get_db)):
    u = db.query(User).filter_by(username=data.username).first()
    if not u: raise HTTPException(401, "用户不存在")
    if not verify_otp(db, u.phone, "login2", data.code):
        raise HTTPException(401, "验证码错误或已过期")
    # ★ 每次登录成功都会话版本 +1
    u.session_ver = int(u.session_ver or 0) + 1
    db.commit()
    # ★ token 携带 sv
    token = mk_jwt(u.username, u.session_ver)
    return {"ok": True, "token": token, "msg": "登录成功"}


@app.post("/auth/send-code")
def send_code(inp: SendCodeIn, db: Session = Depends(get_db)):
    phone = inp.phone
    purpose = inp.purpose  # "login" | "reset" | "register"

    # 基本格式校验
    if not PHONE_RE.fullmatch(phone):
        raise HTTPException(400, "手机号格式不正确")

    # 分用途校验
    if purpose in ("login", "reset"):
        # 登录 / 重置密码：要求手机号已经绑定
        if not db.query(User).filter_by(phone=phone).first():
            raise HTTPException(404, "手机号尚未注册")
    elif purpose == "register":
        # 注册：要求手机号目前未被占用
        if db.query(User).filter_by(phone=phone).first():
            raise HTTPException(400, "该手机号已被占用")
    else:
        raise HTTPException(400, "不支持的验证码用途")
    # 60s 限流：同一手机号+用途
    _sms_rate_guard(purpose, phone)


    # 生成并写入
    code = f"{secrets.randbelow(1_000_000):06d}"
    write_sms_line(phone, code, purpose)
    save_otp(db, phone, purpose, code)
    return {"ok": True, "msg": "验证码已发送"}


@app.post("/auth/reset-password")
def reset_password(inp: ResetPwdIn, db: Session = Depends(get_db)):
    u = db.query(User).filter_by(phone=inp.phone).first()
    if not u: raise HTTPException(404, "手机号尚未注册")
    if not verify_otp(db, inp.phone, "reset", inp.code):
        raise HTTPException(401, "验证码错误或已过期")
    check_password_complexity(inp.new_password)
    u.password_hash = hash_pw(inp.new_password)
    db.commit()
    return {"ok": True, "msg": "密码已重置，请使用新密码登录"}

@app.get("/me")
def me(user: User = Depends(user_from_token)):
    return {
        "username": user.username, "phone": user.phone,
        "fiat": user.fiat, "coins": user.coins, "keys": user.keys,
        "unopened_bricks": user.unopened_bricks,
        "pity_brick": user.pity_brick, "pity_purple": user.pity_purple,
        "is_admin": bool(getattr(user, "is_admin", False)),
    }

# ------------------ Wallet / Shop ------------------
@app.post("/wallet/topup")
def topup(op: WalletOp, user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    if op.amount_fiat <= 0: raise HTTPException(400, "充值金额必须大于 0")
    user.fiat += op.amount_fiat
    db.commit(); return {"ok": True, "fiat": user.fiat}

@app.post("/wallet/exchange")
def exchange(op: WalletOp, user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    """
    固定套餐兑换：
      6  ->  60
      30 -> 320
      68 -> 750
      128-> 1480
      328-> 3950
      648-> 8100
    其余金额一律拒绝。
    """
    bundles = {6: 60, 30: 320, 68: 750, 128: 1480, 328: 3950, 648: 8100}
    amt = int(op.amount_fiat or 0)
    if amt not in bundles:
        raise HTTPException(400, "只允许固定档位兑换：6/30/68/128/328/648 法币")
    if user.fiat < amt:
        raise HTTPException(400, "法币余额不足")

    coins_gain = bundles[amt]
    user.fiat -= amt
    user.coins += coins_gain
    db.commit()
    return {
        "ok": True,
        "fiat": user.fiat,
        "coins": user.coins,
        "exchanged_fiat": amt,
        "gained_coins": coins_gain
    }


@app.post("/shop/buy-keys")
def buy_keys(inp: CountIn, user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    if inp.count <= 0: raise HTTPException(400, "数量必须大于 0")
    cfg = db.query(PoolConfig).first()
    cost = cfg.key_price * inp.count
    if user.coins < cost: raise HTTPException(400, "三角币不足")
    user.coins -= cost; user.keys += inp.count
    db.commit(); return {"ok": True, "coins": user.coins, "keys": user.keys}

@app.post("/shop/buy-bricks")
def buy_bricks(inp: CountIn, user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    if inp.count <= 0: raise HTTPException(400, "数量必须大于 0")
    cfg = db.query(PoolConfig).first()
    cost = cfg.brick_price * inp.count
    if user.coins < cost: raise HTTPException(400, "三角币不足")
    user.coins -= cost; user.unopened_bricks += inp.count
    db.commit(); return {"ok": True, "coins": user.coins, "unopened_bricks": user.unopened_bricks}

# ------------------ Gacha ------------------
@app.get("/odds")
def odds(user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    cfg = db.query(PoolConfig).first()
    od = compute_odds(user, cfg)
    return {
        "odds": od.dict(),
        "limits": {"brick_pity_max": cfg.brick_pity_max, "purple_pity_max": cfg.purple_pity_max}
    }

@app.post("/gacha/open")
def gacha_open(inp: CountIn, user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    if inp.count <= 0: raise HTTPException(400, "数量必须大于 0")
    if user.unopened_bricks < inp.count: raise HTTPException(400, "未开砖数量不足")
    if user.keys < inp.count: raise HTTPException(400, "钥匙不足")
    cfg = db.query(PoolConfig).first()
    user.unopened_bricks -= inp.count
    user.keys -= inp.count

    results = []

    for _ in range(inp.count):
        od = compute_odds(user, cfg)
        # 决定稀有度
        if od.force_brick_next:
            rarity = "BRICK"
        else:
            r = rng_ppm()
            if r < ppm(od.brick):
                rarity = "BRICK"
            else:
                r2 = rng_ppm()
                if r2 < ppm(od.purple) or od.force_purple_next:
                    rarity = "PURPLE"
                else:
                    r3 = rng_ppm()
                    rarity = "BLUE" if r3 < ppm(od.blue) else "GREEN"

        if rarity == "BRICK":
            user.pity_brick = 0; user.pity_purple += 1
        elif rarity == "PURPLE":
            user.pity_brick += 1; user.pity_purple = 0
        else:
            user.pity_brick += 1; user.pity_purple += 1

        skin = pick_skin(db, rarity)
        exquisite = (secrets.randbelow(100) < 15) if rarity == "BRICK" else False
        wear_bp = wear_random_bp()
        grade = grade_from_wear_bp(wear_bp)

        inv = Inventory(
            user_id=user.id, skin_id=skin.skin_id, name=skin.name, rarity=skin.rarity,
            exquisite=exquisite, wear_bp=wear_bp, grade=grade, serial="",
            acquired_at=int(time.time())
        )
        db.add(inv); db.flush()
        inv.serial = f"{inv.id:08d}"

        results.append({
            "inv_id": inv.id,
            "skin_id": skin.skin_id, "name": skin.name, "rarity": skin.rarity,
            "exquisite": exquisite, "wear": f"{wear_bp/100:.2f}", "grade": grade, "serial": inv.serial
        })

    db.commit()
    return {"ok": True, "results": results}

# ------------------ Inventory ------------------
# —— 背包平铺列表：默认隐藏已上架（on_market=True）的物品
@app.get("/inventory")
def inventory(
    rarity: Optional[RarityT] = None,
    show_on_market: bool = False,     # 新增：默认 False => 隐藏在交易行中的物品
    user: User = Depends(user_from_token),
    db: Session = Depends(get_db)
):
    q = db.query(Inventory).filter_by(user_id=user.id)
    if rarity:
        q = q.filter(Inventory.rarity == rarity)
    if not show_on_market:
        q = q.filter(Inventory.on_market == False)

    rows = q.order_by(Inventory.id.desc()).all()
    items = []
    for x in rows:
        items.append({
            "inv_id": x.id,
            "skin_id": x.skin_id, "name": x.name, "rarity": x.rarity,
            "exquisite": x.exquisite,
            "wear": f"{x.wear_bp/100:.2f}",
            "grade": x.grade,
            "serial": x.serial,
            "acquired_at": x.acquired_at,
            "on_market": x.on_market,               # 继续返回状态，前端可用来显示角标
            "status": "on_market" if x.on_market else "in_bag"
        })
    return {"count": len(items), "items": items}


# —— 背包按颜色分组：默认也隐藏已上架
@app.get("/inventory/by-color")
def inventory_by_color(
    show_on_market: bool = False,     # 新增参数，默认隐藏已上架
    user: User = Depends(user_from_token),
    db: Session = Depends(get_db)
):
    q = db.query(Inventory).filter_by(user_id=user.id)
    if not show_on_market:
        q = q.filter(Inventory.on_market == False)
    rows = q.all()

    grouped = {"BRICK": [], "PURPLE": [], "BLUE": [], "GREEN": []}
    for x in rows:
        grouped[x.rarity].append({
            "inv_id": x.id,
            "skin_id": x.skin_id, "name": x.name, "rarity": x.rarity,
            "exquisite": x.exquisite,
            "wear": f"{x.wear_bp/100:.2f}",
            "grade": x.grade,
            "serial": x.serial,
            "acquired_at": x.acquired_at,
            "on_market": x.on_market,
            "status": "on_market" if x.on_market else "in_bag"
        })
    summary = {r: len(v) for r, v in grouped.items()}
    return {"summary": summary, "buckets": grouped}

# ------------------ Crafting ------------------
@app.post("/craft/compose")
def craft_compose(inp: ComposeIn,
                  user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    mapping = {"GREEN":"BLUE", "BLUE":"PURPLE", "PURPLE":"BRICK"}
    if inp.from_rarity not in mapping:
        raise HTTPException(400, "不支持的合成方向")
    to_rarity = mapping[inp.from_rarity]
    if len(inp.inv_ids) != 20:
        raise HTTPException(400, "需要恰好 20 把进行合成")

    rows = db.query(Inventory).filter(
        Inventory.user_id==user.id,
        Inventory.id.in_(inp.inv_ids),
        Inventory.on_market==False
    ).all()
    if len(rows) != 20:
        raise HTTPException(400, "有物品不存在或不属于你")
    if any(r.rarity != inp.from_rarity for r in rows):
        raise HTTPException(400, "所选物品的稀有度不一致，或与合成方向不符")

    avg_bp = round(sum(r.wear_bp for r in rows) / 20)
    for r in rows:
        db.delete(r)

    skin = pick_skin(db, to_rarity)
    exquisite = (secrets.randbelow(100) < 15) if to_rarity == "BRICK" else False
    grade = grade_from_wear_bp(avg_bp)

    inv = Inventory(
        user_id=user.id, skin_id=skin.skin_id, name=skin.name, rarity=skin.rarity,
        exquisite=exquisite, wear_bp=avg_bp, grade=grade, serial="",
        acquired_at=int(time.time())
    )
    db.add(inv); db.flush()
    inv.serial = f"{inv.id:08d}"
    db.commit()
    return {"ok": True, "result": {
        "inv_id": inv.id,
        "skin_id": skin.skin_id, "name": skin.name, "rarity": skin.rarity,
        "exquisite": exquisite, "wear": f"{avg_bp/100:.2f}", "grade": grade, "serial": inv.serial
    }}

# ------------------ Market 交易行 ------------------
MIN_PRICE = {"BRICK": 2050, "PURPLE": 230, "BLUE": 10, "GREEN": 2}

class MarketBrowseParams(BaseModel):
    rarity: Optional[RarityT] = None
    skin_id: Optional[str] = None
    is_exquisite: Optional[bool] = None  # BRICK 有意义，其它忽略
    grade: Optional[Literal["S","A","B","C"]] = None
    sort: Optional[Literal["wear_asc","wear_desc","price_asc","price_desc","newest","oldest"]] = "newest"

from sqlalchemy.exc import IntegrityError

@app.post("/market/list")
def market_list(inp: MarketListIn, user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    # 1) 找到物品并校验归属
    inv = db.query(Inventory).filter_by(id=inp.inv_id, user_id=user.id).first()
    if not inv:
        raise HTTPException(404, "物品不存在或不属于你")

    # 2) 价格地板
    floor = MIN_PRICE.get(inv.rarity, 1)
    if inp.price < floor:
        raise HTTPException(400, f"定价过低，{inv.rarity} 最低价格为 {floor} 三角币")

    # 3) 如果已有“活跃挂单”，禁止重复上架
    existed_active = db.query(MarketItem).filter_by(inv_id=inv.id, active=True).first()
    if existed_active:
        raise HTTPException(400, "该物品已在交易行")

    # 4) 复用旧行（避免 unique 冲突）：如果有历史挂单(active=False)，直接“再激活”
    old_row = db.query(MarketItem).filter_by(inv_id=inv.id).first()
    try:
        now_ts = int(time.time())
        if old_row and not old_row.active:
            # 复用
            old_row.user_id   = user.id
            old_row.price     = inp.price
            old_row.active    = True
            old_row.created_at= now_ts
            inv.on_market     = True
            db.commit()
            return {"ok": True, "market_id": old_row.id, "msg": "挂单成功"}
        else:
            # 首次上架：插入一行，再标记 on_market
            mi = MarketItem(inv_id=inv.id, user_id=user.id, price=inp.price, active=True, created_at=now_ts)
            db.add(mi)
            db.flush()  # 先拿到 mi.id
            inv.on_market = True
            db.commit()
            return {"ok": True, "market_id": mi.id, "msg": "挂单成功"}
    except IntegrityError:
        db.rollback()
        raise HTTPException(400, "该物品已在交易行或存在重复挂单")
    except Exception:
        db.rollback()
        raise HTTPException(500, "上架失败，请稍后再试")


@app.get("/market/my")
def market_my(user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    q = db.query(MarketItem, Inventory).join(Inventory, MarketItem.inv_id==Inventory.id)\
        .filter(MarketItem.active==True, MarketItem.user_id==user.id, Inventory.on_market==True)
    items = []
    for mi, inv in q.all():
        items.append({
            "market_id": mi.id, "price": mi.price, "created_at": mi.created_at,
            "name": inv.name, "rarity": inv.rarity, "exquisite": bool(inv.exquisite),
            "grade": inv.grade, "wear": round(inv.wear_bp/100, 2), "serial": inv.serial, "inv_id": inv.id
        })
    return {"count": len(items), "items": items}

@app.post("/market/delist/{market_id}")
def market_delist(market_id: int = Path(..., ge=1),
                  user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    mi = db.query(MarketItem).filter_by(id=market_id, active=True, user_id=user.id).first()
    if not mi: raise HTTPException(404, "挂单不存在或不属于你，或已下架")
    inv = db.query(Inventory).filter_by(id=mi.inv_id).first()
    if not inv: raise HTTPException(404, "对应物品不存在")
    inv.on_market = False
    mi.active = False
    db.commit()
    return {"ok": True, "msg": "已撤下架"}

@app.get("/market/browse")
def market_browse(rarity: Optional[RarityT] = None,
                  skin_id: Optional[str] = None,
                  is_exquisite: Optional[bool] = None,
                  grade: Optional[Literal["S","A","B","C"]] = None,
                  sort: Optional[str] = "newest",
                  db: Session = Depends(get_db)):
    q = db.query(MarketItem, Inventory, User).join(Inventory, MarketItem.inv_id==Inventory.id)\
        .join(User, MarketItem.user_id==User.id)\
        .filter(MarketItem.active==True, Inventory.on_market==True)
    if rarity:
        q = q.filter(Inventory.rarity==rarity)
    if skin_id:
        q = q.filter(Inventory.skin_id==skin_id)
    if is_exquisite is not None:
        q = q.filter(Inventory.exquisite==is_exquisite)
    if grade:
        q = q.filter(Inventory.grade==grade)

    if sort == "wear_asc":
        q = q.order_by(Inventory.wear_bp.asc())
    elif sort == "wear_desc":
        q = q.order_by(Inventory.wear_bp.desc())
    elif sort == "price_asc":
        q = q.order_by(MarketItem.price.asc())
    elif sort == "price_desc":
        q = q.order_by(MarketItem.price.desc())
    elif sort == "oldest":
        q = q.order_by(MarketItem.created_at.asc())
    else:  # newest
        q = q.order_by(MarketItem.created_at.desc())

    out: List[MarketBrowseOut] = []
    for mi, inv, seller in q.all():
        out.append(MarketBrowseOut(
            id=mi.id, inv_id=inv.id, seller=seller.username, price=mi.price,
            name=inv.name, skin_id=inv.skin_id, rarity=inv.rarity,
            exquisite=bool(inv.exquisite), grade=inv.grade,
            wear=round(inv.wear_bp/100, 2), serial=inv.serial, created_at=mi.created_at
        ))
    return {"count": len(out), "items": [o.dict() for o in out]}

@app.post("/market/buy/{market_id}")
def market_buy(market_id: int = Path(..., ge=1),
               user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    mi = db.query(MarketItem).filter_by(id=market_id, active=True).first()
    if not mi: raise HTTPException(404, "挂单不存在或已成交")
    inv = db.query(Inventory).filter_by(id=mi.inv_id, on_market=True).first()
    if not inv: raise HTTPException(404, "对应物品不存在或已下架")
    if inv.user_id == user.id:
        raise HTTPException(400, "不能购买自己的挂单")
    if user.coins < mi.price:
        raise HTTPException(400, "三角币不足")

    seller = db.query(User).filter_by(id=mi.user_id).first()
    if not seller: raise HTTPException(500, "卖家不存在")

    user.coins -= mi.price
    seller.coins += mi.price

    inv.user_id = user.id
    inv.on_market = False
    mi.active = False
    db.commit()
    return {"ok": True, "msg": "购买成功", "inv_id": inv.id, "name": inv.name, "serial": inv.serial, "price": mi.price}

# ------------------ Admin（旧：X-Admin-Key） ------------------
def require_admin(x_admin_key: Optional[str] = Header(None)):
    if x_admin_key != ADMIN_KEY: raise HTTPException(401, "需要有效的 X-Admin-Key")

@app.get("/admin/config")
def admin_get_config(db: Session = Depends(get_db), _: None = Depends(require_admin)):
    cfg = db.query(PoolConfig).first()
    return {"brick_price": cfg.brick_price, "key_price": cfg.key_price,
            "p_brick_base": cfg.p_brick_base, "p_purple_base": cfg.p_purple_base,
            "p_blue_base": cfg.p_blue_base, "p_green_base": cfg.p_green_base,
            "brick_pity_max": cfg.brick_pity_max, "brick_ramp_start": cfg.brick_ramp_start,
            "purple_pity_max": cfg.purple_pity_max, "compression_alpha": cfg.compression_alpha}

@app.post("/admin/config")
def admin_set_config(inp: PoolConfigIn, db: Session = Depends(get_db), _: None = Depends(require_admin)):
    cfg = db.query(PoolConfig).first()
    for k, v in inp.dict().items():
        setattr(cfg, k, v)
    db.commit(); return {"ok": True}

@app.post("/admin/skins/upsert")
def admin_upsert_skins(skins: List[SkinIn], db: Session = Depends(get_db), _: None = Depends(require_admin)):
    for s in skins:
        row = db.query(Skin).filter_by(skin_id=s.skin_id).first()
        if row:
            row.name = s.name; row.rarity = s.rarity; row.active = s.active
        else:
            db.add(Skin(skin_id=s.skin_id, name=s.name, rarity=s.rarity, active=s.active))
    db.commit(); return {"ok": True}

@app.post("/admin/skins/activate")
def admin_activate_skin(s: SkinIn, db: Session = Depends(get_db), _: None = Depends(require_admin)):
    row = db.query(Skin).filter_by(skin_id=s.skin_id).first()
    if not row: raise HTTPException(404, "皮肤不存在")
    row.active = s.active; db.commit(); return {"ok": True, "active": row.active}

# ======== 追加：管理员/充值扩展（JWT 管理员 + 充值两段式 + 管理员发放法币 + 充值申请查看） ========
from fastapi import APIRouter
import sqlite3, time as _time, os as _os, jwt as _jwt
from typing import Optional as _Optional

try:
    JWT_SECRET
except NameError:
    JWT_SECRET = _os.environ.get("JWT_SECRET","dev-secret")
try:
    JWT_ALGO
except NameError:
    JWT_ALGO = "HS256"

DB_PATH = _os.path.join(_os.path.dirname(__file__), "delta_brick.db")
SMS_FILE = _os.path.join(_os.path.dirname(__file__), "sms_codes.txt")

def _conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c

def _ts(): return int(_time.time())

def _write_sms(tag, code, purpose, amount=None):
    extra = (f"\tamount={amount}" if amount is not None else "")
    line = f"{_ts()}\t{purpose}\t{tag}\t{code}{extra}\n"
    with open(SMS_FILE, "a", encoding="utf-8") as f:
        f.write(line)

def _gen_code(n=6):
    import random
    return "".join([str(random.randint(0,9)) for _ in range(n)])

# 幂等迁移：users.is_admin、admin_pending、topup_codes
def _migrate_ext():
    con=_conn(); cur=con.cursor()
    # users 增加 is_admin（如果不存在）
    cur.execute("PRAGMA table_info(users)")
    cols = [row["name"] for row in cur.fetchall()]
    if "is_admin" not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0")
    # admin_pending
    cur.execute("""CREATE TABLE IF NOT EXISTS admin_pending(
      username TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      expire_at INTEGER NOT NULL
    )""")
    # topup_codes
    cur.execute("""CREATE TABLE IF NOT EXISTS topup_codes(
      username TEXT NOT NULL,
      code TEXT NOT NULL,
      amount INTEGER NOT NULL,
      expire_at INTEGER NOT NULL
    )""")
    # + 新增：管理员删号验证码表
    cur.execute("""CREATE TABLE IF NOT EXISTS admin_deluser_codes(
      target_username TEXT NOT NULL,
      code TEXT NOT NULL,
      requested_by TEXT NOT NULL,
      expire_at INTEGER NOT NULL
    )""")

    con.commit(); con.close()
_migrate_ext()

ext = APIRouter()

# 解析 JWT -> 当前用户（sub=用户名）
from fastapi import Depends as _Depends, HTTPException as _HTTPException
from fastapi.security import HTTPBearer as _HTTPBearer, HTTPAuthorizationCredentials as _Creds
_auth = _HTTPBearer(auto_error=False)

def _require_user(cred: _Creds = _Depends(_auth)):
    if not cred:
        raise _HTTPException(401, "Unauthorized")
    try:
        data = _jwt.decode(cred.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
        username = data.get("sub")
        token_sv = int(data.get("sv", -1))
    except Exception:
        raise _HTTPException(401, "Unauthorized")

    if not username:
        raise _HTTPException(401, "Unauthorized")

    con=_conn(); cur=con.cursor()
    cur.execute("SELECT * FROM users WHERE username=?", (username,))
    u=cur.fetchone()
    con.close()
    if not u:
        raise _HTTPException(401, "Unauthorized")

    # ★ 单点登录校验
    if int(u["session_ver"] or 0) != token_sv:
        raise _HTTPException(status_code=401, detail="SESSION_REVOKED")

    return u

def _require_admin(u=_Depends(_require_user)):
    if not bool(u["is_admin"]):
        raise _HTTPException(403, "Forbidden")
    return u

# 注册 want_admin=true 之后，前端可调用此接口提交验证码成为管理员
@ext.post("/auth/admin-verify")
def admin_verify(payload: dict):
    username = (payload or {}).get("username","")
    code = (payload or {}).get("code","")
    if not username or not code: raise _HTTPException(400, "username/code required")
    con=_conn(); cur=con.cursor()
    cur.execute("SELECT * FROM admin_pending WHERE username=?", (username,))
    row=cur.fetchone()
    if not row:
        con.close(); raise _HTTPException(400, "no pending admin request")
    if _ts() > int(row["expire_at"]):
        con.close(); raise _HTTPException(400, "code expired")
    if str(code) != str(row["code"]):
        con.close(); raise _HTTPException(400, "invalid code")
    cur.execute("UPDATE users SET is_admin=1 WHERE username=?", (username,))
    cur.execute("DELETE FROM admin_pending WHERE username=?", (username,))
    con.commit(); con.close()
    return {"ok":True}

# 提供给 /auth/register 调用：把申请管理员的验证码写入 admin_pending
def put_admin_pending(username: str):
    _sms_rate_guard("admin-verify", username)
    con=_conn(); cur=con.cursor()
    code = _gen_code(6); exp = _ts()+15*60
    cur.execute("REPLACE INTO admin_pending(username, code, expire_at) VALUES (?,?,?)", (username, code, exp))
    con.commit(); con.close()
    _write_sms(username, code, "admin-verify")
    return code

# 充值两段式：请求验证码（携带金额）
@ext.post("/wallet/topup/request")
def topup_request(payload: dict, u=_Depends(_require_user)):
    amount = int((payload or {}).get("amount_fiat", 0) or 0)
    if amount <= 0:
        raise _HTTPException(400, "amount_fiat required")
    _sms_rate_guard("wallet-topup", u["username"])
    code = _gen_code(6)
    con=_conn(); cur=con.cursor()
    cur.execute("DELETE FROM topup_codes WHERE username=?", (u["username"],))
    cur.execute("INSERT INTO topup_codes(username, code, amount, expire_at) VALUES (?,?,?,?)",
                (u["username"], code, amount, _ts()+10*60))
    con.commit(); con.close()
    _write_sms(u["username"], code, "wallet-topup", amount=amount)
    return {"ok":True}

# 充值两段式：确认（只带验证码）
@ext.post("/wallet/topup/confirm")
def topup_confirm(payload: dict, u=_Depends(_require_user)):
    code = (payload or {}).get("code","")
    if not code: raise _HTTPException(400, "code required")
    con=_conn(); cur=con.cursor()
    cur.execute("SELECT * FROM topup_codes WHERE username=? ORDER BY expire_at DESC", (u["username"],))
    row=cur.fetchone()
    if not row:
        con.close(); raise _HTTPException(400, "no request")
    if _ts() > int(row["expire_at"]):
        con.close(); raise _HTTPException(400, "code expired")
    if str(code) != str(row["code"]):
        con.close(); raise _HTTPException(400, "invalid code")
    amount = int(row["amount"])
    cur.execute("UPDATE users SET fiat = fiat + ? WHERE id=?", (amount, u["id"]))
    cur.execute("DELETE FROM topup_codes WHERE username=?", (u["username"],))
    con.commit(); con.close()
    return {"ok":True, "added": amount}

# 管理员：查看未使用/未过期的充值申请
@ext.get("/admin/topup-requests")
def admin_topup_requests(admin=_Depends(_require_admin)):
    now=_ts()
    con=_conn(); cur=con.cursor()
    cur.execute("""SELECT username, code, amount as amount_fiat, expire_at
                   FROM topup_codes
                   WHERE expire_at > ?
                   ORDER BY expire_at DESC""", (now,))
    items=[dict(r) for r in cur.fetchall()]
    con.close()
    return {"items": items}

# 管理员：读取短信验证码日志（来自 sms_codes.txt）
@ext.get("/admin/sms-log")
def admin_sms_log(limit: int = 200, admin=_Depends(_require_admin)):
    """
    仅返回：未过期 + 未使用（库中仍存在）+ 对应（phone,purpose）的“当前最新”验证码。
    - wallet-topup：匹配 topup_codes 表（仍存在且未过期即未使用；request 时会清旧，confirm/使用后会删）
    - admin-verify：匹配 admin_pending 表（同上）
    - login / login2 / reset / register：匹配 sms_code 表（save_otp 现在会清旧、verify_otp 成功会删）
    """
    items = []
    try:
        with open(SMS_FILE, "r", encoding="utf-8") as f:
            lines = f.readlines()
    except FileNotFoundError:
        lines = []

    now = _ts()

    # 预取三张表的“当前有效”索引，方便 O(1) 判断
    # 1) topup_codes：username -> {code, expire_at}
    con = _conn(); cur = con.cursor()
    cur.execute("SELECT username, code, expire_at FROM topup_codes WHERE expire_at > ?", (now,))
    alive_topup = {}
    for r in cur.fetchall():
        alive_topup[r["username"]] = {"code": r["code"], "expire_at": r["expire_at"]}
    # 2) admin_pending：username -> {code, expire_at}
    cur.execute("SELECT username, code, expire_at FROM admin_pending WHERE expire_at > ?", (now,))
    alive_admin = {}

    for r in cur.fetchall():
        alive_admin[r["username"]] = {"code": r["code"], "expire_at": r["expire_at"]}
    # 2.5) admin_deluser_codes：target_username -> {code, expire_at}
    cur.execute("SELECT target_username, code, expire_at FROM admin_deluser_codes WHERE expire_at > ?", (now,))
    alive_deluser = {}
    for r in cur.fetchall():
        alive_deluser[r["target_username"]] = {"code": r["code"], "expire_at": r["expire_at"]}

    con.close()

    # 3) sms_code（哈希无法直接比对 code，本函数只需要“是否有有效记录”即可；
    #    因为 save_otp 发送前会把旧记录全部清掉，所以存在即代表“最新”）
    from sqlalchemy import and_
    with SessionLocal() as db:
        alive_sms = {}  # key=(phone,purpose) -> True
        rows = db.query(SmsCode.phone, SmsCode.purpose).filter(SmsCode.expire_ts > now).all()
        for ph, pc in rows:
            alive_sms[(ph, pc)] = True

    def parse_line(line: str):
        # 返回 (purpose, tag, code, ts_int, amount)
        line = line.strip()
        if not line:
            return None
        # 老格式：phone=... purpose=... code=... ts=...
        if "phone=" in line and "purpose=" in line and "code=" in line:
            parts = {}
            for tok in line.replace("\t", " ").split():
                if "=" in tok:
                    k, v = tok.split("=", 1)
                    parts[k] = v
            purpose = parts.get("purpose", "")
            tag = parts.get("phone", "")      # 老格式 tag=手机号
            code = parts.get("code", "")
            # ts 为人类时间，这里不依赖它做有效性判断
            return purpose, tag, code, now, None
        # 新格式：ts \t purpose \t tag \t code [\t amount=xxx]
        cols = line.split("\t")
        if len(cols) < 4:
            return None
        ts_int = int(cols[0]) if cols[0].isdigit() else now
        purpose = cols[1]; tag = cols[2]; code = cols[3]
        amount = None
        if len(cols) >= 5 and cols[4].startswith("amount="):
            try: amount = int(cols[4].split("=",1)[1])
            except: pass
        return purpose, tag, code, ts_int, amount

    seen_keys = set()  # 新增：去重 (purpose, tag)

    for line in reversed(lines):
        parsed = parse_line(line)
        if not parsed:
            continue
        purpose, tag, code, ts_int, amount = parsed
        # 隐藏：删号验证码只允许后端可见，不在前端“短信验证码日志”里展示
        # 隐藏：删号/管理员验证 的验证码只允许后端可见，不在前端列表展示
        if purpose in ("admin-deluser", "admin-verify"):
            continue

        keep = False
        if purpose == "wallet-topup":
            # 仅当数据库里“当前有效”的那条 code 与文件行一致才保留
            info = alive_topup.get(tag)
            keep = bool(info and info["code"] == code and info["expire_at"] > now)
        elif purpose == "admin-verify":
            info = alive_admin.get(tag)
            keep = bool(info and info["code"] == code and info["expire_at"] > now)
        elif purpose in ("login", "login2", "reset", "register"):
            # 有效即代表“最新”（save_otp 已清旧）
            keep = alive_sms.get((tag, purpose), False)
        elif purpose == "admin-deluser":
            info = alive_deluser.get(tag)
            keep = bool(info and info["code"] == code and info["expire_at"] > now)
        else:
            keep = False

        if keep:
            key = (purpose, tag)
            if key in seen_keys:
                continue  # 同一 purpose+tag 已收录过（最新一条），跳过旧的
            seen_keys.add(key)

            items.append({
                "purpose": purpose,
                "tag": tag,
                "code": code,
                "ts": ts_int,
                "amount": amount
            })
            if len(items) >= max(1, min(limit, 1000)):
                break

    return {"items": items}



# 管理员：搜索用户
@ext.get("/admin/users")
def admin_users(q: _Optional[str]=None, page: int=1, page_size: int=20, admin=_Depends(_require_admin)):
    off = max(0,(page-1)*page_size)
    con=_conn(); cur=con.cursor()
    if q:
      qq = f"%{q}%"
      cur.execute("""SELECT username, phone, fiat, coins, is_admin FROM users
                     WHERE username LIKE ? OR phone LIKE ?
                     ORDER BY id DESC LIMIT ? OFFSET ?""", (qq, qq, page_size, off))
    else:
      cur.execute("""SELECT username, phone, fiat, coins, is_admin FROM users
                     ORDER BY id DESC LIMIT ? OFFSET ?""", (page_size, off))
    items=[dict(r) for r in cur.fetchall()]
    con.close()
    return {"items": items, "page": page, "page_size": page_size}

# 管理员：发放法币
@ext.post("/admin/grant-fiat")
def grant_fiat(payload: dict, admin=_Depends(_require_admin)):
    username = (payload or {}).get("username","")
    amount = int((payload or {}).get("amount_fiat",0) or 0)
    if not username or amount<=0: raise _HTTPException(400, "username/amount required")
    con=_conn(); cur=con.cursor()
    cur.execute("UPDATE users SET fiat = fiat + ? WHERE username=?", (amount, username))
    if cur.rowcount == 0:
        con.close(); raise _HTTPException(404, "user not found")
    con.commit(); con.close()
    return {"ok":True}

# --- 管理员：发放/扣减 三角币 & 扣减法币（拒绝出现负数） ---

@ext.post("/admin/grant-coins")
def grant_coins(payload: dict, admin=_Depends(_require_admin)):
    username = (payload or {}).get("username","")
    amount = int((payload or {}).get("amount_coins",0) or 0)
    if not username or amount <= 0:
        raise _HTTPException(400, "username/amount_coins required (>0)")
    con=_conn(); cur=con.cursor()
    cur.execute("UPDATE users SET coins = coins + ? WHERE username=?", (amount, username))
    if cur.rowcount == 0:
        con.close(); raise _HTTPException(404, "user not found")
    con.commit()
    # 返回新余额
    cur.execute("SELECT coins FROM users WHERE username=?", (username,))
    coins = cur.fetchone()["coins"]
    con.close()
    return {"ok": True, "username": username, "coins": coins}

@ext.post("/admin/deduct-coins")
def deduct_coins(payload: dict, admin=_Depends(_require_admin)):
    username = (payload or {}).get("username","")
    amount = int((payload or {}).get("amount_coins",0) or 0)
    if not username or amount <= 0:
        raise _HTTPException(400, "username/amount_coins required (>0)")
    con=_conn(); cur=con.cursor()
    cur.execute("SELECT coins FROM users WHERE username=?", (username,))
    row = cur.fetchone()
    if not row:
        con.close(); raise _HTTPException(404, "user not found")
    if row["coins"] < amount:
        con.close(); raise _HTTPException(400, "三角币不足，无法扣减")
    cur.execute("UPDATE users SET coins = coins - ? WHERE username=?", (amount, username))
    con.commit()
    cur.execute("SELECT coins FROM users WHERE username=?", (username,))
    coins = cur.fetchone()["coins"]
    con.close()
    return {"ok": True, "username": username, "coins": coins}

@ext.post("/admin/deduct-fiat")
def deduct_fiat(payload: dict, admin=_Depends(_require_admin)):
    username = (payload or {}).get("username","")
    amount = int((payload or {}).get("amount_fiat",0) or 0)
    if not username or amount <= 0:
        raise _HTTPException(400, "username/amount_fiat required (>0)")
    con=_conn(); cur=con.cursor()
    cur.execute("SELECT fiat FROM users WHERE username=?", (username,))
    row = cur.fetchone()
    if not row:
        con.close(); raise _HTTPException(404, "user not found")
    if row["fiat"] < amount:
        con.close(); raise _HTTPException(400, "法币不足，无法扣减")
    cur.execute("UPDATE users SET fiat = fiat - ? WHERE username=?", (amount, username))
    con.commit()
    cur.execute("SELECT fiat FROM users WHERE username=?", (username,))
    fiat = cur.fetchone()["fiat"]
    con.close()
    return {"ok": True, "username": username, "fiat": fiat}

# 管理员：申请“删除账号”验证码
@ext.post("/admin/delete-user/request")
def admin_delete_user_request(payload: dict, admin=_Depends(_require_admin)):
    target = ((payload or {}).get("target_username") or (payload or {}).get("username") or "").strip()
    if not target:
        raise _HTTPException(400, "username required")

    con=_conn(); cur=con.cursor()
    # 检查目标用户是否存在
    cur.execute("SELECT id, username, phone, is_admin FROM users WHERE username=?", (target,))
    row = cur.fetchone()
    if not row:
        con.close(); raise _HTTPException(404, "user not found")
    _sms_rate_guard("admin-deluser", target)


    # 生成并落库验证码（10 分钟）
    code = _gen_code(6)
    exp  = _ts() + 10*60
    cur.execute("DELETE FROM admin_deluser_codes WHERE target_username=?", (target,))
    cur.execute("INSERT INTO admin_deluser_codes(target_username, code, requested_by, expire_at) VALUES (?,?,?,?)",
                (target, code, admin["username"], exp))
    con.commit(); con.close()

    # 写日志（purpose=admin-deluser，tag=目标用户名）
    _write_sms(target, code, "admin-deluser")
    return {"ok": True, "msg": "删除验证码已下发（见短信日志）"}

# 管理员：确认删除（带验证码）
@ext.post("/admin/delete-user/confirm")
def admin_delete_user_confirm(payload: dict, admin=_Depends(_require_admin)):
    target = ((payload or {}).get("target_username") or (payload or {}).get("username") or "").strip()
    code   = (payload or {}).get("code","").strip()
    if not target or not code:
        raise _HTTPException(400, "username/code required")

    con=_conn(); cur=con.cursor()
    # 校验验证码是否存在/未过期/匹配
    cur.execute("SELECT code, expire_at FROM admin_deluser_codes WHERE target_username=?", (target,))
    row = cur.fetchone()
    if not row:
        con.close(); raise _HTTPException(400, "no pending delete code")
    if _ts() > int(row["expire_at"]):
        con.close(); raise _HTTPException(400, "code expired")
    if str(code) != str(row["code"]):
        con.close(); raise _HTTPException(400, "invalid code")

    # 找到要删的用户与关联数据
    cur.execute("SELECT id, username, phone FROM users WHERE username=?", (target,))
    u = cur.fetchone()
    if not u:
        con.close(); raise _HTTPException(404, "user not found")

    uid = int(u["id"]); uphone = u["phone"]

    # 级联清理
    cur.execute("DELETE FROM market WHERE inv_id IN (SELECT id FROM inventory WHERE user_id=?)", (uid,))
    cur.execute("DELETE FROM inventory WHERE user_id=?", (uid,))
    cur.execute("DELETE FROM topup_codes WHERE username=?", (target,))
    cur.execute("DELETE FROM admin_pending WHERE username=?", (target,))
    cur.execute("DELETE FROM sms_code WHERE phone=?", (uphone,))
    cur.execute("DELETE FROM users WHERE id=?", (uid,))
    cur.execute("DELETE FROM admin_deluser_codes WHERE target_username=?", (target,))
    con.commit(); con.close()

    return {"ok": True, "msg": f"用户 {target} 已删除"}


# 挂载扩展
try:
    app.include_router(ext)
except Exception:
    pass
# ======== 扩展结束 ========

# ------------------ Run ------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
