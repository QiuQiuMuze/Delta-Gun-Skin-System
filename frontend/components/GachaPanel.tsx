"use client";

import { useState } from "react";

interface Props {
  onDraw: (count: number) => Promise<void>;
  loading?: boolean;
  keys?: number;
  disabled?: boolean;
}

export function GachaPanel({ onDraw, loading, keys = 0, disabled }: Props) {
  const [count, setCount] = useState(1);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-100">抽卡模拟</h3>
        <span className="text-sm text-slate-400">剩余钥匙：{keys}</span>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <label className="text-sm text-slate-300" htmlFor="draw-count">
          抽卡数量
        </label>
        <select
          id="draw-count"
          value={count}
          onChange={(event) => setCount(Number(event.target.value))}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
        >
          {[1, 5, 10].map((value) => (
            <option key={value} value={value}>
              {value} 抽
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={() => onDraw(count)}
        disabled={disabled || loading}
        className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "抽卡中..." : "开始抽卡"}
      </button>
      <p className="mt-3 text-xs text-slate-400">抽卡将消耗等量钥匙，抽到的皮肤会进入“我的仓库”。</p>
    </div>
  );
}
