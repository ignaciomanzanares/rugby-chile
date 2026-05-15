import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Trophy,
  Users,
  Calendar,
  Radio,
  ArrowUpRight,
  Activity,
} from "lucide-react";
import Link from "next/link";

// Sample stats
const stats = [
  { name: "Partidos Hoy", value: "3", icon: Calendar, color: "text-blue-500" },
  { name: "En Vivo", value: "1", icon: Radio, color: "text-red-500" },
  { name: "Equipos", value: "30", icon: Trophy, color: "text-green-500" },
  { name: "Jugadores", value: "450+", icon: Users, color: "text-purple-500" },
];

const recentMatches = [
  {
    id: "1",
    home: "Old Boys",
    away: "COBS",
    score: "24-17",
    status: "FINISHED",
    division: "PRIMERA",
    date: "08/04/2025",
  },
  {
    id: "2",
    home: "U de Chile",
    away: "Old Grangonian",
    score: "31-14",
    status: "FINISHED",
    division: "PRIMERA",
    date: "08/04/2025",
  },
];

const upcomingMatches = [
  {
    id: "3",
    home: "Stade Français",
    away: "PWCC",
    time: "16:00",
    date: "15/04/2025",
    division: "PRIMERA",
  },
];

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Resumen de la Primera División</p>
        </div>
        <Link href="/admin/scoring">
          <Button>
            <Radio className="mr-2 h-4 w-4" />
            Marcar Partido
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.name}
                  </p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Matches */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Últimos Resultados</CardTitle>
            <Link href="/admin/matches">
              <Button variant="ghost" size="sm">
                Ver todos
                <ArrowUpRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentMatches.map((match) => (
                <div
                  key={match.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Activity className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="font-medium">
                        {match.home} vs {match.away}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {match.division} • {match.date}
                      </p>
                    </div>
                  </div>
                  <span className="font-bold">{match.score}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Matches */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Próximos Partidos</CardTitle>
            <Link href="/admin/scoring">
              <Button variant="ghost" size="sm">
                Marcar
                <ArrowUpRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingMatches.map((match) => (
                <div
                  key={match.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="font-medium">
                        {match.home} vs {match.away}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {match.date} • {match.time}
                      </p>
                    </div>
                  </div>
                  <Link href="/admin/scoring">
                    <Button size="sm" variant="outline">
                      <Radio className="mr-1 h-3 w-3" />
                      Marcar
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/matches">
              <Button variant="outline">
                <Trophy className="mr-2 h-4 w-4" />
                Crear Partido
              </Button>
            </Link>
            <Link href="/admin/teams">
              <Button variant="outline">
                <Users className="mr-2 h-4 w-4" />
                Gestionar Equipos
              </Button>
            </Link>
            <Link href="/admin/scoring">
              <Button variant="default">
                <Radio className="mr-2 h-4 w-4" />
                Iniciar Puntuación
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
