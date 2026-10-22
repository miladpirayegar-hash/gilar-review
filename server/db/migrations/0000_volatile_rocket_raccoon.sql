CREATE TABLE "actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"recommendation_id" uuid,
	"agent_run_id" uuid,
	"proposed_by_user_id" uuid,
	"approved_by_user_id" uuid,
	"status" varchar(28) NOT NULL,
	"target_system" varchar(40) NOT NULL,
	"operation" text NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"approved_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"outcome_id" uuid,
	"audit_event_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"status" varchar(24) NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"input_reference" text,
	"output_reference" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text NOT NULL,
	"status" varchar(24) NOT NULL,
	"required_permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"action_id" uuid NOT NULL,
	"requested_by_user_id" uuid,
	"reviewed_by_user_id" uuid,
	"status" varchar(24) NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"action" varchar(80) NOT NULL,
	"resource_type" varchar(80) NOT NULL,
	"resource_id" uuid,
	"occurred_at" timestamp with time zone NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"data_source_id" uuid,
	"key" varchar(80) NOT NULL,
	"name" varchar(160) NOT NULL,
	"category" varchar(40) NOT NULL,
	"unit" varchar(24) NOT NULL,
	"description" text,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"integration_id" uuid,
	"name" varchar(160) NOT NULL,
	"provider" varchar(40) NOT NULL,
	"record_type" varchar(80) NOT NULL,
	"sync_status" varchar(32) NOT NULL,
	"last_observed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"source_system" varchar(40) NOT NULL,
	"source_record_id" varchar(255),
	"metric_id" uuid,
	"signal_id" uuid,
	"observed_value" jsonb NOT NULL,
	"comparison_value" jsonb,
	"observed_at" timestamp with time zone NOT NULL,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"description" text NOT NULL,
	"strength" real NOT NULL,
	"relevance" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" varchar(180) NOT NULL,
	"summary" text NOT NULL,
	"category" varchar(60) NOT NULL,
	"source_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generated_at" timestamp with time zone NOT NULL,
	"status" varchar(24) NOT NULL,
	"ai_provenance" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"integration_id" uuid NOT NULL,
	"provider_account_id" varchar(255),
	"status" varchar(32) NOT NULL,
	"sync_status" varchar(32) NOT NULL,
	"encrypted_credential_ref" text,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider" varchar(40) NOT NULL,
	"display_name" varchar(120) NOT NULL,
	"status" varchar(32) NOT NULL,
	"permission_level" varchar(20) DEFAULT 'observe' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" varchar(180) NOT NULL,
	"description" text NOT NULL,
	"severity" varchar(16) NOT NULL,
	"category" varchar(60) NOT NULL,
	"signal_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"root_cause_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"impact" jsonb NOT NULL,
	"confidence" real NOT NULL,
	"status" varchar(24) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"role" varchar(24) NOT NULL,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"metric_id" uuid NOT NULL,
	"value" real NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"source_record_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"type" varchar(32) NOT NULL,
	"title" varchar(180) NOT NULL,
	"description" text NOT NULL,
	"deep_link" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"root_cause_id" uuid,
	"title" varchar(180) NOT NULL,
	"category" varchar(60) NOT NULL,
	"summary" text NOT NULL,
	"evidence_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"estimated_annual_value" real NOT NULL,
	"estimated_savings" real NOT NULL,
	"estimated_revenue_upside" real NOT NULL,
	"roi" real NOT NULL,
	"urgency" real NOT NULL,
	"confidence" real NOT NULL,
	"implementation_difficulty" real NOT NULL,
	"priority_score" real NOT NULL,
	"status" varchar(24) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"action_id" uuid,
	"recommendation_id" uuid,
	"metric_id" uuid NOT NULL,
	"baseline_value" real NOT NULL,
	"post_intervention_value" real NOT NULL,
	"measured_at" timestamp with time zone NOT NULL,
	"measurement_start" timestamp with time zone NOT NULL,
	"measurement_end" timestamp with time zone NOT NULL,
	"time_saved_hours" real,
	"cost_saved" real,
	"revenue_gained" real,
	"annualized_impact" real,
	"confidence" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"solution_id" uuid NOT NULL,
	"rationale" text NOT NULL,
	"evidence_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expected_benefit" text NOT NULL,
	"expected_roi" real NOT NULL,
	"estimated_time_saved_hours" real NOT NULL,
	"implementation_complexity" varchar(16) NOT NULL,
	"confidence" real NOT NULL,
	"risks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"required_permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"approval_required" integer DEFAULT 1 NOT NULL,
	"ai_provenance" jsonb,
	"status" varchar(24) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roi_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"outcome_id" uuid NOT NULL,
	"baseline_metric" text NOT NULL,
	"post_intervention_metric" text NOT NULL,
	"time_saved_hours" real NOT NULL,
	"cost_saved" real NOT NULL,
	"revenue_gained" real NOT NULL,
	"annualized_impact" real NOT NULL,
	"confidence" real NOT NULL,
	"measurement_period_start" timestamp with time zone NOT NULL,
	"measurement_period_end" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "root_causes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"title" varchar(180) NOT NULL,
	"explanation" text NOT NULL,
	"contributing_factor_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence" real NOT NULL,
	"sort_order" integer NOT NULL,
	"is_primary" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"metric_id" uuid NOT NULL,
	"source_id" uuid,
	"name" varchar(180) NOT NULL,
	"description" text NOT NULL,
	"current_value" real NOT NULL,
	"baseline_value" real NOT NULL,
	"absolute_change" real NOT NULL,
	"percentage_change" real NOT NULL,
	"direction" varchar(12) NOT NULL,
	"severity" varchar(16) NOT NULL,
	"detected_at" timestamp with time zone NOT NULL,
	"confidence" real NOT NULL,
	"observation_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar(24) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "solutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text NOT NULL,
	"implementation_complexity" varchar(16) NOT NULL,
	"required_permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"approval_required" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"display_name" varchar(160) NOT NULL,
	"avatar_url" text,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"timezone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "actions_tenant_idx" ON "actions" USING btree ("organization_id","workspace_id");--> statement-breakpoint
