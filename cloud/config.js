// Publishable keys are public; never put service-role keys or secrets here.
export const SUPABASE_URL = "https://xorsueznslmcmkfqizqn.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_bdnE1LhtPj0ZJDR4n54ayA_wGOhhl4s"; // Public project key; never replace with a secret key.
export const GOOGLE_SIGN_IN_ENABLED = false; // Enable only after configuring and testing the provider.
export const API_BASE_URL = ""; // Set to a separately reviewed Worker, never the legacy endpoint.
export function isConfigured() {
  return /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(SUPABASE_URL) &&
    SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_") &&
    !SUPABASE_PUBLISHABLE_KEY.includes("REPLACE");
}
