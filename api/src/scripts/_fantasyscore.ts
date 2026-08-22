import "dotenv/config";
import dns from "node:dns"; dns.setDefaultResultOrder("ipv4first");
import { autoScoreFantasy } from "../services/fantasyAutoScore";
(async () => {
  const r = await autoScoreFantasy();
  console.log("  resultado:", JSON.stringify(r));
})().then(()=>process.exit(0)).catch(e=>{console.error(e.message||e);process.exit(1)});
