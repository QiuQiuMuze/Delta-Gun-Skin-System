import SeasonCard from "@/components/SeasonCard";
import type { Season, SeasonGroupDefinition } from "@/types";

interface Props {
  season: Season;
  group: SeasonGroupDefinition;
}

export default function SeasonGroup({ season, group }: Props) {
  const skins = season[group.key];

  if (!skins || skins.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold text-slate-100">{group.title}</h2>
        <p className="text-sm text-slate-400">共 {skins.length} 款皮肤</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {skins.map((skin) => (
          <SeasonCard key={skin.skin_id} skin={skin} accent={group.accent} />
        ))}
      </div>
    </section>
  );
}
