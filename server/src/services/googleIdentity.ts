import { OAuth2Client, type TokenPayload } from 'google-auth-library'

/** Verify a Google Identity Services credential against this app's client ID. */
export async function verifyGoogleIdToken(token: string): Promise<TokenPayload> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) throw new Error('google_not_configured')
  const ticket = await new OAuth2Client(clientId).verifyIdToken({ idToken: token, audience: clientId })
  const payload = ticket.getPayload()
  if (!payload) throw new Error('google_invalid_token')
  return payload
}
