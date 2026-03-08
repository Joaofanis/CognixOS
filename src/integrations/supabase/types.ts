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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_health_logs: {
        Row: {
          checked_at: string
          error_msg: string | null
          id: number
          latency_ms: number | null
          model: string
          status: string
        }
        Insert: {
          checked_at?: string
          error_msg?: string | null
          id?: number
          latency_ms?: number | null
          model: string
          status: string
        }
        Update: {
          checked_at?: string
          error_msg?: string | null
          id?: number
          latency_ms?: number | null
          model?: string
          status?: string
        }
        Relationships: []
      }
      brain_analysis: {
        Row: {
          brain_id: string
          communication_style: Json | null
          frequent_themes: Json | null
          id: string
          knowledge_areas: Json | null
          personality_traits: Json | null
          signature_phrases: Json | null
          skills: Json | null
          skills_evaluation: string | null
          updated_at: string
          voice_patterns: Json | null
        }
        Insert: {
          brain_id: string
          communication_style?: Json | null
          frequent_themes?: Json | null
          id?: string
          knowledge_areas?: Json | null
          personality_traits?: Json | null
          signature_phrases?: Json | null
          skills?: Json | null
          skills_evaluation?: string | null
          updated_at?: string
          voice_patterns?: Json | null
        }
        Update: {
          brain_id?: string
          communication_style?: Json | null
          frequent_themes?: Json | null
          id?: string
          knowledge_areas?: Json | null
          personality_traits?: Json | null
          signature_phrases?: Json | null
          skills?: Json | null
          skills_evaluation?: string | null
          updated_at?: string
          voice_patterns?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "brain_analysis_brain_id_fkey"
            columns: ["brain_id"]
            isOneToOne: true
            referencedRelation: "brains"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_quotes: {
        Row: {
          brain_id: string
          context: string | null
          created_at: string
          id: string
          quote: string
          source_text_id: string | null
        }
        Insert: {
          brain_id: string
          context?: string | null
          created_at?: string
          id?: string
          quote: string
          source_text_id?: string | null
        }
        Update: {
          brain_id?: string
          context?: string | null
          created_at?: string
          id?: string
          quote?: string
          source_text_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brain_quotes_brain_id_fkey"
            columns: ["brain_id"]
            isOneToOne: false
            referencedRelation: "brains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_quotes_source_text_id_fkey"
            columns: ["source_text_id"]
            isOneToOne: false
            referencedRelation: "brain_texts"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_texts: {
        Row: {
          brain_id: string
          category: string | null
          content: string
          created_at: string
          file_name: string | null
          id: string
          rag_keywords: string[] | null
          rag_processed: boolean | null
          rag_summary: string | null
          source_type: string
        }
        Insert: {
          brain_id: string
          category?: string | null
          content: string
          created_at?: string
          file_name?: string | null
          id?: string
          rag_keywords?: string[] | null
          rag_processed?: boolean | null
          rag_summary?: string | null
          source_type?: string
        }
        Update: {
          brain_id?: string
          category?: string | null
          content?: string
          created_at?: string
          file_name?: string | null
          id?: string
          rag_keywords?: string[] | null
          rag_processed?: boolean | null
          rag_summary?: string | null
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "brain_texts_brain_id_fkey"
            columns: ["brain_id"]
            isOneToOne: false
            referencedRelation: "brains"
            referencedColumns: ["id"]
          },
        ]
      }
      brains: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_pinned: boolean | null
          name: string
          system_prompt: string | null
          tags: string[] | null
          type: Database["public"]["Enums"]["brain_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_pinned?: boolean | null
          name: string
          system_prompt?: string | null
          tags?: string[] | null
          type: Database["public"]["Enums"]["brain_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_pinned?: boolean | null
          name?: string
          system_prompt?: string | null
          tags?: string[] | null
          type?: Database["public"]["Enums"]["brain_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          brain_id: string
          created_at: string
          id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          brain_id: string
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          brain_id?: string
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_brain_id_fkey"
            columns: ["brain_id"]
            isOneToOne: false
            referencedRelation: "brains"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_ai_profiles: {
        Row: {
          ai_summary: string | null
          avg_message_length: number | null
          created_at: string | null
          formality_level: number | null
          frequent_words: Json | null
          id: string
          last_analyzed_at: string | null
          message_count: number | null
          prefers_bullet_points: boolean | null
          prefers_examples: boolean | null
          prefers_portuguese: boolean | null
          response_length_pref: string | null
          style_examples: Json | null
          topics_of_interest: Json | null
          traits: Json | null
          updated_at: string | null
          user_id: string
          user_notes: string | null
        }
        Insert: {
          ai_summary?: string | null
          avg_message_length?: number | null
          created_at?: string | null
          formality_level?: number | null
          frequent_words?: Json | null
          id?: string
          last_analyzed_at?: string | null
          message_count?: number | null
          prefers_bullet_points?: boolean | null
          prefers_examples?: boolean | null
          prefers_portuguese?: boolean | null
          response_length_pref?: string | null
          style_examples?: Json | null
          topics_of_interest?: Json | null
          traits?: Json | null
          updated_at?: string | null
          user_id: string
          user_notes?: string | null
        }
        Update: {
          ai_summary?: string | null
          avg_message_length?: number | null
          created_at?: string | null
          formality_level?: number | null
          frequent_words?: Json | null
          id?: string
          last_analyzed_at?: string | null
          message_count?: number | null
          prefers_bullet_points?: boolean | null
          prefers_examples?: boolean | null
          prefers_portuguese?: boolean | null
          response_length_pref?: string | null
          style_examples?: Json | null
          topics_of_interest?: Json | null
          traits?: Json | null
          updated_at?: string | null
          user_id?: string
          user_notes?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_brain_owner: { Args: { p_brain_id: string }; Returns: boolean }
      is_conversation_owner: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
    }
    Enums: {
      brain_type:
        | "person_clone"
        | "knowledge_base"
        | "philosophy"
        | "practical_guide"
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
  public: {
    Enums: {
      brain_type: [
        "person_clone",
        "knowledge_base",
        "philosophy",
        "practical_guide",
      ],
    },
  },
} as const
