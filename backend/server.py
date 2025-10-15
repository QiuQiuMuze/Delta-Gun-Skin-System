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
from typing import Optional, Literal, List, Dict, Any, Tuple
from datetime import datetime, timedelta
import time, os, secrets, jwt, re, json, random, math

from passlib.context import CryptContext
from sqlalchemy import (
    create_engine, Column, Integer, String, Boolean, Float,
    ForeignKey, Text, func, UniqueConstraint
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session
import sqlite3

from season_data import SEASON_DEFINITIONS

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
    gift_fiat_balance = Column(Integer, default=0)
    gift_coin_balance = Column(Integer, default=0)
    gift_unopened_bricks = Column(Integer, default=0)
    gift_brick_quota = Column(Integer, default=0)

class Skin(Base):
    __tablename__ = "skins"
    id = Column(Integer, primary_key=True)
    skin_id = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    rarity = Column(String, nullable=False)  # BRICK/PURPLE/BLUE/GREEN
    active = Column(Boolean, default=True)
    season = Column(String, default="")
    weapon = Column(String, default="")
    model_key = Column(String, default="")
    meta = Column(Text, default="{}")

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
    body_colors = Column(String, default="")        # JSON: ["#xxxxxx", ...]
    attachment_colors = Column(String, default="")  # JSON: ["#xxxxxx", ...]
    template_name = Column(String, default="")
    effect_tags = Column(String, default="")        # JSON: ["glow", ...]
    hidden_template = Column(Boolean, default=False)
    sell_locked = Column(Boolean, default=False)
    lock_reason = Column(String, default="")
    season = Column(String, default="")
    model_key = Column(String, default="")

class SystemSetting(Base):
    __tablename__ = "system_settings"
    key = Column(String, primary_key=True)
    value = Column(String, nullable=False)

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

class BrickMarketState(Base):
    __tablename__ = "brick_market_state"
    id = Column(Integer, primary_key=True)
    price = Column(Float, default=100.0)
    sentiment = Column(Float, default=0.0)
    last_update = Column(Integer, default=0)

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

class BrickSellOrder(Base):
    __tablename__ = "brick_sell_orders"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=True)
    price = Column(Integer, nullable=False)
    quantity = Column(Integer, nullable=False)
    remaining = Column(Integer, nullable=False)
    active = Column(Boolean, default=True)
    source = Column(String, default="player")  # player / official
    priority = Column(Integer, default=0)
    created_at = Column(Integer, default=lambda: int(time.time()))
    season = Column(String, default="")

class BrickBuyOrder(Base):
    __tablename__ = "brick_buy_orders"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    target_price = Column(Integer, nullable=False)
    quantity = Column(Integer, nullable=False)
    locked_coins = Column(Integer, nullable=False)
    gift_coin_locked = Column(Integer, default=0)
    remaining = Column(Integer, nullable=False)
    active = Column(Boolean, default=True)
    created_at = Column(Integer, default=lambda: int(time.time()))


class CookieFactoryProfile(Base):
    __tablename__ = "cookie_factory_profiles"
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    total_cookies = Column(Float, default=0.0)
    cookies_this_week = Column(Float, default=0.0)
    manual_clicks = Column(Integer, default=0)
    golden_cookies = Column(Integer, default=0)
    prestige = Column(Integer, default=0)
    prestige_points = Column(Integer, default=0)
    sugar_lumps = Column(Integer, default=0)
    buildings = Column(Text, default="{}")
    mini_games = Column(Text, default="{}")
    active_points = Column(Text, default="{}")
    login_days = Column(Text, default="{}")
    login_streak = Column(Integer, default=0)
    last_login_day = Column(String, default="")
    challenge_clicks = Column(Text, default="{}")
    week_start_ts = Column(Integer, default=0)
    last_active_ts = Column(Integer, default=0)
    golden_ready_ts = Column(Integer, default=0)
    golden_cooldown = Column(Integer, default=0)
    production_bonus_multiplier = Column(Float, default=1.0)
    pending_bonus_multiplier = Column(Float, default=1.0)
    penalty_multiplier = Column(Float, default=1.0)
    pending_penalty_multiplier = Column(Float, default=1.0)
    banked_cookies = Column(Float, default=0.0)
    total_bricks_earned = Column(Integer, default=0)
    weekly_bricks_awarded = Column(Integer, default=0)
    claimed_bricks_this_week = Column(Integer, default=0)
    last_report = Column(Text, default="")
    last_sugar_ts = Column(Integer, default=0)


class TradeLog(Base):
    __tablename__ = "trade_logs"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    category = Column(String, nullable=False)  # brick / skin
    action = Column(String, nullable=False)    # buy / sell
    item_name = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Integer, nullable=False, default=0)
    total_amount = Column(Integer, nullable=False, default=0)
    net_amount = Column(Integer, nullable=False, default=0)
    created_at = Column(Integer, default=lambda: int(time.time()))
    season = Column(String, default="")


class UserBrickBalance(Base):
    __tablename__ = "user_brick_balances"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    season = Column(String, nullable=False, default="")
    quantity = Column(Integer, nullable=False, default=0)
    gift_locked = Column(Integer, nullable=False, default=0)
    __table_args__ = (UniqueConstraint("user_id", "season", name="uq_user_season"),)

def _ensure_user_sessionver():
    con = sqlite3.connect(DB_PATH_FS)
    cur = con.cursor()
    cur.execute("PRAGMA table_info(users)")
    cols = [row[1] for row in cur.fetchall()]
    if "session_ver" not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN session_ver INTEGER NOT NULL DEFAULT 0")
        con.commit()
    con.close()

def _ensure_inventory_visual_columns():
    con = sqlite3.connect(DB_PATH_FS)
    cur = con.cursor()
    cur.execute("PRAGMA table_info(inventory)")
    cols = {row[1] for row in cur.fetchall()}
    if "body_colors" not in cols:
        cur.execute("ALTER TABLE inventory ADD COLUMN body_colors TEXT DEFAULT ''")
    if "attachment_colors" not in cols:
        cur.execute("ALTER TABLE inventory ADD COLUMN attachment_colors TEXT DEFAULT ''")
    if "template_name" not in cols:
        cur.execute("ALTER TABLE inventory ADD COLUMN template_name TEXT DEFAULT ''")
    if "effect_tags" not in cols:
        cur.execute("ALTER TABLE inventory ADD COLUMN effect_tags TEXT DEFAULT ''")
    if "hidden_template" not in cols:
        cur.execute("ALTER TABLE inventory ADD COLUMN hidden_template INTEGER NOT NULL DEFAULT 0")
    if "sell_locked" not in cols:
        cur.execute("ALTER TABLE inventory ADD COLUMN sell_locked INTEGER NOT NULL DEFAULT 0")
    if "lock_reason" not in cols:
        cur.execute("ALTER TABLE inventory ADD COLUMN lock_reason TEXT DEFAULT ''")
    if "season" not in cols:
        cur.execute("ALTER TABLE inventory ADD COLUMN season TEXT NOT NULL DEFAULT ''")
    if "model_key" not in cols:
        cur.execute("ALTER TABLE inventory ADD COLUMN model_key TEXT NOT NULL DEFAULT ''")
    con.commit()
    con.close()


def _ensure_skin_extended_columns():
    con = sqlite3.connect(DB_PATH_FS)
    cur = con.cursor()
    cur.execute("PRAGMA table_info(skins)")
    cols = {row[1] for row in cur.fetchall()}
    if "season" not in cols:
        cur.execute("ALTER TABLE skins ADD COLUMN season TEXT NOT NULL DEFAULT ''")
    if "weapon" not in cols:
        cur.execute("ALTER TABLE skins ADD COLUMN weapon TEXT NOT NULL DEFAULT ''")
    if "model_key" not in cols:
        cur.execute("ALTER TABLE skins ADD COLUMN model_key TEXT NOT NULL DEFAULT ''")
    if "meta" not in cols:
        cur.execute("ALTER TABLE skins ADD COLUMN meta TEXT NOT NULL DEFAULT '{}'" )
    con.commit()
    con.close()


def _ensure_trade_log_columns():
    con = sqlite3.connect(DB_PATH_FS)
    cur = con.cursor()
    cur.execute("PRAGMA table_info(trade_logs)")
    cols = {row[1] for row in cur.fetchall()}
    if "season" not in cols:
        cur.execute("ALTER TABLE trade_logs ADD COLUMN season TEXT NOT NULL DEFAULT ''")
    con.commit()
    con.close()


def _ensure_brick_sell_columns():
    con = sqlite3.connect(DB_PATH_FS)
    cur = con.cursor()
    cur.execute("PRAGMA table_info(brick_sell_orders)")
    cols = {row[1] for row in cur.fetchall()}
    if "season" not in cols:
        cur.execute("ALTER TABLE brick_sell_orders ADD COLUMN season TEXT NOT NULL DEFAULT ''")
    con.commit()
    con.close()


def _season_skin_entries():
    for season in SEASON_DEFINITIONS:
        sid = season.get("id", "").upper()
        for group in ("bricks", "purples", "blues", "greens"):
            for item in season.get(group, []) or []:
                yield sid, item


def _seed_skins(db: Session):
    existing = {row.skin_id: row for row in db.query(Skin).all()}
    for season_id, data in _season_skin_entries():
        meta_json = json.dumps(data.get("meta", {}), ensure_ascii=False)
        row = existing.get(data["skin_id"])
        if row:
            row.name = data["name"]
            row.rarity = data["rarity"]
            row.active = True
            row.season = season_id
            row.weapon = data.get("weapon", "")
            row.model_key = data.get("model_key", "")
            row.meta = meta_json
        else:
            db.add(Skin(
                skin_id=data["skin_id"],
                name=data["name"],
                rarity=data["rarity"],
                active=True,
                season=season_id,
                weapon=data.get("weapon", ""),
                model_key=data.get("model_key", ""),
                meta=meta_json,
            ))
    db.flush()


def sync_inventory_skin_meta(db: Session):
    skins = {s.skin_id: s for s in db.query(Skin).all()}
    rows = db.query(Inventory).all()
    changed = False
    for inv in rows:
        skin = skins.get(inv.skin_id)
        if not skin:
            continue
        if (inv.season or "").upper() != (skin.season or "").upper():
            inv.season = skin.season or ""
            changed = True
        model_key = skin.model_key or ""
        if (inv.model_key or "") != model_key:
            inv.model_key = model_key
            changed = True
    if changed:
        db.flush()

def _ensure_user_gift_columns():
    con = sqlite3.connect(DB_PATH_FS)
    cur = con.cursor()
    cur.execute("PRAGMA table_info(users)")
    cols = {row[1] for row in cur.fetchall()}
    if "gift_fiat_balance" not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN gift_fiat_balance INTEGER NOT NULL DEFAULT 0")
    if "gift_coin_balance" not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN gift_coin_balance INTEGER NOT NULL DEFAULT 0")
    if "gift_unopened_bricks" not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN gift_unopened_bricks INTEGER NOT NULL DEFAULT 0")
    if "gift_brick_quota" not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN gift_brick_quota INTEGER NOT NULL DEFAULT 0")
    con.commit()
    con.close()

def _ensure_cookie_profile_columns():
    con = sqlite3.connect(DB_PATH_FS)
    cur = con.cursor()
    cur.execute("PRAGMA table_info(cookie_factory_profiles)")
    cols = {row[1] for row in cur.fetchall()}
    if "challenge_clicks" not in cols:
        cur.execute("ALTER TABLE cookie_factory_profiles ADD COLUMN challenge_clicks TEXT DEFAULT '{}'")
    if "claimed_bricks_this_week" not in cols:
        cur.execute(
            "ALTER TABLE cookie_factory_profiles ADD COLUMN claimed_bricks_this_week INTEGER NOT NULL DEFAULT 0"
        )
    con.commit()
    con.close()

Base.metadata.create_all(engine)
_ensure_user_sessionver()
_ensure_inventory_visual_columns()
_ensure_skin_extended_columns()
_ensure_trade_log_columns()
_ensure_brick_sell_columns()
_ensure_user_gift_columns()
_ensure_cookie_profile_columns()

# ------------------ Pydantic ------------------
RarityT = Literal["BRICK", "PURPLE", "BLUE", "GREEN"]

class RegisterIn(BaseModel):
    username: str
    password: str
    phone: Optional[str] = None
    reg_code: Optional[str] = None
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
    season: Optional[str] = None
    target_skin_id: Optional[str] = None

class BrickSellIn(BaseModel):
    quantity: int
    price: int
    season: Optional[str] = None

class BrickBuyOrderIn(BaseModel):
    quantity: int
    target_price: int
    season: Optional[str] = None


class CookieActIn(BaseModel):
    type: Literal[
        "click",
        "buy_building",
        "golden",
        "mini",
        "claim",
        "prestige",
        "sugar",
    ]
    amount: Optional[int] = 1
    building: Optional[str] = None
    mini: Optional[str] = None

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
    template: str
    hidden_template: bool
    effects: List[str]
    visual: Dict[str, Any]
    season: str = ""
    model: str = ""

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
VIRTUAL_PHONE_PREFIX = "virtual:"
AUTH_MODE_KEY = "auth_free_mode"

def get_auth_free_mode(db: Session) -> bool:
    row = db.query(SystemSetting).filter_by(key=AUTH_MODE_KEY).first()
    if not row:
        return True
    return str(row.value) != "0"

def _alloc_virtual_phone(db: Session, username: str) -> str:
    """为无需绑定手机号的账户生成内部占位符，保持唯一性。"""
    # 采用 username 作为种子，避免生成过于随机的占位串，便于排查
    base = f"{VIRTUAL_PHONE_PREFIX}{username.lower()}"
    candidate = base
    # 若用户名重复导致冲突，则附加随机后缀重试
    if not db.query(User).filter_by(phone=candidate).first():
        return candidate
    for _ in range(8):
        suffix = secrets.token_hex(3)
        candidate = f"{base}:{suffix}"
        if not db.query(User).filter_by(phone=candidate).first():
            return candidate
    # 极端情况下依旧冲突，则退回到完全随机的 token
    while True:
        candidate = f"{VIRTUAL_PHONE_PREFIX}{secrets.token_hex(4)}"
        if not db.query(User).filter_by(phone=candidate).first():
            return candidate

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
    cfg = _db.query(PoolConfig).first()
    if not cfg:
        cfg = PoolConfig()
        _db.add(cfg)
        _db.flush()
    if not _db.query(BrickMarketState).first():
        init_price = round(random.uniform(60, 120), 2)
        _db.add(BrickMarketState(price=init_price, sentiment=0.0, last_update=int(time.time())))
        cfg.brick_price = max(40, min(150, int(round(init_price))))
    _seed_skins(_db)
    sync_inventory_skin_meta(_db)
    _db.commit()

