-- Add missing tables that are defined in schema but not created in database

-- Email templates table
CREATE TABLE "email_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"trigger" text NOT NULL,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Email logs table
CREATE TABLE "email_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"template" text,
	"status" text NOT NULL,
	"error" text,
	"opportunity_id" varchar,
	"sent_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- User settings table
CREATE TABLE "user_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"email_notifications" boolean DEFAULT true,
	"sms_notifications" boolean DEFAULT false,
	"push_notifications" boolean DEFAULT false,
	"auto_backup" boolean DEFAULT true,
	"language" text DEFAULT 'pt-BR',
	"timezone" text DEFAULT 'America/Sao_Paulo',
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Audit logs table
CREATE TABLE "audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"changes" jsonb,
	"timestamp" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Sales reports table
CREATE TABLE "sales_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salesperson_id" text NOT NULL,
	"period" text NOT NULL,
	"year" integer NOT NULL,
	"month" integer,
	"total_opportunities" integer DEFAULT 0,
	"won_opportunities" integer DEFAULT 0,
	"lost_opportunities" integer DEFAULT 0,
	"total_value" numeric(12,2) DEFAULT '0',
	"won_value" numeric(12,2) DEFAULT '0',
	"conversion_rate" numeric(5,2) DEFAULT '0',
	"avg_deal_size" numeric(12,2) DEFAULT '0',
	"generated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- System backups table
CREATE TABLE "system_backups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" text NOT NULL,
	"size" integer NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Saved reports table
CREATE TABLE "saved_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'custom' NOT NULL,
	"filters" jsonb NOT NULL,
	"charts" jsonb NOT NULL,
	"layout" jsonb NOT NULL,
	"is_public" boolean DEFAULT false,
	"created_by" text NOT NULL,
	"last_generated" timestamp,
	"auto_refresh" boolean DEFAULT true,
	"refresh_interval" integer DEFAULT 30,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;