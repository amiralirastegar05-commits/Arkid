import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// تنظیمات پروژه Supabase
const SUPABASE_URL = "https://uirtfghcpzevedvbaekj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Jyylbrq5UtuQbMDxGp2clA_pKg1YXOP";

// آدرس API آرکید
const API_BASE_URL = "https://arkid-api.nova-197b21.workers.dev";

const configured =
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("PASTE_") &&
  SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_") &&
  !SUPABASE_PUBLISHABLE_KEY.includes("PASTE_");

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

  async apiMe() {
    const { data, error } = await this.getSession();

    if (error) throw error;
    if (!data.session) {
      throw new Error("User is not signed in.");
    }

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

console.log("Arkid Auth module loaded.");
