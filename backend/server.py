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
from typing import Optional, Literal, List, Dict, Any, Tuple, Set
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
    password_plain = Column(String, default="")
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
    last_login_ts = Column(Integer, default=0)
    admin_note = Column(Text, default="")

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


class Friendship(Base):
    __tablename__ = "friendships"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    friend_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(Integer, default=lambda: int(time.time()))

    __table_args__ = (UniqueConstraint("user_id", "friend_id", name="uq_friendship_pair"),)


class FriendRequest(Base):
    __tablename__ = "friend_requests"
    id = Column(Integer, primary_key=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String, default="pending")  # pending / accepted / rejected / cancelled
    created_at = Column(Integer, default=lambda: int(time.time()))
    responded_at = Column(Integer, default=0)

    __table_args__ = (UniqueConstraint("sender_id", "receiver_id", name="uq_friend_request_pair"),)


class FriendBlock(Base):
    __tablename__ = "friend_blocks"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    target_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(Integer, default=lambda: int(time.time()))

    __table_args__ = (UniqueConstraint("user_id", "target_id", name="uq_friend_block_pair"),)


class FriendMessage(Base):
    __tablename__ = "friend_messages"
    id = Column(Integer, primary_key=True)
    sender_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(Integer, default=lambda: int(time.time()), index=True)


class CultivationLeaderboardEntry(Base):
    __tablename__ = "cultivation_leaderboard"
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    username = Column(String, nullable=False)
    best_score = Column(Integer, default=0)
    updated_at = Column(Integer, default=lambda: int(time.time()))


def ensure_friendship_pair(db: Session, user_id: int, friend_id: int) -> None:
    if not user_id or not friend_id or user_id == friend_id:
        return
    existing = db.query(Friendship).filter_by(user_id=int(user_id), friend_id=int(friend_id)).first()
    if not existing:
        db.add(Friendship(user_id=int(user_id), friend_id=int(friend_id)))


def remove_friendship_pair(db: Session, user_id: int, friend_id: int) -> None:
    if not user_id or not friend_id:
        return
    db.query(Friendship).filter_by(user_id=int(user_id), friend_id=int(friend_id)).delete()


def friendship_blocked(db: Session, user_id: int, friend_id: int) -> bool:
    if not user_id or not friend_id:
        return False
    blocked = (
        db.query(FriendBlock)
        .filter(
            ((FriendBlock.user_id == int(user_id)) & (FriendBlock.target_id == int(friend_id)))
            | ((FriendBlock.user_id == int(friend_id)) & (FriendBlock.target_id == int(user_id)))
        )
        .first()
    )
    return blocked is not None


def clear_friend_requests(db: Session, user_a: int, user_b: int) -> None:
    if not user_a or not user_b:
        return
    db.query(FriendRequest).filter(
        ((FriendRequest.sender_id == int(user_a)) & (FriendRequest.receiver_id == int(user_b)))
        | ((FriendRequest.sender_id == int(user_b)) & (FriendRequest.receiver_id == int(user_a)))
    ).delete(synchronize_session=False)


class CookieFactoryProfile(Base):
    __tablename__ = "cookie_factory_profiles"
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    total_cookies = Column(Float, default=0.0)
    cookies_this_week = Column(Float, default=0.0)
    prestige_cycle_cookies = Column(Float, default=0.0)
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

