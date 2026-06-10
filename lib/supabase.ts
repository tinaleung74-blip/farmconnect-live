import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://bfckjrqrixbtqqvsxgjq.supabase.co";

const supabaseAnonKey =
  "sb_publishable_MJoDHyuHvjEKeSbJcy1RUw_4VeR8TpE";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);