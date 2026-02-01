import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardNav } from '@/components/dashboard-nav';
import { UserNav } from '@/components/user-nav';

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
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex">
            <a href="/" className="mr-6 flex items-center space-x-2">
              <span className="font-bold text-xl">Ruwt</span>
            </a>
            <DashboardNav />
          </div>
          <div className="flex flex-1 items-center justify-end space-x-2">
            <UserNav user={user} />
          </div>
        </div>
      </header>
      <main className="container py-6">{children}</main>
    </div>
  );
}
