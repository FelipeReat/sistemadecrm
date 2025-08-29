CREATE TABLE "automations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phase" text NOT NULL,
	"trigger" text NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact" text NOT NULL,
	"cpf" text,
	"company" text NOT NULL,
	"cnpj" text,
	"phone" text NOT NULL,
	"has_registration" boolean DEFAULT false,
	"proposal_origin" text,
	"business_temperature" text,
	"need_category" text NOT NULL,
	"client_needs" text NOT NULL,
	"documents" text[],
	"opportunity_number" text,
	"salesperson" text,
	"requires_visit" boolean DEFAULT false,
	"statement" text,
	"next_activity_date" timestamp,
	"visit_schedule" timestamp,
	"visit_realization" timestamp,
	"visit_photos" text[],
	"discount" numeric(5, 2),
	"discount_description" text,
	"validity_date" timestamp,
	"budget_number" text,
	"budget" numeric(12, 2),
	"status" text,
	"final_value" numeric(12, 2),
	"negotiation_info" text,
	"contract" text,
	"invoice_number" text,
	"loss_reason" text,
	"phase" text DEFAULT 'prospeccao' NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"phase_updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"password" varchar NOT NULL,
	"name" varchar NOT NULL,
	"phone" varchar,
	"bio" text,
	"role" varchar DEFAULT 'usuario' NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");