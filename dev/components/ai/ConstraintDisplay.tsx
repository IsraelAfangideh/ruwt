'use client';

import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCost } from '@/lib/ai/pricing';
import { getWarningThreshold } from '@/lib/ai/constraints';

interface Constraint {
  type: 'cost' | 'time';
  current: number;
  max: number;
  label: string;
}

interface ConstraintDisplayProps {
  constraints: Constraint[];
  expiresAt?: Date | null;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function ConstraintBar({ constraint }: { constraint: Constraint }) {
  const percent = Math.min((constraint.current / constraint.max) * 100, 100);
  const warning = getWarningThreshold(percent);

  const colors = {
    none: 'bg-primary',
    warning: 'bg-yellow-500',
    danger: 'bg-destructive',
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{constraint.label}</span>
        <div className="flex items-center gap-2">
          {warning !== 'none' && (
            <Badge variant={warning === 'danger' ? 'destructive' : 'secondary'} className="text-xs">
              {warning === 'danger' ? 'Critical' : 'Warning'}
            </Badge>
          )}
          <span className="font-medium">
            {constraint.type === 'cost'
              ? `${formatCost(constraint.current)} / ${formatCost(constraint.max)}`
              : `${formatTime(constraint.current)} / ${formatTime(constraint.max)}`}
          </span>
        </div>
      </div>
      <Progress value={percent} className={`h-2 ${colors[warning]}`} />
    </div>
  );
}

export function ConstraintDisplay({ constraints, expiresAt }: ConstraintDisplayProps) {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) return;

    const updateTime = () => {
      const now = new Date();
      const remaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
      setTimeRemaining(remaining);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  // Update time constraint with live countdown
  const displayConstraints = constraints.map((c) => {
    if (c.type === 'time' && timeRemaining !== null) {
      return { ...c, current: c.max - timeRemaining };
    }
    return c;
  });

  if (constraints.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Challenge Constraints</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {displayConstraints.map((constraint) => (
          <ConstraintBar key={constraint.type} constraint={constraint} />
        ))}
      </CardContent>
    </Card>
  );
}
