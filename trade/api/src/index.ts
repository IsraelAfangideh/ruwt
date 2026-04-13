import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { startPriceFeed } from "./services/oracle.js";
import { initChain } from "./services/chain.js";
import priceRoutes from "./routes/prices.js";
import positionRoutes from "./routes/positions.js";
import accountRoutes from "./routes/account.js";

const app = express();
app.use(cors());
app.use(express.json());

// API key auth on mutation routes
const requireApiKey: express.RequestHandler = (req, res, next) => {
  if (!config.apiKey) return next(); // no key configured = open access (dev only)
  if (req.headers["x-api-key"] !== config.apiKey) {
    res.status(401).json({ error: "Invalid API key" });
    return;
  }
  next();
};

app.use("/api/prices", priceRoutes);
app.use("/api/positions", requireApiKey, positionRoutes);
app.use("/api/account", accountRoutes);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

async function start() {
  if (config.operatorKey && config.vaultAddress) {
    initChain();
  } else {
    console.warn("[chain] Missing OPERATOR_PRIVATE_KEY or VAULT_ADDRESS — chain disabled");
  }

  await startPriceFeed();

  app.listen(config.port, () => {
    console.log(`[trade-api] listening on :${config.port}`);
  });
}

start();
