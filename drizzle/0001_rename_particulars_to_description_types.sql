-- Renames "particulars" to what the business actually calls it: the kinds of
-- work listed in a job work's description. "Particular" was a misreading of
-- the owner's paper book; it was never a register in its own right.
--
-- Written by hand rather than generated: drizzle-kit cannot tell a rename from
-- a drop-and-create without an interactive prompt, and a drop would destroy
-- the price snapshots that make historical job work totals correct.

ALTER TABLE "particulars" RENAME TO "description_types";--> statement-breakpoint
ALTER TABLE "job_work_particulars" RENAME TO "job_work_descriptions";--> statement-breakpoint

ALTER TABLE "job_work_descriptions" RENAME COLUMN "particular_id" TO "description_type_id";--> statement-breakpoint

-- The price is typed per job work — the same work is charged differently to
-- different parties — so a stored default was never read. The figure actually
-- used lives on job_work_descriptions.price_used.
ALTER TABLE "description_types" DROP COLUMN "default_price";--> statement-breakpoint

ALTER INDEX "particulars_user_id_idx" RENAME TO "description_types_user_id_idx";--> statement-breakpoint
ALTER INDEX "particulars_user_name_unique" RENAME TO "description_types_user_name_unique";--> statement-breakpoint
ALTER INDEX "job_work_particulars_job_work_id_idx" RENAME TO "job_work_descriptions_job_work_id_idx";--> statement-breakpoint
ALTER INDEX "job_work_particulars_particular_id_idx" RENAME TO "job_work_descriptions_type_id_idx";
