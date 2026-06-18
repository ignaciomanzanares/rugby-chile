"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Trophy, Users, Radio, ChevronLeft, UserCheck } from "lucide-react";

const adminNav = [
  { name: "Dashboard",  href: "/admin/dashboard", icon: LayoutDashboard },
  { name: "Partidos",   href: "/admin/matches",   icon: Trophy },
  { name: "Equipos",    href: "/admin/teams",      icon: Users },
  { name: "Puntuación", href: "/admin/scoring",    icon: Radio },
  { name: "Formaciones", href: "/admin/lineups",   icon: UserCheck },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">

      {/* Sidebar */}
      <aside className="w-full md:w-60 border-b md:border-b-0 md:border-r border-border bg-card/60 md:min-h-screen flex-shrink-0">
        <div className="px-5 py-4 border-b border-border flex items-center gap-3">
          <Image src="/top10-itau-logo.png" alt="itaú Top 10 by Entel" width={40} height={40} className="h-10 w-auto object-contain flex-shrink-0" />
          <div>
            <p className="text-sm font-black tracking-tight">Admin</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Top 10 · 2026</p>
          </div>
        </div>

        <nav className="p-3 space-y-0.5">
          {adminNav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  active
                    ? "bg-red-600/20 text-red-400 border border-red-600/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 md:absolute md:bottom-0 md:w-60 border-t border-border mt-4 md:mt-0">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Volver al sitio
          </Link>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 p-5 md:p-8 overflow-auto">
        {children}
      </main>
    </div>
  );
}
