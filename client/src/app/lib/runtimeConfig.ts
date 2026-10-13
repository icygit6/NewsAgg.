export interface PublicRuntimeConfig {
  googleClientId: string;
  turnstileSiteKey: string;
  /** Display name of the chat model, e.g. 'GPT-OSS-120B'. Empty until the
   * API answers; the UI then falls back to its generic "Ask AI" label. */
  chatModelLabel: string;
}

let runtimeConfig: PublicRuntimeConfig = {
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  turnstileSiteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY || '',
  chatModelLabel: import.meta.env.VITE_CHAT_MODEL_LABEL || '',
};

export async function loadRuntimeConfig(): Promise<PublicRuntimeConfig> {
  try {
    const base = import.meta.env.VITE_API_URL || '';
    const response = await fetch(`${base}/api/config/public`, { cache: 'no-store' });
    if (!response.ok) return runtimeConfig;
    const payload = await response.json();
    runtimeConfig = {
      googleClientId: String(payload?.data?.googleClientId || runtimeConfig.googleClientId),
      turnstileSiteKey: String(payload?.data?.turnstileSiteKey || runtimeConfig.turnstileSiteKey),
      chatModelLabel: String(payload?.data?.chatModelLabel || runtimeConfig.chatModelLabel),
    };
  } catch {
    // Build-time values remain a safe fallback when the API is temporarily down.
  }
  return runtimeConfig;
}

export const getRuntimeConfig = () => runtimeConfig;
