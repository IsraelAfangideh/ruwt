import { createClient } from '@/lib/supabase/server';
import { db, challenges } from '@/drizzle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const difficultyColors = {
  easy: 'bg-green-500/10 text-green-500 hover:bg-green-500/20',
  medium: 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20',
  hard: 'bg-red-500/10 text-red-500 hover:bg-red-500/20',
};

export default async function ChallengesPage() {
  let allChallenges: typeof challenges.$inferSelect[] = [];
  
  try {
    allChallenges = await db.select().from(challenges).orderBy(challenges.createdAt);
  } catch {
    // Database not set up yet, show empty state
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Challenges</h1>
          <p className="text-muted-foreground">
            Solve coding challenges using AI at the lowest cost possible
          </p>
        </div>
      </div>

      {allChallenges.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">No challenges yet</h3>
              <p className="text-muted-foreground max-w-sm">
                Challenges will appear here once they&apos;re added. Check back soon!
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {allChallenges.map((challenge) => (
            <Card key={challenge.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge className={difficultyColors[challenge.difficulty]}>
                    {challenge.difficulty}
                  </Badge>
                  {challenge.maxCost && (
                    <span className="text-xs text-muted-foreground">
                      Max: ${(challenge.maxCost / 10000).toFixed(2)}
                    </span>
                  )}
                </div>
                <CardTitle className="mt-2">{challenge.title}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {challenge.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-end">
                <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                  {challenge.maxTokens && (
                    <span>Max tokens: {challenge.maxTokens.toLocaleString()}</span>
                  )}
                  {challenge.wallClockLimit && (
                    <span>Time: {Math.floor(challenge.wallClockLimit / 60)}m</span>
                  )}
                </div>
                <Button asChild className="w-full">
                  <Link href={`/arena/${challenge.id}`}>Start Challenge</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
