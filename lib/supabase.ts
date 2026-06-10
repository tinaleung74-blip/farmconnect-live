import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  "https://bfckjrqrixbtqqvsxgjq.supabase.co";

const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmY2tqcnFyaXhidHFxdnN4Z2pxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MTA2MDIsImV4cCI6MjA5NjM4NjYwMn0.MmIW41XMThPzwr_5jc_2GjZwpHkHanh1zJWOsmXNkxE";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);