# ---- RNG & Grades ----
SEASON_LOOKUP = {s.get("id", "").upper(): s for s in SEASON_DEFINITIONS}
SEASON_IDS = [sid for sid in SEASON_LOOKUP.keys() if sid]
LATEST_SEASON = SEASON_IDS[-1] if SEASON_IDS else ""


def _normalize_season(season: Optional[str]) -> Optional[str]:
    if not season:
        return None
    key = str(season).strip().upper()
    if not key:
        return None
    if key in SEASON_LOOKUP:
        return key
    return None


BRICK_SEASON_FALLBACK = "UNASSIGNED"


def _brick_season_key(season: Optional[str]) -> str:
    key = _normalize_season(season)
    if key:
        return key
    return BRICK_SEASON_FALLBACK


def _season_display_name(season: str) -> str:
    if not season or season == BRICK_SEASON_FALLBACK:
        return "未标记赛季"
    entry = SEASON_LOOKUP.get(season.upper())
    return entry.get("name", season) if entry else season


def _ensure_brick_balance_row(db: Session, user_id: int, season_key: str) -> UserBrickBalance:
    row = db.query(UserBrickBalance).filter_by(user_id=user_id, season=season_key).first()
    if row:
        return row
    existing = db.query(UserBrickBalance).filter_by(user_id=user_id).count()
    if existing == 0:
        user = db.query(User).filter_by(id=user_id).first()
        if user:
            fallback_row = UserBrickBalance(
                user_id=user_id,
                season=BRICK_SEASON_FALLBACK,
                quantity=int(user.unopened_bricks or 0),
                gift_locked=int(user.gift_unopened_bricks or 0),
            )
            db.add(fallback_row)
            db.flush()
            if season_key == BRICK_SEASON_FALLBACK:
                return fallback_row
    row = UserBrickBalance(user_id=user_id, season=season_key, quantity=0, gift_locked=0)
    db.add(row)
    db.flush()
    return row


def grant_user_bricks(
    db: Session,
    user: User,
    season: Optional[str],
    quantity: int,
    gift_locked: int = 0,
    lock_quota: bool = False,
) -> None:
    qty = int(quantity or 0)
    if qty <= 0:
        return
    key = _brick_season_key(season)
    row = _ensure_brick_balance_row(db, user.id, key)
    row.quantity = int(row.quantity or 0) + qty
    user.unopened_bricks = int(user.unopened_bricks or 0) + qty
    if gift_locked > 0:
        row.gift_locked = int(row.gift_locked or 0) + int(gift_locked)
        user.gift_unopened_bricks = int(user.gift_unopened_bricks or 0) + int(gift_locked)
        if lock_quota:
            user.gift_brick_quota = int(user.gift_brick_quota or 0) + int(gift_locked)


def consume_user_bricks(
    db: Session,
    user: User,
    season: Optional[str],
    quantity: int,
    allow_gift: bool = True,
) -> int:
    qty = int(quantity or 0)
    if qty <= 0:
        return 0
    key = _brick_season_key(season)
    row = _ensure_brick_balance_row(db, user.id, key)
    total = int(row.quantity or 0)
    if total < qty:
        raise HTTPException(400, "该赛季未开砖数量不足")
    gift_used = 0
    if allow_gift:
        gift_used = min(int(row.gift_locked or 0), qty)
    else:
        unlocked = total - int(row.gift_locked or 0)
        if unlocked < qty:
            raise HTTPException(400, "赠送砖不可出售")
    row.quantity = max(0, total - qty)
    user.unopened_bricks = max(0, int(user.unopened_bricks or 0) - qty)
    if allow_gift and gift_used > 0:
        row.gift_locked = max(0, int(row.gift_locked or 0) - gift_used)
        user.gift_unopened_bricks = max(0, int(user.gift_unopened_bricks or 0) - gift_used)
    return gift_used


def reserve_user_bricks(db: Session, user: User, season: Optional[str], quantity: int) -> None:
    qty = int(quantity or 0)
    if qty <= 0:
        return
    key = _brick_season_key(season)
    row = _ensure_brick_balance_row(db, user.id, key)
    total = int(row.quantity or 0)
    unlocked = total - int(row.gift_locked or 0)
    if unlocked < qty:
        raise HTTPException(400, "该赛季可售砖不足")
    row.quantity = max(0, total - qty)
    user.unopened_bricks = max(0, int(user.unopened_bricks or 0) - qty)


def release_reserved_bricks(db: Session, user: User, season: Optional[str], quantity: int) -> None:
    qty = int(quantity or 0)
    if qty <= 0:
        return
    key = _brick_season_key(season)
    row = _ensure_brick_balance_row(db, user.id, key)
    row.quantity = int(row.quantity or 0) + qty
    user.unopened_bricks = int(user.unopened_bricks or 0) + qty


def get_user_brick_balances(db: Session, user_id: int) -> Dict[str, Dict[str, int]]:
    rows = db.query(UserBrickBalance).filter_by(user_id=user_id).all()
    data: Dict[str, Dict[str, int]] = {}
    for row in rows:
        key = row.season or BRICK_SEASON_FALLBACK
        data[key] = {
            "quantity": int(row.quantity or 0),
            "gift_locked": int(row.gift_locked or 0),
        }
    return data


def brick_balance_detail(db: Session, user_id: int) -> List[Dict[str, Any]]:
    balances = get_user_brick_balances(db, user_id)
    detail: List[Dict[str, Any]] = []
    ordered = list(SEASON_IDS)
    if BRICK_SEASON_FALLBACK in balances:
        ordered.append(BRICK_SEASON_FALLBACK)
    else:
        ordered.append(BRICK_SEASON_FALLBACK)
    seen = set()
    for season in ordered:
        if season in seen:
            continue
        seen.add(season)
        info = balances.get(season)
        if not info:
            continue
        detail.append({
            "season": "" if season == BRICK_SEASON_FALLBACK else season,
            "season_key": season,
            "name": _season_display_name(season),
            "count": info["quantity"],
            "gift_locked": info["gift_locked"],
        })
    # Include any extra seasons not in SEASON_IDS
    for season, info in balances.items():
        if season in seen:
            continue
        detail.append({
            "season": "" if season == BRICK_SEASON_FALLBACK else season,
            "season_key": season,
            "name": _season_display_name(season),
            "count": info["quantity"],
            "gift_locked": info["gift_locked"],
        })
    return detail


def require_season(season: Optional[str]) -> str:
    key = _normalize_season(season)
    if not key:
        raise HTTPException(400, "赛季无效")
    return key


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

# ---- Visual Generator ----
COLOR_PALETTE = [
    {"hex": "#f06449", "name": "熔岩橙"},
    {"hex": "#f9a620", "name": "流金黄"},
    {"hex": "#ffd166", "name": "暖阳金"},
    {"hex": "#ff6b6b", "name": "燃焰红"},
    {"hex": "#ef476f", "name": "曦粉"},
    {"hex": "#5b5f97", "name": "紫曜蓝"},
    {"hex": "#577590", "name": "风暴蓝"},
    {"hex": "#118ab2", "name": "极地蓝"},
    {"hex": "#06d6a0", "name": "量子绿"},
    {"hex": "#0ead69", "name": "热带绿"},
    {"hex": "#26547c", "name": "暗夜蓝"},
    {"hex": "#4cc9f0", "name": "星辉青"},
    {"hex": "#845ec2", "name": "霓虹紫"},
    {"hex": "#ff9671", "name": "霞光橘"},
    {"hex": "#ffc75f", "name": "琥珀金"},
    {"hex": "#d65db1", "name": "星云粉"},
    {"hex": "#4b8b3b", "name": "密林绿"},
    {"hex": "#8c7ae6", "name": "暮光紫"},
    {"hex": "#2f4858", "name": "石墨蓝"},
]

BRICK_TEMPLATES = {
    "brick_normal",
    "brick_white_diamond",
    "brick_yellow_diamond",
    "brick_pink_diamond",
    "brick_brushed_metal",
    "brick_laser_gradient",
    "brick_prism_spectrum",
    "brick_medusa_relic",
    "brick_arcade_crystal",
    "brick_arcade_serpent",
    "brick_arcade_blackhawk",
    "brick_arcade_champion",
    "brick_arcade_default",
    "brick_fate_strawberry",
    "brick_fate_blueberry",
    "brick_fate_goldenberry",
    "brick_fate_metal",
    "brick_fate_brass",
    "brick_fate_gold",
    "brick_fate_jade",
    "brick_fate_whitepeach",
    "brick_fate_gradient",
    "brick_fate_default",
    "brick_blade_royal",
    "brick_weather_gundam",
    "brick_weather_clathrate",
    "brick_weather_redbolt",
    "brick_weather_purplebolt",
    "brick_weather_gradient",
    "brick_weather_default",
    "brick_prism2_flux",
}
BRICK_TEMPLATE_LABELS = {
    "brick_normal": "标准模板",
    "brick_white_diamond": "白钻模板",
    "brick_yellow_diamond": "黄钻模板",
    "brick_pink_diamond": "粉钻模板",
    "brick_brushed_metal": "金属拉丝",
    "brick_laser_gradient": "镭射渐变",
    "brick_prism_spectrum": "棱镜光谱",
    "brick_medusa_relic": "蛇神遗痕",
    "brick_arcade_crystal": "水晶贪吃蛇",
    "brick_arcade_serpent": "贪吃蛇",
    "brick_arcade_blackhawk": "黑鹰坠落",
    "brick_arcade_champion": "拳王",
    "brick_arcade_default": "电玩标准",
    "brick_fate_strawberry": "草莓金",
    "brick_fate_blueberry": "蓝莓玉",
    "brick_fate_goldenberry": "金莓",
    "brick_fate_metal": "命运金属",
    "brick_fate_brass": "黄铜浮雕",
    "brick_fate_gold": "黄金流光",
    "brick_fate_jade": "翡翠绿",
    "brick_fate_whitepeach": "白桃",
    "brick_fate_gradient": "命运渐变",
    "brick_fate_default": "命运经典",
    "brick_blade_royal": "王牌镶嵌",
    "brick_weather_gundam": "高达气象",
    "brick_weather_clathrate": "可燃冰",
    "brick_weather_redbolt": "红电",
    "brick_weather_purplebolt": "紫电",
    "brick_weather_gradient": "气象渐变",
    "brick_weather_default": "气象标准",
    "brick_prism2_flux": "棱镜攻势2",
}
EXQUISITE_ONLY_TEMPLATES = {
    "brick_white_diamond",
    "brick_yellow_diamond",
    "brick_pink_diamond",
    "brick_brushed_metal",
    "brick_arcade_crystal",
    "brick_arcade_serpent",
    "brick_arcade_blackhawk",
    "brick_arcade_champion",
    "brick_fate_strawberry",
    "brick_fate_blueberry",
    "brick_fate_goldenberry",
    "brick_fate_metal",
    "brick_fate_brass",
    "brick_fate_gold",
    "brick_fate_jade",
    "brick_fate_whitepeach",
    "brick_weather_gundam",
    "brick_weather_clathrate",
    "brick_weather_redbolt",
    "brick_weather_purplebolt",
}
DIAMOND_TEMPLATE_KEYS = {
    "brick_white_diamond",
    "brick_yellow_diamond",
    "brick_pink_diamond",
}
SPECIAL_PRICE_TEMPLATES = DIAMOND_TEMPLATE_KEYS | {
    "brick_brushed_metal",
    "brick_prism_spectrum",
    "brick_medusa_relic",
    "brick_arcade_crystal",
    "brick_arcade_serpent",
    "brick_arcade_blackhawk",
    "brick_arcade_champion",
    "brick_fate_strawberry",
    "brick_fate_blueberry",
    "brick_fate_goldenberry",
    "brick_fate_metal",
    "brick_fate_brass",
    "brick_fate_gold",
    "brick_fate_jade",
    "brick_fate_whitepeach",
    "brick_weather_gundam",
    "brick_weather_clathrate",
    "brick_weather_redbolt",
    "brick_weather_purplebolt",
    "brick_prism2_flux",
}

COLOR_NAME_MAP = {c["hex"].lower(): c["name"] for c in COLOR_PALETTE}


def _normalize_hex(value: Any) -> str:
    if value is None:
        return ""
    s = str(value).strip()
    if not s:
        return ""
    if not s.startswith("#"):
        s = "#" + s
    if len(s) not in (4, 7):
        return ""
    try:
        int(s[1:], 16)
    except ValueError:
        return ""
    return s.lower()


def _color_entry(value: Any) -> Optional[Dict[str, str]]:
    if isinstance(value, dict):
        hex_raw = value.get("hex") or value.get("color") or value.get("value")
        name = value.get("name") or value.get("label")
    else:
        hex_raw = value
        name = None
    hex_val = _normalize_hex(hex_raw)
    if not hex_val:
        return None
    if not name:
        name = COLOR_NAME_MAP.get(hex_val, hex_val)
    return {"hex": hex_val, "name": name}


def _resolve_palette(options: Any) -> List[Dict[str, str]]:
    if not options:
        return []
    if isinstance(options, list):
        choice = secrets.choice(options)
    else:
        choice = options
    if isinstance(choice, list):
        colors = []
        for item in choice:
            entry = _color_entry(item)
            if entry:
                colors.append(entry)
        return colors
    entry = _color_entry(choice)
    return [entry] if entry else []


def _unique_list(items: List[str]) -> List[str]:
    seen = set()
    out: List[str] = []
    for item in items:
        if not item:
            continue
        key = str(item)
        if key in seen:
            continue
        seen.add(key)
        out.append(key)
    return out


def skin_meta_dict(skin: Optional[Skin]) -> Dict[str, Any]:
    if not skin:
        return {}
    raw = getattr(skin, "meta", None)
    if not raw:
        return {}
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            return data
    except Exception:
        return {}
    return {}


def default_brick_template(exquisite: bool) -> str:
    roll = secrets.randbelow(10000)
    if exquisite:
        if roll < 100:
            trio = ["brick_white_diamond", "brick_yellow_diamond", "brick_pink_diamond"]
            return trio[secrets.randbelow(len(trio))]
        if roll < 600:
            return "brick_brushed_metal"
        if roll < 1600:
            return "brick_laser_gradient"
        return "brick_normal"
    if roll < 1000:
        return "brick_laser_gradient"
    return "brick_normal"

def _pick_color() -> Dict[str, str]:
    base = secrets.choice(COLOR_PALETTE)
    return {"hex": base["hex"], "name": base["name"]}

