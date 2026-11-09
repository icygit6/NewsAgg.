import { pino } from 'pino'
import { IS_PROD } from '../config'

// Structured logging. Production emits newline-delimited JSON to stdout (ready
// for any log shipper); development pretty-prints via pino-pretty. LOG_LEVEL
// overrides the default level (info in prod, debug in dev).

// Request logs carry headers. The session cookie and Bearer token are live
// credentials and the edge key is the Worker's shared secret: anyone able to
// read the logs could use them, so they are never written out.
export const LOG_REDACT = {
  paths: [
    'req.headers.cookie',
    'req.headers.authorization',
    'req.headers["x-newsagg-edge-key"]',
    'res.headers["set-cookie"]',
  ],
  censor: '[redacted]',
}

export const logger = pino({
  level: process.env.LOG_LEVEL || (IS_PROD ? 'info' : 'debug'),
  redact: LOG_REDACT,
  // pino-pretty is a devDependency and only referenced off the prod path.
  transport: IS_PROD
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
      },
})
