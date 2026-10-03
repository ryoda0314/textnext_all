
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "admin_email_allowlist": {
                  Row: {
                    "created_at": string,"email": string,"note": string | null
                  }
                  Insert: {
                    "created_at"?: string,"email": string,"note"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"note"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"banned_emails": {
                  Row: {
                    "created_at": string,"email_hash": string,"reason": string | null
                  }
                  Insert: {
                    "created_at"?: string,"email_hash": string,"reason"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"email_hash"?: string,"reason"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"book_cache": {
                  Row: {
                    "author": string | null,"fetched_at": string,"isbn": string,"list_price": number | null,"publisher": string | null,"source": string,"title": string
                  }
                  Insert: {
                    "author"?: string | null,"fetched_at"?: string,"isbn": string,"list_price"?: number | null,"publisher"?: string | null,"source": string,"title": string
                  }
                  Update: {
                    "author"?: string | null,"fetched_at"?: string,"isbn"?: string,"list_price"?: number | null,"publisher"?: string | null,"source"?: string,"title"?: string
                  }
                  Relationships: [
                    
                  ]
                },"campuses": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"name": string,"sort_order": number,"university_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"sort_order"?: number,"university_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"sort_order"?: number,"university_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "campuses_university_id_fkey"
      columns: ["university_id"]
isOneToOne: false
      referencedRelation: "universities"
      referencedColumns: ["id"]
    }
                  ]
                },"favorites": {
                  Row: {
                    "created_at": string,"item_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"item_id": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"item_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "favorites_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "favorites_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "market_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "favorites_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "my_trades"
      referencedColumns: ["counterpart_id"]
    },{
      foreignKeyName: "favorites_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"inquiries": {
                  Row: {
                    "body": string,"category": string,"created_at": string,"email": string | null,"id": string,"replied_at": string | null,"reply": string | null,"status": string,"university_id": string | null,"user_id": string | null
                  }
                  Insert: {
                    "body": string,"category": string,"created_at"?: string,"email"?: string | null,"id"?: string,"replied_at"?: string | null,"reply"?: string | null,"status"?: string,"university_id"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "body"?: string,"category"?: string,"created_at"?: string,"email"?: string | null,"id"?: string,"replied_at"?: string | null,"reply"?: string | null,"status"?: string,"university_id"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "inquiries_university_id_fkey"
      columns: ["university_id"]
isOneToOne: false
      referencedRelation: "universities"
      referencedColumns: ["id"]
    }
                  ]
                },"items": {
                  Row: {
                    "author": string | null,"campus_id": string | null,"condition": string,"course_name": string | null,"created_at": string,"description": string | null,"favorite_count": number,"id": string,"images": NonNullable<Json>,"isbn": string | null,"list_price": number,"price": number,"publisher": string | null,"removed_reason": string | null,"search_text": string,"seller_id": string,"sold_at": string | null,"status": string,"title": string,"university_id": string,"updated_at": string,"writing": string
                  }
                  Insert: {
                    "author"?: string | null,"campus_id"?: string | null,"condition": string,"course_name"?: string | null,"created_at"?: string,"description"?: string | null,"favorite_count"?: number,"id"?: string,"images"?: NonNullable<Json>,"isbn"?: string | null,"list_price": number,"price": number,"publisher"?: string | null,"removed_reason"?: string | null,"search_text"?: string,"seller_id"?: string,"sold_at"?: string | null,"status"?: string,"title": string,"university_id"?: string,"updated_at"?: string,"writing"?: string
                  }
                  Update: {
                    "author"?: string | null,"campus_id"?: string | null,"condition"?: string,"course_name"?: string | null,"created_at"?: string,"description"?: string | null,"favorite_count"?: number,"id"?: string,"images"?: NonNullable<Json>,"isbn"?: string | null,"list_price"?: number,"price"?: number,"publisher"?: string | null,"removed_reason"?: string | null,"search_text"?: string,"seller_id"?: string,"sold_at"?: string | null,"status"?: string,"title"?: string,"university_id"?: string,"updated_at"?: string,"writing"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "items_campus_id_fkey"
      columns: ["campus_id"]
isOneToOne: false
      referencedRelation: "campuses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "items_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "my_trades"
      referencedColumns: ["counterpart_id"]
    },{
      foreignKeyName: "items_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "items_university_id_fkey"
      columns: ["university_id"]
isOneToOne: false
      referencedRelation: "universities"
      referencedColumns: ["id"]
    }
                  ]
                },"meetup_spots": {
                  Row: {
                    "campus_id": string | null,"created_at": string,"description": string | null,"id": string,"is_active": boolean,"name": string,"sort_order": number,"university_id": string
                  }
                  Insert: {
                    "campus_id"?: string | null,"created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"sort_order"?: number,"university_id": string
                  }
                  Update: {
                    "campus_id"?: string | null,"created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"sort_order"?: number,"university_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meetup_spots_campus_id_fkey"
      columns: ["campus_id"]
isOneToOne: false
      referencedRelation: "campuses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meetup_spots_university_id_fkey"
      columns: ["university_id"]
isOneToOne: false
      referencedRelation: "universities"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "body": string | null,"created_at": string,"event": string | null,"id": string,"image_path": string | null,"kind": string,"payload": Json | null,"sender_id": string | null,"trade_id": string
                  }
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"event"?: string | null,"id"?: string,"image_path"?: string | null,"kind"?: string,"payload"?: Json | null,"sender_id"?: string | null,"trade_id": string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"event"?: string | null,"id"?: string,"image_path"?: string | null,"kind"?: string,"payload"?: Json | null,"sender_id"?: string | null,"trade_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "my_trades"
      referencedColumns: ["counterpart_id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_trade_id_fkey"
      columns: ["trade_id"]
isOneToOne: false
      referencedRelation: "my_trades"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_trade_id_fkey"
      columns: ["trade_id"]
isOneToOne: false
      referencedRelation: "trades"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"created_at": string,"id": string,"item_id": string | null,"link": string | null,"read_at": string | null,"title": string,"trade_id": string | null,"type": string,"user_id": string
                  }
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"item_id"?: string | null,"link"?: string | null,"read_at"?: string | null,"title": string,"trade_id"?: string | null,"type": string,"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"id"?: string,"item_id"?: string | null,"link"?: string | null,"read_at"?: string | null,"title"?: string,"trade_id"?: string | null,"type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "my_trades"
      referencedColumns: ["counterpart_id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"bio": string | null,"campus_id": string | null,"completed_trades": number,"created_at": string,"deleted_at": string | null,"department": string | null,"faculty": string | null,"grade": string | null,"id": string,"listings_paused": boolean,"nickname": string,"rating_bad": number,"rating_good": number,"rating_normal": number,"university_id": string,"updated_at": string
                  }
                  Insert: {
                    "avatar_path"?: string | null,"bio"?: string | null,"campus_id"?: string | null,"completed_trades"?: number,"created_at"?: string,"deleted_at"?: string | null,"department"?: string | null,"faculty"?: string | null,"grade"?: string | null,"id": string,"listings_paused"?: boolean,"nickname": string,"rating_bad"?: number,"rating_good"?: number,"rating_normal"?: number,"university_id": string,"updated_at"?: string
                  }
                  Update: {
                    "avatar_path"?: string | null,"bio"?: string | null,"campus_id"?: string | null,"completed_trades"?: number,"created_at"?: string,"deleted_at"?: string | null,"department"?: string | null,"faculty"?: string | null,"grade"?: string | null,"id"?: string,"listings_paused"?: boolean,"nickname"?: string,"rating_bad"?: number,"rating_good"?: number,"rating_normal"?: number,"university_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_campus_id_fkey"
      columns: ["campus_id"]
isOneToOne: false
      referencedRelation: "campuses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profiles_university_id_fkey"
      columns: ["university_id"]
isOneToOne: false
      referencedRelation: "universities"
      referencedColumns: ["id"]
    }
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"id": string,"last_success_at": string | null,"p256dh": string,"user_agent": string | null,"user_id": string
                  }
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"id"?: string,"last_success_at"?: string | null,"p256dh": string,"user_agent"?: string | null,"user_id": string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"id"?: string,"last_success_at"?: string | null,"p256dh"?: string,"user_agent"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subscriptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "my_trades"
      referencedColumns: ["counterpart_id"]
    },{
      foreignKeyName: "push_subscriptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ratings": {
                  Row: {
                    "comment": string | null,"created_at": string,"ratee_id": string,"rater_id": string,"rater_role": string,"score": string,"trade_id": string
                  }
                  Insert: {
                    "comment"?: string | null,"created_at"?: string,"ratee_id": string,"rater_id": string,"rater_role": string,"score": string,"trade_id": string
                  }
                  Update: {
                    "comment"?: string | null,"created_at"?: string,"ratee_id"?: string,"rater_id"?: string,"rater_role"?: string,"score"?: string,"trade_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ratings_ratee_id_fkey"
      columns: ["ratee_id"]
isOneToOne: false
      referencedRelation: "my_trades"
      referencedColumns: ["counterpart_id"]
    },{
      foreignKeyName: "ratings_ratee_id_fkey"
      columns: ["ratee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ratings_rater_id_fkey"
      columns: ["rater_id"]
isOneToOne: false
      referencedRelation: "my_trades"
      referencedColumns: ["counterpart_id"]
    },{
      foreignKeyName: "ratings_rater_id_fkey"
      columns: ["rater_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ratings_trade_id_fkey"
      columns: ["trade_id"]
isOneToOne: false
      referencedRelation: "my_trades"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ratings_trade_id_fkey"
      columns: ["trade_id"]
isOneToOne: false
      referencedRelation: "trades"
      referencedColumns: ["id"]
    }
                  ]
                },"reports": {
                  Row: {
                    "admin_note": string | null,"created_at": string,"detail": string | null,"id": string,"reason": string,"reporter_id": string,"resolved_at": string | null,"resolved_by": string | null,"status": string,"target_id": string,"target_type": string,"university_id": string | null
                  }
                  Insert: {
                    "admin_note"?: string | null,"created_at"?: string,"detail"?: string | null,"id"?: string,"reason": string,"reporter_id": string,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string,"target_id": string,"target_type": string,"university_id"?: string | null
                  }
                  Update: {
                    "admin_note"?: string | null,"created_at"?: string,"detail"?: string | null,"id"?: string,"reason"?: string,"reporter_id"?: string,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string,"target_id"?: string,"target_type"?: string,"university_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "my_trades"
      referencedColumns: ["counterpart_id"]
    },{
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_university_id_fkey"
      columns: ["university_id"]
isOneToOne: false
      referencedRelation: "universities"
      referencedColumns: ["id"]
    }
                  ]
                },"signup_email_overrides": {
                  Row: {
                    "created_at": string,"email": string,"note": string | null,"university_id": string
                  }
                  Insert: {
                    "created_at"?: string,"email": string,"note"?: string | null,"university_id": string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"note"?: string | null,"university_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "signup_email_overrides_university_id_fkey"
      columns: ["university_id"]
isOneToOne: false
      referencedRelation: "universities"
      referencedColumns: ["id"]
    }
                  ]
                },"trades": {
                  Row: {
                    "buyer_confirmed_at": string | null,"buyer_id": string,"buyer_read_at": string | null,"cancel_note": string | null,"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"completed_at": string | null,"created_at": string,"handed_over_at": string | null,"handover_method": string | null,"id": string,"item_id": string,"item_image": string | null,"item_title": string,"last_message_at": string,"last_message_preview": string | null,"meetup_confirmed_at": string | null,"meetup_date": string | null,"meetup_place": string | null,"meetup_reminded_on": string | null,"meetup_slot": string | null,"meetup_spot_id": string | null,"meetup_time": string | null,"payment_method": string,"price": number,"proposal": Json | null,"seller_confirmed_at": string | null,"seller_id": string,"seller_read_at": string | null,"status": string,"university_id": string,"updated_at": string
                  }
                  Insert: {
                    "buyer_confirmed_at"?: string | null,"buyer_id": string,"buyer_read_at"?: string | null,"cancel_note"?: string | null,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"completed_at"?: string | null,"created_at"?: string,"handed_over_at"?: string | null,"handover_method"?: string | null,"id"?: string,"item_id": string,"item_image"?: string | null,"item_title": string,"last_message_at"?: string,"last_message_preview"?: string | null,"meetup_confirmed_at"?: string | null,"meetup_date"?: string | null,"meetup_place"?: string | null,"meetup_reminded_on"?: string | null,"meetup_slot"?: string | null,"meetup_spot_id"?: string | null,"meetup_time"?: string | null,"payment_method": string,"price": number,"proposal"?: Json | null,"seller_confirmed_at"?: string | null,"seller_id": string,"seller_read_at"?: string | null,"status"?: string,"university_id": string,"updated_at"?: string
                  }
                  Update: {
                    "buyer_confirmed_at"?: string | null,"buyer_id"?: string,"buyer_read_at"?: string | null,"cancel_note"?: string | null,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"completed_at"?: string | null,"created_at"?: string,"handed_over_at"?: string | null,"handover_method"?: string | null,"id"?: string,"item_id"?: string,"item_image"?: string | null,"item_title"?: string,"last_message_at"?: string,"last_message_preview"?: string | null,"meetup_confirmed_at"?: string | null,"meetup_date"?: string | null,"meetup_place"?: string | null,"meetup_reminded_on"?: string | null,"meetup_slot"?: string | null,"meetup_spot_id"?: string | null,"meetup_time"?: string | null,"payment_method"?: string,"price"?: number,"proposal"?: Json | null,"seller_confirmed_at"?: string | null,"seller_id"?: string,"seller_read_at"?: string | null,"status"?: string,"university_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "trades_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "my_trades"
      referencedColumns: ["counterpart_id"]
    },{
      foreignKeyName: "trades_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trades_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trades_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "market_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trades_meetup_spot_id_fkey"
      columns: ["meetup_spot_id"]
isOneToOne: false
      referencedRelation: "meetup_spots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trades_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "my_trades"
      referencedColumns: ["counterpart_id"]
    },{
      foreignKeyName: "trades_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trades_university_id_fkey"
      columns: ["university_id"]
isOneToOne: false
      referencedRelation: "universities"
      referencedColumns: ["id"]
    }
                  ]
                },"universities": {
                  Row: {
                    "calil_system_id": string | null,"created_at": string,"external_url": string | null,"id": string,"is_auto_created": boolean,"meetup_slots": NonNullable<Json>,"name": string,"name_verified": boolean,"price_cap_percent": number,"short_name": string | null,"slug": string,"status": string,"updated_at": string
                  }
                  Insert: {
                    "calil_system_id"?: string | null,"created_at"?: string,"external_url"?: string | null,"id"?: string,"is_auto_created"?: boolean,"meetup_slots"?: NonNullable<Json>,"name": string,"name_verified"?: boolean,"price_cap_percent"?: number,"short_name"?: string | null,"slug": string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "calil_system_id"?: string | null,"created_at"?: string,"external_url"?: string | null,"id"?: string,"is_auto_created"?: boolean,"meetup_slots"?: NonNullable<Json>,"name"?: string,"name_verified"?: boolean,"price_cap_percent"?: number,"short_name"?: string | null,"slug"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"university_domains": {
                  Row: {
                    "created_at": string,"domain": string,"include_subdomains": boolean,"university_id": string
                  }
                  Insert: {
                    "created_at"?: string,"domain": string,"include_subdomains"?: boolean,"university_id": string
                  }
                  Update: {
                    "created_at"?: string,"domain"?: string,"include_subdomains"?: boolean,"university_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "university_domains_university_id_fkey"
      columns: ["university_id"]
isOneToOne: false
      referencedRelation: "universities"
      referencedColumns: ["id"]
    }
                  ]
                },"university_name_suggestions": {
                  Row: {
                    "created_at": string,"name": string,"university_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"name": string,"university_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"name"?: string,"university_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "university_name_suggestions_university_id_fkey"
      columns: ["university_id"]
isOneToOne: false
      referencedRelation: "universities"
      referencedColumns: ["id"]
    }
                  ]
                },"university_requests": {
                  Row: {
                    "contact_email": string | null,"created_at": string,"email_domain": string,"id": string,"university_name": string
                  }
                  Insert: {
                    "contact_email"?: string | null,"created_at"?: string,"email_domain": string,"id"?: string,"university_name": string
                  }
                  Update: {
                    "contact_email"?: string | null,"created_at"?: string,"email_domain"?: string,"id"?: string,"university_name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"user_restrictions": {
                  Row: {
                    "created_at": string,"created_by": string | null,"ends_at": string | null,"id": string,"kind": string,"lifted_at": string | null,"lifted_by": string | null,"reason": string,"starts_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"ends_at"?: string | null,"id"?: string,"kind": string,"lifted_at"?: string | null,"lifted_by"?: string | null,"reason": string,"starts_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"ends_at"?: string | null,"id"?: string,"kind"?: string,"lifted_at"?: string | null,"lifted_by"?: string | null,"reason"?: string,"starts_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"user_settings": {
                  Row: {
                    "created_at": string,"email_notifications": boolean,"terms_accepted_at": string | null,"terms_version": string | null,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"email_notifications"?: boolean,"terms_accepted_at"?: string | null,"terms_version"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"email_notifications"?: boolean,"terms_accepted_at"?: string | null,"terms_version"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_settings_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "my_trades"
      referencedColumns: ["counterpart_id"]
    },{
      foreignKeyName: "user_settings_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"wishes": {
                  Row: {
                    "created_at": string,"id": string,"isbn": string | null,"keyword": string | null,"keyword_norm": string | null,"label": string,"last_notified_at": string | null,"university_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"isbn"?: string | null,"keyword"?: string | null,"keyword_norm"?: string | null,"label": string,"last_notified_at"?: string | null,"university_id"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"isbn"?: string | null,"keyword"?: string | null,"keyword_norm"?: string | null,"label"?: string,"last_notified_at"?: string | null,"university_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "wishes_university_id_fkey"
      columns: ["university_id"]
isOneToOne: false
      referencedRelation: "universities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "wishes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "my_trades"
      referencedColumns: ["counterpart_id"]
    },{
      foreignKeyName: "wishes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "market_items": {
                  Row: {
                    "author": string | null,"campus_id": string | null,"campus_name": string | null,"condition": string | null,"course_name": string | null,"created_at": string | null,"favorite_count": number | null,"id": string | null,"images": Json | null,"isbn": string | null,"list_price": number | null,"price": number | null,"publisher": string | null,"search_text": string | null,"seller_avatar_path": string | null,"seller_department": string | null,"seller_faculty": string | null,"seller_id": string | null,"seller_nickname": string | null,"seller_rating_bad": number | null,"seller_rating_good": number | null,"status": string | null,"title": string | null,"university_id": string | null,"writing": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "items_campus_id_fkey"
      columns: ["campus_id"]
isOneToOne: false
      referencedRelation: "campuses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "items_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "my_trades"
      referencedColumns: ["counterpart_id"]
    },{
      foreignKeyName: "items_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "items_university_id_fkey"
      columns: ["university_id"]
isOneToOne: false
      referencedRelation: "universities"
      referencedColumns: ["id"]
    }
                  ]
                },"my_trades": {
                  Row: {
                    "buyer_confirmed_at": string | null,"buyer_id": string | null,"cancel_reason": string | null,"cancelled_at": string | null,"completed_at": string | null,"counterpart_avatar_path": string | null,"counterpart_id": string | null,"counterpart_nickname": string | null,"created_at": string | null,"handed_over_at": string | null,"i_rated": boolean | null,"id": string | null,"item_id": string | null,"item_image": string | null,"item_title": string | null,"last_message_at": string | null,"last_message_preview": string | null,"meetup_date": string | null,"meetup_place": string | null,"meetup_slot": string | null,"meetup_time": string | null,"my_role": string | null,"payment_method": string | null,"price": number | null,"proposal": Json | null,"seller_confirmed_at": string | null,"seller_id": string | null,"status": string | null,"university_id": string | null,"unread_count": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "trades_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "my_trades"
      referencedColumns: ["counterpart_id"]
    },{
      foreignKeyName: "trades_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trades_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trades_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "market_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trades_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "my_trades"
      referencedColumns: ["counterpart_id"]
    },{
      foreignKeyName: "trades_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trades_university_id_fkey"
      columns: ["university_id"]
isOneToOne: false
      referencedRelation: "universities"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "accept_terms":
{ Args: { "p_terms_version": string }; Returns: undefined
                           },
"admin_apply_university_name":
{ Args: { "p_name": string,"p_short_name"?: string,"p_university_id": string }; Returns: undefined
                           },
"admin_cancel_trade":
{ Args: { "p_note"?: string,"p_trade_id": string }; Returns: undefined
                           },
"admin_dashboard":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_lift_restriction":
{ Args: { "p_restriction_id": string }; Returns: undefined
                           },
"admin_mark_handed_over":
{ Args: { "p_trade_id": string }; Returns: undefined
                           },
"admin_merge_universities":
{ Args: { "p_source": string,"p_target": string }; Returns: undefined
                           },
"admin_notify_user":
{ Args: { "p_body": string,"p_link"?: string,"p_title": string,"p_user_id": string }; Returns: undefined
                           },
"admin_remove_domain":
{ Args: { "p_domain": string }; Returns: undefined
                           },
"admin_reply_inquiry":
{ Args: { "p_inquiry_id": string,"p_reply": string,"p_status"?: string }; Returns: undefined
                           },
"admin_resolve_report":
{ Args: { "p_note"?: string,"p_report_id": string,"p_status": string }; Returns: undefined
                           },
"admin_restrict_user":
{ Args: { "p_ends_at"?: string,"p_kind": string,"p_reason": string,"p_user_id": string }; Returns: string
                           },
"admin_save_campus":
{ Args: { "p_id": string,"p_is_active": boolean,"p_name": string,"p_sort_order": number,"p_university_id": string }; Returns: string
                           },
"admin_save_spot":
{ Args: { "p_campus_id": string,"p_description": string,"p_id": string,"p_is_active": boolean,"p_name": string,"p_sort_order": number,"p_university_id": string }; Returns: string
                           },
"admin_save_university":
{ Args: { "p_calil_system_id": string,"p_external_url": string,"p_id": string,"p_meetup_slots": Json,"p_name": string,"p_name_verified": boolean,"p_price_cap_percent": number,"p_short_name": string,"p_slug": string,"p_status": string }; Returns: string
                           },
"admin_search_users":
{ Args: { "p_limit"?: number,"p_query"?: string,"p_university_id"?: string }; Returns: {
              "completed_trades": number,"created_at": string,"deleted_at": string,"email": string,"faculty": string,"grade": string,"id": string,"nickname": string,"rating_bad": number,"restricted": boolean,"university_id": string,"university_name": string
            }[]
                           },
"admin_set_domain":
{ Args: { "p_domain": string,"p_include_subdomains"?: boolean,"p_university_id": string }; Returns: undefined
                           },
"admin_set_item_status":
{ Args: { "p_item_id": string,"p_reason"?: string,"p_status": string }; Returns: undefined
                           },
"admin_university_detail":
{ Args: { "p_university_id": string }; Returns: Json
                           },
"admin_user_detail":
{ Args: { "p_user_id": string }; Returns: Json
                           },
"affiliation_suggestions":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"cancel_trade":
{ Args: { "p_note"?: string,"p_reason": string,"p_trade_id": string }; Returns: undefined
                           },
"check_signup_email":
{ Args: { "p_email": string }; Returns: Json
                           },
"complete_handover":
{ Args: { "p_code": string,"p_trade_id": string }; Returns: Json
                           },
"complete_profile":
{ Args: { "p_campus_id": string,"p_department": string,"p_faculty": string,"p_grade": string,"p_nickname": string,"p_terms_version": string,"p_university_name"?: string }; Returns: {
              "avatar_path": string | null,
"bio": string | null,
"campus_id": string | null,
"completed_trades": number,
"created_at": string,
"deleted_at": string | null,
"department": string | null,
"faculty": string | null,
"grade": string | null,
"id": string,
"listings_paused": boolean,
"nickname": string,
"rating_bad": number,
"rating_good": number,
"rating_normal": number,
"university_id": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"confirm_handover":
{ Args: { "p_trade_id": string }; Returns: Json
                           },
"confirm_meetup":
{ Args: { "p_date": string,"p_slot": string,"p_spot_id"?: string,"p_time"?: string,"p_trade_id": string }; Returns: undefined
                           },
"delete_item":
{ Args: { "p_item_id": string }; Returns: Json
                           },
"delete_my_account":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_badge_counts":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_my_context":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"hook_before_user_created":
{ Args: { "event": Json }; Returns: Json
                           },
"is_nickname_available":
{ Args: { "p_nickname": string }; Returns: boolean
                           },
"is_platform_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"issue_handover_code":
{ Args: { "p_trade_id": string }; Returns: Json
                           },
"mark_notifications_read":
{ Args: { "p_ids"?: (string)[] }; Returns: undefined
                           },
"mark_trade_read":
{ Args: { "p_trade_id": string }; Returns: undefined
                           },
"my_university_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"propose_meetup":
{ Args: { "p_note"?: string,"p_other_place"?: string,"p_slots": Json,"p_spot_ids": (string)[],"p_trade_id": string }; Returns: undefined
                           },
"public_university_directory":
{ Args: Record<PropertyKey, never>; Returns: {
              "active_items": number,"members": number,"name": string,"short_name": string
            }[]
                           },
"rate_trade":
{ Args: { "p_comment"?: string,"p_score": string,"p_trade_id": string }; Returns: Json
                           },
"register_push_subscription":
{ Args: { "p_auth": string,"p_endpoint": string,"p_p256dh": string,"p_user_agent"?: string }; Returns: undefined
                           },
"request_trade":
{ Args: { "p_item_id": string,"p_message"?: string,"p_other_place"?: string,"p_payment_method": string,"p_slots": Json,"p_spot_ids": (string)[] }; Returns: string
                           },
"request_university":
{ Args: { "p_contact_email"?: string,"p_email": string,"p_university_name": string }; Returns: undefined
                           },
"search_items":
{ Args: { "p_campus_id"?: string,"p_faculty"?: string,"p_free_only"?: boolean,"p_include_reserved"?: boolean,"p_limit"?: number,"p_offset"?: number,"p_query"?: string,"p_sort"?: string }; Returns: {
              "author": string | null,
"campus_id": string | null,
"campus_name": string | null,
"condition": string | null,
"course_name": string | null,
"created_at": string | null,
"favorite_count": number | null,
"id": string | null,
"images": Json | null,
"isbn": string | null,
"list_price": number | null,
"price": number | null,
"publisher": string | null,
"search_text": string | null,
"seller_avatar_path": string | null,
"seller_department": string | null,
"seller_faculty": string | null,
"seller_id": string | null,
"seller_nickname": string | null,
"seller_rating_bad": number | null,
"seller_rating_good": number | null,
"status": string | null,
"title": string | null,
"university_id": string | null,
"writing": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "market_items"
        isOneToOne: false
        isSetofReturn: true
      } },
"stale_chat_images":
{ Args: { "p_limit"?: number }; Returns: {
              "image_path": string,"message_id": string
            }[]
                           },
"submit_inquiry":
{ Args: { "p_body": string,"p_category": string,"p_email"?: string }; Returns: string
                           },
"submit_report":
{ Args: { "p_detail"?: string,"p_reason": string,"p_target_id": string,"p_target_type": string }; Returns: string
                           },
"user_reviews":
{ Args: { "p_limit"?: number,"p_user_id": string }; Returns: {
              "comment": string,"created_at": string,"rater_nickname": string,"rater_role": string,"score": string
            }[]
                           },
"wish_demand":
{ Args: { "p_isbn": string }; Returns: number
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
