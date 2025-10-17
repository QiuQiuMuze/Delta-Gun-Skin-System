import type { Metadata } from "next";
import { ReactNode } from "react";

import { Header } from "@/components/Header";
import { QueryProvider } from "@/lib/react-query";

import "./globals.css";

export const metadata: Metadata = {
  title: "Delta Gun Skin System",
  description: "基于 Next.js 与 FastAPI 的三角洲抽砖模拟体验"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-Hans">
      <body>
        <QueryProvider>
          <div className="flex min-h-screen flex-col">
            <Header />
            <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}
