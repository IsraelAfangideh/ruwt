import { ethers } from "ethers";
import type { Env } from "./env";

const VAULT_ABI = [
  "function openLong(address trader, uint256 margin, uint256 tradePrice) external returns (uint256)",
  "function closeLong(uint256 positionId, uint256 tradePrice) external",
  "function balances(address) view returns (uint256)",
  "function vaultBalance() view returns (uint256)",
  "function totalOpenInterest() view returns (uint256)",
  "function availableCapacity() view returns (uint256)",
  "function getPosition(uint256) view returns (tuple(address trader, bool active, uint64 openedAt, uint256 margin, uint256 entryPrice))",
  "function nextPositionId() view returns (uint256)",
  "function lastTradePrice() view returns (uint256)",
  "event LongOpened(uint256 indexed positionId, address indexed trader, uint256 margin, uint256 tradePrice)",
];

const USDT_DECIMALS = 6;
export const toScaled = (n: number): bigint => BigInt(Math.round(n * 10 ** USDT_DECIMALS));
export const fromScaled = (v: bigint): number => Number(v) / 10 ** USDT_DECIMALS;

function getVault(env: Env) {
  const provider = new ethers.JsonRpcProvider(env.POLYGON_RPC);
  const operator = new ethers.Wallet(env.OPERATOR_PRIVATE_KEY, provider);
  return new ethers.Contract(env.VAULT_ADDRESS, VAULT_ABI, operator);
}

export async function openLong(
  env: Env,
  trader: string,
  margin: bigint,
  tradePrice: bigint
): Promise<{ positionId: bigint; txHash: string }> {
  const vault = getVault(env);
  const tx = await vault.openLong(trader, margin, tradePrice);
  const receipt = await tx.wait();

  const topicHash = vault.interface.getEvent("LongOpened")!.topicHash;
  const log = receipt.logs.find((l: ethers.Log) => l.topics[0] === topicHash);
  if (!log) throw new Error("LongOpened event not found");

  const parsed = vault.interface.parseLog(log)!;
  return { positionId: parsed.args[0] as bigint, txHash: receipt.hash };
}

export async function closeLong(
  env: Env,
  positionId: bigint,
  tradePrice: bigint
): Promise<{ txHash: string }> {
  const vault = getVault(env);
  const tx = await vault.closeLong(positionId, tradePrice);
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}

export async function getPosition(env: Env, positionId: bigint) {
  const vault = getVault(env);
  return vault.getPosition(positionId);
}

export async function getTraderBalance(env: Env, trader: string): Promise<bigint> {
  const vault = getVault(env);
  return vault.balances(trader);
}

export async function getVaultStats(env: Env) {
  const vault = getVault(env);
  const [vaultBalance, totalOI, capacity, nextId] = await Promise.all([
    vault.vaultBalance() as Promise<bigint>,
    vault.totalOpenInterest() as Promise<bigint>,
    vault.availableCapacity() as Promise<bigint>,
    vault.nextPositionId() as Promise<bigint>,
  ]);
  return { vaultBalance, totalOI, capacity, nextPositionId: nextId };
}
