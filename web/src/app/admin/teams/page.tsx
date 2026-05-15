"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, Edit, Trophy, MapPin } from "lucide-react";

const clubs = [
  {
    id: "1",
    name: "Old Boys",
    shortName: "OB",
    location: "Santiago",
    founded: 1926,
    teams: 3,
    players: 75,
    position: 1,
  },
  {
    id: "2",
    name: "COBS",
    shortName: "COBS",
    location: "Santiago",
    founded: 1939,
    teams: 3,
    players: 68,
    position: 2,
  },
  {
    id: "3",
    name: "Universidad de Chile",
    shortName: "U de Chile",
    location: "Santiago",
    founded: 1945,
    teams: 3,
    players: 72,
    position: 3,
  },
];

export default function TeamsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Equipos</h1>
          <p className="text-muted-foreground">Administrar clubes y jugadores</p>
        </div>
        <Button>
          <Users className="mr-2 h-4 w-4" />
          Agregar Club
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {clubs.map((club) => (
          <Card key={club.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg mb-3"
                    style={{ backgroundColor: "#1a365d" }}
                  >
                    {club.shortName[0]}
                  </div>
                  <h3 className="font-bold text-lg">{club.name}</h3>
                  <p className="text-sm text-muted-foreground">{club.shortName}</p>
                </div>
                <Badge variant="secondary">#{club.position}</Badge>
              </div>

              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {club.location}
                </div>
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  Fundado en {club.founded}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-4 text-sm">
                <div>
                  <span className="font-bold">{club.teams}</span>{" "}
                  <span className="text-muted-foreground">equipos</span>
                </div>
                <div>
                  <span className="font-bold">{club.players}</span>{" "}
                  <span className="text-muted-foreground">jugadores</span>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Edit className="mr-1 h-3 w-3" />
                  Editar
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <Users className="mr-1 h-3 w-3" />
                  Jugadores
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
