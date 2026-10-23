CREATE TABLE "business_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"industry" varchar(120) NOT NULL,
	"sub_industry" varchar(120),
	"business_model" varchar(16) DEFAULT 'unknown' NOT NULL,
	"employee_count" integer,
	"annual_revenue_range" varchar(80),
	"geography" varchar(160),
	"customer_type" varchar(16),
	"sales_cycle" varchar(120),
	"primary_products_or_services" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"major_operating_functions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"goals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"current_challenges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"seasonality" varchar(120),
	"strategic_priorities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" varchar(24) DEFAULT 'onboarding' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "roi_records" ADD COLUMN "implementation_cost" real;
--> statement-breakpoint
CREATE INDEX "business_profiles_tenant_idx" ON "business_profiles" USING btree ("organization_id","workspace_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "business_profiles_workspace_idx" ON "business_profiles" USING btree ("workspace_id");
