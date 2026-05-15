import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy } from "lucide-react";

// Sample data - replace with API call
const standingsData = {
  PRIMERA: [
    { pos: 1, team: "Old Boys", pj: 8, pg: 8, pe: 0, pp: 0, pf: 245, pc: 89, diff: 156, lb: 1, tb: 2, pts: 35 },
    { pos: 2, team: "COBS", pj: 8, pg: 6, pe: 0, pp: 2, pf: 198, pc: 112, diff: 86, lb: 1, tb: 2, pts: 27 },
    { pos: 3, team: "U de Chile", pj: 8, pg: 5, pe: 1, pp: 2, pf: 187, pc: 134, diff: 53, lb: 2, tb: 1, pts: 25 },
    { pos: 4, team: "Old Grangonian", pj: 8, pg: 4, pe: 1, pp: 3, pf: 156, pc: 145, diff: 11, lb: 2, tb: 1, pts: 21 },
    { pos: 5, team: "Stade Français", pj: 8, pg: 4, pe: 0, pp: 4, pf: 142, pc: 156, diff: -14, lb: 0, tb: 1, pts: 17 },
    { pos: 6, team: "PWCC", pj: 8, pg: 3, pe: 1, pp: 4, pf: 134, pc: 167, diff: -33, lb: 2, tb: 0, pts: 16 },
    { pos: 7, team: "Troncos", pj: 8, pg: 2, pe: 2, pp: 4, pf: 128, pc: 178, diff: -50, lb: 1, tb: 0, pts: 13 },
    { pos: 8, team: "Los Lobos", pj: 8, pg: 2, pe: 1, pp: 5, pf: 112, pc: 198, diff: -86, lb: 1, tb: 0, pts: 11 },
    { pos: 9, team: "SOD", pj: 8, pg: 1, pe: 2, pp: 5, pf: 98, pc: 187, diff: -89, lb: 1, tb: 0, pts: 9 },
    { pos: 10, team: "U Católica", pj: 8, pg: 1, pe: 0, pp: 7, pf: 89, pc: 223, diff: -134, lb: 1, tb: 0, pts: 5 },
  ],
  INTERMEDIA: [
    { pos: 1, team: "Old Boys", pj: 6, pg: 6, pe: 0, pp: 0, pf: 178, pc: 67, diff: 111, lb: 0, tb: 2, pts: 26 },
    { pos: 2, team: "COBS", pj: 6, pg: 5, pe: 0, pp: 1, pf: 156, pc: 89, diff: 67, lb: 1, tb: 2, pts: 23 },
    { pos: 3, team: "U de Chile", pj: 6, pg: 4, pe: 0, pp: 2, pf: 134, pc: 98, diff: 36, lb: 1, tb: 1, pts: 18 },
    { pos: 4, team: "Old Grangonian", pj: 6, pg: 3, pe: 1, pp: 2, pf: 112, pc: 102, diff: 10, lb: 1, tb: 1, pts: 16 },
    { pos: 5, team: "PWCC", pj: 6, pg: 3, pe: 0, pp: 3, pf: 98, pc: 112, diff: -14, lb: 0, tb: 0, pts: 12 },
    { pos: 6, team: "Stade Français", pj: 6, pg: 2, pe: 1, pp: 3, pf: 87, pc: 123, diff: -36, lb: 2, tb: 0, pts: 12 },
  ],
  PRE_INTERMEDIA: [
    { pos: 1, team: "COBS", pj: 6, pg: 6, pe: 0, pp: 0, pf: 198, pc: 45, diff: 153, lb: 0, tb: 2, pts: 26 },
    { pos: 2, team: "Old Boys", pj: 6, pg: 5, pe: 0, pp: 1, pf: 156, pc: 78, diff: 78, lb: 1, tb: 2, pts: 23 },
    { pos: 3, team: "U de Chile", pj: 6, pg: 4, pe: 0, pp: 2, pf: 123, pc: 89, diff: 34, lb: 1, tb: 1, pts: 18 },
    { pos: 4, team: "Old Grangonian", pj: 6, pg: 3, pe: 0, pp: 3, pf: 98, pc: 112, diff: -14, lb: 2, tb: 0, pts: 14 },
    { pos: 5, team: "Stade Français", pj: 6, pg: 2, pe: 1, pp: 3, pf: 87, pc: 134, diff: -47, lb: 1, tb: 0, pts: 11 },
    { pos: 6, team: "PWCC", pj: 6, pg: 1, pe: 0, pp: 5, pf: 56, pc: 156, diff: -100, lb: 0, tb: 0, pts: 4 },
  ],
};

