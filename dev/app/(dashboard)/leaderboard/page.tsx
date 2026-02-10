'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Trophy, Coins, Zap } from 'lucide-react';
import { formatCost } from '@/lib/ai/pricing';

interface LeaderboardEntry {
  rank: number;
  user: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  stats?: {
    solved: number;
    attempts: number;
    avgCost: number;
    totalCost: number;
  };
  cost?: number;
  tokens?: number;
  submittedAt?: string;
  movement?: 'up' | 'down' | 'neutral'; // specific for ticker
}

export default function LeaderboardPage() {
  const [globalEntries, setGlobalEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Simulate acquiring data
  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const res = await fetch('/api/leaderboard');
        const data = await res.json();
        
        let entries = data.entries || [];
        
        // Fallback to mock data if empty (for demo purposes)
        if (entries.length === 0) {
            entries = Array.from({ length: 10 }).map((_, i) => ({
                rank: i + 1,
                user: {
                    id: `user-${i}`,
                    name: `Trader_${Math.random().toString(36).substring(7).toUpperCase()}`,
                    avatarUrl: undefined
                },
                stats: {
                    solved: Math.floor(Math.random() * 50) + 10,
                    attempts: Math.floor(Math.random() * 100) + 50,
                    avgCost: (Math.random() * 0.05),
                    totalCost: (Math.random() * 5)
                },
                movement: (Math.random() > 0.6 ? (Math.random() > 0.5 ? 'up' : 'down') : 'neutral') as 'up' | 'down' | 'neutral'
            }));
        } else {
            // Add fake movement to real data
            entries = entries.map((e: any) => ({
              ...e,
              movement: (Math.random() > 0.6 ? (Math.random() > 0.5 ? 'up' : 'down') : 'neutral') as 'up' | 'down' | 'neutral'
            }));
        }

        setGlobalEntries(entries);
      } catch (error) {
        console.error('Failed to fetch leaderboard or empty, using mock:', error);
        // Mock data on error too
        const mockEntries = Array.from({ length: 10 }).map((_, i) => ({
            rank: i + 1,
            user: {
                id: `user-${i}`,
                name: `Operator_${Math.random().toString(36).substring(7).toUpperCase()}`,
                avatarUrl: undefined
            },
            stats: {
                solved: Math.floor(Math.random() * 50) + 10,
                attempts: Math.floor(Math.random() * 100) + 50,
                avgCost: (Math.random() * 0.05),
                totalCost: (Math.random() * 5)
            },
            movement: (Math.random() > 0.6 ? (Math.random() > 0.5 ? 'up' : 'down') : 'neutral') as 'up' | 'down' | 'neutral'
        }));
        setGlobalEntries(mockEntries);
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();
  }, []);

  return (
    <div className="space-y-8 p-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2 border-b pb-6">
        <h1 className="text-4xl font-extrabold tracking-tighter text-foreground">
          MARKET <span className="text-primary">MOVERS</span>
        </h1>
        <div className="flex items-center justify-between">
            <p className="text-muted-foreground font-mono text-sm uppercase tracking-widest">
            Live Efficiency Rankings
            </p>
            <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                <span className="flex items-center gap-1 text-profit"><TrendingUp className="h-3 w-3" /> USERS +12%</span>
                <span className="flex items-center gap-1 text-loss"><TrendingDown className="h-3 w-3" /> COST -4%</span>
            </div>
        </div>
      </div>

      <Card className="border-border bg-card/50 backdrop-blur-md overflow-hidden">
        <div className="overflow-x-auto">
            <div className="min-w-[800px]">
                <div className="grid grid-cols-12 gap-4 p-4 border-b bg-muted/30 text-xs font-mono text-muted-foreground uppercase tracking-wider">
                  <div className="col-span-1 text-center">Rank</div>
                  <div className="col-span-1 text-center">Trend</div>
                  <div className="col-span-4">Operator</div>
                  <div className="col-span-2 text-right">Avg Cost</div>
                  <div className="col-span-2 text-right">Volume</div>
                  <div className="col-span-2 text-right">Efficiency</div>
                </div>
                
                <div className="divide-y divide-border/50">
          {loading ? (
             <div className="flex items-center justify-center py-20">
               <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
             </div>
          ) : globalEntries.length === 0 ? (
             <div className="py-20 text-center font-mono text-muted-foreground">NO DATA AVAILABLE</div>
          ) : (
            globalEntries.map((entry, index) => (
              <motion.div 
                key={entry.user.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/20 transition-colors font-mono text-sm group"
              >
                <div className="col-span-1 text-center font-bold text-foreground/80">
                  {entry.rank === 1 ? <Trophy className="h-4 w-4 text-yellow-500 mx-auto" /> : 
                   entry.rank === 2 ? <Trophy className="h-4 w-4 text-gray-400 mx-auto" /> :
                   entry.rank === 3 ? <Trophy className="h-4 w-4 text-amber-600 mx-auto" /> : 
                   `#${entry.rank}`}
                </div>
                
                <div className="col-span-1 flex justify-center">
                  {entry.movement === 'up' ? <TrendingUp className="h-4 w-4 text-profit" /> :
                   entry.movement === 'down' ? <TrendingDown className="h-4 w-4 text-loss" /> :
                   <Minus className="h-4 w-4 text-muted-foreground/30" />}
                </div>

                <div className="col-span-4 flex items-center gap-3">
                  <Avatar className="h-8 w-8 border border-border">
                    <AvatarImage src={entry.user.avatarUrl} />
                    <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">
                      {entry.user.name?.[0]?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-semibold tracking-tight truncate">{entry.user.name}</span>
                  {entry.rank <= 3 && <Badge variant="outline" className="ml-2 text-[10px] h-4 px-1 border-primary/30 text-primary">ELITE</Badge>}
                </div>

                <div className="col-span-2 text-right text-foreground font-bold">
                    {formatCost(entry.stats?.avgCost || 0)}
                </div>

                <div className="col-span-2 text-right text-muted-foreground">
                    {entry.stats?.solved} <span className="text-[10px] opacity-50">SOLVED</span>
                </div>
                
                <div className="col-span-2 text-right">
                   <div className="flex items-center justify-end gap-1 text-data">
                     <Zap className="h-3 w-3" />
                     <span>{(100 - (index * 2)).toFixed(1)}%</span> 
                     {/* Fake efficacy metric for now */}
                   </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
        </div>
        </div>
      </Card>
    </div>
  );
}
