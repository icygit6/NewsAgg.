// Express 4 ignores the promise an async handler returns, so a rejection never
// reaches the error middleware: Node treats it as an unhandled rejection and
// exits, taking the whole API down with it. Every layer Express creates
// (routes, router.use middleware, mounted routers) stores its function on
// `layer.handle`; wrapping it there forwards rejections to next(err), where the
// global handler in index.ts answers 500. Import this before any router is built.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Layer = require('express/lib/router/layer')

type Handler = (req: any, res: any, next: (err?: unknown) => void) => unknown

const PATCHED = Symbol.for('newsagg.asyncRoutes')

function forwardRejections(fn: Handler): Handler {
  return function asyncSafe(req, res, next) {
    const result: any = fn(req, res, next)
    if (result && typeof result.catch === 'function') result.catch(next)
    return result
  }
}

if (!Layer.prototype[PATCHED]) {
  Layer.prototype[PATCHED] = true
  Object.defineProperty(Layer.prototype, 'handle', {
    configurable: true,
    enumerable: true,
    get() {
      return this.__asyncSafeHandle
    },
    set(fn: any) {
      // Four-argument functions are error handlers; Express tells them apart by
      // arity, so they must keep their own signature.
      this.__asyncSafeHandle = typeof fn === 'function' && fn.length < 4 ? forwardRejections(fn) : fn
    },
  })
}

export {}
