import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { ChallengeCard } from '@/components/challenge-card';

// Redefine locally or import if shared (keeping local for now based on original file)
type ChallengeRow = {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  max_tokens: number | null;
  max_cost: number | null;
  wall_clock_limit: number | null;
};

export default async function ChallengesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('challenges')
    .select('*')
    .order('created_at', { ascending: true });
  const allChallenges: ChallengeRow[] = data ?? [];

  return (
    <div className="space-y-8 p-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2 border-b pb-6">
        <h1 className="text-4xl font-extrabold tracking-tighter text-foreground">
          MARKET <span className="text-primary">OPPORTUNITIES</span>
        </h1>
        <p className="text-muted-foreground font-mono text-sm uppercase tracking-widest flex items-center gap-2">
          <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          Live Bounty Feed
        </p>
      </div>

      {allChallenges.length === 0 ? (
        <Card className="border-dashed border-2 bg-transparent">
          <CardContent className="flex flex-col items-center justify-center py-24 text-center">
            <h3 className="text-xl font-mono text-muted-foreground">NO ACTIVE BOUNTIES</h3>
            <p className="text-sm text-muted-foreground/50 mt-2">
              The market is quiet. Check back later.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {allChallenges.map((challenge) => (
            <ChallengeCard key={challenge.id} challenge={challenge} />
          ))}
        </div>
      )}
    </div>
  );
}
