// Full Drizzle schema for the Jainam Creation project.
// All seven tables are built now (Phase 1) even though only auth ships UI
// this phase, so Phases 2-7 never have to retrofit userId scoping, TEXT
// design columns, price-snapshot columns, or soft-archive flags onto tables
// that already hold the owner's real business ledger.
import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  date,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

// ---------- users ----------
export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// ---------- parties ----------
export const parties = pgTable(
  "parties",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    ownerName1: text("owner_name_1").notNull(),
    ownerName2: text("owner_name_2"),
    address: text("address"),
    gender: text("gender"),
    email: text("email"),
    contact1: text("contact_1"),
    contact2: text("contact_2"),
    logoUrl: text("logo_url"),
    isArchived: boolean("is_archived").notNull().default(false),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("parties_user_id_idx").on(t.userId),
    // Phase 5 filters by party within a user's scope — composite index pays off once JobWork exists
    index("parties_user_archived_idx").on(t.userId, t.isArchived),
  ],
);

export type Party = typeof parties.$inferSelect;
export type NewParty = typeof parties.$inferInsert;

// ---------- silaiKarigars ----------
export const silaiKarigars = pgTable(
  "silai_karigars",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    address: text("address"),
    contact1: text("contact_1"),
    contact2: text("contact_2"),
    isArchived: boolean("is_archived").notNull().default(false),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("karigars_user_id_idx").on(t.userId),
    index("karigars_user_archived_idx").on(t.userId, t.isArchived),
  ],
);

export type SilaiKarigar = typeof silaiKarigars.$inferSelect;
export type NewSilaiKarigar = typeof silaiKarigars.$inferInsert;

// ---------- partyKarigars (many-to-many join) ----------
export const partyKarigars = pgTable(
  "party_karigars",
  {
    partyId: text("party_id").notNull().references(() => parties.id, { onDelete: "cascade" }),
    karigarId: text("karigar_id").notNull().references(() => silaiKarigars.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.partyId, t.karigarId] }),
    index("party_karigars_karigar_id_idx").on(t.karigarId), // reverse lookup: karigar -> parties
  ],
);

// ---------- particulars ----------
export const particulars = pgTable(
  "particulars",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    defaultPrice: integer("default_price").notNull(), // integer rupees — locked decision
    isArchived: boolean("is_archived").notNull().default(false),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("particulars_user_id_idx").on(t.userId),
    uniqueIndex("particulars_user_name_unique").on(t.userId, t.name), // prevent duplicate "galu" per user
  ],
);

export type Particular = typeof particulars.$inferSelect;
export type NewParticular = typeof particulars.$inferInsert;

// ---------- jobWorks ----------
export const jobWorkStatusEnum = pgEnum("job_work_status", [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
]);

export const jobWorks = pgTable(
  "job_works",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

    date: date("date").notNull(),
    partyId: text("party_id").notNull().references(() => parties.id),
    karigarId: text("karigar_id").notNull().references(() => silaiKarigars.id),

    // TEXT, never INTEGER — digits-only enforced only in the shared zod schema (JOB-13, Pitfall 5)
    chalanNo: text("chalan_no"),
    partyDesignNo: text("party_design_no"),
    computerDesignNo: text("computer_design_no"),

    pieces: integer("pieces").notNull(),
    rate: integer("rate").notNull(),   // integer rupees, user-editable, stored not computed-on-read
    total: integer("total").notNull(), // integer rupees, pieces * rate, computed server-side

    photo1Url: text("photo1_url"),
    photo2Url: text("photo2_url"),
    comment: text("comment"),

    status: jobWorkStatusEnum("status").notNull().default("PENDING"),
    isBilled: boolean("is_billed").notNull().default(false),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    // Composite, userId-first indexes matching Phase 5's actual filters (date range, party, karigar, status, billed)
    index("job_works_user_date_idx").on(t.userId, t.date),
    index("job_works_user_party_idx").on(t.userId, t.partyId),
    index("job_works_user_karigar_idx").on(t.userId, t.karigarId),
    index("job_works_user_status_idx").on(t.userId, t.status),
    index("job_works_user_billed_idx").on(t.userId, t.isBilled),
  ],
);

export type JobWork = typeof jobWorks.$inferSelect;
export type NewJobWork = typeof jobWorks.$inferInsert;

// ---------- jobWorkParticulars (price-snapshot join) ----------
export const jobWorkParticulars = pgTable(
  "job_work_particulars",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    jobWorkId: text("job_work_id").notNull().references(() => jobWorks.id, { onDelete: "cascade" }),
    particularId: text("particular_id").notNull().references(() => particulars.id),

    priceUsed: integer("price_used").notNull(), // SNAPSHOT of particulars.defaultPrice at time of use — never live-joined for totals
  },
  (t) => [
    index("job_work_particulars_job_work_id_idx").on(t.jobWorkId),
    index("job_work_particulars_particular_id_idx").on(t.particularId),
  ],
);

// ---------- relations (for db.query.* relational API, used from Phase 2 onward) ----------
export const usersRelations = relations(users, ({ many }) => ({
  parties: many(parties),
  karigars: many(silaiKarigars),
  particulars: many(particulars),
  jobWorks: many(jobWorks),
}));

export const partiesRelations = relations(parties, ({ one, many }) => ({
  user: one(users, { fields: [parties.userId], references: [users.id] }),
  karigarLinks: many(partyKarigars),
  jobWorks: many(jobWorks),
}));

export const silaiKarigarsRelations = relations(silaiKarigars, ({ one, many }) => ({
  user: one(users, { fields: [silaiKarigars.userId], references: [users.id] }),
  partyLinks: many(partyKarigars),
  jobWorks: many(jobWorks),
}));

export const partyKarigarsRelations = relations(partyKarigars, ({ one }) => ({
  party: one(parties, { fields: [partyKarigars.partyId], references: [parties.id] }),
  karigar: one(silaiKarigars, { fields: [partyKarigars.karigarId], references: [silaiKarigars.id] }),
}));

export const particularsRelations = relations(particulars, ({ one, many }) => ({
  user: one(users, { fields: [particulars.userId], references: [users.id] }),
  jobWorkLines: many(jobWorkParticulars),
}));

export const jobWorksRelations = relations(jobWorks, ({ one, many }) => ({
  user: one(users, { fields: [jobWorks.userId], references: [users.id] }),
  party: one(parties, { fields: [jobWorks.partyId], references: [parties.id] }),
  karigar: one(silaiKarigars, { fields: [jobWorks.karigarId], references: [silaiKarigars.id] }),
  particulars: many(jobWorkParticulars),
}));

export const jobWorkParticularsRelations = relations(jobWorkParticulars, ({ one }) => ({
  jobWork: one(jobWorks, { fields: [jobWorkParticulars.jobWorkId], references: [jobWorks.id] }),
  particular: one(particulars, { fields: [jobWorkParticulars.particularId], references: [particulars.id] }),
}));
