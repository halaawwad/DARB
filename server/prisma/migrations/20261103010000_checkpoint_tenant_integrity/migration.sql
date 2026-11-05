-- Preserve historical violations; enforce ownership for new/changed references.
-- Do not validate until the owner explicitly remediates the old audit fixture.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE UNIQUE INDEX "checkpoints_company_id_key" ON "checkpoints" ("companyId", "id");
CREATE INDEX "checkpoints_companyId_idx" ON "checkpoints" ("companyId");
ALTER TABLE "road_incidents"
  ADD CONSTRAINT "road_incidents_company_checkpoint_fk"
  FOREIGN KEY ("companyId", "checkpointId")
  REFERENCES "checkpoints" ("companyId", "id")
  ON DELETE NO ACTION ON UPDATE NO ACTION NOT VALID;
ALTER TABLE "road_incidents" DROP CONSTRAINT "road_incidents_checkpoint_fk";
COMMIT;
