import { pgTable, uuid, varchar, timestamp, integer, pgEnum, text, boolean, serial } from "drizzle-orm/pg-core";

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

// Users (for admin access)
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
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
