import clsx from "clsx";

import type { SeasonSkin } from "@/types";

interface Props {
  skin: SeasonSkin;
  accent: string;
}

export default function SeasonCard({ skin, accent }: Props) {
  return (
    <article
      className={clsx(
        "relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60",
        "p-4 shadow-lg shadow-slate-900/40 transition-transform hover:-translate-y-1",
      )}
    >
      <div className={clsx("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", accent)} />
      <h3 className="text-lg font-semibold text-slate-50">{skin.name}</h3>
      <p className="mt-1 text-sm text-slate-400">{skin.weapon}</p>
      <p className="mt-2 rounded bg-slate-800/70 px-2 py-1 text-xs uppercase tracking-wide text-slate-300">
        稀有度：{skin.rarity}
      </p>
      {skin.meta?.description ? (
        <p className="mt-3 text-sm leading-relaxed text-slate-300">{skin.meta.description as string}</p>
      ) : null}
      {Array.isArray(skin.meta?.body_colors) && skin.meta.body_colors.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-semibold text-slate-400">主题配色</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(skin.meta.body_colors as string[][]).map((palette, index) => (
              <div key={index} className="flex items-center gap-1">
                {palette.map((hex) => (
                  <span
                    key={hex}
                    className="h-4 w-4 rounded-full border border-slate-800"
                    style={{ backgroundColor: hex }}
                    title={hex}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}
