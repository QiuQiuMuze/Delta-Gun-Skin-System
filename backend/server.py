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
import time, os, secrets, jwt, re, json, random, math, hashlib

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

WEAPON_NAME_ALIASES = {
    "沙漠之鹰手枪": "deserteagle",
    "腾龙突击步枪": "tenglong",
    "莫辛纳甘步枪": "mosin",
}


def _slug_weapon_name(name: str) -> str:
    if not name:
        return ""
    name = name.strip()
    if not name:
        return ""
    alias = WEAPON_NAME_ALIASES.get(name)
    if alias:
        return alias
    lowered = name.lower()
    slug = re.sub(r"[^a-z0-9]+", "_", lowered).strip("_")
    slug = re.sub(r"_+", "_", slug)
    return slug


def _resolve_model_key(provided: str, skin: Optional[Skin]) -> str:
    if skin and skin.weapon:
        slug = _slug_weapon_name(skin.weapon)
        if slug:
            return slug
    normalized = (provided or "").strip().lower()
    return normalized

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
    season = Column(String, default="")


class UserPresence(Base):
    __tablename__ = "user_presence"
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    username = Column(String, nullable=False)
    page = Column(String, default="")
    activity = Column(String, default="")
    detail = Column(Text, default="{}")
    last_seen = Column(Integer, default=lambda: int(time.time()))


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


class UserSeasonPity(Base):
    __tablename__ = "user_season_pity"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    season = Column(String, nullable=False, default="")
    pity_brick = Column(Integer, nullable=False, default=0)
    pity_purple = Column(Integer, nullable=False, default=0)
    __table_args__ = (UniqueConstraint("user_id", "season", name="uq_user_season_pity"),)

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


def _ensure_brick_buy_columns():
    con = sqlite3.connect(DB_PATH_FS)
    cur = con.cursor()
    cur.execute("PRAGMA table_info(brick_buy_orders)")
    cols = {row[1] for row in cur.fetchall()}
    if "season" not in cols:
        cur.execute("ALTER TABLE brick_buy_orders ADD COLUMN season TEXT NOT NULL DEFAULT ''")
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
_ensure_brick_buy_columns()
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


class CultivationBeginIn(BaseModel):
    talents: List[str]
    attributes: Dict[str, int]
    origin: str
    sect: str
    master: str


class CultivationAdvanceIn(BaseModel):
    choice: str


class PresenceUpdateIn(BaseModel):
    page: str
    activity: str
    details: Optional[Dict[str, Any]] = None

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
    template_label: str = ""
    hidden_template: bool
    effects: List[str]
    effect_labels: List[str] = []
    affinity: Dict[str, Any] = {}
    affinity_label: str = ""
    affinity_tag: str = ""
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


TEMPLATE_LABEL_LOOKUP: Dict[str, str] = {
    "brick_normal": "标准模板",
    "brick_white_diamond": "白钻切面",
    "brick_yellow_diamond": "黄钻切面",
    "brick_pink_diamond": "粉钻切面",
    "brick_brushed_metal": "金属拉丝",
    "brick_laser_gradient": "镭射渐变",
    "brick_prism_spectrum": "棱镜光谱",
    "brick_medusa_relic": "蛇神遗痕",
    "brick_arcade_crystal": "水晶贪吃蛇",
    "brick_arcade_serpent": "像素贪吃蛇",
    "brick_arcade_blackhawk": "街机黑鹰",
    "brick_arcade_champion": "拳王",
    "brick_arcade_default": "电玩标准",
    "brick_blade_royal": "王牌镶嵌",
    "brick_fate_blueberry": "蓝莓玉",
    "brick_fate_brass": "黄铜",
    "brick_fate_default": "命运经典",
    "brick_fate_gold": "黄金",
    "brick_fate_goldenberry": "金莓",
    "brick_fate_gradient": "命运渐变",
    "brick_fate_jade": "翡翠绿",
    "brick_fate_metal": "金属拉丝",
    "brick_fate_strawberry": "草莓金",
    "brick_fate_whitepeach": "白桃",
    "brick_prism2_flux": "棱镜攻势2",
    "brick_weather_clathrate": "可燃冰",
    "brick_weather_default": "气象标准",
    "brick_weather_gradient": "气象渐变",
    "brick_weather_gundam": "高达气象",
    "brick_weather_purplebolt": "紫电",
    "brick_weather_redbolt": "红电",
    "prism_flux": "棱镜流光",
    "ember_strata": "余烬分层",
    "ion_tessellate": "离子镶嵌",
    "diamond_veil": "钻石面纱",
    "aurora_matrix": "极光矩阵",
    "nebula_glass": "星云玻璃",
    "ion_glaze": "离子釉彩",
    "vapor_trace": "雾态轨迹",
    "phase_shift": "相位位移",
    "urban_mesh": "都市网格",
    "fiber_wave": "纤维波纹",
    "midnight_line": "午夜线条",
    "field_classic": "野战经典",
    "steel_ridge": "钢脊纹",
    "matte_guard": "哨卫磨砂",
}


EFFECT_LABEL_LOOKUP: Dict[str, str] = {
    "glow": "辉光涌动",
    "pulse": "能量脉冲",
    "sheen": "流光泛映",
    "sparkle": "星火闪烁",
    "trail": "残影拖尾",
    "refraction": "晶体折射",
    "flux": "相位流动",
    "prism_flux": "棱镜流光",
    "bold_tracer": "显眼曳光",
    "kill_counter": "击杀计数",
    "arcade_core": "街机核心",
    "arcade_glass": "街机玻璃",
    "arcade_glow": "街机辉光",
    "arcade_pulse": "街机脉冲",
    "arcade_trail": "街机拖尾",
    "blade_glow": "王牌辉光",
    "chromatic_flame": "彩焰",
    "fate_glow": "命运辉光",
    "fate_gradient": "命运渐变",
    "medusa_glare": "美杜莎凝视",
    "weather_bolt": "天气闪电",
    "weather_frost": "气象霜华",
    "weather_glow": "气象辉光",
    "weather_gradient": "气象渐变",
    "affinity:weather:acid_rain": "酸雨属性",
    "affinity:weather:thunder": "雷电属性",
    "affinity:weather:flame": "火焰属性",
    "affinity:weather:frost": "冰霜属性",
}


for _season in SEASON_DEFINITIONS:
    for _group in ("bricks", "purples", "blues", "greens"):
        for _skin in _season.get(_group, []) or []:
            meta = (_skin.get("meta") or {})
            for _rule in meta.get("template_rules", []) or []:
                key = str(_rule.get("key") or "").lower()
                label = _rule.get("label")
                if key and label and key not in TEMPLATE_LABEL_LOOKUP:
                    TEMPLATE_LABEL_LOOKUP[key] = label

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
    if LATEST_SEASON:
        return LATEST_SEASON
    return BRICK_SEASON_FALLBACK


def _season_pity_key(season: Optional[str]) -> str:
    key = _normalize_season(season)
    if key:
        return key
    return _brick_season_key(None)


def _ensure_season_pity_row(
    db: Session,
    user_id: int,
    season_key: str,
    *,
    user: Optional[User] = None,
) -> UserSeasonPity:
    row = db.query(UserSeasonPity).filter_by(user_id=user_id, season=season_key).first()
    if row:
        return row
    default_key = _brick_season_key(None)
    pity_brick = 0
    pity_purple = 0
    existing = db.query(UserSeasonPity).filter_by(user_id=user_id).count()
    if user is None:
        user = db.query(User).filter_by(id=user_id).first()
    if existing == 0 and user is not None and season_key == default_key:
        pity_brick = int(user.pity_brick or 0)
        pity_purple = int(user.pity_purple or 0)
    row = UserSeasonPity(
        user_id=user_id,
        season=season_key,
        pity_brick=int(pity_brick),
        pity_purple=int(pity_purple),
    )
    db.add(row)
    db.flush()
    return row


def get_user_season_pity(db: Session, user: User, season: Optional[str]) -> UserSeasonPity:
    key = _season_pity_key(season)
    return _ensure_season_pity_row(db, user.id, key, user=user)


def sync_user_global_pity(user: User, season_key: str, row: UserSeasonPity) -> None:
    default_key = _brick_season_key(None)
    if season_key == default_key:
        user.pity_brick = int(row.pity_brick or 0)
        user.pity_purple = int(row.pity_purple or 0)


def _season_display_name(season: str) -> str:
    if not season or season == BRICK_SEASON_FALLBACK:
        if LATEST_SEASON:
            entry_latest = SEASON_LOOKUP.get(LATEST_SEASON)
            if entry_latest:
                return entry_latest.get("name", LATEST_SEASON)
        return "默认赛季"
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


def _normalize_user_bricks(db: Session, user_id: int) -> None:
    """将旧版未标记赛季的砖余额并入最新赛季。"""
    if not LATEST_SEASON:
        return
    fallback = db.query(UserBrickBalance).filter_by(
        user_id=user_id, season=BRICK_SEASON_FALLBACK
    ).first()
    if not fallback:
        return
    qty = int(fallback.quantity or 0)
    gifts = int(fallback.gift_locked or 0)
    if qty <= 0 and gifts <= 0:
        return
    latest_row = _ensure_brick_balance_row(db, user_id, LATEST_SEASON)
    latest_row.quantity = int(latest_row.quantity or 0) + qty
    latest_row.gift_locked = int(latest_row.gift_locked or 0) + gifts
    fallback.quantity = 0
    fallback.gift_locked = 0
    db.flush()


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
    _normalize_user_bricks(db, user.id)
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
    _normalize_user_bricks(db, user.id)
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
    _normalize_user_bricks(db, user.id)
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
    _normalize_user_bricks(db, user_id)
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
        if int(info.get("quantity", 0)) <= 0 and int(info.get("gift_locked", 0)) <= 0:
            continue
        display_key = _brick_season_key(season)
        detail.append({
            "season": "" if display_key == BRICK_SEASON_FALLBACK else display_key,
            "season_key": display_key,
            "name": _season_display_name(display_key),
            "count": info["quantity"],
            "gift_locked": info["gift_locked"],
        })
    # Include any extra seasons not in SEASON_IDS
    for season, info in balances.items():
        if season in seen:
            continue
        if int(info.get("quantity", 0)) <= 0 and int(info.get("gift_locked", 0)) <= 0:
            continue
        display_key = _brick_season_key(season)
        detail.append({
            "season": "" if display_key == BRICK_SEASON_FALLBACK else display_key,
            "season_key": display_key,
            "name": _season_display_name(display_key),
            "count": info["quantity"],
            "gift_locked": info["gift_locked"],
        })
    return detail


def season_pity_detail(db: Session, user_id: int) -> List[Dict[str, Any]]:
    rows = db.query(UserSeasonPity).filter_by(user_id=user_id).all()
    if not rows:
        return []
    ordered = list(SEASON_IDS)
    default_key = _brick_season_key(None)
    if default_key and default_key not in ordered:
        ordered.append(default_key)
    seen: set[str] = set()
    detail: List[Dict[str, Any]] = []

    def _append(row: UserSeasonPity):
        key = _brick_season_key(row.season)
        detail.append({
            "season": "" if key == BRICK_SEASON_FALLBACK else key,
            "season_key": key,
            "name": _season_display_name(key),
            "pity_brick": int(row.pity_brick or 0),
            "pity_purple": int(row.pity_purple or 0),
        })
        seen.add(key)

    for key in ordered:
        for row in rows:
            row_key = _brick_season_key(row.season)
            if row_key == key and row_key not in seen:
                _append(row)
                break

    for row in rows:
        row_key = _brick_season_key(row.season)
        if row_key in seen:
            continue
        _append(row)

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

def _normalize_affinity_config(meta: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    conf = meta.get("weather_attributes") if isinstance(meta, dict) else None
    if not isinstance(conf, dict):
        return None
    type_key = str(conf.get("type") or "weather").strip().lower() or "weather"
    pool_raw = conf.get("pool") or []
    pool: List[Tuple[str, str]] = []
    for entry in pool_raw:
        if isinstance(entry, dict):
            key = str(entry.get("key") or "").strip().lower()
            label = str(entry.get("label") or "").strip() or key
        else:
            key = str(entry or "").strip().lower()
            label = key
        if key:
            pool.append((key, label))
    if not pool:
        return None
    overrides: Dict[str, str] = {}
    raw_overrides = conf.get("template_overrides") or {}
    if isinstance(raw_overrides, dict):
        for tpl, value in raw_overrides.items():
            tpl_key = str(tpl or "").strip().lower()
            val_key = str(value or "").strip().lower()
            if tpl_key and val_key:
                overrides[tpl_key] = val_key
    return {"type": type_key, "pool": pool, "overrides": overrides}

def _affinity_info_from_key(config: Dict[str, Any], key: str) -> Dict[str, str]:
    for pool_key, label in config.get("pool", []):
        if pool_key == key:
            return {"type": config.get("type", "weather"), "key": key, "label": label}
    return {"type": config.get("type", "weather"), "key": key, "label": key}

def _parse_affinity_tag(tag: str) -> Optional[Tuple[str, str]]:
    if not tag:
        return None
    parts = str(tag).split(":")
    if len(parts) < 3:
        return None
    head = parts[0].strip().lower()
    if head != "affinity":
        return None
    return parts[1].strip().lower(), parts[2].strip().lower()

def _affinity_tag(info: Dict[str, str]) -> str:
    return f"affinity:{info.get('type', 'weather')}:{info.get('key', '')}"

def _pick_affinity(
    config: Optional[Dict[str, Any]],
    template_key: str = "",
    *,
    deterministic_seed: Optional[int] = None,
) -> Optional[Dict[str, str]]:
    if not config:
        return None
    tpl = str(template_key or "").strip().lower()
    if tpl and tpl in config.get("overrides", {}):
        key = config["overrides"][tpl]
        return _affinity_info_from_key(config, key)
    pool = config.get("pool", [])
    if not pool:
        return None
    if deterministic_seed is not None:
        idx = int(abs(deterministic_seed)) % len(pool)
        key = pool[idx][0]
        return _affinity_info_from_key(config, key)
    key, _label = secrets.choice(pool)
    return _affinity_info_from_key(config, key)

def _affinity_info_from_tag(
    config: Optional[Dict[str, Any]],
    tag: str,
) -> Optional[Dict[str, str]]:
    parsed = _parse_affinity_tag(tag)
    if not parsed:
        return None
    tag_type, tag_key = parsed
    if config and tag_type == config.get("type"):
        return _affinity_info_from_key(config, tag_key)
    label = tag_key
    return {"type": tag_type or "weather", "key": tag_key, "label": label}

def generate_visual_profile(
    rarity: str,
    exquisite: bool,
    *,
    model_key: str = "",
    skin: Optional[Skin] = None,
) -> Dict[str, object]:
    rarity = (rarity or "").upper()
    meta = skin_meta_dict(skin)
    base_model_key = model_key or (skin.model_key if skin else "")
    model = _resolve_model_key(base_model_key, skin)
    if not model:
        model = "assault"
    affinity_config = _normalize_affinity_config(meta)
    affinity_payload: Optional[Dict[str, str]] = None

    body = _resolve_palette(meta.get("body_colors"))
    if not body:
        layers = 2 if secrets.randbelow(100) < 55 else 1
        body = [_pick_color() for _ in range(layers)]

    attachments = _resolve_palette(meta.get("attachment_colors"))
    if not attachments:
        attachments = [_pick_color()]

    template_key = ""
    template_label = ""
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
            template_label = str(rule.get("label") or "")
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
        if affinity_config:
            picked_affinity = _pick_affinity(affinity_config, template_key)
            if picked_affinity:
                affinity_payload = picked_affinity
                effects.append(_affinity_tag(picked_affinity))
    else:
        eff_conf = meta.get("effects")
        if isinstance(eff_conf, dict):
            key = "exquisite" if exquisite else "premium"
            effects.extend(eff_conf.get(key, []))
        elif isinstance(eff_conf, list):
            effects.extend(eff_conf)

    effects = _unique_list(effects)
    if affinity_config:
        for tag in effects:
            info = _affinity_info_from_tag(affinity_config, tag)
            if info:
                affinity_payload = info
                break
    if not template_label and template_key:
        template_label = TEMPLATE_LABEL_LOOKUP.get(str(template_key).lower(), "")
    effect_labels = [
        EFFECT_LABEL_LOOKUP.get(str(tag).lower(), str(tag))
        for tag in effects
    ]

    payload = {
        "body": body,
        "attachments": attachments,
        "template": template_key,
        "hidden_template": hidden_template,
        "effects": effects,
        "model": model,
        "template_label": template_label,
        "effect_labels": effect_labels,
    }
    if affinity_payload:
        payload["affinity"] = affinity_payload
        payload["affinity_tag"] = _affinity_tag(affinity_payload)
        payload["affinity_label"] = affinity_payload.get("label", "")
    return payload


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
    if not isinstance(effects, list):
        if isinstance(effects, (tuple, set)):
            effects = list(effects)
        elif effects:
            effects = [effects]
        else:
            effects = []
    template = inv.template_name or ""
    hidden_template = bool(inv.hidden_template)
    changed = False

    rarity = (inv.rarity or "").upper()
    model_key = inv.model_key or ""
    if not model_key and skin:
        model_key = skin.model_key or ""
    meta = skin_meta_dict(skin)
    affinity_config = _normalize_affinity_config(meta)
    affinity_info: Optional[Dict[str, str]] = None
    affinity_tag = None
    if affinity_config:
        for tag in effects:
            info = _affinity_info_from_tag(affinity_config, tag)
            if info:
                affinity_info = info
                affinity_tag = _affinity_tag(info)
                break

    if rarity == "BRICK":
        if not body or not attachments or template not in BRICK_TEMPLATES:
            profile = generate_visual_profile(inv.rarity, bool(inv.exquisite), model_key=model_key, skin=skin)
            body = profile["body"]
            attachments = profile["attachments"]
            template = profile["template"]
            effects = profile["effects"]
            hidden_template = False
            affinity_info = profile.get("affinity") if isinstance(profile, dict) else None
            affinity_tag = profile.get("affinity_tag") if isinstance(profile, dict) else None
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
            affinity_info = profile.get("affinity") if isinstance(profile, dict) else affinity_info
            affinity_tag = profile.get("affinity_tag") if isinstance(profile, dict) else affinity_tag
            inv.body_colors = json.dumps(body, ensure_ascii=False)
            inv.attachment_colors = json.dumps(attachments, ensure_ascii=False)
            inv.template_name = template
            inv.effect_tags = json.dumps(effects, ensure_ascii=False)
            inv.hidden_template = 0
            inv.model_key = profile.get("model", model_key)
            model_key = inv.model_key
            changed = True
        if affinity_config and not affinity_info:
            deterministic_seed = None
            try:
                raw = f"{inv.id}:{inv.user_id}:{inv.skin_id}:{template}"
                digest = hashlib.sha256(raw.encode()).hexdigest()
                deterministic_seed = int(digest[:16], 16)
            except Exception:
                deterministic_seed = None
            picked = _pick_affinity(affinity_config, template, deterministic_seed=deterministic_seed)
            if picked:
                affinity_info = picked
                affinity_tag = _affinity_tag(picked)
        desired_effects = ["sheen"]
        if bool(inv.exquisite):
            desired_effects.extend(["bold_tracer", "kill_counter"])
        if affinity_tag:
            desired_attrs = [affinity_tag]
        else:
            desired_attrs = []
        if effects != desired_effects:
            existing_attrs = [tag for tag in effects if _parse_affinity_tag(tag)]
            effects = desired_effects + (existing_attrs or desired_attrs)
            inv.effect_tags = json.dumps(effects, ensure_ascii=False)
            changed = True
        else:
            extra_attrs = [tag for tag in effects if _parse_affinity_tag(tag)]
            if not extra_attrs and affinity_tag:
                effects = desired_effects + [affinity_tag]
                inv.effect_tags = json.dumps(effects, ensure_ascii=False)
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

    if affinity_config and not affinity_info:
        for tag in effects:
            info = _affinity_info_from_tag(affinity_config, tag)
            if info:
                affinity_info = info
                affinity_tag = _affinity_tag(info)
                break

    template_label = TEMPLATE_LABEL_LOOKUP.get(str(template).lower(), "") if template else ""
    effect_labels = [
        EFFECT_LABEL_LOOKUP.get(str(tag).lower(), str(tag))
        for tag in effects
    ]
    return {
        "body": body,
        "attachments": attachments,
        "template": template,
        "template_label": template_label,
        "hidden_template": hidden_template,
        "effects": effects,
        "effect_labels": effect_labels,
        "model": model_key,
        "affinity": affinity_info,
        "affinity_tag": affinity_tag,
        "affinity_label": affinity_info.get("label") if affinity_info else "",
        "changed": changed,
    }


# ------------------ Cookie Factory Mini-game ------------------
COOKIE_FACTORY_SETTING_KEY = "cookie_factory_enabled"
COOKIE_CULTIVATION_SETTING_KEY = "cookie_cultivation_enabled"
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

COOKIE_CULTIVATION_KEY = "cultivation"
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
    COOKIE_CULTIVATION_KEY: {
        "name": "模拟修仙",
        "icon": "🧘",
        "points": 8,
        "threshold": 1,
        "cps_bonus": 0.0,
        "sugar_cost": 0,
        "desc": "闭关悟道、奇遇不断，完成整场修仙历练即可获得故事结局与得分。",
        "score_threshold": 160,
    },
}


CULTIVATION_STAT_KEYS = [
    ("body", "体魄"),
    ("mind", "悟性"),
    ("spirit", "心性"),
    ("luck", "气运"),
]

CULTIVATION_TALENT_RARITIES = {
    "blue": {"label": "蓝", "tone": "rare-blue"},
    "purple": {"label": "紫", "tone": "rare-purple"},
    "gold": {"label": "金", "tone": "rare-gold"},
}

