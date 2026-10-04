CREATE TABLE "event_veto_flows" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "event_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "steps_json" TEXT NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL,
  CONSTRAINT "event_veto_flows_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "event_veto_flows_event_id_name_key" ON "event_veto_flows"("event_id", "name");
CREATE TABLE "release_notes" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "version" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "release_notes_version_key" ON "release_notes"("version");
ALTER TABLE "veto_sessions" ADD COLUMN "flow_name" TEXT;
