export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: { id: string; name: string; slug: string; logo_url: string | null; created_at: string };
        Insert: { id?: string; name: string; slug: string; logo_url?: string | null; created_at?: string };
        Update: { id?: string; name?: string; slug?: string; logo_url?: string | null; created_at?: string };
      };
      profiles: {
        Row: { id: string; org_id: string | null; full_name: string | null; email: string | null; role: string; phone: string | null; avatar_url: string | null; ai_primary_model: string | null; ai_secondary_model: string | null; created_at: string };
        Insert: { id: string; org_id?: string | null; full_name?: string | null; email?: string | null; role?: string; phone?: string | null; avatar_url?: string | null; ai_primary_model?: string | null; ai_secondary_model?: string | null; created_at?: string };
        Update: { id?: string; org_id?: string | null; full_name?: string | null; email?: string | null; role?: string; phone?: string | null; avatar_url?: string | null; ai_primary_model?: string | null; ai_secondary_model?: string | null; created_at?: string };
      };
      projects: {
        Row: { id: string; org_id: string | null; name: string; type: string; status: string; phase: string | null; address: string | null; sq_footage: number | null; crew_size: number | null; budget: number | null; spent: number | null; progress: number | null; start_date: string | null; deadline: string | null; description: string | null; created_by: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; org_id?: string | null; name: string; type?: string; status?: string; phase?: string | null; address?: string | null; sq_footage?: number | null; crew_size?: number | null; budget?: number | null; spent?: number | null; progress?: number | null; start_date?: string | null; deadline?: string | null; description?: string | null; created_by?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; org_id?: string | null; name?: string; type?: string; status?: string; phase?: string | null; address?: string | null; sq_footage?: number | null; crew_size?: number | null; budget?: number | null; spent?: number | null; progress?: number | null; start_date?: string | null; deadline?: string | null; description?: string | null; created_by?: string | null; created_at?: string; updated_at?: string };
      };
      budget_items: {
        Row: { id: string; project_id: string | null; org_id: string | null; category: string; description: string; quantity: number | null; unit: string | null; unit_cost: number | null; labor_cost: number | null; total: number | null; status: string | null; created_at: string };
        Insert: { id?: string; project_id?: string | null; org_id?: string | null; category: string; description: string; quantity?: number | null; unit?: string | null; unit_cost?: number | null; labor_cost?: number | null; status?: string | null; created_at?: string };
        Update: { id?: string; project_id?: string | null; org_id?: string | null; category?: string; description?: string; quantity?: number | null; unit?: string | null; unit_cost?: number | null; labor_cost?: number | null; status?: string | null; created_at?: string };
      };
      invoices: {
        Row: { id: string; org_id: string | null; project_id: string | null; vendor: string; amount: number; due_date: string | null; status: string | null; notes: string | null; created_at: string };
        Insert: { id?: string; org_id?: string | null; project_id?: string | null; vendor: string; amount: number; due_date?: string | null; status?: string | null; notes?: string | null; created_at?: string };
        Update: { id?: string; org_id?: string | null; project_id?: string | null; vendor?: string; amount?: number; due_date?: string | null; status?: string | null; notes?: string | null; created_at?: string };
      };
      team_members: {
        Row: { id: string; org_id: string | null; project_id: string | null; profile_id: string | null; job_title: string | null; hourly_rate: number | null; status: string | null; created_at: string };
        Insert: { id?: string; org_id?: string | null; project_id?: string | null; profile_id?: string | null; job_title?: string | null; hourly_rate?: number | null; status?: string | null; created_at?: string };
        Update: { id?: string; org_id?: string | null; project_id?: string | null; profile_id?: string | null; job_title?: string | null; hourly_rate?: number | null; status?: string | null; created_at?: string };
      };
      time_logs: {
        Row: { id: string; org_id: string | null; project_id: string | null; profile_id: string | null; clock_in: string; clock_out: string | null; hours: number | null; notes: string | null; created_at: string };
        Insert: { id?: string; org_id?: string | null; project_id?: string | null; profile_id?: string | null; clock_in: string; clock_out?: string | null; notes?: string | null; created_at?: string };
        Update: { id?: string; org_id?: string | null; project_id?: string | null; profile_id?: string | null; clock_in?: string; clock_out?: string | null; notes?: string | null; created_at?: string };
      };
      daily_logs: {
        Row: { id: string; org_id: string | null; project_id: string | null; profile_id: string | null; log_date: string; weather: string | null; crew_count: number | null; work_done: string | null; materials: string | null; equipment: string | null; issues: string | null; created_at: string };
        Insert: { id?: string; org_id?: string | null; project_id?: string | null; profile_id?: string | null; log_date?: string; weather?: string | null; crew_count?: number | null; work_done?: string | null; materials?: string | null; equipment?: string | null; issues?: string | null; created_at?: string };
        Update: { id?: string; org_id?: string | null; project_id?: string | null; profile_id?: string | null; log_date?: string; weather?: string | null; crew_count?: number | null; work_done?: string | null; materials?: string | null; equipment?: string | null; issues?: string | null; created_at?: string };
      };
      safety_incidents: {
        Row: { id: string; org_id: string | null; project_id: string | null; reported_by: string | null; type: string; severity: string; description: string; location: string | null; status: string | null; ai_review: Json | null; incident_date: string; created_at: string };
        Insert: { id?: string; org_id?: string | null; project_id?: string | null; reported_by?: string | null; type: string; severity: string; description: string; location?: string | null; status?: string | null; ai_review?: Json | null; incident_date?: string; created_at?: string };
        Update: { id?: string; org_id?: string | null; project_id?: string | null; reported_by?: string | null; type?: string; severity?: string; description?: string; location?: string | null; status?: string | null; ai_review?: Json | null; incident_date?: string; created_at?: string };
      };
      rfis: {
        Row: { id: string; org_id: string | null; project_id: string | null; submitted_by: string | null; title: string; description: string | null; priority: string | null; status: string | null; response: string | null; created_at: string };
        Insert: { id?: string; org_id?: string | null; project_id?: string | null; submitted_by?: string | null; title: string; description?: string | null; priority?: string | null; status?: string | null; response?: string | null; created_at?: string };
        Update: { id?: string; org_id?: string | null; project_id?: string | null; submitted_by?: string | null; title?: string; description?: string | null; priority?: string | null; status?: string | null; response?: string | null; created_at?: string };
      };
      documents: {
        Row: { id: string; org_id: string | null; project_id: string | null; uploaded_by: string | null; name: string; file_type: string | null; file_size: number | null; storage_path: string | null; url: string | null; created_at: string };
        Insert: { id?: string; org_id?: string | null; project_id?: string | null; uploaded_by?: string | null; name: string; file_type?: string | null; file_size?: number | null; storage_path?: string | null; url?: string | null; created_at?: string };
        Update: { id?: string; org_id?: string | null; project_id?: string | null; uploaded_by?: string | null; name?: string; file_type?: string | null; file_size?: number | null; storage_path?: string | null; url?: string | null; created_at?: string };
      };
      site_photos: {
        Row: { id: string; org_id: string | null; project_id: string | null; taken_by: string | null; label: string | null; tag: string | null; storage_path: string | null; url: string | null; latitude: number | null; longitude: number | null; ai_analysis: Json | null; taken_at: string };
        Insert: { id?: string; org_id?: string | null; project_id?: string | null; taken_by?: string | null; label?: string | null; tag?: string | null; storage_path?: string | null; url?: string | null; latitude?: number | null; longitude?: number | null; ai_analysis?: Json | null; taken_at?: string };
        Update: { id?: string; org_id?: string | null; project_id?: string | null; taken_by?: string | null; label?: string | null; tag?: string | null; storage_path?: string | null; url?: string | null; latitude?: number | null; longitude?: number | null; ai_analysis?: Json | null; taken_at?: string };
      };
      message_channels: {
        Row: { id: string; org_id: string | null; project_id: string | null; name: string; type: string | null; created_at: string };
        Insert: { id?: string; org_id?: string | null; project_id?: string | null; name: string; type?: string | null; created_at?: string };
        Update: { id?: string; org_id?: string | null; project_id?: string | null; name?: string; type?: string | null; created_at?: string };
      };
      messages: {
        Row: { id: string; channel_id: string | null; sender_id: string | null; content: string; created_at: string };
        Insert: { id?: string; channel_id?: string | null; sender_id?: string | null; content: string; created_at?: string };
        Update: { id?: string; channel_id?: string | null; sender_id?: string | null; content?: string; created_at?: string };
      };
      milestones: {
        Row: { id: string; project_id: string | null; org_id: string | null; title: string; due_date: string | null; completed: boolean | null; critical: boolean | null; created_at: string };
        Insert: { id?: string; project_id?: string | null; org_id?: string | null; title: string; due_date?: string | null; completed?: boolean | null; critical?: boolean | null; created_at?: string };
        Update: { id?: string; project_id?: string | null; org_id?: string | null; title?: string; due_date?: string | null; completed?: boolean | null; critical?: boolean | null; created_at?: string };
      };
      subcontractors: {
        Row: { id: string; org_id: string | null; name: string; contact: string | null; email: string | null; phone: string | null; trade: string | null; status: string | null; rating: number | null; created_at: string };
        Insert: { id?: string; org_id?: string | null; name: string; contact?: string | null; email?: string | null; phone?: string | null; trade?: string | null; status?: string | null; rating?: number | null; created_at?: string };
        Update: { id?: string; org_id?: string | null; name?: string; contact?: string | null; email?: string | null; phone?: string | null; trade?: string | null; status?: string | null; rating?: number | null; created_at?: string };
      };
      ai_reviews: {
        Row: { id: string; org_id: string | null; project_id: string | null; created_by: string | null; scenario: string | null; input_content: string | null; primary_model: string | null; primary_result: Json | null; secondary_model: string | null; secondary_result: Json | null; created_at: string };
        Insert: { id?: string; org_id?: string | null; project_id?: string | null; created_by?: string | null; scenario?: string | null; input_content?: string | null; primary_model?: string | null; primary_result?: Json | null; secondary_model?: string | null; secondary_result?: Json | null; created_at?: string };
        Update: { id?: string; org_id?: string | null; project_id?: string | null; created_by?: string | null; scenario?: string | null; input_content?: string | null; primary_model?: string | null; primary_result?: Json | null; secondary_model?: string | null; secondary_result?: Json | null; created_at?: string };
      };
      medical_checklists: {
        Row: { id: string; project_id: string | null; org_id: string | null; name: string; room_type: string | null; created_at: string };
        Insert: { id?: string; project_id?: string | null; org_id?: string | null; name: string; room_type?: string | null; created_at?: string };
        Update: { id?: string; project_id?: string | null; org_id?: string | null; name?: string; room_type?: string | null; created_at?: string };
      };
      medical_checklist_items: {
        Row: { id: string; checklist_id: string | null; product_code: string | null; product_name: string; category: string | null; quantity_needed: number | null; quantity_installed: number | null; checked: boolean | null; modified: boolean | null; notes: string | null; checked_by: string | null; checked_at: string | null; created_at: string };
        Insert: { id?: string; checklist_id?: string | null; product_code?: string | null; product_name: string; category?: string | null; quantity_needed?: number | null; quantity_installed?: number | null; checked?: boolean | null; modified?: boolean | null; notes?: string | null; checked_by?: string | null; checked_at?: string | null; created_at?: string };
        Update: { id?: string; checklist_id?: string | null; product_code?: string | null; product_name?: string; category?: string | null; quantity_needed?: number | null; quantity_installed?: number | null; checked?: boolean | null; modified?: boolean | null; notes?: string | null; checked_by?: string | null; checked_at?: string | null; created_at?: string };
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}