CREATE INDEX "agent_runs_tenant_idx" ON "agent_runs" USING btree ("organization_id","workspace_id");--> statement-breakpoint
CREATE INDEX "agents_tenant_idx" ON "agents" USING btree ("organization_id","workspace_id");--> statement-breakpoint
CREATE INDEX "approvals_tenant_idx" ON "approvals" USING btree ("organization_id","workspace_id");--> statement-breakpoint
CREATE INDEX "audit_events_tenant_idx" ON "audit_events" USING btree ("organization_id","workspace_id");--> statement-breakpoint
CREATE INDEX "business_metrics_tenant_idx" ON "business_metrics" USING btree ("organization_id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "business_metrics_key_idx" ON "business_metrics" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE INDEX "data_sources_tenant_idx" ON "data_sources" USING btree ("organization_id","workspace_id");--> statement-breakpoint
CREATE INDEX "evidence_tenant_idx" ON "evidence" USING btree ("organization_id","workspace_id");--> statement-breakpoint
CREATE INDEX "insights_tenant_idx" ON "insights" USING btree ("organization_id","workspace_id");--> statement-breakpoint
CREATE INDEX "integration_connections_tenant_idx" ON "integration_connections" USING btree ("organization_id","workspace_id");--> statement-breakpoint
CREATE INDEX "integrations_tenant_idx" ON "integrations" USING btree ("organization_id","workspace_id");--> statement-breakpoint
CREATE INDEX "issues_tenant_idx" ON "issues" USING btree ("organization_id","workspace_id");--> statement-breakpoint
CREATE INDEX "memberships_tenant_idx" ON "memberships" USING btree ("organization_id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_user_workspace_idx" ON "memberships" USING btree ("user_id","workspace_id");--> statement-breakpoint
CREATE INDEX "metric_observations_tenant_metric_idx" ON "metric_observations" USING btree ("organization_id","workspace_id","metric_id");--> statement-breakpoint
CREATE INDEX "notifications_tenant_idx" ON "notifications" USING btree ("organization_id","workspace_id");--> statement-breakpoint
CREATE INDEX "opportunities_tenant_idx" ON "opportunities" USING btree ("organization_id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_idx" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "outcomes_tenant_idx" ON "outcomes" USING btree ("organization_id","workspace_id");--> statement-breakpoint
CREATE INDEX "recommendations_tenant_idx" ON "recommendations" USING btree ("organization_id","workspace_id");--> statement-breakpoint
CREATE INDEX "roi_records_tenant_idx" ON "roi_records" USING btree ("organization_id","workspace_id");--> statement-breakpoint
CREATE INDEX "root_causes_tenant_idx" ON "root_causes" USING btree ("organization_id","workspace_id");--> statement-breakpoint
CREATE INDEX "signals_tenant_idx" ON "signals" USING btree ("organization_id","workspace_id");--> statement-breakpoint
CREATE INDEX "solutions_tenant_idx" ON "solutions" USING btree ("organization_id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "workspaces_org_idx" ON "workspaces" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_org_slug_idx" ON "workspaces" USING btree ("organization_id","slug");