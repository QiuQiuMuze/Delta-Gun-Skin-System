"use client";

import axios from "axios";
import { FormEvent, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { GachaPanel } from "@/components/GachaPanel";
import { InventoryList } from "@/components/InventoryList";
import { SkinsGrid } from "@/components/SkinsGrid";
import {
  draw as drawRequest,
  fetchInventory,
  fetchMe,
  fetchSkins,
  login,
  registerUser,
  type InventoryItem,
  type User
} from "@/lib/api";

export default function HomePage() {
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [gachaLoading, setGachaLoading] = useState(false);

  const queryClient = useQueryClient();

  const skinsQuery = useQuery({ queryKey: ["skins"], queryFn: fetchSkins });

  const inventoryQuery = useQuery({
    queryKey: ["inventory", currentUser?.username, token],
    queryFn: () => fetchInventory(currentUser!.username, token!),
    enabled: Boolean(currentUser && token)
  });

  const getErrorMessage = (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const detail = (error.response?.data as { detail?: string } | undefined)?.detail;
      return detail ?? error.message;
    }
    return error instanceof Error ? error.message : "发生未知错误";
  };

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const username = String(formData.get("username") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const displayName = String(formData.get("displayName") ?? "").trim();

    setAuthLoading(true);
    setAuthError(null);
    try {
      await registerUser({ username, password, display_name: displayName });
      const tokenResponse = await login({ username, password });
      const profile = await fetchMe(tokenResponse.access_token);
      setToken(tokenResponse.access_token);
      setCurrentUser(profile);
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
      form.reset();
    } catch (error) {
      setAuthError(getErrorMessage(error));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const username = String(formData.get("username") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    setAuthLoading(true);
    setAuthError(null);
    try {
      const tokenResponse = await login({ username, password });
      const profile = await fetchMe(tokenResponse.access_token);
      setToken(tokenResponse.access_token);
      setCurrentUser(profile);
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
      form.reset();
    } catch (error) {
      setAuthError(getErrorMessage(error));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setCurrentUser(null);
    queryClient.removeQueries({ queryKey: ["inventory"] });
  };

  const handleDraw = async (count: number) => {
    if (!currentUser || !token) return;
    const username = currentUser.username;
    const authToken = token;
    setGachaLoading(true);
    try {
      const result = await drawRequest(username, count, authToken);
      setCurrentUser((previous) => (previous ? { ...previous, keys: result.remaining_keys } : previous));
      queryClient.setQueryData<InventoryItem[] | undefined>(
        ["inventory", username, authToken],
        (previous) => [...(previous ?? []), ...result.items]
      );
    } catch (error) {
      setAuthError(getErrorMessage(error));
    } finally {
      setGachaLoading(false);
    }
  };

  const inventoryItems = inventoryQuery.data ?? [];
  const skins = skinsQuery.data ?? [];
  const isAuthenticated = Boolean(token && currentUser);

  const authSectionTitle = useMemo(() => (isAuthenticated ? "欢迎回来" : "快速体验"), [isAuthenticated]);

  return (
    <div className="space-y-16">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex-1 space-y-3">
            <h1 className="text-3xl font-bold text-white">Delta Gun Skin System</h1>
            <p className="text-sm text-slate-300">
              一个使用 Next.js、Tailwind CSS、React Query 与 FastAPI + MongoDB 打造的现代化抽卡模拟平台。
            </p>
            {isAuthenticated ? (
              <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-4 text-sm text-slate-200">
                <p>
                  当前用户：<span className="font-semibold">{currentUser?.display_name}</span>
                </p>
                <p className="mt-1">钥匙数量：{currentUser?.keys}</p>
                <button
                  type="button"
                  className="mt-3 inline-flex items-center rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:bg-slate-800"
                  onClick={handleLogout}
                >
                  退出登录
                </button>
              </div>
            ) : null}
            {authError ? <p className="text-sm text-red-400">{authError}</p> : null}
          </div>
          <div className="w-full max-w-sm space-y-6">
            <h2 className="text-lg font-semibold text-white">{authSectionTitle}</h2>
            {isAuthenticated ? null : (
              <>
                <form onSubmit={handleLogin} className="space-y-3" autoComplete="off">
                  <div className="space-y-1">
                    <label htmlFor="login-username" className="text-xs text-slate-400">
                      用户名
                    </label>
                    <input
                      id="login-username"
                      name="username"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="login-password" className="text-xs text-slate-400">
                      密码
                    </label>
                    <input
                      id="login-password"
                      name="password"
                      type="password"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={authLoading}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {authLoading ? "请稍候..." : "登录"}
                  </button>
                </form>
                <div className="h-px w-full bg-slate-800" />
                <form onSubmit={handleRegister} className="space-y-3" autoComplete="off">
                  <div className="space-y-1">
                    <label htmlFor="register-username" className="text-xs text-slate-400">
                      用户名
                    </label>
                    <input
                      id="register-username"
                      name="username"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="register-displayName" className="text-xs text-slate-400">
                      显示名称
                    </label>
                    <input
                      id="register-displayName"
                      name="displayName"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="register-password" className="text-xs text-slate-400">
                      密码
                    </label>
                    <input
                      id="register-password"
                      name="password"
                      type="password"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={authLoading}
                    className="inline-flex w-full items-center justify-center rounded-lg border border-primary-500 px-4 py-2 text-sm font-semibold text-primary-100 hover:bg-primary-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {authLoading ? "请稍候..." : "注册并登录"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </section>

      <section id="skins" className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-white">皮肤图鉴</h2>
          {skinsQuery.isLoading ? <span className="text-xs text-slate-400">加载中...</span> : null}
        </div>
        <SkinsGrid skins={skins} />
      </section>

      <section id="inventory" className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-white">我的仓库</h2>
          {inventoryQuery.isFetching ? <span className="text-xs text-slate-400">同步中...</span> : null}
        </div>
        {isAuthenticated ? (
          <InventoryList items={inventoryItems} />
        ) : (
          <p className="text-sm text-slate-400">登录后即可查看自己的皮肤收藏。</p>
        )}
      </section>

      <section id="gacha" className="space-y-6">
        <h2 className="text-2xl font-semibold text-white">抽卡体验</h2>
        <GachaPanel
          onDraw={handleDraw}
          loading={gachaLoading}
          keys={currentUser?.keys ?? 0}
          disabled={!isAuthenticated}
        />
      </section>
    </div>
  );
}
