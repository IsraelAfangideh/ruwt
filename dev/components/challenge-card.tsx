"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowUpRight, Clock, Coins, Cpu } from "lucide-react";

interface Challenge {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard' | string;
  max_tokens: number | null;
  max_cost: number | null;
  wall_clock_limit: number | null;
}

const difficultyColors = {
  easy: 'bg-profit/10 text-profit border-profit/20',
  medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  hard: 'bg-loss/10 text-loss border-loss/20',
};

export function ChallengeCard({ challenge }: { challenge: Challenge }) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <Card className="group relative overflow-hidden border-border bg-card/50 backdrop-blur-sm transition-colors hover:border-primary/50 hover:shadow-[0_0_30px_-10px_var(--primary)] h-full flex flex-col">
        
        {/* Decorative corner accents */}
        <div className="absolute top-0 right-0 p-3 opacity-50 group-hover:opacity-100 transition-opacity">
           <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
        </div>

        <CardHeader className="pb-3">
          <div className="flex items-center justify-between mb-2">
            <Badge 
              variant="outline" 
              className={`uppercase tracking-wider font-mono text-[10px] ${difficultyColors[challenge.difficulty as keyof typeof difficultyColors] || 'text-muted-foreground'}`}
            >
              {challenge.difficulty}
            </Badge>
            {challenge.max_cost != null && (
              <div className="flex items-center gap-1 font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                <Coins className="h-3 w-3" />
                <span>${(challenge.max_cost / 10000).toFixed(4)}</span>
              </div>
            )}
          </div>
          <CardTitle className="text-lg font-bold tracking-tight group-hover:text-primary transition-colors">
            {challenge.title}
          </CardTitle>
          <CardDescription className="line-clamp-2 text-xs font-mono opacity-80 mt-1">
            {challenge.description}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="flex-1">
          <div className="grid grid-cols-2 gap-2 text-xs font-mono text-muted-foreground">
            {challenge.max_tokens != null && (
              <div className="flex items-center gap-1.5 p-1.5 rounded-md bg-secondary/50">
                <Cpu className="h-3 w-3" />
                <span className="truncate">{challenge.max_tokens.toLocaleString()} toks</span>
              </div>
            )}
            {challenge.wall_clock_limit != null && (
              <div className="flex items-center gap-1.5 p-1.5 rounded-md bg-secondary/50">
                <Clock className="h-3 w-3" />
                <span>{Math.floor(challenge.wall_clock_limit / 60)}m</span>
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="pt-3 border-t bg-muted/20">
          <Button asChild className="w-full font-mono text-xs uppercase tracking-widest hover:bg-primary hover:text-primary-foreground transition-all" size="sm" variant="ghost">
            <Link href={`/arena/${challenge.id}`}>
              Initialize Contract
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
