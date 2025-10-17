import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api"
});

export interface Skin {
  id: string;
  name: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  weapon: string;
  image_url?: string | null;
}

export interface InventoryItem {
  id: string;
  skin_id: string;
  name: string;
  rarity: Skin["rarity"];
  acquired_at: string;
}

export interface User {
  id: string;
  username: string;
  display_name: string;
  coins: number;
  keys: number;
  is_admin: boolean;
}

export async function fetchSkins(): Promise<Skin[]> {
  const { data } = await api.get<Skin[]>("/skins");
  return data;
}

export async function registerUser(payload: {
  username: string;
  display_name: string;
  password: string;
}): Promise<User> {
  const { data } = await api.post<User>("/users", payload);
  return data;
}

export async function login(payload: {
  username: string;
  password: string;
}): Promise<{ access_token: string }> {
  const params = new URLSearchParams();
  params.append("username", payload.username);
  params.append("password", payload.password);
  params.append("grant_type", "password");

  const { data } = await api.post<{ access_token: string }>("/auth/token", params, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  });
  return data;
}

export async function fetchMe(token: string): Promise<User> {
  const { data } = await api.get<User>("/auth/me", {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
}

export async function fetchInventory(username: string, token: string): Promise<InventoryItem[]> {
  const { data } = await api.get<InventoryItem[]>(`/users/${username}/inventory`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
}

export async function draw(username: string, count: number, token: string) {
  const { data } = await api.post<{ items: InventoryItem[]; remaining_keys: number }>(
    "/gacha/draw",
    { username, count },
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return data;
}

export default api;