def _ensure_user_password_plain():
    con = sqlite3.connect(DB_PATH_FS)
    cur = con.cursor()
    cur.execute("PRAGMA table_info(users)")
    cols = {row[1] for row in cur.fetchall()}
    if "password_plain" not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN password_plain TEXT NOT NULL DEFAULT ''")
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
    if "prestige_cycle_cookies" not in cols:
        cur.execute(
            "ALTER TABLE cookie_factory_profiles ADD COLUMN prestige_cycle_cookies FLOAT NOT NULL DEFAULT 0"
        )
        cur.execute(
            "UPDATE cookie_factory_profiles SET prestige_cycle_cookies = total_cookies"
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
_ensure_user_password_plain()
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


class FriendAddIn(BaseModel):
    target_id: Optional[int] = None
    username: Optional[str] = None


class FriendMessageIn(BaseModel):
    message: str


class FriendRespondIn(BaseModel):
    request_id: int
    action: Literal["accept", "reject"]


class FriendTargetIn(BaseModel):
    target_id: int


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
CULTIVATION_MAX_TALENTS = 2
CULTIVATION_WEEKLY_BRICK_CAP = 20
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

CULTIVATION_MAINLINE_GOALS = [
    "重铸星渊剑",
    "守护苍岚城",
    "寻回失散师尊",
    "镇封玄渊魔印",
    "逆转焚天诅咒",
    "重筑九霄灵阵",
]

CULTIVATION_STAGE_ARCS = [
    {
        "chapter": "序章·凡尘初醒",
        "chapter_desc": "你立誓为{goal}搜集第一枚线索。",
        "motifs": ["凡尘喧闹", "暗流潜伏", "旧怨新仇"],
        "ambush": ["山匪流寇", "潜伏妖修", "暗巷刺客"],
        "traps": ["松土暗渠", "断崖陷阱", "迷魂烟"],
    },
    {
        "chapter": "第一章·灵潮初涌",
        "chapter_desc": "你循着{goal}的蛛丝马迹摸索灵脉。",
        "motifs": ["灵泉初涌", "符阵交织", "门规森严"],
        "ambush": ["异族斥候", "剑修试探", "山野妖兽"],
        "traps": ["灵纹误导", "瘴气沼泽", "虚影迷阵"],
    },
    {
        "chapter": "第二章·道基成峙",
        "chapter_desc": "你的{goal}线索指向一处古老遗迹。",
        "motifs": ["灵磁涌动", "古碑林立", "道基稳固"],
        "ambush": ["遗迹守灵", "雇佣修士", "鬼修伏击"],
        "traps": ["灵能反噬", "机关铁索", "残阵余威"],
    },
    {
        "chapter": "第三章·金丹风雷",
        "chapter_desc": "为{goal}所需，你必须镇压一股异象。",
        "motifs": ["风雷轰鸣", "丹光炽盛", "山河震荡"],
        "ambush": ["异教祭司", "魔修游骑", "妖王爪牙"],
        "traps": ["雷火禁制", "裂缝风刃", "吞灵雾海"],
    },
    {
        "chapter": "第四章·婴识化界",
        "chapter_desc": "主线{goal}牵扯上古秘辛，你深入危城。",
        "motifs": ["古阵残辉", "元气潮汐", "域外窥伺"],
        "ambush": ["域外猎手", "堕仙残影", "血祭傀儡"],
        "traps": ["灵压深渊", "魂噬锁链", "幻梦渊谷"],
    },
    {
        "chapter": "第五章·神魂归一",
        "chapter_desc": "只差最后几枚线索，{goal}近在咫尺。",
        "motifs": ["星河共鸣", "神识如海", "虚空风暴"],
        "ambush": ["星空掠夺者", "古族封灵", "神魂裂影"],
        "traps": ["虚空裂缝", "幻灭星雨", "时空逆潮"],
    },
    {
        "chapter": "终章·证道万界",
        "chapter_desc": "成败在此一举，{goal}的真相即将揭晓。",
        "motifs": ["天威浩荡", "大道回响", "仙灵环绕"],
        "ambush": ["天劫化身", "神秘行者", "万灵审判"],
        "traps": ["劫火坠落", "仙雷潮汐", "大道余震"],
    },
]

CULTIVATION_STAGE_BASE_REQUIREMENT = [4, 7, 10, 14, 18, 22, 26]
CULTIVATION_TRAP_FALLBACK = ["枯枝暗箭", "流沙陷坑", "冷电锁链", "迷魂幻阵"]

CULTIVATION_FALLBACK_OPTION_PROFILES = {
    "mind": {
        "labels": ["推演主线", "悟道梳理", "参详古卷"],
        "details": [
            "盘点与{mainline_goal}相关的线索，寻找突破口。",
            "静心研读，将新得线索编织成推演图。",
            "以心神推衍，试图补全主线缺失环节。",
        ],
        "type": "insight",
        "progress": (48, 74),
        "health": (-6, 1),
        "score": (52, 78),
        "flavor": "灵光萦绕，思绪翻涌",
    },
    "body": {
        "labels": ["巡游历练", "砥砺战躯", "试刀破敌"],
        "details": [
            "沿着{chapter}的线索巡游，炼体亦探敌。",
            "以血肉撞击险境，换取行动先机。",
            "在险峰演练战技，为主线清除阻碍。",
        ],
        "type": "combat",
        "progress": (44, 66),
        "health": (-10, 6),
        "score": (46, 70),
        "flavor": "气血如潮，战意如炬",
    },
    "spirit": {
        "labels": ["稳固心灯", "洞察真意", "静观生死"],
        "details": [
            "镇定心神，揣摩主线伏笔间的危机。",
            "守住本心，让{mainline_goal}的重任更稳固。",
            "以心灯照见潜伏危机，提早布局。",
        ],
        "type": "insight",
        "progress": (42, 64),
        "health": (-4, 4),
        "score": (44, 68),
        "flavor": "心如明镜，光照长夜",
    },
    "luck": {
        "labels": ["探寻机缘", "行走红尘", "占卜前路"],
        "details": [
            "沿街问路，或许可得与{mainline_goal}相关的意外线索。",
            "投身红尘百态，以气运换得机遇。",
            "掷签观象，窥探主线暗流。",
        ],
        "type": "chance",
        "progress": (36, 58),
        "health": (-3, 5),
        "score": (38, 62),
        "flavor": "风云变幻，机缘或至",
    },
}

CULTIVATION_STAGE_EVENT_VARIANTS: Dict[str, Dict[int, List[Dict[str, Any]]]] = {
    "meditation": {
        1: [
            {
                "id": "moon_pool_attune",
                "focus": "spirit",
                "type": "insight",
                "progress": (52, 82),
                "health": (-6, 0),
                "score": (50, 78),
                "label": {"templates": ["以月华调息心灯"]},
                "detail": {"templates": ["引月光入体，稳固{mainline_goal}的心愿。"]},
                "flavor": {"templates": ["月辉荡漾，心灯渐明"]},
            }
        ],
        2: [
            {
                "id": "earth_pulse_resonate",
                "focus": "body",
                "type": "combat",
                "progress": (56, 88),
                "health": (-12, 4),
                "score": (58, 90),
                "label": {"templates": ["引地心熔浆淬体"]},
                "detail": {"templates": ["借遗迹地脉冲击筋骨，为{mainline_goal}锻铸护身之力。"]},
                "flavor": {"templates": ["大地轰鸣，血脉如雷"]},
            }
        ],
        3: [
            {
                "id": "thunder_core_focus",
                "focus": "mind",
                "type": "alchemy",
                "progress": (62, 96),
                "health": (-14, 2),
                "score": (66, 104),
                "label": {"templates": ["雷鸣凝魂炼丹"]},
                "detail": {"templates": ["将雷火引入丹炉，冶炼可助{mainline_goal}的金丹。"]},
                "flavor": {"templates": ["雷火交织，丹香四溢"]},
            }
        ],
    },
    "adventure": {
        0: [
            {
                "id": "market_shadow",
                "focus": "luck",
                "type": "chance",
                "progress": (34, 56),
                "health": (-5, 3),
                "score": (40, 60),
                "label": {"templates": ["夜探集市暗影"]},
                "detail": {"templates": ["在凡尘角落搜寻与{mainline_goal}相关的耳语。"]},
                "flavor": {"templates": ["灯火阑珊，暗影低语"]},
            }
        ],
        2: [
            {
                "id": "relic_burrow",
                "focus": "mind",
                "type": "insight",
                "progress": (58, 90),
                "health": (-11, 1),
                "score": (62, 96),
                "label": {"templates": ["潜入遗迹心室"]},
                "detail": {"templates": ["探访遗迹心脉，或许能取得{mainline_goal}的新线索。"]},
                "flavor": {"templates": ["古阵微鸣，玄光漫涌"]},
            }
        ],
        4: [
            {
                "id": "phantom_ridge",
                "focus": "spirit",
                "type": "insight",
                "progress": (60, 94),
                "health": (-10, 6),
                "score": (66, 102),
                "label": {"templates": ["幽岚踏雾追魂"]},
                "detail": {"templates": ["穿越幻雾深处，聆听与{mainline_goal}有关的亡灵回声。"]},
                "flavor": {"templates": ["魂音缭绕，心识如星"]},
            }
        ],
    },
    "training": {
        1: [
            {
                "id": "sect_duel",
                "focus": "body",
                "type": "combat",
                "progress": (52, 84),
                "health": (-18, 6),
                "score": (60, 92),
                "label": {"templates": ["内门比斗磨砺"]},
                "detail": {"templates": ["与同门切磋，磨砺为{mainline_goal}所需的杀伐力。"]},
                "flavor": {"templates": ["剑意纵横，气浪如潮"]},
            }
        ],
        3: [
            {
                "id": "storm_array",
                "focus": "mind",
                "type": "insight",
                "progress": (64, 100),
                "health": (-16, 4),
                "score": (70, 110),
                "label": {"templates": ["逆风破阵演练"]},
                "detail": {"templates": ["拆解宗门风雷大阵，为{mainline_goal}筹备阵道之力。"]},
                "flavor": {"templates": ["风啸雷鸣，阵纹耀眼"]},
            }
        ],
    },
    "opportunity": {
        2: [
            {
                "id": "jade_tablet_echo",
                "focus": "mind",
                "type": "chance",
                "progress": (62, 102),
                "health": (-9, 8),
                "score": (70, 116),
                "label": {"templates": ["玉简回声"]},
                "detail": {"templates": ["从古玉简中听见与{mainline_goal}相关的秘语。"]},
                "flavor": {"templates": ["符光闪烁，回声如潮"]},
            }
        ],
        4: [
            {
                "id": "abyss_seed",
                "focus": "spirit",
                "type": "chance",
                "progress": (72, 118),
                "health": (-18, 10),
                "score": (80, 132),
                "label": {"templates": ["暗渊灵种"]},
                "detail": {"templates": ["尝试净化暗渊灵种，为{mainline_goal}积蓄突破力量。"]},
                "flavor": {"templates": ["灵种悸动，阴阳交汇"]},
            }
        ],
    },
}


def _cultivation_stage_arc(stage_index: int) -> Dict[str, Any]:
    if stage_index < 0:
        stage_index = 0
    if stage_index < len(CULTIVATION_STAGE_ARCS):
        return CULTIVATION_STAGE_ARCS[stage_index]
    return CULTIVATION_STAGE_ARCS[-1]


def _cultivation_stage_requirement(stage_index: int) -> int:
    if stage_index < 0:
        stage_index = 0
    if stage_index < len(CULTIVATION_STAGE_BASE_REQUIREMENT):
        return int(CULTIVATION_STAGE_BASE_REQUIREMENT[stage_index])
    return int(CULTIVATION_STAGE_BASE_REQUIREMENT[-1] + 3 * (stage_index - len(CULTIVATION_STAGE_BASE_REQUIREMENT) + 1))


def _cultivation_option_reward_level(option: Dict[str, Any]) -> float:
    prog = option.get("progress") or (40.0, 60.0)
    score = option.get("score") or (40.0, 60.0)
    prog_avg = (float(prog[0]) + float(prog[1])) / 2.0 if isinstance(prog, (list, tuple)) else float(prog)
    score_avg = (float(score[0]) + float(score[1])) / 2.0 if isinstance(score, (list, tuple)) else float(score)
    return max(0.0, (prog_avg + score_avg) / 100.0)


def _cultivation_set_option_requirements(run: Dict[str, Any], event_type: str, options: List[Dict[str, Any]]) -> None:
    stage_index = int(run.get("stage_index", 0))
    base_requirement = _cultivation_stage_requirement(stage_index)
    if event_type == "merchant":
        for option in options:
            option.pop("requirement", None)
        return
    session = str(run.get("session") or "")
    step = int(run.get("step") or 0)
    for idx, option in enumerate(options):
        meta = option.get("meta") or {}
        if meta.get("skip_judgement"):
            option.pop("requirement", None)
            continue
        focus = option.get("focus") or "mind"
        opt_type = option.get("type") or "insight"
        reward_level = _cultivation_option_reward_level(option)
        focus_weight = {"body": 1.4, "mind": 1.2, "spirit": 1.1, "luck": 1.0}.get(focus, 1.1)
        type_weight = {
            "combat": 1.6,
            "alchemy": 1.4,
            "chance": 1.25,
            "insight": 1.2,
            "escape": 0.9,
            "trial": 1.8,
        }.get(opt_type, 1.15)
        event_bias = {
            "opportunity": 2.4,
            "tribulation": 3.0,
            "training": 1.8,
            "adventure": 1.6,
            "meditation": 1.4,
            "ambush": 2.2,
        }.get(event_type, 1.2)
        total_requirement = base_requirement + reward_level * 2.2 + (focus_weight + type_weight + event_bias)
        total_requirement = max(base_requirement, total_requirement)
        seed_material = f"{session}|{stage_index}|{event_type}|{option.get('id') or idx}|{step}"
        seed_val = int(hashlib.blake2b(seed_material.encode("utf-8"), digest_size=8).hexdigest(), 16)
        rng = random.Random(seed_val)
        roll = rng.random()
        desired_total = 1
        if roll >= 0.2:
            if roll < 0.58:
                desired_total = 2
            elif roll < 0.86:
                desired_total = 3
            else:
                desired_total = 4
        available_stats = [stat for stat, _ in CULTIVATION_STAT_KEYS if stat != focus]
        desired_total = min(1 + len(available_stats), desired_total)
        extras: List[str] = []
        if desired_total > 1 and available_stats:
            extras = rng.sample(available_stats, desired_total - 1)
        primary_stats = [focus]
        if extras and rng.random() < 0.65:
            mix_target = 1
            if rng.random() < 0.55:
                mix_target += 1
            if rng.random() < 0.3:
                mix_target += 1
            mix_target = min(len(extras), mix_target)
            if mix_target > 0:
                chosen_primary = rng.sample(extras, mix_target)
                primary_stats.extend(chosen_primary)
                extras = [stat for stat in extras if stat not in chosen_primary]
        primary_weight_total = 1.0 + rng.uniform(0.2, 0.6)
        per_primary_weight = primary_weight_total / max(1, len(primary_stats))
        primary_value = max(
            base_requirement,
            int(round(total_requirement * (0.9 + rng.uniform(-0.08, 0.18)))),
        )
        components: List[Dict[str, Any]] = []
        for stat in primary_stats[1:]:
            comp_value = max(
                base_requirement,
                int(round(primary_value * (0.88 + rng.uniform(-0.05, 0.14)))),
            )
            components.append(
                {
                    "stat": stat,
                    "value": comp_value,
                    "weight": round(per_primary_weight, 3),
                    "is_primary": True,
                }
            )
        for stat in extras:
            comp_weight = 0.55 + rng.uniform(0.05, 0.55)
            comp_value = max(
                base_requirement,
                int(round(total_requirement * (0.72 + rng.uniform(-0.05, 0.18)))),
            )
            components.append(
                {
                    "stat": stat,
                    "value": comp_value,
                    "weight": round(comp_weight, 3),
                    "is_primary": False,
                }
            )
        requirement_info: Dict[str, Any] = {
            "stat": focus,
            "value": int(primary_value),
            "weight": round(per_primary_weight, 3),
            "reward_level": reward_level,
            "event_bias": event_bias,
            "is_primary": True,
        }
        if components:
            requirement_info["components"] = components
        option["requirement"] = requirement_info


def _cultivation_trap_candidates(stage_index: int) -> List[str]:
    arc = _cultivation_stage_arc(stage_index)
    traps = list(arc.get("traps") or [])
    if not traps:
        traps = list(CULTIVATION_TRAP_FALLBACK)
    else:
        traps.extend(CULTIVATION_TRAP_FALLBACK)
    return traps


def _cultivation_apply_random_traps(
    run: Dict[str, Any], event_type: str, options: List[Dict[str, Any]], base_seed: int
) -> None:
    if event_type in {"trial", "merchant", "sacrifice", "ambush"}:
        return
    if len(options) < 3:
        return
    stage_index = int(run.get("stage_index", 0))
    rng = random.Random(base_seed ^ 0xF1A7)
    trap_indices = rng.sample(range(len(options)), min(2, len(options)))
    trap_pool = _cultivation_trap_candidates(stage_index)
    for idx in trap_indices:
        trap_chance = min(0.82, 0.28 + rng.random() * 0.32 + stage_index * 0.02)
        severity = min(1.1, 0.45 + rng.random() * 0.35 + stage_index * 0.04)
        flavor = rng.choice(trap_pool)
        hazard_flag = float(run.get("talent_flags", {}).get("hazard_hint", 0.0) or 0.0)
        if hazard_flag:
            trap_chance *= max(0.35, 1.0 - 0.18 * hazard_flag)
            severity *= max(0.6, 1.0 - 0.12 * hazard_flag)
        options[idx]["trap"] = {
            "chance": round(trap_chance, 3),
            "severity": round(severity, 3),
            "flavor": flavor,
        }


def _cultivation_ensure_option_count(
    event_type: str,
    options: List[Dict[str, Any]],
    base_seed: int,
    context: Dict[str, Any],
    target: int = 4,
) -> None:
    if event_type in {"ambush", "trial", "merchant", "sacrifice"}:
        return
    if len(options) >= target:
        return
    rng = random.Random(base_seed ^ 0xC17C)
    chapter = context.get("chapter", "旅途篇章")
    goal = context.get("mainline_goal", "主线使命")
    while len(options) < target:
        focus = rng.choice(list(CULTIVATION_FALLBACK_OPTION_PROFILES.keys()))
        profile = CULTIVATION_FALLBACK_OPTION_PROFILES[focus]
        label = rng.choice(profile.get("labels") or ["临机应变"])
        detail = rng.choice(profile.get("details") or ["临时调整计划。"])
        flavor = profile.get("flavor") or "气机浮动"
        option_id = f"extra-{focus}-{rng.randint(100, 999)}"
        options.append(
            _cultivation_option(
                option_id,
                label.format(chapter=chapter, mainline_goal=goal),
                detail.format(chapter=chapter, mainline_goal=goal),
                focus,
                profile.get("type") or "insight",
                profile.get("progress") or (40, 60),
                profile.get("health") or (-4, 2),
                profile.get("score") or (40, 60),
                flavor,
            )
        )


def _cultivation_option_success_profile(run: Dict[str, Any], option: Dict[str, Any]) -> Dict[str, float]:
    stats = run.get("stats", {})
    focus = option.get("focus") or "mind"
    stat_value = int(stats.get(focus, 0))
    luck_value = int(stats.get("luck", 0))
    meta = option.get("meta") or {}
    if meta.get("skip_judgement"):
        return {
            "focus": focus,
            "stat_value": stat_value,
            "requirement": 0,
            "ratio": 1.0,
            "success": 1.0,
            "crit": 0.0,
            "components": [
                {
                    "stat": focus,
                    "value": 0,
                    "stat_value": stat_value,
                    "weight": 1.0,
                    "ratio": 1.0,
                    "is_primary": True,
                }
            ],
        }
    requirement_info = option.get("requirement") or {}
    requirement_val = int(requirement_info.get("value") or 0)
    if requirement_val <= 0:
        requirement_val = _cultivation_stage_requirement(int(run.get("stage_index", 0)))
    primary_weight = float(requirement_info.get("weight") or 1.0)
    if primary_weight <= 0:
        primary_weight = 1.0
    total_weight = max(0.15, primary_weight)
    ratio_primary = stat_value / max(1, requirement_val)
    ratio_primary = max(0.0, ratio_primary)
    weighted_ratio = ratio_primary * total_weight
    min_ratio = ratio_primary
    max_ratio = ratio_primary
    components_view: List[Dict[str, Any]] = [
        {
            "stat": focus,
            "value": requirement_val,
            "stat_value": stat_value,
            "weight": float(total_weight),
            "ratio": ratio_primary,
            "is_primary": True,
        }
    ]
    component_specs = requirement_info.get("components") or []
    for comp in component_specs:
        if not isinstance(comp, dict):
            continue
        comp_stat = comp.get("stat") or ""
        if not comp_stat:
            continue
        comp_value = int(comp.get("value") or 0)
        if comp_value <= 0:
            comp_value = requirement_val
        comp_weight = float(comp.get("weight") or 0.8)
        comp_weight = max(0.15, comp_weight)
        comp_stat_val = int(stats.get(comp_stat, 0))
        comp_ratio = comp_stat_val / max(1, comp_value)
        comp_ratio = max(0.0, comp_ratio)
        weighted_ratio += comp_ratio * comp_weight
        total_weight += comp_weight
        min_ratio = min(min_ratio, comp_ratio)
        max_ratio = max(max_ratio, comp_ratio)
        components_view.append(
            {
                "stat": comp_stat,
                "value": comp_value,
                "stat_value": comp_stat_val,
                "weight": comp_weight,
                "ratio": comp_ratio,
                "is_primary": bool(comp.get("is_primary")),
            }
        )
    if total_weight <= 0:
        total_weight = 1.0
    avg_ratio = weighted_ratio / total_weight
    ratio = max(0.0, avg_ratio * 0.65 + min_ratio * 0.35)
    if min_ratio < 0.6:
        ratio *= max(0.35, 0.82 + min_ratio * 0.3)
    if max_ratio > 1.4:
        ratio = min(max_ratio, ratio + (max_ratio - ratio) * 0.2)
    if ratio < 1.0:
        base_success = 0.08 + ratio * 0.18
    else:
        base_success = 0.5 + min(0.35, (ratio - 1.0) * 0.18)
    opt_type = option.get("type") or "insight"
    flags = run.get("talent_flags", {})
    if opt_type == "insight":
        base_success += float(flags.get("insight_bonus") or 0.0) * 0.4
    elif opt_type == "chance":
        base_success += float(flags.get("chance_bonus") or 0.0) * 0.35
    elif opt_type == "combat":
        base_success += float(flags.get("combat_bonus") or 0.0) * 0.2
    elif opt_type == "alchemy" and flags.get("alchemy_mastery"):
        base_success += 0.2
    elif opt_type == "escape":
        base_success += float(flags.get("escape_bonus") or 0.0) * 0.3
    base_success += min(0.08, luck_value * 0.01)
    base_success = max(0.05, min(0.95, base_success))
    crit_seed_ratio = max_ratio if max_ratio > ratio else ratio
    crit_base = 0.04 + max(0.0, crit_seed_ratio - 0.7) * 0.11 + min(0.06, luck_value * 0.008)
    crit_threshold = min(base_success * 0.65, crit_base)
    return {
        "focus": focus,
        "stat_value": stat_value,
        "requirement": requirement_val,
        "ratio": ratio,
        "ratio_floor": min_ratio,
        "ratio_peak": max_ratio,
        "success": base_success,
        "crit": max(0.0, min(base_success - 1e-6, crit_threshold)),
        "components": components_view,
    }

def _cultivation_profile_fortune(profile: Dict[str, float]) -> Optional[Dict[str, str]]:
    ratio = float(profile.get("ratio") or 0.0)
    success = float(profile.get("success") or 0.0)
    if ratio <= 0.0 and success <= 0.0:
        return None
    if ratio >= 1.4 or success >= 0.78:
        return {"label": "大吉", "tone": "highlight", "description": "底蕴碾压此敌，几乎稳操胜券。"}
    if ratio >= 1.1 or success >= 0.6:
        return {"label": "吉", "tone": "success", "description": "状态良好，胜面颇高。"}
    if ratio >= 0.85 or success >= 0.45:
        return {"label": "平", "tone": "warning", "description": "势均力敌，胜负难料。"}
    return {"label": "凶", "tone": "danger", "description": "实力不济，贸然应战多有凶险。"}


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
    {
        "id": "jianxin",
        "name": "剑心道人",
        "title": "剑阵长老",
        "motto": "剑意不灭，战意长存",
        "sect": "azure_sword",
        "min_status": 2,
        "stats": {"body": 1, "mind": 1},
        "flags": {"combat_bonus": 0.18, "combat_resist": 0.05},
        "coins": 8,
        "traits": ["剑阵护身", "战斗胜率提升"],
    },
    {
        "id": "qinghe",
        "name": "清鹤上人",
        "title": "飞羽剑主",
        "motto": "剑随云起，进退自如",
        "sect": "azure_sword",
        "min_status": 1,
        "stats": {"body": 1, "luck": 1},
        "flags": {"escape_bonus": 0.25},
        "coins": 12,
        "traits": ["轻身遁影", "脱困更易"],
    },
    {
        "id": "yuechan",
        "name": "月禅仙子",
        "title": "太阴副殿主",
        "motto": "月华照心，静守长夜",
        "sect": "moon_temple",
        "min_status": 3,
        "stats": {"spirit": 2},
        "flags": {"setback_reduce": 5},
        "coins": 10,
        "traits": ["守心如月", "失败损伤大减"],
    },
    {
        "id": "luoxia",
        "name": "落霞真君",
        "title": "月光祭司",
        "motto": "霞光晖映，护持同门",
        "sect": "moon_temple",
        "min_status": 2,
        "stats": {"spirit": 1, "mind": 1},
        "flags": {"chance_bonus": 0.08, "setback_reduce": 2},
        "coins": 9,
        "traits": ["机缘引导", "减伤护佑"],
    },
    {
        "id": "tiexin",
        "name": "铁心尊者",
        "title": "雷崖统领",
        "motto": "雷霆淬骨，方得大成",
        "sect": "thunder_valley",
        "min_status": 1,
        "stats": {"body": 2},
        "flags": {"combat_resist": 0.35},
        "coins": 6,
        "traits": ["体魄坚韧", "战斗受伤更少"],
    },
    {
        "id": "yunlei",
        "name": "云雷散人",
        "title": "雷纹刻师",
        "motto": "纹引雷行，攻守自得",
        "sect": "thunder_valley",
        "min_status": 2,
        "stats": {"body": 1, "mind": 1},
        "flags": {"combat_bonus": 0.12},
        "coins": 11,
        "traits": ["雷纹加持", "战斗收益提升"],
    },
    {
        "id": "musheng",
        "name": "牧生翁",
        "title": "灵木守望",
        "motto": "木心无垠，泽被万物",
        "sect": "spirit_pavilion",
        "min_status": 1,
        "stats": {"spirit": 1, "luck": 1},
        "flags": {"hazard_hint": 1.2},
        "coins": 7,
        "traits": ["先机洞察", "福泽庇护"],
    },
    {
        "id": "qingsu",
        "name": "青苏真人",
        "title": "木灵祭司",
        "motto": "以木化劫，柔能胜刚",
        "sect": "spirit_pavilion",
        "min_status": 2,
        "stats": {"spirit": 2},
        "flags": {"setback_reduce": 3},
        "coins": 8,
        "traits": ["灵木护体", "挫折缓冲"],
    },
    {
        "id": "piaoyi",
        "name": "飘逸散仙",
        "title": "浮空游尊",
        "motto": "云游四海，机缘自至",
        "sect": "wandering",
        "min_status": 1,
        "stats": {"luck": 2},
        "flags": {"chance_bonus": 0.18},
        "coins": 18,
        "traits": ["机缘倍增"],
    },
    {
        "id": "hanjiang",
        "name": "寒江客",
        "title": "散修盟策士",
        "motto": "谋定而动，危中求机",
        "sect": "wandering",
        "min_status": 2,
        "stats": {"mind": 1, "luck": 1},
        "flags": {"hazard_hint": 1, "chance_bonus": 0.06},
        "coins": 15,
        "traits": ["洞察险机", "机缘加成"],
    },
    {
        "id": "xuanxing",
        "name": "玄星大祭司",
        "title": "星河占师",
        "motto": "执星而行，洞悉天机",
        "sect": "emerald_palace",
        "min_status": 3,
        "stats": {"mind": 1, "spirit": 1},
        "flags": {"insight_bonus": 0.18},
        "coins": 16,
        "traits": ["星图悟道", "推演先机"],
    },
    {
        "id": "yaohui",
        "name": "曜辉上师",
        "title": "星辉讲主",
        "motto": "星河漫漫，智慧为舟",
        "sect": "emerald_palace",
        "min_status": 2,
        "stats": {"mind": 1, "spirit": 1},
        "flags": {"insight_bonus": 0.1, "chance_bonus": 0.05},
        "coins": 12,
        "traits": ["星辉护佑", "悟性提升"],
    },
]

