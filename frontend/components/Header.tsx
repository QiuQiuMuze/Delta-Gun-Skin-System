import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-wide">
          Delta Gun Skin System
        </Link>
        <nav className="flex items-center gap-4 text-sm text-slate-300">
          <Link href="#skins">皮肤图鉴</Link>
          <Link href="#inventory">我的仓库</Link>
          <Link href="#gacha">抽卡模拟</Link>
        </nav>
      </div>
    </header>
  );
}
