-- Append-only operations and their projection are committed together under a tenant lock.
CREATE TABLE "finance_workspaces" (
  "companyId" UUID NOT NULL,
  "state" JSONB NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "finance_workspaces_pkey" PRIMARY KEY ("companyId"),
  CONSTRAINT "finance_workspaces_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
