'use client';

import { formatCost } from '@/lib/ai/pricing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface CostTrackerProps {
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  callCount: number;
  userCredits: number;
}

export function CostTracker({
  totalCost,
  inputTokens,
  outputTokens,
  callCount,
  userCredits,
}: CostTrackerProps) {
  const remainingCredits = userCredits - totalCost;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Cost Tracker</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Session Cost</span>
          <span className="text-lg font-bold">{formatCost(totalCost)}</span>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Input Tokens</span>
            <p className="font-medium">{inputTokens.toLocaleString()}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Output Tokens</span>
            <p className="font-medium">{outputTokens.toLocaleString()}</p>
          </div>
          <div>
            <span className="text-muted-foreground">AI Calls</span>
            <p className="font-medium">{callCount}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Remaining Credits</span>
            <p className={`font-medium ${remainingCredits < 100 ? 'text-destructive' : ''}`}>
              {formatCost(remainingCredits)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