CULTIVATION_TALENTS = [
    {
        "id": "iron_body",
        "name": "金刚体魄",
        "rarity": "blue",
        "desc": "体魄 +3，战斗时所受伤害降低",
        "effects": {"body": 3},
        "flags": {"combat_resist": 0.5},
    },
    {
        "id": "sage_mind",
        "name": "悟道奇才",
        "rarity": "blue",
        "desc": "悟性 +3，闭关悟道成功率提升",
        "effects": {"mind": 3},
        "flags": {"insight_bonus": 0.15},
    },
    {
        "id": "serene_heart",
        "name": "静心如水",
        "rarity": "blue",
        "desc": "心性 +2，失败损失减少",
        "effects": {"spirit": 2},
        "flags": {"setback_reduce": 4},
    },
    {
        "id": "child_of_luck",
        "name": "气运之子",
        "rarity": "purple",
        "desc": "气运 +4，奇遇收益提升",
        "effects": {"luck": 4},
        "flags": {"chance_bonus": 0.25},
    },
    {
        "id": "alchemy_adept",
        "name": "丹道新星",
        "rarity": "blue",
        "desc": "首次炼丹事件必定成功并悟性 +1",
        "effects": {"mind": 1},
        "flags": {"alchemy_mastery": 1},
    },
    {
        "id": "sword_soul",
        "name": "剑魂共鸣",
        "rarity": "purple",
        "desc": "战斗成功奖励提升，体魄 +1，悟性 +1",
        "effects": {"body": 1, "mind": 1},
        "flags": {"combat_bonus": 0.2},
    },
    {
        "id": "phoenix_nirvana",
        "name": "凤凰涅槃",
        "rarity": "gold",
        "weight": 0.05,
        "desc": "寿元 +20，濒死时有较高概率重生，浴火后全属性微增",
        "effects": {"body": 1, "mind": 1, "spirit": 1},
        "flags": {"lifespan_bonus": 20, "resurrection": 0.35},
    },
    {
        "id": "spirit_talker",
        "name": "灵识敏锐",
        "rarity": "blue",
        "desc": "心性 +3，可预判风险",
        "effects": {"spirit": 3},
        "flags": {"hazard_hint": 1},
    },
    {
        "id": "stellar_pupil",
        "name": "星眸洞天",
        "rarity": "purple",
        "desc": "悟性 +2，心性 +1，洞察天机",
        "effects": {"mind": 2, "spirit": 1},
        "flags": {"insight_bonus": 0.1, "chance_bonus": 0.1},
    },
    {
        "id": "dragon_resolve",
        "name": "龙胆战意",
        "rarity": "purple",
        "desc": "体魄 +2，战斗获得额外积分",
        "effects": {"body": 2},
        "flags": {"combat_bonus": 0.35},
    },
    {
        "id": "pure_lotus",
        "name": "青莲道心",
        "rarity": "gold",
        "weight": 0.08,
        "desc": "心性 +4，悟性 +2，降低失败损耗",
        "effects": {"spirit": 4, "mind": 2},
        "flags": {"setback_reduce": 6, "insight_bonus": 0.12},
    },
    {
        "id": "fortune_thread",
        "name": "命星牵引",
        "rarity": "blue",
        "desc": "气运 +2，遭遇奇遇时额外获利",
        "effects": {"luck": 2},
        "flags": {"chance_bonus": 0.18},
    },
    {
        "id": "unyielding_spirit",
        "name": "不屈意志",
        "rarity": "purple",
        "desc": "体魄 +1，心性 +2，低血量时抗性提升",
        "effects": {"body": 1, "spirit": 2},
        "flags": {"combat_resist": 0.35, "setback_reduce": 3},
    },
    {
        "id": "herbal_sage",
        "name": "灵草心语",
        "rarity": "blue",
        "desc": "悟性 +1，气运 +1，遇到丹药相关奇遇时奖励提升",
        "effects": {"mind": 1, "luck": 1},
        "flags": {"chance_bonus": 0.12, "alchemy_mastery": 0.5},
    },
    {
        "id": "moonlit_stride",
        "name": "月影流光",
        "rarity": "blue",
        "desc": "体魄 +1，气运 +1，探索事件中所受损耗略减",
        "effects": {"body": 1, "luck": 1},
        "flags": {"combat_resist": 0.2, "setback_reduce": 2},
    },
    {
        "id": "void_whisper",
        "name": "虚空耳语",
        "rarity": "purple",
        "desc": "悟性 +1，心性 +2，随机机缘质量提升",
        "effects": {"mind": 1, "spirit": 2},
        "flags": {"chance_bonus": 0.22, "insight_bonus": 0.08},
    },
    {
        "id": "dragon_scale_guard",
        "name": "龙麟护体",
        "rarity": "purple",
        "desc": "体魄 +3，战斗与劫难事件中伤害大幅降低",
        "effects": {"body": 3},
        "flags": {"combat_resist": 0.6},
    },
    {
        "id": "celestial_benediction",
        "name": "天衍赐福",
        "rarity": "gold",
        "weight": 0.06,
        "desc": "气运 +3，悟性 +2，奇遇获得额外奖励并减少劫难",
        "effects": {"luck": 3, "mind": 2},
        "flags": {"chance_bonus": 0.3, "setback_reduce": 4},
    },
]

CULTIVATION_TALENT_ROLLS = 4
CULTIVATION_BASE_POINTS = 10
CULTIVATION_MAX_TALENTS = 3
CULTIVATION_REFRESH_COUNT = 5
CULTIVATION_STAGE_NAMES = ["凡人", "炼气", "筑基", "金丹", "元婴", "化神", "飞升"]
CULTIVATION_STAGE_THRESHOLDS = [320, 780, 1380, 2100, 2980, 4100]
CULTIVATION_PROGRESS_SCALE = 0.16
CULTIVATION_PROGRESS_STAT_WEIGHT = 1.15
CULTIVATION_SCORE_SCALE = 0.5
CULTIVATION_SCORE_STAT_WEIGHT = 1.0
CULTIVATION_SUCCESS_BASE = 0.26
CULTIVATION_SUCCESS_STAT_WEIGHT = 0.018
CULTIVATION_SUCCESS_LUCK_WEIGHT = 0.006
CULTIVATION_TRIAL_DELAY_MS = 5000

CULTIVATION_TRIALS = [
    {
        "id": "sect_exam",
        "name": "宗门大比",
        "stat": "mind",
        "stage_min": 1,
        "age_min": 80,
        "difficulty": 21,
        "description": "宗门举办大比，淘汰惰怠弟子，只留意志坚定者。",
        "hint": "悟性与心性决定能否被宗门认可。",
        "success": {"progress": (360, 440), "score": (280, 360), "health": (-20, -8)},
        "failure": {
            "ending_type": "trial_exam",
            "log": "【挫败】宗门大比中被刷落，只得黯然离去。",
        },
    },
    {
        "id": "demon_ambush",
        "name": "魔修围猎",
        "stat": "body",
        "stage_min": 3,
        "age_min": 220,
        "difficulty": 29,
        "description": "外出历练遭遇魔修伏击，唯有强悍体魄方能闯出生天。",
        "hint": "体魄与战意决定能否突围。",
        "success": {"progress": (480, 600), "score": (360, 500), "health": (-36, -14)},
        "failure": {
            "ending_type": "trial_ambush",
            "log": "【殒落】力竭被魔修重创，功亏一篑。",
        },
    },
    {
        "id": "heaven_tribulation",
        "name": "九重天劫",
        "stat": "spirit",
        "stage_min": 5,
        "age_min": 360,
        "difficulty": 36,
        "description": "化神圆满之际九重雷劫降世，需以心神和气运守住生机。",
        "hint": "心性与气运合一，方能渡过天威。",
        "success": {"progress": (620, 780), "score": (480, 660), "health": (-54, -24)},
        "failure": {
            "ending_type": "trial_tribulation",
            "log": "【劫灭】天威浩荡，肉身神魂俱灭。",
        },
    },
]

CULTIVATION_STATUS_LABELS = {1: "寒门出身", 2: "世家子弟", 3: "仙门传承"}

CULTIVATION_ORIGINS = [
    {
        "id": "mortal",
        "name": "凡尘平民",
        "desc": "家境清寒，自幼劳作锻体。",
        "status": 1,
        "stats": {"body": 1},
        "coins": 45,
    },
    {
        "id": "bureaucrat",
        "name": "官宦人家",
        "desc": "诗书礼仪熏陶，心志坚定。",
        "status": 2,
        "stats": {"mind": 1, "spirit": 1},
        "coins": 70,
    },
    {
        "id": "merchant",
        "name": "富商子弟",
        "desc": "财力雄厚，善于交际权衡。",
        "status": 2,
        "stats": {"luck": 2},
        "coins": 110,
    },
    {
        "id": "cultivator",
        "name": "修仙世家",
        "desc": "灵脉滋养，天赋卓绝。",
        "status": 3,
        "stats": {"mind": 1, "spirit": 2},
        "coins": 90,
        "flags": {"insight_bonus": 0.05},
    },
]

CULTIVATION_SECTS = [
    {
        "id": "azure_sword",
        "name": "青虚剑宗",
        "motto": "剑意通霄，斩尽尘埃",
        "min_status": 2,
        "stats": {"body": 2, "mind": 1},
        "coins": 20,
        "flags": {"combat_bonus": 0.1},
    },
    {
        "id": "emerald_palace",
        "name": "玉衡仙宫",
        "motto": "星辉为引，度化群生",
        "min_status": 3,
        "stats": {"mind": 2, "spirit": 1},
        "coins": 10,
        "flags": {"insight_bonus": 0.1},
    },
    {
        "id": "thunder_valley",
        "name": "雷泽谷",
        "motto": "万雷淬体，唯强者立",
        "min_status": 1,
        "stats": {"body": 2},
        "coins": 25,
        "flags": {"combat_resist": 0.2},
    },
    {
        "id": "moon_temple",
        "name": "太阴月殿",
        "motto": "月华如练，静照诸天",
        "min_status": 2,
        "stats": {"spirit": 2, "mind": 1},
        "coins": 15,
        "flags": {"setback_reduce": 3},
    },
    {
        "id": "spirit_pavilion",
        "name": "灵木山亭",
        "motto": "万木成灵，心念向善",
        "min_status": 1,
        "stats": {"spirit": 1},
        "coins": 18,
        "flags": {"hazard_hint": 1},
    },
    {
        "id": "wandering",
        "name": "浮空散修盟",
        "motto": "天地为师，逍遥游",
        "min_status": 1,
        "stats": {"luck": 1},
        "coins": 30,
        "flags": {"chance_bonus": 0.08},
    },
]

CULTIVATION_MASTERS = [
    {
        "id": "lingxiao",
        "name": "凌霄真君",
        "title": "剑道长老",
        "motto": "以无畏之心破万劫",
        "sect": "azure_sword",
        "min_status": 2,
        "stats": {"body": 1, "mind": 1},
        "flags": {"combat_bonus": 0.15},
        "coins": 10,
        "traits": ["剑道加成", "战斗收益提升"],
    },
    {
        "id": "ziyue",
        "name": "紫月仙姝",
        "title": "月殿掌教",
        "motto": "静极生辉，心净自明",
        "sect": "moon_temple",
        "min_status": 2,
        "stats": {"spirit": 1, "mind": 1},
        "flags": {"setback_reduce": 4},
        "coins": 12,
        "traits": ["稳固心神", "减少失败损伤"],
    },
    {
        "id": "leiting",
        "name": "雷霆老祖",
        "title": "雷罚护法",
        "motto": "怒雷既出，邪祟皆灭",
        "sect": "thunder_valley",
        "min_status": 1,
        "stats": {"body": 1},
        "flags": {"combat_resist": 0.3},
        "coins": 8,
        "traits": ["减免战斗伤害"],
    },
    {
        "id": "lingsang",
        "name": "灵桑道人",
        "title": "灵木传人",
        "motto": "春风化雨，以德载道",
        "sect": "spirit_pavilion",
        "min_status": 1,
        "stats": {"spirit": 1},
        "flags": {"hazard_hint": 1},
        "coins": 6,
        "traits": ["先机洞察"],
    },
    {
        "id": "youchens",
        "name": "游尘散人",
        "title": "逍遥前辈",
        "motto": "天地无垠，步步皆景",
        "sect": "wandering",
        "min_status": 1,
        "stats": {"luck": 1},
        "flags": {"chance_bonus": 0.15},
        "coins": 16,
        "traits": ["机缘丰厚"],
    },
    {
        "id": "baiyan",
        "name": "白砚居士",
        "title": "星象推演师",
        "motto": "观星测命，以智开疆",
        "sect": "emerald_palace",
        "min_status": 3,
        "stats": {"mind": 2},
        "flags": {"insight_bonus": 0.15},
        "coins": 14,
        "traits": ["悟道奇才"],
    },
]

CULTIVATION_ARTIFACT_POOL = [
    {"name": "星河飞剑", "desc": "蕴含星辰之力，可破万法"},
    {"name": "玄光镜", "desc": "照见心魔，护持道心"},
    {"name": "雷霆战鼓", "desc": "激发真雷，一击震退强敌"},
    {"name": "紫霜佩铃", "desc": "摇动时凝聚寒霜守护周身"},
    {"name": "灵木法冠", "desc": "引动万木生机疗愈创伤"},
    {"name": "云海羽衣", "desc": "御风而行，千里瞬至"},
]

CULTIVATION_COMPANION_POOL = [
    {"name": "柳霜", "note": "剑修师姐", "desc": "行事干练，擅长指点剑道窍门"},
    {"name": "白起", "note": "雷谷师兄", "desc": "豪迈爽朗，总在危局前驱"},
    {"name": "顾清仪", "note": "炼丹妙手", "desc": "善以丹术疗伤，随时支援"},
    {"name": "封晚晴", "note": "月殿圣女", "desc": "心思缜密，擅长谋划布局"},
    {"name": "牧野", "note": "逍遥游侠", "desc": "行踪不定，却总能伸出援手"},
    {"name": "枝岚", "note": "灵木道灵", "desc": "化形木灵，能借自然庇护同伴"},
]

CULTIVATION_TECHNIQUE_POOL = [
    {"name": "紫霄御雷诀", "desc": "引动九霄神雷护体攻敌"},
    {"name": "星沉剑意", "desc": "以星辰轨迹推演剑势"},
    {"name": "太阴凝华术", "desc": "借月华凝炼心神稳固境界"},
    {"name": "木灵回春篇", "desc": "调动生机，重塑经脉活力"},
    {"name": "游龙步", "desc": "化身游龙，身形难以捕捉"},
    {"name": "玄心定神章", "desc": "熄灭杂念，抵御心魔侵蚀"},
]




class _SafeFormatDict(dict):
    def __missing__(self, key: str) -> str:
        return ""


def _choose_fragment(rng: random.Random, source: Any, context: Dict[str, Any]) -> str:
    if source is None:
        return ""
    if callable(source):
        return str(source(rng, context))
    if isinstance(source, dict):
        return _dynamic_text(source, context, rng)
    if isinstance(source, (list, tuple, set)):
        seq = list(source)
        if not seq:
            return ""
        choice = rng.choice(seq)
        return _choose_fragment(rng, choice, context)
    return str(source)


def _dynamic_text(spec: Optional[Dict[str, Any]], context: Dict[str, Any], rng: random.Random) -> str:
    if not spec:
        return ""
    templates = spec.get("templates")
    if not templates:
        return ""
    template = _choose_fragment(rng, templates, context)
    data = dict(context)
    for key, source in (spec.get("pools") or {}).items():
        data[key] = _choose_fragment(rng, source, data)
    return template.format_map(_SafeFormatDict(data))


CULTIVATION_DEFAULT_TONE = {
    "artifact": "highlight",
    "companion": "success",
    "technique": "highlight",
}


def _cultivation_random_artifact(rng: random.Random) -> Optional[Dict[str, Any]]:
    if not CULTIVATION_ARTIFACT_POOL:
        return None
    item = dict(rng.choice(CULTIVATION_ARTIFACT_POOL))
    name = item.get("name", "")
    desc = item.get("desc", "")
    log = f"【法宝】机缘获得{name}：{desc}。" if name else ""
    return {
        "type": "artifact",
        "name": name,
        "desc": desc,
        "log": log,
        "tone": CULTIVATION_DEFAULT_TONE.get("artifact", "highlight"),
    }


def _cultivation_random_companion(rng: random.Random) -> Optional[Dict[str, Any]]:
    if not CULTIVATION_COMPANION_POOL:
        return None
    item = dict(rng.choice(CULTIVATION_COMPANION_POOL))
    name = item.get("name", "")
    note = item.get("note", "")
    desc = item.get("desc", "")
    note_text = f"（{note}）" if note else ""
    detail = f" {desc}" if desc else ""
    log = f"【道友】与{name}{note_text}结为同道。{detail}".strip()
    return {
        "type": "companion",
        "name": name,
        "note": note,
        "desc": desc,
        "log": log,
        "tone": CULTIVATION_DEFAULT_TONE.get("companion", "success"),
    }


def _cultivation_random_technique(rng: random.Random) -> Optional[Dict[str, Any]]:
    if not CULTIVATION_TECHNIQUE_POOL:
        return None
    item = dict(rng.choice(CULTIVATION_TECHNIQUE_POOL))
    name = item.get("name", "")
    desc = item.get("desc", "")
    log = f"【传承】参悟{name}：{desc}。" if name else ""
    return {
        "type": "technique",
        "name": name,
        "desc": desc,
        "log": log,
        "tone": CULTIVATION_DEFAULT_TONE.get("technique", "highlight"),
    }


def _cultivation_record_gain(run: Dict[str, Any], loot: Optional[Dict[str, Any]]) -> bool:
    if not loot or not isinstance(loot, dict):
        return False
    kind = loot.get("type")
    name = loot.get("name")
    if not name:
        return False
    tone = loot.get("tone") or CULTIVATION_DEFAULT_TONE.get(kind, "highlight")
    if kind == "artifact":
        bucket = run.setdefault("artifacts", [])
        entry = {"name": name, "desc": loot.get("desc", "")}
    elif kind == "companion":
        bucket = run.setdefault("companions", [])
        entry = {
            "name": name,
            "note": loot.get("note", ""),
            "desc": loot.get("desc", ""),
        }
    elif kind == "technique":
        bucket = run.setdefault("techniques", [])
        entry = {"name": name, "desc": loot.get("desc", "")}
    else:
        return False
    if any(isinstance(existing, dict) and existing.get("name") == name for existing in bucket):
        return False
    bucket.append(entry)
    log_text = loot.get("log")
    if log_text:
        _cultivation_log(run, log_text, tone)
    return True


