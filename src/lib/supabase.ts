import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** .env düzgün ayarlandı mı? Arayüz buna göre uyarı gösterir. */
export const isSupabaseConfigured = Boolean(url && anon && !url.includes("xxxx"));

// Yapılandırılmamışsa bile uygulamanın çökmemesi için güvenli varsayılanlar veriyoruz.
export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  anon || "public-anon-placeholder",
);
