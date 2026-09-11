import { StandingsView } from "@/components/season/standings-view";

// La vista vive aparte porque también se usa como pestaña de /temporada.
export default function Page() {
  return <StandingsView />;
}
