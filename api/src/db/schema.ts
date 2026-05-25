import { pgTable, uuid, varchar, timestamp, integer, pgEnum, text, boolean, serial, json, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const divisionEnum = pgEnum("division", ["PRIMERA", "INTERMEDIA", "PRE_INTERMEDIA"]);
export const positionEnum = pgEnum("position", [
  "PROP",
  "HOOKER",
  "LOCK",
  "FLANKER",
  "NUMBER_8",
  "SCRUM_HALF",
  "FLY_HALF",
  "CENTER",
  "WING",
  "FULLBACK",
]);
export const matchStatusEnum = pgEnum("match_status", [
  "SCHEDULED",
  "LIVE",
  "FINISHED",
  "POSTPONED",
  "CANCELLED",
]);
export const eventTypeEnum = pgEnum("event_type", [
  "TRY",
  "CONVERSION",
  "PENALTY",
  "DROP_GOAL",
  "YELLOW_CARD",
  "RED_CARD",
  "SUBSTITUTION",
]);

// Clubs Table
export const clubs = pgTable("clubs", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  shortName: varchar("short_name", { length: 50 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  logo: varchar("logo", { length: 500 }),
  primaryColor: varchar("primary_color", { length: 7 }), // hex color
  secondaryColor: varchar("secondary_color", { length: 7 }),
  location: varchar("location", { length: 255 }),
  stadium: varchar("stadium", { length: 255 }),
  founded: integer("founded"),
  description: text("description"),
  website: varchar("website", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Teams Table (Primera, Intermedia, Pre-Intermedia for each club)
export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  clubId: uuid("club_id").notNull().references(() => clubs.id, { onDelete: "cascade" }),
  division: divisionEnum("division").notNull(),
  seasonYear: integer("season_year").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Players Table
export const players = pgTable("players", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  photo: varchar("photo", { length: 500 }),
  position: positionEnum("position"),
  jerseyNumber: integer("jersey_number"),
  height: integer("height"), // in cm
  weight: integer("weight"), // in kg
  birthDate: timestamp("birth_date"),
  nationality: varchar("nationality", { length: 100 }),
  bio: text("bio"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Matches Table
export const matches = pgTable("matches", {
  id: uuid("id").defaultRandom().primaryKey(),
  homeTeamId: uuid("home_team_id").notNull().references(() => teams.id),
  awayTeamId: uuid("away_team_id").notNull().references(() => teams.id),
  division: divisionEnum("division").notNull(),
  round: integer("round").notNull(),
  scheduledDate: timestamp("scheduled_date").notNull(),
  venue: varchar("venue", { length: 255 }),
  status: matchStatusEnum("status").default("SCHEDULED").notNull(),
  homeScore: integer("home_score").default(0),
  awayScore: integer("away_score").default(0),
  homeTries: integer("home_tries").default(0),
  awayTries: integer("away_tries").default(0),
  currentMinute: integer("current_minute"), // for live matches
  firstHalfExtraTime: integer("first_half_extra_time"), // injury time
  secondHalfExtraTime: integer("second_half_extra_time"),
  isFullTime: boolean("is_full_time").default(false),
  matchReport: text("match_report"),
  weather: varchar("weather", { length: 100 }),
  attendance: integer("attendance"),
  referee: varchar("referee", { length: 255 }),
  assistantReferee1: varchar("assistant_referee_1", { length: 255 }),
  assistantReferee2: varchar("assistant_referee_2", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Match Events Table (Tries, Cards, Substitutions, etc.)
export const matchEvents = pgTable("match_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  matchId: uuid("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
  teamId: uuid("team_id").notNull().references(() => teams.id),
  playerId: uuid("player_id").references(() => players.id),
  type: eventTypeEnum("type").notNull(),
  minute: integer("minute").notNull(),
  points: integer("points").default(0),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Standings Table (Calculated automatically)
export const standings = pgTable("standings", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  division: divisionEnum("division").notNull(),
  seasonYear: integer("season_year").notNull(),
  position: integer("position").notNull(),
  played: integer("played").default(0),
  won: integer("won").default(0),
  drawn: integer("drawn").default(0),
  lost: integer("lost").default(0),
  pointsFor: integer("points_for").default(0),
  pointsAgainst: integer("points_against").default(0),
  pointsDifference: integer("points_difference").default(0),
  triesFor: integer("tries_for").default(0),
  triesAgainst: integer("tries_against").default(0),
  tryBonusPoints: integer("try_bonus_points").default(0),
  losingBonusPoints: integer("losing_bonus_points").default(0),
  totalPoints: integer("total_points").default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Player Stats (Aggregated per season)
export const playerStats = pgTable("player_stats", {
  id: uuid("id").defaultRandom().primaryKey(),
  playerId: uuid("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  teamId: uuid("team_id").notNull().references(() => teams.id),
  seasonYear: integer("season_year").notNull(),
  matchesPlayed: integer("matches_played").default(0),
  tries: integer("tries").default(0),
  conversions: integer("conversions").default(0),
  penalties: integer("penalties").default(0),
  dropGoals: integer("drop_goals").default(0),
  totalPoints: integer("total_points").default(0),
  yellowCards: integer("yellow_cards").default(0),
  redCards: integer("red_cards").default(0),
  minutesPlayed: integer("minutes_played").default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Live Scoring (simple, no FK dependencies) ──
export const liveMatches = pgTable("live_matches", {
  id: uuid("id").defaultRandom().primaryKey(),
  homeTeam: varchar("home_team", { length: 100 }).notNull(),
  awayTeam: varchar("away_team", { length: 100 }).notNull(),
  division: varchar("division", { length: 50 }).notNull(),
  venue: varchar("venue", { length: 255 }).notNull().default(""),
  homeScore: integer("home_score").default(0).notNull(),
  awayScore: integer("away_score").default(0).notNull(),
  homeTries: integer("home_tries").default(0).notNull(),
  awayTries: integer("away_tries").default(0).notNull(),
  minute: integer("minute").default(0).notNull(),
  status: varchar("status", { length: 20 }).default("SCHEDULED").notNull(),
  // Scorer PWA token — allows a volunteer to score without an admin account
  scorerToken: varchar("scorer_token", { length: 64 }).unique(),
  scorerTokenExpiresAt: timestamp("scorer_token_expires_at"),
  // Leverade match ID for automatic score syncing
  leveradeMatchId: varchar("leverade_match_id", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const liveEvents = pgTable("live_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  matchId: uuid("match_id").notNull().references(() => liveMatches.id, { onDelete: "cascade" }),
  team: varchar("team", { length: 10 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  minute: integer("minute").notNull(),
  playerName: varchar("player_name", { length: 255 }),
  points: integer("points").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type LiveMatch = typeof liveMatches.$inferSelect;
export type NewLiveMatch = typeof liveMatches.$inferInsert;
export type LiveEvent = typeof liveEvents.$inferSelect;
export type NewLiveEvent = typeof liveEvents.$inferInsert;

// News articles (scraped from RSS + manually created)
export const newsArticles = pgTable("news_articles", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull(),
  body: text("body").notNull(),
  category: varchar("category", { length: 50 }).default("Noticias").notNull(),
  author: varchar("author", { length: 255 }).default("Redacción Top 10").notNull(),
  sourceUrl: varchar("source_url", { length: 500 }),  // original article URL if scraped
  sourceName: varchar("source_name", { length: 100 }), // e.g. "Rugbiers"
  imageUrl: varchar("image_url", { length: 500 }),
  featured: boolean("featured").default(false).notNull(),
  published: boolean("published").default(true).notNull(),
  publishedAt: timestamp("published_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type NewsArticle = typeof newsArticles.$inferSelect;
export type NewNewsArticle = typeof newsArticles.$inferInsert;

// Users
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  passwordHash: varchar("password_hash", { length: 255 }),
  role: varchar("role", { length: 50 }).default("USER").notNull(), // ADMIN, CLUB_ADMIN, USER
  clubId: uuid("club_id").references(() => clubs.id), // for club admins
  emailVerified: timestamp("email_verified"),
  image: varchar("image", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Seasons Table
export const seasons = pgTable("seasons", {
  id: uuid("id").defaultRandom().primaryKey(),
  year: integer("year").notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  isActive: boolean("is_active").default(false).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Types
export type Club = typeof clubs.$inferSelect;
export type NewClub = typeof clubs.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;
export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;
export type MatchEvent = typeof matchEvents.$inferSelect;
export type NewMatchEvent = typeof matchEvents.$inferInsert;
export type Standing = typeof standings.$inferSelect;
export type NewStanding = typeof standings.$inferInsert;
export type PlayerStat = typeof playerStats.$inferSelect;
export type NewPlayerStat = typeof playerStats.$inferInsert;
export type Season = typeof seasons.$inferSelect;
export type NewSeason = typeof seasons.$inferInsert;

// ── Relations ──
export const clubsRelations = relations(clubs, ({ many }) => ({
  teams: many(teams),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  club: one(clubs, { fields: [teams.clubId], references: [clubs.id] }),
  players: many(players),
  standings: many(standings),
  homeMatches: many(matches, { relationName: "homeTeam" }),
  awayMatches: many(matches, { relationName: "awayTeam" }),
}));

export const playersRelations = relations(players, ({ one, many }) => ({
  team: one(teams, { fields: [players.teamId], references: [teams.id] }),
  stats: many(playerStats),
  matchEvents: many(matchEvents),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  homeTeam: one(teams, { fields: [matches.homeTeamId], references: [teams.id], relationName: "homeTeam" }),
  awayTeam: one(teams, { fields: [matches.awayTeamId], references: [teams.id], relationName: "awayTeam" }),
  matchEvents: many(matchEvents),
}));

export const matchEventsRelations = relations(matchEvents, ({ one }) => ({
  match: one(matches, { fields: [matchEvents.matchId], references: [matches.id] }),
  team: one(teams, { fields: [matchEvents.teamId], references: [teams.id] }),
  player: one(players, { fields: [matchEvents.playerId], references: [players.id] }),
}));

export const standingsRelations = relations(standings, ({ one }) => ({
  team: one(teams, { fields: [standings.teamId], references: [teams.id] }),
}));

export const playerStatsRelations = relations(playerStats, ({ one }) => ({
  player: one(players, { fields: [playerStats.playerId], references: [players.id] }),
  team: one(teams, { fields: [playerStats.teamId], references: [teams.id] }),
}));

// ── Prediction game ──────────────────────────────────────────────────────────

export const predictionFixtures = pgTable("prediction_fixtures", {
  id: uuid("id").defaultRandom().primaryKey(),
  season: integer("season").default(2026).notNull(),
  round: integer("round").notNull(),
  homeTeam: varchar("home_team", { length: 100 }).notNull(),
  awayTeam: varchar("away_team", { length: 100 }).notNull(),
  matchDate: timestamp("match_date"),
  venue: varchar("venue", { length: 255 }),
  division: varchar("division", { length: 50 }).default("Primera XV").notNull(),
  homeScoreActual: integer("home_score_actual"),
  awayScoreActual: integer("away_score_actual"),
  // UPCOMING = accepting predictions, LOCKED = match started, COMPLETED = results entered
  status: varchar("status", { length: 20 }).default("UPCOMING").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const predictions = pgTable("predictions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  fixtureId: uuid("fixture_id").notNull().references(() => predictionFixtures.id, { onDelete: "cascade" }),
  homeScore: integer("home_score").notNull(),
  awayScore: integer("away_score").notNull(),
  pointsEarned: integer("points_earned"), // null = not yet calculated
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PredictionFixture = typeof predictionFixtures.$inferSelect;
export type NewPredictionFixture = typeof predictionFixtures.$inferInsert;
export type Prediction = typeof predictions.$inferSelect;
export type NewPrediction = typeof predictions.$inferInsert;
export type User = typeof users.$inferSelect;

// ── Fantasy game ─────────────────────────────────────────────────────────────

// "primera" | "intermedia" | "pre-intermedia"
export const fantasySquads = pgTable("fantasy_squads", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  season: integer("season").default(2026).notNull(),
  division: varchar("division", { length: 30 }).default("primera").notNull(),
  teamName: varchar("team_name", { length: 100 }).default("Mi Equipo").notNull(),
  captainId: varchar("captain_id", { length: 50 }),
  viceCaptainId: varchar("vice_captain_id", { length: 50 }),
  totalPoints: integer("total_points").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const fantasySquadPlayers = pgTable("fantasy_squad_players", {
  id: uuid("id").defaultRandom().primaryKey(),
  squadId: uuid("squad_id").notNull().references(() => fantasySquads.id, { onDelete: "cascade" }),
  arusaId: varchar("arusa_id", { length: 50 }).notNull(),
  clubSlug: varchar("club_slug", { length: 50 }).notNull(),
  playerName: varchar("player_name", { length: 255 }).notNull(),
  purchasePrice: integer("purchase_price").notNull(), // e.g. 65 = $6.5M (stored as tenths)
});

export const fantasyGameweekScores = pgTable("fantasy_gameweek_scores", {
  id: uuid("id").defaultRandom().primaryKey(),
  season: integer("season").default(2026).notNull(),
  division: varchar("division", { length: 30 }).default("primera").notNull(),
  round: integer("round").notNull(),
  arusaId: varchar("arusa_id", { length: 50 }).notNull(),
  clubSlug: varchar("club_slug", { length: 50 }).notNull(),
  playerName: varchar("player_name", { length: 255 }).notNull(),
  tries: integer("tries").default(0).notNull(),
  assists: integer("assists").default(0).notNull(),
  conversions: integer("conversions").default(0).notNull(),
  penalties: integer("penalties").default(0).notNull(),
  drops: integer("drops").default(0).notNull(),
  yellowCards: integer("yellow_cards").default(0).notNull(),
  redCards: integer("red_cards").default(0).notNull(),
  isMvp: boolean("is_mvp").default(false).notNull(),
  played: boolean("played").default(true).notNull(),
  pointsEarned: integer("points_earned").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Match Lineups ─────────────────────────────────────────────────────────────

export const matchLineups = pgTable(
  "match_lineups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    division: varchar("division", { length: 50 }).notNull(),
    round: integer("round").notNull(),
    homeTeam: varchar("home_team", { length: 100 }).notNull(),
    awayTeam: varchar("away_team", { length: 100 }).notNull(),
    homeStarters: json("home_starters").$type<string[]>(),
    homeSubs: json("home_subs").$type<string[]>(),
    awayStarters: json("away_starters").$type<string[]>(),
    awaySubs: json("away_subs").$type<string[]>(),
    homeInstagramUrl: varchar("home_instagram_url", { length: 500 }),
    awayInstagramUrl: varchar("away_instagram_url", { length: 500 }),
    homeInstagramCaption: text("home_instagram_caption"),
    awayInstagramCaption: text("away_instagram_caption"),
    crawledAt: timestamp("crawled_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("lineup_match_idx").on(t.division, t.round, t.homeTeam, t.awayTeam)],
);

export type MatchLineup = typeof matchLineups.$inferSelect;
export type NewMatchLineup = typeof matchLineups.$inferInsert;

export type FantasySquad = typeof fantasySquads.$inferSelect;
export type NewFantasySquad = typeof fantasySquads.$inferInsert;
export type FantasySquadPlayer = typeof fantasySquadPlayers.$inferSelect;
export type NewFantasySquadPlayer = typeof fantasySquadPlayers.$inferInsert;
export type FantasyGameweekScore = typeof fantasyGameweekScores.$inferSelect;
export type NewFantasyGameweekScore = typeof fantasyGameweekScores.$inferInsert;
