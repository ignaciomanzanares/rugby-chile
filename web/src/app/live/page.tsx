"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Radio, Trophy, Clock } from "lucide-react";
import { connectSocket, disconnectSocket, subscribeToMatch, ScoreUpdate } from "@/lib/socket";

interface LiveMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeTries: number;
  awayTries: number;
  minute: number;
  division: string;
  venue: string;
  events: MatchEvent[];
}

interface MatchEvent {
  team: "home" | "away";
  type: string;
  minute: number;
  playerName: string;
}

export default function LivePage() {
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);

  useEffect(() => {
    connectSocket();

    // Sample live match data
    setLiveMatches([
      {
        id: "1",
        homeTeam: "Old Boys",
        awayTeam: "COBS",
        homeScore: 24,
        awayScore: 17,
        homeTries: 3,
        awayTries: 2,
        minute: 67,
        division: "PRIMERA",
        venue: "Cancha Old Boys",
        events: [
          { team: "home", type: "TRY", minute: 12, playerName: "J. González" },
          { team: "away", type: "TRY", minute: 23, playerName: "M. Silva" },
          { team: "home", type: "TRY", minute: 35, playerName: "A. Pérez" },
          { team: "home", type: "CONVERSION", minute: 36, playerName: "" },
          { team: "away", type: "TRY", minute: 48, playerName: "R. Fernández" },
          { team: "home", type: "TRY", minute: 55, playerName: "L. Martínez" },
          { team: "home", type: "CONVERSION", minute: 56, playerName: "" },
          { team: "away", type: "PENALTY", minute: 62, playerName: "" },
        ],
      },
    ]);

    return () => {
      disconnectSocket();
    };
  }, []);

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
            <Radio className="h-8 w-8 text-red-500 animate-pulse" />
            Partidos en Vivo
          </h1>
          <p className="text-muted-foreground mt-2">
            Resultados en tiempo real
          </p>
        </div>

        <div className="grid gap-6">
          {liveMatches.map((match) => (
            <Card key={match.id} className="border-red-500/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5" />
                    {match.division}
                  </CardTitle>
                  <Badge variant="destructive" className="gap-1">
                    <Radio className="h-3 w-3" />
                    {match.minute}'
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{match.venue}</p>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Scoreboard */}
                <div className="flex items-center justify-between py-8 px-4 bg-muted/50 rounded-lg">
                  <div className="text-center flex-1">
                    <div className="w-24 h-24 mx-auto bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-3xl mb-3">
                      {match.homeTeam.slice(0, 2).toUpperCase()}
                    </div>
                    <h2 className="text-2xl font-bold">{match.homeTeam}</h2>
                    <p className="text-sm text-muted-foreground">{match.homeTries} tries</p>
                  </div>

                  <div className="text-center px-8">
                    <div className="text-6xl font-bold tabular-nums">
                      {match.homeScore} - {match.awayScore}
                    </div>
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <Clock className="h-5 w-5 text-red-500" />
                      <Badge variant="destructive" className="text-lg px-4 py-1">
                        {match.minute}'
                      </Badge>
                    </div>
                  </div>

                  <div className="text-center flex-1">
                    <div className="w-24 h-24 mx-auto bg-secondary rounded-full flex items-center justify-center font-bold text-3xl">
                      {match.awayTeam.slice(0, 2).toUpperCase()}
                    </div>
                    <h2 className="text-2xl font-bold mt-3">{match.awayTeam}</h2>
                    <p className="text-sm text-muted-foreground">{match.awayTries} tries</p>
                  </div>
                </div>

                {/* Event Timeline */}
                <div className="space-y-2">
                  <h3 className="font-semibold mb-4">Cronología del Partido</h3>
                  <div className="space-y-2">
                    {match.events.map((event, index) => (
                      <div
                        key={index}
                        className={`flex items-center gap-4 p-3 rounded-lg ${
                          event.team === "home" ? "bg-primary/5" : "bg-secondary/5"
                        }`}
                      >
                        <Badge variant="outline">{event.minute}'</Badge>
                        <div className="flex-1">
                          <span className="font-medium">
                            {event.team === "home" ? match.homeTeam : match.awayTeam}
                          </span>
                          <span className="text-muted-foreground">{" - "}</span>
                          <span>
                            {event.type === "TRY" && "Try"}
                            {event.type === "CONVERSION" && "Conversión"}
                            {event.type === "PENALTY" && "Penal"}
                            {event.type === "DROP_GOAL" && "Drop"}
                            {event.type === "YELLOW_CARD" && "Tarjeta Amarilla"}
                            {event.type === "RED_CARD" && "Tarjeta Roja"}
                          </span>
                        </div>
                        {event.playerName && (
                          <span className="text-sm text-muted-foreground">
                            {event.playerName}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
