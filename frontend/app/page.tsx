"use client";

import SeasonGroup from "@/components/SeasonGroup";
import { fetchSeasons } from "@/lib/api";
import { SEASON_GROUPS } from "@/types";
import { useQuery } from "@tanstack/react-query";

export default function HomePage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["seasons"],
    queryFn: fetchSeasons,
  });

  if (isLoading) {
    return <p className="text-slate-300">正在加载赛季数据...</p>;
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-6 text-rose-100">
        <p className="font-semibold">加载失败</p>
        <p className="mt-2 text-sm opacity-80">{(error as Error).message}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-rose-500/80 px-3 py-2 text-sm font-medium text-white transition hover:bg-rose-400"
        >
          重试
        </button>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <p className="text-slate-300">暂无赛季数据，请稍后再试。</p>;
  }

  return (
    <div className="space-y-16">
      {data.map((season) => (
        <section key={season.id} className="space-y-10 rounded-3xl border border-slate-800/70 bg-slate-900/40 p-8">
          <header className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-widest text-sky-400">{season.id}</p>
            <h2 className="text-2xl font-bold text-slate-50 md:text-3xl">{season.name}</h2>
            <p className="text-sm text-slate-400">{season.tagline}</p>
            <p className="mt-4 text-base leading-relaxed text-slate-300">{season.description}</p>
            {isFetching ? <p className="text-xs text-slate-500">正在刷新...</p> : null}
          </header>
          <div className="space-y-12">
            {SEASON_GROUPS.map((group) => (
              <SeasonGroup key={`${season.id}-${group.key}`} season={season} group={group} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
