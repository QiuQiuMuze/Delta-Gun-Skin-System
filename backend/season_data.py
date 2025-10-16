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
                    "description": "采用通体透明的枪身，内部构造一目了然并带有磨砂质感，搭配帅气的曳光弹，色彩随机涵盖蓝红、紫黄、炽橙、白镶金、荧光粉与耀眼蓝等组合，覆盖所有配件，无论如何搭配都能呈现完美状态。没有特殊模板，极品特效比优品多 2 个。",
                    "tracer": "棱镜随机曳光",
                    "body_colors": [
                        ["#4a6dff", "#ff4a57"],
                        ["#7e3cff", "#ffd95f"],
                        ["#ff7b32", "#ffc46a"],
                        ["#ffffff", "#f5e9c8"],
                        ["#ff6ad6", "#ffe5f7"],
                        ["#3d9dff", "#c8f2ff"]
                    ],
                    "attachment_colors": [
                        ["#ffd166", "#ffeab0"],
                        ["#82e7ff", "#f1fcff"],
                        ["#f8ff84", "#fffbd6"],
                        ["#f7ebd6", "#ffe9a3"],
                        ["#ffb4ec", "#fff1fa"],
                        ["#73b6ff", "#e4f3ff"]
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
                        "premium": ["sheen"],
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
            },
            {
                "skin_id": "EPI_MCX_LIGHTWAVE",
                "name": "MCX突击步枪-光波",
                "weapon": "MCX突击步枪",
                "rarity": "PURPLE",
                "model_key": "assault",
                "meta": {
                    "description": "半透明护木中流淌律动光束，机匣边缘勾勒虹彩折线。",
                    "body_colors": [["#7fc7ff", "#335bff"]],
                    "attachment_colors": [["#ffe5ff", "#9ec9ff"]],
                    "effects": {"premium": ["sheen"], "exquisite": ["sheen", "refraction"]}
                }
            },
            {
                "skin_id": "EPI_M249_GLASSBURST",
                "name": "M249机枪-碎光爆裂",
                "weapon": "M249轻机枪",
                "rarity": "PURPLE",
                "model_key": "battle",
                "meta": {
                    "description": "棱镜碎片覆盖弹链护罩，射击时反射多色光束。",
                    "body_colors": [["#6da0ff", "#c9ddff"]],
                    "attachment_colors": [["#ffe3a6", "#ffd6ff"]],
                    "effects": {"premium": ["sheen"], "exquisite": ["sheen", "sparkle", "prism_flux"]}
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
            },
            {
                "skin_id": "RAR_VECTOR_NEONTRACE",
                "name": "Vector冲锋枪-霓虹轨迹",
                "weapon": "Vector冲锋枪",
                "rarity": "BLUE",
                "model_key": "vector",
                "meta": {
                    "description": "贯穿枪身的霓虹轨道在透明外壳内回环。",
                    "body_colors": [["#1f2c5b", "#586dff"]],
                    "attachment_colors": [["#8bffec", "#f3f6ff"]]
                }
            },
            {
                "skin_id": "RAR_G36C_SPECTRAL",
                "name": "G36C突击步枪-光谱",
                "weapon": "G36C突击步枪",
                "rarity": "BLUE",
                "model_key": "assault",
                "meta": {
                    "description": "透明护木内嵌光谱条，触发检视时逐段点亮。",
                    "body_colors": [["#3550a8", "#94b3ff"]],
                    "attachment_colors": [["#f0f6ff", "#b3cfff"]]
                }
            },
            {
                "skin_id": "RAR_AK12_CLEARSKY",
                "name": "AK-12突击步枪-晴空",
                "weapon": "AK-12突击步枪",
                "rarity": "BLUE",
                "model_key": "assault",
                "meta": {
                    "description": "浅蓝透明枪身映出晴空云影，握把镶嵌银色导流线。",
                    "body_colors": [["#7bbcff", "#d8ecff"]],
                    "attachment_colors": [["#f5fbff", "#a6c8ff"]]
                }
            },
            {
                "skin_id": "RAR_USP_RIBBONLIGHT",
                "name": "USP手枪-光带",
                "weapon": "USP手枪",
                "rarity": "BLUE",
                "model_key": "vector",
                "meta": {
                    "description": "滑套两侧束起蓝紫渐变光带，枪口泛出柔和辉光。",
                    "body_colors": [["#404b8c", "#9ea8ff"]],
                    "attachment_colors": [["#f0f4ff", "#b7c8ff"]]
                }
            },
            {
                "skin_id": "RAR_SKS_HOLOGRID",
                "name": "SKS半自动步枪-幻格",
                "weapon": "SKS半自动步枪",
                "rarity": "BLUE",
                "model_key": "battle",
                "meta": {
                    "description": "枪托内嵌幻彩网格，移动时映射虚拟HUD。",
                    "body_colors": [["#273a6f", "#5e7bff"]],
                    "attachment_colors": [["#9ad4ff", "#f3f7ff"]]
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
            },
            {
                "skin_id": "UNC_GALIL_SKYGLASS",
                "name": "Galil突击步枪-天玻",
                "weapon": "Galil突击步枪",
                "rarity": "GREEN",
                "model_key": "assault",
                "meta": {
                    "description": "枪身涂以浅蓝透明涂层，细节加入银色筋骨。",
                    "body_colors": [["#86c7ff"]],
                    "attachment_colors": [["#e8f4ff"]]
                }
            },
            {
                "skin_id": "UNC_MP5_ARCLINE",
                "name": "MP5冲锋枪-弧光",
                "weapon": "MP5冲锋枪",
                "rarity": "GREEN",
                "model_key": "vector",
                "meta": {
                    "description": "透明护手勾勒弧形光线，枪托添加磨砂质感。",
                    "body_colors": [["#8ad8ff"]],
                    "attachment_colors": [["#eff9ff"]]
                }
            },
            {
                "skin_id": "UNC_P90_GLINT",
                "name": "P90冲锋枪-微光",
                "weapon": "P90冲锋枪",
                "rarity": "GREEN",
                "model_key": "vector",
                "meta": {
                    "description": "光滑透明机匣内嵌淡紫粒子，检视时缓缓流动。",
                    "body_colors": [["#b1e1ff"]],
                    "attachment_colors": [["#f8fcff"]]
                }
            },
            {
                "skin_id": "UNC_MK18_AERIAL",
                "name": "MK18突击步枪-凌空",
                "weapon": "MK18突击步枪",
                "rarity": "GREEN",
                "model_key": "assault",
                "meta": {
                    "description": "护木镂空配合透明侧板，营造轻盈凌空质感。",
                    "body_colors": [["#9fd3ff"]],
                    "attachment_colors": [["#f3f9ff"]]
                }
            },
            {
                "skin_id": "UNC_QBZ_LUMIN",
                "name": "QBZ95-1突击步枪-流辉",
                "weapon": "QBZ95-1突击步枪",
                "rarity": "GREEN",
                "model_key": "bullpup",
                "meta": {
                    "description": "透明外壳与流光装饰条相结合，凸显未来质感。",
                    "body_colors": [["#8fd4ff"]],
                    "attachment_colors": [["#edf6ff"]]
                }
            },
            {
                "skin_id": "UNC_M9_LUCENT",
                "name": "M9手枪-莹辉",
                "weapon": "M9手枪",
                "rarity": "GREEN",
                "model_key": "vector",
                "meta": {
                    "description": "握把嵌入浅蓝透明材质，滑套点缀微量虹彩粉末。",
                    "body_colors": [["#a3dcff"]],
                    "attachment_colors": [["#f9fdff"]]
                }
            },
            {
                "skin_id": "UNC_P226_SHEER",
                "name": "P226手枪-薄纱",
                "weapon": "P226手枪",
                "rarity": "GREEN",
                "model_key": "vector",
                "meta": {
                    "description": "半透明滑套搭配银色触发器，轻盈却不失质感。",
                    "body_colors": [["#bfe5ff"]],
                    "attachment_colors": [["#f6fbff"]]
                }
            },
            {
                "skin_id": "UNC_AK74_GLACIER",
                "name": "AK-74突击步枪-冰晶",
                "weapon": "AK-74突击步枪",
                "rarity": "GREEN",
                "model_key": "assault",
                "meta": {
                    "description": "透明护木勾勒冰晶纹理，枪口罩呈现白蓝渐层。",
                    "body_colors": [["#a6dfff"]],
                    "attachment_colors": [["#f0f8ff"]]
                }
            },
            {
                "skin_id": "UNC_SG552_CRYSTAL",
                "name": "SG552突击步枪-晶彩",
                "weapon": "SG552突击步枪",
                "rarity": "GREEN",
                "model_key": "assault",
                "meta": {
                    "description": "导轨镶嵌晶体条纹，透明弹匣显露蓝色弹药。",
                    "body_colors": [["#98ccff"]],
                    "attachment_colors": [["#eef6ff"]]
                }
            },
            {
                "skin_id": "UNC_TAVOR_BEAM",
                "name": "Tavor突击步枪-束光",
                "weapon": "Tavor突击步枪",
                "rarity": "GREEN",
                "model_key": "bullpup",
                "meta": {
                    "description": "贯穿枪身的束光线条让整体更具速度感。",
                    "body_colors": [["#89d2ff"]],
                    "attachment_colors": [["#f2f9ff"]]
                }
            },
            {
                "skin_id": "UNC_MP9_CASCADE",
                "name": "MP9冲锋枪-水幕",
                "weapon": "MP9冲锋枪",
                "rarity": "GREEN",
                "model_key": "vector",
                "meta": {
                    "description": "侧板呈现流动水幕纹理，握把保留透明材质。",
                    "body_colors": [["#9cdfff"]],
                    "attachment_colors": [["#f3faff"]]
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
                    "description": "以希腊神话美杜莎为原型，枪身仿佛出土文物，遍布蟒纹、浮雕与盘绕灵蛇，宝石质感熠熠生辉，击中目标时喷薄彩色火焰特效。没有特殊模板，极品外观比优品更丰满。",
                    "tracer": "彩焰蛇瞳曳光",
                    "body_colors": [
                        ["#2f2a38", "#5e725f"],
                        ["#3d2f2f", "#8a6c4b"],
                        ["#2a3731", "#5f8a6f"]
                    ],
                    "attachment_colors": [
                        ["#d9f067", "#9bc49f"],
                        ["#c8b07c", "#8f7a4f"],
                        ["#9bcfb2", "#567962"]
                    ],
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
                        "premium": ["sheen"],
                        "exquisite": ["sheen", "trail", "chromatic_flame"]
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
            },
            {
                "skin_id": "EPI_P90_VENOMCOIL",
                "name": "P90冲锋枪-剧毒缠绕",
                "weapon": "P90冲锋枪",
                "rarity": "PURPLE",
                "model_key": "vector",
                "meta": {
                    "description": "蛇形能量脉络盘绕透明弹匣，发射时吐息翠绿雾气。",
                    "body_colors": [["#2a3224", "#5a7f46"]],
                    "attachment_colors": [["#c5d982", "#4a5d3a"]],
                    "effects": {"premium": ["sheen"], "exquisite": ["sheen", "medusa_glare"]}
                }
            },
            {
                "skin_id": "EPI_AK47_SERPENTGOLD",
                "name": "AK-47突击步枪-蛇纹金",
                "weapon": "AK-47突击步枪",
                "rarity": "PURPLE",
                "model_key": "assault",
                "meta": {
                    "description": "金色蛇鳞环绕机匣，中段镶嵌绿松石眼睛。",
                    "body_colors": [["#4b3d2c", "#8d6a2e"]],
                    "attachment_colors": [["#d9b15c", "#3d4c33"]],
                    "effects": {"premium": ["sheen"], "exquisite": ["sheen", "sparkle"]}
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
            },
            {
                "skin_id": "RAR_AUG_TEMPESTSTONE",
                "name": "AUG突击步枪-风暴石",
                "weapon": "AUG突击步枪",
                "rarity": "BLUE",
                "model_key": "bullpup",
                "meta": {
                    "description": "蛇纹石板嵌入枪身，边缘刻有风暴符文。",
                    "body_colors": [["#3a4234", "#5f7252"]],
                    "attachment_colors": [["#c7d286", "#766244"]]
                }
            },
            {
                "skin_id": "RAR_M4_SHADOWSCALE",
                "name": "M4A1突击步枪-影鳞",
                "weapon": "M4A1突击步枪",
                "rarity": "BLUE",
                "model_key": "assault",
                "meta": {
                    "description": "深色鳞片在侧板交错，细节镶嵌青铜蛇纹。",
                    "body_colors": [["#2b2e26", "#4e5a41"]],
                    "attachment_colors": [["#a8bc74", "#3b4a30"]]
                }
            },
            {
                "skin_id": "RAR_SVD_ORACLE",
                "name": "SVD狙击步枪-神谕",
                "weapon": "SVD狙击步枪",
                "rarity": "BLUE",
                "model_key": "battle",
                "meta": {
                    "description": "蛇眼图腾遍布木质枪身，搭配墨绿色金属。",
                    "body_colors": [["#3d3a2d", "#6a7751"]],
                    "attachment_colors": [["#c5d990", "#4e5c3a"]]
                }
            },
            {
                "skin_id": "RAR_PP19_MOLTENSCALE",
                "name": "PP-19冲锋枪-熔鳞",
                "weapon": "PP-19冲锋枪",
                "rarity": "BLUE",
                "model_key": "vector",
                "meta": {
                    "description": "熔岩色蛇纹沿弹鼓环绕，尾部点缀铜绿。",
                    "body_colors": [["#3d2b24", "#964c33"]],
                    "attachment_colors": [["#d48f58", "#4b3a29"]]
                }
            },
            {
                "skin_id": "RAR_FIVESEVEN_MYTHBITE",
                "name": "Five-SeveN手枪-神话之噬",
                "weapon": "Five-SeveN手枪",
                "rarity": "BLUE",
                "model_key": "vector",
                "meta": {
                    "description": "蛇形纹章镶嵌在滑套两侧，握把包覆石灰质蛇鳞。",
                    "body_colors": [["#3b352b", "#6f6a50"]],
                    "attachment_colors": [["#c6c08f", "#4e4836"]]
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
            },
            {
                "skin_id": "UNC_MOSIN_PETRIFY",
                "name": "莫辛纳甘步枪-石化",
                "weapon": "莫辛纳甘步枪",
                "rarity": "GREEN",
                "model_key": "battle",
                "meta": {
                    "description": "枪托覆以灰绿色石纹，仿佛被蛇神凝视后石化。",
                    "body_colors": [["#5f6b52"]],
                    "attachment_colors": [["#c0c89a"]]
                }
            },
            {
                "skin_id": "UNC_UZI_RELIC",
                "name": "UZI冲锋枪-遗痕",
                "weapon": "UZI冲锋枪",
                "rarity": "GREEN",
                "model_key": "vector",
                "meta": {
                    "description": "机匣刻有蛇纹浮雕，局部覆盖铜绿锈斑。",
                    "body_colors": [["#4b503a"]],
                    "attachment_colors": [["#b3b87a"]]
                }
            },
            {
                "skin_id": "UNC_QBU_STALK",
                "name": "QBU-88精确步枪-藤蔓",
                "weapon": "QBU-88精确步枪",
                "rarity": "GREEN",
                "model_key": "bullpup",
                "meta": {
                    "description": "绿色藤蔓缠绕在枪身侧面，点缀泥土色纹理。",
                    "body_colors": [["#536040"]],
                    "attachment_colors": [["#c5d897"]]
                }
            },
            {
                "skin_id": "UNC_M590_FANG",
                "name": "M590霰弹枪-蛇牙",
                "weapon": "M590霰弹枪",
                "rarity": "GREEN",
                "model_key": "battle",
                "meta": {
                    "description": "护木前端镶入白色蛇牙装饰，枪托覆以鳞片纹。",
                    "body_colors": [["#4e5038"]],
                    "attachment_colors": [["#d4c890"]]
                }
            },
            {
                "skin_id": "UNC_DEAGLE_RATTLESAND",
                "name": "沙漠之鹰-响尾沙",
                "weapon": "沙漠之鹰手枪",
                "rarity": "GREEN",
                "model_key": "vector",
                "meta": {
                    "description": "沙黄色蛇鳞与绿锈结合，握把缠绕蛇尾纹。",
                    "body_colors": [["#bca86f"]],
                    "attachment_colors": [["#413b2b"]]
                }
            },
            {
                "skin_id": "UNC_MP153_SCALEWOOD",
                "name": "MP-153霰弹枪-鳞木",
                "weapon": "MP-153霰弹枪",
                "rarity": "GREEN",
                "model_key": "battle",
                "meta": {
                    "description": "木制枪托以蛇鳞纹路打磨，触感粗犷。",
                    "body_colors": [["#6b5a3b"]],
                    "attachment_colors": [["#c7b37f"]]
                }
            },
            {
                "skin_id": "UNC_PKM_ORB",
                "name": "PKM机枪-蛇瞳",
                "weapon": "PKM机枪",
                "rarity": "GREEN",
                "model_key": "battle",
                "meta": {
                    "description": "弹链盒绘有蛇瞳纹章，金属表面泛起暗绿光泽。",
                    "body_colors": [["#3e432f"]],
                    "attachment_colors": [["#b2c47a"]]
                }
            },
            {
                "skin_id": "UNC_RUGER_SERPENTSKETCH",
                "name": "Ruger手枪-蛇影素描",
                "weapon": "Ruger手枪",
                "rarity": "GREEN",
                "model_key": "vector",
                "meta": {
                    "description": "浅绿色底纹上描绘蛇影线稿，质感轻盈。",
                    "body_colors": [["#a6c889"]],
                    "attachment_colors": [["#f1f5d4"]]
                }
            },
            {
                "skin_id": "UNC_KRISS_SWAMP",
                "name": "KRISS冲锋枪-沼泽",
                "weapon": "KRISS冲锋枪",
                "rarity": "GREEN",
                "model_key": "vector",
                "meta": {
                    "description": "沼泽绿渐变覆盖枪身，局部刻画蛇鳞阴影。",
                    "body_colors": [["#465c3a"]],
                    "attachment_colors": [["#c2d097"]]
                }
            },
            {
                "skin_id": "UNC_M1911_MYTH",
                "name": "M1911手枪-神话余晖",
                "weapon": "M1911手枪",
                "rarity": "GREEN",
                "model_key": "vector",
                "meta": {
                    "description": "枪身雕刻蛇神符号，配色以棕绿磨损为主。",
                    "body_colors": [["#635840"]],
                    "attachment_colors": [["#d4c08c"]]
                }
            },
            {
                "skin_id": "UNC_FAL_VINEEDGE",
                "name": "FAL战斗步枪-藤缘",
                "weapon": "FN FAL",
                "rarity": "GREEN",
                "model_key": "battle",
                "meta": {
                    "description": "枪托镶有藤蔓边饰，金属部分偏向暗铜色。",
                    "body_colors": [["#554a34"]],
                    "attachment_colors": [["#c7b279"]]
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
                "name": "SCAR-H战斗步枪-电玩高手[__LINK_ICON]",
                "weapon": "SCAR-H战斗步枪",
                "rarity": "BRICK",
                "model_key": "battle",
                "meta": {
                    "description": "枪身融入手把按键、散热风扇与USB接口等电玩细节，RGB效果随不同主题改变，还附带专属检视动作与内置小游戏，每一次扣动扳机都有彩光绚烂、随机字母跳动的专属开火效果。只有极品会出现特殊模板，模板不同但特效一致。",
                    "tracer": "霓虹像素曳光",
                    "body_colors": [["#302743", "#704bff"]],
                    "attachment_colors": [["#00f0ff", "#ff00d4"]],
                    "template_rules": [
                        {"key": "brick_arcade_crystal", "label": "水晶贪吃蛇", "weight": 1, "allow_premium": False, "allow_exquisite": True, "effects": ["arcade_glass"], "body": ["#7d4bff", "#4010b8"], "attachments": ["#5bffff", "#e8f9ff"]},
                        {"key": "brick_arcade_serpent", "label": "贪吃蛇", "weight": 5, "allow_premium": False, "allow_exquisite": True, "effects": ["arcade_trail"], "body": ["#532bff", "#150050"], "attachments": ["#00ffbf", "#80ffe3"]},
                        {"key": "brick_arcade_blackhawk", "label": "黑鹰坠落", "weight": 5, "allow_premium": False, "allow_exquisite": True, "effects": ["arcade_glow"], "body": ["#161921", "#2f4f7a"], "attachments": ["#ff004c", "#f8f8f8"]},
                        {"key": "brick_arcade_champion", "label": "拳王", "weight": 5, "allow_premium": False, "allow_exquisite": True, "effects": ["arcade_pulse"], "body": ["#4c1f1f", "#ff0040"], "attachments": ["#ffd800", "#ffe8a0"]},
                        {"key": "brick_arcade_default", "label": "普通模板", "weight": 84, "allow_premium": True, "allow_exquisite": True, "effects": ["arcade_core"], "body": ["#2d2552", "#6f49ff"], "attachments": ["#00f6ff", "#ff5af1"]}
                    ],
                    "extra_effects": {
                        "premium": ["sheen", "trail", "arcade_core"],
                        "exquisite": ["sheen", "trail", "arcade_core"]
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
            },
            {
                "skin_id": "EPI_P90_PIXELSTORM",
                "name": "P90冲锋枪-像素风暴",
                "weapon": "P90冲锋枪",
                "rarity": "PURPLE",
                "model_key": "vector",
                "meta": {
                    "description": "机匣显示像素风暴动画，弹匣透明可见流动灯带。",
                    "body_colors": [["#2d1f48", "#ff46ab"]],
                    "attachment_colors": [["#33f0ff", "#ffe45c"]],
                    "effects": {"premium": ["sheen"], "exquisite": ["sheen", "arcade_glow"]}
                }
            },
            {
                "skin_id": "EPI_AK117_SYNTHWAVE",
                "name": "AK117突击步枪-合成波",
                "weapon": "AK117突击步枪",
                "rarity": "PURPLE",
                "model_key": "assault",
                "meta": {
                    "description": "霓虹紫与青色交织的合成波主题，机匣嵌入音频可视化。",
                    "body_colors": [["#2c2455", "#9a4dff"]],
                    "attachment_colors": [["#28fff3", "#ffe48f"]],
                    "effects": {"premium": ["sheen"], "exquisite": ["sheen", "sparkle", "arcade_trail"]}
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
            },
            {
                "skin_id": "RAR_MP9_COINRUSH",
                "name": "MP9冲锋枪-金币冲线",
                "weapon": "MP9冲锋枪",
                "rarity": "BLUE",
                "model_key": "vector",
                "meta": {
                    "description": "机匣滚动金币积分动画，握把镶嵌透明LED板。",
                    "body_colors": [["#1f2340", "#ff9f1c"]],
                    "attachment_colors": [["#47f6ff", "#ffe66d"]]
                }
            },
            {
                "skin_id": "RAR_GALIL_NEONFRAME",
                "name": "Galil突击步枪-霓虹框",
                "weapon": "Galil突击步枪",
                "rarity": "BLUE",
                "model_key": "assault",
                "meta": {
                    "description": "霓虹灯条勾勒枪身轮廓，透明窗口显示芯片纹路。",
                    "body_colors": [["#281f4b", "#6f4bff"]],
                    "attachment_colors": [["#3af5ff", "#ffe976"]]
                }
            },
            {
                "skin_id": "RAR_FAMAS_ARCADEGRID",
                "name": "FAMAS突击步枪-街机格",
                "weapon": "FAMAS突击步枪",
                "rarity": "BLUE",
                "model_key": "bullpup",
                "meta": {
                    "description": "黑底格栅配合彩色像素点，呈现经典街机界面。",
                    "body_colors": [["#231b38", "#4d3bff"]],
                    "attachment_colors": [["#52f0ff", "#fdfd74"]]
                }
            },
            {
                "skin_id": "RAR_USP_SCOREFLASH",
                "name": "USP手枪-得分闪光",
                "weapon": "USP手枪",
                "rarity": "BLUE",
                "model_key": "vector",
                "meta": {
                    "description": "滑套上滚动显示连杀得分，尾部加装发光计分牌。",
                    "body_colors": [["#221c43", "#ff5dba"]],
                    "attachment_colors": [["#3df2ff", "#ffe36d"]]
                }
            },
            {
                "skin_id": "RAR_M700_GLOWLINE",
                "name": "M700狙击步枪-光线",
                "weapon": "M700狙击步枪",
                "rarity": "BLUE",
                "model_key": "battle",
                "meta": {
                    "description": "枪托嵌入呼吸光线条，瞄镜侧装饰像素箭头。",
                    "body_colors": [["#191f3a", "#3f5bff"]],
                    "attachment_colors": [["#54f1ff", "#f6f976"]]
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
            },
            {
                "skin_id": "UNC_GLOCK_PIXELLED",
                "name": "Glock手枪-像素灯",
                "weapon": "Glock手枪",
                "rarity": "GREEN",
                "model_key": "vector",
                "meta": {
                    "description": "滑套侧方嵌入像素灯阵，颜色随击发跳动。",
                    "body_colors": [["#414b7a"]],
                    "attachment_colors": [["#9dc7ff"]]
                }
            },
            {
                "skin_id": "UNC_P90_8BIT",
                "name": "P90冲锋枪-8位",
                "weapon": "P90冲锋枪",
                "rarity": "GREEN",
                "model_key": "vector",
                "meta": {
                    "description": "机匣表面印有经典8位像素字符。",
                    "body_colors": [["#48528f"]],
                    "attachment_colors": [["#b0c4ff"]]
                }
            },
            {
                "skin_id": "UNC_AK74_ARCADE",
                "name": "AK-74突击步枪-街机基础",
                "weapon": "AK-74突击步枪",
                "rarity": "GREEN",
                "model_key": "assault",
                "meta": {
                    "description": "基础黑蓝配色配以彩色按钮点缀。",
                    "body_colors": [["#303c70"]],
                    "attachment_colors": [["#ff8ac6"]]
                }
            },
            {
                "skin_id": "UNC_SCAR_LIGHTBAR",
                "name": "SCAR-H战斗步枪-灯条",
                "weapon": "SCAR-H战斗步枪",
                "rarity": "GREEN",
                "model_key": "battle",
                "meta": {
                    "description": "护木两侧安装简单光条，呈现科技感。",
                    "body_colors": [["#344169"]],
                    "attachment_colors": [["#a4c5ff"]]
                }
            },
            {
                "skin_id": "UNC_M870_SCORE",
                "name": "M870霰弹枪-积分",
                "weapon": "M870霰弹枪",
                "rarity": "GREEN",
                "model_key": "battle",
                "meta": {
                    "description": "枪托印有积分倍数，配色偏向蓝紫。",
                    "body_colors": [["#3a3360"]],
                    "attachment_colors": [["#c7b5ff"]]
                }
            },
            {
                "skin_id": "UNC_DEAGLE_TOKEN",
                "name": "沙漠之鹰-代币",
                "weapon": "沙漠之鹰手枪",
                "rarity": "GREEN",
                "model_key": "vector",
                "meta": {
                    "description": "滑套刻印街机代币与复古字样。",
                    "body_colors": [["#41346a"]],
                    "attachment_colors": [["#f4d35e"]]
                }
            },
            {
                "skin_id": "UNC_MP7_PIXELSTEP",
                "name": "MP7冲锋枪-像素踏步",
                "weapon": "MP7冲锋枪",
                "rarity": "GREEN",
                "model_key": "vector",
                "meta": {
                    "description": "侧板由像素阶梯构成，整体色调偏青。",
                    "body_colors": [["#3a4a7d"]],
                    "attachment_colors": [["#8fe0ff"]]
                }
            },
            {
                "skin_id": "UNC_M4_RETRO",
                "name": "M4A1突击步枪-复古屏",
                "weapon": "M4A1突击步枪",
                "rarity": "GREEN",
                "model_key": "assault",
                "meta": {
                    "description": "机匣侧面嵌入复古CRT风格屏幕贴图。",
                    "body_colors": [["#344573"]],
                    "attachment_colors": [["#a0baff"]]
                }
            },
            {
                "skin_id": "UNC_SIG_PULSE",
                "name": "SIG MCX-脉冲",
                "weapon": "MCX突击步枪",
                "rarity": "GREEN",
                "model_key": "assault",
                "meta": {
                    "description": "护木显示简单脉冲线条，颜色以青绿为主。",
                    "body_colors": [["#2f456c"]],
                    "attachment_colors": [["#7ddcda"]]
                }
            },
            {
                "skin_id": "UNC_PP19_TAPE",
                "name": "PP-19冲锋枪-磁带",
                "weapon": "PP-19冲锋枪",
                "rarity": "GREEN",
                "model_key": "vector",
                "meta": {
                    "description": "弹鼓印有混音磁带图案，配色偏复古粉蓝。",
                    "body_colors": [["#433767"]],
                    "attachment_colors": [["#d69be0"]]
                }
            },
            {
                "skin_id": "UNC_AK12_CHECKER",
                "name": "AK-12突击步枪-棋盘",
                "weapon": "AK-12突击步枪",
                "rarity": "GREEN",
                "model_key": "assault",
                "meta": {
                    "description": "枪托绘制紫蓝棋盘格，兼具街机风与稳重感。",
                    "body_colors": [["#3a3d66"]],
                    "attachment_colors": [["#a7b2ff"]]
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
                    "description": "全枪覆盖精致的浮雕花纹，玉石般的光彩在枪身流动，枪身中央绘有命运女神高悬权杖的图案，配有专属曳光弹与枪身光效。极品有 25% 概率在模板名称后追加“鬼头”刻字。",
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
                        {"key": "brick_fate_gradient", "label": "渐变（色彩随机）", "weight": 5, "allow_premium": True, "allow_exquisite": True, "effects": ["fate_gradient"], "body": ["#f1e2c6", "#e5c797"], "attachments": ["#f4dba6", "#fff1ce"]},
                        {"key": "brick_fate_default", "label": "正常模板", "weight": 87, "allow_premium": True, "allow_exquisite": True, "effects": ["fate_glow"], "body": ["#d6cdb7", "#f0e6d2"], "attachments": ["#dcb67a", "#f5d99a"]}
                    ],
                    "extra_effects": {
                        "premium": ["sheen", "fate_glow"],
                        "exquisite": ["sheen", "fate_glow", "bold_tracer", "sparkle"]
                    }
                }
            },
            {
                "skin_id": "BRK_QBZ95_ROYALBLADE",
                "name": "QBZ95-1突击步枪-王牌之剑[__LINK_ICON]",
                "weapon": "QBZ95-1突击步枪",
                "rarity": "BRICK",
                "model_key": "bullpup",
                "meta": {
                    "description": "以扑克魔术为主题的东方雅致设计，与“命运”皮肤相呼应，机匣上雕刻牌面切割纹路并散发柔和高光，官方未公开更多细节。",
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
            },
            {
                "skin_id": "EPI_M500_STARFORTUNE",
                "name": "M500霰弹枪-星命",
                "weapon": "M500霰弹枪",
                "rarity": "PURPLE",
                "model_key": "battle",
                "meta": {
                    "description": "金色星纹沿枪身延展，护木镶嵌闪亮宝石。",
                    "body_colors": [["#d7c2a0", "#f5e8cd"]],
                    "attachment_colors": [["#8c5b2f", "#f2cf71"]],
                    "effects": {"premium": ["sheen"], "exquisite": ["sheen", "sparkle"]}
                }
            },
            {
                "skin_id": "EPI_P90_RUBYDECK",
                "name": "P90冲锋枪-红宝牌",
                "weapon": "P90冲锋枪",
                "rarity": "PURPLE",
                "model_key": "vector",
                "meta": {
                    "description": "透明机匣内置红宝石牌面，检视时切换不同花色。",
                    "body_colors": [["#d94c53", "#f3b0a7"]],
                    "attachment_colors": [["#ffdca6", "#f4f0d8"]],
                    "effects": {"premium": ["sheen"], "exquisite": ["sheen", "sparkle", "fate_glow"]}
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
            },
            {
                "skin_id": "RAR_G36_PALACE",
                "name": "G36突击步枪-宫廷",
                "weapon": "G36突击步枪",
                "rarity": "BLUE",
                "model_key": "assault",
                "meta": {
                    "description": "深蓝底色配以金色花纹，突出宫廷纸牌美学。",
                    "body_colors": [["#2a2d4b", "#b09ad1"]],
                    "attachment_colors": [["#f4e6c2", "#744a2b"]]
                }
            },
            {
                "skin_id": "RAR_AK12_ROYALSPADE",
                "name": "AK-12突击步枪-皇家黑桃",
                "weapon": "AK-12突击步枪",
                "rarity": "BLUE",
                "model_key": "assault",
                "meta": {
                    "description": "黑桃符号沿机匣排列，辅以金色边框。",
                    "body_colors": [["#1f2238", "#7057a0"]],
                    "attachment_colors": [["#f5dc9a", "#3b2b1f"]]
                }
            },
            {
                "skin_id": "RAR_M24_FATEBOLT",
                "name": "M24狙击步枪-命运之矢",
                "weapon": "M24狙击步枪",
                "rarity": "BLUE",
                "model_key": "battle",
                "meta": {
                    "description": "狙击枪身刻有命运符号，搭配蓝金渐变。",
                    "body_colors": [["#25324a", "#7487c3"]],
                    "attachment_colors": [["#f5e9c6", "#865c34"]]
                }
            },
            {
                "skin_id": "RAR_VECTOR_CARDCHAIN",
                "name": "Vector冲锋枪-牌链",
                "weapon": "Vector冲锋枪",
                "rarity": "BLUE",
                "model_key": "vector",
                "meta": {
                    "description": "机匣两侧悬挂链式牌面，颜色以黑红为主。",
                    "body_colors": [["#2d2224", "#9a3c44"]],
                    "attachment_colors": [["#f6d9b0", "#422017"]]
                }
            },
            {
                "skin_id": "RAR_FIVESEVEN_HEARTS",
                "name": "Five-SeveN手枪-红心",
                "weapon": "Five-SeveN手枪",
                "rarity": "BLUE",
                "model_key": "vector",
                "meta": {
                    "description": "滑套镶嵌红心花色，尾部点缀金色边缘。",
                    "body_colors": [["#472125", "#d85a5f"]],
                    "attachment_colors": [["#f8d9a6", "#6a3a28"]]
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
            },
            {
                "skin_id": "UNC_GLOCK_TAROT",
                "name": "Glock手枪-塔罗基调",
                "weapon": "Glock手枪",
                "rarity": "GREEN",
                "model_key": "vector",
                "meta": {
                    "description": "黑金配色搭配简化塔罗符号。",
                    "body_colors": [["#30292f"]],
                    "attachment_colors": [["#d4b273"]]
                }
            },
            {
                "skin_id": "UNC_MP7_CHIP",
                "name": "MP7冲锋枪-筹码",
                "weapon": "MP7冲锋枪",
                "rarity": "GREEN",
                "model_key": "vector",
                "meta": {
                    "description": "机匣侧面嵌入彩色筹码图案。",
                    "body_colors": [["#3a2e34"]],
                    "attachment_colors": [["#caa468"]]
                }
            },
            {
                "skin_id": "UNC_AK74_IVORY",
                "name": "AK-74突击步枪-象牙牌",
                "weapon": "AK-74突击步枪",
                "rarity": "GREEN",
                "model_key": "assault",
                "meta": {
                    "description": "象牙白主色配以淡金线条，呈现优雅质感。",
                    "body_colors": [["#f6efe5"]],
                    "attachment_colors": [["#cba56f"]]
                }
            },
            {
                "skin_id": "UNC_M870_CLUB",
                "name": "M870霰弹枪-梅花",
                "weapon": "M870霰弹枪",
                "rarity": "GREEN",
                "model_key": "battle",
                "meta": {
                    "description": "护木前端绘制简洁梅花图案，枪身保持沉稳色。",
                    "body_colors": [["#3a3434"]],
                    "attachment_colors": [["#d7c198"]]
                }
            },
            {
                "skin_id": "UNC_QBZ_RIBBON",
                "name": "QBZ95-1突击步枪-缎带",
                "weapon": "QBZ95-1突击步枪",
                "rarity": "GREEN",
                "model_key": "bullpup",
                "meta": {
                    "description": "在枪身缠绕红色缎带花纹，象征幸运。",
                    "body_colors": [["#403034"]],
                    "attachment_colors": [["#f2caa0"]]
                }
            },
            {
                "skin_id": "UNC_MP5_JOKER",
                "name": "MP5冲锋枪-小丑",
                "weapon": "MP5冲锋枪",
                "rarity": "GREEN",
                "model_key": "vector",
                "meta": {
                    "description": "小丑笑脸与扑克牌花色交织，营造活泼氛围。",
                    "body_colors": [["#3f2c39"]],
                    "attachment_colors": [["#f4c07d"]]
                }
            },
            {
                "skin_id": "UNC_USP_GILDED",
                "name": "USP手枪-镀金风",
                "weapon": "USP手枪",
                "rarity": "GREEN",
                "model_key": "vector",
                "meta": {
                    "description": "滑套涂以金色边框，主体保持深棕底。",
                    "body_colors": [["#46362d"]],
                    "attachment_colors": [["#d5b47d"]]
                }
            },
            {
                "skin_id": "UNC_M249_EMBLEM",
                "name": "M249机枪-徽记",
                "weapon": "M249轻机枪",
                "rarity": "GREEN",
                "model_key": "battle",
                "meta": {
                    "description": "护罩中央印有命运女神徽记，整体以棕金为主。",
                    "body_colors": [["#4a3a30"]],
                    "attachment_colors": [["#ceb789"]]
                }
            },
            {
                "skin_id": "UNC_P90_IVORY",
                "name": "P90冲锋枪-象牙花",
                "weapon": "P90冲锋枪",
                "rarity": "GREEN",
                "model_key": "vector",
                "meta": {
                    "description": "象牙色机匣搭配金色花纹，气质轻奢。",
                    "body_colors": [["#f5ede0"]],
                    "attachment_colors": [["#ccab74"]]
                }
            },
            {
                "skin_id": "UNC_TAVOR_GILT",
                "name": "Tavor突击步枪-金饰",
                "weapon": "Tavor突击步枪",
                "rarity": "GREEN",
                "model_key": "bullpup",
                "meta": {
                    "description": "配色以米白与金色为主，细节刻画牌面纹路。",
                    "body_colors": [["#efe2cf"]],
                    "attachment_colors": [["#c69c61"]]
                }
            },
            {
                "skin_id": "UNC_ASVAL_RAFFLE",
                "name": "AS Val突击步枪-抽奖",
                "weapon": "AS Val突击步枪",
                "rarity": "GREEN",
                "model_key": "assault",
                "meta": {
                    "description": "枪身镶嵌抽奖转盘花纹，色调柔和。",
                    "body_colors": [["#3d2f35"]],
                    "attachment_colors": [["#d2b68a"]]
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
                    "description": "拥有极寒、酸雨、炎热、雷暴四种气象主题，不同外观对应不同颜色的曳光弹（如酸雨为绿色、雷暴呈闪电形），龙鳞导轨会随温度变化亮度。",
                    "tracer": "气象脉冲曳光",
                    "body_colors": [["#1f2c4f", "#45a0ff"], ["#3c2e55", "#ff7f4f"], ["#1a3c31", "#39ffb0"], ["#2b294f", "#b18cff"]],
                    "attachment_colors": [["#7dd0ff", "#1f79ff"], ["#ffd27d", "#ff924f"], ["#b1ffe7", "#38ff9f"], ["#d0afff", "#7549ff"]],
                    "weather_attributes": {
                        "type": "weather",
                        "pool": [
                            {"key": "acid_rain", "label": "酸雨"},
                            {"key": "thunder", "label": "雷电"},
                            {"key": "flame", "label": "火焰"},
                            {"key": "frost", "label": "冰霜"}
                        ],
                        "template_overrides": {
                            "brick_weather_redbolt": "thunder",
                            "brick_weather_purplebolt": "thunder"
                        }
                    },
                    "template_rules": [
                        {"key": "brick_weather_gundam", "label": "高达气象", "weight": 1, "allow_premium": False, "allow_exquisite": True, "effects": ["weather_glow"], "body": ["#ffffff", "#3d6bff"], "attachments": ["#ffcc00", "#ff3535"]},
                        {"key": "brick_weather_clathrate", "label": "可燃冰", "weight": 1, "allow_premium": False, "allow_exquisite": True, "effects": ["weather_frost"], "body": ["#b5f4ff", "#f8ffff"], "attachments": ["#6fdfff", "#d3f9ff"]},
                        {"key": "brick_weather_redbolt", "label": "红电", "weight": 1, "allow_premium": False, "allow_exquisite": True, "effects": ["weather_bolt"], "body": ["#2b1a34", "#ff5b5b"], "attachments": ["#ffca6a", "#ff8340"]},
                        {"key": "brick_weather_purplebolt", "label": "紫电", "weight": 1, "allow_premium": False, "allow_exquisite": True, "effects": ["weather_bolt"], "body": ["#281a4f", "#a064ff"], "attachments": ["#cfa8ff", "#5f38ff"]},
                        {"key": "brick_weather_gradient", "label": "气象渐变", "weight": 5, "allow_premium": True, "allow_exquisite": True, "effects": ["weather_gradient"], "body": ["#2f4d7a", "#5ec1ff"], "attachments": ["#5bf0ff", "#ffe76c"]},
                        {"key": "brick_weather_default", "label": "普通模板", "weight": 91, "allow_premium": True, "allow_exquisite": True, "effects": ["weather_glow"], "body": ["#25355c", "#4aa7ff"], "attachments": ["#6be0ff", "#ffe980"]}
                    ],
                    "extra_effects": {
                        "premium": ["sheen", "trail", "weather_glow"],
                        "exquisite": ["sheen", "trail", "weather_glow", "sparkle", "weather_gradient"]
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
                    "description": "同样具备极寒、酸雨、炎热与雷暴四种气象主题，模块化外壳会根据天气切换纹理，火焰主题伴随火焰特效。",
                    "tracer": "天气折射曳光",
                    "body_colors": [["#243656", "#4f86ff"], ["#3c2f5f", "#ff9966"], ["#193f33", "#45ffbc"], ["#302a57", "#c79dff"]],
                    "attachment_colors": [["#70c5ff", "#2a6dff"], ["#ffc771", "#ff7a45"], ["#a9ffe3", "#36ff98"], ["#d4b0ff", "#6f48ff"]],
                    "weather_attributes": {
                        "type": "weather",
                        "pool": [
                            {"key": "acid_rain", "label": "酸雨"},
                            {"key": "thunder", "label": "雷电"},
                            {"key": "flame", "label": "火焰"},
                            {"key": "frost", "label": "冰霜"}
                        ],
                        "template_overrides": {
                            "brick_weather_redbolt": "thunder",
                            "brick_weather_purplebolt": "thunder"
                        }
                    },
                    "template_rules": [
                        {"key": "brick_weather_gradient", "label": "气象渐变", "weight": 5, "allow_premium": True, "allow_exquisite": True, "effects": ["weather_gradient"], "body": ["#2f4d7a", "#5ec1ff"], "attachments": ["#5bf0ff", "#ffe76c"]},
                        {"key": "brick_weather_default", "label": "普通模板", "weight": 95, "allow_premium": True, "allow_exquisite": True, "effects": ["weather_glow"], "body": ["#2a3960", "#4f8dff"], "attachments": ["#6fe1ff", "#ffd261"]}
                    ],
                    "extra_effects": {
                        "premium": ["sheen", "trail", "weather_glow"],
                        "exquisite": ["sheen", "trail", "weather_glow", "sparkle"]
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
            },
            {
                "skin_id": "EPI_SCAR_STORMSONG",
                "name": "SCAR-H战斗步枪-风暴之歌",
                "weapon": "SCAR-H战斗步枪",
                "rarity": "PURPLE",
                "model_key": "battle",
                "meta": {
                    "description": "暴雨云层与闪电交织的图案随枪声闪烁。",
                    "body_colors": [["#24304d", "#68a1ff"]],
                    "attachment_colors": [["#f1f7ff", "#ffd35e"]],
                    "effects": {"premium": ["sheen"], "exquisite": ["sheen", "weather_bolt"]}
                }
            },
            {
                "skin_id": "EPI_P90_TYPHOON",
                "name": "P90冲锋枪-台风眼",
                "weapon": "P90冲锋枪",
                "rarity": "PURPLE",
                "model_key": "vector",
                "meta": {
                    "description": "枪身中部呈现台风眼涡流，透明弹匣映出气旋。",
                    "body_colors": [["#1e3a5f", "#53d1ff"]],
                    "attachment_colors": [["#f2fbff", "#ffef95"]],
                    "effects": {"premium": ["sheen"], "exquisite": ["sheen", "weather_gradient"]}
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
            },
            {
                "skin_id": "RAR_M4_LIGHTNINGPATH",
                "name": "M4A1突击步枪-闪电轨",
                "weapon": "M4A1突击步枪",
                "rarity": "BLUE",
                "model_key": "assault",
                "meta": {
                    "description": "蓝白闪电沿护木延伸，枪托加入天气读数。",
                    "body_colors": [["#223255", "#65a3ff"]],
                    "attachment_colors": [["#f0f7ff", "#ffd86b"]]
                }
            },
            {
                "skin_id": "RAR_MPX_RAINBAND",
                "name": "MPX冲锋枪-降雨带",
                "weapon": "SIG MPX",
                "rarity": "BLUE",
                "model_key": "vector",
                "meta": {
                    "description": "降雨雷达环绕机匣，呈现动态雨带图。",
                    "body_colors": [["#1d2f4a", "#4fc0ff"]],
                    "attachment_colors": [["#f6fbff", "#ffe57e"]]
                }
            },
            {
                "skin_id": "RAR_AUG_FROSTFALL",
                "name": "AUG突击步枪-霜降",
                "weapon": "AUG突击步枪",
                "rarity": "BLUE",
                "model_key": "bullpup",
                "meta": {
                    "description": "浅蓝霜纹覆盖枪身，尾部点缀白色雪雾。",
                    "body_colors": [["#28405f", "#8dd2ff"]],
                    "attachment_colors": [["#f4fbff", "#d3ecff"]]
                }
            },
            {
                "skin_id": "RAR_SAIGA_GALE",
                "name": "Saiga霰弹枪-疾风",
                "weapon": "Saiga霰弹枪",
                "rarity": "BLUE",
                "model_key": "battle",
                "meta": {
                    "description": "侧板印有风速刻度，枪口装饰风切线条。",
                    "body_colors": [["#202f49", "#5eb8ff"]],
                    "attachment_colors": [["#f1f8ff", "#ffdc85"]]
                }
            },
            {
                "skin_id": "RAR_M1911_PRESSURE",
                "name": "M1911手枪-气压",
                "weapon": "M1911手枪",
                "rarity": "BLUE",
                "model_key": "vector",
                "meta": {
                    "description": "滑套显示气压表刻度，整体配色偏灰蓝。",
                    "body_colors": [["#28364f", "#6f95b8"]],
                    "attachment_colors": [["#dfe9f6", "#ffe19b"]]
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
            },
            {
                "skin_id": "UNC_GLOCK_MIST",
                "name": "Glock手枪-晨雾",
                "weapon": "Glock手枪",
                "rarity": "GREEN",
                "model_key": "vector",
                "meta": {
                    "description": "浅蓝雾气纹理覆盖滑套，握把保持灰色。",
                    "body_colors": [["#8ec5ff"]],
                    "attachment_colors": [["#f0f7ff"]]
                }
            },
            {
                "skin_id": "UNC_MP7_DRIZZLE",
                "name": "MP7冲锋枪-细雨",
                "weapon": "MP7冲锋枪",
                "rarity": "GREEN",
                "model_key": "vector",
                "meta": {
                    "description": "机匣表面呈现斜雨线，颜色偏青蓝。",
                    "body_colors": [["#5f86ad"]],
                    "attachment_colors": [["#e0ecf6"]]
                }
            },
            {
                "skin_id": "UNC_P90_HAZE",
                "name": "P90冲锋枪-薄雾",
                "weapon": "P90冲锋枪",
                "rarity": "GREEN",
                "model_key": "vector",
                "meta": {
                    "description": "半透明机匣透出淡淡蓝雾，细节以白色点缀。",
                    "body_colors": [["#9bc9ff"]],
                    "attachment_colors": [["#f6fbff"]]
                }
            },
            {
                "skin_id": "UNC_AK74_FRONT",
                "name": "AK-74突击步枪-锋面",
                "weapon": "AK-74突击步枪",
                "rarity": "GREEN",
                "model_key": "assault",
                "meta": {
                    "description": "蓝灰渐层象征冷暖锋交汇。",
                    "body_colors": [["#5a7fa8"]],
                    "attachment_colors": [["#e8f0f9"]]
                }
            },
            {
                "skin_id": "UNC_M870_BREEZE",
                "name": "M870霰弹枪-清风",
                "weapon": "M870霰弹枪",
                "rarity": "GREEN",
                "model_key": "battle",
                "meta": {
                    "description": "浅绿与灰白搭配，枪托绘制轻风图案。",
                    "body_colors": [["#7fbcd3"]],
                    "attachment_colors": [["#eef6fa"]]
                }
            },
            {
                "skin_id": "UNC_QBZ_CLOUD",
                "name": "QBZ95-1突击步枪-云层",
                "weapon": "QBZ95-1突击步枪",
                "rarity": "GREEN",
                "model_key": "bullpup",
                "meta": {
                    "description": "枪身绘有分层云朵，营造立体气象感。",
                    "body_colors": [["#95bfe0"]],
                    "attachment_colors": [["#f4f8fc"]]
                }
            },
            {
                "skin_id": "UNC_MP5_RAINBOW",
                "name": "MP5冲锋枪-彩虹",
                "weapon": "MP5冲锋枪",
                "rarity": "GREEN",
                "model_key": "vector",
                "meta": {
                    "description": "雨后彩虹沿机匣弧形铺展，颜色柔和。",
                    "body_colors": [["#8fc2ff"]],
                    "attachment_colors": [["#fbeff5"]]
                }
            },
            {
                "skin_id": "UNC_USP_BAROMETER",
                "name": "USP手枪-气压计",
                "weapon": "USP手枪",
                "rarity": "GREEN",
                "model_key": "vector",
                "meta": {
                    "description": "握把嵌入简化气压表，色调偏灰蓝。",
                    "body_colors": [["#6f90ae"]],
                    "attachment_colors": [["#e7eef6"]]
                }
            },
            {
                "skin_id": "UNC_M9_RAINPEARL",
                "name": "M9手枪-雨珠",
                "weapon": "M9手枪",
                "rarity": "GREEN",
                "model_key": "vector",
                "meta": {
                    "description": "枪身点缀水滴状珠光涂层。",
                    "body_colors": [["#8ab5d8"]],
                    "attachment_colors": [["#f2f7fb"]]
                }
            },
            {
                "skin_id": "UNC_M249_DOWNBURST",
                "name": "M249机枪-下击暴流",
                "weapon": "M249轻机枪",
                "rarity": "GREEN",
                "model_key": "battle",
                "meta": {
                    "description": "机匣绘有强烈气流箭头，颜色偏向深蓝。",
                    "body_colors": [["#476a8f"]],
                    "attachment_colors": [["#dce8f4"]]
                }
            },
            {
                "skin_id": "UNC_ASVAL_DUSK",
                "name": "AS Val突击步枪-暮雨",
                "weapon": "AS Val突击步枪",
                "rarity": "GREEN",
                "model_key": "assault",
                "meta": {
                    "description": "深蓝渐变带来暮色雨景的感觉。",
                    "body_colors": [["#3c4f6f"]],
                    "attachment_colors": [["#d6e2f1"]]
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
            },
            {
                "skin_id": "EPI_SCARL_HELIX",
                "name": "SCAR-L突击步枪-螺旋棱镜",
                "weapon": "SCAR-L突击步枪",
                "rarity": "PURPLE",
                "model_key": "assault",
                "meta": {
                    "description": "枪身嵌入螺旋光带，棱镜碎片随动作折射冷暖光芒。",
                    "body_colors": [["#5d6dff", "#2a3b9f"]],
                    "attachment_colors": [["#f4cfff", "#88f3ff"]],
                    "effects": {"premium": ["sheen"], "exquisite": ["sheen", "refraction", "sparkle"]}
                }
            },
            {
                "skin_id": "EPI_SVD_LUMINEDGE",
                "name": "SVD狙击步枪-辉刃",
                "weapon": "SVD狙击步枪",
                "rarity": "PURPLE",
                "model_key": "battle",
                "meta": {
                    "description": "长枪体被蓝紫光刃包裹，狙击护木镶嵌流动能量脉络。",
                    "body_colors": [["#4b5fe6", "#89a4ff"]],
                    "attachment_colors": [["#ffe0ad", "#ffd2f5"]],
                    "effects": {"premium": ["sheen"], "exquisite": ["sheen", "refraction"]}
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
            },
            {
                "skin_id": "RAR_MP7_NEONFRAME",
                "name": "MP7冲锋枪-霓框",
                "weapon": "MP7冲锋枪",
                "rarity": "BLUE",
                "model_key": "vector",
                "meta": {
                    "description": "紧凑机匣外覆霓虹光框，尾部散发冷蓝辉芒。",
                    "body_colors": [["#2e3b6f", "#4c5fa6"]],
                    "attachment_colors": [["#7af2ff", "#c3f7ff"]]
                }
            },
            {
                "skin_id": "RAR_QBZ95_POLARARC",
                "name": "QBZ-95突击步枪-极弧",
                "weapon": "QBZ-95突击步枪",
                "rarity": "BLUE",
                "model_key": "bullpup",
                "meta": {
                    "description": "无托布局上覆极地蓝弧面，护木透出光电回路。",
                    "body_colors": [["#3c5f9e", "#6f8fe2"]],
                    "attachment_colors": [["#c3d9ff", "#8ee0ff"]]
                }
            },
            {
                "skin_id": "RAR_SIG552_STEELWING",
                "name": "SIG 552突击步枪-钢翼",
                "weapon": "SIG 552突击步枪",
                "rarity": "BLUE",
                "model_key": "assault",
                "meta": {
                    "description": "钢翼状散热片镶嵌于枪身两侧，透出冷银光泽。",
                    "body_colors": [["#46546a", "#7084a0"]],
                    "attachment_colors": [["#b8c9dd", "#d8e9f9"]]
                }
            },
            {
                "skin_id": "RAR_P90_STROBELINE",
                "name": "P90冲锋枪-频闪线",
                "weapon": "P90冲锋枪",
                "rarity": "BLUE",
                "model_key": "vector",
                "meta": {
                    "description": "流线型弹匣覆以蓝紫频闪线条，侧翼透出亮白灯带。",
                    "body_colors": [["#394f8c", "#6175c4"]],
                    "attachment_colors": [["#d5e2ff", "#9fe2ff"]]
                }
            },
            {
                "skin_id": "RAR_MK14_SILVERGROOVE",
                "name": "MK14战斗步枪-银脊",
                "weapon": "MK14战斗步枪",
                "rarity": "BLUE",
                "model_key": "battle",
                "meta": {
                    "description": "拉丝银脊贯穿枪体，侧板以暗蓝渐变衬托机械质感。",
                    "body_colors": [["#2f3c55", "#51658a"]],
                    "attachment_colors": [["#c2d1e4", "#93a7c7"]]
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
            },
            {
                "skin_id": "UNC_AK74M_BRUSHWOOD",
                "name": "AK-74M突击步枪-林影",
                "weapon": "AK-74M突击步枪",
                "rarity": "GREEN",
                "model_key": "assault",
                "meta": {
                    "description": "林木伪装色叠加细致拉丝，让经典步枪更具野战气质。",
                    "body_colors": [["#5a7a4d"]],
                    "attachment_colors": [["#c8df9a"]]
                }
            },
            {
                "skin_id": "UNC_G36_SMOKEGLASS",
                "name": "G36突击步枪-烟玻",
                "weapon": "G36突击步枪",
                "rarity": "GREEN",
                "model_key": "assault",
                "meta": {
                    "description": "灰蓝烟玻材质覆盖护木，透出内部结构线条。",
                    "body_colors": [["#4e5d6a"]],
                    "attachment_colors": [["#9fb6c6"]]
                }
            },
            {
                "skin_id": "UNC_VITYAZ_CYANGLINT",
                "name": "PP-19冲锋枪-青辉",
                "weapon": "PP-19-01冲锋枪",
                "rarity": "GREEN",
                "model_key": "vector",
                "meta": {
                    "description": "护木与折叠托镶嵌青色亮条，释放灵动能量感。",
                    "body_colors": [["#3d6f71"]],
                    "attachment_colors": [["#9ae3df"]]
                }
            },
            {
                "skin_id": "UNC_TYPE81_TERRACOTTA",
                "name": "81式突击步枪-陶纹",
                "weapon": "81式突击步枪",
                "rarity": "GREEN",
                "model_key": "assault",
                "meta": {
                    "description": "暖土色陶纹与黑色金属交错，呈现东方古典气息。",
                    "body_colors": [["#70584a"]],
                    "attachment_colors": [["#c9a687"]]
                }
            },
            {
                "skin_id": "UNC_FAMAS_LATTICE",
                "name": "FAMAS突击步枪-格栅",
                "weapon": "FAMAS突击步枪",
                "rarity": "GREEN",
                "model_key": "assault",
                "meta": {
                    "description": "无托结构配以浅蓝格栅纹理，呈现冷静科技风。",
                    "body_colors": [["#4d5f76"]],
                    "attachment_colors": [["#b0d1e8"]]
                }
            },
            {
                "skin_id": "UNC_M249_FIELDGRID",
                "name": "M249机枪-田格",
                "weapon": "M249轻机枪",
                "rarity": "GREEN",
                "model_key": "battle",
                "meta": {
                    "description": "弹链护罩绘制浅绿田格，暗示田野作战背景。",
                    "body_colors": [["#5c6650"]],
                    "attachment_colors": [["#c0d79a"]]
                }
            },
            {
                "skin_id": "UNC_HONEYBADGER_RIVERBED",
                "name": "Honey Badger冲锋枪-河床",
                "weapon": "Honey Badger冲锋枪",
                "rarity": "GREEN",
                "model_key": "vector",
                "meta": {
                    "description": "沉稳灰蓝基调上点缀鹅卵石纹理，模拟河床肌理。",
                    "body_colors": [["#45515b"]],
                    "attachment_colors": [["#9ab7c7"]]
                }
            },
            {
                "skin_id": "UNC_AKS74U_SPARKLEAF",
                "name": "AKS-74U冲锋枪-星叶",
                "weapon": "AKS-74U冲锋枪",
                "rarity": "GREEN",
                "model_key": "vector",
                "meta": {
                    "description": "折叠托与护木涂覆星点绿叶纹，凸显轻巧敏捷。",
                    "body_colors": [["#4a7254"]],
                    "attachment_colors": [["#b8e6a7"]]
                }
            },
            {
                "skin_id": "UNC_TAVOR_MOONLIT",
                "name": "Tavor突击步枪-月辉",
                "weapon": "Tavor突击步枪",
                "rarity": "GREEN",
                "model_key": "bullpup",
                "meta": {
                    "description": "月光银青渐变附着于无托结构，显得灵巧而未来。",
                    "body_colors": [["#4f5874"]],
                    "attachment_colors": [["#c4cbe3"]]
                }
            },
            {
                "skin_id": "UNC_M14D_OBSIDIAN",
                "name": "M14 DMR-黑曜",
                "weapon": "M14精确步枪",
                "rarity": "GREEN",
                "model_key": "battle",
                "meta": {
                    "description": "枪托采用黑曜石质感涂层，带有青灰折光。",
                    "body_colors": [["#3e4854"]],
                    "attachment_colors": [["#8ea4b9"]]
                }
            },
            {
                "skin_id": "UNC_MP5K_WAVEGRID",
                "name": "MP5K冲锋枪-波网",
                "weapon": "MP5K冲锋枪",
                "rarity": "GREEN",
                "model_key": "vector",
                "meta": {
                    "description": "短枪身覆盖蓝绿波纹网格，配件以淡青磨砂收束。",
                    "body_colors": [["#42687a"]],
                    "attachment_colors": [["#a8d5e6"]]
                }
            }
        ]
    }
]
