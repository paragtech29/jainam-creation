-- Image bytes live in Postgres, not in an object store.
--
-- The owner chose this over Vercel Blob because Blob needs a Vercel account
-- and an API token in the environment, which contradicts the rule this
-- project was started under: no paid services, no subscriptions, no API keys.
-- Images are compressed in the browser first (~100-300KB each), so Neon's
-- 0.5GB free tier holds on the order of 2,000 of them.
--
-- A SEPARATE table rather than bytea columns on parties/job_works, because a
-- blob sitting in the row would be dragged into every list query that does
-- `select *`. Here the bytes are only ever read by the route that serves one
-- image by id.
CREATE TABLE IF NOT EXISTS "images" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "mime_type" text NOT NULL,
  "byte_size" integer NOT NULL,
  "bytes" bytea NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Every read is "this user's image with this id", so the scoping column is
-- worth an index of its own.
CREATE INDEX IF NOT EXISTS "images_user_id_idx" ON "images" ("user_id");

-- ON DELETE SET NULL, deliberately: losing an image must never take the party
-- or the job work with it. The repositories delete the image row explicitly
-- when a record that owns one is removed, so nothing is orphaned either.
ALTER TABLE "parties"   ADD COLUMN IF NOT EXISTS "logo_image_id"   text REFERENCES "images"("id") ON DELETE SET NULL;
ALTER TABLE "job_works" ADD COLUMN IF NOT EXISTS "photo1_image_id" text REFERENCES "images"("id") ON DELETE SET NULL;
ALTER TABLE "job_works" ADD COLUMN IF NOT EXISTS "photo2_image_id" text REFERENCES "images"("id") ON DELETE SET NULL;

-- The old URL columns were written by nothing and read by nothing — they were
-- placeholders for the object-store approach that was dropped. Removing them
-- so there are not two competing representations of "the photo", which is
-- exactly the ambiguity that produces "why is this empty" bugs later.
-- Safe: confirmed zero non-null values before writing this migration.
ALTER TABLE "parties"   DROP COLUMN IF EXISTS "logo_url";
ALTER TABLE "job_works" DROP COLUMN IF EXISTS "photo1_url";
ALTER TABLE "job_works" DROP COLUMN IF EXISTS "photo2_url";
