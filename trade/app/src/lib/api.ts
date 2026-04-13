const BASE = "/api";

export interface PriceData {
  commodity: string;
  marketPrice: number;
  oraclePrice: number;
  bid: number | null;
  ask: number | null;
  spreadPercent: number | null;
  timestamp: number;
}

export interface PositionData {
  positionId: string;
  trader: string;
  margin: number;
  entryPrice: number;
  markPrice: number;
  pnlUsd: number;
  pnlPercent: number;
  active: boolean;
  openedAt: number;
}

export interface AccountData {
  trader: string;
  balanceUsdt: number;
  vault: {
    balanceUsdt: number;
    openInterestUsdt: number;
    capacityUsdt: number;
    totalPositions: number;
  };
}

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  getPrice: () => request<PriceData>("/prices/current"),

  getPosition: (id: string) => request<PositionData>(`/positions/${id}`),

  buy: (trader: string, amount: number) =>
    request<{ positionId: string; tradePrice: number; txHash: string }>(
      "/positions/buy",
      { method: "POST", body: JSON.stringify({ trader, amount }) }
    ),

  sell: (positionId: number) =>
    request<{ positionId: number; tradePrice: number; txHash: string }>(
      "/positions/sell",
      { method: "POST", body: JSON.stringify({ positionId }) }
    ),

  getAccount: (address: string) =>
    request<AccountData>(`/account/${address}`),
};
