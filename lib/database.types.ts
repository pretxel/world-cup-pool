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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      competitions: {
        Row: {
          branding: Json
          created_at: string
          format_config: Json
          id: string
          is_active: boolean
          kind: string
          name: string
          opening_away: string | null
          opening_home: string | null
          opening_venue: string | null
          providers: Json
          season: string | null
          short_name: string
          slug: string
          tournament_end_at: string | null
          tournament_start_at: string
          updated_at: string
        }
        Insert: {
          branding?: Json
          created_at?: string
          format_config: Json
          id?: string
          is_active?: boolean
          kind?: string
          name: string
          opening_away?: string | null
          opening_home?: string | null
          opening_venue?: string | null
          providers?: Json
          season?: string | null
          short_name: string
          slug: string
          tournament_end_at?: string | null
          tournament_start_at: string
          updated_at?: string
        }
        Update: {
          branding?: Json
          created_at?: string
          format_config?: Json
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          opening_away?: string | null
          opening_home?: string | null
          opening_venue?: string | null
          providers?: Json
          season?: string | null
          short_name?: string
          slug?: string
          tournament_end_at?: string | null
          tournament_start_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      groups: {
        Row: {
          competition_id: string
          created_at: string
          id: string
          join_code: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          competition_id?: string
          created_at?: string
          id?: string
          join_code: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          competition_id?: string
          created_at?: string
          id?: string
          join_code?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          active_on: string
          correct_index: number
          created_at: string
          id: string
          options: string[]
          prompt: string
          translations: Json
          updated_at: string
        }
        Insert: {
          active_on: string
          correct_index: number
          created_at?: string
          id?: string
          options: string[]
          prompt: string
          translations?: Json
          updated_at?: string
        }
        Update: {
          active_on?: string
          correct_index?: number
          created_at?: string
          id?: string
          options?: string[]
          prompt?: string
          translations?: Json
          updated_at?: string
        }
        Relationships: []
      }
      quiz_answers: {
        Row: {
          answered_at: string
          choice_index: number
          id: string
          is_correct: boolean
          question_id: string
          user_id: string
        }
        Insert: {
          answered_at?: string
          choice_index: number
          id?: string
          is_correct: boolean
          question_id: string
          user_id: string
        }
        Update: {
          answered_at?: string
          choice_index?: number
          id?: string
          is_correct?: boolean
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_answers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      news_articles: {
        Row: {
          created_at: string
          dedup_key: string
          external_id: string | null
          id: string
          image_url: string | null
          published_at: string
          source: string | null
          source_url: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dedup_key: string
          external_id?: string | null
          id?: string
          image_url?: string | null
          published_at: string
          source?: string | null
          source_url: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dedup_key?: string
          external_id?: string | null
          id?: string
          image_url?: string | null
          published_at?: string
          source?: string | null
          source_url?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          away_score: number | null
          away_team: string
          competition_id: string
          created_at: string
          group_code: string | null
          home_score: number | null
          home_team: string
          id: string
          kickoff_at: string
          stage: string
          status: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          away_score?: number | null
          away_team: string
          // NOT NULL in the DB; optional here so admin actions can stamp it
          // server-side (the managed competition) before the write.
          competition_id?: string
          created_at?: string
          group_code?: string | null
          home_score?: number | null
          home_team: string
          id?: string
          kickoff_at: string
          stage: string
          status?: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          away_score?: number | null
          away_team?: string
          competition_id?: string
          created_at?: string
          group_code?: string | null
          home_score?: number | null
          home_team?: string
          id?: string
          kickoff_at?: string
          stage?: string
          status?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions: {
        Row: {
          away_goals: number
          home_goals: number
          id: string
          match_id: string
          submitted_at: string
          user_id: string
        }
        Insert: {
          away_goals: number
          home_goals: number
          id?: string
          match_id: string
          submitted_at?: string
          user_id: string
        }
        Update: {
          away_goals?: number
          home_goals?: number
          id?: string
          match_id?: string
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          is_admin: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          is_admin?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          is_admin?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      result_email_log: {
        Row: {
          match_id: string
          sent_at: string
          user_id: string
        }
        Insert: {
          match_id: string
          sent_at?: string
          user_id: string
        }
        Update: {
          match_id?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "result_email_log_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_email_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scores: {
        Row: {
          computed_at: string
          hit_type: string
          match_id: string
          points: number
          user_id: string
        }
        Insert: {
          computed_at?: string
          hit_type: string
          match_id: string
          points: number
          user_id: string
        }
        Update: {
          computed_at?: string
          hit_type?: string
          match_id?: string
          points?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scores_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_leaderboard_overall: {
        Row: {
          display_name: string | null
          exact_hits: number | null
          first_submit: string | null
          rank: number | null
          total_points: number | null
          user_id: string | null
          winner_gd_hits: number | null
          winner_hits: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_quiz_questions_public: {
        Row: {
          active_on: string | null
          id: string | null
          options: string[] | null
          prompt: string | null
          translations: Json | null
        }
        Relationships: []
      }
      v_quiz_leaderboard: {
        Row: {
          display_name: string | null
          first_answer: string | null
          rank: number | null
          total_answered: number | null
          total_points: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      answer_quiz: {
        Args: { p_question_id: string; p_choice: number }
        Returns: { is_correct: boolean; correct_index: number }[]
      }
      active_competition_id: { Args: never; Returns: string }
      compute_match_scores: { Args: { p_match_id: string }; Returns: undefined }
      create_group: { Args: { p_name: string }; Returns: string }
      generate_join_code: { Args: { p_prefix?: string }; Returns: string }
      set_active_competition: { Args: { p_id: string }; Returns: undefined }
      group_preview: {
        Args: { p_code: string }
        Returns: { id: string; name: string }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_group_member: { Args: { p_group_id: string }; Returns: boolean }
      is_group_owner: { Args: { p_group_id: string }; Returns: boolean }
      join_group: { Args: { p_code: string }; Returns: string }
      leaderboard_for_group: {
        Args: { p_group_id: string }
        Returns: {
          display_name: string
          exact_hits: number
          first_submit: string
          rank: number
          total_points: number
          user_id: string
          winner_gd_hits: number
          winner_hits: number
        }[]
      }
      leave_group: { Args: { p_group_id: string }; Returns: undefined }
      remove_group_member: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: undefined
      }
      leaderboard_for_day: {
        Args: { d: string; tz?: string }
        Returns: {
          display_name: string
          exact_hits: number
          first_submit: string
          rank: number
          total_points: number
          user_id: string
          winner_gd_hits: number
          winner_hits: number
        }[]
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
