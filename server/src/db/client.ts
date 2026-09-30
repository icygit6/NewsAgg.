import { Pool } from 'pg'
import { logger } from '../lib/logger'

// CLAUDE.md specifies NEONDB_URL; fall back to the other connection-string
// names already present in this project's .env so the server connects
// regardless of which one is populated.
const connectionString =
  process.env.NEONDB_URL || process.env.DATABASE_URL || process.env.NEON_DSN

const isLocal = connectionString?.includes('@db:') || connectionString?.includes('localhost') || connectionString?.includes('127.0.0.1')

// Verify the server certificate (Neon presents a public-CA chain, so Node's
// default trust store works). rejectUnauthorized:false would accept any cert
// — a MITM could read every query. PGSSL_NO_VERIFY=1 is an escape hatch for
// self-signed setups.
export const pool = new Pool({
  connectionString,
  ssl: isLocal
    ? false
    : { rejectUnauthorized: process.env.PGSSL_NO_VERIFY !== '1' },
  // Fail quickly enough for the readiness probe to report an outage, while
  // allowing idle Neon connections to be discarded and recreated cleanly.
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
  keepAlive: true,
})

// node-postgres emits idle-client failures on the Pool itself. Without this
// listener Node treats a transient network/Neon disconnect as an unhandled
// error and terminates the whole API process.
pool.on('error', (err) => {
  logger.error({ err }, 'unexpected idle PostgreSQL client error; pool will reconnect on demand')
})

export async function query(text: string, params?: any[]) {
  const client = await pool.connect()
  try {
    return await client.query(text, params)
  } finally {
    client.release()
  }
}
