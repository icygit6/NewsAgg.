import { pino } from 'pino'
import { IS_PROD } from '../config'

// Structured logging. Production emits newline-delimited JSON to stdout (ready
// for any log shipper); development pretty-prints via pino-pretty. LOG_LEVEL
// overrides the default level (info in prod, debug in dev).
export const logger = pino({
  level: process.env.LOG_LEVEL || (IS_PROD ? 'info' : 'debug'),
  // pino-pretty is a devDependency and only referenced off the prod path.
  transport: IS_PROD
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
      },
})