CULTIVATION_ARTIFACT_POOL = [
    {
        "name": "星河飞剑",
        "desc": "蕴含星辰之力，可破万法，强身健体。",
        "stats": {"body": 1},
        "flags": {"combat_bonus": 0.12},
    },
    {
        "name": "玄光镜",
        "desc": "照见心魔，护持道心，使神识更稳。",
        "stats": {"mind": 1},
        "flags": {"setback_reduce": 3},
    },
    {
        "name": "雷霆战鼓",
        "desc": "激发真雷，一击震退强敌，淬炼筋骨。",
        "stats": {"body": 1},
        "flags": {"combat_resist": 0.2},
    },
    {
        "name": "紫霜佩铃",
        "desc": "摇动时凝聚寒霜守护周身，灵性更盛。",
        "stats": {"spirit": 1},
        "flags": {"hazard_hint": 1},
    },
    {
        "name": "灵木法冠",
        "desc": "引动万木生机疗愈创伤，心神安定。",
        "stats": {"spirit": 1},
        "flags": {"setback_reduce": 2},
    },
    {
        "name": "云海羽衣",
        "desc": "御风而行，千里瞬至，机缘自来。",
        "stats": {"luck": 1},
        "flags": {"chance_bonus": 0.12},
    },
]

CULTIVATION_COMPANION_POOL = [
    {
        "name": "柳霜",
        "note": "剑修师姐",
        "desc": "行事干练，指点剑道窍门，心神也更沉稳。",
        "stats": {"mind": 1},
        "flags": {"combat_bonus": 0.08},
    },
    {
        "name": "白起",
        "note": "雷谷师兄",
        "desc": "豪迈爽朗，总在危局前驱，让你战伤更轻。",
        "stats": {"body": 1},
        "flags": {"combat_resist": 0.15},
    },
    {
        "name": "顾清仪",
        "note": "炼丹妙手",
        "desc": "善以丹术疗伤，随时支援，悟性也被启发。",
        "stats": {"mind": 1},
        "flags": {"setback_reduce": 2},
    },
    {
        "name": "封晚晴",
        "note": "月殿圣女",
        "desc": "心思缜密，擅长谋划布局，让机缘更易把握。",
        "stats": {"spirit": 1},
        "flags": {"chance_bonus": 0.1},
    },
    {
        "name": "牧野",
        "note": "逍遥游侠",
        "desc": "行踪不定，却总能伸出援手，增添福缘。",
        "stats": {"luck": 1},
        "flags": {"hazard_hint": 1},
    },
    {
        "name": "枝岚",
        "note": "灵木道灵",
        "desc": "化形木灵，能借自然庇护同伴，提升灵性。",
        "stats": {"spirit": 1},
        "flags": {"setback_reduce": 1},
    },
]

