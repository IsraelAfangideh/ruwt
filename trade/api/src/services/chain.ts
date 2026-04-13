import { ethers } from "ethers";
import { config } from "../config.js";

const VAULT_ABI = [
  "function openLong(address trader, uint256 margin, uint256 entryPrice) external returns (uint256)",
  "function closeLong(uint256 positionId, uint256 exitPrice) external",
  "function balances(address) view returns (uint256)",
  "function vaultBalance() view returns (uint256)",
  "function totalOpenInterest() view returns (uint256)",
  "function availableCapacity() view returns (uint256)",
  "function getPosition(uint256) view returns (tuple(address trader, bool active, uint64 openedAt, uint256 margin, uint256 entryPrice))",
  "function nextPositionId() view returns (uint256)",
  "event LongOpened(uint256 indexed positionId, address indexed trader, uint256 margin, uint256 entryPrice)",
  "event LongClosed(uint256 indexed positionId, address indexed trader, uint256 exitPrice, int256 pnl, uint256 fee, uint256 payout)",
];

let provider: ethers.JsonRpcProvider;
let operator: ethers.Wallet;
let vault: ethers.Contract;
let longOpenedTopic: string;

export function initChain(): void {
  provider = new ethers.JsonRpcProvider(config.rpcUrl, undefined, {
    batchMaxCount: 10,
    batchStallTime: 10,
  });
  operator = new ethers.Wallet(config.operatorKey, provider);
  vault = new ethers.Contract(config.vaultAddress, VAULT_ABI, operator);
  longOpenedTopic = vault.interface.getEvent("LongOpened")!.topicHash;
  console.log("[chain] operator:", operator.address);
  console.log("[chain] vault:", config.vaultAddress);
}

export async function openLong(
  trader: string,
  marginScaled: bigint,
  entryPriceScaled: bigint
): Promise<{ positionId: bigint; txHash: string }> {
  const tx = await vault.openLong(trader, marginScaled, entryPriceScaled);
  const receipt = await tx.wait();

  const log = receipt.logs.find(
    (l: ethers.Log) => l.topics[0] === longOpenedTopic
  );
  if (!log) throw new Error("LongOpened event not found in receipt");

  const parsed = vault.interface.parseLog(log)!;
  const positionId = parsed.args[0] as bigint;

  return { positionId, txHash: receipt.hash };
}

export async function closeLong(
  positionId: bigint,
  exitPriceScaled: bigint
): Promise<{ txHash: string }> {
  const tx = await vault.closeLong(positionId, exitPriceScaled);
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}

export async function getTraderBalance(trader: string): Promise<bigint> {
  return vault.balances(trader);
}

export async function getPosition(positionId: bigint) {
  return vault.getPosition(positionId);
}

export async function getVaultStats() {
  const [vaultBalance, totalOI, capacity, nextId] = await Promise.all([
    vault.vaultBalance() as Promise<bigint>,
    vault.totalOpenInterest() as Promise<bigint>,
    vault.availableCapacity() as Promise<bigint>,
    vault.nextPositionId() as Promise<bigint>,
  ]);
  return { vaultBalance, totalOI, capacity, nextPositionId: nextId };
}
