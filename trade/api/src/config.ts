export const config = {
  port: parseInt(process.env.PORT || "3100"),

  // Polygon RPC
  rpcUrl: process.env.POLYGON_RPC || "https://polygon-rpc.com",

  // Operator wallet (submits openLong/closeLong txs)
  operatorKey: process.env.OPERATOR_PRIVATE_KEY || "",

  // Deployed PalmVault address
  vaultAddress: process.env.VAULT_ADDRESS || "",

  // Databento API key for FCPO price feed
  databentoKey: process.env.DATABENTO_API_KEY || "",

  // Price poll interval in dev/mock mode (ms)
  priceIntervalMs: 10_000,

  // API key for mutation endpoints (optional — open access if empty)
  apiKey: process.env.API_KEY || "",
} as const;
