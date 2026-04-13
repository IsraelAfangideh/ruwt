export const VAULT_MAKER = "vault";

export interface Order {
  id: string;
  maker: string; // wallet address or VAULT_MAKER
  side: "bid" | "ask";
  price: number; // USD per MT
  amount: number; // USDT
  timestamp: number;
  positionId?: number; // for sell orders — which position to close
}

export interface Trade {
  buyOrder: Order;
  sellOrder: Order;
  price: number; // execution price (passive side's price)
  amount: number;
  timestamp: number;
}

let nextOrderId = 0;

export class OrderBook {
  bids: Order[] = []; // sorted highest price first
  asks: Order[] = []; // sorted lowest price first
  trades: Trade[] = [];
  lastTradePrice: number | null = null;

  /** Place an order. If it crosses the other side, execute a trade immediately. */
  placeOrder(
    maker: string,
    side: "bid" | "ask",
    price: number,
    amount: number,
    positionId?: number
  ): { order: Order; trade: Trade | null } {
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`Invalid order price: ${price}`);
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(`Invalid order amount: ${amount}`);
    }

    const order: Order = {
      id: `ord_${nextOrderId++}`,
      maker,
      side,
      price,
      amount,
      timestamp: Date.now(),
      positionId,
    };

    const trade = this.tryMatch(order);
    if (trade) {
      return { order, trade };
    }

    // No match — insert sorted (binary search position + splice)
    if (side === "bid") {
      const idx = this.bids.findIndex((o) => o.price < price);
      this.bids.splice(idx === -1 ? this.bids.length : idx, 0, order);
    } else {
      const idx = this.asks.findIndex((o) => o.price > price);
      this.asks.splice(idx === -1 ? this.asks.length : idx, 0, order);
    }

    return { order, trade: null };
  }

  /** Try to match an incoming order against the best order on the other side. */
  private tryMatch(incoming: Order): Trade | null {
    if (incoming.side === "bid") {
      const bestAsk = this.asks[0];
      if (!bestAsk || incoming.price < bestAsk.price) return null;

      const fillAmount = Math.min(incoming.amount, bestAsk.amount);
      const remainder = bestAsk.amount - fillAmount;

      this.asks.shift();
      // Re-insert remainder if resting order was partially filled
      if (remainder > 0) {
        this.asks.unshift({ ...bestAsk, amount: remainder });
      }

      const trade: Trade = {
        buyOrder: incoming,
        sellOrder: bestAsk,
        price: bestAsk.price,
        amount: fillAmount,
        timestamp: Date.now(),
      };
      this.recordTrade(trade);
      return trade;
    } else {
      const bestBid = this.bids[0];
      if (!bestBid || incoming.price > bestBid.price) return null;

      const fillAmount = Math.min(incoming.amount, bestBid.amount);
      const remainder = bestBid.amount - fillAmount;

      this.bids.shift();
      if (remainder > 0) {
        this.bids.unshift({ ...bestBid, amount: remainder });
      }

      const trade: Trade = {
        buyOrder: bestBid,
        sellOrder: incoming,
        price: bestBid.price,
        amount: fillAmount,
        timestamp: Date.now(),
      };
      this.recordTrade(trade);
      return trade;
    }
  }

  private recordTrade(trade: Trade): void {
    this.lastTradePrice = trade.price;
    this.trades.push(trade);
    if (this.trades.length > 100) this.trades.shift();
  }

  cancelMakerOrders(maker: string): void {
    this.bids = this.bids.filter((o) => o.maker !== maker);
    this.asks = this.asks.filter((o) => o.maker !== maker);
  }

  getBBO(): { bestBid: number | null; bestAsk: number | null } {
    return {
      bestBid: this.bids[0]?.price ?? null,
      bestAsk: this.asks[0]?.price ?? null,
    };
  }

  getSpreadPercent(): number | null {
    const { bestBid, bestAsk } = this.getBBO();
    if (bestBid === null || bestAsk === null) return null;
    const mid = (bestBid + bestAsk) / 2;
    return ((bestAsk - bestBid) / mid) * 100;
  }
}

// One order book per commodity
const books: Record<string, OrderBook> = {};

export function getOrderBook(commodity: string): OrderBook {
  if (!books[commodity]) {
    books[commodity] = new OrderBook();
  }
  return books[commodity];
}

let tradeLock: Promise<void> = Promise.resolve();

/** Execute a trade with exclusive access to the order book. */
export async function withTradeLock<T>(fn: () => Promise<T>): Promise<T> {
  let release: () => void;
  const next = new Promise<void>((r) => (release = r));
  const prev = tradeLock;
  tradeLock = next;
  await prev;
  try {
    return await fn();
  } finally {
    release!();
  }
}
