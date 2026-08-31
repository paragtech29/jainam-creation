CREATE TYPE "public"."job_work_status" AS ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED');--> statement-breakpoint
CREATE TABLE "job_work_particulars" (
	"id" text PRIMARY KEY NOT NULL,
	"job_work_id" text NOT NULL,
	"particular_id" text NOT NULL,
	"price_used" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_works" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"party_id" text NOT NULL,
	"karigar_id" text NOT NULL,
	"chalan_no" text,
	"party_design_no" text,
	"computer_design_no" text,
	"pieces" integer NOT NULL,
	"rate" integer NOT NULL,
	"total" integer NOT NULL,
	"photo1_url" text,
	"photo2_url" text,
	"comment" text,
	"status" "job_work_status" DEFAULT 'PENDING' NOT NULL,
	"is_billed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "particulars" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"default_price" integer NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parties" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"owner_name_1" text NOT NULL,
	"owner_name_2" text,
	"address" text,
	"gender" text,
	"email" text,
	"contact_1" text,
	"contact_2" text,
	"logo_url" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "party_karigars" (
	"party_id" text NOT NULL,
	"karigar_id" text NOT NULL,
	CONSTRAINT "party_karigars_party_id_karigar_id_pk" PRIMARY KEY("party_id","karigar_id")
);
--> statement-breakpoint
CREATE TABLE "silai_karigars" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"contact_1" text,
	"contact_2" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "job_work_particulars" ADD CONSTRAINT "job_work_particulars_job_work_id_job_works_id_fk" FOREIGN KEY ("job_work_id") REFERENCES "public"."job_works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_work_particulars" ADD CONSTRAINT "job_work_particulars_particular_id_particulars_id_fk" FOREIGN KEY ("particular_id") REFERENCES "public"."particulars"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_works" ADD CONSTRAINT "job_works_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_works" ADD CONSTRAINT "job_works_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_works" ADD CONSTRAINT "job_works_karigar_id_silai_karigars_id_fk" FOREIGN KEY ("karigar_id") REFERENCES "public"."silai_karigars"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "particulars" ADD CONSTRAINT "particulars_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parties" ADD CONSTRAINT "parties_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_karigars" ADD CONSTRAINT "party_karigars_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_karigars" ADD CONSTRAINT "party_karigars_karigar_id_silai_karigars_id_fk" FOREIGN KEY ("karigar_id") REFERENCES "public"."silai_karigars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "silai_karigars" ADD CONSTRAINT "silai_karigars_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_work_particulars_job_work_id_idx" ON "job_work_particulars" USING btree ("job_work_id");--> statement-breakpoint
CREATE INDEX "job_work_particulars_particular_id_idx" ON "job_work_particulars" USING btree ("particular_id");--> statement-breakpoint
CREATE INDEX "job_works_user_date_idx" ON "job_works" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "job_works_user_party_idx" ON "job_works" USING btree ("user_id","party_id");--> statement-breakpoint
CREATE INDEX "job_works_user_karigar_idx" ON "job_works" USING btree ("user_id","karigar_id");--> statement-breakpoint
CREATE INDEX "job_works_user_status_idx" ON "job_works" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "job_works_user_billed_idx" ON "job_works" USING btree ("user_id","is_billed");--> statement-breakpoint
CREATE INDEX "particulars_user_id_idx" ON "particulars" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "particulars_user_name_unique" ON "particulars" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "parties_user_id_idx" ON "parties" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "parties_user_archived_idx" ON "parties" USING btree ("user_id","is_archived");--> statement-breakpoint
CREATE INDEX "party_karigars_karigar_id_idx" ON "party_karigars" USING btree ("karigar_id");--> statement-breakpoint
CREATE INDEX "karigars_user_id_idx" ON "silai_karigars" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "karigars_user_archived_idx" ON "silai_karigars" USING btree ("user_id","is_archived");