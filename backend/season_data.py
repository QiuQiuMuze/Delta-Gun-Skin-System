"""Season definitions for gun skins."""

SEASON_DEFINITIONS = [
    {
        "id": "S1",
        "name": "S1 棱镜攻势",
        "tagline": "棱镜攻势",
        "description": "首赛季的棱镜主题以透明机匣和多彩折射为灵感，强调未来感与可视化内部结构。",
        "bricks": [
            {
                "skin_id": "BRK_M4A1_PRISM",
                "name": "M4A1突击步枪-棱镜攻势",
                "weapon": "M4A1突击步枪",
                "rarity": "BRICK",
                "model_key": "assault",
                "meta": {
                    "description": "通体透明的枪身配以棱镜折射，高度还原机匣内部结构，曳光呈多色随机。",
                    "tracer": "多色棱镜曳光",
                    "body_colors": [
                        ["#9de1ff", "#f8fbff"],
                        ["#d6c1ff", "#ffffff"],
                        ["#ffb7e2", "#ffffff"]
                    ],
                    "attachment_colors": [
                        ["#ffd166", "#ffffff"],
                        ["#7ee2ff", "#ffffff"],
                        ["#f7ff7d", "#ffffff"]
                    ],
                    "template_rules": [
                        {
                            "key": "brick_prism_spectrum",
                            "label": "棱镜光谱",
                            "weight": 100,
                            "allow_premium": True,
                            "allow_exquisite": True,
                            "effects": ["prism_flux"],
                            "body": ["#b8f4ff", "#ffffff"],
                            "attachments": ["#ffd894", "#ffffff"]
                        }
                    ],
                    "extra_effects": {
                        "premium": ["sheen", "refraction"],
                        "exquisite": ["sheen", "refraction", "sparkle"]
                    }
                }
            }
        ],
        "purples": [
            {
                "skin_id": "EPI_P90_CRYSTALVEIL",
                "name": "P90冲锋枪-晶幕",
                "weapon": "P90冲锋枪",
                "rarity": "PURPLE",
                "model_key": "vector",
                "meta": {
                    "description": "透明高分子外壳搭配霓虹能量条纹，延续棱镜赛季的科幻风格。",
                    "body_colors": [["#8bf0ff", "#2a7fff"]],
                    "attachment_colors": [["#ffffff", "#5ad1ff"]],
                    "effects": {"premium": ["sheen"], "exquisite": ["sheen", "sparkle"]}
                }
            }
        ],
        "blues": [
            {
                "skin_id": "RAR_M110_AZURECORE",
                "name": "M110精确步枪-深蓝芯",
                "weapon": "M110精确步枪",
                "rarity": "BLUE",
                "model_key": "battle",
                "meta": {
                    "description": "半透明上机匣映射出稳重的深蓝主色，辅以银色导轨。",
                    "body_colors": [["#2f5aa8", "#6fa7ff"]],
                    "attachment_colors": [["#d8e8ff", "#b5c8ff"]]
                }
            }
        ],
        "greens": [
            {
                "skin_id": "UNC_M16_CLEARLINE",
                "name": "M16突击步枪-透映",
                "weapon": "M16突击步枪",
                "rarity": "GREEN",
                "model_key": "assault",
                "meta": {
                    "description": "可视化护木与半透明枪托，让经典步枪焕发新生。",
                    "body_colors": [["#7ecbff"]],
                    "attachment_colors": [["#f2f7ff"]]
                }
            }
        ]
    },
    {
        "id": "S2",
        "name": "S2 蛇影遗痕",
        "tagline": "美杜莎",
        "description": "第二赛季以美杜莎神话为灵感，强调蛇纹与古老石质浮雕。",
        "bricks": [
            {
                "skin_id": "BRK_VECTOR_MEDUSA",
                "name": "Vector冲锋枪-美杜莎",
                "weapon": "Vector冲锋枪",
                "rarity": "BRICK",
                "model_key": "vector",
                "meta": {
                    "description": "蛇纹浮雕缠绕枪身，击中目标时喷薄彩焰。",
                    "tracer": "彩色蛇焰曳光",
                    "body_colors": [["#2f2a38", "#5e725f"]],
                    "attachment_colors": [["#d9f067", "#9bc49f"]],
                    "template_rules": [
                        {
                            "key": "brick_medusa_relic",
                            "label": "蛇神遗痕",
                            "weight": 100,
                            "allow_premium": True,
                            "allow_exquisite": True,
                            "effects": ["medusa_glare"],
                            "body": ["#3a2f3c", "#6c7e68"],
                            "attachments": ["#cde46a", "#85ab8c"],
                            "hidden": False
                        }
                    ],
                    "extra_effects": {
                        "premium": ["sheen", "trail"],
                        "exquisite": ["sheen", "trail", "sparkle", "chromatic_flame"]
                    }
                }
            }
        ],
        "purples": [
            {
                "skin_id": "EPI_SPAS12_SERPENT",
                "name": "SPAS-12霰弹枪-蛇骨",
                "weapon": "SPAS-12霰弹枪",
                "rarity": "PURPLE",
                "model_key": "battle",
                "meta": {
                    "description": "骨质蛇脊覆盖枪身，尾部饰以翡翠鳞片。",
                    "body_colors": [["#3f4034", "#7a845c"]],
                    "attachment_colors": [["#b6d982", "#364834"]],
                    "effects": {"premium": ["sheen"], "exquisite": ["sheen", "glow"]}
                }
            }
        ],
        "blues": [
            {
                "skin_id": "RAR_MP7_VINEBOUND",
                "name": "MP7冲锋枪-缠藤",
                "weapon": "MP7冲锋枪",
                "rarity": "BLUE",
                "model_key": "vector",
                "meta": {
                    "description": "藤蔓纹路与青铜质感交织的近战利器。",
                    "body_colors": [["#2f3b2c", "#6b8c52"]],
                    "attachment_colors": [["#b5c78a"]]
                }
            }
        ],
        "greens": [
            {
                "skin_id": "UNC_GLOCK_SERPENTSKIN",
                "name": "Glock手枪-蛇皮",
                "weapon": "Glock手枪",
                "rarity": "GREEN",
                "model_key": "vector",
                "meta": {
                    "description": "蛇鳞压纹握把提供粗犷握感。",
                    "body_colors": [["#4d5b45"]],
                    "attachment_colors": [["#d5e6a3"]]
                }
            }
        ]
    },
    {
        "id": "S3",
        "name": "S3 电玩高手",
        "tagline": "电玩高手",
        "description": "第三赛季回归街机黄金时代，RGB灯效与像素UI遍布枪身。",
        "bricks": [
            {
                "skin_id": "BRK_SCARH_ARCADE",
                "name": "SCAR-H战斗步枪-电玩高手",
                "weapon": "SCAR-H战斗步枪",
                "rarity": "BRICK",
                "model_key": "battle",
                "meta": {
                    "description": "集成手柄按键、散热风扇与内置小游戏的重火力平台。",
                    "tracer": "霓虹像素曳光",
                    "body_colors": [["#302743", "#704bff"]],
                    "attachment_colors": [["#00f0ff", "#ff00d4"]],
                    "template_rules": [
                        {"key": "brick_arcade_crystal", "label": "水晶贪吃蛇", "weight": 1, "allow_premium": False, "allow_exquisite": True, "effects": ["arcade_glass"], "body": ["#7d4bff", "#4010b8"], "attachments": ["#5bffff", "#e8f9ff"]},
                        {"key": "brick_arcade_serpent", "label": "贪吃蛇", "weight": 5, "allow_premium": False, "allow_exquisite": True, "effects": ["arcade_trail"], "body": ["#532bff", "#150050"], "attachments": ["#00ffbf", "#80ffe3"]},
                        {"key": "brick_arcade_blackhawk", "label": "黑鹰坠落", "weight": 5, "allow_premium": False, "allow_exquisite": True, "effects": ["arcade_glow"], "body": ["#161921", "#2f4f7a"], "attachments": ["#ff004c", "#f8f8f8"]},
                        {"key": "brick_arcade_champion", "label": "拳王", "weight": 5, "allow_premium": False, "allow_exquisite": True, "effects": ["arcade_pulse"], "body": ["#4c1f1f", "#ff0040"], "attachments": ["#ffd800", "#ffe8a0"]},
                        {"key": "brick_arcade_default", "label": "电玩标准", "weight": 84, "allow_premium": True, "allow_exquisite": True, "effects": ["arcade_core"], "body": ["#2d2552", "#6f49ff"], "attachments": ["#00f6ff", "#ff5af1"]}
                    ],
                    "extra_effects": {
                        "premium": ["sheen", "trail"],
                        "exquisite": ["sheen", "trail", "sparkle"]
                    }
                }
            }
        ],
        "purples": [
            {
                "skin_id": "EPI_MP5_RHYTHM",
                "name": "MP5冲锋枪-节奏",
                "weapon": "MP5冲锋枪",
                "rarity": "PURPLE",
                "model_key": "vector",
                "meta": {
                    "description": "LED节奏条与双声道指示灯环绕机匣。",
                    "body_colors": [["#2c2c40", "#ff2d8d"]],
                    "attachment_colors": [["#12f5ff", "#fffb84"]],
                    "effects": {"premium": ["sheen"], "exquisite": ["sheen", "sparkle"]}
                }
            }
        ],
        "blues": [
            {
                "skin_id": "RAR_F2000_PIXELMESH",
                "name": "F2000突击步枪-像素网",
                "weapon": "FN F2000",
                "rarity": "BLUE",
                "model_key": "bullpup",
                "meta": {
                    "description": "像素化侧板搭配律动呼吸灯。",
                    "body_colors": [["#1c1b2e", "#34346a"]],
                    "attachment_colors": [["#5dfcff", "#7c4dff"]]
                }
            }
        ],
        "greens": [
            {
                "skin_id": "UNC_PP2000_RETRO",
                "name": "PP-2000冲锋枪-复古",
                "weapon": "PP-2000冲锋枪",
                "rarity": "GREEN",
                "model_key": "vector",
                "meta": {
                    "description": "以怀旧游戏机灰蓝色调覆盖枪身。",
                    "body_colors": [["#5b6c9b"]],
                    "attachment_colors": [["#c8d0e8"]]
                }
            }
        ]
    },
    {
        "id": "S4",
        "name": "S4 命运与王牌",
        "tagline": "命运",
        "description": "第四赛季围绕命运与纸牌魔术展开，浮雕金属与宝石色彩并存。",
        "bricks": [
            {
                "skin_id": "BRK_K416_FATE",
                "name": "K416突击步枪-命运",
                "weapon": "K416突击步枪",
                "rarity": "BRICK",
                "model_key": "assault",
                "meta": {
                    "description": "玉石光泽浮雕与命运女神纹章，附带曳光光效。",
                    "tracer": "命运流光曳光",
                    "body_colors": [["#d0c6b3", "#f8f4ea"]],
                    "attachment_colors": [["#ba9c5b", "#f8d67e"]],
                    "template_rules": [
                        {"key": "brick_fate_strawberry", "label": "草莓金", "weight": 1, "allow_premium": False, "allow_exquisite": True, "effects": ["fate_glow"], "body": ["#ff799a", "#ffd9e4"], "attachments": ["#ffe7f1", "#ffb8c8"]},
                        {"key": "brick_fate_blueberry", "label": "蓝莓玉", "weight": 1, "allow_premium": False, "allow_exquisite": True, "effects": ["fate_glow"], "body": ["#4d74ff", "#a7c4ff"], "attachments": ["#f0f6ff", "#87a2ff"]},
                        {"key": "brick_fate_goldenberry", "label": "金莓", "weight": 1, "allow_premium": False, "allow_exquisite": True, "effects": ["fate_glow"], "body": ["#ffc861", "#fff3c2"], "attachments": ["#fff5d8", "#ffe188"]},
                        {"key": "brick_fate_metal", "label": "金属拉丝", "weight": 1, "allow_premium": False, "allow_exquisite": True, "effects": ["fate_glow"], "body": ["#9a9fab", "#d3d6dd"], "attachments": ["#f2f4f7", "#c1c5cc"]},
                        {"key": "brick_fate_brass", "label": "黄铜", "weight": 1, "allow_premium": False, "allow_exquisite": True, "effects": ["fate_glow"], "body": ["#c79a4a", "#efd8a1"], "attachments": ["#f7e2b8", "#d6a255"]},
                        {"key": "brick_fate_gold", "label": "黄金", "weight": 1, "allow_premium": False, "allow_exquisite": True, "effects": ["fate_glow"], "body": ["#f2ca62", "#fff0b3"], "attachments": ["#ffeccd", "#f9c755"]},
                        {"key": "brick_fate_jade", "label": "翡翠绿", "weight": 1, "allow_premium": False, "allow_exquisite": True, "effects": ["fate_glow"], "body": ["#3bbd89", "#b6f2d6"], "attachments": ["#e5fff4", "#7ad7ae"]},
                        {"key": "brick_fate_whitepeach", "label": "白桃", "weight": 1, "allow_premium": False, "allow_exquisite": True, "effects": ["fate_glow"], "body": ["#ffd9d9", "#fff3f3"], "attachments": ["#fffaf6", "#ffc9c9"]},
                        {"key": "brick_fate_gradient", "label": "命运渐变", "weight": 5, "allow_premium": True, "allow_exquisite": True, "effects": ["fate_gradient"], "body": ["#f1e2c6", "#e5c797"], "attachments": ["#f4dba6", "#fff1ce"]},
                        {"key": "brick_fate_default", "label": "命运经典", "weight": 84, "allow_premium": True, "allow_exquisite": True, "effects": ["fate_glow"], "body": ["#d6cdb7", "#f0e6d2"], "attachments": ["#dcb67a", "#f5d99a"]}
                    ],
                    "extra_effects": {
                        "premium": ["sheen"],
                        "exquisite": ["sheen", "sparkle"]
                    }
                }
            },
            {
                "skin_id": "BRK_QBZ95_ROYALBLADE",
                "name": "QBZ95-1突击步枪-王牌之剑",
                "weapon": "QBZ95-1突击步枪",
                "rarity": "BRICK",
                "model_key": "bullpup",
                "meta": {
                    "description": "扑克魔术主题的东方风格，牌面切割纹在机匣闪耀。",
                    "tracer": "扑克幻影曳光",
                    "body_colors": [["#f5e9df", "#ffffff"]],
                    "attachment_colors": [["#c53a4b", "#f7b35f"]],
                    "template_rules": [
                        {"key": "brick_blade_royal", "label": "王牌镶嵌", "weight": 100, "allow_premium": True, "allow_exquisite": True, "effects": ["blade_glow"], "body": ["#f7efe6", "#ffffff"], "attachments": ["#c94c4c", "#f6c77a"]}
                    ],
                    "extra_effects": {
                        "premium": ["sheen"],
                        "exquisite": ["sheen", "sparkle"]
                    }
                }
            }
        ],
        "purples": [
            {
                "skin_id": "EPI_DEAGLE_TAROT",
                "name": "沙漠之鹰-塔罗",
                "weapon": "沙漠之鹰手枪",
                "rarity": "PURPLE",
                "model_key": "battle",
                "meta": {
                    "description": "塔罗牌镶嵌在滑套上，随着检视翻转不同牌面。",
                    "body_colors": [["#f0e1ca", "#d4b98c"]],
                    "attachment_colors": [["#7a4a2f", "#d7a45a"]],
                    "effects": {"premium": ["sheen"], "exquisite": ["sheen", "glow"]}
                }
            }
        ],
        "blues": [
            {
                "skin_id": "RAR_MPX_CARDTRICK",
                "name": "MPX冲锋枪-纸牌戏法",
                "weapon": "SIG MPX",
                "rarity": "BLUE",
                "model_key": "vector",
                "meta": {
                    "description": "俏皮的黑红扑克牌花色覆满机匣。",
                    "body_colors": [["#2b2b2b", "#c43c3c"]],
                    "attachment_colors": [["#f2f2f2", "#111111"]]
                }
            }
        ],
        "greens": [
            {
                "skin_id": "UNC_FAMAS_GILDED",
                "name": "FAMAS突击步枪-镀金边",
                "weapon": "FAMAS突击步枪",
                "rarity": "GREEN",
                "model_key": "bullpup",
                "meta": {
                    "description": "基础白瓷色辅以金边点缀，低调而神秘。",
                    "body_colors": [["#f8f4f0"]],
                    "attachment_colors": [["#bfa569"]]
                }
            }
        ]
    },
    {
        "id": "S5",
        "name": "S5 气象感应",
        "tagline": "气象感应",
        "description": "第五赛季以气象四象为核心，枪支根据天气主题改变外观与曳光。",
        "bricks": [
            {
                "skin_id": "BRK_TENGLONG_WEATHER",
                "name": "腾龙突击步枪-气象感应",
                "weapon": "腾龙突击步枪",
                "rarity": "BRICK",
                "model_key": "futuristic",
                "meta": {
                    "description": "四种天气形态与动态曳光，龙鳞导轨感应温度。",
                    "tracer": "气象脉冲曳光",
                    "body_colors": [["#1f2c4f", "#45a0ff"], ["#3c2e55", "#ff7f4f"], ["#1a3c31", "#39ffb0"], ["#2b294f", "#b18cff"]],
                    "attachment_colors": [["#7dd0ff", "#1f79ff"], ["#ffd27d", "#ff924f"], ["#b1ffe7", "#38ff9f"], ["#d0afff", "#7549ff"]],
                    "template_rules": [
                        {"key": "brick_weather_gundam", "label": "高达气象", "weight": 1, "allow_premium": False, "allow_exquisite": True, "effects": ["weather_glow"], "body": ["#ffffff", "#3d6bff"], "attachments": ["#ffcc00", "#ff3535"]},
                        {"key": "brick_weather_clathrate", "label": "可燃冰", "weight": 1, "allow_premium": False, "allow_exquisite": True, "effects": ["weather_frost"], "body": ["#b5f4ff", "#f8ffff"], "attachments": ["#6fdfff", "#d3f9ff"]},
                        {"key": "brick_weather_redbolt", "label": "红电", "weight": 1, "allow_premium": False, "allow_exquisite": True, "effects": ["weather_bolt"], "body": ["#2b1a34", "#ff5b5b"], "attachments": ["#ffca6a", "#ff8340"]},
                        {"key": "brick_weather_purplebolt", "label": "紫电", "weight": 1, "allow_premium": False, "allow_exquisite": True, "effects": ["weather_bolt"], "body": ["#281a4f", "#a064ff"], "attachments": ["#cfa8ff", "#5f38ff"]},
                        {"key": "brick_weather_gradient", "label": "气象渐变", "weight": 5, "allow_premium": True, "allow_exquisite": True, "effects": ["weather_gradient"], "body": ["#2f4d7a", "#5ec1ff"], "attachments": ["#5bf0ff", "#ffe76c"]},
                        {"key": "brick_weather_default", "label": "气象标准", "weight": 91, "allow_premium": True, "allow_exquisite": True, "effects": ["weather_glow"], "body": ["#25355c", "#4aa7ff"], "attachments": ["#6be0ff", "#ffe980"]}
                    ],
                    "extra_effects": {
                        "premium": ["sheen", "trail"],
                        "exquisite": ["sheen", "trail", "sparkle"]
                    }
                }
            },
            {
                "skin_id": "BRK_AUG_WEATHER",
                "name": "AUG突击步枪-气象感应",
                "weapon": "AUG突击步枪",
                "rarity": "BRICK",
                "model_key": "bullpup",
                "meta": {
                    "description": "AUG机体搭载气象换肤模块，随天气变换光效。",
                    "tracer": "天气折射曳光",
                    "body_colors": [["#243656", "#4f86ff"], ["#3c2f5f", "#ff9966"], ["#193f33", "#45ffbc"], ["#302a57", "#c79dff"]],
                    "attachment_colors": [["#70c5ff", "#2a6dff"], ["#ffc771", "#ff7a45"], ["#a9ffe3", "#36ff98"], ["#d4b0ff", "#6f48ff"]],
                    "template_rules": [
                        {"key": "brick_weather_gradient", "label": "气象渐变", "weight": 5, "allow_premium": True, "allow_exquisite": True, "effects": ["weather_gradient"], "body": ["#2f4d7a", "#5ec1ff"], "attachments": ["#5bf0ff", "#ffe76c"]},
                        {"key": "brick_weather_default", "label": "气象标准", "weight": 95, "allow_premium": True, "allow_exquisite": True, "effects": ["weather_glow"], "body": ["#2a3960", "#4f8dff"], "attachments": ["#6fe1ff", "#ffd261"]}
                    ],
                    "extra_effects": {
                        "premium": ["sheen", "trail"],
                        "exquisite": ["sheen", "trail", "sparkle"]
                    }
                }
            }
        ],
        "purples": [
            {
                "skin_id": "EPI_VECTOR_STORM",
                "name": "Vector冲锋枪-风暴核心",
                "weapon": "Vector冲锋枪",
                "rarity": "PURPLE",
                "model_key": "vector",
                "meta": {
                    "description": "动态雷暴纹路覆盖枪身，顶端有风速指示。",
                    "body_colors": [["#1f2f4f", "#5bb4ff"]],
                    "attachment_colors": [["#f7f9ff", "#ffde73"]],
                    "effects": {"premium": ["sheen"], "exquisite": ["sheen", "trail"]}
                }
            }
        ],
        "blues": [
            {
                "skin_id": "RAR_QBU88_RAINFALL",
                "name": "QBU-88精确步枪-细雨",
                "weapon": "QBU-88精确步枪",
                "rarity": "BLUE",
                "model_key": "bullpup",
                "meta": {
                    "description": "雨滴纹理与灰蓝色调形成柔和层次。",
                    "body_colors": [["#1f2d3f", "#4f6f90"]],
                    "attachment_colors": [["#dbe6f5", "#96b4d6"]]
                }
            }
        ],
        "greens": [
            {
                "skin_id": "UNC_FAL_SUNBURST",
                "name": "FAL战斗步枪-晨曦",
                "weapon": "FN FAL",
                "rarity": "GREEN",
                "model_key": "battle",
                "meta": {
                    "description": "暖橙渐变仿佛清晨日照。",
                    "body_colors": [["#f8c26a", "#fbe7b1"]],
                    "attachment_colors": [["#f5dec1"]]
                }
            }
        ]
    },
    {
        "id": "S6",
        "name": "S6 棱镜攻势2",
        "tagline": "棱镜攻势2",
        "description": "第六赛季延续棱镜主题，但以更具机械线条感的M7战斗步枪为主角。",
        "bricks": [
            {
                "skin_id": "BRK_M7_PRISM2",
                "name": "M7战斗步枪-棱镜攻势2",
                "weapon": "M7战斗步枪",
                "rarity": "BRICK",
                "model_key": "assault",
                "meta": {
                    "description": "升级的棱镜光学系统，带来更加集中而炫目的折射光束。",
                    "tracer": "折射棱镜曳光",
                    "body_colors": [["#5e7bff", "#9cc4ff"], ["#ff75d8", "#ffe9ff"]],
                    "attachment_colors": [["#ffe58a", "#ffffff"], ["#9effff", "#ffffff"]],
                    "template_rules": [
                        {"key": "brick_prism2_flux", "label": "棱镜攻势2", "weight": 100, "allow_premium": True, "allow_exquisite": True, "effects": ["prism_flux"], "body": ["#6f8dff", "#b6d4ff"], "attachments": ["#ffd778", "#ffffff"]}
                    ],
                    "extra_effects": {
                        "premium": ["sheen", "refraction"],
                        "exquisite": ["sheen", "refraction", "sparkle"]
                    }
                }
            }
        ],
        "purples": [
            {
                "skin_id": "EPI_AUG_DESTINY",
                "name": "AUG突击步枪-天命",
                "weapon": "AUG突击步枪",
                "rarity": "PURPLE",
                "model_key": "bullpup",
                "meta": {
                    "description": "金属质感与天命纹章结合的现代风格。",
                    "body_colors": [["#d5c6a8", "#f0e4cc"]],
                    "attachment_colors": [["#9a7646", "#f2d18a"]],
                    "effects": {"premium": ["sheen"], "exquisite": ["sheen", "sparkle"]}
                }
            }
        ],
        "blues": [
            {
                "skin_id": "RAR_PTR32_GRANITE",
                "name": "PTR-32突击步枪-花岗岩",
                "weapon": "PTR-32突击步枪",
                "rarity": "BLUE",
                "model_key": "battle",
                "meta": {
                    "description": "坚实花岗岩纹路彰显沉稳力量。",
                    "body_colors": [["#3f3f46", "#686873"]],
                    "attachment_colors": [["#b5b5c2", "#89899a"]]
                }
            }
        ],
        "greens": [
            {
                "skin_id": "UNC_ASVAL_BEAST",
                "name": "AS Val突击步枪-猛兽",
                "weapon": "AS Val突击步枪",
                "rarity": "GREEN",
                "model_key": "assault",
                "meta": {
                    "description": "粗犷机械纹理配以荧绿色野性涂装。",
                    "body_colors": [["#4a5d3a"]],
                    "attachment_colors": [["#9bd964"]]
                }
            }
        ]
    }
]
