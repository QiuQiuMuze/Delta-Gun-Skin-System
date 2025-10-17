import { Season } from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "请求失败，请稍后重试");
  }

  return (await response.json()) as T;
}

export async function fetchSeasons(): Promise<Season[]> {
  return request<Season[]>(`${BASE_URL}/seasons`);
}

export async function fetchSeason(id: string): Promise<Season> {
  return request<Season>(`${BASE_URL}/seasons/${id}`);
}