const divisionLabels: Record<string, string> = {
  PRIMERA: "Primera",
  INTERMEDIA: "Intermedia",
  PRE_INTERMEDIA: "Pre-Intermedia",
};

export default function StandingsPage() {
  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
            <Trophy className="h-8 w-8 text-primary" />
            Tablas de Posiciones
          </h1>
          <p className="text-muted-foreground mt-2">
            Temporada 2025 - Todas las categorías
          </p>
        </div>

        <Tabs defaultValue="PRIMERA" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="PRIMERA">Primera</TabsTrigger>
            <TabsTrigger value="INTERMEDIA">Intermedia</TabsTrigger>
            <TabsTrigger value="PRE_INTERMEDIA">Pre-Intermedia</TabsTrigger>
          </TabsList>

          {Object.entries(standingsData).map(([division, teams]) => (
            <TabsContent key={division} value={division}>
              <Card>
                <CardHeader>
                  <CardTitle>{divisionLabels[division]}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12 text-center">Pos</TableHead>
                          <TableHead>Equipo</TableHead>
                          <TableHead className="text-center">PJ</TableHead>
                          <TableHead className="text-center hidden sm:table-cell">PG</TableHead>
                          <TableHead className="text-center hidden sm:table-cell">PE</TableHead>
                          <TableHead className="text-center hidden sm:table-cell">PP</TableHead>
                          <TableHead className="text-center hidden md:table-cell">PF</TableHead>
                          <TableHead className="text-center hidden md:table-cell">PC</TableHead>
                          <TableHead className="text-center hidden lg:table-cell">Diff</TableHead>
                          <TableHead className="text-center hidden lg:table-cell">LB</TableHead>
                          <TableHead className="text-center hidden lg:table-cell">TB</TableHead>
                          <TableHead className="text-center font-bold">Pts</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teams.map((team) => (
                          <TableRow key={team.team}>
                            <TableCell className="text-center">
                              <span
                                className={`inline-flex w-6 h-6 items-center justify-center rounded text-xs font-bold ${
                                  team.pos <= 4
                                    ? "bg-primary text-primary-foreground"
                                    : team.pos === 5
                                    ? "bg-yellow-500 text-white"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {team.pos}
                              </span>
                            </TableCell>
                            <TableCell className="font-medium">{team.team}</TableCell>
                            <TableCell className="text-center">{team.pj}</TableCell>
                            <TableCell className="text-center hidden sm:table-cell">{team.pg}</TableCell>
                            <TableCell className="text-center hidden sm:table-cell">{team.pe}</TableCell>
                            <TableCell className="text-center hidden sm:table-cell">{team.pp}</TableCell>
                            <TableCell className="text-center hidden md:table-cell">{team.pf}</TableCell>
                            <TableCell className="text-center hidden md:table-cell">{team.pc}</TableCell>
                            <TableCell
                              className={`text-center hidden lg:table-cell ${
                                team.diff > 0 ? "text-green-600" : team.diff < 0 ? "text-red-600" : ""
                              }`}
                            >
                              {team.diff > 0 ? `+${team.diff}` : team.diff}
                            </TableCell>
                            <TableCell className="text-center hidden lg:table-cell">{team.lb}</TableCell>
                            <TableCell className="text-center hidden lg:table-cell">{team.tb}</TableCell>
                            <TableCell className="text-center font-bold text-lg">{team.pts}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="mt-6 text-sm text-muted-foreground space-y-1">
                    <p><strong>Abreviaturas:</strong> PJ = Partidos Jugados, PG = Partidos Ganados, PE = Partidos Empatados, PP = Partidos Perdidos</p>
                    <p>PF = Puntos a Favor, PC = Puntos en Contra, Diff = Diferencia, LB = Bonus por Derrota, TB = Bonus por Tries, Pts = Puntos</p>
                    <div className="flex gap-4 mt-3">
                      <span className="flex items-center gap-1"><span className="w-3 h-3 bg-primary rounded"></span> Playoffs</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-500 rounded"></span> Repechaje</span>
                    </div>
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
