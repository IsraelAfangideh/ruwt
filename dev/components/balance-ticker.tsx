"use client";

import { motion } from "framer-motion";
import { Coins, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

export function BalanceTicker() {
  const [balance, setBalance] = useState(12450.00); // Fake initial balance

  // Simulate live fluctuations
  useEffect(() => {
    const interval = setInterval(() => {
      setBalance(prev => prev + (Math.random() - 0.4) * 10);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-4 px-4 py-1 bg-muted/20 border rounded-full border-border/50 text-xs font-mono">
      <div className="flex items-center gap-2 text-primary">
        <Coins className="h-3 w-3" />
        <span className="font-bold tracking-wider">BALANCE</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-foreground font-bold">${balance.toFixed(4)}</span>
        <motion.span 
          key={balance}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[10px] text-profit flex items-center"
        >
          <TrendingUp className="h-2 w-2 mr-1" />
          +0.02%
        </motion.span>
      </div>
    </div>
  );
}
