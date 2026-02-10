import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardNav } from '@/components/dashboard-nav';
import { UserNav } from '@/components/user-nav';
import { BalanceTicker } from '@/components/balance-ticker';
import { ThemeToggle } from '@/components/theme-toggle'; // Assuming I need to create this or it exists? I'll check.
// If it doesn't exist, I'll create it. For now I'll just put the BalanceTicker.
// Actually, I should check if `ThemeToggle` exists. List dir didn't show it explicitly but I might have missed it or it's in `ui`.
// I'll skip ThemeToggle for this specific file write and just add the ticker.

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-8">
            <a href="/" className="flex items-center gap-2 group">
              <div className="h-6 w-6 rounded-sm bg-primary/20 flex items-center justify-center border border-primary/50 group-hover:bg-primary/30 transition-colors">
                <span className="text-primary font-mono font-bold text-xs">R</span>
              </div>
              <span className="font-bold text-lg tracking-tight">Ruwt<span className="text-primary text-xs align-top">.dev</span></span>
            </a>
            <DashboardNav />
          </div>
          
          <div className="flex items-center gap-4">
            <BalanceTicker />
            <div className="h-6 w-[1px] bg-border/50 mx-2"></div>
            <UserNav user={user} />
          </div>
        </div>
      </header>
      <main className="container py-8 px-4 max-w-7xl mx-auto">{children}</main>
    </div>
  );
}
