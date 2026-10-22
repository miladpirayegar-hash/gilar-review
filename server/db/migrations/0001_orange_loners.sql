CREATE TABLE "integration_sync_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"sync_run_id" uuid NOT NULL,
	"entity_type" varchar(64) NOT NULL,
	"status" varchar(24) NOT NULL,
	"page" integer DEFAULT 1 NOT NULL,
	"records_synced" integer DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"integration_id" uuid NOT NULL,
	"mode" varchar(24) NOT NULL,
	"status" varchar(24) NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"cursor" text,
	"records_synced" integer DEFAULT 0 NOT NULL,
	"company_name" varchar(255),
	"stages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"analysis" jsonb,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "normalized_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"entity_type" varchar(64) NOT NULL,
	"provider" varchar(40) NOT NULL,
	"realm_id" varchar(128),
	"external_record_id" varchar(255) NOT NULL,
	"source_entity_type" varchar(64) NOT NULL,
	"source_updated_at" timestamp with time zone,
	"synchronized_at" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_connections" ADD COLUMN "realm_id" varchar(128);--> statement-breakpoint
ALTER TABLE "integration_connections" ADD COLUMN "connected_user_id" uuid;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD COLUMN "access_token_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD COLUMN "refresh_token_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD COLUMN "last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD COLUMN "last_successful_sync_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "integration_sync_entities_tenant_idx" ON "integration_sync_entities" USING btree ("organization_id","workspace_id","sync_run_id");--> statement-breakpoint
CREATE INDEX "integration_sync_runs_tenant_idx" ON "integration_sync_runs" USING btree ("organization_id","workspace_id","integration_id");--> statement-breakpoint
CREATE INDEX "normalized_records_tenant_idx" ON "normalized_records" USING btree ("organization_id","workspace_id","entity_type");--> statement-breakpoint
CREATE UNIQUE INDEX "normalized_records_external_idx" ON "normalized_records" USING btree ("workspace_id","provider","entity_type","external_record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_connections_provider_realm_idx" ON "integration_connections" USING btree ("workspace_id","integration_id","realm_id");