CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE "companies" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "legalName" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Gaza',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "permissions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID,
  "key" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "permissions_company_fk" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE,
  CONSTRAINT "permissions_company_key_unique" UNIQUE ("companyId", "key")
);

CREATE TABLE "roles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "roles_company_fk" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE,
  CONSTRAINT "roles_company_name_unique" UNIQUE ("companyId", "name")
);

CREATE TABLE "role_permissions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "roleId" UUID NOT NULL,
  "permissionId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "role_permissions_role_fk" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE,
  CONSTRAINT "role_permissions_permission_fk" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE,
  CONSTRAINT "role_permissions_unique" UNIQUE ("roleId", "permissionId")
);

CREATE TABLE "users" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "phone" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "users_company_fk" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE,
  CONSTRAINT "users_company_email_unique" UNIQUE ("companyId", "email")
);

CREATE TABLE "user_roles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "roleId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "user_roles_user_fk" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "user_roles_role_fk" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE,
  CONSTRAINT "user_roles_unique" UNIQUE ("userId", "roleId")
);

CREATE TABLE "customers" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "shopName" TEXT NOT NULL,
  "phone" TEXT,
  "area" TEXT,
  "address" TEXT,
  "latitude" DECIMAL(9,6) NOT NULL,
  "longitude" DECIMAL(9,6) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "preferredVisitTime" TEXT,
  "balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "customers_company_fk" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE
);

CREATE INDEX "customers_company_idx" ON "customers" ("companyId");

CREATE TABLE "customer_assignments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customerId" UUID NOT NULL,
  "salespersonId" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "assignedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "customer_assignments_customer_fk" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE,
  CONSTRAINT "customer_assignments_salesperson_fk" FOREIGN KEY ("salespersonId") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "customer_assignments_company_fk" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE,
  CONSTRAINT "customer_assignments_unique" UNIQUE ("customerId", "salespersonId")
);

CREATE TABLE "customer_visits" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customerId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "visitedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "notes" TEXT,
  CONSTRAINT "customer_visits_customer_fk" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE,
  CONSTRAINT "customer_visits_user_fk" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "customer_visits_company_fk" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE
);

CREATE INDEX "customer_visits_customer_idx" ON "customer_visits" ("customerId", "visitedAt");

CREATE TABLE "customer_preferences" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customerId" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "customer_preferences_customer_fk" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE,
  CONSTRAINT "customer_preferences_unique" UNIQUE ("customerId", "key")
);

CREATE TABLE "products" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "price" DECIMAL(18,2) NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "products_company_fk" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE,
  CONSTRAINT "products_company_sku_unique" UNIQUE ("companyId", "sku")
);

CREATE INDEX "products_company_idx" ON "products" ("companyId");

CREATE TABLE "product_prices" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "productId" UUID NOT NULL,
  "price" DECIMAL(18,2) NOT NULL,
  "validFrom" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "validTo" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "product_prices_product_fk" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE
);

CREATE TABLE "inventory" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "productId" UUID NOT NULL,
  "warehouse" TEXT,
  "quantity" DECIMAL(18,3) NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "inventory_product_fk" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE,
  CONSTRAINT "inventory_product_warehouse_unique" UNIQUE ("productId", "warehouse")
);

CREATE TABLE "sales_orders" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "repId" UUID NOT NULL,
  "orderNumber" TEXT NOT NULL UNIQUE,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "source" TEXT NOT NULL DEFAULT 'manual',
  "total" DECIMAL(18,2) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "sales_orders_company_fk" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE,
  CONSTRAINT "sales_orders_customer_fk" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE,
  CONSTRAINT "sales_orders_rep_fk" FOREIGN KEY ("repId") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "sales_orders_status_check" CHECK ("status" IN ('pending', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled'))
);

CREATE INDEX "sales_orders_company_status_idx" ON "sales_orders" ("companyId", "status");

CREATE TABLE "order_items" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "quantity" DECIMAL(18,3) NOT NULL,
  "unitPrice" DECIMAL(18,2) NOT NULL,
  "lineTotal" DECIMAL(18,2) NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "order_items_order_fk" FOREIGN KEY ("orderId") REFERENCES "sales_orders"("id") ON DELETE CASCADE,
  CONSTRAINT "order_items_product_fk" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT
);

CREATE TABLE "order_status_history" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId" UUID NOT NULL,
  "status" TEXT NOT NULL,
  "changedById" UUID,
  "changedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "note" TEXT,
  CONSTRAINT "order_status_history_order_fk" FOREIGN KEY ("orderId") REFERENCES "sales_orders"("id") ON DELETE CASCADE
);

CREATE TABLE "vehicles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "plateNumber" TEXT NOT NULL,
  "label" TEXT,
  "capacityKg" DECIMAL(18,2),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "vehicles_company_fk" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE,
  CONSTRAINT "vehicles_company_plate_unique" UNIQUE ("companyId", "plateNumber")
);

CREATE TABLE "routes" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'planned',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "route_stops" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "routeId" UUID NOT NULL,
  "customerId" UUID,
  "stopLabel" TEXT,
  "sequence" INTEGER NOT NULL,
  "eta" TIMESTAMPTZ,
  "deliveryTaskId" UUID,
  CONSTRAINT "route_stops_route_fk" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE CASCADE
);

