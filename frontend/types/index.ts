export interface SeasonSkin {
  skin_id: string;
  name: string;
  weapon: string;
  rarity: string;
  model_key: string;
  meta: Record<string, unknown>;
}

export interface Season {
  id: string;
  name: string;
  tagline: string;
  description: string;
  bricks: SeasonSkin[];
  purples: SeasonSkin[];
  blues: SeasonSkin[];
}

export type SeasonGroupKey = "bricks" | "purples" | "blues";

export interface SeasonGroupDefinition {
  key: SeasonGroupKey;
  title: string;
  accent: string;
}

export const SEASON_GROUPS: SeasonGroupDefinition[] = [
  { key: "bricks", title: "砖级皮肤", accent: "from-orange-500 to-amber-400" },
  { key: "purples", title: "紫色皮肤", accent: "from-violet-500 to-fuchsia-500" },
  { key: "blues", title: "蓝色皮肤", accent: "from-sky-500 to-cyan-400" },
];
