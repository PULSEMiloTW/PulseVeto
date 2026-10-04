-- Repair Bo5 sessions that reached an unexecutable SYSTEM Decider step after
-- completing the fourth Pick's side selection.
INSERT INTO "veto_actions" (
  "id", "veto_session_id", "veto_step_id", "map_id", "actor", "action", "created_at"
)
SELECT
  lower(hex(randomblob(12))),
  session."id",
  step."id",
  (
    SELECT event_map."map_id"
    FROM "event_maps" AS event_map
    WHERE event_map."event_id" = session."event_id"
      AND NOT EXISTS (
        SELECT 1 FROM "veto_actions" AS used
        WHERE used."veto_session_id" = session."id"
          AND used."map_id" = event_map."map_id"
      )
    ORDER BY event_map."sort_order"
    LIMIT 1
  ),
  'SYSTEM',
  'DECIDER',
  CURRENT_TIMESTAMP
FROM "veto_sessions" AS session
JOIN "veto_steps" AS step
  ON step."veto_session_id" = session."id"
 AND step."step_number" = session."current_step" + 1
WHERE session."best_of" = 5
  AND session."status" = 'ACTIVE'
  AND step."action" = 'DECIDER'
  AND NOT EXISTS (
    SELECT 1 FROM "veto_actions" AS existing
    WHERE existing."veto_step_id" = step."id"
  )
  AND (
    SELECT COUNT(*)
    FROM "event_maps" AS event_map
    WHERE event_map."event_id" = session."event_id"
      AND NOT EXISTS (
        SELECT 1 FROM "veto_actions" AS used
        WHERE used."veto_session_id" = session."id"
          AND used."map_id" = event_map."map_id"
      )
  ) = 1;

UPDATE "veto_sessions"
SET "status" = 'WAITING_FOR_SIDE_SELECTION',
    "version" = "version" + 1,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "best_of" = 5
  AND "status" = 'ACTIVE'
  AND EXISTS (
    SELECT 1
    FROM "veto_steps" AS step
    JOIN "veto_actions" AS action ON action."veto_step_id" = step."id"
    WHERE step."veto_session_id" = "veto_sessions"."id"
      AND step."step_number" = "veto_sessions"."current_step" + 1
      AND step."action" = 'DECIDER'
      AND action."action" = 'DECIDER'
  );
