import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { clubs, teams, players, seasons, users } from "./schema";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

async function seed() {
  console.log("🌱 Seeding database...");

  // Create current season
  const currentYear = new Date().getFullYear();
  const [season] = await db
    .insert(seasons)
    .values({
      year: currentYear,
      name: `Temporada ${currentYear}`,
      startDate: new Date(`${currentYear}-03-01`),
      endDate: new Date(`${currentYear}-11-30`),
      isActive: true,
      description: `Temporada ${currentYear} de la Primera División de Rugby de Chile`,
    })
    .returning();

  console.log(`✅ Created season: ${season.name}`);

  // Create clubs (Top 10 teams from Chilean 1st Division)
  const clubsData = [
    {
      name: "Old Boys",
      shortName: "OB",
      slug: "old-boys",
      location: "Santiago",
      stadium: "Cancha Old Boys",
      founded: 1926,
      primaryColor: "#1a365d",
      secondaryColor: "#ffffff",
    },
    {
      name: "COBS",
      shortName: "COBS",
      slug: "cobs",
      location: "Santiago",
      stadium: "Estadio COBS",
      founded: 1939,
      primaryColor: "#c53030",
      secondaryColor: "#ffffff",
    },
    {
      name: "Universidad de Chile",
      shortName: "U de Chile",
      slug: "universidad-de-chile",
      location: "Santiago",
      stadium: "Cancha U de Chile",
      founded: 1945,
      primaryColor: "#1a365d",
      secondaryColor: "#c53030",
    },
    {
      name: "Old Grangonian Club",
      shortName: "OGC",
      slug: "old-grangonian",
      location: "Santiago",
      stadium: "Cancha OGC",
      founded: 1933,
      primaryColor: "#2f855a",
      secondaryColor: "#ffffff",
    },
    {
      name: "Stade Français",
      shortName: "Stade",
      slug: "stade-francais",
      location: "Santiago",
      stadium: "Cancha Stade",
      founded: 1945,
      primaryColor: "#3182ce",
      secondaryColor: "#ffffff",
    },
    {
      name: "Prince of Wales Country Club",
      shortName: "PWCC",
      slug: "pwcc",
      location: "Santiago",
      stadium: "Cancha PWCC",
      founded: 1934,
      primaryColor: "#744210",
      secondaryColor: "#ffffff",
    },
    {
      name: "Troncos",
      shortName: "Troncos",
      slug: "troncos",
      location: "Concepción",
      stadium: "Cancha Troncos",
      founded: 1949,
      primaryColor: "#2d3748",
      secondaryColor: "#ecc94b",
    },
    {
      name: "Los Lobos",
      shortName: "Lobos",
      slug: "los-lobos",
      location: "Santiago",
      stadium: "Cancha Los Lobos",
      founded: 1967,
      primaryColor: "#742a2a",
      secondaryColor: "#ffffff",
    },
    {
      name: "Society of Dublin",
      shortName: "SOD",
      slug: "sod",
      location: "Santiago",
      stadium: "Cancha SOD",
      founded: 1948,
      primaryColor: "#2b6cb0",
      secondaryColor: "#ffffff",
    },
    {
      name: "Universidad Católica",
      shortName: "UC",
      slug: "universidad-catolica",
      location: "Santiago",
      stadium: "Cancha UC",
      founded: 1949,
      primaryColor: "#1a365d",
      secondaryColor: "#ffffff",
    },
  ];

  const createdClubs = await db.insert(clubs).values(clubsData).returning();
  console.log(`✅ Created ${createdClubs.length} clubs`);

  // Create teams for each club (Primera, Intermedia, Pre-Intermedia)
  const divisions = ["PRIMERA", "INTERMEDIA", "PRE_INTERMEDIA"] as const;
  const teamsData = [];

  for (const club of createdClubs) {
    for (const division of divisions) {
      teamsData.push({
        clubId: club.id,
        division: division,
        seasonYear: currentYear,
      });
    }
  }

  const createdTeams = await db.insert(teams).values(teamsData).returning();
  console.log(`✅ Created ${createdTeams.length} teams`);

  // Create sample players for each Primera team
  const positions = [
    "PROP",
    "HOOKER",
    "PROP",
    "LOCK",
    "LOCK",
    "FLANKER",
    "FLANKER",
    "NUMBER_8",
    "SCRUM_HALF",
    "FLY_HALF",
    "CENTER",
    "CENTER",
    "WING",
    "WING",
    "FULLBACK",
  ] as const;

  const primeraTeams = createdTeams.filter((t) => t.division === "PRIMERA");
  const playersData = [];

  let playerId = 1;
  for (const team of primeraTeams) {
    const club = createdClubs.find((c) => c.id === team.clubId);
    for (let i = 0; i < 23; i++) {
      const position = positions[i] || "PROP";
      playersData.push({
        teamId: team.id,
        firstName: `Jugador`,
        lastName: `${club?.shortName || "Team"} ${playerId}`,
        position: position,
        jerseyNumber: i + 1,
        height: 175 + Math.floor(Math.random() * 25),
        weight: 85 + Math.floor(Math.random() * 30),
        nationality: "Chilena",
        isActive: true,
      });
      playerId++;
    }
  }

  const createdPlayers = await db.insert(players).values(playersData).returning();
  console.log(`✅ Created ${createdPlayers.length} players`);

  // Create admin user
  const [adminUser] = await db
    .insert(users)
    .values({
      email: "admin@rugbychile.cl",
      name: "Administrador",
      role: "ADMIN",
    })
    .returning();

  console.log(`✅ Created admin user: ${adminUser.email}`);

  console.log("\n🎉 Seeding completed!");
  console.log("\nNext steps:");
  console.log("1. Copy .env.example to .env and configure your database");
  console.log("2. Run: npm run db:push to push schema to database");
  console.log("3. Run: npm run db:seed to seed data");

  await pool.end();
}

seed().catch((error) => {
  console.error("❌ Seeding failed:", error);
  process.exit(1);
});
