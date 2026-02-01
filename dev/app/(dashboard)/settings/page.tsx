'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { CREDIT_PACKAGES, type CreditPackage } from '@/lib/stripe';
import { Badge } from '@/components/ui/badge';

export default function SettingsPage() {
  const [loading, setLoading] = useState<string | null>(null);

  const handlePurchaseCredits = async (packageId: string) => {
    setLoading(packageId);
    // TODO: Implement Stripe checkout
    alert('Stripe checkout coming soon!');
    setLoading(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and purchase credits
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Purchase Credits</CardTitle>
          <CardDescription>
            Credits are used to pay for AI model usage. 1 credit = $0.01
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {CREDIT_PACKAGES.map((pkg) => (
              <div
                key={pkg.id}
                className={`relative rounded-lg border p-4 ${
                  'popular' in pkg && pkg.popular ? 'border-primary' : ''
                }`}
              >
                {'popular' in pkg && pkg.popular && (
                  <Badge className="absolute -top-2 right-4">Most Popular</Badge>
                )}
                <div className="space-y-2">
                  <h3 className="font-semibold">{pkg.name}</h3>
                  <p className="text-2xl font-bold">
                    ${(pkg.price / 100).toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {pkg.description}
                  </p>
                  <Button
                    className="w-full"
                    variant={'popular' in pkg && pkg.popular ? 'default' : 'outline'}
                    onClick={() => handlePurchaseCredits(pkg.id)}
                    disabled={loading === pkg.id}
                  >
                    {loading === pkg.id ? 'Processing...' : 'Purchase'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account Settings</CardTitle>
          <CardDescription>Update your profile information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Display Name</Label>
            <Input id="name" placeholder="Your name" />
          </div>
          <Button>Save Changes</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danger Zone</CardTitle>
          <CardDescription>Irreversible account actions</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive">Delete Account</Button>
        </CardContent>
      </Card>
    </div>
  );
}
