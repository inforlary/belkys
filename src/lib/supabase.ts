import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL ve Anon Key tanımlanmalıdır');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          code: string;
          city: string;
          district: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['organizations']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['organizations']['Insert']>;
      };
      profiles: {
        Row: {
          id: string;
          organization_id: string | null;
          email: string;
          full_name: string;
          role: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      strategic_plans: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          start_year: number;
          end_year: number;
          description: string;
          status: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['strategic_plans']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['strategic_plans']['Insert']>;
      };
      objectives: {
        Row: {
          id: string;
          strategic_plan_id: string;
          organization_id: string;
          code: string;
          title: string;
          description: string;
          order_number: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['objectives']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['objectives']['Insert']>;
      };
      goals: {
        Row: {
          id: string;
          objective_id: string;
          organization_id: string;
          code: string;
          title: string;
          description: string;
          order_number: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['goals']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['goals']['Insert']>;
      };
      indicators: {
        Row: {
          id: string;
          goal_id: string;
          organization_id: string;
          name: string;
          unit: string;
          baseline_value: number;
          target_value: number;
          target_year: number;
          current_value: number;
          measurement_frequency: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['indicators']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['indicators']['Insert']>;
      };
      activities: {
        Row: {
          id: string;
          goal_id: string;
          organization_id: string;
          code: string;
          title: string;
          description: string;
          start_date: string;
          end_date: string;
          responsible_department: string;
          status: string;
          budget: number;
          progress_percentage: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['activities']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['activities']['Insert']>;
      };
    };
  };
};
