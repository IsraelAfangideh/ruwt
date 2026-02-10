"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowRight, Clock, CheckCircle2, Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress";

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
  easy: 'bg-teal-500/10 text-teal-600 border-teal-200 dark:bg-teal-500/20 dark:text-teal-400 dark:border-teal-500/30',
  medium: 'bg-sky-500/10 text-sky-600 border-sky-200 dark:bg-sky-500/20 dark:text-sky-400 dark:border-sky-500/30',
  hard: 'bg-purple-500/10 text-purple-600 border-purple-200 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/30',
};

export function ChallengeCard({ challenge }: { challenge: Challenge }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="h-full"
    >
      <Card className="flex flex-col h-full border-border/60 bg-card hover:border-primary/30 transition-colors shadow-sm hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start mb-2">
            <Badge 
              variant="outline" 
              className={`capitalize font-medium text-[10px] px-2 py-0.5 border ${difficultyColors[challenge.difficulty as keyof typeof difficultyColors] || 'text-muted-foreground'}`}
            >
              {challenge.difficulty}
            </Badge>
            {/* Placeholder for completion status if available later */}
            <div className="text-muted-foreground/30">
                <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <CardTitle className="text-lg font-semibold tracking-tight text-foreground">
            {challenge.title}
          </CardTitle>
          <CardDescription className="line-clamp-2 text-sm text-muted-foreground mt-1">
            {challenge.description}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="flex-1">
           {/* Learning Metrics */}
           <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase text-muted-foreground font-medium">Avg. Time</span>
                    <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span>35m</span>
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                     <span className="text-[10px] uppercase text-muted-foreground font-medium">Pass Rate</span>
                     <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                        <Zap className="h-3 w-3 text-warning" />
                        <span>78%</span>
                     </div>
                </div>
           </div>
           
           <div className="mt-4 space-y-1.5">
               <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                  <span>Efficiency Goal</span>
                  <span>${challenge.max_cost ? (challenge.max_cost / 10000).toFixed(4) : 'N/A'}</span>
               </div>
               <Progress value={Math.random() * 60 + 20} className="h-1" />
           </div>
        </CardContent>

        <CardFooter className="pt-3 border-t border-border/40 bg-muted/5">
          <Button asChild className="w-full text-xs font-semibold" size="sm" variant="secondary">
            <Link href={`/arena/${challenge.id}`} className="group flex items-center justify-center gap-2">
              Start Problem
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
