import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = "https://biizphtfbiqgkinnfbgy.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpaXpwaHRmYmlxZ2tpbm5mYmd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMjUwMDQsImV4cCI6MjA5NDcwMTAwNH0.K57Ylv151zVRR6g4yt8d5V6RetRtYOdH0t7cG65x2HU";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
