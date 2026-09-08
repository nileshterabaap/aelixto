export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          blocked_user_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          blocked_user_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          blocked_user_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      collection_items: {
        Row: {
          collection_id: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_items_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_id: string | null
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      connected_socials: {
        Row: {
          access_token: string
          created_at: string
          id: string
          platform: string
          platform_user_id: string
          platform_username: string
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          id?: string
          platform: string
          platform_user_id: string
          platform_username: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          id?: string
          platform?: string
          platform_user_id?: string
          platform_username?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          last_delivered_at: string | null
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          last_delivered_at?: string | null
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          last_delivered_at?: string | null
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          bundle_id: string | null
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bundle_id?: string | null
          created_at?: string
          id?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bundle_id?: string | null
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      domain_classifications: {
        Row: {
          content_type: string
          domain: string
          updated_at: string
          updated_by: string | null
          vote_count: number
        }
        Insert: {
          content_type: string
          domain: string
          updated_at?: string
          updated_by?: string | null
          vote_count?: number
        }
        Update: {
          content_type?: string
          domain?: string
          updated_at?: string
          updated_by?: string | null
          vote_count?: number
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      follow_requests: {
        Row: {
          created_at: string
          id: string
          requester_id: string
          target_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          requester_id: string
          target_id: string
        }
        Update: {
          created_at?: string
          id?: string
          requester_id?: string
          target_id?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      hidden_posts: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hidden_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      hidden_users: {
        Row: {
          created_at: string
          hidden_user_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hidden_user_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hidden_user_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      install_metadata: {
        Row: {
          device_id: string
          first_seen_at: string
          platform: string | null
          user_id: string
        }
        Insert: {
          device_id: string
          first_seen_at?: string
          platform?: string | null
          user_id: string
        }
        Update: {
          device_id?: string
          first_seen_at?: string
          platform?: string | null
          user_id?: string
        }
        Relationships: []
      }
      likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      link_previews: {
        Row: {
          created_at: string | null
          data: Json
          id: string
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          data: Json
          id?: string
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          data?: Json
          id?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
          updated_at: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string
          comment_id: string | null
          created_at: string
          id: string
          is_read: boolean
          metadata: Json | null
          post_id: string | null
          recipient_id: string
          type: string
        }
        Insert: {
          actor_id: string
          comment_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          post_id?: string | null
          recipient_id: string
          type: string
        }
        Update: {
          actor_id?: string
          comment_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
          post_id?: string | null
          recipient_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      post_drafts: {
        Row: {
          caption: string | null
          created_at: string
          embed_html: string | null
          id: string
          link_url: string | null
          media_type: string | null
          og_type: string | null
          platform: string | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          embed_html?: string | null
          id?: string
          link_url?: string | null
          media_type?: string | null
          og_type?: string | null
          platform?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          embed_html?: string | null
          id?: string
          link_url?: string | null
          media_type?: string | null
          og_type?: string | null
          platform?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      post_seen: {
        Row: {
          id: number
          post_id: string
          seen_at: string
          user_id: string
        }
        Insert: {
          id?: never
          post_id: string
          seen_at?: string
          user_id: string
        }
        Update: {
          id?: never
          post_id?: string
          seen_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_seen_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_views: {
        Row: {
          author_id: string
          created_at: string
          device_hash: string | null
          duration_ms: number
          event_type: string
          hour_bucket: string
          id: number
          ip_hash: string | null
          post_id: string
          viewer_id: string | null
        }
        Insert: {
          author_id: string
          created_at?: string
          device_hash?: string | null
          duration_ms?: number
          event_type: string
          hour_bucket?: string
          id?: number
          ip_hash?: string | null
          post_id: string
          viewer_id?: string | null
        }
        Update: {
          author_id?: string
          created_at?: string
          device_hash?: string | null
          duration_ms?: number
          event_type?: string
          hour_bucket?: string
          id?: number
          ip_hash?: string | null
          post_id?: string
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_views_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          aspect_ratio: number | null
          broken_check_count: number
          broken_first_seen_at: string | null
          comments_count: number | null
          comments_disabled: boolean
          content: string
          created_at: string
          embed_html: string | null
          hide_counts: boolean
          id: string
          is_public: boolean
          last_validated_at: string | null
          likes_count: number | null
          media_kind: string | null
          media_type: string | null
          media_url: string | null
          pinned_at: string | null
          platform: string | null
          preview_image_url: string | null
          preview_text: string | null
          preview_title: string | null
          raw_json_data: Json | null
          reposts_count: number | null
          saves_count: number | null
          suggested_height: number | null
          thumbnail_url: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          aspect_ratio?: number | null
          broken_check_count?: number
          broken_first_seen_at?: string | null
          comments_count?: number | null
          comments_disabled?: boolean
          content: string
          created_at?: string
          embed_html?: string | null
          hide_counts?: boolean
          id?: string
          is_public?: boolean
          last_validated_at?: string | null
          likes_count?: number | null
          media_kind?: string | null
          media_type?: string | null
          media_url?: string | null
          pinned_at?: string | null
          platform?: string | null
          preview_image_url?: string | null
          preview_text?: string | null
          preview_title?: string | null
          raw_json_data?: Json | null
          reposts_count?: number | null
          saves_count?: number | null
          suggested_height?: number | null
          thumbnail_url?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          aspect_ratio?: number | null
          broken_check_count?: number
          broken_first_seen_at?: string | null
          comments_count?: number | null
          comments_disabled?: boolean
          content?: string
          created_at?: string
          embed_html?: string | null
          hide_counts?: boolean
          id?: string
          is_public?: boolean
          last_validated_at?: string | null
          likes_count?: number | null
          media_kind?: string | null
          media_type?: string | null
          media_url?: string | null
          pinned_at?: string | null
          platform?: string | null
          preview_image_url?: string | null
          preview_text?: string | null
          preview_title?: string | null
          raw_json_data?: Json | null
          reposts_count?: number | null
          saves_count?: number | null
          suggested_height?: number | null
          thumbnail_url?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          aelix_score: number
          avatar_url: string | null
          bio: string | null
          cover_url: string | null
          created_at: string
          display_name: string | null
          email_verified: boolean
          id: string
          search_tsv: unknown
          settings: Json
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          aelix_score?: number
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string | null
          email_verified?: boolean
          id?: string
          search_tsv?: unknown
          settings?: Json
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          aelix_score?: number
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string | null
          email_verified?: boolean
          id?: string
          search_tsv?: unknown
          settings?: Json
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id: string
          resolution: string | null
          resolved_at: string | null
          status: string
          target_post_id: string | null
          target_type: Database["public"]["Enums"]["report_target"]
          target_user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          target_post_id?: string | null
          target_type: Database["public"]["Enums"]["report_target"]
          target_user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: Database["public"]["Enums"]["report_reason"]
          reporter_id?: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          target_post_id?: string | null
          target_type?: Database["public"]["Enums"]["report_target"]
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_target_post_id_fkey"
            columns: ["target_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      reposts: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reposts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      saves: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saves_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      short_links: {
        Row: {
          click_count: number
          code: string
          created_at: string
          target_path: string
        }
        Insert: {
          click_count?: number
          code: string
          created_at?: string
          target_path: string
        }
        Update: {
          click_count?: number
          code?: string
          created_at?: string
          target_path?: string
        }
        Relationships: []
      }
      signup_otps: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          email: string
          expires_at: string
          last_sent_at: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          email: string
          expires_at: string
          last_sent_at?: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          email?: string
          expires_at?: string
          last_sent_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      am_i_blocked_by: { Args: { _target: string }; Returns: boolean }
      are_blocked: { Args: { _a: string; _b: string }; Returns: boolean }
      can_view_follow_list: {
        Args: { _kind: string; _target: string; _viewer: string }
        Returns: boolean
      }
      can_view_profile_posts: { Args: { _target: string }; Returns: boolean }
      cancel_follow_or_request: {
        Args: { _target: string }
        Returns: undefined
      }
      create_short_link: { Args: { p_target_path: string }; Returns: string }
      delete_conversation: {
        Args: { _conversation_id: string }
        Returns: boolean
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      delete_post_with_score: { Args: { p_post_id: string }; Returns: Json }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_email_for_username: { Args: { _username: string }; Returns: string }
      get_following_count: { Args: never; Returns: number }
      get_following_feed: {
        Args: { cursor_key?: string; limit_count: number }
        Returns: {
          comments_count: number
          content: string
          created_at: string
          embed_html: string
          feed_cursor: string
          id: string
          is_public: boolean
          is_repost: boolean
          likes_count: number
          media_type: string
          media_url: string
          platform: string
          preview_image_url: string
          preview_text: string
          preview_title: string
          profile_avatar_url: string
          profile_display_name: string
          profile_id: string
          profile_username: string
          reposted_at: string
          reposted_by_user_id: string
          reposted_by_username: string
          reposts_count: number
          saves_count: number
          thumbnail_url: string
          title: string
          user_id: string
        }[]
      }
      get_following_feed_v2:
        | {
            Args: { cursor_key?: string; limit_count: number }
            Returns: {
              aspect_ratio: number
              comments_count: number
              content: string
              created_at: string
              embed_html: string
              feed_cursor: string
              id: string
              is_public: boolean
              is_repost: boolean
              likes_count: number
              media_kind: string
              media_type: string
              media_url: string
              platform: string
              preview_image_url: string
              preview_text: string
              preview_title: string
              profile_avatar_url: string
              profile_display_name: string
              profile_id: string
              profile_username: string
              reposted_at: string
              reposted_by_user_id: string
              reposted_by_username: string
              reposts_count: number
              saves_count: number
              suggested_height: number
              thumbnail_url: string
              title: string
              user_id: string
            }[]
          }
        | {
            Args: {
              cursor_key?: string
              limit_count: number
              refresh_seed?: string
            }
            Returns: {
              aspect_ratio: number
              comments_count: number
              content: string
              created_at: string
              embed_html: string
              feed_cursor: string
              id: string
              is_public: boolean
              is_repost: boolean
              likes_count: number
              media_kind: string
              media_type: string
              media_url: string
              platform: string
              preview_image_url: string
              preview_text: string
              preview_title: string
              profile_avatar_url: string
              profile_display_name: string
              profile_id: string
              profile_username: string
              reposted_at: string
              reposted_by_user_id: string
              reposted_by_username: string
              reposts_count: number
              saves_count: number
              suggested_height: number
              thumbnail_url: string
              title: string
              user_id: string
            }[]
          }
      get_following_feed_v3: {
        Args: { cursor_key?: string; limit_count: number }
        Returns: {
          aspect_ratio: number
          comments_count: number
          content: string
          created_at: string
          embed_html: string
          feed_cursor: string
          id: string
          is_public: boolean
          is_repost: boolean
          likes_count: number
          media_kind: string
          media_type: string
          media_url: string
          platform: string
          preview_image_url: string
          preview_text: string
          preview_title: string
          profile_avatar_url: string
          profile_display_name: string
          profile_id: string
          profile_username: string
          reposted_at: string
          reposted_by_user_id: string
          reposted_by_username: string
          reposts_count: number
          saves_count: number
          suggested_height: number
          thumbnail_url: string
          title: string
          user_id: string
        }[]
      }
      get_mutual_followers: {
        Args: { profile_owner_id: string; viewer_id: string }
        Returns: {
          display_name: string
          username: string
        }[]
      }
      get_mutual_followers_with_count: {
        Args: { profile_owner_id: string; viewer_id: string }
        Returns: {
          display_name: string
          total_count: number
          username: string
        }[]
      }
      get_user_platform_counts: {
        Args: { target_user: string }
        Returns: {
          platform: string
          post_count: number
        }[]
      }
      get_user_platform_posts: {
        Args: {
          cursor?: string
          limit_count: number
          platform_name: string
          target_user: string
        }
        Returns: {
          comments_disabled: boolean
          content: string
          created_at: string
          embed_html: string
          hide_counts: boolean
          id: string
          is_public: boolean
          is_repost: boolean
          likes_count: number
          media_type: string
          media_url: string
          original_user_id: string
          pinned_at: string
          platform: string
          saves_count: number
          thumbnail_url: string
          title: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_unseen_following_feed_posts: { Args: never; Returns: boolean }
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      notif_flag_allowed: {
        Args: { _key: string; _recipient: string }
        Returns: boolean
      }
      notif_scope_allowed: {
        Args: { _actor: string; _key: string; _recipient: string }
        Returns: boolean
      }
      post_delete_score_preview: { Args: { p_post_id: string }; Returns: Json }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_domain_classification: {
        Args: { _content_type: string; _domain: string }
        Returns: undefined
      }
      refresh_following_feed: {
        Args: { limit_count: number; seen_post_ids?: string[] }
        Returns: {
          comments_count: number
          content: string
          created_at: string
          embed_html: string
          id: string
          is_public: boolean
          is_repost: boolean
          likes_count: number
          media_type: string
          media_url: string
          platform: string
          preview_image_url: string
          preview_text: string
          preview_title: string
          profile_avatar_url: string
          profile_display_name: string
          profile_id: string
          profile_username: string
          reposted_at: string
          reposted_by_user_id: string
          reposted_by_username: string
          reposts_count: number
          saves_count: number
          thumbnail_url: string
          title: string
          user_id: string
        }[]
      }
      refresh_following_feed_v1: {
        Args: { limit_count: number; seen_post_ids?: string[] }
        Returns: {
          aspect_ratio: number
          comments_count: number
          content: string
          created_at: string
          embed_html: string
          feed_cursor: string
          id: string
          is_public: boolean
          is_repost: boolean
          likes_count: number
          media_kind: string
          media_type: string
          media_url: string
          platform: string
          preview_image_url: string
          preview_text: string
          preview_title: string
          profile_avatar_url: string
          profile_display_name: string
          profile_id: string
          profile_username: string
          reposted_at: string
          reposted_by_user_id: string
          reposted_by_username: string
          reposts_count: number
          saves_count: number
          suggested_height: number
          thumbnail_url: string
          title: string
          user_id: string
        }[]
      }
      refresh_following_feed_v2: {
        Args: {
          limit_count: number
          seen_post_ids?: string[]
          since_time?: string
        }
        Returns: {
          aspect_ratio: number
          comments_count: number
          content: string
          created_at: string
          embed_html: string
          feed_cursor: string
          id: string
          is_public: boolean
          is_repost: boolean
          likes_count: number
          media_kind: string
          media_type: string
          media_url: string
          platform: string
          preview_image_url: string
          preview_text: string
          preview_title: string
          profile_avatar_url: string
          profile_display_name: string
          profile_id: string
          profile_username: string
          reposted_at: string
          reposted_by_user_id: string
          reposted_by_username: string
          reposts_count: number
          saves_count: number
          suggested_height: number
          thumbnail_url: string
          title: string
          user_id: string
        }[]
      }
      refresh_following_feed_v3: {
        Args: {
          limit_count: number
          seen_post_ids?: string[]
          since_time?: string
        }
        Returns: {
          aspect_ratio: number
          comments_count: number
          content: string
          created_at: string
          embed_html: string
          feed_cursor: string
          id: string
          is_public: boolean
          is_repost: boolean
          likes_count: number
          media_kind: string
          media_type: string
          media_url: string
          platform: string
          preview_image_url: string
          preview_text: string
          preview_title: string
          profile_avatar_url: string
          profile_display_name: string
          profile_id: string
          profile_username: string
          reposted_at: string
          reposted_by_user_id: string
          reposted_by_username: string
          reposts_count: number
          saves_count: number
          suggested_height: number
          thumbnail_url: string
          title: string
          user_id: string
        }[]
      }
      request_or_follow: { Args: { _target: string }; Returns: string }
      respond_to_follow_request: {
        Args: { _approve: boolean; _requester: string }
        Returns: string
      }
      search_profiles: {
        Args: { cursor?: string; limit_count: number; q: string }
        Returns: {
          avatar_url: string
          display_name: string
          follows_me: boolean
          id: string
          is_following: boolean
          is_requested: boolean
          user_id: string
          username: string
        }[]
      }
      start_conversation: { Args: { _other_user_id: string }; Returns: string }
      update_post_dimensions: {
        Args: { _aspect?: number; _height: number; _post_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      report_reason:
        | "spam"
        | "harassment"
        | "hate_speech"
        | "nudity_sexual"
        | "violence"
        | "misinformation"
        | "self_harm"
        | "other"
      report_target: "post" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      report_reason: [
        "spam",
        "harassment",
        "hate_speech",
        "nudity_sexual",
        "violence",
        "misinformation",
        "self_harm",
        "other",
      ],
      report_target: ["post", "user"],
    },
  },
} as const
