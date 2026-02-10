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
      <div className="flex flex-col gap-2 border-b border-border/40 pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Problem <span className="text-primary">Sets</span>
        </h1>
        <p className="text-muted-foreground text-sm flex items-center gap-2">
          Master the art of prompt engineering through practical challenges.
        </p>
      </div>

      {allChallenges.length === 0 ? (
        <Card className="border-dashed border-2 bg-muted/10 shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <h3 className="text-lg font-medium text-foreground">No Challenges Available</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Check back later for new course modules.
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
