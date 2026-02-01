'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
}

interface Challenge {
  id: string;
  title: string;
  difficulty: string;
}

export default function LeaderboardPage() {
  const [globalEntries, setGlobalEntries] = useState<LeaderboardEntry[]>([]);
  const [challengeEntries, setChallengeEntries] = useState<LeaderboardEntry[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const res = await fetch('/api/leaderboard');
        const data = await res.json();
        setGlobalEntries(data.entries || []);
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboard();
  }, []);

  useEffect(() => {
    if (selectedChallenge) {
      async function fetchChallengeLeaderboard() {
        try {
          const res = await fetch(`/api/leaderboard?challengeId=${selectedChallenge}`);
          const data = await res.json();
          setChallengeEntries(data.entries || []);
        } catch (error) {
          console.error('Failed to fetch challenge leaderboard:', error);
        }
      }

      fetchChallengeLeaderboard();
    }
  }, [selectedChallenge]);

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Badge className="bg-yellow-500">1st</Badge>;
    if (rank === 2) return <Badge className="bg-gray-400">2nd</Badge>;
    if (rank === 3) return <Badge className="bg-amber-600">3rd</Badge>;
    return <Badge variant="outline">{rank}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
        <p className="text-muted-foreground">
          See who&apos;s solving challenges at the lowest cost
        </p>
      </div>

      <Tabs defaultValue="global" className="space-y-4">
        <TabsList>
          <TabsTrigger value="global">Global Rankings</TabsTrigger>
          <TabsTrigger value="challenges">By Challenge</TabsTrigger>
        </TabsList>

        <TabsContent value="global" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Performers</CardTitle>
              <CardDescription>
                Users ranked by challenges solved and average cost efficiency
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : globalEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-muted-foreground">
                    No rankings yet. Be the first to complete a challenge!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {globalEntries.map((entry) => (
                    <div
                      key={entry.user.id}
                      className="flex items-center justify-between p-4 rounded-lg border"
                    >
                      <div className="flex items-center gap-4">
                        {getRankBadge(entry.rank)}
                        <Avatar>
                          <AvatarImage src={entry.user.avatarUrl} />
                          <AvatarFallback>
                            {entry.user.name?.[0]?.toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{entry.user.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {entry.stats?.solved} challenges solved
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {formatCost(entry.stats?.avgCost || 0)} avg
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {entry.stats?.attempts} attempts
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="challenges" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Challenge Leaderboards</CardTitle>
              <CardDescription>
                Best solutions for each challenge by cost
              </CardDescription>
            </CardHeader>
            <CardContent>
              {challengeEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-muted-foreground">
                    Select a challenge to see its leaderboard
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {challengeEntries.map((entry) => (
                    <div
                      key={entry.user.id}
                      className="flex items-center justify-between p-4 rounded-lg border"
                    >
                      <div className="flex items-center gap-4">
                        {getRankBadge(entry.rank)}
                        <Avatar>
                          <AvatarImage src={entry.user.avatarUrl} />
                          <AvatarFallback>
                            {entry.user.name?.[0]?.toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <p className="font-medium">{entry.user.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCost(entry.cost || 0)}</p>
                        <p className="text-sm text-muted-foreground">
                          {entry.tokens?.toLocaleString()} tokens
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