CREATE TABLE "delivery_tasks" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "vehicleId" UUID,
  "assigneeId" UUID,
  "status" TEXT NOT NULL DEFAULT 'assigned',
  "priority" TEXT NOT NULL DEFAULT 'normal',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "delivery_tasks_order_fk" FOREIGN KEY ("orderId") REFERENCES "sales_orders"("id") ON DELETE CASCADE,
  CONSTRAINT "delivery_tasks_vehicle_fk" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL
);

ALTER TABLE "route_stops"
  ADD CONSTRAINT "route_stops_delivery_task_fk"
  FOREIGN KEY ("deliveryTaskId") REFERENCES "delivery_tasks"("id");

CREATE TABLE "checkpoints" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "latitude" DECIMAL(9,6) NOT NULL,
  "longitude" DECIMAL(9,6) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "checkpoints_company_fk" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE,
  CONSTRAINT "checkpoints_status_check" CHECK ("status" IN ('open', 'closed', 'crowded'))
);

CREATE TABLE "road_segments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "fromLat" DECIMAL(9,6) NOT NULL,
  "fromLng" DECIMAL(9,6) NOT NULL,
  "toLat" DECIMAL(9,6) NOT NULL,
  "toLng" DECIMAL(9,6) NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "road_incidents" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "checkpointId" UUID,
  "incidentType" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "latitude" DECIMAL(9,6) NOT NULL,
  "longitude" DECIMAL(9,6) NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'medium',
  "status" TEXT NOT NULL DEFAULT 'open',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "road_incidents_company_fk" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE,
  CONSTRAINT "road_incidents_checkpoint_fk" FOREIGN KEY ("checkpointId") REFERENCES "checkpoints"("id") ON DELETE SET NULL,
  CONSTRAINT "road_incidents_status_check" CHECK ("status" IN ('open', 'confirmed', 'resolved'))
);

CREATE INDEX "road_incidents_company_status_idx" ON "road_incidents" ("companyId", "status");

CREATE TABLE "incident_confirmations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "incidentId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "confirmedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "note" TEXT,
  CONSTRAINT "incident_confirmations_incident_fk" FOREIGN KEY ("incidentId") REFERENCES "road_incidents"("id") ON DELETE CASCADE
);

CREATE TABLE "invoices" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "invoiceNumber" TEXT NOT NULL UNIQUE,
  "total" DECIMAL(18,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'issued',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "invoices_order_fk" FOREIGN KEY ("orderId") REFERENCES "sales_orders"("id") ON DELETE CASCADE
);

CREATE TABLE "payments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "method" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "collections" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "checks" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "checkNumber" TEXT NOT NULL UNIQUE,
  "amount" DECIMAL(18,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'issued',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "wallets" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "wallet_transactions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "walletId" UUID NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "direction" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "returns" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "financial_transactions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "reference" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "notifications" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "userId" UUID,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'in_app',
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "notifications_company_fk" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE,
  CONSTRAINT "notifications_user_fk" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX "notifications_company_read_idx" ON "notifications" ("companyId", "isRead");

CREATE TABLE "audit_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "userId" UUID,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "audit_logs_company_fk" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE,
  CONSTRAINT "audit_logs_user_fk" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE TABLE "sync_operations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "userId" UUID,
  "operationType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "sync_operations_company_fk" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE
);

CREATE TABLE "sync_operation_items" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "syncOperationId" UUID NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "requestHash" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "sync_operation_items_sync_operation_fk" FOREIGN KEY ("syncOperationId") REFERENCES "sync_operations"("id") ON DELETE CASCADE
);

CREATE TABLE "ai_transcripts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "userId" UUID,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT,
  "language" TEXT NOT NULL DEFAULT 'ar',
  "transcript" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "ai_analyses" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "intent" TEXT,
  "summary" TEXT,
  "confidence" DECIMAL(5,2),
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE "checkpoints"
  ADD COLUMN IF NOT EXISTS "geom" geography(Point,4326);

ALTER TABLE "road_incidents"
  ADD COLUMN IF NOT EXISTS "geom" geography(Point,4326);

CREATE INDEX "checkpoints_geom_idx" ON "checkpoints" USING GIST ("geom");
CREATE INDEX "road_incidents_geom_idx" ON "road_incidents" USING GIST ("geom");

CREATE INDEX "checkpoints_location_idx" ON "checkpoints" ("latitude", "longitude");
CREATE INDEX "road_incidents_location_idx" ON "road_incidents" ("latitude", "longitude");

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "companies_updated_at"
BEFORE UPDATE ON "companies"
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER "products_updated_at"
BEFORE UPDATE ON "products"
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER "users_updated_at"
BEFORE UPDATE ON "users"
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER "customers_updated_at"
BEFORE UPDATE ON "customers"
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER "sales_orders_updated_at"
BEFORE UPDATE ON "sales_orders"
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER "checkpoints_updated_at"
BEFORE UPDATE ON "checkpoints"
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER "road_incidents_updated_at"
BEFORE UPDATE ON "road_incidents"
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