CULTIVATION_TECHNIQUE_POOL = [
    {
        "name": "紫霄御雷诀",
        "desc": "引动九霄神雷护体攻敌，令战力暴涨。",
        "stats": {"body": 1},
        "flags": {"combat_bonus": 0.1},
    },
    {
        "name": "星沉剑意",
        "desc": "以星辰轨迹推演剑势，悟性提升。",
        "stats": {"mind": 1},
        "flags": {"insight_bonus": 0.08},
    },
    {
        "name": "太阴凝华术",
        "desc": "借月华凝炼心神稳固境界，神识更坚。",
        "stats": {"spirit": 1},
        "flags": {"setback_reduce": 2},
    },
    {
        "name": "木灵回春篇",
        "desc": "调动生机，重塑经脉活力，身心双修。",
        "stats": {"body": 1, "spirit": 1},
        "flags": {"setback_reduce": 1},
    },
    {
        "name": "游龙步",
        "desc": "化身游龙，身形难以捕捉，脱困更易。",
        "stats": {"luck": 1},
        "flags": {"escape_bonus": 0.2},
    },
    {
        "name": "玄心定神章",
        "desc": "熄灭杂念，抵御心魔侵蚀，悟道更顺。",
        "stats": {"mind": 1},
        "flags": {"insight_bonus": 0.12},
    },
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

CULTIVATION_FLAG_DESCRIPTIONS = {
    "combat_bonus": "战斗胜率提升",
    "combat_resist": "战斗伤害减免",
    "setback_reduce": "失败损伤减轻",
    "hazard_hint": "陷阱几率降低",
    "chance_bonus": "机缘收益提高",
    "insight_bonus": "悟道成功率提升",
    "alchemy_mastery": "炼丹圆满",
    "escape_bonus": "脱困更易",
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
        "stats": dict(item.get("stats") or {}),
        "flags": dict(item.get("flags") or {}),
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
        "stats": dict(item.get("stats") or {}),
        "flags": dict(item.get("flags") or {}),
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
        "stats": dict(item.get("stats") or {}),
        "flags": dict(item.get("flags") or {}),
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
    stats_bonus = {
        key: int(value)
        for key, value in (loot.get("stats") or {}).items()
        if isinstance(value, (int, float)) and int(value) != 0
    }
    flag_bonus = {
        key: value
        for key, value in (loot.get("flags") or {}).items()
        if value is not None
    }
    effects_summary: List[str] = []
    if stats_bonus:
        stats_store = run.setdefault("stats", {})
        for stat_key, delta in stats_bonus.items():
            current = int(stats_store.get(stat_key, 0))
            stats_store[stat_key] = current + delta
            label = _cultivation_stat_label(stat_key)
            effects_summary.append(f"{label}+{delta}")
            if stat_key == "body":
                extra_health = max(2.0, delta * 4.0)
                run["max_health"] = float(run.get("max_health", 0.0)) + extra_health
                run["health"] = min(
                    float(run.get("max_health", 0.0)),
                    float(run.get("health", 0.0)) + extra_health,
                )
            elif stat_key == "spirit":
                run["lifespan"] = int(run.get("lifespan", 0)) + max(2, delta * 2)
    if flag_bonus:
        flag_store = run.setdefault("talent_flags", {})
        for flag_key, raw_val in flag_bonus.items():
            if isinstance(raw_val, (int, float)):
                flag_store[flag_key] = float(flag_store.get(flag_key, 0.0)) + float(raw_val)
            else:
                flag_store[flag_key] = raw_val
            label = CULTIVATION_FLAG_DESCRIPTIONS.get(flag_key)
            if label:
                effects_summary.append(label)
    if stats_bonus:
        entry["effects"] = _cultivation_render_bonus(stats_bonus)
    if flag_bonus:
        entry.setdefault("flags", []).extend(
            [CULTIVATION_FLAG_DESCRIPTIONS.get(k, k) for k in flag_bonus.keys()]
        )
    bucket.append(entry)
    log_text = loot.get("log")
    if log_text and effects_summary:
        summary_text = "，".join(effects_summary)
        log_text = f"{log_text}（{summary_text}）"
    desc_text = entry.get("desc") or ""
    if effects_summary:
        summary_text = "，".join(effects_summary)
        entry["desc"] = f"{desc_text}（{summary_text}）" if desc_text else f"（{summary_text}）"
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
        if item.get("effects"):
            entry["effects"] = list(item.get("effects") or [])
        if item.get("flags"):
            entry["flags"] = list(item.get("flags") or [])
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


def _cultivation_build_ambush_event(run: Dict[str, Any], base_seed: int) -> Dict[str, Any]:
    stage_index = int(run.get("stage_index", 0))
    arc = _cultivation_stage_arc(stage_index)
    mainline_goal = (run.get("mainline") or {}).get("goal", "")
    rng = random.Random(base_seed ^ 0x5A5A)
    location = rng.choice(["断崖古道", "苍林幽径", "灵脉峡谷", "雾色驿站"])
    enemy = rng.choice(list(arc.get("ambush") or ["黑衣刺客", "未知强敌"]))
    title = f"突袭·{enemy}"
    desc = (
        f"行至{location}时，{enemy}突现拦路。若能击退，或许能守护{mainline_goal}的线索；若败退，恐有大伤。"
    )
    options: List[Dict[str, Any]] = []
    options.append(
        _cultivation_option(
            "stand_firm",
            "应战斩敌",
            f"调动体魄正面迎击{enemy}，一鼓作气清除威胁。",
            "body",
            "combat",
            (72, 112),
            (-36, -12),
            (78, 122),
            "刀光剑影，杀机四伏",
        )
    )
    options.append(
        _cultivation_option(
            "seek_gap",
            "借势脱身",
            f"以心神察觉破绽，趁势退去，保全实力继续追寻{mainline_goal}。",
            "spirit",
            "escape",
            (26, 44),
            (-10, 6),
            (24, 42),
            "风声掠影，步伐如烟",
        )
    )
    _cultivation_set_option_requirements(run, "ambush", options)
    event = {
        "id": f"{run['session']}-{run['step']}-ambush",
        "title": title,
        "description": desc,
        "options": options,
        "seed": base_seed ^ 0xAA55,
        "event_type": "ambush",
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
            if run.get("mainline"):
                arc = _cultivation_stage_arc(run["stage_index"])
                run["mainline"]["chapter"] = arc.get("chapter", run["mainline"].get("chapter"))
                milestones = run["mainline"].setdefault("milestones", [])
                milestones.append(stage_name)
                try:
                    chapter_desc = arc.get("chapter_desc", "").format(goal=run["mainline"].get("goal", ""))
                except Exception:
                    chapter_desc = arc.get("chapter_desc") or ""
                if chapter_desc:
                    _cultivation_log(run, f"【主线】{chapter_desc}", "info")
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
                "{chapter}，{stage}的你闭关于{locale}，{phenomenon}，心境{mood}，心念不忘{mainline_goal}。",
                "你静坐在{locale}，{phenomenon}，整个人{mood}，推演{mainline_goal}的下一步。",
                "在{locale}内灵机翻涌，{stage}的你呼吸绵长，念头{mood}，隐约捕捉到主线线索的回响。",
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
            {
                "id": "starlight_bathe",
                "focus": "luck",
                "type": "chance",
                "progress": (52, 84),
                "health": (-4, 5),
                "score": (54, 86),
                "label": {
                    "templates": [
                        "沐浴星辉引灵",
                        "借星光温养气运",
                        "承受星辉洗礼",
                    ],
                },
                "detail": {
                    "templates": [
                        "在{phenomenon}之下敞开心境，让{focus_label}与天机同频。",
                        "顺着星辉脉络推演未来，为{mainline_goal}累积福泽。",
                        "借天外星辉滋润经脉，调动{focus_label}承载更多机缘。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "星芒垂落，命星轻颤",
                        "紫光缠身，气运回转",
                        "星河倾泻，灵兆频现",
                    ],
                },
            },
            {
                "id": "soul_anchor",
                "focus": "spirit",
                "type": "insight",
                "progress": (54, 90),
                "health": (-7, 3),
                "score": (56, 92),
                "label": {
                    "templates": [
                        "凝神守一稳魂",
                        "以心灯固守真意",
                        "静观内景锚定心神",
                    ],
                },
                "detail": {
                    "templates": [
                        "在{locale}深处缓缓呼吸，让{focus_label}沉入丹田，梳理与{mainline_goal}相关的杂念。",
                        "以{focus_label}照亮心湖，反复观想主线使命，稳固意志。",
                        "让心灯映照四方，截断纷杂念头，为未来劫难蓄势。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "心海如镜，波澜不惊",
                        "神识沉潜，内景安宁",
                        "灵光内敛，心域稳固",
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
                "{chapter}推动着脚步，你踏入{terrain}，{threat}，空气中{atmosphere}，或许隐藏着{mainline_goal}的线索。",
                "行走在{terrain}之间，{threat}，让人不敢大意，你揣摩这是否与{mainline_goal}相关。",
                "{stage}的你置身{terrain}，所过之处{atmosphere}，危机四伏，却隐约感到主线在此留痕。",
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
            {
                "id": "scout",
                "focus": "mind",
                "type": "insight",
                "progress": (50, 82),
                "health": (-8, 2),
                "score": (52, 80),
                "label": {
                    "templates": [
                        "察觉地势布局",
                        "布下探查灵纹",
                        "细查{terrain}伏脉",
                    ],
                },
                "detail": {
                    "templates": [
                        "展开{focus_label}推演地势，将{threat}的源头逐一标记。",
                        "绘制灵纹图录，寻找能助{mainline_goal}的隐秘通道。",
                        "借心神勘察周围，推演下一步行动的最佳路线。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "目光如炬，灵识铺陈",
                        "阵纹蔓延，信息入海",
                        "思绪疾转，洞见杀机",
                    ],
                },
            },
            {
                "id": "ward",
                "focus": "spirit",
                "type": "escape",
                "progress": (44, 70),
                "health": (-6, 4),
                "score": (46, 72),
                "label": {
                    "templates": [
                        "布设灵阵稳局",
                        "立下护行结界",
                        "借{focus_label}镇压煞气",
                    ],
                },
                "detail": {
                    "templates": [
                        "围绕{terrain}布设结界，减弱{threat}带来的冲击，为后续行动铺路。",
                        "以{focus_label}镇压四周，留出与{mainline_goal}相关的安全通道。",
                        "把灵力化作护盾，确保同伴能顺利穿越险地。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "灵光交织，护罩成形",
                        "阵纹闪烁，煞气退散",
                        "心灯守护，风暴渐平",
                    ],
                },
            },
            {
                "id": "scout",
                "focus": "mind",
                "type": "insight",
                "progress": (50, 82),
                "health": (-8, 2),
                "score": (52, 80),
                "label": {
                    "templates": [
                        "察觉地势布局",
                        "布下探查灵纹",
                        "细查{terrain}伏脉",
                    ],
                },
                "detail": {
                    "templates": [
                        "展开{focus_label}推演地势，将{threat}的源头逐一标记。",
                        "绘制灵纹图录，寻找能助{mainline_goal}的隐秘通道。",
                        "借心神勘察周围，推演下一步行动的最佳路线。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "目光如炬，灵识铺陈",
                        "阵纹蔓延，信息入海",
                        "思绪疾转，洞见杀机",
                    ],
                },
            },
            {
                "id": "ward",
                "focus": "spirit",
                "type": "escape",
                "progress": (44, 70),
                "health": (-6, 4),
                "score": (46, 72),
                "label": {
                    "templates": [
                        "布设灵阵稳局",
                        "立下护行结界",
                        "借{focus_label}镇压煞气",
                    ],
                },
                "detail": {
                    "templates": [
                        "围绕{terrain}布设结界，减弱{threat}带来的冲击，为后续行动铺路。",
                        "以{focus_label}镇压四周，留出与{mainline_goal}相关的安全通道。",
                        "把灵力化作护盾，确保同伴能顺利穿越险地。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "灵光交织，护罩成形",
                        "阵纹闪烁，煞气退散",
                        "心灯守护，风暴渐平",
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
            "benefactor": ["迷途商队", "受伤樵夫", "胆怯药童", "风餐露宿的旅者"],
            "mortal_need": ["请求护送抵达城镇", "希望守护临时营地", "寻找遗失货箱", "想请人照料灵田"],
            "reward": ["一袋铜钱", "满箱灵石", "沉甸甸的赏金", "珍藏的灵材"],
        },
        "description": {
            "templates": [
                "旅途中{omen}，{guide}，似乎有{gift}等待有缘之人，而这机缘也许与{mainline_goal}相扣。",
                "你恰逢{omen}，{guide}之下，前方隐约有{gift}流光闪动，像是主线新篇的钥匙。",
                "命运之轮转动，{omen}与{guide}交织，机缘近在咫尺，或许能助你推进{mainline_goal}。",
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
            {
                "id": "aid_mortal",
                "focus": "body",
                "type": "chance",
                "progress": (46, 76),
                "health": (-3, 4),
                "score": (48, 80),
                "label": {
                    "templates": [
                        "扶助{benefactor}",
                        "出手解困凡俗",
                        "护送{benefactor}脱险",
                    ],
                },
                "detail": {
                    "templates": [
                        "趁机帮助{benefactor}，替他们{mortal_need}，对方愿以{reward}酬谢。",
                        "以{focus_label}稳住局势，协助凡俗处理危机，换取{reward}。",
                        "在{guide}的指引下出手援助，凡人感激地奉上{reward}。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "善缘相报，铜钱叮当",
                        "凡俗敬畏，感念修者",
                        "功德流转，灵财自来",
                    ],
                },
                "meta": {
                    "gain_coins": (36, 78),
                    "note": {
                        "templates": [
                            "凡俗酬谢",
                            "灵石赏赐",
                            "义举获铜钱",
                        ],
                    },
                },
            },
            {
                "id": "suppress_anomaly",
                "focus": "spirit",
                "type": "escape",
                "progress": (50, 82),
                "health": (-6, 5),
                "score": (52, 84),
                "label": {
                    "templates": [
                        "稳压失控机缘",
                        "以心性封镇异象",
                        "镇定{gift}余波",
                    ],
                },
                "detail": {
                    "templates": [
                        "以{focus_label}循着{guide}的轨迹，将{omen}激起的动荡慢慢安抚。",
                        "搭建心性屏障，稳定{gift}附近的气机，防止机缘崩散。",
                        "与机缘之灵共振，压制逸散灵光，为主线争取更多时间。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "心海沉稳，异象敛息",
                        "灵光化幕，动荡平息",
                        "神识如网，机缘稳固",
                    ],
                },
            },
            {
                "id": "barter_fate",
                "focus": "mind",
                "type": "chance",
                "progress": (48, 78),
                "health": (-4, 4),
                "score": (50, 82),
                "label": {
                    "templates": [
                        "以悟性解读天机",
                        "与命星讨价还价",
                        "借灵符换取机缘",
                    ],
                },
                "detail": {
                    "templates": [
                        "用{focus_label}解析{guide}中的暗语，提出交换条件以换得{gift}。",
                        "布下小阵，与命星对话，试图改写机缘走向。",
                        "投入心神沟通天机，将自身悟道与{reward}对换。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "符光流转，天机松动",
                        "命星摇曳，机缘降临",
                        "悟性化桥，福缘自至",
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
                "宗门下达任务，需要{task}，{mentor}，若完成便能为{mainline_goal}积累助力，可获{reward}。",
                "你被指派去{task}，{mentor}，考验极其严格，但或许有助主线推进。",
                "{stage}修为的你肩负{task}重任，{mentor}，压力不小，却可能换来关于{mainline_goal}的新机会。",
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
            {
                "id": "forge",
                "focus": "body",
                "type": "alchemy",
                "progress": (48, 78),
                "health": (-7, 3),
                "score": (50, 82),
                "label": {
                    "templates": [
                        "协助炼制宗门器械",
                        "操持炉火锻造灵甲",
                        "以{focus_label}锤炼灵胚",
                    ],
                },
                "detail": {
                    "templates": [
                        "在长老监督下操纵炉火，锻造守卫{task}所需的灵器。",
                        "以强横体魄掌控火候，将材料淬炼到完美状态。",
                        "配合师兄弟锤炼灵胚，为主线任务准备后勤资源。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "炉火轰鸣，灵光四散",
                        "锤影翻飞，火星迸射",
                        "汗水蒸腾，灵材化形",
                    ],
                },
            },
            {
                "id": "mediation",
                "focus": "spirit",
                "type": "insight",
                "progress": (46, 76),
                "health": (-3, 5),
                "score": (48, 80),
                "label": {
                    "templates": [
                        "调解同门纷争",
                        "以心性稳固军心",
                        "主持闭关共修",
                    ],
                },
                "detail": {
                    "templates": [
                        "以{focus_label}安抚两派矛盾，确保{task}顺利推进。",
                        "在讲武场主持冥想，引导众人统一意志。",
                        "守住心灯，帮助同门在紧张任务前稳定心神。",
                    ],
                },
                "flavor": {
                    "templates": [
                        "心湖泛光，众人归心",
                        "和风拂面，躁念消散",
                        "神识同调，军心稳固",
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
                "境界将破，{storm}，{sign}，连{echo}，若能挺过此劫，{mainline_goal}或现曙光。",
                "你身处雷海中心，{storm}，{sign}，让人几乎窒息，但你想到主线使命不敢退缩。",
                "天威降临，{sign}，{storm}包裹全身，周遭{echo}，似乎也在考验你守护{mainline_goal}的决意。",
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
    "ambush": ["杀机骤现寒芒闪烁，", "敌影潜伏草木摇曳，", "血雨横飞战鼓震天，"],
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
    "历经万难的你立于{stage}之境，",
    "此刻你稳居{stage}阶位，",
]

CULTIVATION_OUTCOME_BACKDROPS = {
    "meditation": [
        "静室灵雾缭绕，",
        "心湖澄澈如镜，",
        "丹炉温热如春，",
        "木鱼轻鸣回荡，",
    ],
    "adventure": [
        "山野杀机四伏，",
        "荒域尘砂飞舞，",
        "古阵符光闪烁，",
        "密林妖风尖啸，",
    ],
    "opportunity": [
        "命星灿然回响，",
        "机缘氤氲环绕，",
        "天机轻声低语，",
        "造化自虚空垂落，",
    ],
    "training": [
        "宗门同门屏息，",
        "长老目光炯炯，",
        "讲台道音回荡，",
        "擂台战鼓震耳，",
    ],
    "tribulation": [
        "雷海咆哮不止，",
        "劫云压顶欲坠，",
        "天威滚滚如潮，",
        "火光吞没四极，",
    ],
    "general": [
        "灵气翻涌之间，",
        "天地默然关注，",
        "周遭玄光升腾，",
        "风雷交鸣映照身影，",
    ],
}

CULTIVATION_FOCUS_ACTIONS = {
    "mind": [
        "以{focus_label}推演星河，",
        "让{focus_label}贯穿神识，",
        "聚拢{focus_label}洞悉玄妙，",
        "借{focus_label}串联万千符理，",
    ],
    "body": [
        "借{focus_label}轰碎阻碍，",
        "让{focus_label}化作雷霆，",
        "以{focus_label}硬撼险境，",
        "激发{focus_label}镇压血潮，",
    ],
    "spirit": [
        "收敛心神守护本心，",
        "让{focus_label}包裹神魂，",
        "以{focus_label}抚平波澜，",
        "借{focus_label}映照前路，",
    ],
    "luck": [
        "凭{focus_label}牵引天机，",
        "顺着{focus_label}寻找转机，",
        "让{focus_label}拨动命星，",
        "借{focus_label}感知潜伏变数，",
    ],
    "default": [
        "催动{focus_label}迎上前去，",
        "调度{focus_label}应对变数，",
        "驾驭{focus_label}消弭冲击，",
    ],
}

CULTIVATION_OUTCOME_ACTION_WRAPPERS = [
    "你选择了{action}，",
    "你尝试{action}，",
    "你以{action}应对，",
    "你顺势施展{action}，",
    "你沉吟片刻后执行{action}，",
]

CULTIVATION_OUTCOME_QUALITY_WORDS = {
    "brilliant": "大获全胜",
    "success": "顺利有成",
    "failure": "功败垂成",
    "neutral": "波澜不惊",
}

CULTIVATION_OUTCOME_REACTIONS = {
    "general": {
        "brilliant": [
            "{quality_word}，体内法海奔腾，几欲再攀一个层次。",
            "{quality_word}，周身灵光凝成星河，引得天地轰鸣。",
            "{quality_word}，你感到大道纹路在指尖跃动。",
        ],
        "success": [
            "{quality_word}，气机回环间根基越发牢靠。",
            "{quality_word}，细微顿悟缓缓沉入道基。",
            "{quality_word}，你的呼吸与天地节奏逐渐契合。",
        ],
        "failure": [
            "{quality_word}，你只得按捺躁动，默默疗伤。",
            "{quality_word}，不得不暂退一步，以免伤势扩大。",
            "{quality_word}，你勉力稳住心神，为下一次再战蓄势。",
        ],
        "neutral": [
            "{quality_word}，你收拾心绪，继续踏上征程。",
            "{quality_word}，此段插曲终究化作旅途一声叹息。",
            "{quality_word}，你将心神收回，不让情绪掀起波澜。",
        ],
    },
    "meditation": {
        "brilliant": [
            "{quality_word}，心湖之上升起万千道纹，顿悟呼之欲出。",
            "{quality_word}，你看见本命真灵在丹田开枝散叶。",
        ],
        "success": [
            "{quality_word}，一缕灵机稳稳落入识海。",
            "{quality_word}，呼吸绵长，玄关愈发通达。",
        ],
        "failure": [
            "{quality_word}，杂念突起令灵机受阻，只得暂缓修行。",
            "{quality_word}，丹田翻涌，你急忙稳住气息。",
        ],
    },
    "training": {
        "brilliant": [
            "{quality_word}，你的演武令台下惊叹不已。",
            "{quality_word}，师长点头，赐下新的传承指点。",
        ],
        "success": [
            "{quality_word}，招式愈发圆融，筋骨在磨砺中鸣响。",
            "{quality_word}，你在实战中捕捉到新的破绽。",
        ],
        "failure": [
            "{quality_word}，一时疏忽被对手反制，只得认栽。",
            "{quality_word}，你被迫退出擂台，暗自记下破绽。",
        ],
    },
    "adventure": {
        "brilliant": [
            "{quality_word}，险地反成历练之所，天地赐下厚礼。",
            "{quality_word}，你将危机转为机缘，满载而归。",
        ],
        "success": [
            "{quality_word}，你巧妙避开杀机，稳稳脱身。",
            "{quality_word}，荒野之行虽险终究有所斩获。",
        ],
        "failure": [
            "{quality_word}，妖风骤起迫使你狼狈撤离。",
            "{quality_word}，机关齐鸣，你带伤突围。",
        ],
    },
    "opportunity": {
        "brilliant": [
            "{quality_word}，命星照耀，造化滚滚而来。",
            "{quality_word}，你抓住天机，福泽连连。",
        ],
        "success": [
            "{quality_word}，一缕玄光落入体内，化作长远机缘。",
            "{quality_word}，你稳稳接下机缘，积累悄然加深。",
        ],
        "failure": [
            "{quality_word}，稍纵即逝的天机被你错过，只留遗憾。",
            "{quality_word}，造化散去，你唯有暗记此次教训。",
        ],
    },
    "ambush": {
        "brilliant": [
            "{quality_word}，你反守为攻，敌影尽数化作飞灰。",
            "{quality_word}，杀招迭出，伏击者魂飞魄散。",
        ],
        "success": [
            "{quality_word}，你以雷霆手段击退伏击之敌。",
            "{quality_word}，刀光划破夜幕，敌踪仓皇遁逃。",
        ],
        "failure": [
            "{quality_word}，敌人攻势凌厉，你被迫以命换命。",
            "{quality_word}，伤痕累累的你暂避锋芒。",
        ],
    },
    "trial": {
        "brilliant": [
            "{quality_word}，你以无上悟性穿越层层考验。",
            "{quality_word}，古阵轰鸣臣服，你手持传承昂然而立。",
        ],
        "success": [
            "{quality_word}，阵纹顺从你的脚步一一熄灭。",
            "{quality_word}，你稳稳守住心神，踏过试炼尽头。",
        ],
        "failure": [
            "{quality_word}，幻境反噬，你被迫退出试炼。",
            "{quality_word}，考验残酷，你只得暂时止步。",
        ],
    },
    "tribulation": {
        "brilliant": [
            "{quality_word}，劫雷倒灌成甘霖，你的身躯熔铸成新的法体。",
            "{quality_word}，天威俯首，你自雷海中昂然而立。",
        ],
        "success": [
            "{quality_word}，你稳稳撑过每一道雷霆，法力更为澄净。",
            "{quality_word}，劫光渐散，你感到生机焕然。",
        ],
        "failure": [
            "{quality_word}，劫力反噬，你忙不迭以灵药固住根基。",
            "{quality_word}，雷霆轰鸣逼得你仓促落败。",
        ],
    },
    "merchant": {
        "neutral": [
            "{quality_word}，你与行脚商贩客气作别。",
            "{quality_word}，你收拢心念未让波澜起伏。",
        ],
    },
    "sacrifice": {
        "brilliant": [
            "{quality_word}，祭坛回馈的力量让你浑身轻松。",
            "{quality_word}，血祭化作纯净灵泉灌入经脉。",
        ],
        "success": [
            "{quality_word}，代价换来可靠回报。",
            "{quality_word}，祭坛光芒渐敛，你稳稳接住馈赠。",
        ],
        "failure": [
            "{quality_word}，献祭反噬，你忙不迭稳住气血。",
            "{quality_word}，神坛怒啸，抽走你一缕精气。",
        ],
    },
}

CULTIVATION_OUTCOME_TRAP_TAILS = {
    "brilliant": [
        "可暗流忽起，潜藏陷阱仍让你付出鲜血代价。",
        "只是杀机未散，你亦难免受了几分创伤。",
    ],
    "success": [
        "然而埋伏的陷阱突然引爆，让你险些失足。",
        "可谁料机关乍现，你被擦伤数处。",
    ],
    "failure": [
        "更糟的是，暗藏机关雪上加霜，让伤势愈发沉重。",
        "偏又触动陷阱，令你踉跄倒退。",
    ],
    "neutral": [
        "可暗角的陷阱仍让空气一紧，你只能暗中戒备。",
    ],
}


def _cultivation_loot_summary(loot: Optional[Dict[str, Any]], quality: str) -> Optional[str]:
    if not loot or not isinstance(loot, dict):
        return None
    name = str(loot.get("name") or "").strip()
    loot_type = str(loot.get("type") or "").strip()
    if not name or not loot_type:
        return None
    desc = str(loot.get("desc") or "").strip()
    if loot_type == "companion":
        body = f"道友「{name}」愿与你并肩"
    elif loot_type == "technique":
        body = f"传承「{name}」归入你的经卷"
    else:
        body = f"法宝「{name}」被你收入袖中"
    if desc:
        body = f"{body}，{desc}"
    prefix_map = {
        "brilliant": "更让人振奋的是，",
        "success": "此外，",
        "failure": "虽有波折，但",
        "neutral": "临别前，",
    }
    prefix = prefix_map.get(quality, "此外，")
    return f"{prefix}{body}。"

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
    *,
    trap_triggered: bool = False,
    loot_summary: Optional[str] = None,
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
    quality_word = CULTIVATION_OUTCOME_QUALITY_WORDS.get(quality, "")
    if quality_word:
        context["quality_word"] = quality_word
    prefix = rng.choice(CULTIVATION_OUTCOME_PREFIXES)
    backdrop_pool = CULTIVATION_OUTCOME_BACKDROPS.get(event_type) or CULTIVATION_OUTCOME_BACKDROPS["general"]
    backdrop = rng.choice(backdrop_pool)
    focus_pool = CULTIVATION_FOCUS_ACTIONS.get(focus) or CULTIVATION_FOCUS_ACTIONS["default"]
    focus_line = rng.choice(focus_pool)
    wrapper = rng.choice(CULTIVATION_OUTCOME_ACTION_WRAPPERS)
    reaction_map = CULTIVATION_OUTCOME_REACTIONS.get(event_type, {})
    tail_options = reaction_map.get(quality)
    if not tail_options:
        tail_options = CULTIVATION_OUTCOME_REACTIONS["general"].get(quality)
    if not tail_options:
        tail_options = CULTIVATION_OUTCOME_REACTIONS["general"].get("success", [""])
    tail = rng.choice(tail_options)
    pieces = [prefix, backdrop, focus_line, wrapper, tail]
    narrative = "".join(piece.format_map(_SafeFormatDict(context)) for piece in pieces)
    extras: List[str] = []
    if trap_triggered:
        trap_pool = CULTIVATION_OUTCOME_TRAP_TAILS.get(quality) or CULTIVATION_OUTCOME_TRAP_TAILS.get("success", [])
        if trap_pool:
            extras.append(rng.choice(trap_pool).format_map(_SafeFormatDict(context)))
    if loot_summary:
        extras.append(str(loot_summary))
    if extras:
        narrative = f"{narrative}{''.join(extras)}"
    return narrative






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
    pool = list(weighted_pool)
    used_ids: Set[Optional[str]] = set()
    while len(picks) < roll_cap and pool:
        filtered: List[Tuple[int, Dict[str, Any], float]] = []
        for idx, (talent, weight) in enumerate(pool):
            talent_id = talent.get("id")
            if talent_id and talent_id in used_ids:
                continue
            filtered.append((idx, talent, weight))
        if not filtered:
            break
        total = sum(weight for _, _, weight in filtered)
        if total <= 0:
            break
        roll = rng.uniform(0, total)
        acc = 0.0
        choice_index = None
        chosen_pool_index = None
        for original_idx, talent, weight in filtered:
            acc += weight
            if roll <= acc:
                picks.append(talent)
                choice_index = original_idx
                used_ids.add(talent.get("id"))
                break
        if choice_index is None:
            break
        chosen_pool_index = choice_index
        pool.pop(chosen_pool_index)
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
    goal_rng = random.Random(seed ^ 0x5EED)
    main_goal = goal_rng.choice(CULTIVATION_MAINLINE_GOALS)
    first_arc = _cultivation_stage_arc(0)
    run["mainline"] = {"goal": main_goal, "chapter": first_arc.get("chapter", "序章"), "milestones": []}

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
    try:
        chapter_desc = first_arc.get("chapter_desc", "").format(goal=main_goal)
    except Exception:
        chapter_desc = first_arc.get("chapter_desc") or ""
    if chapter_desc:
        _cultivation_log(run, f"【主线】{chapter_desc}", "info")
    else:
        _cultivation_log(run, f"【主线】师门托付你完成「{main_goal}」。", "info")
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
                (0, 0),
                (0, 0),
                (0, 0),
                "与行脚商贩讨价还价。",
                meta={
                    "cost": cost,
                    "loot": artifact,
                    "note": "法宝交易",
                    "skip_judgement": True,
                },
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
                (0, 0),
                (0, 0),
                (0, 0),
                "用铜钱换取功法残卷。",
                meta={
                    "cost": cost,
                    "loot": technique,
                    "note": "功法交易",
                    "skip_judgement": True,
                },
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
                (0, 0),
                (0, 0),
                (0, 0),
                "拱手作别行脚商贩。",
                meta={"note": "空手而归", "skip_judgement": True, "neutral": True},
            )
        )
    options.append(
        _cultivation_option(
            "decline",
            "婉拒离去",
            "保留资源，继续赶路。",
            "luck",
            "merchant_leave",
            (0, 0),
            (0, 0),
            (0, 0),
            "谢绝商贩的热情邀约。",
            meta={"note": "离开", "skip_judgement": True, "neutral": True},
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
                (0, 0),
                (0, 0),
                (0, 0),
                "与行脚商贩讨价还价。",
                meta={
                    "cost": cost,
                    "loot": artifact,
                    "note": "法宝交易",
                    "skip_judgement": True,
                    "neutral": True,
                },
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
                (0, 0),
                (0, 0),
                (0, 0),
                "用铜钱换取功法残卷。",
                meta={
                    "cost": cost,
                    "loot": technique,
                    "note": "功法交易",
                    "skip_judgement": True,
                    "neutral": True,
                },
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
                (0, 0),
                (0, 0),
                (0, 0),
                "拱手作别行脚商贩。",
                meta={"note": "空手而归", "skip_judgement": True, "neutral": True},
            )
        )
    options.append(
        _cultivation_option(
            "decline",
            "婉拒离去",
            "保留资源，继续赶路。",
            "luck",
            "merchant_leave",
            (0, 0),
            (0, 0),
            (0, 0),
            "谢绝商贩的热情邀约。",
            meta={"note": "离开", "skip_judgement": True, "neutral": True},
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
                (0, 0),
                (0, 0),
                (0, 0),
                "与行脚商贩讨价还价。",
                meta={
                    "cost": cost,
                    "loot": artifact,
                    "note": "法宝交易",
                    "skip_judgement": True,
                    "neutral": True,
                },
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
                (0, 0),
                (0, 0),
                (0, 0),
                "用铜钱换取功法残卷。",
                meta={
                    "cost": cost,
                    "loot": technique,
                    "note": "功法交易",
                    "skip_judgement": True,
                    "neutral": True,
                },
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
                (0, 0),
                (0, 0),
                (0, 0),
                "拱手作别行脚商贩。",
                meta={"note": "空手而归", "skip_judgement": True, "neutral": True},
            )
        )
    options.append(
        _cultivation_option(
            "decline",
            "婉拒离去",
            "保留资源，继续赶路。",
            "luck",
            "merchant_leave",
            (0, 0),
            (0, 0),
            (0, 0),
            "谢绝商贩的热情邀约。",
            meta={"note": "离开", "skip_judgement": True, "neutral": True},
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
    stage_index = int(run.get("stage_index", 0))
    ambush_rng = random.Random(base_seed ^ 0x1337)
    ambush_chance = min(0.1 + stage_index * 0.03, 0.28)
    if ambush_rng.random() < ambush_chance:
        run["pending_event"] = _cultivation_build_ambush_event(run, base_seed)
        return
    near_break = False
    if stage_index < len(CULTIVATION_STAGE_THRESHOLDS):
        threshold = CULTIVATION_STAGE_THRESHOLDS[stage_index]
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
    def resolve_meta(meta_spec: Any, ctx: Dict[str, Any], rng_obj: random.Random) -> Optional[Dict[str, Any]]:
        if not isinstance(meta_spec, dict):
            return None
        meta: Dict[str, Any] = {}
        for key, raw in meta_spec.items():
            value: Any = raw
            if isinstance(raw, dict) and "templates" in raw:
                value = _dynamic_text(raw, ctx, rng_obj)
            elif isinstance(raw, (list, tuple)) and len(raw) == 2:
                try:
                    lo = float(raw[0])
                    hi = float(raw[1])
                except (TypeError, ValueError):
                    lo = hi = None
                if lo is not None and hi is not None:
                    if hi < lo:
                        lo, hi = hi, lo
                    value = rng_obj.randint(int(math.floor(lo)), int(math.ceil(hi)))
            if key == "gain_coins":
                try:
                    value = int(value)
                except (TypeError, ValueError):
                    value = 0
            meta[key] = value
        return meta or None
    dominant = None
    if stats:
        dominant = max(stats.items(), key=lambda item: int(item[1]))[0]
    stage_index = int(run.get("stage_index", 0))
    stage_name = CULTIVATION_STAGE_NAMES[min(stage_index, len(CULTIVATION_STAGE_NAMES) - 1)]
    arc = _cultivation_stage_arc(stage_index)
    mainline_goal = (run.get("mainline") or {}).get("goal", "")
    blueprint = CULTIVATION_EVENT_BLUEPRINTS.get(event_type, {})
    default_titles = {
        "meditation": "闭关悟道",
        "adventure": "山野历练",
        "opportunity": "奇遇机缘",
        "training": "门派试炼",
        "tribulation": "境界瓶颈",
        "ambush": "突袭伏杀",
    }
    context: Dict[str, Any] = {
        "stage": stage_name,
        "age": int(run.get("age", 0)),
        "dominant": dominant,
        "dominant_label": stat_labels.get(dominant, ""),
        "chapter": arc.get("chapter", ""),
        "mainline_goal": mainline_goal,
    }
    if arc.get("chapter_desc"):
        try:
            context["chapter_desc"] = arc.get("chapter_desc", "").format(goal=mainline_goal)
        except Exception:
            context["chapter_desc"] = arc.get("chapter_desc") or ""
    context_rng = random.Random(base_seed ^ 0xBADC0DE)
    stage_motif = _choose_fragment(context_rng, arc.get("motifs") or [], context)
    if stage_motif:
        context["stage_motif"] = stage_motif
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
        meta = resolve_meta(spec.get("meta"), option_context, option_rng)
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
                meta=meta,
            )
        )

    stage_variants = (CULTIVATION_STAGE_EVENT_VARIANTS.get(event_type, {}) or {}).get(stage_index) or []
    if stage_variants:
        variant_rng = random.Random(base_seed ^ 0xBEE5)
        take = min(len(stage_variants), 2)
        for spec in variant_rng.sample(stage_variants, take):
            spec_id = spec.get("id") or secrets.token_hex(4)
            focus_key = spec.get("focus") or "mind"
            option_context = dict(context)
            option_context["focus_label"] = stat_labels.get(focus_key, focus_key)
            offset = (sum(ord(ch) for ch in spec_id) or 31) << 2
            option_rng = random.Random(base_seed ^ offset ^ 0xACED)
            label = _dynamic_text(spec.get("label"), option_context, option_rng) or spec_id
            detail = _dynamic_text(spec.get("detail"), option_context, option_rng)
            flavor = _dynamic_text(spec.get("flavor"), option_context, option_rng)
            meta = resolve_meta(spec.get("meta"), option_context, option_rng)
            options.append(
                _cultivation_option(
                    spec_id,
                    label,
                    detail or "",
                    focus_key,
                    spec.get("type") or "insight",
                    spec.get("progress") or (48, 72),
                    spec.get("health") or (-6, 3),
                    spec.get("score") or (48, 74),
                    flavor or "",
                    meta=meta,
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
            meta = resolve_meta(dom_spec.get("meta"), option_context, option_rng)
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
                    meta=meta,
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

    _cultivation_ensure_option_count(event_type, options, base_seed, context)
    _cultivation_set_option_requirements(run, event_type, options)
    _cultivation_apply_random_traps(run, event_type, options, base_seed)
    if event_type not in {"trial", "merchant", "sacrifice", "ambush"} and len(options) > 1:
        shuffle_rng = random.Random(base_seed ^ 0xD51F)
        shuffle_rng.shuffle(options)

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
    event_type = event.get("event_type") or "general"
    neutral_choice = bool(meta.get("neutral"))
    skip_resolution = bool(meta.get("skip_judgement"))
    if event_type == "merchant":
        neutral_choice = True
        skip_resolution = True
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
    loot_payload: Optional[Dict[str, Any]] = None
    loot_acquired = False
    if loot_meta:
        loot_payload = dict(loot_meta)
        loot_acquired = _cultivation_record_gain(run, loot_payload)
    stat_value = int(stats.get(focus, 0))
    prev_progress = float(run.get("progress", 0.0))
    prev_score = float(run.get("score", 0.0))
    prev_health = float(run.get("health", 0.0))
    progress_low, progress_high = option.get("progress", (40.0, 60.0))
    score_low, score_high = option.get("score", (40.0, 60.0))
    health_low, health_high = option.get("health", (-4.0, 2.0))
    if skip_resolution:
        progress_gain = 0.0
        score_gain = 0.0
        health_delta = 0.0
    else:
        progress_gain = rng.uniform(progress_low, progress_high) * CULTIVATION_PROGRESS_SCALE
        progress_gain += stat_value * CULTIVATION_PROGRESS_STAT_WEIGHT
        score_gain = rng.uniform(score_low, score_high) * CULTIVATION_SCORE_SCALE
        score_gain += stat_value * CULTIVATION_SCORE_STAT_WEIGHT
        health_delta = rng.uniform(health_low, health_high)
    profile = _cultivation_option_success_profile(run, option)
    stat_value = profile.get("stat_value", stat_value)
    ratio = profile.get("ratio", 1.0)
    if ratio < 1.0:
        penalty = 0.5 + 0.5 * ratio
        progress_gain *= penalty
        score_gain *= penalty * (0.85 + 0.15 * ratio)
        if health_delta < 0:
            health_delta *= 1.1 + (1.0 - ratio) * 0.8
        else:
            health_delta *= max(0.2, ratio)
    else:
        bonus = min(0.6, (ratio - 1.0) * 0.45)
        progress_gain *= 1.0 + bonus
        score_gain *= 1.0 + bonus * 1.1
        if health_delta < 0:
            health_delta *= max(0.35, 1.0 - bonus * 0.7)
        else:
            health_delta += abs(health_delta) * (0.15 + bonus * 0.2)
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
    if option.get("type") == "escape":
        escape_bonus = float(flags.get("escape_bonus") or 0.0)
        progress_gain *= max(0.4, 0.65 + escape_bonus * 0.35)
        score_gain *= max(0.4, 0.7 + escape_bonus * 0.3)
        if health_delta < 0:
            health_delta *= max(0.25, 0.5 - escape_bonus * 0.2)
        else:
            health_delta += rng.uniform(1.0, 3.0) * (1.0 + escape_bonus * 0.5)
    if option.get("type") == "alchemy" and flags.get("alchemy_mastery"):
        progress_gain *= 1.3
        score_gain *= 1.25
    if health_delta < 0 and flags.get("setback_reduce"):
        health_delta = min(0.0, health_delta + float(flags.get("setback_reduce")))

    if neutral_choice:
        progress_gain = 0.0
        score_gain = 0.0
        health_delta = 0.0

    success_threshold = profile.get("success", 0.3)
    crit_threshold = profile.get("crit", min(success_threshold * 0.5, 0.12))
    if neutral_choice:
        success_threshold = 1.0
        crit_threshold = 0.0
        quality = "neutral"
    else:
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

    if neutral_choice:
        progress_gain = 0.0
        score_gain = 0.0
        health_delta = 0.0
    elif quality == "failure":
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

    trap_triggered = False
    trap_penalty = 0.0
    trap_info = option.get("trap")
    if isinstance(trap_info, dict) and event.get("event_type") not in {"merchant", "sacrifice", "trial"}:
        trap_chance = float(trap_info.get("chance") or 0.0)
        if rng.random() < trap_chance:
            trap_triggered = True
            severity = max(0.2, float(trap_info.get("severity") or 0.5))
            extra_damage = rng.uniform(10, 24) * severity
            trap_penalty = extra_damage
            health_delta -= extra_damage
            progress_gain *= max(0.45, 1.0 - severity * 0.4)
            score_gain *= max(0.5, 1.0 - severity * 0.35)
            flavor = trap_info.get("flavor") or "暗处杀机骤现"
            _cultivation_log(run, f"【陷阱】{flavor}，体魄-{extra_damage:.1f}", "danger")

    new_progress = max(0.0, prev_progress + progress_gain)
    applied_progress = new_progress - prev_progress
    run["progress"] = new_progress
    run["score"] = prev_score + score_gain
    max_health = float(run.get("max_health", 0.0))
    updated_health = prev_health + health_delta
    if updated_health > max_health:
        updated_health = max_health
    aging_rng = random.Random(event.get("seed", 0) ^ 0x5F5E100)
    aging = 0.0 if neutral_choice else aging_rng.uniform(0.5, 1.8)
    updated_health -= aging
    run["health"] = updated_health
    run["age"] = int(run.get("age") or 0) + 1
    net_health = run["health"] - prev_health

    event_type = event.get("event_type") or "general"
    loot_summary = None
    if loot_acquired and loot_payload:
        loot_summary = _cultivation_loot_summary(loot_payload, quality)
    tone_map = {"brilliant": "highlight", "success": "success", "failure": "danger", "neutral": "info"}
    prefix_map = {"brilliant": "【绝佳】", "success": "【顺利】", "failure": "【失利】", "neutral": "【稳妥】"}
    narrative = _cultivation_outcome_text(
        event_type,
        option.get("label"),
        focus,
        quality,
        rng,
        run,
        trap_triggered=trap_triggered,
        loot_summary=loot_summary,
    )
    if neutral_choice:
        log_text = f"{prefix_map[quality]}{narrative}"
    else:
        log_text = f"{prefix_map[quality]}{narrative}（修为{applied_progress:+.0f} · 体魄{net_health:+.1f}）"
    _cultivation_log(run, log_text, tone_map[quality])

    run["pending_event"] = None

    extra_rng = random.Random(event.get("seed", 0) ^ 0xA51C3)
    if (not neutral_choice) and quality != "failure" and extra_rng.random() < 0.3:
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
    if (not neutral_choice) and extra_rng.random() < 0.2:
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
            if run.get("mainline"):
                arc = _cultivation_stage_arc(run["stage_index"])
                run["mainline"]["chapter"] = arc.get("chapter", run["mainline"].get("chapter"))
                milestones = run["mainline"].setdefault("milestones", [])
                milestones.append(stage_name)
                try:
                    chapter_desc = arc.get("chapter_desc", "").format(goal=run["mainline"].get("goal", ""))
                except Exception:
                    chapter_desc = arc.get("chapter_desc") or ""
                if chapter_desc:
                    _cultivation_log(run, f"【主线】{chapter_desc}", "info")
            if run["stage_index"] >= len(CULTIVATION_STAGE_NAMES) - 1:
                run["finished"] = True
                run["ending_type"] = "ascend"
                _cultivation_log(run, "【飞升】天劫散去，羽化登仙。", "highlight")
                break

    total_score_gain = run["score"] - prev_score
    final_net_health = run["health"] - prev_health

    outcome = {
        "progress_gain": round(applied_progress, 1),
        "score_gain": round(total_score_gain, 1),
        "health_delta": round(final_net_health, 1),
        "age": run["age"],
        "narrative": narrative,
        "tone": tone_map[quality],
        "quality": quality,
    }
    if neutral_choice:
        outcome["neutral"] = True
    if loot_summary:
        outcome["loot_summary"] = loot_summary
    if trap_triggered:
        outcome["trap_triggered"] = True
        outcome["trap_penalty"] = round(trap_penalty, 1)
    outcome["success_rate"] = round(success_threshold, 3)
    outcome["crit_rate"] = round(crit_threshold, 3)
    return outcome


def _cultivation_run_view(run: Dict[str, Any], debug: bool = False) -> Dict[str, Any]:
    event = run.get("pending_event") or None
    event_view: Optional[Dict[str, Any]] = None
    if event:
        opts_view = []
        event_type = event.get("event_type")
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
            profile = _cultivation_option_success_profile(run, opt)
            if event_type == "ambush":
                fortune = _cultivation_profile_fortune(profile)
                if fortune:
                    option_view["fortune"] = fortune
            if debug:
                debug_view: Dict[str, Any] = {
                    "requirement": int(profile.get("requirement", 0)),
                    "stat": profile.get("focus"),
                    "success_rate": round(profile.get("success", 0.0), 3),
                    "crit_rate": round(profile.get("crit", 0.0), 3),
                    "ratio": round(profile.get("ratio", 0.0), 2),
                    "ratio_floor": round(profile.get("ratio_floor", profile.get("ratio", 0.0)), 2),
                    "ratio_peak": round(profile.get("ratio_peak", profile.get("ratio", 0.0)), 2),
                }
                trap = opt.get("trap")
                if isinstance(trap, dict):
                    debug_view["trap"] = {
                        "chance": trap.get("chance"),
                        "severity": trap.get("severity"),
                        "flavor": trap.get("flavor"),
                        "is_trap": True,
                    }
                else:
                    debug_view["trap"] = {"is_trap": False}
                components_view: List[Dict[str, Any]] = []
                for comp in profile.get("components", []) or []:
                    if not isinstance(comp, dict):
                        continue
                    comp_entry = {
                        "stat": comp.get("stat"),
                        "requirement": int(comp.get("value") or 0),
                        "stat_value": int(comp.get("stat_value") or 0),
                        "weight": round(float(comp.get("weight") or 0.0), 2),
                        "ratio": round(float(comp.get("ratio") or 0.0), 2),
                        "is_primary": bool(comp.get("is_primary")),
                    }
                    components_view.append(comp_entry)
                if components_view:
                    debug_view["components"] = components_view
                option_view["debug"] = debug_view
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


def _cultivation_is_good_ending(ending_type: Optional[str]) -> bool:
    key = (ending_type or "").strip().lower()
    if not key:
        return True
    return key in {"ascend"}


def update_cultivation_leaderboard(db: Session, user: User, score: int) -> None:
    if not user or not getattr(user, "id", None):
        return
    safe_score = max(0, int(score or 0))
    entry = db.query(CultivationLeaderboardEntry).filter_by(user_id=int(user.id)).first()
    now = int(time.time())
    if not entry:
        entry = CultivationLeaderboardEntry(
            user_id=int(user.id),
            username=user.username,
            best_score=safe_score,
            updated_at=now,
        )
        db.add(entry)
    else:
        entry.username = user.username
        if safe_score > int(entry.best_score or 0):
            entry.best_score = safe_score
        entry.updated_at = now
    db.flush()


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
    reward_reason: Optional[str] = None
    ending_type = run.get("ending_type")
    good_ending = _cultivation_is_good_ending(ending_type)
    week_start = cookie_week_start(now)
    weekly_state = node.get("weekly_reward") if isinstance(node.get("weekly_reward"), dict) else {}
    if int(weekly_state.get("week_start") or 0) != week_start:
        weekly_state = {"week_start": week_start, "awarded": 0}
    awarded_this_week = int(weekly_state.get("awarded") or 0)
    weekly_remaining = max(0, CULTIVATION_WEEKLY_BRICK_CAP - awarded_this_week)
    if not good_ending:
        reward_reason = "ending"
    elif weekly_remaining <= 0:
        reward_reason = "cap"
    elif threshold and score < threshold:
        reward_reason = "score"
    else:
        bricks_awarded = min(2, weekly_remaining)
        available_seasons = SEASON_IDS[:6] if len(SEASON_IDS) >= 6 else (SEASON_IDS or [])
        if not available_seasons:
            available_seasons = [LATEST_SEASON or BRICK_SEASON_FALLBACK]
        for _ in range(bricks_awarded):
            sid = random.choice(available_seasons) if available_seasons else BRICK_SEASON_FALLBACK
            grant_user_bricks(db, user, sid, 1)
            reward_allocation[sid] = reward_allocation.get(sid, 0) + 1
        profile.total_bricks_earned = int(profile.total_bricks_earned or 0) + bricks_awarded
        weekly_state["awarded"] = awarded_this_week + bricks_awarded
    node["weekly_reward"] = weekly_state

    ending = _cultivation_choose_ending(run)

    best_prev = int(node.get("best_score") or 0)
    if score > best_prev:
        node["best_score"] = score
    current_best = int(node.get("best_score") or 0)
    update_cultivation_leaderboard(db, user, current_best)
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
        "reward": {
            "bricks": bricks_awarded,
            "by_season": reward_allocation,
            "reason": reward_reason,
            "weekly_awarded": int(weekly_state.get("awarded") or awarded_this_week),
            "weekly_cap": CULTIVATION_WEEKLY_BRICK_CAP,
        },
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
        "reward": {
            "bricks": bricks_awarded,
            "by_season": reward_allocation,
            "reason": reward_reason,
            "weekly_awarded": int(weekly_state.get("awarded") or awarded_this_week),
            "weekly_cap": CULTIVATION_WEEKLY_BRICK_CAP,
        },
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
    profile.prestige_cycle_cookies += amount
    return amount


def cookie_spend(profile: CookieFactoryProfile, amount: float) -> None:
    if amount <= 0:
        return
    if profile.banked_cookies < amount:
        raise HTTPException(400, "饼干数量不足")
    profile.banked_cookies -= amount


def cookie_prestige_requirement(profile: CookieFactoryProfile) -> float:
    base = 10_000_000.0
    count = max(0, int(profile.prestige or 0))
    return base * (1 + count)


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
    requirement = cookie_prestige_requirement(profile)
    return {
        "enabled": bool(feature_enabled),
        "now": now,
        "profile": {
            "cookies": round(float(profile.banked_cookies or 0.0), 2),
            "cookies_this_week": round(float(profile.cookies_this_week or 0.0), 2),
            "total_cookies": round(float(profile.total_cookies or 0.0), 2),
            "prestige_cycle_cookies": round(float(profile.prestige_cycle_cookies or 0.0), 2),
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
            "next_prestige_requirement": round(float(requirement), 2),
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
        password_plain=str(data.password or ""),
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
        u.last_login_ts = int(time.time())
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
    u.last_login_ts = int(time.time())
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
    u.password_plain = str(inp.new_password or "")
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
        "user_id": int(user.id),
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


@app.get("/friends")
def friends_list(user: User = Depends(user_from_token), db: Session = Depends(get_db)):
    relations = (
        db.query(Friendship)
        .filter_by(user_id=user.id)
        .order_by(Friendship.created_at.asc(), Friendship.id.asc())
        .all()
    )
    incoming_requests = (
        db.query(FriendRequest)
        .filter_by(receiver_id=user.id, status="pending")
        .order_by(FriendRequest.created_at.asc())
        .all()
    )
    outgoing_requests = (
        db.query(FriendRequest)
        .filter_by(sender_id=user.id, status="pending")
        .order_by(FriendRequest.created_at.asc())
        .all()
    )
    blocked_targets = db.query(FriendBlock).filter_by(user_id=user.id).all()
    blocked_by_others = db.query(FriendBlock).filter_by(target_id=user.id).all()

    friend_ids = [int(rel.friend_id) for rel in relations if rel.friend_id]
    user_ids: Set[int] = set(friend_ids)
    for req in incoming_requests:
        user_ids.add(int(req.sender_id))
    for req in outgoing_requests:
        user_ids.add(int(req.receiver_id))
    for blk in blocked_targets:
        user_ids.add(int(blk.target_id))
    for blk in blocked_by_others:
        user_ids.add(int(blk.user_id))

    users: Dict[int, User] = {}
    if user_ids:
        peers = db.query(User).filter(User.id.in_(user_ids)).all()
        users = {int(p.id): p for p in peers}

    blocked_self_ids = {int(b.target_id) for b in blocked_targets}
    blocked_by_ids = {int(b.user_id) for b in blocked_by_others}

    last_map: Dict[int, FriendMessage] = {}
    visible_friend_ids = [fid for fid in friend_ids if fid not in blocked_self_ids and fid not in blocked_by_ids]
    if visible_friend_ids:
        messages = (
            db.query(FriendMessage)
            .filter(
                ((FriendMessage.sender_id == user.id) & (FriendMessage.receiver_id.in_(visible_friend_ids)))
                | ((FriendMessage.receiver_id == user.id) & (FriendMessage.sender_id.in_(visible_friend_ids)))
            )
            .order_by(FriendMessage.created_at.desc(), FriendMessage.id.desc())
            .all()
        )
        for msg in messages:
            fid = int(msg.receiver_id) if int(msg.sender_id) == int(user.id) else int(msg.sender_id)
            if fid not in last_map:
                last_map[fid] = msg
            if len(last_map) >= len(visible_friend_ids):
                break

    entries: List[Dict[str, Any]] = []
    for rel in relations:
        fid = int(rel.friend_id)
        if fid in blocked_self_ids or fid in blocked_by_ids:
            continue
        peer = users.get(fid)
        if not peer:
            continue
        item: Dict[str, Any] = {
            "user_id": fid,
            "username": peer.username,
            "friend_since": int(rel.created_at or 0),
        }
        last = last_map.get(fid)
        if last:
            item["last_message"] = {
                "id": int(last.id),
                "sender_id": int(last.sender_id),
                "receiver_id": int(last.receiver_id),
                "content": last.content,
                "timestamp": int(last.created_at or 0),
            }
        entries.append(item)

    def request_entry(req: FriendRequest, incoming: bool) -> Dict[str, Any]:
        other_id = int(req.sender_id if incoming else req.receiver_id)
        peer = users.get(other_id)
        return {
            "request_id": int(req.id),
            "created_at": int(req.created_at or 0),
            "from_me": not incoming,
            "user": {
                "user_id": other_id,
                "username": peer.username if peer else "神秘玩家",
            },
        }

    incoming_payload = [request_entry(req, True) for req in incoming_requests]
    outgoing_payload = [request_entry(req, False) for req in outgoing_requests]

    blocked_payload: List[Dict[str, Any]] = []
    for blk in blocked_targets:
        peer = users.get(int(blk.target_id))
        if not peer:
            continue
        blocked_payload.append(
            {
                "user_id": int(blk.target_id),
                "username": peer.username,
                "blocked_at": int(blk.created_at or 0),
            }
        )

    return {
        "friends": entries,
        "requests": {
            "incoming": incoming_payload,
            "outgoing": outgoing_payload,
        },
        "blocked": blocked_payload,
        "blocked_by": list(blocked_by_ids),
    }


@app.get("/friends/search")
def friends_search(
    q: str = Query(..., min_length=1, max_length=50),
    limit: int = Query(10, ge=1, le=50),
    user: User = Depends(user_from_token),
    db: Session = Depends(get_db),
):
    keyword = (q or "").strip()
    if not keyword:
        raise HTTPException(400, "请输入搜索关键词")
    exclude_ids = {int(user.id)}
    friend_ids = {int(rel.friend_id) for rel in db.query(Friendship).filter_by(user_id=user.id).all()}
    exclude_ids.update(friend_ids)
    outgoing_pending = {
        int(req.receiver_id)
        for req in db.query(FriendRequest).filter_by(sender_id=user.id, status="pending").all()
    }
    incoming_pending = {
        int(req.sender_id)
        for req in db.query(FriendRequest).filter_by(receiver_id=user.id, status="pending").all()
    }
    blocked_ids = {int(b.target_id) for b in db.query(FriendBlock).filter_by(user_id=user.id).all()}
    blocked_by_ids = {int(b.user_id) for b in db.query(FriendBlock).filter_by(target_id=user.id).all()}
    exclude_ids.update(blocked_ids)
    status_map: Dict[int, str] = {}
    for fid in friend_ids:
        status_map[fid] = "friend"
    for fid in outgoing_pending:
        status_map[fid] = "pending_outgoing"
    for fid in incoming_pending:
        status_map[fid] = "pending_incoming"
    for fid in blocked_ids:
        status_map[fid] = "blocked"
    for fid in blocked_by_ids:
        status_map[fid] = "blocked_by"
        exclude_ids.add(fid)
    results: List[User] = []
    if keyword.isdigit():
        target = db.query(User).filter_by(id=int(keyword)).first()
        if target and int(target.id) not in exclude_ids:
            results.append(target)
    if len(results) < limit:
        pattern = f"%{keyword}%"
        matches = (
            db.query(User)
            .filter(User.username.ilike(pattern))
            .order_by(User.username.asc())
            .limit(limit * 2)
            .all()
        )
        for candidate in matches:
            cid = int(candidate.id)
            if cid in exclude_ids or any(int(existing.id) == cid for existing in results):
                continue
            results.append(candidate)
            if len(results) >= limit:
                break
    payload = [
        {
            "user_id": int(item.id),
            "username": item.username,
            "status": status_map.get(int(item.id), "available"),
        }
        for item in results[:limit]
    ]
    return {"results": payload}


@app.post("/friends/add")
def friends_add(
    inp: FriendAddIn,
    user: User = Depends(user_from_token),
    db: Session = Depends(get_db),
):
    target: Optional[User] = None
    if inp.target_id:
        target = db.query(User).filter_by(id=int(inp.target_id)).first()
    if not target and inp.username:
        target = db.query(User).filter_by(username=inp.username).first()
    if not target:
        raise HTTPException(404, "未找到该玩家")
    if int(target.id) == int(user.id):
        raise HTTPException(400, "无法添加自己为好友")
    if friendship_blocked(db, int(user.id), int(target.id)):
        raise HTTPException(403, "由于拉黑设置，无法添加该玩家")
    existing = db.query(Friendship).filter_by(user_id=user.id, friend_id=target.id).first()
    if existing:
        return {
            "ok": True,
            "friend": {"user_id": int(target.id), "username": target.username},
            "already": True,
        }

    now = int(time.time())
    incoming_req = (
        db.query(FriendRequest)
        .filter_by(sender_id=int(target.id), receiver_id=int(user.id))
        .first()
    )
    if incoming_req and incoming_req.status == "pending":
        incoming_req.status = "accepted"
        incoming_req.responded_at = now
        ensure_friendship_pair(db, int(user.id), int(target.id))
        ensure_friendship_pair(db, int(target.id), int(user.id))
        clear_friend_requests(db, int(user.id), int(target.id))
        db.commit()
        return {
            "ok": True,
            "friend": {"user_id": int(target.id), "username": target.username},
            "accepted": True,
        }

    outgoing_req = (
        db.query(FriendRequest)
        .filter_by(sender_id=int(user.id), receiver_id=int(target.id))
        .first()
    )
    if outgoing_req:
        outgoing_req.status = "pending"
        outgoing_req.created_at = now
        outgoing_req.responded_at = 0
    else:
        outgoing_req = FriendRequest(
            sender_id=int(user.id),
            receiver_id=int(target.id),
            status="pending",
            created_at=now,
        )
        db.add(outgoing_req)
        db.flush()
    db.commit()
    return {
        "ok": True,
        "request": {
            "id": int(outgoing_req.id),
            "status": outgoing_req.status,
            "created_at": int(outgoing_req.created_at or now),
        },
        "pending": True,
        "user": {"user_id": int(target.id), "username": target.username},
    }


@app.post("/friends/respond")
def friends_respond(
    inp: FriendRespondIn,
    user: User = Depends(user_from_token),
    db: Session = Depends(get_db),
):
    req = (
        db.query(FriendRequest)
        .filter_by(id=int(inp.request_id), receiver_id=int(user.id))
        .first()
    )
    if not req or req.status != "pending":
        raise HTTPException(404, "该好友请求不存在或已处理")
    if inp.action not in {"accept", "reject"}:
        raise HTTPException(400, "未知操作")
    now = int(time.time())
    other_id = int(req.sender_id)
    if inp.action == "accept":
        if friendship_blocked(db, int(user.id), other_id):
            raise HTTPException(403, "由于拉黑设置，无法接受该请求")
        ensure_friendship_pair(db, int(user.id), other_id)
        ensure_friendship_pair(db, other_id, int(user.id))
        req.status = "accepted"
        req.responded_at = now
        clear_friend_requests(db, int(user.id), other_id)
        db.commit()
        peer = db.query(User).filter_by(id=other_id).first()
        return {
            "ok": True,
            "friend": {
                "user_id": other_id,
                "username": peer.username if peer else "神秘玩家",
            },
        }
    req.status = "rejected"
    req.responded_at = now
    db.commit()
    return {"ok": True}


@app.delete("/friends/request/{request_id}")
def friends_cancel_request(
    request_id: int = Path(..., ge=1),
    user: User = Depends(user_from_token),
    db: Session = Depends(get_db),
):
    req = (
        db.query(FriendRequest)
        .filter_by(id=int(request_id), sender_id=int(user.id))
        .first()
    )
    if not req or req.status != "pending":
        raise HTTPException(404, "没有可取消的请求")
    db.delete(req)
    db.commit()
    return {"ok": True}


@app.delete("/friends/{friend_id}")
def friends_remove(
    friend_id: int = Path(..., ge=1),
    user: User = Depends(user_from_token),
    db: Session = Depends(get_db),
):
    relation = db.query(Friendship).filter_by(user_id=user.id, friend_id=friend_id).first()
    if not relation:
        raise HTTPException(404, "当前并非好友关系")
    remove_friendship_pair(db, int(user.id), int(friend_id))
    remove_friendship_pair(db, int(friend_id), int(user.id))
    clear_friend_requests(db, int(user.id), int(friend_id))
    db.commit()
    return {"ok": True}


@app.post("/friends/block")
def friends_block(
    payload: FriendTargetIn,
    user: User = Depends(user_from_token),
    db: Session = Depends(get_db),
):
    target_id = int(payload.target_id)
    if target_id == int(user.id):
        raise HTTPException(400, "无法拉黑自己")
    existing = (
        db.query(FriendBlock)
        .filter_by(user_id=int(user.id), target_id=target_id)
        .first()
    )
    now = int(time.time())
    if not existing:
        existing = FriendBlock(user_id=int(user.id), target_id=target_id, created_at=now)
        db.add(existing)
    remove_friendship_pair(db, int(user.id), target_id)
    remove_friendship_pair(db, target_id, int(user.id))
    clear_friend_requests(db, int(user.id), target_id)
    db.commit()
    return {"ok": True, "blocked": True}


@app.post("/friends/unblock")
def friends_unblock(
    payload: FriendTargetIn,
    user: User = Depends(user_from_token),
    db: Session = Depends(get_db),
):
    target_id = int(payload.target_id)
    entry = (
        db.query(FriendBlock)
        .filter_by(user_id=int(user.id), target_id=target_id)
        .first()
    )
    if not entry:
        raise HTTPException(404, "未找到对应的拉黑记录")
    db.delete(entry)
    db.commit()
    return {"ok": True, "blocked": False}


@app.get("/friends/conversation/{friend_id}")
def friends_conversation(
    friend_id: int = Path(..., ge=1),
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(user_from_token),
    db: Session = Depends(get_db),
):
    relation = db.query(Friendship).filter_by(user_id=user.id, friend_id=friend_id).first()
    if not relation:
        raise HTTPException(404, "尚未互为好友")
    friend = db.query(User).filter_by(id=friend_id).first()
    if not friend:
        raise HTTPException(404, "好友不存在")
    if friendship_blocked(db, int(user.id), int(friend_id)):
        raise HTTPException(403, "无法查看对话，对方或你已设置拉黑")
    messages = (
        db.query(FriendMessage)
        .filter(
            ((FriendMessage.sender_id == user.id) & (FriendMessage.receiver_id == friend_id))
            | ((FriendMessage.sender_id == friend_id) & (FriendMessage.receiver_id == user.id))
        )
        .order_by(FriendMessage.created_at.desc(), FriendMessage.id.desc())
        .limit(limit)
        .all()
    )
    history = [
        {
            "id": int(msg.id),
            "sender_id": int(msg.sender_id),
            "receiver_id": int(msg.receiver_id),
            "content": msg.content,
            "timestamp": int(msg.created_at or 0),
        }
        for msg in reversed(messages)
    ]
    return {
        "friend": {"user_id": int(friend.id), "username": friend.username},
        "messages": history,
    }


@app.post("/friends/message/{friend_id}")
def friends_send_message(
    payload: FriendMessageIn,
    friend_id: int = Path(..., ge=1),
    user: User = Depends(user_from_token),
    db: Session = Depends(get_db),
):
    relation = db.query(Friendship).filter_by(user_id=user.id, friend_id=friend_id).first()
    if not relation:
        raise HTTPException(404, "尚未互为好友")
    friend = db.query(User).filter_by(id=friend_id).first()
    if not friend:
        raise HTTPException(404, "好友不存在")
    if friendship_blocked(db, int(user.id), int(friend_id)):
        raise HTTPException(403, "无法发送，对方或你已设置拉黑")
    content = (payload.message if payload else "").strip()
    if not content:
        raise HTTPException(400, "消息内容不能为空")
    if len(content) > 1000:
        content = content[:1000]
    msg = FriendMessage(
        sender_id=int(user.id),
        receiver_id=int(friend.id),
        content=content,
        created_at=int(time.time()),
    )
    db.add(msg)
    db.flush()
    db.commit()
    return {
        "ok": True,
        "message": {
            "id": int(msg.id),
            "sender_id": int(msg.sender_id),
            "receiver_id": int(msg.receiver_id),
            "content": msg.content,
            "timestamp": int(msg.created_at or 0),
        },
    }


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
        requirement = cookie_prestige_requirement(profile)
        if float(profile.prestige_cycle_cookies or 0.0) < requirement:
            need_wan = int(requirement // 10_000)
            raise HTTPException(400, f"需要至少 {need_wan} 万枚饼干方可升天")
        points = max(1, int((float(profile.total_cookies or 0.0) / 1_000_000_000) ** 0.5))
        profile.prestige = int(profile.prestige or 0) + 1
        profile.prestige_points = int(profile.prestige_points or 0) + points
        profile.banked_cookies = 0.0
        profile.cookies_this_week = 0.0
        profile.prestige_cycle_cookies = 0.0
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
    run_view = _cultivation_run_view(run, debug=is_admin) if run else None
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


@app.get("/cultivation/leaderboard")
def cultivation_leaderboard(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(user_from_token),
):
    rows = (
        db.query(CultivationLeaderboardEntry)
        .order_by(
            CultivationLeaderboardEntry.best_score.desc(),
            CultivationLeaderboardEntry.updated_at.asc(),
            CultivationLeaderboardEntry.user_id.asc(),
        )
        .limit(int(limit))
        .all()
    )
    entries: List[Dict[str, Any]] = []
    for idx, row in enumerate(rows, start=1):
        entries.append(
            {
                "rank": idx,
                "user_id": int(row.user_id),
                "username": row.username,
                "best_score": int(row.best_score or 0),
                "updated_at": int(row.updated_at or 0),
                "is_self": bool(user.id == row.user_id) if user else False,
            }
        )
    return {"entries": entries, "generated_at": int(time.time())}


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
    selected_actual: List[Dict[str, Any]] = []
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
    auto_render: List[Dict[str, Any]] = []
    if len(selected_actual) < max_talents:
        available_cards: List[Dict[str, Any]] = []
        for card in lobby.get("talents", []):
            if not isinstance(card, dict):
                continue
            tid = str(card.get("id") or "").strip()
            if not tid:
                continue
            available_cards.append(card)
        if available_cards:
            rng = random.Random(secrets.randbits(64))
            rng.shuffle(available_cards)
            filled_any = False
            for card in available_cards:
                if len(selected_actual) >= max_talents:
                    break
                tid = str(card.get("id") or "").strip()
                if not tid:
                    continue
                if any(talent.get("id") == tid for talent in selected_actual):
                    continue
                talent = _cultivation_find_talent(tid)
                if not talent:
                    continue
                selected_actual.append(talent)
                filled_any = True
            if filled_any:
                auto_render = [_cultivation_render_talent(t) for t in selected_actual]

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
    display_talents = auto_render if auto_render else [_cultivation_render_talent(t) for t in selected_actual]
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
    is_admin = bool(getattr(user, "is_admin", False))
    return {
        "run": _cultivation_run_view(run, debug=is_admin),
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
    is_admin = bool(getattr(user, "is_admin", False))
    if not enabled and not is_admin:
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
    if not is_admin:
        outcome.pop("success_rate", None)
        outcome.pop("crit_rate", None)
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
        "run": _cultivation_run_view(run, debug=is_admin),
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

def _write_sms(tag, code, purpose, **extra):
    extra_text = ""
    if extra:
        parts = []
        for key, value in extra.items():
            if value is None:
                continue
            parts.append(f"{key}={value}")
        if parts:
            extra_text = "\t" + "&".join(parts)
    line = f"{_ts()}\t{purpose}\t{tag}\t{code}{extra_text}\n"
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
    if "last_login_ts" not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN last_login_ts INTEGER NOT NULL DEFAULT 0")
    if "admin_note" not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN admin_note TEXT NOT NULL DEFAULT ''")
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
    cur.execute("""CREATE TABLE IF NOT EXISTS admin_password_codes(
      target_id INTEGER NOT NULL,
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
      cur.execute("""SELECT id, username, phone, fiat, coins, is_admin, last_login_ts, admin_note FROM users
                     WHERE username LIKE ? OR phone LIKE ?
                     ORDER BY id DESC LIMIT ? OFFSET ?""", (qq, qq, page_size, off))
    else:
      cur.execute("""SELECT id, username, phone, fiat, coins, is_admin, last_login_ts, admin_note FROM users
                     ORDER BY id DESC LIMIT ? OFFSET ?""", (page_size, off))
    items=[dict(r) for r in cur.fetchall()]
    con.close()
    return {"items": items, "page": page, "page_size": page_size}

@ext.post("/admin/user-note")
def admin_set_user_note(payload: dict, admin=_Depends(_require_admin)):
    username = (payload or {}).get("username", "")
    note_raw = (payload or {}).get("note", "")
    username = username.strip()
    if not username:
        raise _HTTPException(400, "username required")
    note = str(note_raw or "")
    note = note.strip()
    if len(note) > 500:
        raise _HTTPException(400, "备注长度不能超过500字")
    con = _conn(); cur = con.cursor()
    cur.execute("UPDATE users SET admin_note=? WHERE username=?", (note, username))
    if cur.rowcount <= 0:
        con.close()
        raise _HTTPException(404, "user not found")
    con.commit(); con.close()
    return {"ok": True, "note": note}

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

# 管理员：查看 / 修改玩家密码（需验证码）
@ext.post("/admin/user-password/request")
def admin_user_password_request(payload: dict, admin=_Depends(_require_admin)):
    target_id = int((payload or {}).get("target_id") or 0)
    if target_id <= 0:
        raise _HTTPException(400, "target_id required")
    con = _conn(); cur = con.cursor()
    cur.execute("SELECT id, username FROM users WHERE id=?", (target_id,))
    row = cur.fetchone()
    if not row:
        con.close(); raise _HTTPException(404, "user not found")
    username = row["username"]
    _sms_rate_guard("admin-user-password", username)
    code = _gen_code(6)
    expire_at = _ts() + 10 * 60
    cur.execute("DELETE FROM admin_password_codes WHERE target_id=?", (target_id,))
    cur.execute(
        "INSERT INTO admin_password_codes(target_id, code, requested_by, expire_at) VALUES (?,?,?,?)",
        (target_id, code, admin["username"], expire_at),
    )
    con.commit(); con.close()
    _write_sms(username, code, "admin-user-password", target_id=target_id)
    return {
        "ok": True,
        "target": {"user_id": target_id, "username": username},
        "expires_in": 600,
    }


@ext.post("/admin/user-password/confirm")
def admin_user_password_confirm(payload: dict, admin=_Depends(_require_admin)):
    target_id = int((payload or {}).get("target_id") or 0)
    code = str((payload or {}).get("code") or "").strip()
    new_password = (payload or {}).get("new_password")
    if target_id <= 0 or not code:
        raise _HTTPException(400, "target_id/code required")
    con = _conn(); cur = con.cursor()
    cur.execute("SELECT code, expire_at FROM admin_password_codes WHERE target_id=?", (target_id,))
    row = cur.fetchone()
    if not row:
        con.close(); raise _HTTPException(400, "no pending code")
    if _ts() > int(row["expire_at"]):
        con.close(); raise _HTTPException(400, "code expired")
    if str(code) != str(row["code"]):
        con.close(); raise _HTTPException(400, "invalid code")
    cur.execute("SELECT id, username, password_hash, password_plain FROM users WHERE id=?", (target_id,))
    user_row = cur.fetchone()
    if not user_row:
        con.close(); raise _HTTPException(404, "user not found")
    updated_hash = user_row["password_hash"]
    updated_plain = user_row["password_plain"]
    password_updated = False
    code_consumed = False
    if new_password:
        if len(new_password) < 6:
            con.close(); raise _HTTPException(400, "new_password too short")
        updated_hash = pwd_context.hash(new_password)
        updated_plain = str(new_password or "")
        cur.execute(
            "UPDATE users SET password_hash=?, password_plain=? WHERE id=?",
            (updated_hash, updated_plain, target_id),
        )
        password_updated = True
        cur.execute("DELETE FROM admin_password_codes WHERE target_id=?", (target_id,))
        code_consumed = True
    else:
        # 未修改密码，仅查看信息：保留验证码以便后续操作
        updated_plain = str(updated_plain or "")
    updated_plain = str(updated_plain or "")
    con.commit(); con.close()
    return {
        "ok": True,
        "user": {
            "user_id": target_id,
            "username": user_row["username"],
            "password_hash": updated_hash,
            "password_plain": updated_plain,
        },
        "password_updated": password_updated,
        "code_consumed": code_consumed,
        "note": "若仅查看密码，请保留验证码以便需要时再次提交新密码进行重置。",
    }

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
