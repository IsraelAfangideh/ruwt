'use client';

import { MODEL_PRICING, type ModelTier, type ModelPricing } from '@/lib/ai/pricing';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
}

const tierColors: Record<ModelTier, string> = {
  budget: 'bg-green-500/10 text-green-500',
  mid: 'bg-blue-500/10 text-blue-500',
  premium: 'bg-purple-500/10 text-purple-500',
};

const tierLabels: Record<ModelTier, string> = {
  budget: 'Budget',
  mid: 'Mid',
  premium: 'Premium',
};

function formatPrice(pricing: ModelPricing): string {
  const avgPrice = (pricing.input + pricing.output) / 2;
  if (avgPrice < 0.1) {
    return `$${avgPrice.toFixed(3)}/1M`;
  }
  return `$${avgPrice.toFixed(2)}/1M`;
}

export function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
  const models = Object.entries(MODEL_PRICING);

  // Group models by tier
  const groupedModels = models.reduce((acc, [id, pricing]) => {
    if (!acc[pricing.tier]) {
      acc[pricing.tier] = [];
    }
    acc[pricing.tier].push({ id, ...pricing });
    return acc;
  }, {} as Record<ModelTier, Array<{ id: string } & ModelPricing>>);

  const tiers: ModelTier[] = ['budget', 'mid', 'premium'];

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a model" />
      </SelectTrigger>
      <SelectContent>
        {tiers.map((tier) => (
          <div key={tier}>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              {tierLabels[tier]} Tier
            </div>
            {groupedModels[tier]?.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                <div className="flex items-center justify-between w-full gap-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={tierColors[tier]}>
                      {tierLabels[tier]}
                    </Badge>
                    <span>{model.displayName}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatPrice(model)}
                  </span>
                </div>
              </SelectItem>
            ))}
          </div>
        ))}
      </SelectContent>
    </Select>
  );
}
