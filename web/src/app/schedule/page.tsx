import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// Sample data
const rounds = [
  {
    round: 9,
    date: "15-16 Abril 2025",
    matches: [
      { id: "1", home: "Old Boys", away: "COBS", time: "16:00", venue: "Cancha Old Boys", division: "PRIMERA" },
      { id: "2", home: "U de Chile", away: "Old Grangonian", time: "16:00", venue: "Cancha U de Chile", division: "PRIMERA" },
      { id: "3", home: "Stade Français", away: "PWCC", time: "14:30", venue: "Cancha Stade", division: "PRIMERA" },
      { id: "4", home: "Troncos", away: "Los Lobos", time: "16:00", venue: "Cancha Troncos", division: "PRIMERA" },
      { id: "5", home: "SOD", away: "U Católica", time: "16:00", venue: "Cancha SOD", division: "PRIMERA" },
    ],
  },
  {
    round: 10,
    date: "22-23 Abril 2025",
    matches: [
      { id: "6", home: "COBS", away: "U de Chile", time: "16:00", venue: "Estadio COBS", division: "PRIMERA" },
      { id: "7", home: "Old Grangonian", away: "Old Boys", time: "16:00", venue: "Cancha OGC", division: "PRIMERA" },
      { id: "8", home: "PWCC", away: "Troncos", time: "16:00", venue: "Cancha PWCC", division: "PRIMERA" },
      { id: "9", home: "Los Lobos", away: "SOD", time: "16:00", venue: "Cancha Los Lobos", division: "PRIMERA" },
      { id: "10", home: "U Católica", away: "Stade Français", time: "14:30", venue: "Cancha UC", division: "PRIMERA" },
    ],
  },
];

export default function SchedulePage() {
  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
            <Calendar className="h-8 w-8 text-primary" />
            Fixture 2025
          </h1>
          <p className="text-muted-foreground mt-2">
            Calendario de partidos - Primera División
          </p>
        </div>

        <Tabs defaultValue="round-9" className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1 mb-6">
            {rounds.map((r) => (
              <TabsTrigger key={r.round} value={`round-${r.round}`} className="px-4">
                Fecha {r.round}
              </TabsTrigger>
            ))}
          </TabsList>

          {rounds.map((round) => (
            <TabsContent key={round.round} value={`round-${round.round}`}>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Fecha {round.round}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">{round.date}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon">
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {round.matches.map((match) => (
                      <div
                        key={match.id}
                        className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold">
                              {match.home[0]}
                            </div>
                            <span className="font-semibold">{match.home}</span>
                          </div>

                          <span className="text-muted-foreground font-medium">vs</span>

                          <div className="flex items-center gap-3 flex-1 justify-end">
                            <span className="font-semibold">{match.away}</span>
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold">
                              {match.away[0]}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground md:w-auto w-full justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            {match.time}
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            {match.venue}
                          </div>
                          <Badge variant="secondary">{match.division}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
