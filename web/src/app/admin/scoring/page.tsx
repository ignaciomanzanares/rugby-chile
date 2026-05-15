"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Radio, Play, Pause, RotateCcw, Plus, Trophy } from "lucide-react";

// Sample data - replace with API data
const divisions = [
  { value: "PRIMERA", label: "Primera" },
  { value: "INTERMEDIA", label: "Intermedia" },
  { value: "PRE_INTERMEDIA", label: "Pre-Intermedia" },
];

const teams = [
  { id: "1", name: "Old Boys", shortName: "OB" },
  { id: "2", name: "COBS", shortName: "COBS" },
  { id: "3", name: "U de Chile", shortName: "UCH" },
  { id: "4", name: "Old Grangonian", shortName: "OGC" },
  { id: "5", name: "Stade Français", shortName: "STA" },
  { id: "6", name: "PWCC", shortName: "PWC" },
];

const eventTypes = [
  { value: "TRY", label: "Try", points: 5 },
  { value: "CONVERSION", label: "Conversión", points: 2 },
  { value: "PENALTY", label: "Penal", points: 3 },
  { value: "DROP_GOAL", label: "Drop", points: 3 },
  { value: "YELLOW_CARD", label: "Tarjeta Amarilla", points: 0 },
  { value: "RED_CARD", label: "Tarjeta Roja", points: 0 },
];

export default function ScoringPage() {
  const [matchStarted, setMatchStarted] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [minute, setMinute] = useState(0);
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [selectedMatch, setSelectedMatch] = useState(<string | null>(null);
  const [events, setEvents] = useState<any[]>([]);

  const startMatch = () => {
    setMatchStarted(true);
    setIsRunning(true);
  };

  const toggleTimer = () => {
    setIsRunning(!isRunning);
  };

  const addEvent = (team: "home" | "away", type: string) => {
    const eventType = eventTypes.find((e) => e.value === type);
    const points = eventType?.points || 0;

    const newEvent = {
      id: Date.now(),
      team,
      type,
      minute,
      points,
      timestamp: new Date(),
    };

    setEvents([...events, newEvent]);

    if (team === "home") {
      setHomeScore(homeScore + points);
    } else {
      setAwayScore(awayScore + points);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Radio className="h-6 w-6" />
            Puntuación en Vivo
          </h1>
          <p className="text-muted-foreground">Marca partidos en tiempo real</p>
        </div>
      </div>

      {!matchStarted ? (
        <Card>
          <CardHeader>
            <CardTitle>Seleccionar Partido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-sm font-medium">División</label>
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

              <div>
                <label className="text-sm font-medium">Equipo Local</label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
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

              <div>
                <label className="text-sm font-medium">Equipo Visitante</label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
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
            </div>

            <Button onClick={startMatch} className="w-full">
              <Play className="mr-2 h-4 w-4" />
              Iniciar Partido
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Scoreboard */}
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="p-8">
              <div className="flex items-center justify-between">
                <div className="text-center flex-1">
                  <div className="w-20 h-20 mx-auto bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-2xl mb-3">
                    OB
                  </div>
                  <h2 className="text-xl font-bold">Old Boys</h2>
                  <p className="text-sm text-muted-foreground">Local</p>
                </div>

                <div className="text-center px-8">
                  <div className="text-6xl font-bold tabular-nums">
                    {homeScore} - {awayScore}
                  </div>
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <Badge variant={isRunning ? "destructive" : "secondary"} className="text-lg px-4 py-1">
                      <Radio className="mr-2 h-4 w-4" />
                      {minute}'
                    </Badge>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={toggleTimer}
                    >
                      {isRunning ? (
                        <>
                          <Pause className="mr-1 h-4 w-4" />
                          Pausar
                        </>
                      ) : (
                        <>
                          <Play className="mr-1 h-4 w-4" />
                          Continuar
                        </>
                      )}
                    </Button>
                    <Button variant="outline" size="sm">
                      <RotateCcw className="mr-1 h-4 w-4" />
                      Reiniciar
                    </Button>
                  </div>
                </div>

                <div className="text-center flex-1">
                  <div className="w-20 h-20 mx-auto bg-secondary rounded-full flex items-center justify-center font-bold text-2xl mb-3">
                    CO
                  </div>
                  <h2 className="text-xl font-bold">COBS</h2>
                  <p className="text-sm text-muted-foreground">Visita</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Event Controls */}
            <Card>
              <CardHeader>
                <CardTitle>Registrar Evento</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="home" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="home">Old Boys (Local)</TabsTrigger>
                    <TabsTrigger value="away">COBS (Visita)</TabsTrigger>
                  </TabsList>

                  <TabsContent value="home" className="space-y-2">
                    {eventTypes.map((event) => (
                      <Button
                        key={event.value}
                        variant="outline"
                        className="w-full justify-between"
                        onClick={() => addEvent("home", event.value)}
                      >
                        <span>{event.label}</span>
                        {event.points > 0 && (
                          <Badge variant="secondary">+{event.points}</Badge>
                        )}
                      </Button>
                    ))}
                  </TabsContent>

                  <TabsContent value="away" className="space-y-2">
                    {eventTypes.map((event) => (
                      <Button
                        key={event.value}
                        variant="outline"
                        className="w-full justify-between"
                        onClick={() => addEvent("away", event.value)}
                      >
                        <span>{event.label}</span>
                        {event.points > 0 && (
                          <Badge variant="secondary">+{event.points}</Badge>
                        )}
                      </Button>
                    ))}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Event Log */}
            <Card>
              <CardHeader>
                <CardTitle>Registro de Eventos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {events.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No hay eventos registrados
                    </p>
                  ) : (
                    [...events].reverse().map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between p-2 border rounded"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{event.minute}'</Badge>
                          <span>
                            {event.team === "home" ? "Old Boys" : "COBS"}
                          </span>
                          <span className="font-medium">
                            {eventTypes.find((e) => e.value === event.type)?.label}
                          </span>
                        </div>
                        {event.points > 0 && (
                          <Badge>+{event.points}</Badge>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-3">
            <Button variant="outline">Guardar Progreso</Button>
            <Button variant="default">
              <Trophy className="mr-2 h-4 w-4" />
              Finalizar Partido
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
