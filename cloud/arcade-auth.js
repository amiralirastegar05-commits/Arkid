import * as snapshots from "./snapshot.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Public project configuration only. The Worker URL is independent of
// Supabase; live authenticated and browser CORS checks are still required.
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, GOOGLE_SIGN_IN_ENABLED, API_BASE_URL, isConfigured } from "./config.js";
const configured = isConfigured();

let supabase = null;

if (configured) {
  supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
}

const ArkidAuth = {
  isConfigured() {
    return configured;
  },

  supportsGoogle() {
    return GOOGLE_SIGN_IN_ENABLED;
  },

  getClient() {
    if (!supabase) {
      throw new Error("Supabase configuration is missing.");
    }
    return supabase;
  },

  async signUp(email, password, displayName = "") {
    const client = this.getClient();

    return await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: displayName,
          display_name: displayName
        },
        emailRedirectTo: location.origin + location.pathname
      }
    });
  },

  async signIn(email, password) {
    return await this.getClient().auth.signInWithPassword({
      email,
      password
    });
  },

  async signInWithGoogle() {
    if (!GOOGLE_SIGN_IN_ENABLED) throw new Error("Google sign-in is not configured.");
    return await this.getClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: location.origin + location.pathname
      }
    });
  },

  async signOut() {
    return await this.getClient().auth.signOut();
  },

  async getSession() {
    return await this.getClient().auth.getSession();
  },

  async getUser() {
    return await this.getClient().auth.getUser();
  },

  async getProfile() {
    const client = this.getClient();
    const { data: { user }, error } = await client.auth.getUser();

    if (error) throw error;
    if (!user) return null;

    const result = await client
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (result.error) throw result.error;

    return result.data;
  },

  onAuthStateChange(callback) {
    return this.getClient().auth.onAuthStateChange(callback);
  },

  snapshots,

  async apiMe() {
    const { data, error } = await this.getSession();

    if (error) throw error;
    if (!data.session) {
      throw new Error("User is not signed in.");
    }

    if (!API_BASE_URL) throw new Error("API آرکید هنوز پیکربندی نشده است.");
    const response = await fetch(`${API_BASE_URL}/v1/me`, {
      headers: {
        Authorization: `Bearer ${data.session.access_token}`
      }
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "API request failed.");
    }

    return result;
  }
};

window.ArkidAuth = ArkidAuth;
window.dispatchEvent(new Event("arkid-auth-ready"));

console.log("Arkid Auth module loaded.");
