"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, Trash2, Calendar } from "lucide-react";

// Sample data
const matches = [
  {
    id: "1",
    homeTeam: "Old Boys",
    awayTeam: "COBS",
    date: "2025-04-15",
    time: "16:00",
    division: "PRIMERA",
    status: "SCHEDULED",
    venue: "Cancha Old Boys",
  },
  {
    id: "2",
    homeTeam: "U de Chile",
    awayTeam: "Old Grangonian",
    date: "2025-04-15",
    time: "16:00",
    division: "PRIMERA",
    status: "SCHEDULED",
    venue: "Cancha U de Chile",
  },
  {
    id: "3",
    homeTeam: "Old Boys",
    awayTeam: "COBS",
    date: "2025-04-08",
    time: "16:00",
    division: "PRIMERA",
    status: "FINISHED",
    venue: "Cancha Old Boys",
    homeScore: 24,
    awayScore: 17,
  },
];

const divisions = [
  { value: "PRIMERA", label: "Primera" },
  { value: "INTERMEDIA", label: "Intermedia" },
  { value: "PRE_INTERMEDIA", label: "Pre-Intermedia" },
];

const teams = [
  { id: "1", name: "Old Boys" },
  { id: "2", name: "COBS" },
  { id: "3", name: "U de Chile" },
  { id: "4", name: "Old Grangonian" },
  { id: "5", name: "Stade Français" },
  { id: "6", name: "PWCC" },
  { id: "7", name: "Troncos" },
  { id: "8", name: "Los Lobos" },
  { id: "9", name: "SOD" },
  { id: "10", name: "U Católica" },
];

export default function MatchesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Partidos</h1>
          <p className="text-muted-foreground">Crear y editar partidos</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Crear Partido
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Nuevo Partido</DialogTitle>
            </DialogHeader>
            <form className="space-y-4 mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>División</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {divisions.map((div) => (
                        <SelectItem key={div.value} value={div.value}>
                          {div.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Fecha</Label>
                  <Input type="date" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Equipo Local</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar equipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Equipo Visitante</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar equipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Hora</Label>
                  <Input type="time" defaultValue="16:00" />
                </div>

                <div className="space-y-2">
                  <Label>Cancha</Label>
                  <Input placeholder="Nombre de la cancha" />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">Crear Partido</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Partido</TableHead>
                <TableHead>División</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matches.map((match) => (
                <TableRow key={match.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{match.date}</p>
                        <p className="text-sm text-muted-foreground">
                          {match.time}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {match.homeTeam} vs {match.awayTeam}
                    </div>
                    {match.status === "FINISHED" && (
                      <div className="text-sm text-muted-foreground">
                        Resultado: {match.homeScore} - {match.awayScore}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{match.division}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        match.status === "FINISHED"
                          ? "default"
                          : match.status === "LIVE"
                          ? "destructive"
                          : "outline"
                      }
                    >
                      {match.status === "SCHEDULED" && "Programado"}
                      {match.status === "LIVE" && "En Vivo"}
                      {match.status === "FINISHED" && "Finalizado"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