def generate_visual_profile(
    rarity: str,
    exquisite: bool,
    *,
    model_key: str = "",
    skin: Optional[Skin] = None,
) -> Dict[str, object]:
    rarity = (rarity or "").upper()
    meta = skin_meta_dict(skin)
    model = model_key or (skin.model_key if skin else "") or "assault"

    body = _resolve_palette(meta.get("body_colors"))
    if not body:
        layers = 2 if secrets.randbelow(100) < 55 else 1
        body = [_pick_color() for _ in range(layers)]

    attachments = _resolve_palette(meta.get("attachment_colors"))
    if not attachments:
        attachments = [_pick_color()]

    template_key = ""
    hidden_template = False
    effects: List[str] = []

    if rarity == "BRICK":
        rule = None
        template_rules = meta.get("template_rules")
        if template_rules:
            pool: List[Tuple[Dict[str, Any], int]] = []
            for rule_entry in template_rules:
                allow_exq = rule_entry.get("allow_exquisite", True)
                allow_prem = rule_entry.get("allow_premium", True)
                if exquisite and not allow_exq:
                    continue
                if not exquisite and not allow_prem:
                    continue
                weight = int(rule_entry.get("weight", 1) or 0)
                if weight <= 0:
                    continue
                pool.append((rule_entry, weight))
            if pool:
                total = sum(weight for _, weight in pool)
                pick = secrets.randbelow(total)
                cursor = 0
                for rule_entry, weight in pool:
                    cursor += weight
                    if pick < cursor:
                        rule = rule_entry
                        break
        if rule:
            template_key = str(rule.get("key") or "")
            hidden_template = bool(rule.get("hidden", False))
            chosen_body = _resolve_palette(rule.get("body"))
            if chosen_body:
                body = chosen_body
            chosen_att = _resolve_palette(rule.get("attachments"))
            if chosen_att:
                attachments = chosen_att
            effects.extend(rule.get("effects", []))
        else:
            template_key = default_brick_template(bool(exquisite))
        effects.append("sheen")
        extra = meta.get("extra_effects", {})
        if exquisite:
            effects.extend(["bold_tracer", "kill_counter"])
            effects.extend(extra.get("exquisite", []))
        else:
            effects.extend(extra.get("premium", []))
    else:
        eff_conf = meta.get("effects")
        if isinstance(eff_conf, dict):
            key = "exquisite" if exquisite else "premium"
            effects.extend(eff_conf.get(key, []))
        elif isinstance(eff_conf, list):
            effects.extend(eff_conf)

    effects = _unique_list(effects)

    return {
        "body": body,
        "attachments": attachments,
        "template": template_key,
        "hidden_template": hidden_template,
        "effects": effects,
        "model": model,
    }


@app.get("/seasons/catalog")
def seasons_catalog():
    seasons_payload = []
    for season in SEASON_DEFINITIONS:
        season_id = season.get("id", "")
        entry = {
            "id": season_id,
            "name": season.get("name", season_id),
            "tagline": season.get("tagline", ""),
            "description": season.get("description", ""),
        }
        for group in ("bricks", "purples", "blues", "greens"):
            skins_payload = []
            for skin in season.get(group, []) or []:
                meta = skin.get("meta", {}) or {}
                skins_payload.append({
                    "skin_id": skin.get("skin_id", ""),
                    "name": skin.get("name", ""),
                    "weapon": skin.get("weapon", ""),
                    "rarity": skin.get("rarity", ""),
                    "model": skin.get("model_key", ""),
                    "description": meta.get("description", ""),
                    "tracer": meta.get("tracer", ""),
                    "templates": meta.get("template_rules", []),
                    "effects": meta.get("extra_effects") or meta.get("effects", {}),
                })
            entry[group] = skins_payload
        seasons_payload.append(entry)
    return {"seasons": seasons_payload, "latest": LATEST_SEASON}


def _load_json_field(raw: str, default):
    if not raw:
        return default
    try:
        return json.loads(raw)
    except Exception:
        return default

def ensure_visual(inv: Inventory, skin: Optional[Skin] = None) -> Dict[str, object]:
    body = _load_json_field(inv.body_colors, [])
    attachments = _load_json_field(inv.attachment_colors, [])
    effects = _load_json_field(inv.effect_tags, [])
    template = inv.template_name or ""
    hidden_template = bool(inv.hidden_template)
    changed = False

    rarity = (inv.rarity or "").upper()
    model_key = inv.model_key or ""
    if not model_key and skin:
        model_key = skin.model_key or ""

    if rarity == "BRICK":
        if not body or not attachments or template not in BRICK_TEMPLATES:
            profile = generate_visual_profile(inv.rarity, bool(inv.exquisite), model_key=model_key, skin=skin)
            body = profile["body"]
            attachments = profile["attachments"]
            template = profile["template"]
            effects = profile["effects"]
            hidden_template = False
            inv.body_colors = json.dumps(body, ensure_ascii=False)
            inv.attachment_colors = json.dumps(attachments, ensure_ascii=False)
            inv.template_name = template
            inv.effect_tags = json.dumps(effects, ensure_ascii=False)
            inv.hidden_template = 0
            inv.model_key = profile.get("model", model_key)
            model_key = inv.model_key
            changed = True
        if not bool(inv.exquisite) and template in EXQUISITE_ONLY_TEMPLATES:
            profile = generate_visual_profile(inv.rarity, False, model_key=model_key, skin=skin)
            body = profile["body"]
            attachments = profile["attachments"]
            template = profile["template"]
            effects = profile["effects"]
            hidden_template = False
            inv.body_colors = json.dumps(body, ensure_ascii=False)
            inv.attachment_colors = json.dumps(attachments, ensure_ascii=False)
            inv.template_name = template
            inv.effect_tags = json.dumps(effects, ensure_ascii=False)
            inv.hidden_template = 0
            inv.model_key = profile.get("model", model_key)
            model_key = inv.model_key
            changed = True
        desired_effects = ["sheen"]
        if bool(inv.exquisite):
            desired_effects.extend(["bold_tracer", "kill_counter"])
        if effects != desired_effects:
            effects = desired_effects
            inv.effect_tags = json.dumps(desired_effects, ensure_ascii=False)
            changed = True
        if hidden_template:
            inv.hidden_template = 0
            hidden_template = False
            changed = True
    else:
        if not body or not attachments:
            profile = generate_visual_profile(inv.rarity, bool(inv.exquisite), model_key=model_key, skin=skin)
            body = profile["body"]
            attachments = profile["attachments"]
            inv.body_colors = json.dumps(body, ensure_ascii=False)
            inv.attachment_colors = json.dumps(attachments, ensure_ascii=False)
            inv.model_key = profile.get("model", model_key)
            model_key = inv.model_key
            changed = True
        if template:
            template = ""
            inv.template_name = ""
            changed = True
        if effects:
            effects = []
            inv.effect_tags = json.dumps([], ensure_ascii=False)
            changed = True
        if hidden_template:
            inv.hidden_template = 0
            hidden_template = False
            changed = True
        if skin and (inv.model_key or "") != (skin.model_key or ""):
            inv.model_key = skin.model_key or ""
            model_key = inv.model_key
            changed = True

    return {
        "body": body,
        "attachments": attachments,
        "template": template,
        "hidden_template": hidden_template,
        "effects": effects,
        "model": model_key,
        "changed": changed,
    }


# ------------------ Cookie Factory Mini-game ------------------
COOKIE_FACTORY_SETTING_KEY = "cookie_factory_enabled"
COOKIE_WEEKLY_CAP = 100
COOKIE_DELTA_BONUS = 0.05
COOKIE_DELTA_BONUS_CAP = 1.25
COOKIE_SUGAR_COOLDOWN = 6 * 3600
COOKIE_DAILY_CHALLENGE_TARGET = 120

COOKIE_BUILDINGS = [
    {
        "key": "cursor",
        "name": "光标",
        "icon": "🖱️",
        "base_cost": 15,
        "cost_mult": 1.15,
        "base_cps": 0.1,
        "desc": "最基础的自动点击器，帮你轻点饼干。",
    },
    {
        "key": "grandma",
        "name": "奶奶",
        "icon": "👵",
        "base_cost": 100,
        "cost_mult": 1.18,
        "base_cps": 1.0,
        "desc": "慈祥的奶奶专注烤炉，带来稳定产能。",
    },
    {
        "key": "factory",
        "name": "工厂",
        "icon": "🏭",
        "base_cost": 500,
        "cost_mult": 1.2,
        "base_cps": 8.0,
        "desc": "自动化生产线滚滚冒出新鲜饼干。",
    },
    {
        "key": "mine",
        "name": "矿井",
        "icon": "⛏️",
        "base_cost": 2000,
        "cost_mult": 1.22,
        "base_cps": 47.0,
        "desc": "从饼干岩层里采掘甜蜜原料。",
    },
    {
        "key": "portal",
        "name": "时空传送门",
        "icon": "🌀",
        "base_cost": 7000,
        "cost_mult": 1.25,
        "base_cps": 260.0,
        "desc": "链接异世界，让饼干跨维度奔涌。",
    },
    {
        "key": "time_machine",
        "name": "时光机",
        "icon": "⏱️",
        "base_cost": 40000,
        "cost_mult": 1.3,
        "base_cps": 1400.0,
        "desc": "倒转时间，在过去和未来同时烤饼干。",
    },
]

COOKIE_MINI_GAMES = {
    "garden": {
        "name": "花园",
        "icon": "🌱",
        "points": 6,
        "threshold": 4,
        "cps_bonus": 0.01,
        "sugar_cost": 1,
        "desc": "种植奇妙植物，消耗 1 颗糖块培育，偶尔触发灵感加成。",
    },
    "temple": {
        "name": "神殿",
        "icon": "⛪",
        "points": 5,
        "threshold": 5,
        "cps_bonus": 0.008,
        "sugar_cost": 1,
        "desc": "在神殿供奉饼干，需要 1 颗糖块祈福，祈求产量祝福。",
    },
    "market": {
        "name": "证券市场",
        "icon": "📈",
        "points": 4,
        "threshold": 6,
        "cps_bonus": 0.012,
        "sugar_cost": 2,
        "desc": "做一笔甜蜜交易，投入 2 颗糖块换取收益效率。",
    },
}


