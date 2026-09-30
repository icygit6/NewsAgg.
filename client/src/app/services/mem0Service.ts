// Mem0-backed personalization. The backend derives the user from the JWT, so
// these calls only need the auth token. All methods fail soft (never throw) so
// personalization can never break the UI.

const API_BASE = import.meta.env.VITE_API_URL || '';

const request = (path: string, init: RequestInit = {}) =>
  fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });

export interface ReadingHistoryEntry {
  id: string;
  topic: string;
  sentiment: string;
  keywords?: string[];
}

export interface PersonalizationPreferences {
  enabled: boolean;
  topics: string[];
}

export const mem0Service = {
  /** Returns the user's preferred topics inferred by Mem0 (empty if unavailable). */
  getUserPreferences: async (): Promise<PersonalizationPreferences> => {
    try {
      const res = await request('/api/user/preferences');
      const json = await res.json();
      return json?.success
        ? { enabled: json.data?.enabled !== false, topics: json.data?.topics ?? [] }
        : { enabled: true, topics: [] };
    } catch (error) {
      console.error('Error fetching preferences:', error);
      return { enabled: true, topics: [] };
    }
  },

  setPersonalization: async (enabled: boolean): Promise<boolean> => {
    try {
      const res = await request('/api/user/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  clearReadingHistory: async (): Promise<boolean> => {
    try {
      const res = await request('/api/user/reading-history', { method: 'DELETE' });
      return res.ok;
    } catch {
      return false;
    }
  },

  /** Records that the user read an article so Mem0 can learn their interests. */
  saveReadingHistory: async (article: ReadingHistoryEntry): Promise<void> => {
    try {
      await request('/api/user/reading-history', {
        method: 'POST',
        body: JSON.stringify(article),
      });
    } catch (error) {
      console.error('Error saving reading history:', error);
    }
  },
};
