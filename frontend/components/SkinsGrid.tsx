import clsx from "clsx";

import type { Skin } from "@/lib/api";

const rarityStyles: Record<Skin["rarity"], string> = {
  legendary: "from-amber-400 to-orange-600",
  epic: "from-violet-500 to-fuchsia-600",
  rare: "from-sky-500 to-cyan-600",
  common: "from-slate-500 to-slate-600"
};

export function SkinsGrid({ skins }: { skins: Skin[] }) {
  if (!skins.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-6 text-center text-sm text-slate-400">
        目前还没有皮肤，请先由管理员在后台添加。
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {skins.map((skin) => (
        <article
          key={skin.id}
          className={clsx(
            "rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-inner",
            "bg-gradient-to-br text-slate-100",
            rarityStyles[skin.rarity]
          )}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{skin.name}</h3>
            <span className="rounded-full bg-black/40 px-3 py-1 text-xs uppercase tracking-wide text-white/80">
              {skin.rarity}
            </span>
          </div>
          <p className="mt-2 text-sm text-white/80">适用武器：{skin.weapon}</p>
          {skin.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={skin.image_url}
              alt={skin.name}
              className="mt-3 h-32 w-full rounded-lg object-cover"
            />
          ) : (
            <div className="mt-3 flex h-32 items-center justify-center rounded-lg border border-white/20 bg-black/20 text-xs text-white/70">
              暂无预览
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