def _json_object(raw: str, default: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    if default is None:
        default = {}
    if not raw:
        return dict(default)
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            return data
    except Exception:
        pass
    return dict(default)


def _json_dump(data: Dict[str, Any]) -> str:
    return json.dumps(data, ensure_ascii=False)


def cookie_factory_enabled(db: Session) -> bool:
    row = db.query(SystemSetting).filter_by(key=COOKIE_FACTORY_SETTING_KEY).first()
    if not row:
        return True
    return str(row.value) != "0"


def set_cookie_factory_enabled(db: Session, enabled: bool) -> None:
    value = "1" if enabled else "0"
    row = db.query(SystemSetting).filter_by(key=COOKIE_FACTORY_SETTING_KEY).first()
    if row:
        row.value = value
    else:
        db.add(SystemSetting(key=COOKIE_FACTORY_SETTING_KEY, value=value))
    db.flush()


def cookie_week_start(ts: Optional[int] = None) -> int:
    if ts is None:
        ts = int(time.time())
    dt = datetime.fromtimestamp(ts)
    monday = dt - timedelta(days=dt.weekday())
    start = monday.replace(hour=0, minute=0, second=0, microsecond=0)
    return int(start.timestamp())


def cookie_day_start(ts: Optional[int] = None) -> int:
    if ts is None:
        ts = int(time.time())
    dt = datetime.fromtimestamp(ts)
    start = dt.replace(hour=0, minute=0, second=0, microsecond=0)
    return int(start.timestamp())


def cookie_day_key(ts: Optional[int] = None) -> str:
    if ts is None:
        ts = int(time.time())
    return datetime.fromtimestamp(ts).strftime("%Y-%m-%d")


def cookie_trim_map(data: Dict[str, Any], keep: int = 14) -> Dict[str, Any]:
    if not data:
        return {}
    items = sorted(data.items(), key=lambda kv: kv[0])
    if len(items) <= keep:
        return dict(items)
    return dict(items[-keep:])


def cookie_mini_games_state(profile: CookieFactoryProfile) -> Dict[str, Any]:
    state = _json_object(profile.mini_games, {})
    changed = False
    for key, cfg in COOKIE_MINI_GAMES.items():
        node = state.get(key)
        if not isinstance(node, dict):
            node = {"level": 0, "progress": 0}
            changed = True
        else:
            node.setdefault("level", 0)
            node.setdefault("progress", 0)
        node.setdefault("last_action", 0)
        state[key] = node
    if changed:
        profile.mini_games = _json_dump(state)
    return state


def cookie_building_counts(profile: CookieFactoryProfile) -> Dict[str, int]:
    raw = _json_object(profile.buildings, {})
    counts: Dict[str, int] = {}
    for cfg in COOKIE_BUILDINGS:
        key = cfg["key"]
        counts[key] = int(raw.get(key, 0) or 0)
    return counts


def cookie_store_buildings(profile: CookieFactoryProfile, counts: Dict[str, int]) -> None:
    profile.buildings = _json_dump({k: int(v) for k, v in counts.items()})


def cookie_building_cost(key: str, count: int) -> int:
    cfg = next((c for c in COOKIE_BUILDINGS if c["key"] == key), None)
    if not cfg:
        return 0
    base = float(cfg.get("base_cost", 0))
    mult = float(cfg.get("cost_mult", 1.0))
    cost = base * (mult ** count)
    return int(math.ceil(cost))


def cookie_cps(profile: CookieFactoryProfile, counts: Optional[Dict[str, int]] = None) -> Tuple[float, float]:
    if counts is None:
        counts = cookie_building_counts(profile)
    base_cps = 0.0
    for cfg in COOKIE_BUILDINGS:
        key = cfg["key"]
        base_cps += float(cfg.get("base_cps", 0.0)) * counts.get(key, 0)
    prestige_bonus = 1.0 + (float(profile.prestige_points or 0) * 0.05) + (float(profile.prestige or 0) * 0.02)
    mini_state = cookie_mini_games_state(profile)
    mini_bonus = 1.0
    for key, node in mini_state.items():
        cfg = COOKIE_MINI_GAMES.get(key)
        if not cfg:
            continue
        lvl = int(node.get("level", 0) or 0)
        mini_bonus += lvl * float(cfg.get("cps_bonus", 0.0))
    cps = base_cps * prestige_bonus * mini_bonus
    effective = cps * float(profile.production_bonus_multiplier or 1.0) * float(profile.penalty_multiplier or 1.0)
    return cps, effective


def cookie_click_gain(profile: CookieFactoryProfile, clicks: int, counts: Optional[Dict[str, int]] = None) -> float:
    if clicks <= 0:
        return 0.0
    if counts is None:
        counts = cookie_building_counts(profile)
    base = 1.0 + (profile.manual_clicks or 0) * 0.002
    helper = sum(counts.values()) * 0.05
    prestige_bonus = 1.0 + (float(profile.prestige_points or 0) * 0.05)
    total = clicks * base * (1.0 + helper) * prestige_bonus
    total *= float(profile.production_bonus_multiplier or 1.0) * float(profile.penalty_multiplier or 1.0)
    return total


def cookie_add(profile: CookieFactoryProfile, amount: float) -> float:
    if amount <= 0:
        return 0.0
    profile.total_cookies += amount
    profile.cookies_this_week += amount
    profile.banked_cookies += amount
    return amount


def cookie_spend(profile: CookieFactoryProfile, amount: float) -> None:
    if amount <= 0:
        return
    if profile.banked_cookies < amount:
        raise HTTPException(400, "饼干数量不足")
    profile.banked_cookies -= amount


def cookie_add_active_points(profile: CookieFactoryProfile, now: int, points: int) -> None:
    if points <= 0:
        return
    day = cookie_day_key(now)
    data = _json_object(profile.active_points, {})
    data[day] = int(data.get(day, 0) or 0) + int(points)
    data = cookie_trim_map(data, keep=21)
    profile.active_points = _json_dump(data)


def cookie_register_login(profile: CookieFactoryProfile, now: int) -> Dict[str, Any]:
    day = cookie_day_key(now)
    already = (profile.last_login_day or "") == day
    changed = False
    penalty_triggered = False
    if not already:
        prev_day = profile.last_login_day or ""
        if prev_day:
            try:
                prev_dt = datetime.strptime(prev_day, "%Y-%m-%d")
                curr_dt = datetime.strptime(day, "%Y-%m-%d")
                diff = (curr_dt - prev_dt).days
            except Exception:
                diff = 0
            if diff == 1:
                profile.login_streak = int(profile.login_streak or 0) + 1
            elif diff > 1:
                profile.login_streak = 1
                penalty_triggered = True
                current = float(profile.pending_penalty_multiplier or 1.0)
                profile.pending_penalty_multiplier = min(current, 0.7)
            else:
                profile.login_streak = 1
        else:
            profile.login_streak = 1
        profile.last_login_day = day
        changed = True
        days = _json_object(profile.login_days, {})
        days[day] = {"ts": cookie_day_start(now)}
        days = cookie_trim_map(days, keep=21)
        profile.login_days = _json_dump(days)
    streak = int(profile.login_streak or 0)
    if changed:
        message = f"今日签到成功，连续登录 {streak} 天"
    else:
        if already:
            message = f"今日已签到，当前连续 {streak} 天"
        else:
            message = "今日签到状态未变"
    if penalty_triggered:
        message += "（因断档触发效率下调）"
    return {
        "added": changed,
        "already": already,
        "streak": streak,
        "penalty_triggered": penalty_triggered,
        "message": message,
    }


def cookie_calculate_base_bricks(total_cookies: float) -> int:
    if total_cookies <= 0:
        return 0
    scale = total_cookies / 100_000_000
    if scale < 1:
        return 0
    raw = scale ** 0.92
    bricks = int(math.floor(raw))
    return max(1, bricks)


def cookie_active_bricks(active_points: Dict[str, int]) -> int:
    total = 0
    for points in active_points.values():
        pts = int(points or 0)
        total += min(10, pts // 10)
    return total


def cookie_login_bricks(login_days: Dict[str, Any]) -> int:
    return len(login_days.keys()) * 2


def cookie_weekly_progress(
    profile: CookieFactoryProfile,
) -> Tuple[
    int,
    int,
    int,
    int,
    int,
    int,
    int,
    Dict[str, int],
    Dict[str, Any],
]:
    active_map_raw = _json_object(profile.active_points, {})
    active_map = {k: int(v) for k, v in active_map_raw.items()}
    login_days = _json_object(profile.login_days, {})
    base_bricks = cookie_calculate_base_bricks(float(profile.cookies_this_week or 0.0))
    active_bricks = cookie_active_bricks(active_map)
    login_bricks = cookie_login_bricks(login_days)
    streak_bonus = 14 if int(profile.login_streak or 0) >= 7 else 0
    projected = base_bricks + active_bricks + login_bricks + streak_bonus
    projected = min(COOKIE_WEEKLY_CAP, max(0, projected))
    claimed_raw = int(getattr(profile, "claimed_bricks_this_week", 0) or 0)
    claimed = max(0, min(projected, min(COOKIE_WEEKLY_CAP, claimed_raw)))
    claimable = max(0, projected - claimed)
    return (
        base_bricks,
        active_bricks,
        login_bricks,
        streak_bonus,
        projected,
        claimed,
        claimable,
        active_map,
        login_days,
    )


def cookie_challenge_map(profile: CookieFactoryProfile) -> Dict[str, int]:
    return {k: int(v or 0) for k, v in _json_object(getattr(profile, "challenge_clicks", "{}"), {}).items()}


def cookie_challenge_today(profile: CookieFactoryProfile, now: int) -> int:
    day = cookie_day_key(now)
    data = cookie_challenge_map(profile)
    return int(data.get(day, 0) or 0)


def cookie_challenge_increment(profile: CookieFactoryProfile, now: int, amount: int) -> int:
    if amount <= 0:
        return cookie_challenge_today(profile, now)
    day = cookie_day_key(now)
    data = cookie_challenge_map(profile)
    data[day] = int(data.get(day, 0) or 0) + int(amount)
    data = cookie_trim_map(data, keep=21)
    profile.challenge_clicks = _json_dump(data)
    return int(data.get(day, 0) or 0)


def ensure_cookie_profile(db: Session, user: User, now: Optional[int] = None) -> CookieFactoryProfile:
    if now is None:
        now = int(time.time())
    profile = db.query(CookieFactoryProfile).filter_by(user_id=user.id).first()
    if not profile:
        profile = CookieFactoryProfile(
            user_id=user.id,
            week_start_ts=cookie_week_start(now),
            last_active_ts=now,
            golden_ready_ts=now + 120,
            golden_cooldown=120,
            production_bonus_multiplier=1.0,
            pending_bonus_multiplier=1.0,
            penalty_multiplier=1.0,
            pending_penalty_multiplier=1.0,
            banked_cookies=0.0,
            last_sugar_ts=now,
        )
        db.add(profile)
        db.flush()
        cookie_mini_games_state(profile)
    return profile


def cookie_prepare_week(profile: CookieFactoryProfile, now: int) -> None:
    current_week = cookie_week_start(now)
    if profile.week_start_ts == 0:
        profile.week_start_ts = current_week
        profile.production_bonus_multiplier = float(profile.pending_bonus_multiplier or 1.0)
        profile.penalty_multiplier = float(profile.pending_penalty_multiplier or 1.0)
        profile.pending_bonus_multiplier = 1.0
        profile.pending_penalty_multiplier = 1.0
        profile.claimed_bricks_this_week = 0
    elif profile.week_start_ts < current_week:
        profile.week_start_ts = current_week
        profile.cookies_this_week = 0.0
        profile.weekly_bricks_awarded = 0
        profile.active_points = _json_dump({})
        profile.login_days = _json_dump({})
        profile.production_bonus_multiplier = float(profile.pending_bonus_multiplier or 1.0)
        profile.penalty_multiplier = float(profile.pending_penalty_multiplier or 1.0)
        profile.pending_bonus_multiplier = 1.0
        profile.pending_penalty_multiplier = 1.0
        profile.claimed_bricks_this_week = 0


def cookie_finalize_week(db: Session, profile: CookieFactoryProfile, user: User, now: int) -> Optional[Dict[str, Any]]:
    if profile.week_start_ts == 0:
        return None
    (
        base_bricks,
        active_brick,
        login_brick,
        streak_bonus,
        projected,
        claimed,
        claimable,
        active_map,
        login_map,
    ) = cookie_weekly_progress(profile)
    auto_claimed = 0
    awarded = claimed
    if claimable > 0:
        auto_claimed = claimable
        awarded += claimable
        claimed += claimable
        user.unopened_bricks += claimable
        profile.total_bricks_earned += claimable
    profile.weekly_bricks_awarded = int(awarded)
    report = {
        "week_start": profile.week_start_ts,
        "week_end": profile.week_start_ts + 7 * 86400,
        "awarded": awarded,
        "base_bricks": base_bricks,
        "active_bricks": active_brick,
        "login_bricks": login_brick,
        "streak_bonus": streak_bonus,
        "projected": projected,
        "claimed": claimed,
        "auto_claimed": auto_claimed,
        "total_cookies": float(profile.cookies_this_week or 0.0),
        "penalty_multiplier": float(profile.penalty_multiplier or 1.0),
        "bonus_multiplier": float(profile.production_bonus_multiplier or 1.0),
        "timestamp": now,
    }
    profile.last_report = json.dumps(report, ensure_ascii=False)
    profile.cookies_this_week = 0.0
    profile.active_points = _json_dump({})
    profile.login_days = _json_dump({})
    profile.claimed_bricks_this_week = 0
    profile.production_bonus_multiplier = 1.0
    profile.penalty_multiplier = 1.0
    return report


def cookie_maybe_settle(db: Session, profile: CookieFactoryProfile, user: User, now: int) -> Optional[Dict[str, Any]]:
    current_week = cookie_week_start(now)
    if profile.week_start_ts == 0:
        cookie_prepare_week(profile, now)
        return None
    if profile.week_start_ts < current_week:
        report = cookie_finalize_week(db, profile, user, now)
        profile.week_start_ts = current_week
        profile.production_bonus_multiplier = float(profile.pending_bonus_multiplier or 1.0)
        profile.penalty_multiplier = float(profile.pending_penalty_multiplier or 1.0)
        profile.pending_bonus_multiplier = 1.0
        profile.pending_penalty_multiplier = 1.0
        return report
    return None


def cookie_tick(profile: CookieFactoryProfile, now: int) -> float:
    last = int(profile.last_active_ts or 0)
    if last <= 0:
        profile.last_active_ts = now
        return 0.0
    delta = max(0, now - last)
    profile.last_active_ts = now
    if delta <= 0:
        return 0.0
    cps, effective = cookie_cps(profile)
    gain = effective * delta
    return cookie_add(profile, gain)


def cookie_status_payload(
    user: User,
    profile: CookieFactoryProfile,
    now: int,
    settlement: Optional[Dict[str, Any]] = None,
    feature_enabled: bool = True,
) -> Dict[str, Any]:
    counts = cookie_building_counts(profile)
    cps, effective_cps = cookie_cps(profile, counts)
    mini_state = cookie_mini_games_state(profile)
    (
        base_bricks,
        active_brick,
        login_brick,
        streak_bonus,
        projected,
        claimed,
        claimable,
        active_points,
        login_days,
    ) = cookie_weekly_progress(profile)
    today = cookie_day_key(now)
    daily_claimed = today in login_days
    last_report = None
    if profile.last_report:
        try:
            last_report = json.loads(profile.last_report)
        except Exception:
            last_report = None
    buildings_payload = []
    for cfg in COOKIE_BUILDINGS:
        key = cfg["key"]
        count = counts.get(key, 0)
        buildings_payload.append({
            "key": key,
            "name": cfg["name"],
            "icon": cfg["icon"],
            "count": count,
            "base_cps": cfg["base_cps"],
            "next_cost": cookie_building_cost(key, count),
            "desc": cfg["desc"],
        })
    mini_payload = []
    for key, cfg in COOKIE_MINI_GAMES.items():
        node = mini_state.get(key, {})
        mini_payload.append({
            "key": key,
            "name": cfg["name"],
            "icon": cfg["icon"],
            "level": int(node.get("level", 0)),
            "progress": int(node.get("progress", 0)),
            "threshold": int(cfg.get("threshold", 1)),
            "desc": cfg["desc"],
            "sugar_cost": int(cfg.get("sugar_cost", 0)),
            "points": int(cfg.get("points", 0)),
            "cps_bonus": float(cfg.get("cps_bonus", 0.0)),
        })
    active_breakdown = [
        {"day": day, "points": int(val)} for day, val in sorted(active_points.items())
    ]
    login_list = [
        {"day": day, "ts": info.get("ts", 0)} for day, info in sorted(login_days.items())
    ]
    challenge_map = cookie_challenge_map(profile)
    challenge_list = [
        {"day": day, "clicks": int(val)} for day, val in sorted(challenge_map.items())
    ]
    sugar_ready_in = max(0, (int(profile.last_sugar_ts or 0) + COOKIE_SUGAR_COOLDOWN) - now)
    golden_ready_in = max(0, int(profile.golden_ready_ts or 0) - now)
    today_challenge = int(challenge_map.get(today, 0) or 0)
    return {
        "enabled": bool(feature_enabled),
        "now": now,
        "profile": {
            "cookies": round(float(profile.banked_cookies or 0.0), 2),
            "cookies_this_week": round(float(profile.cookies_this_week or 0.0), 2),
            "total_cookies": round(float(profile.total_cookies or 0.0), 2),
            "manual_clicks": int(profile.manual_clicks or 0),
            "golden_cookies": int(profile.golden_cookies or 0),
            "prestige": int(profile.prestige or 0),
            "prestige_points": int(profile.prestige_points or 0),
            "sugar_lumps": int(profile.sugar_lumps or 0),
            "cps": round(cps, 3),
            "effective_cps": round(effective_cps, 3),
            "bonus_multiplier": round(float(profile.production_bonus_multiplier or 1.0), 3),
            "penalty_multiplier": round(float(profile.penalty_multiplier or 1.0), 3),
            "next_bonus_multiplier": round(float(profile.pending_bonus_multiplier or 1.0), 3),
            "next_penalty_multiplier": round(float(profile.pending_penalty_multiplier or 1.0), 3),
        },
        "buildings": buildings_payload,
        "mini_games": mini_payload,
        "weekly": {
            "week_start": profile.week_start_ts,
            "week_end": profile.week_start_ts + 7 * 86400,
            "base_bricks": base_bricks,
            "active_bricks": active_brick,
            "login_bricks": login_brick,
            "streak_bonus": streak_bonus,
            "projected_bricks": projected,
            "cap": COOKIE_WEEKLY_CAP,
            "cap_remaining": max(0, COOKIE_WEEKLY_CAP - projected),
            "claimed_bricks": claimed,
            "claimable_bricks": claimable,
            "active_points": active_breakdown,
            "login_days": login_list,
            "daily_login_claimed": daily_claimed,
            "login_streak": int(profile.login_streak or 0),
        },
        "challenge": {
            "target": COOKIE_DAILY_CHALLENGE_TARGET,
            "today": today_challenge,
            "remaining": max(0, COOKIE_DAILY_CHALLENGE_TARGET - today_challenge),
            "completed": today_challenge >= COOKIE_DAILY_CHALLENGE_TARGET,
            "history": challenge_list,
        },
        "golden": {
            "available": golden_ready_in <= 0,
            "cooldown": int(profile.golden_cooldown or 0),
            "ready_in": golden_ready_in,
        },
        "sugar": {
            "available": sugar_ready_in <= 0,
            "ready_in": sugar_ready_in,
            "cooldown": COOKIE_SUGAR_COOLDOWN,
        },
        "settlement": settlement,
        "last_report": last_report,
    }


def mark_cookie_delta_activity(db: Session, user_id: int) -> None:
    if not user_id:
        return
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        return
    profile = ensure_cookie_profile(db, user)
    current = float(profile.pending_bonus_multiplier or 1.0)
    bonus = min(COOKIE_DELTA_BONUS_CAP, current + COOKIE_DELTA_BONUS)
    if bonus > current:
        profile.pending_bonus_multiplier = bonus

def _clamp_brick_price(val: float) -> float:
    try:
        return max(40.0, min(150.0, float(val)))
    except Exception:
        return 100.0

def ensure_brick_market_state(db: Session, cfg: Optional[PoolConfig] = None) -> BrickMarketState:
    state = db.query(BrickMarketState).first()
    if not state:
        init_price = round(random.uniform(60, 120), 2)
        state = BrickMarketState(price=init_price, sentiment=0.0, last_update=int(time.time()))
        db.add(state)
        db.flush()
        if cfg is None:
            cfg = db.query(PoolConfig).first()
        if cfg:
            cfg.brick_price = max(40, min(150, int(round(init_price))))
    return state

def _sync_cfg_price(cfg: PoolConfig, state: BrickMarketState) -> int:
    unit = max(40, min(150, int(round(_clamp_brick_price(state.price)))))
    if cfg.brick_price != unit:
        cfg.brick_price = unit
    return unit

def apply_brick_market_influence(db: Session, cfg: PoolConfig, results: List[Dict[str, Any]]):
    state = ensure_brick_market_state(db, cfg)
    bricks = [r for r in results if str(r.get("rarity", "")).upper() == "BRICK"]
    score = 0.0
    for item in bricks:
        template = (item.get("template") or "").strip()
        if item.get("exquisite"):
            if template in SPECIAL_PRICE_TEMPLATES:
                score += 3.0
            else:
                score -= 1.2
        else:
            score -= 0.3
    noise = random.uniform(-1.2, 1.2)
    baseline_pull = (95.0 - state.price) * 0.04
    state.sentiment = state.sentiment * 0.88 + score
    new_price = state.price + state.sentiment * 0.24 + noise + baseline_pull
    state.price = _clamp_brick_price(new_price)
    state.last_update = int(time.time())
    _sync_cfg_price(cfg, state)

def brick_price_snapshot(db: Session, cfg: PoolConfig) -> Dict[str, float]:
    state = ensure_brick_market_state(db, cfg)
    state.sentiment *= 0.92
    drift = random.uniform(-0.8, 0.8) * 0.12
    state.price = _clamp_brick_price(state.price + drift)
    state.last_update = int(time.time())
    unit = _sync_cfg_price(cfg, state)
    return {"unit": unit, "raw": round(state.price, 2)}

def _season_brick_price(base_price: int, season: Optional[str]) -> int:
    key = _normalize_season(season)
    if not key:
        return max(40, min(150, base_price))
    latest_idx = len(SEASON_IDS) - 1
    try:
        idx = SEASON_IDS.index(key)
    except ValueError:
        idx = latest_idx
    step = latest_idx - idx
    price = base_price - step * 5
    if key == "S5":
        price = base_price + 6
    price = max(40, min(150, price))
    return price


def official_sell_layers(cfg: PoolConfig, state: BrickMarketState) -> List[Dict[str, Any]]:
    base_price = _sync_cfg_price(cfg, state)
    seed_val = int((state.last_update or int(time.time())) / 600) or 1
    rng = random.Random(seed_val)
    target_total = rng.randint(3000, 5000)
    seasons = list(SEASON_IDS) or [BRICK_SEASON_FALLBACK]
    layers: List[Dict[str, Any]] = []
    remaining = target_total
    rng.shuffle(seasons)
    for idx, season in enumerate(seasons):
        portion = max(0, target_total // len(seasons))
        jitter = rng.randint(-80, 120)
        qty = max(0, portion + jitter)
        if idx == len(seasons) - 1:
            qty = max(0, remaining)
        else:
            qty = min(qty, remaining)
        remaining -= qty
        if qty <= 0:
            continue
        price = _season_brick_price(base_price, season if season != BRICK_SEASON_FALLBACK else None)
        layers.append({
            "price": price,
            "quantity": qty,
            "priority": idx,
            "season": season,
        })
    if remaining > 0 and layers:
        layers[-1]["quantity"] += remaining
    layers.sort(key=lambda x: (x["price"], x.get("priority", 0)))
    return layers

def build_brick_histogram(layers: List[Dict[str, Any]], player_orders: List[BrickSellOrder], bucket_size: int = 10) -> List[Dict[str, Any]]:
    entries: List[Tuple[int, int]] = []
    for layer in layers:
        entries.append((int(layer.get("price", 0)), int(layer.get("quantity", 0))))
    for order in player_orders:
        entries.append((int(order.price), int(order.remaining)))
    entries = [(p, q) for (p, q) in entries if q > 0]
    if not entries:
        return []
    prices = [p for p, _ in entries]
    min_price = max(0, (min(prices) // bucket_size) * bucket_size)
    max_price = ((max(prices) // bucket_size) + 1) * bucket_size
    buckets: List[Dict[str, Any]] = []
    cur = min_price
    while cur < max_price:
        upper = cur + bucket_size
        total_qty = sum(q for p, q in entries if p >= cur and (p < upper or (cur == max_price - bucket_size and p <= upper)))
        buckets.append({"min": cur, "max": upper, "count": total_qty})
        cur = upper
    return buckets


def record_trade(
    db: Session,
    user_id: int,
    category: Literal["brick", "skin"],
    action: Literal["buy", "sell"],
    item_name: str,
    quantity: int,
    unit_price: int,
    total_amount: int,
    net_amount: int = 0,
    season: str = "",
) -> None:
    qty = int(quantity or 0)
    if qty <= 0 or not user_id:
        return
    log = TradeLog(
        user_id=user_id,
        category=category,
        action=action,
        item_name=item_name,
        quantity=qty,
        unit_price=int(unit_price or 0),
        total_amount=int(total_amount or 0),
        net_amount=int(net_amount or 0),
        season=season or "",
    )
    db.add(log)

def brick_purchase_plan(
    db: Session,
    cfg: PoolConfig,
    count: int,
    max_price: Optional[int] = None,
    exclude_user_id: Optional[int] = None,
    season: Optional[str] = None,
) -> tuple[List[Dict[str, Any]], int]:
    remaining = int(count or 0)
    if remaining <= 0:
        return [], 0
    plan: List[Dict[str, Any]] = []
    season_key = _normalize_season(season)
    player_orders = db.query(BrickSellOrder).filter(
        BrickSellOrder.active == True,
        BrickSellOrder.source == "player",
        BrickSellOrder.remaining > 0,
    ).order_by(BrickSellOrder.price.asc(), BrickSellOrder.created_at.asc(), BrickSellOrder.id.asc()).all()
    for order in player_orders:
        if exclude_user_id is not None and order.user_id == exclude_user_id:
            continue
        order_season = _brick_season_key(order.season)
        if season_key and _brick_season_key(season_key) != order_season:
            continue
        if max_price is not None and order.price > max_price:
            break
        take = min(remaining, order.remaining)
        if take <= 0:
            continue
        plan.append({
            "type": "player",
            "order": order,
            "price": int(order.price),
            "quantity": take,
            "season": order_season,
        })
        remaining -= take
        if remaining <= 0:
            break
    if remaining > 0:
        state = ensure_brick_market_state(db, cfg)
        layers = official_sell_layers(cfg, state)
        for layer in layers:
            price = int(layer["price"])
            layer_season = layer.get("season") or BRICK_SEASON_FALLBACK
            if season_key and _brick_season_key(season_key) != layer_season:
                continue
            if max_price is not None and price > max_price:
                continue
            take = min(remaining, int(layer.get("quantity", 0)))
            if take <= 0:
                continue
            plan.append({
                "type": "official",
                "order": None,
                "price": price,
                "quantity": take,
                "priority": layer.get("priority", 0),
                "season": layer_season,
            })
            remaining -= take
            if remaining <= 0:
                break
    return plan, remaining

def process_brick_buy_orders(db: Session, cfg: PoolConfig) -> List[Dict[str, Any]]:
    events: List[Dict[str, Any]] = []
    buy_orders = db.query(BrickBuyOrder).filter(BrickBuyOrder.active == True, BrickBuyOrder.remaining > 0)\
        .order_by(BrickBuyOrder.target_price.desc(), BrickBuyOrder.created_at.asc(), BrickBuyOrder.id.asc()).all()
    if not buy_orders:
        return events
    for order in buy_orders:
        buyer = db.query(User).filter_by(id=order.user_id).first()
        if not buyer:
            order.active = False
            continue
        plan, leftover = brick_purchase_plan(
            db,
            cfg,
            order.remaining,
            max_price=order.target_price,
            exclude_user_id=order.user_id,
        )
        total_qty = sum(item["quantity"] for item in plan)
        if total_qty < order.remaining:
            continue
        total_cost = sum(item["price"] * item["quantity"] for item in plan)
        if total_cost > order.locked_coins:
            continue
        gift_locked_before = int(order.gift_coin_locked or 0)
        gift_coin_spent = min(gift_locked_before, total_cost)
        gift_remaining = gift_coin_spent
        season_stats: Dict[str, Dict[str, int]] = {}
        for item in plan:
            price = int(item["price"])
            qty = int(item["quantity"])
            if qty <= 0:
                continue
            season_key = item.get("season") or BRICK_SEASON_FALLBACK
            stats = season_stats.setdefault(season_key, {"qty": 0, "cost": 0, "gift": 0})
            stats["qty"] += qty
            stats["cost"] += price * qty
            if price > 0 and gift_remaining > 0:
                take = min(qty, gift_remaining // price)
                if take > 0:
                    stats["gift"] += take
                    gift_remaining -= take * price
        for item in plan:
            if item["type"] == "player" and item.get("order"):
                sell_order: BrickSellOrder = item["order"]
                seller = db.query(User).filter_by(id=sell_order.user_id).first()
                if seller and seller.id == buyer.id:
                    continue
                if seller:
                    gross = item["price"] * item["quantity"]
                    net = (gross * 95) // 100
                    seller.coins += net
                    mark_cookie_delta_activity(db, seller.id)
                    record_trade(
                        db,
                        seller.id,
                        "brick",
                        "sell",
                        "未开砖",
                        item["quantity"],
                        item["price"],
                        gross,
                        net,
                        season=sell_order.season or "",
                    )
                sell_order.remaining -= item["quantity"]
                if sell_order.remaining <= 0:
                    sell_order.active = False
        for season_key, stats in season_stats.items():
            qty = stats.get("qty", 0)
            if qty <= 0:
                continue
            gift_take = stats.get("gift", 0)
            season_param = None if season_key == BRICK_SEASON_FALLBACK else season_key
            grant_user_bricks(
                db,
                buyer,
                season_param,
                qty,
                gift_locked=gift_take,
                lock_quota=gift_take > 0,
            )
        order.remaining = 0
        order.active = False
        locked_before = order.locked_coins
        order.locked_coins = max(0, locked_before - total_cost)
        order.gift_coin_locked = max(0, gift_locked_before - gift_coin_spent)
        refund = order.locked_coins
        gift_refund = min(refund, order.gift_coin_locked)
        if refund > 0:
            buyer.coins += refund
        if gift_refund > 0:
            buyer.gift_coin_balance += gift_refund
        order.locked_coins = 0
        order.gift_coin_locked = 0
        for season_key, stats in season_stats.items():
            qty = stats.get("qty", 0)
            cost = stats.get("cost", 0)
            if qty <= 0 or cost <= 0:
                continue
            avg_price = cost // qty if qty else cost
            record_trade(
                db,
                buyer.id,
                "brick",
                "buy",
                "未开砖",
                qty,
                avg_price,
                cost,
                0,
                season="" if season_key == BRICK_SEASON_FALLBACK else season_key,
            )
        events.append({
            "order_id": order.id,
            "filled": total_qty,
            "avg_price": round(total_cost / total_qty, 2) if total_qty else 0,
            "refund": refund,
        })
    db.flush()
    return events

from pydantic import BaseModel as _BM
class OddsOut(_BM):
    brick: float; purple: float; blue: float; green: float
    force_brick_next: bool; force_purple_next: bool
    pity_brick: int; pity_purple: int

def pick_skin(db: Session, rarity: str, season: Optional[str] = None, preferred_skin_id: Optional[str] = None) -> Skin:
    q = db.query(Skin).filter_by(rarity=rarity, active=True)
    season_key = _normalize_season(season)
    if season_key:
        q = q.filter(func.upper(Skin.season) == season_key)
    rows = q.all()
    if preferred_skin_id:
        for row in rows:
            if str(row.skin_id) == str(preferred_skin_id):
                return row
        pref = db.query(Skin).filter_by(skin_id=preferred_skin_id, active=True).first()
        if pref and pref.rarity == rarity:
            pref_season = _normalize_season(pref.season)
            if not season_key or pref_season == season_key:
                return pref
    if not rows:
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
    username = (data.username or "").strip()
    if not username:
        raise HTTPException(400, "用户名不能为空")

    if db.query(User).filter_by(username=username).first():
        raise HTTPException(400, "用户名已存在，请更换用户名")

    free_mode = get_auth_free_mode(db)
    phone_raw = (data.phone or "").strip()
    if free_mode:
        if phone_raw:
            if not PHONE_RE.fullmatch(phone_raw):
                raise HTTPException(400, "手机号无效：必须以1开头且为11位纯数字")
            if db.query(User).filter_by(phone=phone_raw).first():
                raise HTTPException(400, "手机号已被绑定，请使用其他手机号")
            phone_value = phone_raw
        else:
            phone_value = _alloc_virtual_phone(db, username)
    else:
        if not phone_raw:
            raise HTTPException(400, "当前模式需要填写手机号")
        if not PHONE_RE.fullmatch(phone_raw):
            raise HTTPException(400, "手机号无效：必须以1开头且为11位纯数字")
        if db.query(User).filter_by(phone=phone_raw).first():
            raise HTTPException(400, "手机号已被绑定，请使用其他手机号")
        phone_value = phone_raw

    # 先做密码强度校验
    check_password_complexity(data.password)

    if not free_mode:
        reg_code = (data.reg_code or "").strip()
        if not reg_code:
            raise HTTPException(400, "当前模式注册需要短信验证码")
        if not verify_otp(db, phone_value, "register", reg_code):
            raise HTTPException(401, "注册验证码错误或已过期")

    fiat_bonus = 20000 if free_mode else 0
    u = User(
        username=username,
        phone=phone_value,
        password_hash=hash_pw(data.password),
        fiat=fiat_bonus,
        gift_fiat_balance=fiat_bonus,
    )
    db.add(u); db.commit()

    # 若申请管理员：下发管理员验证码（写入 admin_pending）
    try:
        if data.want_admin:
            put_admin_pending(username)
            return {"ok": True, "admin_verify_required": True, "msg": "已申请管理员，请查看 sms_codes.txt 并在登录页验证"}
    except NameError:
        pass

    if free_mode:
        return {"ok": True, "msg": "注册成功，系统已发放 20000 法币，请登录"}
    return {"ok": True, "msg": "注册成功，请登录"}


@app.post("/auth/login/start")
def login_start(data: LoginStartIn, db: Session = Depends(get_db)):
    u = db.query(User).filter_by(username=data.username).first()
    if not u:
        raise HTTPException(401, "用户不存在")
    if not verify_pw(data.password, u.password_hash):
        raise HTTPException(401, "密码错误")
    free_mode = get_auth_free_mode(db)
    if free_mode:
        u.session_ver = int(u.session_ver or 0) + 1
        db.commit()
        token = mk_jwt(u.username, u.session_ver)
        return {"ok": True, "token": token, "msg": "登录成功"}

    phone = u.phone or ""
    if not PHONE_RE.fullmatch(phone):
        raise HTTPException(400, "账号未绑定有效手机号，请联系管理员")
    _sms_rate_guard("login2", phone)
    code = f"{secrets.randbelow(1_000_000):06d}"
    write_sms_line(phone, code, "login2")
    save_otp(db, phone, "login2", code)
    return {"ok": True, "msg": "验证码已发送到绑定手机号（查看 sms_codes.txt）"}

@app.post("/auth/login/verify")
def login_verify(data: LoginVerifyIn, db: Session = Depends(get_db)):
    u = db.query(User).filter_by(username=data.username).first()
    if not u:
        raise HTTPException(401, "用户不存在")
    if get_auth_free_mode(db):
        raise HTTPException(400, "当前模式登录无需验证码，请直接登录")
    phone = u.phone or ""
    if not PHONE_RE.fullmatch(phone):
        raise HTTPException(400, "账号未绑定有效手机号，请联系管理员")
    if not verify_otp(db, phone, "login2", data.code):
        raise HTTPException(401, "验证码错误或已过期")
    u.session_ver = int(u.session_ver or 0) + 1
    db.commit()
    token = mk_jwt(u.username, u.session_ver)
    return {"ok": True, "token": token, "msg": "登录成功"}

@app.post("/auth/login/verify")
def login_verify(data: LoginVerifyIn, db: Session = Depends(get_db)):
    # 登录验证码已取消，保留路由仅用于兼容旧版本
    u = db.query(User).filter_by(username=data.username).first()
    if not u:
        raise HTTPException(401, "用户不存在")
    raise HTTPException(400, "当前版本登录无需验证码，请使用最新客户端")


@app.get("/auth/mode")
def auth_mode(db: Session = Depends(get_db)):
    return {"verification_free": get_auth_free_mode(db)}


@app.get("/auth/mode")
def auth_mode(db: Session = Depends(get_db)):
    return {"verification_free": get_auth_free_mode(db)}


@app.get("/auth/mode")
def auth_mode(db: Session = Depends(get_db)):
    return {"verification_free": get_auth_free_mode(db)}


@app.get("/auth/mode")
def auth_mode(db: Session = Depends(get_db)):
    return {"verification_free": get_auth_free_mode(db)}


@app.get("/auth/mode")
def auth_mode(db: Session = Depends(get_db)):
    return {"verification_free": get_auth_free_mode(db)}


@app.get("/auth/mode")
def auth_mode(db: Session = Depends(get_db)):
    return {"verification_free": get_auth_free_mode(db)}


@app.post("/auth/send-code")
def send_code(inp: SendCodeIn, db: Session = Depends(get_db)):
    phone = inp.phone
    purpose = inp.purpose  # "login" | "reset" | "register"

    free_mode = get_auth_free_mode(db)
    if purpose in ("login", "register") and free_mode:
        raise HTTPException(400, "当前登录/注册无需验证码")

    # 基本格式校验
    if not PHONE_RE.fullmatch(phone):
        raise HTTPException(400, "手机号格式不正确")

    # 分用途校验
    if purpose == "reset" or (purpose == "login" and not free_mode):
        # 登录 / 重置密码：要求手机号已经绑定
        if not db.query(User).filter_by(phone=phone).first():
            raise HTTPException(404, "手机号尚未注册")
    elif purpose == "register" and not free_mode:
        # 注册：要求手机号目前未被占用
        if db.query(User).filter_by(phone=phone).first():
            raise HTTPException(400, "该手机号已被占用")
    elif purpose not in ("reset", "login", "register"):
        raise HTTPException(400, "不支持的验证码用途")
    else:
        raise HTTPException(400, "当前模式无需该验证码")
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
def me(user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    phone = user.phone or ""
    if phone.startswith(VIRTUAL_PHONE_PREFIX):
        phone = ""
    cookie_enabled = cookie_factory_enabled(db)
    brick_detail = brick_balance_detail(db, user.id)
    return {
        "username": user.username, "phone": phone,
        "fiat": user.fiat, "coins": user.coins, "keys": user.keys,
        "unopened_bricks": user.unopened_bricks,
        "unopened_bricks_detail": brick_detail,
        "pity_brick": user.pity_brick, "pity_purple": user.pity_purple,
        "is_admin": bool(getattr(user, "is_admin", False)),
        "features": {
            "cookie_factory": {
                "enabled": bool(cookie_enabled),
                "available": bool(cookie_enabled or getattr(user, "is_admin", False)),
            }
        },
    }


@app.get("/me/mailbox")
def me_mailbox(
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(user_from_token),
    db: Session = Depends(get_db),
):
    logs = (
        db.query(TradeLog)
        .filter_by(user_id=user.id)
        .order_by(TradeLog.created_at.desc(), TradeLog.id.desc())
        .limit(limit)
        .all()
    )
    out: Dict[str, Dict[str, List[Dict[str, Any]]]] = {
        "brick": {"buy": [], "sell": []},
        "skin": {"buy": [], "sell": []},
    }
    for log in logs:
        category = "brick" if str(log.category) == "brick" else "skin"
        action = "sell" if str(log.action) == "sell" else "buy"
        bucket = out[category]
        entry = {
            "id": log.id,
            "item_name": log.item_name,
            "quantity": log.quantity,
            "unit_price": log.unit_price,
            "total_amount": log.total_amount,
            "net_amount": log.net_amount,
            "created_at": log.created_at,
            "action": action,
            "season": log.season or "",
        }
        bucket[action].append(entry)
    return out


@app.get("/cookie-factory/status")
def cookie_factory_status(user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    now = int(time.time())
    enabled = cookie_factory_enabled(db)
    if not enabled and not getattr(user, "is_admin", False):
        return {"enabled": False, "now": now}
    profile = ensure_cookie_profile(db, user, now)
    settlement = cookie_maybe_settle(db, profile, user, now)
    cookie_tick(profile, now)
    db.flush()
    payload = cookie_status_payload(user, profile, now, settlement, feature_enabled=enabled)
    if not enabled and getattr(user, "is_admin", False):
        payload["admin_preview"] = True
    db.commit()
    return payload


@app.post("/cookie-factory/login")
def cookie_factory_login(user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    now = int(time.time())
    enabled = cookie_factory_enabled(db)
    if not enabled and not getattr(user, "is_admin", False):
        raise HTTPException(404, "小游戏未开启")
    profile = ensure_cookie_profile(db, user, now)
    settlement = cookie_maybe_settle(db, profile, user, now)
    cookie_tick(profile, now)
    info = cookie_register_login(profile, now)
    if info.get("added"):
        cookie_add_active_points(profile, now, 5)
    db.flush()
    payload = cookie_status_payload(user, profile, now, settlement, feature_enabled=enabled)
    info["daily_reward"] = 2 if info.get("added") else 0
    payload["login_result"] = info
    db.commit()
    return payload


@app.post("/cookie-factory/act")
def cookie_factory_act(inp: CookieActIn, user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    now = int(time.time())
    enabled = cookie_factory_enabled(db)
    if not enabled and not getattr(user, "is_admin", False):
        raise HTTPException(404, "小游戏未开启")
    profile = ensure_cookie_profile(db, user, now)
    settlement = cookie_maybe_settle(db, profile, user, now)
    cookie_tick(profile, now)
    counts = cookie_building_counts(profile)
    result: Dict[str, Any] = {}
    action = inp.type
    if action == "click":
        amount = max(1, min(int(inp.amount or 1), 200))
        gained = cookie_click_gain(profile, amount, counts)
        cookie_add(profile, gained)
        profile.manual_clicks = int(profile.manual_clicks or 0) + amount
        cookie_add_active_points(profile, now, max(1, amount // 5))
        today_clicks = cookie_challenge_increment(profile, now, amount)
        result = {
            "gained": round(gained, 2),
            "clicks": amount,
            "challenge_today": today_clicks,
            "challenge_completed": today_clicks >= COOKIE_DAILY_CHALLENGE_TARGET,
        }
    elif action == "buy_building":
        key = (inp.building or "").strip()
        if not key or key not in {cfg["key"] for cfg in COOKIE_BUILDINGS}:
            raise HTTPException(400, "未知建筑")
        cost = cookie_building_cost(key, counts.get(key, 0))
        cookie_spend(profile, cost)
        counts[key] = counts.get(key, 0) + 1
        cookie_store_buildings(profile, counts)
        cookie_add_active_points(profile, now, 8)
        result = {"building": key, "cost": cost, "count": counts[key]}
    elif action == "golden":
        if int(profile.golden_ready_ts or 0) > now:
            raise HTTPException(400, "黄金饼干尚未出现")
        cps, effective_cps = cookie_cps(profile, counts)
        burst = effective_cps * 60 + cookie_click_gain(profile, 40, counts)
        cookie_add(profile, burst)
        profile.golden_cookies = int(profile.golden_cookies or 0) + 1
        profile.golden_cooldown = 300
        profile.golden_ready_ts = now + profile.golden_cooldown
        cookie_add_active_points(profile, now, 12)
        result = {"bonus": round(burst, 2)}
    elif action == "mini":
        mini_key = (inp.mini or "").strip()
        if not mini_key or mini_key not in COOKIE_MINI_GAMES:
            raise HTTPException(400, "未知小游戏")
        state = cookie_mini_games_state(profile)
        node = state.get(mini_key, {"level": 0, "progress": 0})
        sugar_cost = int(COOKIE_MINI_GAMES[mini_key].get("sugar_cost", 0))
        if sugar_cost > 0:
            if int(profile.sugar_lumps or 0) < sugar_cost:
                raise HTTPException(400, f"糖块不足，需要 {sugar_cost} 颗糖块才能开展 {COOKIE_MINI_GAMES[mini_key]['name']}")
            profile.sugar_lumps = int(profile.sugar_lumps or 0) - sugar_cost
        node["progress"] = int(node.get("progress", 0)) + 1
        threshold = int(COOKIE_MINI_GAMES[mini_key].get("threshold", 1))
        leveled = False
        if node["progress"] >= threshold:
            node["progress"] = 0
            node["level"] = int(node.get("level", 0)) + 1
            leveled = True
        state[mini_key] = node
        profile.mini_games = _json_dump(state)
        cookie_add_active_points(profile, now, int(COOKIE_MINI_GAMES[mini_key].get("points", 3)))
        if leveled:
            current = float(profile.pending_bonus_multiplier or 1.0)
            profile.pending_bonus_multiplier = min(COOKIE_DELTA_BONUS_CAP, current + 0.01)
        result = {
            "mini": mini_key,
            "level": int(node.get("level", 0)),
            "leveled": leveled,
            "sugar_lumps": int(profile.sugar_lumps or 0),
        }
    elif action == "claim":
        (
            _,
            _,
            _,
            _,
            projected,
            claimed,
            claimable,
            _,
            _,
        ) = cookie_weekly_progress(profile)
        if claimable <= 0:
            raise HTTPException(400, "暂无可领取的砖奖励")
        new_claimed = claimed + claimable
        profile.claimed_bricks_this_week = int(new_claimed)
        profile.weekly_bricks_awarded = int(new_claimed)
        available_seasons = SEASON_IDS[:6] if len(SEASON_IDS) >= 6 else (SEASON_IDS or [])
        if not available_seasons:
            available_seasons = [LATEST_SEASON or BRICK_SEASON_FALLBACK]
        allocation: Dict[str, int] = {}
        for _ in range(int(claimable)):
            sid = random.choice(available_seasons) if available_seasons else BRICK_SEASON_FALLBACK
            allocation[sid] = allocation.get(sid, 0) + 1
        for sid, qty in allocation.items():
            grant_user_bricks(db, user, sid, qty)
        profile.total_bricks_earned += claimable
        result = {
            "claimed": int(claimable),
            "claimed_total": int(new_claimed),
            "projected": int(projected),
            "inventory_total": int(user.unopened_bricks or 0),
        }
    elif action == "prestige":
        requirement = 1_000_000
        if float(profile.total_cookies or 0.0) < requirement:
            raise HTTPException(400, "需要至少 100 万枚饼干方可升天")
        points = max(1, int((float(profile.total_cookies or 0.0) / 1_000_000_000) ** 0.5))
        profile.prestige = int(profile.prestige or 0) + 1
        profile.prestige_points = int(profile.prestige_points or 0) + points
        profile.banked_cookies = 0.0
        profile.cookies_this_week = 0.0
        profile.manual_clicks = 0
        profile.golden_cookies = 0
        profile.golden_ready_ts = now + 180
        profile.golden_cooldown = 180
        counts = {cfg["key"]: 0 for cfg in COOKIE_BUILDINGS}
        cookie_store_buildings(profile, counts)
        reset_state = {k: {"level": 0, "progress": 0, "last_action": now} for k in COOKIE_MINI_GAMES}
        profile.mini_games = _json_dump(reset_state)
        profile.last_active_ts = now
        profile.pending_bonus_multiplier = min(COOKIE_DELTA_BONUS_CAP, float(profile.pending_bonus_multiplier or 1.0) + 0.02)
        cookie_add_active_points(profile, now, 20)
        result = {"prestige": int(profile.prestige or 0), "points_gained": points}
    elif action == "sugar":
        ready_at = int(profile.last_sugar_ts or 0) + COOKIE_SUGAR_COOLDOWN
        if ready_at > now:
            raise HTTPException(400, "糖块尚未成熟")
        profile.last_sugar_ts = now
        profile.sugar_lumps = int(profile.sugar_lumps or 0) + 1
        cookie_add_active_points(profile, now, 5)
        result = {"sugar_lumps": int(profile.sugar_lumps or 0)}
    else:
        raise HTTPException(400, "不支持的操作")

    db.flush()
    payload = cookie_status_payload(user, profile, now, settlement, feature_enabled=enabled)
    payload["action_result"] = result
    db.commit()
    return payload


@app.get("/admin/cookie-factory")
def admin_cookie_factory_status(user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    if not getattr(user, "is_admin", False):
        raise HTTPException(403, "需要管理员权限")
    enabled = cookie_factory_enabled(db)
    total_profiles = db.query(CookieFactoryProfile).count()
    total_bricks = db.query(func.coalesce(func.sum(CookieFactoryProfile.total_bricks_earned), 0)).scalar()
    total_bricks = int(total_bricks or 0)
    return {
        "enabled": bool(enabled),
        "profiles": total_profiles,
        "total_bricks": total_bricks,
    }


@app.post("/admin/cookie-factory/toggle")
def admin_cookie_factory_toggle(payload: Dict[str, Any], user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    if not getattr(user, "is_admin", False):
        raise HTTPException(403, "需要管理员权限")
    desired = bool((payload or {}).get("enabled", False))
    set_cookie_factory_enabled(db, desired)
    db.commit()
    return {"enabled": desired}


@app.post("/admin/cookie-factory/toggle")
def admin_cookie_factory_toggle(payload: Dict[str, Any], user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    if not getattr(user, "is_admin", False):
        raise HTTPException(403, "需要管理员权限")
    desired = bool((payload or {}).get("enabled", False))
    set_cookie_factory_enabled(db, desired)
    db.commit()
    return {"enabled": desired}

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
    gift_fiat_used = min(int(user.gift_fiat_balance or 0), amt)
    if gift_fiat_used > 0:
        user.gift_fiat_balance -= gift_fiat_used
        gift_coin_gain = math.floor(coins_gain * (gift_fiat_used / amt))
        if gift_coin_gain > 0:
            user.gift_coin_balance += gift_coin_gain
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
    gift_spent = min(int(user.gift_coin_balance or 0), cost)
    if gift_spent > 0:
        user.gift_coin_balance -= gift_spent
    db.commit(); return {"ok": True, "coins": user.coins, "keys": user.keys}

@app.post("/shop/buy-bricks")
def buy_bricks(inp: CountIn, user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    if inp.count <= 0: raise HTTPException(400, "数量必须大于 0")
    cfg = db.query(PoolConfig).first()
    plan, leftover = brick_purchase_plan(db, cfg, inp.count, exclude_user_id=user.id, season=inp.season)
    total_qty = sum(item["quantity"] for item in plan)
    if total_qty < inp.count:
        raise HTTPException(400, "当前可购砖数量不足")
    total_cost = sum(item["price"] * item["quantity"] for item in plan)
    if user.coins < total_cost:
        raise HTTPException(400, "三角币不足")
    user.coins -= total_cost
    gift_spent = min(int(user.gift_coin_balance or 0), total_cost)
    if gift_spent > 0:
        user.gift_coin_balance -= gift_spent
    gift_remaining = gift_spent
    season_stats: Dict[str, Dict[str, int]] = {}
    for item in plan:
        price = int(item["price"])
        qty = int(item["quantity"])
        if qty <= 0:
            continue
        season_key = item.get("season") or BRICK_SEASON_FALLBACK
        stats = season_stats.setdefault(season_key, {"qty": 0, "cost": 0, "gift": 0})
        stats["qty"] += qty
        stats["cost"] += price * qty
        if price > 0 and gift_remaining > 0:
            take = min(qty, gift_remaining // price)
            if take > 0:
                stats["gift"] += take
                gift_remaining -= take * price
    for item in plan:
        if item["type"] == "player" and item.get("order"):
            sell_order: BrickSellOrder = item["order"]
            seller = db.query(User).filter_by(id=sell_order.user_id).first()
            if seller and seller.id == user.id:
                continue
            if seller:
                gross = item["price"] * item["quantity"]
                net = (gross * 95) // 100
                seller.coins += net
                record_trade(
                    db,
                    seller.id,
                    "brick",
                    "sell",
                    "未开砖",
                    item["quantity"],
                    item["price"],
                    gross,
                    net,
                    season=sell_order.season or "",
                )
            sell_order.remaining -= item["quantity"]
            if sell_order.remaining <= 0:
                sell_order.active = False
    for season_key, stats in season_stats.items():
        qty = stats.get("qty", 0)
        if qty <= 0:
            continue
        gift_take = stats.get("gift", 0)
        season_param = None if season_key == BRICK_SEASON_FALLBACK else season_key
        grant_user_bricks(
            db,
            user,
            season_param,
            qty,
            gift_locked=gift_take,
            lock_quota=gift_take > 0,
        )
    for season_key, stats in season_stats.items():
        qty = stats.get("qty", 0)
        cost = stats.get("cost", 0)
        if qty <= 0 or cost <= 0:
            continue
        avg_price = cost // qty if qty else cost
        record_trade(
            db,
            user.id,
            "brick",
            "buy",
            "未开砖",
            qty,
            avg_price,
            cost,
            0,
            season="" if season_key == BRICK_SEASON_FALLBACK else season_key,
        )
    db.commit()
    process_brick_buy_orders(db, cfg)
    db.commit()
    brick_state = ensure_brick_market_state(db, cfg)
    return {
        "ok": True,
        "coins": user.coins,
        "unopened_bricks": user.unopened_bricks,
        "brick_price": cfg.brick_price,
        "brick_price_raw": round(brick_state.price, 2),
        "spent": total_cost,
        "segments": [
            {
                "source": item["type"],
                "price": item["price"],
                "quantity": item["quantity"],
                "season": item.get("season") or "",
            }
            for item in plan
        ]
    }

@app.get("/shop/prices")
def shop_prices(user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    cfg = db.query(PoolConfig).first()
    snapshot = brick_price_snapshot(db, cfg)
    fills = process_brick_buy_orders(db, cfg)
    db.commit()
    resp = {
        "brick_price": snapshot["unit"],
        "brick_price_raw": snapshot["raw"],
        "key_price": cfg.key_price
    }
    season_prices = []
    for sid in SEASON_IDS:
        season_prices.append({
            "season": sid,
            "name": _season_display_name(sid),
            "price": _season_brick_price(snapshot["unit"], sid),
        })
    if season_prices:
        resp["season_prices"] = season_prices
    if fills:
        resp["buy_orders_filled"] = fills
    return resp

@app.get("/shop/brick-quote")
def shop_brick_quote(
    count: int = Query(..., ge=1),
    season: Optional[str] = Query(None),
    user: User = Depends(user_from_token),
    db: Session = Depends(get_db)
):
    cfg = db.query(PoolConfig).first()
    plan, leftover = brick_purchase_plan(db, cfg, count, exclude_user_id=user.id, season=season)
    total_qty = sum(item["quantity"] for item in plan)
    total_cost = sum(item["price"] * item["quantity"] for item in plan)
    return {
        "requested": count,
        "available": total_qty,
        "missing": max(0, count - total_qty),
        "total_cost": total_cost,
        "segments": [
            {
                "source": item["type"],
                "price": item["price"],
                "quantity": item["quantity"],
                "season": item.get("season") or "",
                "season_name": _season_display_name(item.get("season") or BRICK_SEASON_FALLBACK),
            }
            for item in plan
        ],
        "current_price": cfg.brick_price,
    }

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
    if inp.count not in (1, 10):
        raise HTTPException(400, "当前仅支持单抽或十连")
    if user.unopened_bricks < inp.count: raise HTTPException(400, "未开砖数量不足")
    if user.keys < inp.count: raise HTTPException(400, "钥匙不足")
    cfg = db.query(PoolConfig).first()
    season_key = _normalize_season(inp.season) or LATEST_SEASON
    consume_user_bricks(db, user, season_key, inp.count, allow_gift=True)
    user.keys -= inp.count
    mark_cookie_delta_activity(db, user.id)

    results = []
    target_skin = (inp.target_skin_id or "").strip()

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

        preferred = target_skin if rarity == "BRICK" and target_skin else None
        skin = pick_skin(db, rarity, season=season_key, preferred_skin_id=preferred)
        exquisite = (secrets.randbelow(100) < 15) if rarity == "BRICK" else False
        wear_bp = wear_random_bp()
        grade = grade_from_wear_bp(wear_bp)
        profile = generate_visual_profile(skin.rarity, exquisite, model_key=skin.model_key, skin=skin)

        inv = Inventory(
            user_id=user.id, skin_id=skin.skin_id, name=skin.name, rarity=skin.rarity,
            exquisite=exquisite, wear_bp=wear_bp, grade=grade, serial="",
            acquired_at=int(time.time()),
            body_colors=json.dumps(profile["body"], ensure_ascii=False),
            attachment_colors=json.dumps(profile["attachments"], ensure_ascii=False),
            template_name=profile["template"],
            effect_tags=json.dumps(profile["effects"], ensure_ascii=False),
            hidden_template=profile["hidden_template"],
            season=skin.season or season_key,
            model_key=profile.get("model", skin.model_key or ""),
        )
        if int(user.gift_brick_quota or 0) > 0:
            inv.sell_locked = True
            inv.lock_reason = "由赠送资金购得，暂不可交易"
            user.gift_brick_quota = max(0, int(user.gift_brick_quota or 0) - 1)
        db.add(inv); db.flush()
        inv.serial = f"{inv.id:08d}"

        results.append({
            "inv_id": inv.id,
            "skin_id": skin.skin_id, "name": skin.name, "rarity": skin.rarity,
            "exquisite": exquisite, "wear": f"{wear_bp/100:.2f}", "grade": grade, "serial": inv.serial,
            "template": profile["template"],
            "hidden_template": profile["hidden_template"],
            "effects": profile["effects"],
            "season": skin.season or season_key,
            "model": profile.get("model", skin.model_key or ""),
            "sell_locked": bool(inv.sell_locked),
            "lock_reason": inv.lock_reason or "",
            "visual": {
                "body": profile["body"],
                "attachments": profile["attachments"],
                "template": profile["template"],
                "hidden_template": profile["hidden_template"],
                "effects": profile["effects"],
                "model": profile.get("model", skin.model_key or ""),
            },
        })

    apply_brick_market_influence(db, cfg, results)
    process_brick_buy_orders(db, cfg)
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
    skin_ids = {r.skin_id for r in rows if r.skin_id}
    skin_map = {}
    if skin_ids:
        for s in db.query(Skin).filter(Skin.skin_id.in_(skin_ids)).all():
            skin_map[s.skin_id] = s
    items = []
    changed = False
    for x in rows:
        vis = ensure_visual(x, skin_map.get(x.skin_id))
        changed = changed or vis["changed"]
        visual_payload = {
            "body": vis["body"],
            "attachments": vis["attachments"],
            "template": vis["template"],
            "hidden_template": vis["hidden_template"],
            "effects": vis["effects"],
            "model": vis.get("model", ""),
        }

        items.append({
            "inv_id": x.id,
            "skin_id": x.skin_id, "name": x.name, "rarity": x.rarity,
            "exquisite": x.exquisite,
            "wear": f"{x.wear_bp/100:.2f}",
            "grade": x.grade,
            "serial": x.serial,
            "acquired_at": x.acquired_at,
            "on_market": x.on_market,               # 继续返回状态，前端可用来显示角标
            "status": "on_market" if x.on_market else "in_bag",
            "template": vis["template"],
            "hidden_template": vis["hidden_template"],
            "effects": vis["effects"],
            "model": vis.get("model", ""),
            "season": x.season or (skin_map.get(x.skin_id).season if skin_map.get(x.skin_id) else ""),
            "visual": visual_payload,
            "sell_locked": bool(getattr(x, "sell_locked", False)),
            "lock_reason": x.lock_reason or "",
        })
    if changed:
        db.commit()
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
    skin_ids = {r.skin_id for r in rows if r.skin_id}
    skin_map = {}
    if skin_ids:
        for s in db.query(Skin).filter(Skin.skin_id.in_(skin_ids)).all():
            skin_map[s.skin_id] = s
    changed = False
    for x in rows:
        vis = ensure_visual(x, skin_map.get(x.skin_id))
        changed = changed or vis["changed"]
        visual_payload = {
            "body": vis["body"],
            "attachments": vis["attachments"],
            "template": vis["template"],
            "hidden_template": vis["hidden_template"],
            "effects": vis["effects"],
            "model": vis.get("model", ""),
        }

        grouped[x.rarity].append({
            "inv_id": x.id,
            "skin_id": x.skin_id, "name": x.name, "rarity": x.rarity,
            "exquisite": x.exquisite,
            "wear": f"{x.wear_bp/100:.2f}",
            "grade": x.grade,
            "serial": x.serial,
            "acquired_at": x.acquired_at,
            "on_market": x.on_market,
            "status": "on_market" if x.on_market else "in_bag",
            "template": vis["template"],
            "hidden_template": vis["hidden_template"],
            "effects": vis["effects"],
            "model": vis.get("model", ""),
            "season": x.season or (skin_map.get(x.skin_id).season if skin_map.get(x.skin_id) else ""),
            "visual": visual_payload,
            "sell_locked": bool(getattr(x, "sell_locked", False)),
            "lock_reason": x.lock_reason or "",
        })
    summary = {r: len(v) for r, v in grouped.items()}
    if changed:
        db.commit()
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
    skin_ids = {r.skin_id for r in rows if r.skin_id}
    skin_map = {}
    if skin_ids:
        for s in db.query(Skin).filter(Skin.skin_id.in_(skin_ids)).all():
            skin_map[s.skin_id] = s
    season_counter: Dict[str, int] = {}
    for r in rows:
        season_id = _normalize_season(r.season)
        if not season_id:
            skin_ref = skin_map.get(r.skin_id)
            if skin_ref:
                season_id = _normalize_season(skin_ref.season)
        if season_id:
            season_counter[season_id] = season_counter.get(season_id, 0) + 1
        db.delete(r)

    if season_counter:
        total = sum(season_counter.values())
        roll = secrets.randbelow(total)
        cursor = 0
        target_season = LATEST_SEASON or next(iter(season_counter.keys()))
        for sid, count in season_counter.items():
            cursor += count
            if roll < cursor:
                target_season = sid
                break
    else:
        target_season = LATEST_SEASON

    skin = pick_skin(db, to_rarity, season=target_season)
    exquisite = (secrets.randbelow(100) < 15) if to_rarity == "BRICK" else False
    grade = grade_from_wear_bp(avg_bp)
    profile = generate_visual_profile(skin.rarity, exquisite, model_key=skin.model_key, skin=skin)

    inv = Inventory(
        user_id=user.id, skin_id=skin.skin_id, name=skin.name, rarity=skin.rarity,
        exquisite=exquisite, wear_bp=avg_bp, grade=grade, serial="",
        acquired_at=int(time.time()),
        body_colors=json.dumps(profile["body"], ensure_ascii=False),
        attachment_colors=json.dumps(profile["attachments"], ensure_ascii=False),
        template_name=profile["template"],
        effect_tags=json.dumps(profile["effects"], ensure_ascii=False),
        hidden_template=profile["hidden_template"],
        season=skin.season or target_season,
        model_key=profile.get("model", skin.model_key or ""),
    )
    db.add(inv); db.flush()
    inv.serial = f"{inv.id:08d}"
    db.commit()
    return {"ok": True, "result": {
        "inv_id": inv.id,
        "skin_id": skin.skin_id, "name": skin.name, "rarity": skin.rarity,
        "exquisite": exquisite, "wear": f"{avg_bp/100:.2f}", "grade": grade, "serial": inv.serial,
        "template": profile["template"],
        "hidden_template": profile["hidden_template"],
        "effects": profile["effects"],
        "season": skin.season or target_season,
        "model": profile.get("model", skin.model_key or ""),
        "visual": {
            "body": profile["body"],
            "attachments": profile["attachments"],
            "template": profile["template"],
            "hidden_template": profile["hidden_template"],
            "effects": profile["effects"],
            "model": profile.get("model", skin.model_key or ""),
        },
    }}

# ------------------ Market 交易行 ------------------
MIN_PRICE = {"BRICK": 2050, "PURPLE": 230, "BLUE": 10, "GREEN": 2}

class MarketBrowseParams(BaseModel):
    rarity: Optional[RarityT] = None
    skin_id: Optional[str] = None
    is_exquisite: Optional[bool] = None  # BRICK 有意义，其它忽略
    grade: Optional[Literal["S","A","B","C"]] = None
    sort: Optional[Literal["wear_asc","wear_desc","price_asc","price_desc","newest","oldest"]] = "newest"
    season: Optional[str] = None

from sqlalchemy.exc import IntegrityError

@app.get("/market/bricks/book")
def brick_order_book(user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    cfg = db.query(PoolConfig).first()
    state = ensure_brick_market_state(db, cfg)
    layers = official_sell_layers(cfg, state)
    player_rows = db.query(BrickSellOrder, User).join(User, BrickSellOrder.user_id == User.id, isouter=True)\
        .filter(BrickSellOrder.active == True, BrickSellOrder.source == "player", BrickSellOrder.remaining > 0)\
        .order_by(BrickSellOrder.price.asc(), BrickSellOrder.created_at.asc(), BrickSellOrder.id.asc()).all()
    my_sell = []
    player_sell_view = []
    for order, seller in player_rows:
        entry = {
            "id": order.id,
            "price": order.price,
            "quantity": order.quantity,
            "remaining": order.remaining,
            "seller": seller.username if seller else "玩家",
            "mine": order.user_id == user.id,
            "created_at": order.created_at,
            "season": order.season or "",
            "season_name": _season_display_name(_brick_season_key(order.season)),
        }
        if entry["mine"]:
            my_sell.append(entry)
        if getattr(user, "is_admin", False):
            player_sell_view.append(entry)
    buy_orders = db.query(BrickBuyOrder).filter(BrickBuyOrder.active == True, BrickBuyOrder.remaining > 0)\
        .order_by(BrickBuyOrder.target_price.desc(), BrickBuyOrder.created_at.asc(), BrickBuyOrder.id.asc()).all()
    my_buy = []
    player_buy_view = []
    for order in buy_orders:
        entry = {
            "id": order.id,
            "price": order.target_price,
            "quantity": order.quantity,
            "remaining": order.remaining,
            "locked_coins": order.locked_coins,
            "created_at": order.created_at,
            "mine": order.user_id == user.id,
        }
        if entry["mine"]:
            my_buy.append(entry)
        if getattr(user, "is_admin", False):
            player_buy_view.append(entry)
    histogram = build_brick_histogram(layers, [row[0] for row in player_rows])
    for layer in layers:
        layer["season_name"] = _season_display_name(layer.get("season") or BRICK_SEASON_FALLBACK)
    return {
        "official_price": cfg.brick_price,
        "official_layers": layers,
        "player_sells": player_sell_view if getattr(user, "is_admin", False) else [],
        "player_buys": player_buy_view if getattr(user, "is_admin", False) else [],
        "my_sells": my_sell,
        "my_buys": my_buy,
        "histogram": histogram,
        "timestamp": int(time.time()),
    }

@app.post("/market/bricks/sell")
def brick_sell(inp: BrickSellIn, user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    qty = int(inp.quantity or 0)
    price = int(inp.price or 0)
    if qty <= 0:
        raise HTTPException(400, "数量必须大于 0")
    if price < 40:
        raise HTTPException(400, "价格必须大于等于 40")
    sellable = int(user.unopened_bricks or 0) - int(user.gift_unopened_bricks or 0)
    if sellable < qty:
        raise HTTPException(400, "可售砖数量不足，赠送砖不可出售")
    season_key = _normalize_season(inp.season)
    if not season_key:
        raise HTTPException(400, "请选择要出售的赛季")
    reserve_user_bricks(db, user, season_key, qty)
    order = BrickSellOrder(
        user_id=user.id,
        price=price,
        quantity=qty,
        remaining=qty,
        source="player",
        active=True,
        season=season_key,
    )
    db.add(order)
    db.commit()
    cfg = db.query(PoolConfig).first()
    fills = process_brick_buy_orders(db, cfg)
    db.commit()
    db.refresh(order)
    resp = {"ok": True, "order_id": order.id, "remaining": order.remaining}
    if fills:
        resp["fills"] = fills
    return resp

@app.post("/market/bricks/cancel/{order_id}")
def brick_sell_cancel(order_id: int = Path(..., ge=1), user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    order = db.query(BrickSellOrder).filter_by(id=order_id, user_id=user.id, active=True).first()
    if not order:
        raise HTTPException(404, "挂单不存在或已成交/取消")
    release_reserved_bricks(db, user, order.season or None, order.remaining)
    order.active = False
    order.remaining = 0
    db.commit()
    return {"ok": True, "msg": "已撤销砖挂单"}

@app.post("/market/bricks/buy-order")
def brick_buy_order(inp: BrickBuyOrderIn, user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    qty = int(inp.quantity or 0)
    target_price = int(inp.target_price or 0)
    if qty <= 0:
        raise HTTPException(400, "数量必须大于 0")
    if target_price < 40:
        raise HTTPException(400, "价格必须大于等于 40")
    total_cost = target_price * qty
    if user.coins < total_cost:
        raise HTTPException(400, "三角币不足")
    user.coins -= total_cost
    gift_spent = min(int(user.gift_coin_balance or 0), total_cost)
    if gift_spent > 0:
        user.gift_coin_balance -= gift_spent
    order = BrickBuyOrder(
        user_id=user.id,
        target_price=target_price,
        quantity=qty,
        locked_coins=total_cost,
        gift_coin_locked=gift_spent,
        remaining=qty,
        active=True,
    )
    db.add(order)
    db.commit()
    cfg = db.query(PoolConfig).first()
    fills = process_brick_buy_orders(db, cfg)
    db.commit()
    db.refresh(order)
    resp = {"ok": True, "order_id": order.id, "locked": total_cost}
    if fills:
        resp["fills"] = fills
        mine = next((f for f in fills if f.get("order_id") == order.id), None)
        if mine:
            resp["filled"] = mine
    return resp

@app.post("/market/bricks/buy-order/cancel/{order_id}")
def brick_buy_order_cancel(order_id: int = Path(..., ge=1), user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    order = db.query(BrickBuyOrder).filter_by(id=order_id, user_id=user.id, active=True).first()
    if not order:
        raise HTTPException(404, "委托不存在或已完成")
    refund = order.locked_coins
    gift_refund = min(refund, order.gift_coin_locked)
    if refund > 0:
        user.coins += refund
    if gift_refund > 0:
        user.gift_coin_balance += gift_refund
    order.active = False
    order.remaining = 0
    order.locked_coins = 0
    order.gift_coin_locked = 0
    db.commit()
    return {"ok": True, "msg": "已撤销砖收购委托"}

@app.post("/market/list")
def market_list(inp: MarketListIn, user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    # 1) 找到物品并校验归属
    inv = db.query(Inventory).filter_by(id=inp.inv_id, user_id=user.id).first()
    if not inv:
        raise HTTPException(404, "物品不存在或不属于你")
    if getattr(inv, "sell_locked", False):
        reason = inv.lock_reason or "该物品暂不可售卖"
        raise HTTPException(400, reason)

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
    rows = q.all()
    skin_ids = {inv.skin_id for _, inv in rows if inv.skin_id}
    skin_map = {}
    if skin_ids:
        for s in db.query(Skin).filter(Skin.skin_id.in_(skin_ids)).all():
            skin_map[s.skin_id] = s
    items = []
    changed = False
    for mi, inv in rows:
        vis = ensure_visual(inv, skin_map.get(inv.skin_id))
        changed = changed or vis["changed"]
        visual_payload = {
            "body": vis["body"],
            "attachments": vis["attachments"],
            "template": vis["template"],
            "hidden_template": vis["hidden_template"],
            "effects": vis["effects"],
            "model": vis.get("model", ""),
        }

        items.append({
            "market_id": mi.id, "price": mi.price, "created_at": mi.created_at,
            "name": inv.name, "rarity": inv.rarity, "exquisite": bool(inv.exquisite),
            "grade": inv.grade, "wear": round(inv.wear_bp/100, 2), "serial": inv.serial, "inv_id": inv.id,
            "template": vis["template"],
            "hidden_template": vis["hidden_template"],
            "effects": vis["effects"],
            "model": vis.get("model", ""),
            "season": inv.season or (skin_map.get(inv.skin_id).season if skin_map.get(inv.skin_id) else ""),
            "visual": visual_payload,
        })
    if changed:
        db.commit()
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
                  season: Optional[str] = None,
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
    season_key = _normalize_season(season)
    if season_key:
        q = q.filter(func.upper(Inventory.season) == season_key)

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

    rows = q.all()
    skin_ids = {inv.skin_id for _, inv, _ in rows if inv.skin_id}
    skin_map = {}
    if skin_ids:
        for s in db.query(Skin).filter(Skin.skin_id.in_(skin_ids)).all():
            skin_map[s.skin_id] = s
    out: List[MarketBrowseOut] = []
    changed = False
    for mi, inv, seller in rows:
        vis = ensure_visual(inv, skin_map.get(inv.skin_id))
        changed = changed or vis["changed"]
        visual_payload = {
            "body": vis["body"],
            "attachments": vis["attachments"],
            "template": vis["template"],
            "hidden_template": vis["hidden_template"],
            "effects": vis["effects"],
            "model": vis.get("model", ""),
        }

        out.append(MarketBrowseOut(
            id=mi.id, inv_id=inv.id, seller=seller.username, price=mi.price,
            name=inv.name, skin_id=inv.skin_id, rarity=inv.rarity,
            exquisite=bool(inv.exquisite), grade=inv.grade,
            wear=round(inv.wear_bp/100, 2), serial=inv.serial, created_at=mi.created_at,
            template=vis["template"], hidden_template=vis["hidden_template"],
            effects=vis["effects"], visual=visual_payload,
            season=inv.season or (skin_map.get(inv.skin_id).season if skin_map.get(inv.skin_id) else ""),
            model=vis.get("model", ""),
        ))
    if changed:
        db.commit()
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
    gift_spent = min(int(user.gift_coin_balance or 0), mi.price)
    if gift_spent > 0:
        user.gift_coin_balance -= gift_spent
    seller.coins += mi.price
    record_trade(
        db,
        seller.id,
        "skin",
        "sell",
        inv.name or inv.skin_id,
        1,
        mi.price,
        mi.price,
        mi.price,
        season=inv.season or "",
    )
    record_trade(
        db,
        user.id,
        "skin",
        "buy",
        inv.name or inv.skin_id,
        1,
        mi.price,
        mi.price,
        0,
        season=inv.season or "",
    )

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

def _get_auth_mode_flag() -> bool:
    con = _conn(); cur = con.cursor()
    cur.execute("SELECT value FROM system_settings WHERE key=?", (AUTH_MODE_KEY,))
    row = cur.fetchone()
    con.close()
    if not row:
        return True
    return str(row["value"]) != "0"

def _set_auth_mode_flag(flag: bool):
    con = _conn(); cur = con.cursor()
    cur.execute(
        "REPLACE INTO system_settings(key, value) VALUES (?, ?)",
        (AUTH_MODE_KEY, "1" if flag else "0")
    )
    con.commit(); con.close()

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

@ext.get("/admin/auth-mode")
def admin_auth_mode(admin=_Depends(_require_admin)):
    return {"verification_free": _get_auth_mode_flag()}

@ext.post("/admin/auth-mode")
def admin_set_auth_mode(payload: dict, admin=_Depends(_require_admin)):
    raw = (payload or {}).get("verification_free")
    if isinstance(raw, str):
        flag = raw.strip().lower() in ("1", "true", "yes", "on")
    else:
        flag = bool(raw)
    _set_auth_mode_flag(flag)
    return {"ok": True, "verification_free": flag}

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

@ext.get("/admin/user-inventory")
def admin_user_inventory(username: str, admin=_Depends(_require_admin)):
    uname = (username or "").strip()
    if not uname:
        raise _HTTPException(400, "username required")

    with SessionLocal() as db:
        user = db.query(User).filter_by(username=uname).first()
        if not user:
            raise _HTTPException(404, "user not found")

        bricks = db.query(Inventory).filter_by(user_id=user.id, rarity="BRICK").order_by(Inventory.acquired_at.desc()).all()
        exquisite = 0
        premium = 0
        changed = False
        items: List[Dict[str, Any]] = []
        for inv in bricks:
            vis = ensure_visual(inv)
            changed = changed or vis.get("changed")
            is_exquisite = bool(inv.exquisite)
            if is_exquisite:
                exquisite += 1
            else:
                premium += 1
            visual_payload = {
                "body": vis["body"],
                "attachments": vis["attachments"],
                "template": vis["template"],
                "hidden_template": vis["hidden_template"],
                "effects": vis["effects"],
            }
            items.append({
                "inv_id": inv.id,
                "name": inv.name,
                "serial": inv.serial,
                "exquisite": is_exquisite,
                "wear": round(inv.wear_bp / 100, 3),
                "grade": inv.grade,
                "template": vis["template"],
                "template_label": BRICK_TEMPLATE_LABELS.get(vis["template"], vis["template"] or "无模板"),
                "effects": vis["effects"],
                "visual": visual_payload,
            })
        if changed:
            db.commit()

    return {
        "username": uname,
        "brick_total": len(items),
        "exquisite_count": exquisite,
        "premium_count": premium,
        "items": items,
    }

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