def _cultivation_view_items(items: Optional[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    if not isinstance(items, list):
        return []
    view: List[Dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        entry: Dict[str, Any] = {"name": item.get("name", "")}
        if item.get("desc"):
            entry["desc"] = item.get("desc")
        if item.get("note"):
            entry["note"] = item.get("note")
        view.append(entry)
    return view


def _cultivation_trial_state(run: Dict[str, Any]) -> Dict[str, Any]:
    state = run.get("trial_state")
    if not isinstance(state, dict):
        state = {}
    completed = state.get("completed")
    if not isinstance(completed, list):
        completed = []
    state["completed"] = completed
    run["trial_state"] = state
    return state


def _cultivation_next_trial(run: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    state = _cultivation_trial_state(run)
    completed = set(state.get("completed") or [])
    age = int(run.get("age", 0))
    stage_index = int(run.get("stage_index", 0))
    progress = float(run.get("progress", 0.0))
    for trial in CULTIVATION_TRIALS:
        trial_id = trial.get("id")
        if not trial_id or trial_id in completed:
            continue
        stage_min = int(trial.get("stage_min") or 0)
        age_min = int(trial.get("age_min") or 0)
        if stage_index < stage_min:
            continue
        if age < age_min:
            continue
        if stage_min < len(CULTIVATION_STAGE_THRESHOLDS):
            required = CULTIVATION_STAGE_THRESHOLDS[stage_min] * 0.55
            if stage_index == stage_min and progress < required:
                continue
        state["active"] = trial_id
        return trial
    return None


def _cultivation_build_trial_event(
    run: Dict[str, Any],
    base_seed: int,
    spec: Dict[str, Any],
) -> Dict[str, Any]:
    event_seed = base_seed ^ (hash(spec.get("id")) & 0xFFFF)
    stat_key = spec.get("stat") or "mind"
    stat_label = _cultivation_stat_label(stat_key)
    description = spec.get("description") or "生死考验当前。"
    hint = spec.get("hint")
    option = _cultivation_option(
        f"trial-{spec.get('id')}",
        "正面迎击",
        f"调动{stat_label}底蕴迎接考验。",
        stat_key,
        "trial",
        (12, 18),
        (-6, -2),
        (18, 26),
        "凝神蓄力，直面生死试炼。",
        meta={
            "trial_id": spec.get("id"),
            "stat": stat_key,
            "difficulty": int(spec.get("difficulty") or 20),
            "delay_ms": CULTIVATION_TRIAL_DELAY_MS,
            "note": "极限考验",
        },
    )
    event = {
        "id": f"{run['session']}-{run['step']}-trial",
        "title": spec.get("name") or "极限试炼",
        "description": description,
        "options": [option],
        "seed": event_seed,
        "event_type": "trial",
        "theme_label": "极限试炼",
    }
    if hint:
        event["hint"] = hint
    event["trial_info"] = {
        "id": spec.get("id"),
        "name": spec.get("name"),
        "stat": stat_key,
        "stat_label": stat_label,
        "difficulty": int(spec.get("difficulty") or 20),
        "delay_ms": CULTIVATION_TRIAL_DELAY_MS,
    }
    return event


def _cultivation_trial_fortune(stats: Dict[str, Any], rng: random.Random) -> Dict[str, Any]:
    luck = int(stats.get("luck", 0))
    spirit = int(stats.get("spirit", 0))
    swing = rng.randint(-12, 12)
    score = luck * 1.1 + spirit * 0.4 + swing
    if score >= 32:
        return {"fortune": "大吉", "modifier": 6, "tone": "highlight"}
    if score >= 22:
        return {"fortune": "吉", "modifier": 3, "tone": "success"}
    if score <= 6:
        return {"fortune": "凶", "modifier": -4, "tone": "danger"}
    return {"fortune": "平", "modifier": 0, "tone": "warning"}


def _cultivation_resolve_trial(
    run: Dict[str, Any],
    event: Dict[str, Any],
    option: Dict[str, Any],
    rng: random.Random,
) -> Dict[str, Any]:
    meta = option.get("meta") or {}
    trial_id = meta.get("trial_id")
    spec = next((trial for trial in CULTIVATION_TRIALS if trial.get("id") == trial_id), None)
    if not spec:
        raise HTTPException(400, "未知的试炼")
    state = _cultivation_trial_state(run)
    stats = run.get("stats", {})
    stat_key = spec.get("stat") or meta.get("stat") or "mind"
    stat_label = _cultivation_stat_label(stat_key)
    base_stat = int(stats.get(stat_key, 0))
    fortune_rng = random.Random(event.get("seed", 0) ^ 0xBA5ED)
    fortune = _cultivation_trial_fortune(stats, fortune_rng)
    effective = base_stat + int(fortune.get("modifier") or 0)
    difficulty = int(meta.get("difficulty") or spec.get("difficulty") or 20)
    passed = effective >= difficulty
    success_spec = spec.get("success") or {}
    failure_spec = spec.get("failure") or {}

    prev_progress = float(run.get("progress", 0.0))
    prev_score = float(run.get("score", 0.0))
    prev_health = float(run.get("health", 0.0))

    if passed:
        progress_range = success_spec.get("progress") or (420, 520)
        score_range = success_spec.get("score") or (340, 420)
        health_range = success_spec.get("health") or (-28, -10)
        progress_gain = rng.uniform(*progress_range)
        score_gain = rng.uniform(*score_range)
        health_delta = rng.uniform(*health_range)
        run["progress"] = max(0.0, prev_progress + progress_gain)
        run["score"] = prev_score + score_gain
        run["health"] = max(0.0, prev_health + health_delta)
        tone = "highlight"
        quality = "success"
        narrative = f"在{spec.get('name', '试炼')}中调动{stat_label}，成功渡过难关。"
        state.setdefault("completed", []).append(trial_id)
    else:
        progress_gain = -rng.uniform(60, 120)
        score_loss = rng.uniform(260, 360)
        run["progress"] = max(0.0, prev_progress + progress_gain)
        run["score"] = max(0.0, prev_score - score_loss)
        run["health"] = 0.0
        tone = "danger"
        quality = "failure"
        narrative = f"在{spec.get('name', '试炼')}中败下阵来，被天命压制。"
        run["finished"] = True
        run["ending_type"] = failure_spec.get("ending_type") or "fallen"
        failure_log = failure_spec.get("log")
        if failure_log:
            _cultivation_log(run, failure_log, "danger")
        health_delta = run["health"] - prev_health

    run["age"] = int(run.get("age") or 0) + 1
    run["pending_event"] = None
    state["active"] = None
    state["last"] = {
        "id": trial_id,
        "name": spec.get("name"),
        "fortune": fortune.get("fortune"),
        "tone": fortune.get("tone"),
        "modifier": int(fortune.get("modifier") or 0),
        "effective": effective,
        "base": base_stat,
        "difficulty": difficulty,
        "passed": passed,
    }

    fortune_text = f"{fortune.get('fortune', '平')}（判定{effective}/{difficulty}）"
    log_tone = fortune.get("tone") or ("highlight" if passed else "danger")
    _cultivation_log(run, f"【考验】{spec.get('name', '试炼')}触发：{fortune_text}", log_tone)
    if passed:
        _cultivation_log(run, "【闯关】你咬牙坚持，终究跨过此劫。", "highlight")
    else:
        _cultivation_log(run, "【挫败】试炼失利，气息散乱。", "danger")

    stats = run.get("stats") or {}
    if passed and not run.get("finished"):
        rng_stage = random.Random(event.get("seed", 0) ^ 0xA77A)
        while run["stage_index"] < len(CULTIVATION_STAGE_THRESHOLDS):
            threshold = CULTIVATION_STAGE_THRESHOLDS[run["stage_index"]]
            if run["progress"] < threshold:
                break
            run["progress"] -= threshold
            run["stage_index"] += 1
            stage_name = CULTIVATION_STAGE_NAMES[min(run["stage_index"], len(CULTIVATION_STAGE_NAMES) - 1)]
            surge = rng_stage.uniform(90, 140)
            run["score"] += surge + int(stats.get(stat_key, 0)) * 4
            bonus_health = rng_stage.uniform(26, 42) + int(stats.get("body", 0)) * 0.8
            prev_hp = run["health"]
            run["max_health"] = float(run.get("max_health", 0.0)) + bonus_health
            run["health"] = min(run["max_health"], run["health"] + bonus_health * 0.7)
            recovered = run["health"] - prev_hp
            _cultivation_log(
                run,
                f"【突破】{run['age']} 岁突破至 {stage_name}，生命上限+{bonus_health:.1f}，回复 {recovered:+.1f}",
                "highlight",
            )
            if run["stage_index"] >= len(CULTIVATION_STAGE_NAMES) - 1:
                run["finished"] = True
                run["ending_type"] = "ascend"
                _cultivation_log(run, "【飞升】天劫散去，羽化登仙。", "highlight")
                break

    progress_gain_result = run["progress"] - prev_progress
    score_gain_result = run["score"] - prev_score
    health_delta_result = run["health"] - prev_health

    return {
        "progress_gain": round(progress_gain_result, 1),
        "score_gain": round(score_gain_result, 1),
        "health_delta": round(health_delta_result, 1),
        "age": run["age"],
        "narrative": narrative,
        "tone": tone,
        "quality": quality,
        "trial": {
            "id": trial_id,
            "name": spec.get("name"),
            "fortune": fortune.get("fortune"),
            "fortune_tone": fortune.get("tone"),
            "modifier": int(fortune.get("modifier") or 0),
            "effective": effective,
            "base": base_stat,
            "difficulty": difficulty,
            "passed": passed,
            "delay_ms": CULTIVATION_TRIAL_DELAY_MS,
        },
    }


def _cultivation_view_lineage(run: Optional[Dict[str, Any]]) -> Dict[str, Optional[Dict[str, Any]]]:
    def _copy(entry: Any) -> Optional[Dict[str, Any]]:
        if not isinstance(entry, dict):
            return None
        data: Dict[str, Any] = {"name": entry.get("name", "")}
        if entry.get("title"):
            data["title"] = entry.get("title")
        if entry.get("motto"):
            data["motto"] = entry.get("motto")
        return data

    def _copy_origin(entry: Any) -> Optional[Dict[str, Any]]:
        if not isinstance(entry, dict):
            return None
        data: Dict[str, Any] = {"name": entry.get("name", "")}
        if entry.get("desc"):
            data["desc"] = entry.get("desc")
        if entry.get("status_label"):
            data["status_label"] = entry.get("status_label")
        return data

    run = run or {}
    return {
        "origin": _copy_origin(run.get("origin")),
        "sect": _copy(run.get("sect")),
        "master": _copy(run.get("master")),
    }

CULTIVATION_EVENT_BLUEPRINTS = {
    "meditation": {
        "title": {
            "templates": ["{stage}·{title_word}", "{title_word}"],
            "pools": {"title_word": ["闭关悟道", "静室冥修", "灵台澄明", "松风参禅"]},
        },
        "context": {
            "locale": ["青竹静室", "灵泉石洞", "浮空石台", "丹炉旁"],
            "phenomenon": [
                "灵雾缠绕如练",
                "丹炉轻鸣若潮",
                "星辉透入室内",
                "墙上道纹缓缓亮起",
            ],
            "mood": ["心如止水", "神思澄明", "专注如一", "息息归一"],
        },
        "description": {
            "templates": [
                "{stage}的你闭关于{locale}，{phenomenon}，心境{mood}。",
                "你静坐在{locale}，{phenomenon}，整个人{mood}。",
                "在{locale}内灵机翻涌，{stage}的你呼吸绵长，念头{mood}。",
            ],
        },
        "options": [
            {
                "id": "focus",
                "focus": "mind",
                "type": "insight",
                "progress": (58, 92),
                "health": (-6, -2),
                "score": (55, 82),
                "label": {
                    "templates": [
                        "{intensity}参悟{mystery}",
                        "以{focus_label}推演{mystery}",
                        "{intensity}沉入{focus_label}之海",
                    ],
                    "pools": {
                        "intensity": ["全力", "彻夜", "倾尽心神", "屏息静气"],
                        "mystery": ["星河轨迹", "太初经文", "周天玄妙", "大道脉络"],
                    },
                },
                "detail": {
                    "templates": [
                        "聚焦{focus_label}，让念头与{phenomenon}同频共鸣。",
                        "以{focus_label}梳理灵机，{detail_goal}。",
                        "把{focus_label}推至极限，借{locale}的清气打磨根基。",
                    ],
                    "pools": {
                        "detail_goal": ["寻找突破瓶颈", "捕捉转瞬灵感", "稳固道基"],
                    },
                },
                "flavor": {
                    "templates": [
                        "心神内观，玄光渐盛",
                        "悟性激荡，灵感如潮",
                        "静极生悟，心海泛起金波",
                    ],
                },
            },
            {
                "id": "temper",
                "focus": "body",
                "type": "combat",
                "progress": (40, 68),
                "health": (-4, 3),
                "score": (40, 65),
                "label": {
                    "templates": [
                        "{intensity}淬炼筋骨",
                        "运转真气{verb}",
                        "以{focus_label}锻身化力",
                    ],
                    "pools": {
                        "intensity": ["抖擞精神", "引气归身", "燃尽体魄", "翻腾气血"],
                        "verb": ["冲击肉身桎梏", "洗炼百脉", "打磨骨骼"],
                    },
                },
                "detail": {
                    "templates": [
                        "调动血气周天流转，让身躯与{locale}灵韵共鸣。",
                        "把{focus_label}化作轰鸣潮汐，{detail_goal}。",
                        "让{focus_label}贯通四肢百骸，重塑肉身。",
                    ],
                    "pools": {
                        "detail_goal": ["打磨肌肉骨骼", "对冲隐藏暗伤", "磨砺战意"],
                    },
                },
                "flavor": {
                    "templates": [
                        "骨节如雷，气血蒸腾",
                        "体魄灼热，灵焰缠身",
                        "筋骨铿锵，真气奔涌",
                    ],
                },
            },
            {
                "id": "alchemy",
                "focus": "mind",
                "type": "alchemy",
                "progress": (50, 75),
                "health": (-5, 1),
                "score": (48, 76),
                "label": {
                    "templates": [
                        "以丹火温养心神",
                        "试炼灵丹妙药",
                        "祭出丹火淬炼灵物",
                    ],
                },
                "detail": {
                    "templates": [
                        "调配珍稀药材，让丹炉在{phenomenon}中缓缓运转。",
                        "借助{locale}的灵潮炼制丹药，考验心神与手法。",
                        "将{focus_label}融入丹火，争取炼成一炉妙丹。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "丹香弥漫，灵焰交织",
                        "火候游走于心间",
                        "药力翻滚，炉纹闪烁",
                    ],
                },
            },
        ],
    },
    "adventure": {
        "title": {
            "templates": ["{stage}·{title_word}", "{title_word}"],
            "pools": {"title_word": ["山野历练", "荒域闯荡", "秘境探幽", "险地游猎"]},
        },
        "context": {
            "terrain": ["幽深山林", "碎石峡谷", "灵泉雾谷", "荒古遗迹"],
            "threat": [
                "灵兽游弋其间",
                "古阵暗伏杀机",
                "妖风裹挟碎石",
                "阴煞潜藏暗处",
            ],
            "atmosphere": ["杀机潜伏", "灵机翻涌", "草木低鸣", "云雾翻滚"],
        },
        "description": {
            "templates": [
                "你踏入{terrain}，{threat}，空气中{atmosphere}。",
                "行走在{terrain}之间，{threat}，让人不敢大意。",
                "{stage}的你置身{terrain}，所过之处{atmosphere}，危机四伏。",
            ],
        },
        "options": [
            {
                "id": "battle",
                "focus": "body",
                "type": "combat",
                "progress": (62, 96),
                "health": (-12, -5),
                "score": (62, 88),
                "label": {
                    "templates": [
                        "拔剑迎战{foe}",
                        "{intensity}冲入战圈",
                        "以{focus_label}硬撼{foe}",
                    ],
                    "pools": {
                        "foe": ["灵兽", "凶禽", "山魈", "游荡傀儡"],
                        "intensity": ["怒喝", "疾闪", "纵跃", "挟雷光"],
                    },
                },
                "detail": {
                    "templates": [
                        "以身犯险，在{terrain}间游走，与{foe}正面碰撞。",
                        "催动{focus_label}，把自身化作破阵之锋。",
                        "以血气鼓荡，试图在搏杀中悟出战意。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "杀伐果决，血气如潮",
                        "剑光纵横，踏碎山石",
                        "怒血迸发，拳劲轰鸣",
                    ],
                },
            },
            {
                "id": "dodge",
                "focus": "luck",
                "type": "chance",
                "progress": (44, 66),
                "health": (-6, 2),
                "score": (46, 70),
                "label": {
                    "templates": [
                        "游走牵制{foe}",
                        "借势化解杀机",
                        "以气运穿梭险地",
                    ],
                    "pools": {"foe": ["灵兽", "陷阵", "阴兵", "游魂"]},
                },
                "detail": {
                    "templates": [
                        "凭借{focus_label}捕捉破绽，让自己与{terrain}的险阻错身而过。",
                        "借助地势和气运周旋，等待合适时机反击。",
                        "让步伐与{atmosphere}呼应，寻求最安全的路线。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "身影飘忽，几乎化作风痕",
                        "气运牵引，危机不断偏移",
                        "游龙般穿梭，步步惊心",
                    ],
                },
            },
            {
                "id": "befriend",
                "focus": "spirit",
                "type": "chance",
                "progress": (48, 74),
                "health": (-8, 0),
                "score": (50, 78),
                "label": {
                    "templates": [
                        "以灵识安抚{foe}",
                        "与{foe}沟通",
                        "放缓气息结交守护者",
                    ],
                    "pools": {"foe": ["灵兽", "山灵", "古树神识", "石像傀灵"]},
                },
                "detail": {
                    "templates": [
                        "放下武器，以{focus_label}传递善意，期望化敌为友。",
                        "让神识扩散，与{terrain}的守护者沟通。",
                        "调和气机，尝试从{foe}身上悟得自然法则。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "心神交汇，灵性互鸣",
                        "神识流转，祥和蔓延",
                        "气息温润，天地共鸣",
                    ],
                },
            },
        ],
    },
    "opportunity": {
        "title": {
            "templates": ["{stage}·{title_word}", "{title_word}"],
            "pools": {"title_word": ["奇遇机缘", "命星闪耀", "天机降临", "福泽盈门"]},
        },
        "context": {
            "omen": ["霞光自天边坠落", "古钟无声自鸣", "灵泉泛起金波", "道纹自地面浮现"],
            "guide": ["一缕神识牵引", "隐约仙音指路", "古老符文闪烁", "命星轻轻颤动"],
            "gift": ["残存传承", "古老遗物", "秘术雏形", "奇特灵植"],
        },
        "description": {
            "templates": [
                "旅途中{omen}，{guide}，似乎有{gift}等待有缘之人。",
                "你恰逢{omen}，{guide}之下，前方隐约有{gift}流光闪动。",
                "命运之轮转动，{omen}与{guide}交织，机缘近在咫尺。",
            ],
        },
        "options": [
            {
                "id": "inherit",
                "focus": "luck",
                "type": "chance",
                "progress": (55, 88),
                "health": (-5, 4),
                "score": (58, 90),
                "label": {
                    "templates": [
                        "探入遗迹索取传承",
                        "顺着机缘深入宝地",
                        "摸索{gift}的源头",
                    ],
                },
                "detail": {
                    "templates": [
                        "追随{guide}，深入秘境探寻{gift}。",
                        "凭借{focus_label}搏一把命运，期望得到真正的机缘。",
                        "小心翼翼地接近遗迹，寻找被遗忘的法门。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "命星流转，福泽笼罩",
                        "气数翻腾，命运选择你",
                        "天机倾斜，福运临身",
                    ],
                },
            },
            {
                "id": "mentor",
                "focus": "mind",
                "type": "insight",
                "progress": (52, 82),
                "health": (-3, 3),
                "score": (54, 84),
                "label": {
                    "templates": [
                        "虚心请教学问",
                        "以{focus_label}请教隐世",
                        "留步聆听前辈指引",
                    ],
                },
                "detail": {
                    "templates": [
                        "以{focus_label}记录每一句教诲，让心神沉浸在{guide}之中。",
                        "向机缘显化的前辈虚心讨教，希望借此洞悉瓶颈。",
                        "放下傲念，详询{gift}背后的奥秘。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "灵台澄明，顿悟连连",
                        "神思跃迁，心海泛光",
                        "言语成章，道音回荡",
                    ],
                },
            },
            {
                "id": "ally",
                "focus": "spirit",
                "type": "insight",
                "progress": (48, 78),
                "health": (-4, 4),
                "score": (50, 82),
                "label": {
                    "templates": [
                        "结交同行道友",
                        "与机缘守护者协力",
                        "分享灵感共悟",
                    ],
                },
                "detail": {
                    "templates": [
                        "以{focus_label}与同道共鸣，彼此交换对{gift}的理解。",
                        "结伴而行，共同守护机缘，谋求双赢。",
                        "让心神敞开，与机缘之灵合作探索未知。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "道音互绕，情谊渐生",
                        "心神呼应，灵感倍增",
                        "同心同气，共证妙理",
                    ],
                },
            },
        ],
        "dominant_options": {
            "body": {
                "id": "bloodline",
                "focus": "body",
                "type": "combat",
                "progress": (58, 92),
                "health": (-6, 6),
                "score": (60, 96),
                "label": {
                    "templates": [
                        "唤醒沉睡血脉",
                        "点燃体内远古之力",
                        "以{focus_label}激活血脉印记",
                    ],
                },
                "detail": {
                    "templates": [
                        "借机缘冲击血脉桎梏，让力量奔腾不息。",
                        "把{focus_label}与{gift}融合，唤醒沉睡的传承。",
                        "让血脉中潜藏的力量在{omen}的照耀下苏醒。",
                    ],
                },
            },
            "mind": {
                "id": "ancient_scroll",
                "focus": "mind",
                "type": "insight",
                "progress": (60, 94),
                "health": (-4, 6),
                "score": (64, 98),
                "label": {
                    "templates": [
                        "参悟古卷秘文",
                        "推演{gift}奥义",
                        "破译残缺典籍",
                    ],
                },
                "detail": {
                    "templates": [
                        "让{focus_label}沉入古卷纹理，从碎片中拼凑真解。",
                        "借{guide}指引解析古文，寻找隐蔽的法门。",
                        "以神念研读，提炼最契合自身的悟道线索。",
                    ],
                },
            },
            "spirit": {
                "id": "heart_trial",
                "focus": "spirit",
                "type": "insight",
                "progress": (58, 90),
                "health": (-5, 5),
                "score": (60, 94),
                "label": {
                    "templates": [
                        "踏入心境秘境",
                        "以心神共鸣天机",
                        "守住本心迎接幻境",
                    ],
                },
                "detail": {
                    "templates": [
                        "让{focus_label}投入幻境，与自身执念正面碰撞。",
                        "在机缘构筑的幻象中审视心境，磨砺道心。",
                        "借{guide}引领，看破幻境背后的真我。",
                    ],
                },
            },
            "luck": {
                "id": "karma",
                "focus": "luck",
                "type": "chance",
                "progress": (56, 88),
                "health": (-3, 7),
                "score": (58, 92),
                "label": {
                    "templates": [
                        "掷天机筹定因果",
                        "以命星窥探未来",
                        "调动气运博取先机",
                    ],
                },
                "detail": {
                    "templates": [
                        "以{focus_label}投向命运棋盘，换取额外的机会。",
                        "顺着{guide}推演未来走势，找准最有利的时机。",
                        "让福运与{gift}共鸣，争取更大的回馈。",
                    ],
                },
            },
        },
    },
    "training": {
        "title": {
            "templates": ["{stage}·{title_word}", "{title_word}"],
            "pools": {"title_word": ["门派试炼", "宗门使命", "长老考核", "讲武切磋"]},
        },
        "context": {
            "task": ["守护灵脉", "巡查山门", "演武讲道", "外出护送"],
            "mentor": ["长老注视", "师尊远观", "同门围拢", "外门弟子观摩"],
            "reward": ["宗门功勋", "灵石嘉奖", "师门传承", "额外修炼时间"],
        },
        "description": {
            "templates": [
                "宗门下达任务，需要{task}，{mentor}，完成后可获{reward}。",
                "你被指派去{task}，{mentor}，考验极其严格。",
                "{stage}修为的你肩负{task}重任，{mentor}，压力不小。",
            ],
        },
        "options": [
            {
                "id": "guard",
                "focus": "body",
                "type": "combat",
                "progress": (50, 80),
                "health": (-10, -2),
                "score": (55, 82),
                "label": {
                    "templates": [
                        "驻守灵脉正面迎敌",
                        "以{focus_label}守护山门",
                        "披挂亲自{task}",
                    ],
                },
                "detail": {
                    "templates": [
                        "调动{focus_label}坐镇要害，让外敌不敢侵犯。",
                        "亲自坐镇阵眼，以血气稳固灵脉运转。",
                        "以身作则，冲在最前线完成{task}。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "护阵如山，威势震慑",
                        "气血汹涌，守势如铁",
                        "身影屹立，战意如虹",
                    ],
                },
            },
            {
                "id": "lecture",
                "focus": "mind",
                "type": "insight",
                "progress": (46, 74),
                "health": (-2, 4),
                "score": (48, 78),
                "label": {
                    "templates": [
                        "整理心得讲道",
                        "以{focus_label}授业解惑",
                        "公开讲解修行要诀",
                    ],
                },
                "detail": {
                    "templates": [
                        "把自身积累的经验梳理成章，与同门分享。",
                        "在讲台上以{focus_label}推演，示范如何破解瓶颈。",
                        "将修炼体悟融会贯通，提炼成可传承的知识。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "妙语连珠，道音萦绕",
                        "心法流转，灵光四溢",
                        "一念成章，众人皆悟",
                    ],
                },
            },
            {
                "id": "patrol",
                "focus": "luck",
                "type": "chance",
                "progress": (44, 70),
                "health": (-6, 2),
                "score": (46, 74),
                "label": {
                    "templates": [
                        "外出巡游四境",
                        "探访下山历练",
                        "巡逻山外秘径",
                    ],
                },
                "detail": {
                    "templates": [
                        "顺着{focus_label}的直觉行走四方，揽下{task}的细碎事务。",
                        "在巡游途中结交凡俗与修者，扩展宗门影响。",
                        "追随气运指引，查探潜伏危机，护卫宗门。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "足迹遍布，见闻广博",
                        "气运护体，危机远离",
                        "轻装而行，心境开阔",
                    ],
                },
            },
        ],
    },
    "tribulation": {
        "title": {
            "templates": ["{stage}·{title_word}", "{title_word}"],
            "pools": {"title_word": ["天劫考验", "雷云逼近", "破境雷罚", "劫光洗礼"]},
        },
        "context": {
            "storm": ["雷霆如海", "银蛇狂舞", "风雷交织", "火雨纷飞"],
            "sign": ["劫云压顶", "紫电缠身", "天威浩荡", "劫火席卷"],
            "echo": ["天地失色", "山河震鸣", "灵泉倒灌", "虚空颤抖"],
        },
        "description": {
            "templates": [
                "境界将破，{storm}，{sign}，连{echo}。",
                "你身处雷海中心，{storm}，{sign}，让人几乎窒息。",
                "天威降临，{sign}，{storm}包裹全身，周遭{echo}。",
            ],
        },
        "options": [
            {
                "id": "force",
                "focus": "body",
                "type": "combat",
                "progress": (70, 110),
                "health": (-16, -6),
                "score": (72, 108),
                "label": {
                    "templates": [
                        "强行硬撼天威",
                        "以血肉承受雷罚",
                        "怒吼着踏入雷心",
                    ],
                },
                "detail": {
                    "templates": [
                        "催动{focus_label}迎面对抗雷霆，只求硬撼过去。",
                        "让体魄承接雷火，把天威当作淬炼之石。",
                        "以最纯粹的力量抗衡劫力，谋求一线生机。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "血气翻腾，雷火炸裂",
                        "肉身如铁，硬撼天威",
                        "咆哮震天，豪气冲霄",
                    ],
                },
            },
            {
                "id": "guide",
                "focus": "spirit",
                "type": "insight",
                "progress": (68, 105),
                "health": (-10, -3),
                "score": (70, 104),
                "label": {
                    "templates": [
                        "以心引雷化解",
                        "神识导引雷势",
                        "借道心调和天威",
                    ],
                },
                "detail": {
                    "templates": [
                        "守住{focus_label}，让雷霆顺势穿行而不伤己身。",
                        "将心神化作河流，引导雷势流淌而不过分集中。",
                        "以稳固道心将雷火分解，转为己用。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "心如磐石，雷意受驭",
                        "神识稳固，引雷入体",
                        "道心圆满，天威回旋",
                    ],
                },
            },
            {
                "id": "borrow",
                "focus": "luck",
                "type": "chance",
                "progress": (66, 102),
                "health": (-8, 2),
                "score": (68, 100),
                "label": {
                    "templates": [
                        "借助奇物护身",
                        "凭借机缘缓冲",
                        "以外物引导雷势",
                    ],
                },
                "detail": {
                    "templates": [
                        "祭出机缘宝物与雷霆共鸣，寻求最安全的突破点。",
                        "凭借{focus_label}调度天运，让劫力稍稍分散。",
                        "把外物化作避雷针，引导天威泄去锋芒。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "机缘闪耀，天运护身",
                        "天机偏转，劫力旁落",
                        "宝光腾起，雷势被引走",
                    ],
                },
            },
        ],
    },
}


CULTIVATION_OUTCOME_PREFIXES = [
    "{age} 岁的你在{stage}境界中",
    "{stage}的你此刻",
    "年仅{age} 岁却已修至{stage}，你",
]

CULTIVATION_OUTCOME_BACKDROPS = {
    "meditation": ["静室灵雾缭绕，", "心湖澄澈如镜，", "丹炉温热如春，"],
    "adventure": ["山野杀机四伏，", "荒域尘砂飞舞，", "古阵符光闪烁，"],
    "opportunity": ["命星灿然回响，", "机缘氤氲环绕，", "天机轻声低语，"],
    "training": ["宗门同门屏息，", "长老目光炯炯，", "讲台道音回荡，"],
    "tribulation": ["雷海咆哮不止，", "劫云压顶欲坠，", "天威滚滚如潮，"],
    "general": ["灵气翻涌之间，", "天地默然关注，", "周遭玄光升腾，"],
}

CULTIVATION_FOCUS_ACTIONS = {
    "mind": ["以{focus_label}推演星河，", "让{focus_label}贯穿神识，", "聚拢{focus_label}洞悉玄妙，"],
    "body": ["借{focus_label}轰碎阻碍，", "让{focus_label}化作雷霆，", "以{focus_label}硬撼险境，"],
    "spirit": ["收敛心神守护本心，", "让{focus_label}包裹神魂，", "以{focus_label}抚平波澜，"],
    "luck": ["凭{focus_label}牵引天机，", "顺着{focus_label}寻找转机，", "让{focus_label}拨动命星，"],
    "default": ["催动{focus_label}迎上前去，", "调度{focus_label}应对变数，"],
}

CULTIVATION_OUTCOME_ACTION_WRAPPERS = [
    "你选择了{action}，",
    "你尝试{action}，",
    "你以{action}应对，",
]

CULTIVATION_OUTCOME_RESULTS = {
    "success": [
        "终将局势掌控，修为稳步攀升。",
        "灵机顺势归一，道基愈发牢固。",
        "沉淀为实，一切努力化作进境。",
    ],
    "brilliant": [
        "灵光炸裂，境界猛进，天地为之惊叹！",
        "大道回响，修为扶摇而上，几近破壁。",
        "顿悟如泉涌现，你的气势直冲九霄。",
    ],
    "failure": [
        "却遭反噬，只能暂避锋芒。",
        "局势失控，你被迫后撤自保。",
        "意外横生，修为受挫气血翻滚。",
    ],
}

CULTIVATION_STAT_KEYS = [
    ("body", "体魄"),
    ("mind", "悟性"),
    ("spirit", "心性"),
    ("luck", "气运"),
]

CULTIVATION_TALENTS_LEGACY_V1 = [
    {
        "id": "iron_body",
        "name": "金刚体魄",
        "desc": "体魄 +3，战斗时所受伤害降低",
        "effects": {"body": 3},
        "flags": {"combat_resist": 0.5},
    },
    {
        "id": "sage_mind",
        "name": "悟道奇才",
        "desc": "悟性 +3，闭关悟道成功率提升",
        "effects": {"mind": 3},
        "flags": {"insight_bonus": 0.15},
    },
    {
        "id": "serene_heart",
        "name": "静心如水",
        "desc": "心性 +2，失败损失减少",
        "effects": {"spirit": 2},
        "flags": {"setback_reduce": 4},
    },
    {
        "id": "child_of_luck",
        "name": "气运之子",
        "desc": "气运 +4，奇遇收益提升",
        "effects": {"luck": 4},
        "flags": {"chance_bonus": 0.25},
    },
    {
        "id": "alchemy_adept",
        "name": "丹道新星",
        "desc": "首次炼丹事件必定成功并悟性 +1",
        "effects": {"mind": 1},
        "flags": {"alchemy_mastery": 1},
    },
    {
        "id": "sword_soul",
        "name": "剑魂共鸣",
        "desc": "战斗成功奖励提升，体魄 +1，悟性 +1",
        "effects": {"body": 1, "mind": 1},
        "flags": {"combat_bonus": 0.2},
    },
    {
        "id": "phoenix_blood",
        "name": "凤血重生",
        "rarity": "gold",
        "desc": "寿元 +15，濒死时有机会重生",
        "effects": {},
        "flags": {"lifespan_bonus": 15, "resurrection": 0.3},
    },
    {
        "id": "spirit_talker",
        "name": "灵识敏锐",
        "desc": "心性 +3，可预判风险",
        "effects": {"spirit": 3},
        "flags": {"hazard_hint": 1},
    },
]

CULTIVATION_BASE_POINTS_LEGACY_V1 = 8
CULTIVATION_MAX_TALENTS_LEGACY_V1 = 2
CULTIVATION_REFRESH_COUNT_LEGACY_V1 = 3
CULTIVATION_STAGE_NAMES_LEGACY_V1 = ["凡人", "炼气", "筑基", "金丹", "元婴", "化神", "飞升"]
CULTIVATION_STAGE_THRESHOLDS_LEGACY_V1 = [120, 260, 420, 660, 960, 1320]




class _SafeFormatDict(dict):
    def __missing__(self, key: str) -> str:
        return ""


def _choose_fragment(rng: random.Random, source: Any, context: Dict[str, Any]) -> str:
    if source is None:
        return ""
    if callable(source):
        return str(source(rng, context))
    if isinstance(source, dict):
        return _dynamic_text(source, context, rng)
    if isinstance(source, (list, tuple, set)):
        seq = list(source)
        if not seq:
            return ""
        choice = rng.choice(seq)
        return _choose_fragment(rng, choice, context)
    return str(source)


def _dynamic_text(spec: Optional[Dict[str, Any]], context: Dict[str, Any], rng: random.Random) -> str:
    if not spec:
        return ""
    templates = spec.get("templates")
    if not templates:
        return ""
    template = _choose_fragment(rng, templates, context)
    data = dict(context)
    for key, source in (spec.get("pools") or {}).items():
        data[key] = _choose_fragment(rng, source, data)
    return template.format_map(_SafeFormatDict(data))


CULTIVATION_EVENT_BLUEPRINTS = {
    "meditation": {
        "title": {
            "templates": ["{stage}·{title_word}", "{title_word}"],
            "pools": {"title_word": ["闭关悟道", "静室冥修", "灵台澄明", "松风参禅"]},
        },
        "context": {
            "locale": ["青竹静室", "灵泉石洞", "浮空石台", "丹炉旁"],
            "phenomenon": [
                "灵雾缠绕如练",
                "丹炉轻鸣若潮",
                "星辉透入室内",
                "墙上道纹缓缓亮起",
            ],
            "mood": ["心如止水", "神思澄明", "专注如一", "息息归一"],
        },
        "description": {
            "templates": [
                "{stage}的你闭关于{locale}，{phenomenon}，心境{mood}。",
                "你静坐在{locale}，{phenomenon}，整个人{mood}。",
                "在{locale}内灵机翻涌，{stage}的你呼吸绵长，念头{mood}。",
            ],
        },
        "options": [
            {
                "id": "focus",
                "focus": "mind",
                "type": "insight",
                "progress": (58, 92),
                "health": (-6, -2),
                "score": (55, 82),
                "label": {
                    "templates": [
                        "{intensity}参悟{mystery}",
                        "以{focus_label}推演{mystery}",
                        "{intensity}沉入{focus_label}之海",
                    ],
                    "pools": {
                        "intensity": ["全力", "彻夜", "倾尽心神", "屏息静气"],
                        "mystery": ["星河轨迹", "太初经文", "周天玄妙", "大道脉络"],
                    },
                },
                "detail": {
                    "templates": [
                        "聚焦{focus_label}，让念头与{phenomenon}同频共鸣。",
                        "以{focus_label}梳理灵机，{detail_goal}。",
                        "把{focus_label}推至极限，借{locale}的清气打磨根基。",
                    ],
                    "pools": {
                        "detail_goal": ["寻找突破瓶颈", "捕捉转瞬灵感", "稳固道基"],
                    },
                },
                "flavor": {
                    "templates": [
                        "心神内观，玄光渐盛",
                        "悟性激荡，灵感如潮",
                        "静极生悟，心海泛起金波",
                    ],
                },
            },
            {
                "id": "temper",
                "focus": "body",
                "type": "combat",
                "progress": (40, 68),
                "health": (-4, 3),
                "score": (40, 65),
                "label": {
                    "templates": [
                        "{intensity}淬炼筋骨",
                        "运转真气{verb}",
                        "以{focus_label}锻身化力",
                    ],
                    "pools": {
                        "intensity": ["抖擞精神", "引气归身", "燃尽体魄", "翻腾气血"],
                        "verb": ["冲击肉身桎梏", "洗炼百脉", "打磨骨骼"],
                    },
                },
                "detail": {
                    "templates": [
                        "调动血气周天流转，让身躯与{locale}灵韵共鸣。",
                        "把{focus_label}化作轰鸣潮汐，{detail_goal}。",
                        "让{focus_label}贯通四肢百骸，重塑肉身。",
                    ],
                    "pools": {
                        "detail_goal": ["打磨肌肉骨骼", "对冲隐藏暗伤", "磨砺战意"],
                    },
                },
                "flavor": {
                    "templates": [
                        "骨节如雷，气血蒸腾",
                        "体魄灼热，灵焰缠身",
                        "筋骨铿锵，真气奔涌",
                    ],
                },
            },
            {
                "id": "alchemy",
                "focus": "mind",
                "type": "alchemy",
                "progress": (50, 75),
                "health": (-5, 1),
                "score": (48, 76),
                "label": {
                    "templates": [
                        "以丹火温养心神",
                        "试炼灵丹妙药",
                        "祭出丹火淬炼灵物",
                    ],
                },
                "detail": {
                    "templates": [
                        "调配珍稀药材，让丹炉在{phenomenon}中缓缓运转。",
                        "借助{locale}的灵潮炼制丹药，考验心神与手法。",
                        "将{focus_label}融入丹火，争取炼成一炉妙丹。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "丹香弥漫，灵焰交织",
                        "火候游走于心间",
                        "药力翻滚，炉纹闪烁",
                    ],
                },
            },
        ],
    },
    "adventure": {
        "title": {
            "templates": ["{stage}·{title_word}", "{title_word}"],
            "pools": {"title_word": ["山野历练", "荒域闯荡", "秘境探幽", "险地游猎"]},
        },
        "context": {
            "terrain": ["幽深山林", "碎石峡谷", "灵泉雾谷", "荒古遗迹"],
            "threat": [
                "灵兽游弋其间",
                "古阵暗伏杀机",
                "妖风裹挟碎石",
                "阴煞潜藏暗处",
            ],
            "atmosphere": ["杀机潜伏", "灵机翻涌", "草木低鸣", "云雾翻滚"],
        },
        "description": {
            "templates": [
                "你踏入{terrain}，{threat}，空气中{atmosphere}。",
                "行走在{terrain}之间，{threat}，让人不敢大意。",
                "{stage}的你置身{terrain}，所过之处{atmosphere}，危机四伏。",
            ],
        },
        "options": [
            {
                "id": "battle",
                "focus": "body",
                "type": "combat",
                "progress": (62, 96),
                "health": (-12, -5),
                "score": (62, 88),
                "label": {
                    "templates": [
                        "拔剑迎战{foe}",
                        "{intensity}冲入战圈",
                        "以{focus_label}硬撼{foe}",
                    ],
                    "pools": {
                        "foe": ["灵兽", "凶禽", "山魈", "游荡傀儡"],
                        "intensity": ["怒喝", "疾闪", "纵跃", "挟雷光"],
                    },
                },
                "detail": {
                    "templates": [
                        "以身犯险，在{terrain}间游走，与{foe}正面碰撞。",
                        "催动{focus_label}，把自身化作破阵之锋。",
                        "以血气鼓荡，试图在搏杀中悟出战意。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "杀伐果决，血气如潮",
                        "剑光纵横，踏碎山石",
                        "怒血迸发，拳劲轰鸣",
                    ],
                },
            },
            {
                "id": "dodge",
                "focus": "luck",
                "type": "chance",
                "progress": (44, 66),
                "health": (-6, 2),
                "score": (46, 70),
                "label": {
                    "templates": [
                        "游走牵制{foe}",
                        "借势化解杀机",
                        "以气运穿梭险地",
                    ],
                    "pools": {"foe": ["灵兽", "陷阵", "阴兵", "游魂"]},
                },
                "detail": {
                    "templates": [
                        "凭借{focus_label}捕捉破绽，让自己与{terrain}的险阻错身而过。",
                        "借助地势和气运周旋，等待合适时机反击。",
                        "让步伐与{atmosphere}呼应，寻求最安全的路线。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "身影飘忽，几乎化作风痕",
                        "气运牵引，危机不断偏移",
                        "游龙般穿梭，步步惊心",
                    ],
                },
            },
            {
                "id": "befriend",
                "focus": "spirit",
                "type": "chance",
                "progress": (48, 74),
                "health": (-8, 0),
                "score": (50, 78),
                "label": {
                    "templates": [
                        "以灵识安抚{foe}",
                        "与{foe}沟通",
                        "放缓气息结交守护者",
                    ],
                    "pools": {"foe": ["灵兽", "山灵", "古树神识", "石像傀灵"]},
                },
                "detail": {
                    "templates": [
                        "放下武器，以{focus_label}传递善意，期望化敌为友。",
                        "让神识扩散，与{terrain}的守护者沟通。",
                        "调和气机，尝试从{foe}身上悟得自然法则。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "心神交汇，灵性互鸣",
                        "神识流转，祥和蔓延",
                        "气息温润，天地共鸣",
                    ],
                },
            },
        ],
    },
    "opportunity": {
        "title": {
            "templates": ["{stage}·{title_word}", "{title_word}"],
            "pools": {"title_word": ["奇遇机缘", "命星闪耀", "天机降临", "福泽盈门"]},
        },
        "context": {
            "omen": ["霞光自天边坠落", "古钟无声自鸣", "灵泉泛起金波", "道纹自地面浮现"],
            "guide": ["一缕神识牵引", "隐约仙音指路", "古老符文闪烁", "命星轻轻颤动"],
            "gift": ["残存传承", "古老遗物", "秘术雏形", "奇特灵植"],
        },
        "description": {
            "templates": [
                "旅途中{omen}，{guide}，似乎有{gift}等待有缘之人。",
                "你恰逢{omen}，{guide}之下，前方隐约有{gift}流光闪动。",
                "命运之轮转动，{omen}与{guide}交织，机缘近在咫尺。",
            ],
        },
        "options": [
            {
                "id": "inherit",
                "focus": "luck",
                "type": "chance",
                "progress": (55, 88),
                "health": (-5, 4),
                "score": (58, 90),
                "label": {
                    "templates": [
                        "探入遗迹索取传承",
                        "顺着机缘深入宝地",
                        "摸索{gift}的源头",
                    ],
                },
                "detail": {
                    "templates": [
                        "追随{guide}，深入秘境探寻{gift}。",
                        "凭借{focus_label}搏一把命运，期望得到真正的机缘。",
                        "小心翼翼地接近遗迹，寻找被遗忘的法门。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "命星流转，福泽笼罩",
                        "气数翻腾，命运选择你",
                        "天机倾斜，福运临身",
                    ],
                },
            },
            {
                "id": "mentor",
                "focus": "mind",
                "type": "insight",
                "progress": (52, 82),
                "health": (-3, 3),
                "score": (54, 84),
                "label": {
                    "templates": [
                        "虚心请教学问",
                        "以{focus_label}请教隐世",
                        "留步聆听前辈指引",
                    ],
                },
                "detail": {
                    "templates": [
                        "以{focus_label}记录每一句教诲，让心神沉浸在{guide}之中。",
                        "向机缘显化的前辈虚心讨教，希望借此洞悉瓶颈。",
                        "放下傲念，详询{gift}背后的奥秘。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "灵台澄明，顿悟连连",
                        "神思跃迁，心海泛光",
                        "言语成章，道音回荡",
                    ],
                },
            },
            {
                "id": "ally",
                "focus": "spirit",
                "type": "insight",
                "progress": (48, 78),
                "health": (-4, 4),
                "score": (50, 82),
                "label": {
                    "templates": [
                        "结交同行道友",
                        "与机缘守护者协力",
                        "分享灵感共悟",
                    ],
                },
                "detail": {
                    "templates": [
                        "以{focus_label}与同道共鸣，彼此交换对{gift}的理解。",
                        "结伴而行，共同守护机缘，谋求双赢。",
                        "让心神敞开，与机缘之灵合作探索未知。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "道音互绕，情谊渐生",
                        "心神呼应，灵感倍增",
                        "同心同气，共证妙理",
                    ],
                },
            },
        ],
        "dominant_options": {
            "body": {
                "id": "bloodline",
                "focus": "body",
                "type": "combat",
                "progress": (58, 92),
                "health": (-6, 6),
                "score": (60, 96),
                "label": {
                    "templates": [
                        "唤醒沉睡血脉",
                        "点燃体内远古之力",
                        "以{focus_label}激活血脉印记",
                    ],
                },
                "detail": {
                    "templates": [
                        "借机缘冲击血脉桎梏，让力量奔腾不息。",
                        "把{focus_label}与{gift}融合，唤醒沉睡的传承。",
                        "让血脉中潜藏的力量在{omen}的照耀下苏醒。",
                    ],
                },
            },
            "mind": {
                "id": "ancient_scroll",
                "focus": "mind",
                "type": "insight",
                "progress": (60, 94),
                "health": (-4, 6),
                "score": (64, 98),
                "label": {
                    "templates": [
                        "参悟古卷秘文",
                        "推演{gift}奥义",
                        "破译残缺典籍",
                    ],
                },
                "detail": {
                    "templates": [
                        "让{focus_label}沉入古卷纹理，从碎片中拼凑真解。",
                        "借{guide}指引解析古文，寻找隐蔽的法门。",
                        "以神念研读，提炼最契合自身的悟道线索。",
                    ],
                },
            },
            "spirit": {
                "id": "heart_trial",
                "focus": "spirit",
                "type": "insight",
                "progress": (58, 90),
                "health": (-5, 5),
                "score": (60, 94),
                "label": {
                    "templates": [
                        "踏入心境秘境",
                        "以心神共鸣天机",
                        "守住本心迎接幻境",
                    ],
                },
                "detail": {
                    "templates": [
                        "让{focus_label}投入幻境，与自身执念正面碰撞。",
                        "在机缘构筑的幻象中审视心境，磨砺道心。",
                        "借{guide}引领，看破幻境背后的真我。",
                    ],
                },
            },
            "luck": {
                "id": "karma",
                "focus": "luck",
                "type": "chance",
                "progress": (56, 88),
                "health": (-3, 7),
                "score": (58, 92),
                "label": {
                    "templates": [
                        "掷天机筹定因果",
                        "以命星窥探未来",
                        "调动气运博取先机",
                    ],
                },
                "detail": {
                    "templates": [
                        "以{focus_label}投向命运棋盘，换取额外的机会。",
                        "顺着{guide}推演未来走势，找准最有利的时机。",
                        "让福运与{gift}共鸣，争取更大的回馈。",
                    ],
                },
            },
        },
    },
    "training": {
        "title": {
            "templates": ["{stage}·{title_word}", "{title_word}"],
            "pools": {"title_word": ["门派试炼", "宗门使命", "长老考核", "讲武切磋"]},
        },
        "context": {
            "task": ["守护灵脉", "巡查山门", "演武讲道", "外出护送"],
            "mentor": ["长老注视", "师尊远观", "同门围拢", "外门弟子观摩"],
            "reward": ["宗门功勋", "灵石嘉奖", "师门传承", "额外修炼时间"],
        },
        "description": {
            "templates": [
                "宗门下达任务，需要{task}，{mentor}，完成后可获{reward}。",
                "你被指派去{task}，{mentor}，考验极其严格。",
                "{stage}修为的你肩负{task}重任，{mentor}，压力不小。",
            ],
        },
        "options": [
            {
                "id": "guard",
                "focus": "body",
                "type": "combat",
                "progress": (50, 80),
                "health": (-10, -2),
                "score": (55, 82),
                "label": {
                    "templates": [
                        "驻守灵脉正面迎敌",
                        "以{focus_label}守护山门",
                        "披挂亲自{task}",
                    ],
                },
                "detail": {
                    "templates": [
                        "调动{focus_label}坐镇要害，让外敌不敢侵犯。",
                        "亲自坐镇阵眼，以血气稳固灵脉运转。",
                        "以身作则，冲在最前线完成{task}。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "护阵如山，威势震慑",
                        "气血汹涌，守势如铁",
                        "身影屹立，战意如虹",
                    ],
                },
            },
            {
                "id": "lecture",
                "focus": "mind",
                "type": "insight",
                "progress": (46, 74),
                "health": (-2, 4),
                "score": (48, 78),
                "label": {
                    "templates": [
                        "整理心得讲道",
                        "以{focus_label}授业解惑",
                        "公开讲解修行要诀",
                    ],
                },
                "detail": {
                    "templates": [
                        "把自身积累的经验梳理成章，与同门分享。",
                        "在讲台上以{focus_label}推演，示范如何破解瓶颈。",
                        "将修炼体悟融会贯通，提炼成可传承的知识。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "妙语连珠，道音萦绕",
                        "心法流转，灵光四溢",
                        "一念成章，众人皆悟",
                    ],
                },
            },
            {
                "id": "patrol",
                "focus": "luck",
                "type": "chance",
                "progress": (44, 70),
                "health": (-6, 2),
                "score": (46, 74),
                "label": {
                    "templates": [
                        "外出巡游四境",
                        "探访下山历练",
                        "巡逻山外秘径",
                    ],
                },
                "detail": {
                    "templates": [
                        "顺着{focus_label}的直觉行走四方，揽下{task}的细碎事务。",
                        "在巡游途中结交凡俗与修者，扩展宗门影响。",
                        "追随气运指引，查探潜伏危机，护卫宗门。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "足迹遍布，见闻广博",
                        "气运护体，危机远离",
                        "轻装而行，心境开阔",
                    ],
                },
            },
        ],
    },
    "tribulation": {
        "title": {
            "templates": ["{stage}·{title_word}", "{title_word}"],
            "pools": {"title_word": ["天劫考验", "雷云逼近", "破境雷罚", "劫光洗礼"]},
        },
        "context": {
            "storm": ["雷霆如海", "银蛇狂舞", "风雷交织", "火雨纷飞"],
            "sign": ["劫云压顶", "紫电缠身", "天威浩荡", "劫火席卷"],
            "echo": ["天地失色", "山河震鸣", "灵泉倒灌", "虚空颤抖"],
        },
        "description": {
            "templates": [
                "境界将破，{storm}，{sign}，连{echo}。",
                "你身处雷海中心，{storm}，{sign}，让人几乎窒息。",
                "天威降临，{sign}，{storm}包裹全身，周遭{echo}。",
            ],
        },
        "options": [
            {
                "id": "force",
                "focus": "body",
                "type": "combat",
                "progress": (70, 110),
                "health": (-16, -6),
                "score": (72, 108),
                "label": {
                    "templates": [
                        "强行硬撼天威",
                        "以血肉承受雷罚",
                        "怒吼着踏入雷心",
                    ],
                },
                "detail": {
                    "templates": [
                        "催动{focus_label}迎面对抗雷霆，只求硬撼过去。",
                        "让体魄承接雷火，把天威当作淬炼之石。",
                        "以最纯粹的力量抗衡劫力，谋求一线生机。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "血气翻腾，雷火炸裂",
                        "肉身如铁，硬撼天威",
                        "咆哮震天，豪气冲霄",
                    ],
                },
            },
            {
                "id": "guide",
                "focus": "spirit",
                "type": "insight",
                "progress": (68, 105),
                "health": (-10, -3),
                "score": (70, 104),
                "label": {
                    "templates": [
                        "以心引雷化解",
                        "神识导引雷势",
                        "借道心调和天威",
                    ],
                },
                "detail": {
                    "templates": [
                        "守住{focus_label}，让雷霆顺势穿行而不伤己身。",
                        "将心神化作河流，引导雷势流淌而不过分集中。",
                        "以稳固道心将雷火分解，转为己用。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "心如磐石，雷意受驭",
                        "神识稳固，引雷入体",
                        "道心圆满，天威回旋",
                    ],
                },
            },
            {
                "id": "borrow",
                "focus": "luck",
                "type": "chance",
                "progress": (66, 102),
                "health": (-8, 2),
                "score": (68, 100),
                "label": {
                    "templates": [
                        "借助奇物护身",
                        "凭借机缘缓冲",
                        "以外物引导雷势",
                    ],
                },
                "detail": {
                    "templates": [
                        "祭出机缘宝物与雷霆共鸣，寻求最安全的突破点。",
                        "凭借{focus_label}调度天运，让劫力稍稍分散。",
                        "把外物化作避雷针，引导天威泄去锋芒。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "机缘闪耀，天运护身",
                        "天机偏转，劫力旁落",
                        "宝光腾起，雷势被引走",
                    ],
                },
            },
        ],
    },
}


CULTIVATION_OUTCOME_PREFIXES = [
    "{age} 岁的你在{stage}境界中",
    "{stage}的你此刻",
    "年仅{age} 岁却已修至{stage}，你",
]

CULTIVATION_OUTCOME_BACKDROPS = {
    "meditation": ["静室灵雾缭绕，", "心湖澄澈如镜，", "丹炉温热如春，"],
    "adventure": ["山野杀机四伏，", "荒域尘砂飞舞，", "古阵符光闪烁，"],
    "opportunity": ["命星灿然回响，", "机缘氤氲环绕，", "天机轻声低语，"],
    "training": ["宗门同门屏息，", "长老目光炯炯，", "讲台道音回荡，"],
    "tribulation": ["雷海咆哮不止，", "劫云压顶欲坠，", "天威滚滚如潮，"],
    "general": ["灵气翻涌之间，", "天地默然关注，", "周遭玄光升腾，"],
}

CULTIVATION_FOCUS_ACTIONS = {
    "mind": ["以{focus_label}推演星河，", "让{focus_label}贯穿神识，", "聚拢{focus_label}洞悉玄妙，"],
    "body": ["借{focus_label}轰碎阻碍，", "让{focus_label}化作雷霆，", "以{focus_label}硬撼险境，"],
    "spirit": ["收敛心神守护本心，", "让{focus_label}包裹神魂，", "以{focus_label}抚平波澜，"],
    "luck": ["凭{focus_label}牵引天机，", "顺着{focus_label}寻找转机，", "让{focus_label}拨动命星，"],
    "default": ["催动{focus_label}迎上前去，", "调度{focus_label}应对变数，"],
}

CULTIVATION_OUTCOME_ACTION_WRAPPERS = [
    "你选择了{action}，",
    "你尝试{action}，",
    "你以{action}应对，",
]

CULTIVATION_OUTCOME_RESULTS = {
    "success": [
        "终将局势掌控，修为稳步攀升。",
        "灵机顺势归一，道基愈发牢固。",
        "沉淀为实，一切努力化作进境。",
    ],
    "brilliant": [
        "灵光炸裂，境界猛进，天地为之惊叹！",
        "大道回响，修为扶摇而上，几近破壁。",
        "顿悟如泉涌现，你的气势直冲九霄。",
    ],
    "failure": [
        "却遭反噬，只能暂避锋芒。",
        "局势失控，你被迫后撤自保。",
        "意外横生，修为受挫气血翻滚。",
    ],
}

CULTIVATION_STAT_KEYS = [
    ("body", "体魄"),
    ("mind", "悟性"),
    ("spirit", "心性"),
    ("luck", "气运"),
]

CULTIVATION_TALENTS_LEGACY_V2 = [
    {
        "id": "iron_body",
        "name": "金刚体魄",
        "desc": "体魄 +3，战斗时所受伤害降低",
        "effects": {"body": 3},
        "flags": {"combat_resist": 0.5},
    },
    {
        "id": "sage_mind",
        "name": "悟道奇才",
        "desc": "悟性 +3，闭关悟道成功率提升",
        "effects": {"mind": 3},
        "flags": {"insight_bonus": 0.15},
    },
    {
        "id": "serene_heart",
        "name": "静心如水",
        "desc": "心性 +2，失败损失减少",
        "effects": {"spirit": 2},
        "flags": {"setback_reduce": 4},
    },
    {
        "id": "child_of_luck",
        "name": "气运之子",
        "desc": "气运 +4，奇遇收益提升",
        "effects": {"luck": 4},
        "flags": {"chance_bonus": 0.25},
    },
    {
        "id": "alchemy_adept",
        "name": "丹道新星",
        "desc": "首次炼丹事件必定成功并悟性 +1",
        "effects": {"mind": 1},
        "flags": {"alchemy_mastery": 1},
    },
    {
        "id": "sword_soul",
        "name": "剑魂共鸣",
        "desc": "战斗成功奖励提升，体魄 +1，悟性 +1",
        "effects": {"body": 1, "mind": 1},
        "flags": {"combat_bonus": 0.2},
    },
    {
        "id": "phoenix_blood",
        "name": "凤血重生",
        "desc": "寿元 +15，濒死时有机会重生",
        "effects": {},
        "flags": {"lifespan_bonus": 15, "resurrection": 0.3},
    },
    {
        "id": "spirit_talker",
        "name": "灵识敏锐",
        "desc": "心性 +3，可预判风险",
        "effects": {"spirit": 3},
        "flags": {"hazard_hint": 1},
    },
]

CULTIVATION_BASE_POINTS_LEGACY_V2 = 8
CULTIVATION_MAX_TALENTS_LEGACY_V2 = 2
CULTIVATION_REFRESH_COUNT_LEGACY_V2 = 3
CULTIVATION_STAGE_NAMES_LEGACY_V2 = ["凡人", "炼气", "筑基", "金丹", "元婴", "化神", "飞升"]
CULTIVATION_STAGE_THRESHOLDS_LEGACY_V2 = [120, 260, 420, 660, 960, 1320]


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


def cookie_cultivation_enabled(db: Session) -> bool:
    row = db.query(SystemSetting).filter_by(key=COOKIE_CULTIVATION_SETTING_KEY).first()
    if not row:
        return False
    return str(row.value) != "0"


def set_cookie_cultivation_enabled(db: Session, enabled: bool) -> None:
    value = "1" if enabled else "0"
    row = db.query(SystemSetting).filter_by(key=COOKIE_CULTIVATION_SETTING_KEY).first()
    if row:
        row.value = value
    else:
        db.add(SystemSetting(key=COOKIE_CULTIVATION_SETTING_KEY, value=value))
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
        if key == COOKIE_CULTIVATION_KEY:
            node.setdefault("last_result", {})
            node.setdefault("best_score", 0)
            node.setdefault("play_count", 0)
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


def cookie_cultivation_admin_stats(db: Session) -> Tuple[int, int]:
    runs = 0
    best = 0
    rows = db.query(CookieFactoryProfile.mini_games).all()
    for (raw,) in rows:
        data = _json_object(raw, {})
        node = data.get(COOKIE_CULTIVATION_KEY)
        if not isinstance(node, dict):
            continue
        try:
            runs += int(node.get("play_count") or 0)
            best = max(best, int(node.get("best_score") or 0))
        except Exception:
            continue
    return runs, best


def update_presence(
    db: Session,
    user: User,
    page: str,
    activity: str,
    details: Optional[Dict[str, Any]] = None,
) -> None:
    now = int(time.time())
    if not user:
        return
    row = db.query(UserPresence).filter_by(user_id=user.id).first()
    if not row:
        row = UserPresence(user_id=user.id, username=user.username)
        db.add(row)
    row.username = user.username
    row.page = (page or "")[:200]
    row.activity = (activity or "")[:120]
    row.detail = _json_dump(details or {})
    row.last_seen = now


def list_active_presence(db: Session, horizon: int = 180) -> List[Dict[str, Any]]:
    now = int(time.time())
    cutoff = now - max(30, int(horizon or 0))
    rows = (
        db.query(UserPresence)
        .filter(UserPresence.last_seen >= cutoff)
        .order_by(UserPresence.last_seen.desc())
        .all()
    )
    out: List[Dict[str, Any]] = []
    for row in rows:
        info = _json_object(row.detail, {})
        out.append(
            {
                "username": row.username,
                "page": row.page,
                "activity": row.activity,
                "details": info,
                "last_seen": int(row.last_seen or 0),
                "seconds_ago": max(0, now - int(row.last_seen or 0)),
            }
        )
    stale_cutoff = now - 3600
    db.query(UserPresence).filter(UserPresence.last_seen < stale_cutoff).delete()
    return out


def _cultivation_opportunity(
    rng: random.Random, stats: Dict[str, int]
) -> Tuple[str, float, Dict[str, int], Optional[Dict[str, Any]]]:
    stat_labels = {k: label for k, label in CULTIVATION_STAT_KEYS}
    dominant = None
    if stats:
        dominant = max(stats.items(), key=lambda item: int(item[1]))[0]
    pool: List[str] = []
    for key in stat_labels:
        weight = 3 if dominant and key == dominant else 1
        pool.extend([key] * weight)
    stat_key = rng.choice(pool or list(stat_labels.keys()))
    boost = rng.randint(2, 4)
    if dominant and stat_key == dominant:
        boost += 1
    stats[stat_key] = int(stats.get(stat_key, 0)) + boost
    harvest = rng.uniform(30, 80)
    tales = [
        "前辈暗中点拨，{label}+{boost}，悟得『玄光周天』。",
        "在古迹壁画前顿悟，{label}+{boost}，修为暴涨 {gain}。",
        "灵泉洗礼身心，{label}+{boost}，灵机奔涌。",
        "与隐世高人畅谈，{label}+{boost}，感悟满盈。",
    ]
    text = rng.choice(tales).format(
        label=stat_labels.get(stat_key, stat_key), boost=boost, gain=int(harvest)
    )
    loot: Optional[Dict[str, Any]] = None
    roll = rng.random()
    if roll < 0.5:
        loot = _cultivation_random_artifact(rng)
    elif roll < 0.75:
        loot = _cultivation_random_technique(rng)
    else:
        loot = _cultivation_random_companion(rng)
    return text, harvest, {stat_key: boost}, loot


def _cultivation_adventure(
    rng: random.Random, stats: Dict[str, int], health: float
) -> Tuple[str, float, float, Optional[Dict[str, Any]]]:
    mishaps = [
        "闯入荒古遗阵，被乱刃席卷",
        "炼丹时火候失控，药鼎炸裂",
        "遭劫修拦路，斗法失利",
        "灵雾暗藏邪祟，心神受创",
    ]
    detail = rng.choice([
        "护体真气被撕裂",
        "灵台震荡数日",
        "经脉被阴寒之气侵入",
        "神魂被迫自燃抵御",
    ])
    loss = rng.randint(10, 24)
    siphon = rng.uniform(18, 48)
    stats["spirit"] = max(1, int(stats.get("spirit", 0)) - 1)
    new_health = max(0.0, float(health) - loss)
    tale = rng.choice(
        [
            "意外：{mishap}，{detail}，寿元骤减 {loss}。",
            "劫难：{mishap}，{detail}，折损寿元 {loss}，道心微裂。",
        ]
    )
    tale_text = tale.format(mishap=rng.choice(mishaps), detail=detail, loss=loss)
    loot: Optional[Dict[str, Any]] = None
    if rng.random() < 0.45:
        helper = _cultivation_random_companion(rng)
        if helper:
            note = helper.get("note")
            note_text = f"（{note}）" if note else ""
            desc = helper.get("desc") or ""
            helper["log"] = f"【相援】危机时{helper.get('name', '')}{note_text}出手相救。{desc}".strip()
            helper["tone"] = "success"
            loot = helper
    return tale_text, -siphon, new_health, loot


def _cultivation_chance(
    rng: random.Random, stats: Dict[str, int]
) -> Tuple[str, float, Optional[Dict[str, Any]]]:
    fortunes = [
        "闭关七日顿悟剑意",
        "星象推演，悟出一式御风诀",
        "观摩古碑，明白心念所向",
        "偶得灵丹，体内灵气翻滚",
    ]
    gain = rng.uniform(18, 55)
    stats["mind"] = int(stats.get("mind", 0)) + 1
    boon: Optional[Dict[str, Any]] = None
    if rng.random() < 0.55:
        boon = _cultivation_random_technique(rng)
    else:
        boon = _cultivation_random_artifact(rng)
    return (f"奇遇：{rng.choice(fortunes)}，额外参悟 {int(gain)}", gain, boon)


def _cultivation_log(run: Dict[str, Any], text: str, tone: str = "info") -> None:
    entry = {"text": text, "tone": tone}
    log = run.setdefault("log", [])
    log.append(entry)
    run["log"] = log[-40:]




def _cultivation_outcome_text(
    event_type: str,
    option_label: str,
    focus: str,
    quality: str,
    rng: random.Random,
    run: Dict[str, Any],
) -> str:
    stage = CULTIVATION_STAGE_NAMES[
        min(int(run.get("stage_index", 0)), len(CULTIVATION_STAGE_NAMES) - 1)
    ]
    age = int(run.get("age", 0))
    focus_label = next(
        (label for key, label in CULTIVATION_STAT_KEYS if key == focus), "心性"
    )
    action = option_label or "历练"
    context = {
        "stage": stage,
        "age": age,
        "focus_label": focus_label,
        "action": action,
    }
    prefix = rng.choice(CULTIVATION_OUTCOME_PREFIXES)
    backdrop_pool = CULTIVATION_OUTCOME_BACKDROPS.get(event_type) or CULTIVATION_OUTCOME_BACKDROPS["general"]
    backdrop = rng.choice(backdrop_pool)
    focus_pool = CULTIVATION_FOCUS_ACTIONS.get(focus) or CULTIVATION_FOCUS_ACTIONS["default"]
    focus_line = rng.choice(focus_pool)
    wrapper = rng.choice(CULTIVATION_OUTCOME_ACTION_WRAPPERS)
    result_pool = CULTIVATION_OUTCOME_RESULTS.get(quality) or CULTIVATION_OUTCOME_RESULTS["success"]
    result = rng.choice(result_pool)
    pieces = [prefix, backdrop, focus_line, wrapper, result]
    return "".join(piece.format_map(_SafeFormatDict(context)) for piece in pieces)






def _cultivation_node(profile: CookieFactoryProfile) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    state = cookie_mini_games_state(profile)
    raw_node = state.get(COOKIE_CULTIVATION_KEY)
    node = raw_node if isinstance(raw_node, dict) else {}
    if "best_score" not in node:
        legacy_last = node.get("last_result") if isinstance(node.get("last_result"), dict) else None
        best = int(node.get("best_score") or node.get("best") or 0)
        play_count = int(node.get("play_count") or node.get("count") or 0)
        history = node.get("history") if isinstance(node.get("history"), list) else []
        node = {
            "best_score": max(0, best),
            "play_count": max(0, play_count),
            "last_result": legacy_last,
            "history": history,
        }
    node.setdefault("history", [])
    state[COOKIE_CULTIVATION_KEY] = node
    profile.mini_games = _json_dump(state)
    return state, node


def _cultivation_stats_template() -> Dict[str, int]:
    base: Dict[str, int] = {}
    for key, _ in CULTIVATION_STAT_KEYS:
        base[key] = 4
    return base


def _cultivation_render_talent(talent: Dict[str, Any]) -> Dict[str, Any]:
    effects = talent.get("effects") or {}
    display_effects: List[Dict[str, Any]] = []
    for key, value in effects.items():
        label = next((label for (k, label) in CULTIVATION_STAT_KEYS if k == key), key)
        display_effects.append({"stat": key, "label": label, "value": int(value)})
    rarity = str(talent.get("rarity") or "blue")
    rarity_meta = CULTIVATION_TALENT_RARITIES.get(rarity, {"label": "蓝", "tone": "rare-blue"})
    return {
        "id": talent.get("id"),
        "name": talent.get("name"),
        "desc": talent.get("desc"),
        "effects": display_effects,
        "rarity": rarity,
        "rarity_label": rarity_meta.get("label", ""),
        "rarity_tone": rarity_meta.get("tone", ""),
    }


def _cultivation_pick_talents(rng: random.Random) -> List[Dict[str, Any]]:
    weighted_pool: List[Tuple[Dict[str, Any], float]] = []
    rarity_weights = {"blue": 1.0, "purple": 0.45, "gold": 0.12}
    talents_by_rarity: Dict[str, List[Dict[str, Any]]] = {"blue": [], "purple": [], "gold": []}
    for talent in CULTIVATION_TALENTS:
        rarity = str(talent.get("rarity") or "blue")
        weight = float(talent.get("weight") or rarity_weights.get(rarity, 1.0))
        if weight <= 0:
            continue
        weighted_pool.append((talent, weight))
        talents_by_rarity.setdefault(rarity, []).append(talent)
    picks: List[Dict[str, Any]] = []
    roll_cap = min(CULTIVATION_TALENT_ROLLS, len(CULTIVATION_TALENTS))
    guaranteed_order = ["gold", "purple", "blue"]
    for rarity in guaranteed_order:
        if len(picks) >= roll_cap:
            break
        pool = talents_by_rarity.get(rarity) or []
        if pool:
            picks.append(rng.choice(pool))
    selected_ids = {talent.get("id") for talent in picks if talent.get("id")}
    pool = [(talent, weight) for talent, weight in weighted_pool if talent.get("id") not in selected_ids]
    while len(picks) < roll_cap and pool:
        total = sum(weight for _, weight in pool)
        if total <= 0:
            break
        roll = rng.uniform(0, total)
        acc = 0.0
        choice_index = None
        for idx, (talent, weight) in enumerate(pool):
            acc += weight
            if roll <= acc:
                picks.append(talent)
                choice_index = idx
                break
        if choice_index is None:
            break
        pool.pop(choice_index)
    return [_cultivation_render_talent(talent) for talent in picks[:roll_cap]]


def _cultivation_stat_label(stat: str) -> str:
    return next((label for key, label in CULTIVATION_STAT_KEYS if key == stat), stat)


def _cultivation_render_bonus(stats: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    effects: List[Dict[str, Any]] = []
    if not isinstance(stats, dict):
        return effects
    for key, value in stats.items():
        try:
            amount = int(value)
        except Exception:
            continue
        if not amount:
            continue
        effects.append({"stat": key, "label": _cultivation_stat_label(key), "value": amount})
    return effects


def _cultivation_render_origin(origin: Dict[str, Any]) -> Dict[str, Any]:
    status = int(origin.get("status") or 1)
    return {
        "id": origin.get("id"),
        "name": origin.get("name"),
        "desc": origin.get("desc"),
        "status": status,
        "status_label": origin.get("status_label") or CULTIVATION_STATUS_LABELS.get(status, ""),
        "coins": int(origin.get("coins") or 0),
        "effects": _cultivation_render_bonus(origin.get("stats")),
    }


def _cultivation_render_sect(sect: Dict[str, Any]) -> Dict[str, Any]:
    status = int(sect.get("min_status") or 1)
    return {
        "id": sect.get("id"),
        "name": sect.get("name"),
        "motto": sect.get("motto"),
        "min_status": status,
        "coins": int(sect.get("coins") or 0),
        "effects": _cultivation_render_bonus(sect.get("stats")),
    }


def _cultivation_render_master(master: Dict[str, Any]) -> Dict[str, Any]:
    status = int(master.get("min_status") or 1)
    data = {
        "id": master.get("id"),
        "name": master.get("name"),
        "title": master.get("title"),
        "motto": master.get("motto"),
        "sect": master.get("sect"),
        "min_status": status,
        "coins": int(master.get("coins") or 0),
        "effects": _cultivation_render_bonus(master.get("stats")),
    }
    traits = master.get("traits")
    if isinstance(traits, (list, tuple)):
        data["traits"] = [str(t) for t in traits if t]
    return data


def _cultivation_prepare_lobby(node: Dict[str, Any], seed: Optional[int] = None) -> Dict[str, Any]:
    lobby = node.get("lobby") if isinstance(node.get("lobby"), dict) else None
    if lobby and lobby.get("talents"):
        lobby["origins"] = [_cultivation_render_origin(o) for o in CULTIVATION_ORIGINS]
        lobby["sects"] = [_cultivation_render_sect(s) for s in CULTIVATION_SECTS]
        lobby["masters"] = [_cultivation_render_master(m) for m in CULTIVATION_MASTERS]
        return lobby
    base_seed = seed or secrets.randbits(64)
    rng = random.Random(base_seed)
    lobby = {
        "roll_id": secrets.token_hex(6),
        "talents": _cultivation_pick_talents(rng),
        "refreshes_left": CULTIVATION_REFRESH_COUNT,
        "base_stats": _cultivation_stats_template(),
        "points": CULTIVATION_BASE_POINTS,
        "max_talents": CULTIVATION_MAX_TALENTS,
        "talent_rarities": {
            key: {"label": meta.get("label"), "tone": meta.get("tone")}
            for key, meta in CULTIVATION_TALENT_RARITIES.items()
        },
    }
    lobby["origins"] = [_cultivation_render_origin(o) for o in CULTIVATION_ORIGINS]
    lobby["sects"] = [_cultivation_render_sect(s) for s in CULTIVATION_SECTS]
    lobby["masters"] = [_cultivation_render_master(m) for m in CULTIVATION_MASTERS]
    node["lobby"] = lobby
    return lobby


def _cultivation_find_talent(talent_id: str) -> Optional[Dict[str, Any]]:
    for talent in CULTIVATION_TALENTS:
        if talent.get("id") == talent_id:
            return talent
    return None


def _cultivation_apply_talents(
    base_stats: Dict[str, int],
    selected: List[Dict[str, Any]],
) -> Tuple[Dict[str, int], Dict[str, Any]]:
    stats = {k: int(base_stats.get(k, 0)) for k, _ in CULTIVATION_STAT_KEYS}
    flags: Dict[str, Any] = {}
    for talent in selected:
        effects = talent.get("effects") or {}
        for key, val in effects.items():
            stats[key] = int(stats.get(key, 0)) + int(val)
        for flag_key, flag_val in (talent.get("flags") or {}).items():
            current = flags.get(flag_key)
            if isinstance(flag_val, (int, float)) and isinstance(current, (int, float)):
                flags[flag_key] = current + flag_val
            else:
                flags[flag_key] = flag_val
    return stats, flags


def _cultivation_find_origin(origin_id: str) -> Optional[Dict[str, Any]]:
    for origin in CULTIVATION_ORIGINS:
        if origin.get("id") == origin_id:
            return origin
    return None


def _cultivation_find_sect(sect_id: str) -> Optional[Dict[str, Any]]:
    for sect in CULTIVATION_SECTS:
        if sect.get("id") == sect_id or sect.get("key") == sect_id:
            return sect
    return None


def _cultivation_find_master(master_id: str) -> Optional[Dict[str, Any]]:
    for master in CULTIVATION_MASTERS:
        if master.get("id") == master_id:
            return master
    return None


def _cultivation_start_run(
    node: Dict[str, Any],
    talents: List[Dict[str, Any]],
    stats: Dict[str, int],
    flags: Dict[str, Any],
    origin: Dict[str, Any],
    sect: Dict[str, Any],
    master: Dict[str, Any],
    coins: int,
) -> Dict[str, Any]:
    seed = secrets.randbits(64)
    rng = random.Random(seed)
    age = rng.randint(15, 22)
    base_health = 60 + stats.get("body", 0) * 4 + rng.randint(0, 14)
    lifespan = 70 + stats.get("spirit", 0) * 3 + stats.get("luck", 0) * 2 + rng.randint(12, 36)
    lifespan += int(flags.get("lifespan_bonus") or 0)
    run = {
        "session": secrets.token_hex(8),
        "seed": seed,
        "age": age,
        "lifespan": lifespan,
        "health": float(base_health),
        "max_health": float(base_health),
        "progress": 0.0,
        "stage_index": 0,
        "stats": {k: int(v) for k, v in stats.items()},
        "talents": [
            {
                "id": t.get("id"),
                "name": t.get("name"),
                "desc": t.get("desc"),
                "effects": t.get("effects"),
                "rarity": t.get("rarity"),
                "rarity_label": t.get("rarity_label"),
                "rarity_tone": t.get("rarity_tone"),
            }
            for t in talents
        ],
        "talent_flags": flags,
        "log": [],
        "score": 0.0,
        "step": 0,
        "finished": False,
        "ending_type": None,
        "trial_state": {"completed": []},
    }
    run["artifacts"] = []
    run["companions"] = []
    run["techniques"] = []

    origin_status = int(origin.get("status") or 1)
    origin_status_label = origin.get("status_label") or CULTIVATION_STATUS_LABELS.get(origin_status, "")
    run["origin"] = {
        "id": origin.get("id"),
        "name": origin.get("name", ""),
        "desc": origin.get("desc", ""),
        "status_label": origin_status_label,
    }
    run["sect"] = {
        "id": sect.get("id"),
        "name": sect.get("name", "散修"),
        "motto": sect.get("motto", ""),
    }
    run["master"] = {
        "id": master.get("id"),
        "name": master.get("name", "无名高人"),
        "title": master.get("title", ""),
        "motto": master.get("motto", ""),
    }
    run["coins"] = max(0, int(coins))
    if origin_status_label:
        _cultivation_log(
            run,
            f"【出身】出生于{origin_status_label}{origin.get('name', '')}，携带{run['coins']}枚铜钱启程。",
            "highlight",
        )
    else:
        _cultivation_log(
            run,
            f"【出身】来自{origin.get('name', '未知')}，携带{run['coins']}枚铜钱。",
            "highlight",
        )
    sect_name = run["sect"].get("name") or "散修"
    master_name = run["master"].get("name") or "无名前辈"
    master_title = run["master"].get("title") or ""
    master_label = f"{master_name}（{master_title}）" if master_title else master_name
    _cultivation_log(run, f"【启程】拜入{sect_name}，师从{master_label}。", "highlight")
    lineage_rng = random.Random(seed ^ 0xA17F)
    if CULTIVATION_COMPANION_POOL:
        friend_template = dict(lineage_rng.choice(CULTIVATION_COMPANION_POOL))
        note_text = f"（{friend_template.get('note', '')}）" if friend_template.get("note") else ""
        detail = friend_template.get("desc") or ""
        initial_companion = {
            "type": "companion",
            "name": friend_template.get("name", ""),
            "note": friend_template.get("note", ""),
            "desc": detail,
            "log": f"【同门】与{friend_template.get('name', '')}{note_text}把臂言欢，结为道友。{detail}".strip(),
            "tone": "success",
        }
        _cultivation_record_gain(run, initial_companion)

    node["active_run"] = run
    node.pop("lobby", None)
    return run


def _cultivation_option(
    option_id: str,
    label: str,
    detail: str,
    focus: str,
    option_type: str,
    progress: Tuple[float, float],
    health: Tuple[float, float],
    score: Tuple[float, float],
    flavor: str,
    meta: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    option = {
        "id": option_id,
        "label": label,
        "detail": detail,
        "focus": focus,
        "type": option_type,
        "progress": progress,
        "health": health,
        "score": score,
        "flavor": flavor,
    }
    if meta:
        option["meta"] = meta
    return option




def _cultivation_build_merchant_event(run: Dict[str, Any], base_seed: int) -> Dict[str, Any]:
    event_seed = base_seed ^ 0x55AA
    options: List[Dict[str, Any]] = []
    artifact_rng = random.Random(event_seed ^ 0x1010)
    artifact = _cultivation_random_artifact(artifact_rng)
    if artifact:
        cost = max(40, 55 + artifact_rng.randint(-10, 25))
        artifact = dict(artifact)
        name = artifact.get("name", "神秘法宝")
        artifact["log"] = f"【交易】花费{cost}枚铜钱购得{name}。{artifact.get('desc', '')}".strip()
        options.append(
            _cultivation_option(
                "buy_artifact",
                f"购入{name}",
                f"消耗{cost}铜钱换取珍稀法宝。",
                "mind",
                "merchant_buy",
                (18, 28),
                (-2, 2),
                (24, 36),
                "与行脚商贩讨价还价。",
                meta={"cost": cost, "loot": artifact, "note": "法宝交易"},
            )
        )
    technique_rng = random.Random(event_seed ^ 0x2020)
    technique = _cultivation_random_technique(technique_rng)
    if technique:
        cost = max(30, 42 + technique_rng.randint(-6, 18))
        technique = dict(technique)
        name = technique.get("name", "秘术残卷")
        technique["log"] = f"【交易】花费{cost}枚铜钱换得{name}。{technique.get('desc', '')}".strip()
        options.append(
            _cultivation_option(
                "buy_technique",
                f"购入{name}",
                f"支出{cost}铜钱获得一套玄妙功法。",
                "spirit",
                "merchant_buy",
                (16, 26),
                (-1, 3),
                (20, 32),
                "用铜钱换取功法残卷。",
                meta={"cost": cost, "loot": technique, "note": "功法交易"},
            )
        )
    if not options:
        options.append(
            _cultivation_option(
                "empty_hand",
                "错过机缘",
                "今日商贩未携带珍品，只能作罢。",
                "luck",
                "merchant_leave",
                (12, 20),
                (-1, 2),
                (14, 22),
                "拱手作别行脚商贩。",
            )
        )
    options.append(
        _cultivation_option(
            "decline",
            "婉拒离去",
            "保留资源，继续赶路。",
            "luck",
            "merchant_leave",
            (14, 22),
            (-1, 3),
            (16, 24),
            "谢绝商贩的热情邀约。",
            meta={"note": "离开"},
        )
    )
    description = "一位行脚商贩摆开摊位，低声兜售珍贵法器与功法。"
    return {
        "id": f"{run['session']}-{run['step']}-merchant",
        "title": "行脚商贩",
        "description": description,
        "options": options,
        "seed": event_seed,
        "event_type": "merchant",
    }


def _cultivation_build_sacrifice_event(run: Dict[str, Any], base_seed: int) -> Dict[str, Any]:
    event_seed = base_seed ^ 0x7F31
    rng = random.Random(event_seed)
    options: List[Dict[str, Any]] = []
    altar_text = rng.choice([
        "古老石坛散发幽蓝光辉",
        "血色法阵缓缓旋转",
        "幽火缭绕的祭坛矗立前方",
    ])
    artifact_rng = random.Random(event_seed ^ 0x3030)
    artifact = _cultivation_random_artifact(artifact_rng)
    if artifact:
        cost = max(28, 38 + artifact_rng.randint(-6, 12))
        sacrifice = [{"stat": "body", "amount": 1}]
        artifact = dict(artifact)
        name = artifact.get("name", "祭坛馈赠")
        artifact["log"] = f"【献祭】燃烧体魄与{cost}铜钱，换得{name}。{artifact.get('desc', '')}".strip()
        options.append(
            _cultivation_option(
                "sacrifice_artifact",
                f"献祭血骨换取{name}",
                f"献祭1点体魄并奉上{cost}铜钱以换取法宝。",
                "body",
                "sacrifice_trade",
                (18, 26),
                (-4, 1),
                (24, 34),
                "献上精血，祭坛回馈灵光。",
                meta={"cost": cost, "loot": artifact, "sacrifice": sacrifice, "note": "法宝献祭"},
            )
        )
    technique_rng = random.Random(event_seed ^ 0x4040)
    technique = _cultivation_random_technique(technique_rng)
    if technique:
        sacrifice = [{"stat": "mind", "amount": 1}]
        technique = dict(technique)
        gain = max(48, 60 + technique_rng.randint(-4, 16))
        technique["log"] = f"【献祭】燃尽心神换得{technique.get('name', '秘术')}，并获{gain}枚铜钱回馈。{technique.get('desc', '')}".strip()
        options.append(
            _cultivation_option(
                "sacrifice_scroll",
                f"祭献悟性悟得{technique.get('name', '秘术')}",
                f"献祭1点悟性获取功法，并额外得到{gain}铜钱。",
                "spirit",
                "sacrifice_trade",
                (16, 24),
                (-3, 2),
                (22, 32),
                "神魂与祭坛相融，赐下秘法。",
                meta={"loot": technique, "sacrifice": sacrifice, "gain_coins": gain, "note": "功法献祭"},
            )
        )
    gain = max(55, 70 + rng.randint(-10, 18))
    options.append(
        _cultivation_option(
            "sacrifice_coins",
            "祭献气运换取铜钱",
            f"献祭1点气运换得{gain}枚铜钱。",
            "luck",
            "sacrifice_convert",
            (14, 22),
            (-3, 2),
            (18, 28),
            "气运被祭坛吞噬，化作叮当铜钱。",
            meta={"sacrifice": [{"stat": "luck", "amount": 1}], "gain_coins": gain, "note": "铜钱回馈"},
        )
    )
    options.append(
        _cultivation_option(
            "leave_altar",
            "谨慎离开",
            "察觉邪异气息，未做献祭。",
            "spirit",
            "sacrifice_leave",
            (12, 20),
            (-2, 3),
            (14, 22),
            "稳住心神，远离诡异祭坛。",
            meta={"note": "离开"},
        )
    )
    description = f"{altar_text}，低语声蛊惑你献出心神与铜钱。"
    return {
        "id": f"{run['session']}-{run['step']}-sacrifice",
        "title": "秘祭商铺",
        "description": description,
        "options": options,
        "seed": event_seed,
        "event_type": "sacrifice",
    }


def _cultivation_build_merchant_event(run: Dict[str, Any], base_seed: int) -> Dict[str, Any]:
    event_seed = base_seed ^ 0x55AA
    options: List[Dict[str, Any]] = []
    artifact_rng = random.Random(event_seed ^ 0x1010)
    artifact = _cultivation_random_artifact(artifact_rng)
    if artifact:
        cost = max(40, 55 + artifact_rng.randint(-10, 25))
        artifact = dict(artifact)
        name = artifact.get("name", "神秘法宝")
        artifact["log"] = f"【交易】花费{cost}枚铜钱购得{name}。{artifact.get('desc', '')}".strip()
        options.append(
            _cultivation_option(
                "buy_artifact",
                f"购入{name}",
                f"消耗{cost}铜钱换取珍稀法宝。",
                "mind",
                "merchant_buy",
                (18, 28),
                (-2, 2),
                (24, 36),
                "与行脚商贩讨价还价。",
                meta={"cost": cost, "loot": artifact, "note": "法宝交易"},
            )
        )
    technique_rng = random.Random(event_seed ^ 0x2020)
    technique = _cultivation_random_technique(technique_rng)
    if technique:
        cost = max(30, 42 + technique_rng.randint(-6, 18))
        technique = dict(technique)
        name = technique.get("name", "秘术残卷")
        technique["log"] = f"【交易】花费{cost}枚铜钱换得{name}。{technique.get('desc', '')}".strip()
        options.append(
            _cultivation_option(
                "buy_technique",
                f"购入{name}",
                f"支出{cost}铜钱获得一套玄妙功法。",
                "spirit",
                "merchant_buy",
                (16, 26),
                (-1, 3),
                (20, 32),
                "用铜钱换取功法残卷。",
                meta={"cost": cost, "loot": technique, "note": "功法交易"},
            )
        )
    if not options:
        options.append(
            _cultivation_option(
                "empty_hand",
                "错过机缘",
                "今日商贩未携带珍品，只能作罢。",
                "luck",
                "merchant_leave",
                (12, 20),
                (-1, 2),
                (14, 22),
                "拱手作别行脚商贩。",
            )
        )
    options.append(
        _cultivation_option(
            "decline",
            "婉拒离去",
            "保留资源，继续赶路。",
            "luck",
            "merchant_leave",
            (14, 22),
            (-1, 3),
            (16, 24),
            "谢绝商贩的热情邀约。",
            meta={"note": "离开"},
        )
    )
    description = "一位行脚商贩摆开摊位，低声兜售珍贵法器与功法。"
    return {
        "id": f"{run['session']}-{run['step']}-merchant",
        "title": "行脚商贩",
        "description": description,
        "options": options,
        "seed": event_seed,
        "event_type": "merchant",
    }


def _cultivation_build_sacrifice_event(run: Dict[str, Any], base_seed: int) -> Dict[str, Any]:
    event_seed = base_seed ^ 0x7F31
    rng = random.Random(event_seed)
    options: List[Dict[str, Any]] = []
    altar_text = rng.choice([
        "古老石坛散发幽蓝光辉",
        "血色法阵缓缓旋转",
        "幽火缭绕的祭坛矗立前方",
    ])
    artifact_rng = random.Random(event_seed ^ 0x3030)
    artifact = _cultivation_random_artifact(artifact_rng)
    if artifact:
        cost = max(28, 38 + artifact_rng.randint(-6, 12))
        sacrifice = [{"stat": "body", "amount": 1}]
        artifact = dict(artifact)
        name = artifact.get("name", "祭坛馈赠")
        artifact["log"] = f"【献祭】燃烧体魄与{cost}铜钱，换得{name}。{artifact.get('desc', '')}".strip()
        options.append(
            _cultivation_option(
                "sacrifice_artifact",
                f"献祭血骨换取{name}",
                f"献祭1点体魄并奉上{cost}铜钱以换取法宝。",
                "body",
                "sacrifice_trade",
                (18, 26),
                (-4, 1),
                (24, 34),
                "献上精血，祭坛回馈灵光。",
                meta={"cost": cost, "loot": artifact, "sacrifice": sacrifice, "note": "法宝献祭"},
            )
        )
    technique_rng = random.Random(event_seed ^ 0x4040)
    technique = _cultivation_random_technique(technique_rng)
    if technique:
        sacrifice = [{"stat": "mind", "amount": 1}]
        technique = dict(technique)
        gain = max(48, 60 + technique_rng.randint(-4, 16))
        technique["log"] = f"【献祭】燃尽心神换得{technique.get('name', '秘术')}，并获{gain}枚铜钱回馈。{technique.get('desc', '')}".strip()
        options.append(
            _cultivation_option(
                "sacrifice_scroll",
                f"祭献悟性悟得{technique.get('name', '秘术')}",
                f"献祭1点悟性获取功法，并额外得到{gain}铜钱。",
                "spirit",
                "sacrifice_trade",
                (16, 24),
                (-3, 2),
                (22, 32),
                "神魂与祭坛相融，赐下秘法。",
                meta={"loot": technique, "sacrifice": sacrifice, "gain_coins": gain, "note": "功法献祭"},
            )
        )
    gain = max(55, 70 + rng.randint(-10, 18))
    options.append(
        _cultivation_option(
            "sacrifice_coins",
            "祭献气运换取铜钱",
            f"献祭1点气运换得{gain}枚铜钱。",
            "luck",
            "sacrifice_convert",
            (14, 22),
            (-3, 2),
            (18, 28),
            "气运被祭坛吞噬，化作叮当铜钱。",
            meta={"sacrifice": [{"stat": "luck", "amount": 1}], "gain_coins": gain, "note": "铜钱回馈"},
        )
    )
    options.append(
        _cultivation_option(
            "leave_altar",
            "谨慎离开",
            "察觉邪异气息，未做献祭。",
            "spirit",
            "sacrifice_leave",
            (12, 20),
            (-2, 3),
            (14, 22),
            "稳住心神，远离诡异祭坛。",
            meta={"note": "离开"},
        )
    )
    description = f"{altar_text}，低语声蛊惑你献出心神与铜钱。"
    return {
        "id": f"{run['session']}-{run['step']}-sacrifice",
        "title": "秘祭商铺",
        "description": description,
        "options": options,
        "seed": event_seed,
        "event_type": "sacrifice",
    }

def _cultivation_build_merchant_event(run: Dict[str, Any], base_seed: int) -> Dict[str, Any]:
    event_seed = base_seed ^ 0x55AA
    options: List[Dict[str, Any]] = []
    artifact_rng = random.Random(event_seed ^ 0x1010)
    artifact = _cultivation_random_artifact(artifact_rng)
    if artifact:
        cost = max(40, 55 + artifact_rng.randint(-10, 25))
        artifact = dict(artifact)
        name = artifact.get("name", "神秘法宝")
        artifact["log"] = f"【交易】花费{cost}枚铜钱购得{name}。{artifact.get('desc', '')}".strip()
        options.append(
            _cultivation_option(
                "buy_artifact",
                f"购入{name}",
                f"消耗{cost}铜钱换取珍稀法宝。",
                "mind",
                "merchant_buy",
                (18, 28),
                (-2, 2),
                (24, 36),
                "与行脚商贩讨价还价。",
                meta={"cost": cost, "loot": artifact, "note": "法宝交易"},
            )
        )
    technique_rng = random.Random(event_seed ^ 0x2020)
    technique = _cultivation_random_technique(technique_rng)
    if technique:
        cost = max(30, 42 + technique_rng.randint(-6, 18))
        technique = dict(technique)
        name = technique.get("name", "秘术残卷")
        technique["log"] = f"【交易】花费{cost}枚铜钱换得{name}。{technique.get('desc', '')}".strip()
        options.append(
            _cultivation_option(
                "buy_technique",
                f"购入{name}",
                f"支出{cost}铜钱获得一套玄妙功法。",
                "spirit",
                "merchant_buy",
                (16, 26),
                (-1, 3),
                (20, 32),
                "用铜钱换取功法残卷。",
                meta={"cost": cost, "loot": technique, "note": "功法交易"},
            )
        )
    if not options:
        options.append(
            _cultivation_option(
                "empty_hand",
                "错过机缘",
                "今日商贩未携带珍品，只能作罢。",
                "luck",
                "merchant_leave",
                (12, 20),
                (-1, 2),
                (14, 22),
                "拱手作别行脚商贩。",
            )
        )
    options.append(
        _cultivation_option(
            "decline",
            "婉拒离去",
            "保留资源，继续赶路。",
            "luck",
            "merchant_leave",
            (14, 22),
            (-1, 3),
            (16, 24),
            "谢绝商贩的热情邀约。",
            meta={"note": "离开"},
        )
    )
    description = "一位行脚商贩摆开摊位，低声兜售珍贵法器与功法。"
    return {
        "id": f"{run['session']}-{run['step']}-merchant",
        "title": "行脚商贩",
        "description": description,
        "options": options,
        "seed": event_seed,
        "event_type": "merchant",
    }


def _cultivation_build_sacrifice_event(run: Dict[str, Any], base_seed: int) -> Dict[str, Any]:
    event_seed = base_seed ^ 0x7F31
    rng = random.Random(event_seed)
    options: List[Dict[str, Any]] = []
    altar_text = rng.choice([
        "古老石坛散发幽蓝光辉",
        "血色法阵缓缓旋转",
        "幽火缭绕的祭坛矗立前方",
    ])
    artifact_rng = random.Random(event_seed ^ 0x3030)
    artifact = _cultivation_random_artifact(artifact_rng)
    if artifact:
        cost = max(28, 38 + artifact_rng.randint(-6, 12))
        sacrifice = [{"stat": "body", "amount": 1}]
        artifact = dict(artifact)
        name = artifact.get("name", "祭坛馈赠")
        artifact["log"] = f"【献祭】燃烧体魄与{cost}铜钱，换得{name}。{artifact.get('desc', '')}".strip()
        options.append(
            _cultivation_option(
                "sacrifice_artifact",
                f"献祭血骨换取{name}",
                f"献祭1点体魄并奉上{cost}铜钱以换取法宝。",
                "body",
                "sacrifice_trade",
                (18, 26),
                (-4, 1),
                (24, 34),
                "献上精血，祭坛回馈灵光。",
                meta={"cost": cost, "loot": artifact, "sacrifice": sacrifice, "note": "法宝献祭"},
            )
        )
    technique_rng = random.Random(event_seed ^ 0x4040)
    technique = _cultivation_random_technique(technique_rng)
    if technique:
        sacrifice = [{"stat": "mind", "amount": 1}]
        technique = dict(technique)
        gain = max(48, 60 + technique_rng.randint(-4, 16))
        technique["log"] = f"【献祭】燃尽心神换得{technique.get('name', '秘术')}，并获{gain}枚铜钱回馈。{technique.get('desc', '')}".strip()
        options.append(
            _cultivation_option(
                "sacrifice_scroll",
                f"祭献悟性悟得{technique.get('name', '秘术')}",
                f"献祭1点悟性获取功法，并额外得到{gain}铜钱。",
                "spirit",
                "sacrifice_trade",
                (16, 24),
                (-3, 2),
                (22, 32),
                "神魂与祭坛相融，赐下秘法。",
                meta={"loot": technique, "sacrifice": sacrifice, "gain_coins": gain, "note": "功法献祭"},
            )
        )
    gain = max(55, 70 + rng.randint(-10, 18))
    options.append(
        _cultivation_option(
            "sacrifice_coins",
            "祭献气运换取铜钱",
            f"献祭1点气运换得{gain}枚铜钱。",
            "luck",
            "sacrifice_convert",
            (14, 22),
            (-3, 2),
            (18, 28),
            "气运被祭坛吞噬，化作叮当铜钱。",
            meta={"sacrifice": [{"stat": "luck", "amount": 1}], "gain_coins": gain, "note": "铜钱回馈"},
        )
    )
    options.append(
        _cultivation_option(
            "leave_altar",
            "谨慎离开",
            "察觉邪异气息，未做献祭。",
            "spirit",
            "sacrifice_leave",
            (12, 20),
            (-2, 3),
            (14, 22),
            "稳住心神，远离诡异祭坛。",
            meta={"note": "离开"},
        )
    )
    description = f"{altar_text}，低语声蛊惑你献出心神与铜钱。"
    return {
        "id": f"{run['session']}-{run['step']}-sacrifice",
        "title": "秘祭商铺",
        "description": description,
        "options": options,
        "seed": event_seed,
        "event_type": "sacrifice",
    }



def _cultivation_generate_event(run: Dict[str, Any]) -> None:
    if run.get("finished"):
        run["pending_event"] = None
        return
    run["step"] = int(run.get("step") or 0) + 1
    base_seed = run["seed"] + run["step"] * 7919
    rng = random.Random(base_seed)
    trial_spec = _cultivation_next_trial(run)
    if trial_spec:
        run["pending_event"] = _cultivation_build_trial_event(run, base_seed, trial_spec)
        return
    near_break = False
    if run["stage_index"] < len(CULTIVATION_STAGE_THRESHOLDS):
        threshold = CULTIVATION_STAGE_THRESHOLDS[run["stage_index"]]
        near_break = threshold > 0 and run.get("progress", 0.0) >= threshold * 0.8
    if not near_break:
        special_rng = random.Random(base_seed ^ 0x5151)
        roll = special_rng.random()
        if roll < 0.12:
            run["pending_event"] = _cultivation_build_merchant_event(run, base_seed)
            return
        if roll < 0.145:
            run["pending_event"] = _cultivation_build_sacrifice_event(run, base_seed)
            return
    if near_break and run["stage_index"] >= 1:
        event_type = "tribulation"
    else:
        event_type = rng.choices(
            ["meditation", "adventure", "opportunity", "training"],
            weights=[0.3, 0.3, 0.25, 0.15],
        )[0]

    options: List[Dict[str, Any]] = []
    stats = run.get("stats") or {}
    stat_labels = {k: label for k, label in CULTIVATION_STAT_KEYS}
    dominant = None
    if stats:
        dominant = max(stats.items(), key=lambda item: int(item[1]))[0]
    stage_index = int(run.get("stage_index", 0))
    stage_name = CULTIVATION_STAGE_NAMES[min(stage_index, len(CULTIVATION_STAGE_NAMES) - 1)]
    blueprint = CULTIVATION_EVENT_BLUEPRINTS.get(event_type, {})
    default_titles = {
        "meditation": "闭关悟道",
        "adventure": "山野历练",
        "opportunity": "奇遇机缘",
        "training": "门派试炼",
        "tribulation": "境界瓶颈",
    }
    context: Dict[str, Any] = {
        "stage": stage_name,
        "age": int(run.get("age", 0)),
        "dominant": dominant,
        "dominant_label": stat_labels.get(dominant, ""),
    }
    context_rng = random.Random(base_seed ^ 0xBADC0DE)
    for key, source in (blueprint.get("context") or {}).items():
        context[key] = _choose_fragment(context_rng, source, context)

    title = _dynamic_text(blueprint.get("title"), context, context_rng) or default_titles.get(event_type, "历练抉择")
    desc = _dynamic_text(blueprint.get("description"), context, context_rng)

    for spec in blueprint.get("options", []):
        spec_id = spec.get("id") or secrets.token_hex(3)
        focus_key = spec.get("focus") or "mind"
        option_context = dict(context)
        option_context["focus_label"] = stat_labels.get(focus_key, focus_key)
        offset = sum(ord(ch) for ch in spec_id) or 17
        option_rng = random.Random(base_seed ^ (offset << 7))
        label = _dynamic_text(spec.get("label"), option_context, option_rng) or spec_id
        detail = _dynamic_text(spec.get("detail"), option_context, option_rng)
        flavor = _dynamic_text(spec.get("flavor"), option_context, option_rng)
        options.append(
            _cultivation_option(
                spec_id,
                label,
                detail or "",
                focus_key,
                spec.get("type") or "insight",
                spec.get("progress") or (40, 60),
                spec.get("health") or (-4, 2),
                spec.get("score") or (40, 60),
                flavor or "",
            )
        )

    if event_type == "opportunity":
        dominant_specs = (blueprint.get("dominant_options") or {})
        dom_spec = dominant_specs.get(dominant)
        if dom_spec:
            spec_id = dom_spec.get("id") or f"domain-{dominant or 'any'}"
            focus_key = dom_spec.get("focus") or dominant or "mind"
            option_context = dict(context)
            option_context["focus_label"] = stat_labels.get(focus_key, focus_key)
            offset = (sum(ord(ch) for ch in spec_id) or 23) << 3
            option_rng = random.Random(base_seed ^ offset ^ 0xD1CE)
            label = _dynamic_text(dom_spec.get("label"), option_context, option_rng) or spec_id
            detail = _dynamic_text(dom_spec.get("detail"), option_context, option_rng)
            flavor = _dynamic_text(dom_spec.get("flavor"), option_context, option_rng)
            options.append(
                _cultivation_option(
                    spec_id,
                    label,
                    detail or "",
                    focus_key,
                    dom_spec.get("type") or "insight",
                    dom_spec.get("progress") or (55, 88),
                    dom_spec.get("health") or (-5, 5),
                    dom_spec.get("score") or (58, 92),
                    flavor or "",
                )
            )

    if not options:
        options.append(
            _cultivation_option(
                "meditate",
                "静心以待",
                "暂时调息，观察局势变化。",
                "mind",
                "insight",
                (30, 45),
                (-2, 3),
                (28, 46),
                "深吸一口气，稳住心神",
            )
        )

    event = {
        "id": f"{run['session']}-{run['step']}",
        "title": title,
        "description": desc or f"{stage_name}境界的历练悄然展开。",
        "options": options,
        "seed": run["seed"] + run["step"] * 9973,
        "event_type": event_type,
    }
    if dominant and event_type == "opportunity":
        event["theme_stat"] = dominant
        event["theme_label"] = stat_labels.get(dominant)
    if run.get("talent_flags", {}).get("hazard_hint"):
        worst = min(opt["health"][0] for opt in options)
        if worst <= -14:
            event["hint"] = "⚠️ 风险极大，稍有不慎便会重伤"
        elif worst <= -8:
            event["hint"] = "⚠️ 需谨慎，部分选择会造成不小损耗"
        else:
            event["hint"] = "✅ 风险可控，可随心抉择"
    run["pending_event"] = event

def _cultivation_apply_choice(run: Dict[str, Any], choice_id: str) -> Dict[str, Any]:
    event = run.get("pending_event") or {}
    options = event.get("options") or []
    option = next((opt for opt in options if opt.get("id") == choice_id), None)
    if not option:
        raise HTTPException(400, "未知选项")
    rng = random.Random(event.get("seed", 0) + hash(choice_id) % 10007)
    focus = option.get("focus") or "mind"
    stats = run.get("stats", {})
    meta = option.get("meta") or {}
    opt_type = option.get("type") or ""
    if opt_type == "trial":
        return _cultivation_resolve_trial(run, event, option, rng)
    sacrifices = meta.get("sacrifice") or []
    if sacrifices:
        for requirement in sacrifices:
            stat_key = (requirement or {}).get("stat")
            if not stat_key:
                continue
            amount = int((requirement or {}).get("amount") or 0)
            if amount <= 0:
                continue
            current_val = int(stats.get(stat_key, 0))
            if current_val - amount < 1:
                label = _cultivation_stat_label(stat_key)
                raise HTTPException(400, f"当前{label}不足以献祭")
        for requirement in sacrifices:
            stat_key = (requirement or {}).get("stat")
            if not stat_key:
                continue
            amount = int((requirement or {}).get("amount") or 0)
            if amount <= 0:
                continue
            stats[stat_key] = max(1, int(stats.get(stat_key, 0)) - amount)
    if opt_type in {"merchant_buy", "sacrifice_trade"}:
        cost = int(meta.get("cost") or 0)
        if cost > int(run.get("coins", 0)):
            raise HTTPException(400, "铜钱不足")
        run["coins"] = int(run.get("coins", 0)) - cost
    gain_coins = int(meta.get("gain_coins") or 0)
    if gain_coins:
        run["coins"] = int(run.get("coins", 0)) + gain_coins
        if not meta.get("loot"):
            _cultivation_log(run, f"【献祭】祭坛吐出{gain_coins}枚铜钱。", "highlight")
    loot_meta = meta.get("loot")
    if loot_meta:
        _cultivation_record_gain(run, dict(loot_meta))
    stat_value = int(stats.get(focus, 0))
    prev_progress = float(run.get("progress", 0.0))
    prev_score = float(run.get("score", 0.0))
    prev_health = float(run.get("health", 0.0))
    progress_low, progress_high = option.get("progress", (40.0, 60.0))
    progress_gain = rng.uniform(progress_low, progress_high) * CULTIVATION_PROGRESS_SCALE
    progress_gain += stat_value * CULTIVATION_PROGRESS_STAT_WEIGHT
    score_low, score_high = option.get("score", (40.0, 60.0))
    score_gain = rng.uniform(score_low, score_high) * CULTIVATION_SCORE_SCALE
    score_gain += stat_value * CULTIVATION_SCORE_STAT_WEIGHT
    health_low, health_high = option.get("health", (-4.0, 2.0))
    health_delta = rng.uniform(health_low, health_high)
    flags = run.get("talent_flags", {})
    if option.get("type") == "insight":
        bonus = float(flags.get("insight_bonus") or 0.0)
        progress_gain *= 1.0 + bonus
    if option.get("type") == "chance":
        chance_bonus = float(flags.get("chance_bonus") or 0.0)
        extra = progress_gain * chance_bonus
        progress_gain += extra
        score_gain += extra * 0.6
    if option.get("type") == "combat":
        resist = float(flags.get("combat_resist") or 0.0)
        health_delta *= max(0.2, 1.0 - resist)
        score_gain *= 1.0 + float(flags.get("combat_bonus") or 0.0)
    if option.get("type") == "alchemy" and flags.get("alchemy_mastery"):
        progress_gain *= 1.3
        score_gain *= 1.25
    if health_delta < 0 and flags.get("setback_reduce"):
        health_delta = min(0.0, health_delta + float(flags.get("setback_reduce")))

    luck_value = int(stats.get("luck", 0))
    success_threshold = min(
        0.93,
        CULTIVATION_SUCCESS_BASE
        + stat_value * CULTIVATION_SUCCESS_STAT_WEIGHT
        + luck_value * CULTIVATION_SUCCESS_LUCK_WEIGHT,
    )
    crit_threshold = min(
        success_threshold * 0.55,
        0.06 + (stat_value + luck_value) * 0.008,
    )
    roll = rng.random()
    if roll < crit_threshold:
        quality = "brilliant"
    elif roll < success_threshold:
        quality = "success"
    else:
        quality = "failure"
    if event.get("event_type") in {"merchant", "sacrifice"}:
        quality = "success"

    if option.get("type") == "alchemy" and flags.get("alchemy_mastery") and not run.get("alchemy_mastery_used"):
        quality = "brilliant"
        run["alchemy_mastery_used"] = True

    if quality == "failure":
        penalty = rng.uniform(0.25, 0.55)
        progress_loss = rng.uniform(18, 42)
        progress_gain = progress_gain * penalty - progress_loss
        score_gain *= penalty * 0.6
        health_delta -= abs(health_delta) * rng.uniform(0.3, 0.6) + rng.uniform(6, 12)
    elif quality == "brilliant":
        boost = rng.uniform(1.25, 1.55)
        progress_gain *= boost
        score_gain *= boost
        health_delta += abs(health_delta) * rng.uniform(0.2, 0.35)
    else:
        health_delta += abs(health_delta) * 0.05

    new_progress = max(0.0, prev_progress + progress_gain)
    applied_progress = new_progress - prev_progress
    run["progress"] = new_progress
    run["score"] = prev_score + score_gain
    max_health = float(run.get("max_health", 0.0))
    updated_health = prev_health + health_delta
    if updated_health > max_health:
        updated_health = max_health
    aging_rng = random.Random(event.get("seed", 0) ^ 0x5F5E100)
    aging = aging_rng.uniform(0.5, 1.8)
    updated_health -= aging
    run["health"] = updated_health
    run["age"] = int(run.get("age") or 0) + 1
    net_health = run["health"] - prev_health

    event_type = event.get("event_type") or "general"
    tone_map = {"brilliant": "highlight", "success": "success", "failure": "danger"}
    prefix_map = {"brilliant": "【绝佳】", "success": "【顺利】", "failure": "【失利】"}
    narrative = _cultivation_outcome_text(event_type, option.get("label"), focus, quality, rng, run)
    log_text = f"{prefix_map[quality]}{narrative}（修为{applied_progress:+.0f} · 体魄{net_health:+.1f}）"
    _cultivation_log(run, log_text, tone_map[quality])

    run["pending_event"] = None

    extra_rng = random.Random(event.get("seed", 0) ^ 0xA51C3)
    if quality != "failure" and extra_rng.random() < 0.3:
        opp_text, opp_score, _, loot = _cultivation_opportunity(extra_rng, stats)
        run["score"] += opp_score
        _cultivation_log(run, f"【机缘】{opp_text}", "chance")
        _cultivation_record_gain(run, loot)
    elif quality == "failure" and extra_rng.random() < 0.5:
        mishap_text, mishap_penalty, new_health, loot = _cultivation_adventure(extra_rng, stats, run["health"])
        prev_extra = run["health"]
        run["health"] = new_health
        run["score"] += mishap_penalty
        _cultivation_log(run, f"【挫折】{mishap_text} 体魄{run['health'] - prev_extra:+.1f}", "danger")
        _cultivation_record_gain(run, loot)
    if extra_rng.random() < 0.2:
        chance_text, chance_gain, loot = _cultivation_chance(extra_rng, stats)
        run["score"] += chance_gain
        _cultivation_log(run, f"【灵感】{chance_text}", "highlight")
        _cultivation_record_gain(run, loot)

    detail_rng = random.Random(event.get("seed", 0) ^ 0xC0FFEE)
    if option.get("type") == "chance" and detail_rng.random() < 0.7:
        _cultivation_record_gain(run, _cultivation_random_companion(detail_rng))
    if option.get("type") == "insight" and detail_rng.random() < 0.35:
        _cultivation_record_gain(run, _cultivation_random_technique(detail_rng))
    if quality == "brilliant" and detail_rng.random() < 0.5:
        _cultivation_record_gain(run, _cultivation_random_artifact(detail_rng))

    if stats:
        run["stats"] = {k: int(v) for k, v in stats.items()}
        stats = run["stats"]

    if run["health"] <= 0:
        if flags.get("resurrection") and not run.get("resurrected"):
            chance = float(flags.get("resurrection") or 0.0)
            if rng.random() < chance:
                run["resurrected"] = True
                run["health"] = min(max_health, max_health * 0.6)
                _cultivation_log(run, "【重生】凤凰血觉醒，濒死之际重生归来。", "highlight")
            else:
                run["finished"] = True
                run["ending_type"] = "fallen"
                _cultivation_log(run, "【陨落】伤重难愈，功败垂成。", "danger")
        else:
            run["finished"] = True
            run["ending_type"] = "fallen"
            _cultivation_log(run, "【陨落】元气衰竭，跌坐于尘埃。", "danger")

    if not run.get("finished") and int(run.get("age") or 0) >= int(run.get("lifespan") or 0):
        run["finished"] = True
        run["ending_type"] = "lifespan"
        _cultivation_log(run, "【坐化】寿元耗尽，化作飞灰。", "warning")

    if not run.get("finished"):
        rng_stage = random.Random(event.get("seed", 0) ^ 0xABCDEF)
        while run["stage_index"] < len(CULTIVATION_STAGE_THRESHOLDS):
            threshold = CULTIVATION_STAGE_THRESHOLDS[run["stage_index"]]
            if run["progress"] < threshold:
                break
            run["progress"] -= threshold
            run["stage_index"] += 1
            stage_name = CULTIVATION_STAGE_NAMES[min(run["stage_index"], len(CULTIVATION_STAGE_NAMES) - 1)]
            surge = rng_stage.uniform(70, 120)
            run["score"] += surge + stat_value * 3
            bonus_health = rng_stage.uniform(18, 30) + int(stats.get("body", 0)) * 0.6
            prev_hp = run["health"]
            run["max_health"] = float(run.get("max_health", 0.0)) + bonus_health
            run["health"] = min(run["max_health"], run["health"] + bonus_health * 0.8)
            recovered = run["health"] - prev_hp
            _cultivation_log(
                run,
                f"【突破】{run['age']} 岁突破至 {stage_name}，生命上限+{bonus_health:.1f}，回复 {recovered:+.1f}",
                "highlight",
            )
            if run["stage_index"] >= len(CULTIVATION_STAGE_NAMES) - 1:
                run["finished"] = True
                run["ending_type"] = "ascend"
                _cultivation_log(run, "【飞升】天劫散去，羽化登仙。", "highlight")
                break

    total_score_gain = run["score"] - prev_score
    final_net_health = run["health"] - prev_health

    return {
        "progress_gain": round(applied_progress, 1),
        "score_gain": round(total_score_gain, 1),
        "health_delta": round(final_net_health, 1),
        "age": run["age"],
        "narrative": narrative,
        "tone": tone_map[quality],
        "quality": quality,
    }


def _cultivation_run_view(run: Dict[str, Any]) -> Dict[str, Any]:
    event = run.get("pending_event") or None
    event_view: Optional[Dict[str, Any]] = None
    if event:
        opts_view = []
        for opt in event.get("options", []):
            option_view = {
                "id": opt.get("id"),
                "label": opt.get("label"),
                "detail": opt.get("detail"),
                "type": opt.get("type"),
            }
            meta = opt.get("meta")
            if isinstance(meta, dict):
                meta_view: Dict[str, Any] = {}
                if "cost" in meta:
                    try:
                        meta_view["cost"] = int(meta.get("cost") or 0)
                    except Exception:
                        pass
                if "gain_coins" in meta:
                    try:
                        meta_view["gain_coins"] = int(meta.get("gain_coins") or 0)
                    except Exception:
                        pass
                sacrifices = meta.get("sacrifice")
                if isinstance(sacrifices, (list, tuple)):
                    entries: List[Dict[str, Any]] = []
                    for item in sacrifices:
                        if not isinstance(item, dict):
                            continue
                        stat_key = item.get("stat")
                        if not stat_key:
                            continue
                        try:
                            amount = int(item.get("amount") or 0)
                        except Exception:
                            amount = 0
                        entries.append({"stat": stat_key, "amount": amount})
                    if entries:
                        meta_view["sacrifice"] = entries
                loot_meta = meta.get("loot")
                if isinstance(loot_meta, dict) and loot_meta.get("name"):
                    meta_view["loot_name"] = loot_meta.get("name")
                if meta.get("note"):
                    meta_view["note"] = str(meta.get("note"))
                if meta_view:
                    option_view["meta"] = meta_view
            opts_view.append(option_view)
        event_view = {
            "id": event.get("id"),
            "title": event.get("title"),
            "description": event.get("description"),
            "options": opts_view,
            "event_type": event.get("event_type"),
        }
        if event.get("hint"):
            event_view["hint"] = event.get("hint")
        if event.get("theme_label"):
            event_view["theme_label"] = event.get("theme_label")
        trial_info = event.get("trial_info")
        if isinstance(trial_info, dict):
            event_view["trial"] = {
                "id": trial_info.get("id"),
                "name": trial_info.get("name"),
                "stat": trial_info.get("stat"),
                "stat_label": trial_info.get("stat_label"),
                "difficulty": int(trial_info.get("difficulty") or 0),
                "delay_ms": int(trial_info.get("delay_ms") or CULTIVATION_TRIAL_DELAY_MS),
            }
    stage_name = CULTIVATION_STAGE_NAMES[min(run.get("stage_index", 0), len(CULTIVATION_STAGE_NAMES) - 1)]
    log_entries: List[Dict[str, Any]] = []
    for entry in run.get("log", []):
        if isinstance(entry, dict):
            log_entries.append(
                {
                    "text": str(entry.get("text", "")),
                    "tone": entry.get("tone") or "info",
                }
            )
        else:
            log_entries.append({"text": str(entry), "tone": "info"})
    return {
        "stage": stage_name,
        "stage_index": int(run.get("stage_index", 0)),
        "age": int(run.get("age", 0)),
        "lifespan": int(run.get("lifespan", 0)),
        "health": round(float(run.get("health", 0.0)), 1),
        "max_health": round(float(run.get("max_health", 0.0)), 1),
        "progress": round(float(run.get("progress", 0.0)), 1),
        "score": int(round(float(run.get("score", 0.0)))),
        "stats": {k: int(v) for k, v in (run.get("stats") or {}).items()},
        "talents": run.get("talents", []),
        "lineage": _cultivation_view_lineage(run),
        "artifacts": _cultivation_view_items(run.get("artifacts")),
        "companions": _cultivation_view_items(run.get("companions")),
        "techniques": _cultivation_view_items(run.get("techniques")),
        "coins": int(run.get("coins", 0)),
        "pending_event": event_view,
        "log": log_entries[-30:],
        "finished": bool(run.get("finished")),
        "ending_type": run.get("ending_type"),
    }


def _cultivation_choose_ending(run: Dict[str, Any]) -> str:
    rng = random.Random(run.get("seed", 0) ^ 0x13579BDF)
    stage_name = CULTIVATION_STAGE_NAMES[min(run.get("stage_index", 0), len(CULTIVATION_STAGE_NAMES) - 1)]
    ending_type = run.get("ending_type")
    if ending_type == "ascend":
        pool = [
            "羽化登仙，身入上界。",
            "破碎虚空，于九天之上留名。",
            "托身青冥，成就一方仙尊。",
        ]
    elif ending_type == "lifespan":
        pool = [
            "寿元圆满，安然坐化。",
            "化作一缕清风，遗泽后人。",
            "归隐山林，将道统留于世间。",
        ]
    elif ending_type == "fallen":
        pool = [
            "道途折戟，神魂散去。",
            "身陨道消，只余道痕萦绕。",
            "天劫难渡，化作星辉坠落。",
        ]
    elif ending_type == "trial_exam":
        pool = [
            "宗门考核失利，被迫转身离去。",
            "大比折戟，带着遗憾退回凡尘。",
            "才情不足，被宗门遣返重修。",
        ]
    elif ending_type == "trial_ambush":
        pool = [
            "遭遇魔修伏击，魂飞魄散。",
            "血战之中气尽力竭，身陨荒野。",
            "魔意侵袭无力回天，遗骨无存。",
        ]
    elif ending_type == "trial_tribulation":
        pool = [
            "天劫雷火将其吞没，只余焦土。",
            "九重雷霆落下，法体俱灭。",
            "心神崩散于雷霆之中，未能飞升。",
        ]
    else:
        pool = [
            f"{stage_name}境界圆满，重归凡尘济世。",
            f"虽未飞升，却在{stage_name}境界自成一派。",
            f"游历九州，以{stage_name}修为守护一域。",
        ]
    return rng.choice(pool)


def _cultivation_finalize(
    db: Session,
    profile: CookieFactoryProfile,
    user: User,
    now: int,
    state: Dict[str, Any],
    node: Dict[str, Any],
    run: Dict[str, Any],
) -> Dict[str, Any]:
    result_entries: List[Dict[str, Any]] = []
    for entry in run.get("log", []):
        if isinstance(entry, dict):
            result_entries.append(
                {
                    "text": str(entry.get("text", "")),
                    "tone": entry.get("tone") or "info",
                }
            )
        else:
            result_entries.append({"text": str(entry), "tone": "info"})
    result_log = result_entries[-30:]
    stage_index = int(run.get("stage_index", 0))
    stage_name = CULTIVATION_STAGE_NAMES[min(stage_index, len(CULTIVATION_STAGE_NAMES) - 1)]
    base_score = float(run.get("score", 0.0))
    stats = run.get("stats") or {}
    base_score += stage_index * 140
    base_score += sum(int(v) for v in stats.values()) * 6
    base_score += max(0.0, float(run.get("health", 0.0))) * 0.8
    base_score += max(0, int(run.get("lifespan", 0)) - int(run.get("age", 0))) * 3
    base_score += len(result_log) * 2
    score = max(0, int(round(base_score)))

    cfg = COOKIE_MINI_GAMES.get(COOKIE_CULTIVATION_KEY, {})
    threshold = int(cfg.get("score_threshold", 0) or 0)
    reward_allocation: Dict[str, int] = {}
    bricks_awarded = 0
    if threshold and score >= threshold:
        bricks_awarded = 1 + (1 if score >= threshold * 2 else 0)
        available_seasons = SEASON_IDS[:6] if len(SEASON_IDS) >= 6 else (SEASON_IDS or [])
        if not available_seasons:
            available_seasons = [LATEST_SEASON or BRICK_SEASON_FALLBACK]
        for _ in range(bricks_awarded):
            sid = random.choice(available_seasons) if available_seasons else BRICK_SEASON_FALLBACK
            grant_user_bricks(db, user, sid, 1)
            reward_allocation[sid] = reward_allocation.get(sid, 0) + 1
        profile.total_bricks_earned = int(profile.total_bricks_earned or 0) + bricks_awarded

    ending = _cultivation_choose_ending(run)

    best_prev = int(node.get("best_score") or 0)
    if score > best_prev:
        node["best_score"] = score
    node["play_count"] = int(node.get("play_count") or 0) + 1

    run_talents = run.get("talents", [])
    talent_details = [
        {
            "name": t.get("name"),
            "rarity": t.get("rarity"),
            "rarity_label": t.get("rarity_label"),
            "rarity_tone": t.get("rarity_tone"),
            "desc": t.get("desc"),
        }
        for t in run_talents
    ]

    last_result = {
        "score": score,
        "best": int(node.get("best_score") or score),
        "stage": stage_name,
        "age": int(run.get("age", 0)),
        "ending": ending,
        "events": result_log,
        "reward": {"bricks": bricks_awarded, "by_season": reward_allocation},
        "timestamp": now,
        "talents": [t.get("name") for t in run_talents],
        "talent_details": talent_details,
        "stats": {k: int(v) for k, v in stats.items()},
        "lineage": _cultivation_view_lineage(run),
        "artifacts": _cultivation_view_items(run.get("artifacts")),
        "companions": _cultivation_view_items(run.get("companions")),
        "techniques": _cultivation_view_items(run.get("techniques")),
        "ending_type": run.get("ending_type"),
        "coins": int(run.get("coins", 0)),
    }
    node["last_result"] = last_result
    history = node.get("history") if isinstance(node.get("history"), list) else []
    history.append(last_result)
    node["history"] = history[-10:]
    node.pop("active_run", None)
    node.pop("lobby", None)
    state[COOKIE_CULTIVATION_KEY] = node
    profile.mini_games = _json_dump(state)
    summary = f"{stage_name}境界 · {int(run.get('age', 0))} 岁 · 得分 {score}"
    return {
        "mini": COOKIE_CULTIVATION_KEY,
        "mode": "cultivation",
        "score": score,
        "best": int(node.get("best_score") or score),
        "stage": stage_name,
        "age": int(run.get("age", 0)),
        "ending": ending,
        "events": result_log,
        "reward": {"bricks": bricks_awarded, "by_season": reward_allocation},
        "summary": summary,
        "lineage": _cultivation_view_lineage(run),
        "artifacts": _cultivation_view_items(run.get("artifacts")),
        "companions": _cultivation_view_items(run.get("companions")),
        "techniques": _cultivation_view_items(run.get("techniques")),
        "stats": {k: int(v) for k, v in stats.items()},
        "talents": [t.get("name") for t in run_talents],
        "talent_details": talent_details,
        "ending_type": run.get("ending_type"),
        "coins": int(run.get("coins", 0)),
    }



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
    cultivation_enabled: bool = True,
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
        if key == COOKIE_CULTIVATION_KEY:
            continue
        node = mini_state.get(key, {})
        item = {
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
        }
        if key == COOKIE_CULTIVATION_KEY:
            last_result = node.get("last_result") if isinstance(node.get("last_result"), dict) else {}
            item.update(
                {
                    "mode": "cultivation",
                    "best_score": int(node.get("best_score") or last_result.get("best") or 0),
                    "play_count": int(node.get("play_count") or 0),
                    "score_threshold": int(cfg.get("score_threshold", 0) or 0),
                    "last_result": last_result or None,
                }
            )
        mini_payload.append(item)
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
        "features": {
            "cultivation_enabled": bool(cultivation_enabled),
        },
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
            layer_season = _brick_season_key(layer.get("season"))
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
            season=order.season,
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
            season_key = _brick_season_key(item.get("season"))
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


def compute_odds(pity_brick: int, pity_purple: int, cfg: PoolConfig) -> OddsOut:
    n = max(0, int(pity_brick or 0))
    m = max(0, int(pity_purple or 0))
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
    cultivation_enabled = cookie_cultivation_enabled(db)
    brick_detail = brick_balance_detail(db, user.id)
    pity_detail = season_pity_detail(db, user.id)
    return {
        "username": user.username, "phone": phone,
        "fiat": user.fiat, "coins": user.coins, "keys": user.keys,
        "unopened_bricks": user.unopened_bricks,
        "unopened_bricks_detail": brick_detail,
        "pity_brick": user.pity_brick, "pity_purple": user.pity_purple,
        "pity_by_season": pity_detail,
        "is_admin": bool(getattr(user, "is_admin", False)),
        "features": {
            "cookie_factory": {
                "enabled": bool(cookie_enabled),
                "available": bool(cookie_enabled or getattr(user, "is_admin", False)),
            },
            "cultivation": {
                "enabled": bool(cultivation_enabled),
                "available": bool(cultivation_enabled or getattr(user, "is_admin", False)),
            },
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
    cultivation_enabled = cookie_cultivation_enabled(db)
    if not enabled and not getattr(user, "is_admin", False):
        return {"enabled": False, "now": now}
    profile = ensure_cookie_profile(db, user, now)
    settlement = cookie_maybe_settle(db, profile, user, now)
    cookie_tick(profile, now)
    db.flush()
    payload = cookie_status_payload(
        user,
        profile,
        now,
        settlement,
        feature_enabled=enabled,
        cultivation_enabled=cultivation_enabled,
    )
    if not enabled and getattr(user, "is_admin", False):
        payload["admin_preview"] = True
    db.commit()
    return payload


@app.post("/cookie-factory/login")
def cookie_factory_login(user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    now = int(time.time())
    enabled = cookie_factory_enabled(db)
    cultivation_enabled = cookie_cultivation_enabled(db)
    if not enabled and not getattr(user, "is_admin", False):
        raise HTTPException(404, "小游戏未开启")
    profile = ensure_cookie_profile(db, user, now)
    settlement = cookie_maybe_settle(db, profile, user, now)
    cookie_tick(profile, now)
    info = cookie_register_login(profile, now)
    if info.get("added"):
        cookie_add_active_points(profile, now, 5)
    db.flush()
    payload = cookie_status_payload(
        user,
        profile,
        now,
        settlement,
        feature_enabled=enabled,
        cultivation_enabled=cultivation_enabled,
    )
    info["daily_reward"] = 2 if info.get("added") else 0
    payload["login_result"] = info
    db.commit()
    return payload


@app.post("/cookie-factory/act")
def cookie_factory_act(inp: CookieActIn, user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    now = int(time.time())
    enabled = cookie_factory_enabled(db)
    cultivation_enabled = cookie_cultivation_enabled(db)
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
        if mini_key == COOKIE_CULTIVATION_KEY:
            if not cultivation_enabled and not getattr(user, "is_admin", False):
                raise HTTPException(404, "小游戏未开启")
            raise HTTPException(400, "修仙玩法已移至独立界面，请前往修仙页面体验")
        else:
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
        reset_state = {
            k: {"level": 0, "progress": 0, "last_action": now}
            for k in COOKIE_MINI_GAMES
            if k != COOKIE_CULTIVATION_KEY
        }
        _, cultivation_node = _cultivation_node(profile)
        reset_state[COOKIE_CULTIVATION_KEY] = cultivation_node
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
    payload = cookie_status_payload(
        user,
        profile,
        now,
        settlement,
        feature_enabled=enabled,
        cultivation_enabled=cultivation_enabled,
    )
    payload["action_result"] = result
    db.commit()
    return payload


@app.get("/cultivation/status")
def cultivation_status(user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    now = int(time.time())
    enabled = cookie_cultivation_enabled(db)
    is_admin = bool(getattr(user, "is_admin", False))
    if not enabled and not is_admin:
        return {"enabled": False, "now": now}
    profile = ensure_cookie_profile(db, user, now)
    state, node = _cultivation_node(profile)
    run = node.get("active_run") if isinstance(node.get("active_run"), dict) else None
    if run and run.get("finished"):
        node.pop("active_run", None)
        run = None
    if run and not run.get("pending_event"):
        _cultivation_generate_event(run)
    lobby = None
    if not run:
        lobby = _cultivation_prepare_lobby(node)
    run_view = _cultivation_run_view(run) if run else None
    history = node.get("history") if isinstance(node.get("history"), list) else []
    payload = {
        "enabled": bool(enabled),
        "now": now,
        "lobby": lobby,
        "run": run_view,
        "best_score": int(node.get("best_score") or 0),
        "play_count": int(node.get("play_count") or 0),
        "last_result": node.get("last_result"),
        "history": history[-5:],
        "score_threshold": int(COOKIE_MINI_GAMES.get(COOKIE_CULTIVATION_KEY, {}).get("score_threshold", 0) or 0),
    }
    if not enabled and is_admin:
        payload["admin_preview"] = True
    state[COOKIE_CULTIVATION_KEY] = node
    profile.mini_games = _json_dump(state)
    db.commit()
    return payload


@app.post("/cultivation/refresh")
def cultivation_refresh(user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    now = int(time.time())
    enabled = cookie_cultivation_enabled(db)
    if not enabled and not getattr(user, "is_admin", False):
        raise HTTPException(404, "小游戏未开启")
    profile = ensure_cookie_profile(db, user, now)
    state, node = _cultivation_node(profile)
    run = node.get("active_run") if isinstance(node.get("active_run"), dict) else None
    if run and not run.get("finished"):
        raise HTTPException(400, "历练进行中，无法刷新天赋")
    lobby = _cultivation_prepare_lobby(node)
    remaining = int(lobby.get("refreshes_left") or 0)
    if remaining <= 0:
        raise HTTPException(400, "刷新次数已用尽")
    lobby["refreshes_left"] = remaining - 1
    rng = random.Random(secrets.randbits(64))
    lobby["talents"] = _cultivation_pick_talents(rng)
    node["lobby"] = lobby
    state[COOKIE_CULTIVATION_KEY] = node
    profile.mini_games = _json_dump(state)
    db.commit()
    return {"lobby": lobby}


@app.post("/cultivation/begin")
def cultivation_begin(
    inp: CultivationBeginIn,
    user: User = Depends(user_from_token),
    db: Session = Depends(get_db),
):
    now = int(time.time())
    enabled = cookie_cultivation_enabled(db)
    if not enabled and not getattr(user, "is_admin", False):
        raise HTTPException(404, "小游戏未开启")
    profile = ensure_cookie_profile(db, user, now)
    state, node = _cultivation_node(profile)
    run = node.get("active_run") if isinstance(node.get("active_run"), dict) else None
    if run and not run.get("finished"):
        raise HTTPException(400, "仍有历练尚未结束")
    lobby = _cultivation_prepare_lobby(node)
    max_talents = int(lobby.get("max_talents") or CULTIVATION_MAX_TALENTS)
    selected_ids: List[str] = []
    for tid in inp.talents:
        tid = (tid or "").strip()
        if not tid or tid in selected_ids:
            continue
        selected_ids.append(tid)
    if len(selected_ids) > max_talents:
        raise HTTPException(400, f"最多可选择 {max_talents} 项天赋")
    selected_actual = []
    for tid in selected_ids:
        talent = _cultivation_find_talent(tid)
        if not talent:
            raise HTTPException(400, f"未知天赋 {tid}")
        selected_actual.append(talent)
    origin_id = (inp.origin or "").strip()
    sect_id = (inp.sect or "").strip()
    master_id = (inp.master or "").strip()
    origin_choice = _cultivation_find_origin(origin_id)
    if not origin_choice:
        raise HTTPException(400, "未知出身")
    sect_choice = _cultivation_find_sect(sect_id)
    if not sect_choice:
        raise HTTPException(400, "未知宗门")
    master_choice = _cultivation_find_master(master_id)
    if not master_choice:
        raise HTTPException(400, "未知师承")
    status = int(origin_choice.get("status") or 1)
    if int(sect_choice.get("min_status") or 1) > status:
        raise HTTPException(400, "出身尚不足以拜入该宗门")
    if master_choice.get("sect") and sect_choice.get("id") and master_choice.get("sect") != sect_choice.get("id"):
        raise HTTPException(400, "该师承不在所选宗门门下")
    if int(master_choice.get("min_status") or 1) > status:
        raise HTTPException(400, "出身尚不足以拜入该师门")
    base_stats = {k: int(v) for k, v in (lobby.get("base_stats") or {}).items()}
    points = int(lobby.get("points") or CULTIVATION_BASE_POINTS)
    allocations = inp.attributes or {}
    total_alloc = 0
    for key, value in allocations.items():
        if key not in base_stats:
            raise HTTPException(400, f"未知属性 {key}")
        add = int(value or 0)
        if add < 0:
            raise HTTPException(400, "属性点不可为负数")
        base_stats[key] += add
        total_alloc += add
    if total_alloc != points:
        raise HTTPException(400, f"属性点需分配 {points} 点 (已使用 {total_alloc})")
    for bonus_source in (origin_choice, sect_choice, master_choice):
        for key, value in (bonus_source.get("stats") or {}).items():
            try:
                base_stats[key] = int(base_stats.get(key, 0)) + int(value)
            except Exception:
                continue
    stats, flags = _cultivation_apply_talents(base_stats, selected_actual)
    innate_flags: Dict[str, Any] = {}
    for bonus_source in (origin_choice, sect_choice, master_choice):
        for flag_key, flag_val in (bonus_source.get("flags") or {}).items():
            current = innate_flags.get(flag_key)
            if isinstance(flag_val, (int, float)) and isinstance(current, (int, float)):
                innate_flags[flag_key] = current + flag_val
            else:
                innate_flags[flag_key] = flag_val
    for flag_key, flag_val in innate_flags.items():
        existing = flags.get(flag_key)
        if isinstance(flag_val, (int, float)) and isinstance(existing, (int, float)):
            flags[flag_key] = existing + flag_val
        elif flag_key not in flags:
            flags[flag_key] = flag_val
        else:
            flags[flag_key] = flag_val
    display_talents = [_cultivation_render_talent(t) for t in selected_actual]
    starting_coins = int(origin_choice.get("coins") or 0) + int(sect_choice.get("coins") or 0) + int(master_choice.get("coins") or 0)
    run = _cultivation_start_run(
        node,
        display_talents,
        stats,
        flags,
        origin_choice,
        sect_choice,
        master_choice,
        starting_coins,
    )
    _cultivation_generate_event(run)
    state[COOKIE_CULTIVATION_KEY] = node
    profile.mini_games = _json_dump(state)
    db.commit()
    return {
        "run": _cultivation_run_view(run),
        "best_score": int(node.get("best_score") or 0),
        "lobby": None,
    }


@app.post("/cultivation/advance")
def cultivation_advance(
    inp: CultivationAdvanceIn,
    user: User = Depends(user_from_token),
    db: Session = Depends(get_db),
):
    now = int(time.time())
    enabled = cookie_cultivation_enabled(db)
    if not enabled and not getattr(user, "is_admin", False):
        raise HTTPException(404, "小游戏未开启")
    profile = ensure_cookie_profile(db, user, now)
    state, node = _cultivation_node(profile)
    run = node.get("active_run") if isinstance(node.get("active_run"), dict) else None
    if not run or run.get("finished"):
        raise HTTPException(400, "当前没有进行中的历练")
    if not run.get("pending_event"):
        _cultivation_generate_event(run)
    if not run.get("pending_event"):
        raise HTTPException(400, "暂无可推进的事件")
    outcome = _cultivation_apply_choice(run, (inp.choice or "").strip())
    if run.get("finished"):
        result = _cultivation_finalize(db, profile, user, now, state, node, run)
        _cultivation_prepare_lobby(node)
        state[COOKIE_CULTIVATION_KEY] = node
        profile.mini_games = _json_dump(state)
        db.commit()
        return {
            "finished": True,
            "result": result,
            "best_score": int(node.get("best_score") or 0),
            "last_result": node.get("last_result"),
        }
    if not run.get("pending_event"):
        _cultivation_generate_event(run)
    state[COOKIE_CULTIVATION_KEY] = node
    profile.mini_games = _json_dump(state)
    db.commit()
    return {
        "finished": False,
        "run": _cultivation_run_view(run),
        "outcome": outcome,
    }


@app.get("/admin/cookie-factory")
def admin_cookie_factory_status(user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    if not getattr(user, "is_admin", False):
        raise HTTPException(403, "需要管理员权限")
    enabled = cookie_factory_enabled(db)
    cultivation_enabled = cookie_cultivation_enabled(db)
    cultivation_runs, cultivation_best = cookie_cultivation_admin_stats(db)
    total_profiles = db.query(CookieFactoryProfile).count()
    total_bricks = db.query(func.coalesce(func.sum(CookieFactoryProfile.total_bricks_earned), 0)).scalar()
    total_bricks = int(total_bricks or 0)
    return {
        "enabled": bool(enabled),
        "profiles": total_profiles,
        "total_bricks": total_bricks,
        "cultivation_enabled": bool(cultivation_enabled),
        "cultivation_runs": int(cultivation_runs),
        "cultivation_best": int(cultivation_best),
    }


@app.post("/admin/cookie-factory/toggle")
def admin_cookie_factory_toggle(payload: Dict[str, Any], user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    if not getattr(user, "is_admin", False):
        raise HTTPException(403, "需要管理员权限")
    desired = bool((payload or {}).get("enabled", False))
    set_cookie_factory_enabled(db, desired)
    db.commit()
    return {"enabled": desired}


@app.post("/admin/cookie-factory/cultivation-toggle")
def admin_cookie_cultivation_toggle(payload: Dict[str, Any], user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    if not getattr(user, "is_admin", False):
        raise HTTPException(403, "需要管理员权限")
    desired = bool((payload or {}).get("enabled", False))
    set_cookie_cultivation_enabled(db, desired)
    db.commit()
    return {"enabled": desired}


@app.post("/presence/update")
def presence_update(
    inp: PresenceUpdateIn,
    user: User = Depends(user_from_token),
    db: Session = Depends(get_db),
):
    update_presence(db, user, inp.page or "", inp.activity or "", inp.details or {})
    db.commit()
    return {"ok": True, "now": int(time.time())}


@app.get("/admin/presence")
def admin_presence(user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    if not getattr(user, "is_admin", False):
        raise HTTPException(403, "需要管理员权限")
    data = list_active_presence(db)
    db.commit()
    return {"now": int(time.time()), "online": data}



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
def odds(
    season: Optional[str] = Query(None),
    user: User = Depends(user_from_token),
    db: Session = Depends(get_db),
):
    cfg = db.query(PoolConfig).first()
    pity_row = get_user_season_pity(db, user, season)
    season_key = pity_row.season or BRICK_SEASON_FALLBACK
    od = compute_odds(pity_row.pity_brick, pity_row.pity_purple, cfg)
    sync_user_global_pity(user, season_key, pity_row)
    return {
        "odds": od.dict(),
        "limits": {"brick_pity_max": cfg.brick_pity_max, "purple_pity_max": cfg.purple_pity_max},
        "season": season_key,
        "season_label": _season_display_name(season_key),
        "pity": {
            "season": season_key,
            "season_label": _season_display_name(season_key),
            "pity_brick": pity_row.pity_brick,
            "pity_purple": pity_row.pity_purple,
        },
    }

@app.post("/gacha/open")
def gacha_open(inp: CountIn, user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    if inp.count <= 0:
        raise HTTPException(400, "数量必须大于 0")
    admin_max = 200
    if user.is_admin:
        if inp.count > admin_max:
            raise HTTPException(400, f"管理员批量开砖一次最多 {admin_max} 连")
    elif inp.count not in (1, 10):
        raise HTTPException(400, "当前仅支持单抽或十连")
    if user.unopened_bricks < inp.count: raise HTTPException(400, "未开砖数量不足")
    if user.keys < inp.count: raise HTTPException(400, "钥匙不足")
    cfg = db.query(PoolConfig).first()
    season_key = _season_pity_key(inp.season)
    brick_season_param = None if season_key == BRICK_SEASON_FALLBACK else season_key
    consume_user_bricks(db, user, brick_season_param, inp.count, allow_gift=True)
    user.keys -= inp.count
    mark_cookie_delta_activity(db, user.id)

    results = []
    target_skin = (inp.target_skin_id or "").strip()
    pity_row = get_user_season_pity(db, user, season_key)

    for _ in range(inp.count):
        od = compute_odds(pity_row.pity_brick, pity_row.pity_purple, cfg)
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
            pity_row.pity_brick = 0
            pity_row.pity_purple = int(pity_row.pity_purple or 0) + 1
        elif rarity == "PURPLE":
            pity_row.pity_brick = int(pity_row.pity_brick or 0) + 1
            pity_row.pity_purple = 0
        else:
            pity_row.pity_brick = int(pity_row.pity_brick or 0) + 1
            pity_row.pity_purple = int(pity_row.pity_purple or 0) + 1

        preferred = target_skin if rarity == "BRICK" and target_skin else None
        skin = pick_skin(db, rarity, season=season_key, preferred_skin_id=preferred)
        exquisite = (secrets.randbelow(100) < 15) if rarity == "BRICK" else False
        wear_bp = wear_random_bp()
        grade = grade_from_wear_bp(wear_bp)
        profile = generate_visual_profile(skin.rarity, exquisite, model_key=skin.model_key, skin=skin)

        result_season = _brick_season_key(skin.season or season_key)
        inv = Inventory(
            user_id=user.id, skin_id=skin.skin_id, name=skin.name, rarity=skin.rarity,
            exquisite=exquisite, wear_bp=wear_bp, grade=grade, serial="",
            acquired_at=int(time.time()),
            body_colors=json.dumps(profile["body"], ensure_ascii=False),
            attachment_colors=json.dumps(profile["attachments"], ensure_ascii=False),
            template_name=profile["template"],
            effect_tags=json.dumps(profile["effects"], ensure_ascii=False),
            hidden_template=profile["hidden_template"],
            season=result_season,
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
            "template_label": profile.get("template_label", ""),
            "hidden_template": profile["hidden_template"],
            "effects": profile["effects"],
            "effect_labels": profile.get("effect_labels", []),
            "affinity": profile.get("affinity", {}),
            "affinity_label": profile.get("affinity_label", ""),
            "affinity_tag": profile.get("affinity_tag", ""),
            "season": result_season,
            "model": profile.get("model", skin.model_key or ""),
            "sell_locked": bool(inv.sell_locked),
            "lock_reason": inv.lock_reason or "",
            "visual": {
                "body": profile["body"],
                "attachments": profile["attachments"],
                "template": profile["template"],
                "template_label": profile.get("template_label", ""),
                "hidden_template": profile["hidden_template"],
                "effects": profile["effects"],
                "effect_labels": profile.get("effect_labels", []),
                "affinity": profile.get("affinity", {}),
                "affinity_label": profile.get("affinity_label", ""),
                "affinity_tag": profile.get("affinity_tag", ""),
                "model": profile.get("model", skin.model_key or ""),
            },
        })

    apply_brick_market_influence(db, cfg, results)
    process_brick_buy_orders(db, cfg)
    sync_user_global_pity(user, season_key, pity_row)
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
            "template_label": vis.get("template_label", ""),
            "hidden_template": vis["hidden_template"],
            "effects": vis["effects"],
            "effect_labels": vis.get("effect_labels", []),
            "affinity": vis.get("affinity", {}),
            "affinity_label": vis.get("affinity_label", ""),
            "affinity_tag": vis.get("affinity_tag", ""),
            "model": vis.get("model", ""),
        }

        season_source = x.season or (skin_map.get(x.skin_id).season if skin_map.get(x.skin_id) else "")
        season_key = _brick_season_key(season_source)
        if season_key and (x.season or "") != season_key:
            x.season = season_key
            changed = True
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
            "template_label": vis.get("template_label", ""),
            "hidden_template": vis["hidden_template"],
            "effects": vis["effects"],
            "effect_labels": vis.get("effect_labels", []),
            "affinity": vis.get("affinity", {}),
            "affinity_label": vis.get("affinity_label", ""),
            "affinity_tag": vis.get("affinity_tag", ""),
            "model": vis.get("model", ""),
            "season": season_key,
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
            "template_label": vis.get("template_label", ""),
            "hidden_template": vis["hidden_template"],
            "effects": vis["effects"],
            "effect_labels": vis.get("effect_labels", []),
            "affinity": vis.get("affinity", {}),
            "affinity_label": vis.get("affinity_label", ""),
            "affinity_tag": vis.get("affinity_tag", ""),
            "model": vis.get("model", ""),
        }

        season_source = x.season or (skin_map.get(x.skin_id).season if skin_map.get(x.skin_id) else "")
        season_key = _brick_season_key(season_source)
        if season_key and (x.season or "") != season_key:
            x.season = season_key
            changed = True
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
            "template_label": vis.get("template_label", ""),
            "hidden_template": vis["hidden_template"],
            "effects": vis["effects"],
            "effect_labels": vis.get("effect_labels", []),
            "affinity": vis.get("affinity", {}),
            "affinity_label": vis.get("affinity_label", ""),
            "affinity_tag": vis.get("affinity_tag", ""),
            "model": vis.get("model", ""),
            "season": season_key,
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
def brick_order_book(
    season: Optional[str] = Query(None),
    user: User = Depends(user_from_token),
    db: Session = Depends(get_db),
):
    cfg = db.query(PoolConfig).first()
    state = ensure_brick_market_state(db, cfg)
    layers = official_sell_layers(cfg, state)
    season_raw = (season or "").strip()
    if season_raw and season_raw.upper() == "ALL":
        season_raw = ""
    season_key = _normalize_season(season_raw)
    player_query = db.query(BrickSellOrder, User).join(User, BrickSellOrder.user_id == User.id, isouter=True)\
        .filter(BrickSellOrder.active == True, BrickSellOrder.source == "player", BrickSellOrder.remaining > 0)
    if season_key:
        player_query = player_query.filter(func.upper(BrickSellOrder.season) == season_key)
    player_rows = player_query\
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
            "season": order.season or "",
            "season_name": _season_display_name(_brick_season_key(order.season)),
        }
        if entry["mine"]:
            my_buy.append(entry)
        if getattr(user, "is_admin", False):
            player_buy_view.append(entry)
    filtered_layers = []
    for layer in layers:
        layer_key = _brick_season_key(layer.get("season"))
        if season_key and layer_key != season_key:
            continue
        filtered_layers.append(layer)
    histogram = build_brick_histogram(filtered_layers, [row[0] for row in player_rows])
    for layer in layers:
        layer["season_name"] = _season_display_name(layer.get("season") or BRICK_SEASON_FALLBACK)
    resp = {
        "official_price": cfg.brick_price,
        "official_layers": filtered_layers if season_key else layers,
        "player_sells": player_sell_view if getattr(user, "is_admin", False) else [],
        "player_buys": player_buy_view if getattr(user, "is_admin", False) else [],
        "my_sells": my_sell,
        "my_buys": my_buy,
        "histogram": histogram,
        "timestamp": int(time.time()),
    }
    if season_key:
        resp["season"] = season_key
        resp["season_name"] = _season_display_name(season_key)
    return resp

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
    season_key = _normalize_season(inp.season)
    if qty <= 0:
        raise HTTPException(400, "数量必须大于 0")
    if target_price < 40:
        raise HTTPException(400, "价格必须大于等于 40")
    if not season_key:
        raise HTTPException(400, "请选择赛季")
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
        season=season_key,
    )
    db.add(order)
    db.commit()
    cfg = db.query(PoolConfig).first()
    fills = process_brick_buy_orders(db, cfg)
    db.commit()
    db.refresh(order)
    resp = {
        "ok": True,
        "order_id": order.id,
        "locked": total_cost,
        "season": order.season,
        "season_label": _season_display_name(order.season or BRICK_SEASON_FALLBACK),
    }
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
            "template_label": vis.get("template_label", ""),
            "hidden_template": vis["hidden_template"],
            "effects": vis["effects"],
            "effect_labels": vis.get("effect_labels", []),
            "affinity": vis.get("affinity", {}),
            "affinity_label": vis.get("affinity_label", ""),
            "affinity_tag": vis.get("affinity_tag", ""),
            "model": vis.get("model", ""),
        }

        items.append({
            "market_id": mi.id, "price": mi.price, "created_at": mi.created_at,
            "name": inv.name, "rarity": inv.rarity, "exquisite": bool(inv.exquisite),
            "grade": inv.grade, "wear": round(inv.wear_bp/100, 2), "serial": inv.serial, "inv_id": inv.id,
            "template": vis["template"],
            "template_label": vis.get("template_label", ""),
            "hidden_template": vis["hidden_template"],
            "effects": vis["effects"],
            "effect_labels": vis.get("effect_labels", []),
            "affinity": vis.get("affinity", {}),
            "affinity_label": vis.get("affinity_label", ""),
            "affinity_tag": vis.get("affinity_tag", ""),
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
            "template_label": vis.get("template_label", ""),
            "hidden_template": vis["hidden_template"],
            "effects": vis["effects"],
            "effect_labels": vis.get("effect_labels", []),
            "affinity": vis.get("affinity", {}),
            "affinity_label": vis.get("affinity_label", ""),
            "affinity_tag": vis.get("affinity_tag", ""),
            "model": vis.get("model", ""),
        }

        out.append(MarketBrowseOut(
            id=mi.id, inv_id=inv.id, seller=seller.username, price=mi.price,
            name=inv.name, skin_id=inv.skin_id, rarity=inv.rarity,
            exquisite=bool(inv.exquisite), grade=inv.grade,
            wear=round(inv.wear_bp/100, 2), serial=inv.serial, created_at=mi.created_at,
            template=vis["template"], template_label=vis.get("template_label", ""),
            hidden_template=vis["hidden_template"],
            effects=vis["effects"], effect_labels=vis.get("effect_labels", []),
            affinity=vis.get("affinity", {}), affinity_label=vis.get("affinity_label", ""),
            affinity_tag=vis.get("affinity_tag", ""), visual=visual_payload,
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
                "template_label": vis.get("template_label", ""),
                "hidden_template": vis["hidden_template"],
                "effects": vis["effects"],
                "effect_labels": vis.get("effect_labels", []),
                "affinity": vis.get("affinity", {}),
                "affinity_label": vis.get("affinity_label", ""),
                "affinity_tag": vis.get("affinity_tag", ""),
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
                "affinity": vis.get("affinity", {}),
                "affinity_label": vis.get("affinity_label", ""),
                "affinity_tag": vis.get("affinity_tag", ""),
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
