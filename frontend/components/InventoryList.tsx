import type { InventoryItem } from "@/lib/api";

export function InventoryList({ items }: { items: InventoryItem[] }) {
  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-6 text-center text-sm text-slate-400">
        暂无抽取记录，快去抽卡吧！
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between">
            <p className="font-medium text-slate-100">{item.name}</p>
            <span className="text-xs uppercase tracking-wide text-slate-400">{item.rarity}</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            获取时间：{new Date(item.acquired_at).toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  );
}
