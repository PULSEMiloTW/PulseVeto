ALTER TABLE "organizations" ADD COLUMN "deleted_at" DATETIME;
ALTER TABLE "organizations" ADD COLUMN "purge_at" DATETIME;
ALTER TABLE "organizations" ADD COLUMN "status_before_delete" TEXT;

ALTER TABLE "events" ADD COLUMN "deleted_at" DATETIME;
ALTER TABLE "events" ADD COLUMN "purge_at" DATETIME;
ALTER TABLE "events" ADD COLUMN "status_before_delete" TEXT;

ALTER TABLE "veto_sessions" ADD COLUMN "deleted_at" DATETIME;
ALTER TABLE "veto_sessions" ADD COLUMN "purge_at" DATETIME;
ALTER TABLE "veto_sessions" ADD COLUMN "status_before_delete" TEXT;

ALTER TABLE "maps" ADD COLUMN "name_zh_cn" TEXT NOT NULL DEFAULT '';

CREATE INDEX "organizations_deleted_at_purge_at_idx" ON "organizations"("deleted_at", "purge_at");
CREATE INDEX "events_deleted_at_purge_at_idx" ON "events"("deleted_at", "purge_at");
CREATE INDEX "veto_sessions_deleted_at_purge_at_idx" ON "veto_sessions"("deleted_at", "purge_at");
