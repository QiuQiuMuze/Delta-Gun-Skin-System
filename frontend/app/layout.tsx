import "./globals.css";

import QueryProvider from "@/components/QueryProvider";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "三角洲砖皮模拟器",
  description: "基于 FastAPI + Next.js + MongoDB 的现代化抽砖皮肤资料站",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <QueryProvider>
          <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-12 px-6 py-12 md:px-12">
            <header className="space-y-4">
              <p className="inline-flex items-center gap-2 rounded-full bg-slate-800/80 px-4 py-1 text-sm font-medium text-slate-300 shadow shadow-slate-900/50">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                在线资料库
              </p>
              <h1 className="text-4xl font-bold tracking-tight text-slate-50 md:text-5xl">
                三角洲砖皮系统
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-slate-300">
                浏览每个赛季的砖级、紫色与蓝色皮肤，了解配色、特效与稀有度信息。数据由后端 MongoDB 提供，并通过 FastAPI + React Query 实时获取。
              </p>
            </header>
            {children}
          </main>
        </QueryProvider>
      </body>
    </html>
  );
}
