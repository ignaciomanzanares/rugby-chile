import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Trophy,
  Users,
  Radio,
  ChevronLeft,
  Shield
} from "lucide-react";

const adminNav = [
  { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { name: "Partidos", href: "/admin/matches", icon: Trophy },
  { name: "Equipos", href: "/admin/teams", icon: Users },
  { name: "Puntuación", href: "/admin/scoring", icon: Radio },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col md:flex-row">
        {/* Sidebar */}
        <aside className="w-full md:w-64 border-r bg-muted/30 min-h-screen">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2 font-bold text-lg">
              <Shield className="h-5 w-5 text-primary" />
              Admin Panel
            </div>
          </div>

          <nav className="p-4 space-y-1">
            {adminNav.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t mt-auto">
            <Link href="/">
              <Button variant="ghost" size="sm" className="w-full">
                <ChevronLeft className="mr-2 h-4 w-4" />
                Volver al sitio
              </Button>
            </Link>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
