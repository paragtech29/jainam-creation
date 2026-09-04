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
import { customType } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

/**
 * Postgres bytea. drizzle's pg-core ships no helper for it, so this is the
 * documented customType escape hatch. Values are Node Buffers in and out.
 */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

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
/**
 * Uploaded image bytes, in the database rather than an object store — the
 * owner chose that over Vercel Blob to avoid an account and an API token
 * (see drizzle/0003). A SEPARATE table because a blob on the parties or
 * job_works row would be dragged into every list query doing `select *`;
 * here the bytes are read only by the route that serves one image by id.
 */
export const images = pgTable(
  "images",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    bytes: bytea("bytes").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("images_user_id_idx").on(t.userId)]
);

export type Image = typeof images.$inferSelect;
export type NewImage = typeof images.$inferInsert;

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
    logoImageId: text("logo_image_id").references(() => images.id, { onDelete: "set null" }),
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

// ---------- descriptionTypes ----------
// The kinds of work that can appear on a job work's description lines —
// Galu, Sleeve, Dupatta, Daman, Patti. These are NOT a register the owner
// maintains; they are added inline while filling a job work form, and exist
// only to populate that dropdown.
//
// Deliberately no price column: the price is typed per job work, because the
// same work is charged differently to different parties. The figure actually
// used is snapshotted onto jobWorkDescriptions.priceUsed.
export const descriptionTypes = pgTable(
  "description_types",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    isArchived: boolean("is_archived").notNull().default(false),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("description_types_user_id_idx").on(t.userId),
    uniqueIndex("description_types_user_name_unique").on(t.userId, t.name),
  ],
);

export type DescriptionType = typeof descriptionTypes.$inferSelect;
export type NewDescriptionType = typeof descriptionTypes.$inferInsert;

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

    photo1ImageId: text("photo1_image_id").references(() => images.id, { onDelete: "set null" }),
    photo2ImageId: text("photo2_image_id").references(() => images.id, { onDelete: "set null" }),
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

// ---------- jobWorkDescriptions (price-snapshot join) ----------
// One description line on a job work: which kind of work, and what it was
// charged at. priceUsed is a SNAPSHOT, written once at save time and never
// recomputed — renaming or removing a description type must never alter what
// last year's job works were worth.
export const jobWorkDescriptions = pgTable(
  "job_work_descriptions",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    jobWorkId: text("job_work_id").notNull().references(() => jobWorks.id, { onDelete: "cascade" }),
    descriptionTypeId: text("description_type_id").notNull().references(() => descriptionTypes.id),

    priceUsed: integer("price_used").notNull(), // integer rupees, snapshotted
  },
  (t) => [
    index("job_work_descriptions_job_work_id_idx").on(t.jobWorkId),
    index("job_work_descriptions_type_id_idx").on(t.descriptionTypeId),
  ],
);

// ---------- relations (for db.query.* relational API, used from Phase 2 onward) ----------
export const usersRelations = relations(users, ({ many }) => ({
  parties: many(parties),
  karigars: many(silaiKarigars),
  descriptionTypes: many(descriptionTypes),
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

export const descriptionTypesRelations = relations(descriptionTypes, ({ one, many }) => ({
  user: one(users, { fields: [descriptionTypes.userId], references: [users.id] }),
  jobWorkLines: many(jobWorkDescriptions),
}));

export const jobWorksRelations = relations(jobWorks, ({ one, many }) => ({
  user: one(users, { fields: [jobWorks.userId], references: [users.id] }),
  party: one(parties, { fields: [jobWorks.partyId], references: [parties.id] }),
  karigar: one(silaiKarigars, { fields: [jobWorks.karigarId], references: [silaiKarigars.id] }),
  descriptions: many(jobWorkDescriptions),
}));

export const jobWorkDescriptionsRelations = relations(jobWorkDescriptions, ({ one }) => ({
  jobWork: one(jobWorks, { fields: [jobWorkDescriptions.jobWorkId], references: [jobWorks.id] }),
  descriptionType: one(descriptionTypes, {
    fields: [jobWorkDescriptions.descriptionTypeId],
    references: [descriptionTypes.id],
  }),
}));
