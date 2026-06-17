-- Custom SQL migration file, put your code below! --
-- Widen files.size from integer to bigint.
-- The fileprocessor library stores file sizes as int64 and writes them via
-- the FileStore.CreateFile contract. With Supabase S3 / S3-compatible storage
-- allowing objects > 2 GiB, integer (max 2,147,483,647 bytes) is too small.
--
-- ALTER COLUMN ... USING <expr> preserves existing values; the cast from
-- int to bigint is implicit and lossless.

ALTER TABLE "files" ALTER COLUMN "size" TYPE bigint USING "size"::bigint;--> statement-breakpoint
ALTER TABLE "global_files" ALTER COLUMN "size" TYPE bigint USING "size"::bigint;--> statement-breakpoint
ALTER TABLE "document_chunks" ALTER COLUMN "document_id" TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "document_histories" ALTER COLUMN "document_id" TYPE varchar(255);
