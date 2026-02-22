import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container flex h-14 items-center justify-between">
          <span className="font-bold text-xl">Ruwt</span>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container py-24 text-center">
        <Badge variant="secondary" className="mb-4">
          Beta
        </Badge>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
          Get Better at AI.
          <br />
          <span className="text-primary">Get Discovered.</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Practice AI-assisted coding with real models. Learn from the community.
          Let your skills speak for themselves.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button size="lg" asChild>
            <Link href="/register">Start Practicing</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/leaderboard">See the Community</Link>
          </Button>
        </div>
      </section>

      {/* How It Works */}
      <section className="container py-16">
        <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
        <div className="grid gap-8 md:grid-cols-3">
          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <span className="text-2xl font-bold text-primary">1</span>
              </div>
              <CardTitle>Pick a Challenge</CardTitle>
              <CardDescription>
                Browse coding challenges of varying difficulty. Each has
                constraints like token limits or time caps.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <span className="text-2xl font-bold text-primary">2</span>
              </div>
              <CardTitle>Prompt AI Models</CardTitle>
              <CardDescription>
                Choose from budget to premium models. Each token costs real
                money. Be strategic with your prompts.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <span className="text-2xl font-bold text-primary">3</span>
              </div>
              <CardTitle>Submit & Learn</CardTitle>
              <CardDescription>
                Your code is tested automatically. See where you stand,
                watch community replays, and let your skills get noticed.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Model Tiers */}
      <section className="container py-16 bg-muted/50">
        <h2 className="text-3xl font-bold text-center mb-4">Choose Your Strategy</h2>
        <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
          Multiple AI models at different price points. Cheap models are risky
          but cost-effective. Premium models are reliable but expensive.
        </p>
        <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <Badge variant="outline" className="w-fit mb-2">Budget</Badge>
              <CardTitle className="text-lg">Llama 3.1 / Mistral</CardTitle>
              <CardDescription>$0.01-0.02 per 1M tokens</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Open-source models via Cloudflare. Cheap but may struggle with
                complex tasks.
              </p>
            </CardContent>
          </Card>
          <Card className="border-primary">
            <CardHeader>
              <Badge className="w-fit mb-2">Mid Tier</Badge>
              <CardTitle className="text-lg">GPT-4o-mini / Haiku</CardTitle>
              <CardDescription>$0.15-0.80 per 1M tokens</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Balanced cost and quality. Good for most challenges.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Badge variant="secondary" className="w-fit mb-2">Premium</Badge>
              <CardTitle className="text-lg">GPT-4o / Claude Sonnet</CardTitle>
              <CardDescription>$2.50-15.00 per 1M tokens</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Top-tier reasoning. Expensive but reliable for hard problems.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-24 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to Get Better at AI?</h2>
        <p className="text-muted-foreground mb-8">
          Free practice. 60+ challenges. Hints when you're stuck. Get discovered by employers.
        </p>
        <Button size="lg" asChild>
          <Link href="/register">Create Free Account</Link>
        </Button>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Ruwt. All rights reserved.
          </p>
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <Link href="#" className="hover:underline">Terms</Link>
            <Link href="#" className="hover:underline">Privacy</Link>
            <Link href="#" className="hover:underline">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
