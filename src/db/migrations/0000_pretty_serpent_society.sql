CREATE TYPE "public"."delivery_event_type" AS ENUM('registered', 'picked_up', 'out_for_delivery', 'delivered', 'failed_attempt', 'requeued');--> statement-breakpoint
CREATE TYPE "public"."parcel_status" AS ENUM('registered', 'picked_up', 'out_for_delivery', 'delivered', 'failed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "delivery_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parcel_id" uuid NOT NULL,
	"event_type" "delivery_event_type" NOT NULL,
	"notes" text,
	"occurred_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "parcels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tracking_number" text NOT NULL,
	"sender_name" text NOT NULL,
	"sender_address" text NOT NULL,
	"receiver_name" text NOT NULL,
	"receiver_address" text NOT NULL,
	"status" "parcel_status" DEFAULT 'registered' NOT NULL,
	"assigned_agent_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "parcels_tracking_number_unique" UNIQUE("tracking_number")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_parcel_id_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."parcels"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "parcels" ADD CONSTRAINT "parcels_assigned_agent_id_agents_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delivery_events_parcel_id_idx" ON "delivery_events" USING btree ("parcel_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "parcels_tracking_number_idx" ON "parcels" USING btree ("tracking_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "parcels_status_idx" ON "parcels" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "parcels_assigned_agent_id_idx" ON "parcels" USING btree ("assigned_agent_id");