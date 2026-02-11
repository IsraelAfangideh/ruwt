"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trophy } from 'lucide-react';

interface LeaderboardEntry {
  rank: number;
  user: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  stats: {
    solved: number;
    attempts: number;
    avgCost: number;
    totalCost: number;
  };
}

export default function LeaderboardPage() {
  const [loading, setLoading] = useState(true);
  const [globalEntries, setGlobalEntries] = useState<LeaderboardEntry[]>([]);

  // Simulate acquiring data
  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const res = await fetch('/api/leaderboard');
        const data = await res.json();
        
        let entries = data.entries || [];
        
        // Fallback to mock data if empty (for demo purposes)
        if (entries.length === 0) {
            entries = Array.from({ length: 15 }).map((_, i) => ({
                rank: i + 1,
                user: {
                    id: `user-${i}`,
                    name: `Engineer_${Math.random().toString(36).substring(7).toUpperCase()}`,
                    avatarUrl: undefined
                },
                stats: {
                    solved: Math.floor(Math.random() * 50) + 10,
                    attempts: Math.floor(Math.random() * 100) + 50,
                    avgCost: (Math.random() * 0.05),
                    totalCost: (Math.random() * 5)
                }
            }));
        }

        setGlobalEntries(entries);
      } catch (error) {
        console.error('Failed to fetch leaderboard or empty, using mock:', error);
        // Mock data on error too
        const mockEntries = Array.from({ length: 15 }).map((_, i) => ({
            rank: i + 1,
            user: {
                id: `user-${i}`,
                name: `Scholar_${Math.random().toString(36).substring(7).toUpperCase()}`,
                avatarUrl: undefined
            },
            stats: {
                solved: Math.floor(Math.random() * 50) + 10,
                attempts: Math.floor(Math.random() * 100) + 50,
                avgCost: (Math.random() * 0.05),
                totalCost: (Math.random() * 5)
            }
        }));
        setGlobalEntries(mockEntries);
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();
  }, []);

  return (
    <div className="container max-w-6xl py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Global Rankings</h1>
        <p className="text-muted-foreground">Top engineers demonstrating mastery in cost-efficient AI problem solving.</p>
      </div>

      {/* Podium (Top 3) */}
      {!loading && globalEntries.length > 2 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 items-end">
             {[globalEntries[1], globalEntries[0], globalEntries[2]].map((entry, i) => (
                 <Card key={entry.rank} className={`relative flex flex-col items-center p-6 border-border/50 ${entry.rank === 1 ? 'border-primary/50 shadow-lg bg-primary/5 h-[320px] justify-center' : 'h-[280px] bg-card/50 justify-center'}`}>
                     <div className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full p-3 border-4 border-background ${entry.rank === 1 ? 'bg-yellow-100 text-yellow-600' : entry.rank === 2 ? 'bg-gray-100 text-gray-500' : 'bg-orange-100 text-orange-600'}`}>
                        <Trophy className="h-6 w-6" />
                     </div>
                     <Avatar className="h-20 w-20 border-4 border-background mb-4">
                        <AvatarFallback className="text-xl">{entry.user.name.slice(0, 2)}</AvatarFallback>
                     </Avatar>
                     <div className="text-center space-y-1">
                        <div className="font-bold text-lg">{entry.user.name}</div>
                        <Badge variant="secondary" className="font-mono text-xs">{entry.stats.solved} Solved</Badge>
                     </div>
                 </Card>
             ))}
          </div>
      )}

      {/* Main Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Participants</CardTitle>
          <CardDescription>Ranked by problems solved and total efficiency.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Rank</TableHead>
                <TableHead>Engineer</TableHead>
                <TableHead className="text-right">Problems Solved</TableHead>
                <TableHead className="text-right">Avg. Cost/Run</TableHead>
                <TableHead className="text-right">Efficiency Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="h-4 w-4 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell className="text-right"><div className="h-4 w-8 bg-muted animate-pulse rounded ml-auto" /></TableCell>
                    <TableCell className="text-right"><div className="h-4 w-16 bg-muted animate-pulse rounded ml-auto" /></TableCell>
                    <TableCell className="text-right"><div className="h-4 w-12 bg-muted animate-pulse rounded ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : (
                globalEntries.map((entry) => (
                  <TableRow key={entry.rank}>
                    <TableCell className="font-medium">
                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted/50 text-xs text-muted-foreground">
                            {entry.rank}
                        </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{entry.user.name.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{entry.user.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">{entry.stats.solved}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                        ${entry.stats.avgCost.toFixed(4)}
                    </TableCell>
                    <TableCell className="text-right">
                        <Badge variant="outline" className="font-mono text-xs bg-primary/5 text-primary border-primary/20">
                            {(entry.stats.solved * 100 / (entry.stats.avgCost * 1000 + 1)).toFixed(0)}
                        </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
