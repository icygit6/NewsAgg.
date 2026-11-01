import { useMutation } from '@tanstack/react-query';
import { authFetch } from '../lib/apiFetch';

export type FeedbackKind = 'bug' | 'suggestion' | 'other';
export interface FeedbackInput {
  kind: FeedbackKind;
  message: string;
  page?: string;
  contactEmail?: string;
  /** Honeypot: hidden from people, filled in by form-filling bots. The server drops those. */
  website?: string;
}

/** Fired on window to open the feedback dialog from anywhere (drawer, footers). */
export const OPEN_FEEDBACK_EVENT = 'newsagg:open-feedback';
export function openFeedback() {
  window.dispatchEvent(new Event(OPEN_FEEDBACK_EVENT));
}

export async function sendFeedback(input: FeedbackInput): Promise<{ id?: number }> {
  const response = await authFetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await response.json().catch(() => ({}));
  // Validation errors arrive as "field: message"; the reader only needs the message.
  if (!response.ok || !body.success) throw new Error(String(body.error || `HTTP ${response.status}`).replace(/^[\w.]+: /, ''));
  return body.data ?? {};
}

export function useSendFeedback() {
  return useMutation({ mutationFn: sendFeedback });
}
