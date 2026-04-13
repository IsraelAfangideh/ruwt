const BASE = "/api";

export type Commodity = "PALM_OIL" | "COCOA";

export const COMMODITY_LABELS: Record<Commodity, string> = {
  PALM_OIL: "Palm Oil",
  COCOA: "Cocoa",
};

export interface PriceData {
  commodity: string;
  marketPrice: number;
  oraclePrice: number;
  bid: number | null;
  ask: number | null;
  spreadPercent: number | null;
  marketOpen: boolean;
  marketStatus: string;
  timestamp: number;
}

export interface PositionData {
  positionId: string;
  commodity: string;
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
  getPrice: (commodity: Commodity = "PALM_OIL") =>
    request<PriceData>(`/prices/current?commodity=${commodity}`),

  getPosition: (id: string, commodity: Commodity = "PALM_OIL") =>
    request<PositionData>(`/positions/${id}?commodity=${commodity}`),

  buy: (trader: string, amount: number, commodity: Commodity = "PALM_OIL") =>
    request<{ positionId: string; commodity: string; tradePrice: number; txHash: string }>(
      "/positions/buy",
      { method: "POST", body: JSON.stringify({ trader, amount, commodity }) }
    ),

  sell: (positionId: number, commodity: Commodity = "PALM_OIL") =>
    request<{ positionId: number; commodity: string; tradePrice: number; txHash: string }>(
      "/positions/sell",
      { method: "POST", body: JSON.stringify({ positionId, commodity }) }
    ),

  getAccount: (address: string) =>
    request<AccountData>(`/account/${address}`),
};
