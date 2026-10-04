ALTER TABLE "veto_sessions" ADD COLUMN "map_selection_seconds" INTEGER NOT NULL DEFAULT -1;
ALTER TABLE "veto_sessions" ADD COLUMN "side_selection_seconds" INTEGER NOT NULL DEFAULT -1;
ALTER TABLE "veto_sessions" ADD COLUMN "action_deadline_at" DATETIME;
ALTER TABLE "veto_sessions" ADD COLUMN "team_a_ready_at" DATETIME;
ALTER TABLE "veto_sessions" ADD COLUMN "team_b_ready_at" DATETIME;
ALTER TABLE "team_sessions" ADD COLUMN "welcome_required" BOOLEAN NOT NULL DEFAULT false;
