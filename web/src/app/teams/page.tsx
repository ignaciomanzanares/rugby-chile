import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, MapPin, Calendar } from "lucide-react";
import Link from "next/link";

// Sample data - replace with API call
const teams = [
  {
    id: "1",
    name: "Old Boys",
    shortName: "OB",
    slug: "old-boys",
    location: "Santiago",
    founded: 1926,
    stadium: "Cancha Old Boys",
    primaryColor: "#1a365d",
    division: "PRIMERA",
    position: 1,
    played: 8,
    points: 35,
  },
  {
    id: "2",
    name: "COBS",
    shortName: "COBS",
    slug: "cobs",
    location: "Santiago",
    founded: 1939,
    stadium: "Estadio COBS",
    primaryColor: "#c53030",
    division: "PRIMERA",
    position: 2,
    played: 8,
    points: 27,
  },
  {
    id: "3",
    name: "Universidad de Chile",
    shortName: "U de Chile",
    slug: "universidad-de-chile",
    location: "Santiago",
    founded: 1945,
    stadium: "Cancha U de Chile",
    primaryColor: "#1a365d",
    division: "PRIMERA",
    position: 3,
    played: 8,
    points: 25,
  },
  {
    id: "4",
    name: "Old Grangonian Club",
    shortName: "OGC",
    slug: "old-grangonian",
    location: "Santiago",
    founded: 1933,
    stadium: "Cancha OGC",
    primaryColor: "#2f855a",
    division: "PRIMERA",
    position: 4,
    played: 8,
    points: 21,
  },
  {
    id: "5",
    name: "Stade Français",
    shortName: "Stade",
    slug: "stade-francais",
    location: "Santiago",
    founded: 1945,
    stadium: "Cancha Stade",
    primaryColor: "#3182ce",
    division: "PRIMERA",
    position: 5,
    played: 8,
    points: 17,
  },
  {
    id: "6",
    name: "Prince of Wales CC",
    shortName: "PWCC",
    slug: "pwcc",
    location: "Santiago",
    founded: 1934,
    stadium: "Cancha PWCC",
    primaryColor: "#744210",
    division: "PRIMERA",
    position: 6,
    played: 8,
    points: 16,
  },
  {
    id: "7",
    name: "Troncos",
    shortName: "Troncos",
    slug: "troncos",
    location: "Concepción",
    founded: 1949,
    stadium: "Cancha Troncos",
    primaryColor: "#2d3748",
    division: "PRIMERA",
    position: 7,
    played: 8,
    points: 13,
  },
  {
    id: "8",
    name: "Los Lobos",
    shortName: "Lobos",
    slug: "los-lobos",
    location: "Santiago",
    founded: 1967,
    stadium: "Cancha Los Lobos",
    primaryColor: "#742a2a",
    division: "PRIMERA",
    position: 8,
    played: 8,
    points: 11,
  },
  {
    id: "9",
    name: "Society of Dublin",
    shortName: "SOD",
    slug: "sod",
    location: "Santiago",
    founded: 1948,
    stadium: "Cancha SOD",
    primaryColor: "#2b6cb0",
    division: "PRIMERA",
    position: 9,
    played: 8,
    points: 9,
  },
  {
    id: "10",
    name: "Universidad Católica",
    shortName: "UC",
    slug: "universidad-catolica",
    location: "Santiago",
    founded: 1949,
    stadium: "Cancha UC",
    primaryColor: "#1a365d",
    division: "PRIMERA",
    position: 10,
    played: 8,
    points: 5,
  },
];

export default function TeamsPage() {
  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            Equipos
          </h1>
          <p className="text-muted-foreground mt-2">
            Los 10 equipos de la Primera División
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Link key={team.id} href={`/teams/${team.slug}`}>
              <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer group">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl shrink-0"
                      style={{ backgroundColor: team.primaryColor }}
                    >
                      {team.shortName[0]}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-lg group-hover:text-primary transition-colors">
                            {team.name}
                          </h3>
                          <p className="text-sm text-muted-foreground">{team.shortName}</p>
                        </div>
                        <Badge variant="secondary">#{team.position}</Badge>
                      </div>

                      <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {team.location}
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Fundado en {team.founded}
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {team.played} partidos
                        </span>
                        <span className="font-bold text-lg">{team.points} pts</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
