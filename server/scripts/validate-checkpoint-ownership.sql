-- Run manually only after approved remediation. This never edits business rows.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.road_incidents i
    LEFT JOIN public.checkpoints c ON c.id = i."checkpointId"
    WHERE i."checkpointId" IS NOT NULL
      AND (c.id IS NULL OR c."companyId" <> i."companyId")
  ) THEN
    RAISE EXCEPTION 'Ownership violations remain. Obtain approval for record remediation first; no records have been changed.';
  END IF;
END;
$$;
ALTER TABLE public.road_incidents
  VALIDATE CONSTRAINT road_incidents_company_checkpoint_fk;
COMMIT;
