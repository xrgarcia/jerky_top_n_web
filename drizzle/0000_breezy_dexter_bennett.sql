CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"shopify_customer_id" text NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"display_name" text,
	"role" text DEFAULT 'user' NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_expiry" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_shopify_customer_id_unique" UNIQUE("shopify_customer_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"shopify_customer_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"customer_data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rankings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"ranking_name" text NOT NULL,
	"ranking_data" jsonb NOT NULL,
	"is_public" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "magic_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"email" text NOT NULL,
	"shopify_customer_id" text,
	"customer_data" jsonb,
	"used" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "magic_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "product_rankings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"shopify_product_id" text NOT NULL,
	"product_data" jsonb NOT NULL,
	"ranking" integer NOT NULL,
	"ranking_list_id" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "product_rankings_user_id_shopify_product_id_ranking_list_id_unique" UNIQUE("user_id","shopify_product_id","ranking_list_id")
);
--> statement-breakpoint
CREATE TABLE "user_product_searches" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"search_term" text NOT NULL,
	"result_count" integer NOT NULL,
	"page_name" text NOT NULL,
	"searched_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"icon" text NOT NULL,
	"icon_type" text DEFAULT 'emoji',
	"tier" text,
	"collection_type" text NOT NULL,
	"category" text,
	"protein_category" text,
	"protein_categories" jsonb,
	"is_hidden" integer DEFAULT 0,
	"prerequisite_achievement_id" integer,
	"requirement" jsonb NOT NULL,
	"tier_thresholds" jsonb,
	"has_tiers" integer DEFAULT 0,
	"points" integer DEFAULT 0,
	"is_active" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "achievements_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "coin_type_config" (
	"collection_type" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"tagline" text NOT NULL,
	"description" text NOT NULL,
	"icon" text NOT NULL,
	"color" text NOT NULL,
	"how_to_earn" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"achievement_id" integer NOT NULL,
	"current_tier" text,
	"percentage_complete" integer DEFAULT 0,
	"points_awarded" integer DEFAULT 0,
	"earned_at" timestamp DEFAULT now(),
	"progress" jsonb,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "streaks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"streak_type" text NOT NULL,
	"current_streak" integer DEFAULT 0,
	"longest_streak" integer DEFAULT 0,
	"last_activity_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"activity_type" text NOT NULL,
	"activity_data" jsonb NOT NULL,
	"is_public" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"shopify_product_id" text NOT NULL,
	"user_id" integer,
	"viewed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "products_metadata" (
	"id" serial PRIMARY KEY NOT NULL,
	"shopify_product_id" text NOT NULL,
	"animal_type" text,
	"animal_display" text,
	"animal_icon" text,
	"vendor" text,
	"primary_flavor" text,
	"secondary_flavors" text,
	"flavor_display" text,
	"flavor_icon" text,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "products_metadata_shopify_product_id_unique" UNIQUE("shopify_product_id")
);
--> statement-breakpoint
CREATE TABLE "page_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"page_type" text NOT NULL,
	"page_identifier" text,
	"referrer" text,
	"viewed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ranking_operations" (
	"id" serial PRIMARY KEY NOT NULL,
	"operation_id" text NOT NULL,
	"user_id" integer NOT NULL,
	"shopify_product_id" text NOT NULL,
	"ranking_list_id" text NOT NULL,
	"ranking" integer NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "ranking_operations_operation_id_unique" UNIQUE("operation_id")
);
--> statement-breakpoint
CREATE TABLE "customer_order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_number" text NOT NULL,
	"order_date" timestamp NOT NULL,
	"shopify_product_id" text NOT NULL,
	"sku" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"fulfillment_status" text,
	"user_id" integer NOT NULL,
	"customer_email" text NOT NULL,
	"line_item_data" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "customer_order_items_order_number_shopify_product_id_sku_unique" UNIQUE("order_number","shopify_product_id","sku")
);
--> statement-breakpoint
CREATE TABLE "system_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now(),
	"updated_by" text,
	CONSTRAINT "system_config_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "user_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"activity_type" text NOT NULL,
	"activity_data" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "taste_communities" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"icon" text NOT NULL,
	"criteria" jsonb NOT NULL,
	"member_count" integer DEFAULT 0,
	"is_active" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_classifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"journey_stage" text NOT NULL,
	"engagement_level" text NOT NULL,
	"exploration_breadth" text NOT NULL,
	"focus_areas" jsonb,
	"taste_community_id" integer,
	"classification_data" jsonb NOT NULL,
	"last_calculated" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_classifications_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "classification_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"config_key" text NOT NULL,
	"config_value" jsonb NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now(),
	"updated_by" text,
	CONSTRAINT "classification_config_config_key_unique" UNIQUE("config_key")
);
--> statement-breakpoint
CREATE TABLE "user_flavor_profile_communities" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"flavor_profile" text NOT NULL,
	"community_state" text NOT NULL,
	"products_purchased" integer DEFAULT 0,
	"products_delivered" integer DEFAULT 0,
	"products_ranked" integer DEFAULT 0,
	"avg_rank_position" integer,
	"highest_rank_position" integer,
	"lowest_rank_position" integer,
	"last_activity_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_flavor_profile_communities_user_id_flavor_profile_unique" UNIQUE("user_id","flavor_profile")
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rankings" ADD CONSTRAINT "rankings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_rankings" ADD CONSTRAINT "product_rankings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_product_searches" ADD CONSTRAINT "user_product_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_prerequisite_achievement_id_achievements_id_fk" FOREIGN KEY ("prerequisite_achievement_id") REFERENCES "public"."achievements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streaks" ADD CONSTRAINT "streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_views" ADD CONSTRAINT "product_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_views" ADD CONSTRAINT "page_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranking_operations" ADD CONSTRAINT "ranking_operations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_order_items" ADD CONSTRAINT "customer_order_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activities" ADD CONSTRAINT "user_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_classifications" ADD CONSTRAINT "user_classifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_classifications" ADD CONSTRAINT "user_classifications_taste_community_id_taste_communities_id_fk" FOREIGN KEY ("taste_community_id") REFERENCES "public"."taste_communities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_flavor_profile_communities" ADD CONSTRAINT "user_flavor_profile_communities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_customer_order_items_user_id" ON "customer_order_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_customer_order_items_user_product" ON "customer_order_items" USING btree ("user_id","shopify_product_id");--> statement-breakpoint
CREATE INDEX "idx_customer_order_items_user_date" ON "customer_order_items" USING btree ("user_id","order_date");--> statement-breakpoint
CREATE INDEX "idx_customer_order_items_order_date" ON "customer_order_items" USING btree ("order_date");--> statement-breakpoint
CREATE INDEX "idx_customer_order_items_fulfillment_status" ON "customer_order_items" USING btree ("fulfillment_status");--> statement-breakpoint
CREATE INDEX "idx_customer_order_items_date_status" ON "customer_order_items" USING btree ("order_date","fulfillment_status");--> statement-breakpoint
CREATE INDEX "idx_user_activities_user_id" ON "user_activities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_activities_user_type" ON "user_activities" USING btree ("user_id","activity_type");--> statement-breakpoint
CREATE INDEX "idx_user_activities_created_at" ON "user_activities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_user_classifications_user_id" ON "user_classifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_classifications_community_id" ON "user_classifications" USING btree ("taste_community_id");--> statement-breakpoint
CREATE INDEX "idx_user_flavor_profile_communities_user_id" ON "user_flavor_profile_communities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_flavor_profile_communities_flavor" ON "user_flavor_profile_communities" USING btree ("flavor_profile");--> statement-breakpoint
CREATE INDEX "idx_user_flavor_profile_communities_state" ON "user_flavor_profile_communities" USING btree ("community_state");--> statement-breakpoint
CREATE INDEX "idx_user_flavor_profile_communities_user_flavor_state" ON "user_flavor_profile_communities" USING btree ("user_id","flavor_profile","community_state");