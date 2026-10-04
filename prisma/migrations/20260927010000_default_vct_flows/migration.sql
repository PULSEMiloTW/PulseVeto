INSERT INTO "event_veto_flows" ("id", "event_id", "name", "steps_json", "created_at", "updated_at")
SELECT lower(hex(randomblob(16))), e."id", 'Bo1 (VCT)',
  '[{"stepNumber":1,"actor":"TEAM_A","action":"BAN","resultOrder":null,"sideSelectionMode":"NONE","sideSelector":null},{"stepNumber":2,"actor":"TEAM_B","action":"BAN","resultOrder":null,"sideSelectionMode":"NONE","sideSelector":null},{"stepNumber":3,"actor":"TEAM_A","action":"BAN","resultOrder":null,"sideSelectionMode":"NONE","sideSelector":null},{"stepNumber":4,"actor":"TEAM_B","action":"BAN","resultOrder":null,"sideSelectionMode":"NONE","sideSelector":null},{"stepNumber":5,"actor":"TEAM_A","action":"BAN","resultOrder":null,"sideSelectionMode":"NONE","sideSelector":null},{"stepNumber":6,"actor":"TEAM_B","action":"BAN","resultOrder":null,"sideSelectionMode":"NONE","sideSelector":null},{"stepNumber":7,"actor":"SYSTEM","action":"DECIDER","resultOrder":1,"sideSelectionMode":"OPPONENT_SELECTS","sideSelector":"TEAM_A"}]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "events" e
WHERE (SELECT count(*) FROM "event_maps" em WHERE em."event_id" = e."id") = 7
  AND NOT EXISTS (SELECT 1 FROM "event_veto_flows" f WHERE f."event_id" = e."id" AND f."name" = 'Bo1 (VCT)');

INSERT INTO "event_veto_flows" ("id", "event_id", "name", "steps_json", "created_at", "updated_at")
SELECT lower(hex(randomblob(16))), e."id", 'Bo3 (VCT)',
  '[{"stepNumber":1,"actor":"TEAM_A","action":"BAN","resultOrder":null,"sideSelectionMode":"NONE","sideSelector":null},{"stepNumber":2,"actor":"TEAM_B","action":"BAN","resultOrder":null,"sideSelectionMode":"NONE","sideSelector":null},{"stepNumber":3,"actor":"TEAM_A","action":"PICK","resultOrder":1,"sideSelectionMode":"OPPONENT_SELECTS","sideSelector":"TEAM_B"},{"stepNumber":4,"actor":"TEAM_B","action":"PICK","resultOrder":2,"sideSelectionMode":"OPPONENT_SELECTS","sideSelector":"TEAM_A"},{"stepNumber":5,"actor":"TEAM_A","action":"BAN","resultOrder":null,"sideSelectionMode":"NONE","sideSelector":null},{"stepNumber":6,"actor":"TEAM_B","action":"BAN","resultOrder":null,"sideSelectionMode":"NONE","sideSelector":null},{"stepNumber":7,"actor":"SYSTEM","action":"DECIDER","resultOrder":3,"sideSelectionMode":"OPPONENT_SELECTS","sideSelector":"TEAM_A"}]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "events" e
WHERE (SELECT count(*) FROM "event_maps" em WHERE em."event_id" = e."id") = 7
  AND NOT EXISTS (SELECT 1 FROM "event_veto_flows" f WHERE f."event_id" = e."id" AND f."name" = 'Bo3 (VCT)');

INSERT INTO "event_veto_flows" ("id", "event_id", "name", "steps_json", "created_at", "updated_at")
SELECT lower(hex(randomblob(16))), e."id", 'Bo5 (VCT)',
  '[{"stepNumber":1,"actor":"TEAM_A","action":"BAN","resultOrder":null,"sideSelectionMode":"NONE","sideSelector":null},{"stepNumber":2,"actor":"TEAM_B","action":"BAN","resultOrder":null,"sideSelectionMode":"NONE","sideSelector":null},{"stepNumber":3,"actor":"TEAM_A","action":"PICK","resultOrder":1,"sideSelectionMode":"OPPONENT_SELECTS","sideSelector":"TEAM_B"},{"stepNumber":4,"actor":"TEAM_B","action":"PICK","resultOrder":2,"sideSelectionMode":"OPPONENT_SELECTS","sideSelector":"TEAM_A"},{"stepNumber":5,"actor":"TEAM_A","action":"PICK","resultOrder":3,"sideSelectionMode":"OPPONENT_SELECTS","sideSelector":"TEAM_B"},{"stepNumber":6,"actor":"TEAM_B","action":"PICK","resultOrder":4,"sideSelectionMode":"OPPONENT_SELECTS","sideSelector":"TEAM_A"},{"stepNumber":7,"actor":"SYSTEM","action":"DECIDER","resultOrder":5,"sideSelectionMode":"OPPONENT_SELECTS","sideSelector":"TEAM_B"}]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "events" e
WHERE (SELECT count(*) FROM "event_maps" em WHERE em."event_id" = e."id") = 7
  AND NOT EXISTS (SELECT 1 FROM "event_veto_flows" f WHERE f."event_id" = e."id" AND f."name" = 'Bo5 (VCT)');
