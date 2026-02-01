import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { creditsToDollars } from '@/lib/stripe';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // TODO: Fetch profile data from database
  const credits = 0;
  const challengesSolved = 0;
  const totalAttempts = 0;
  const averageCost = 0;

  const initials = user.user_metadata?.name
    ? user.user_metadata.name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
    : user.email?.[0].toUpperCase() || '?';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">
          View your stats and manage your account
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user.user_metadata?.avatar_url} />
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-lg font-medium">
                  {user.user_metadata?.name || 'User'}
                </p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Credits</span>
              <Badge variant="secondary" className="text-lg">
                ${creditsToDollars(credits)}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
            <CardDescription>Your performance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-2xl font-bold">{challengesSolved}</p>
                <p className="text-xs text-muted-foreground">Challenges Solved</p>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold">{totalAttempts}</p>
                <p className="text-xs text-muted-foreground">Total Attempts</p>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold">
                  ${averageCost > 0 ? (averageCost / 10000).toFixed(4) : '0.00'}
                </p>
                <p className="text-xs text-muted-foreground">Avg Cost/Solve</p>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold">-</p>
                <p className="text-xs text-muted-foreground">Global Rank</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your latest challenge attempts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-muted-foreground">
              No activity yet. Start a challenge to see your history here.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
