import expect from 'expect'
import Kite from '../kite'
import KiteServer from './'
import SockJS from 'sockjs-client'
import SockJsServer from './sockjs'
import { Event, State } from '../constants'

const logLevel = 0

describe('KiteServer with SockJS', () => {
  it('should be able to accept kite connections', done => {
    const kite = new Kite({
      url: 'http://0.0.0.0:7780',
      autoReconnect: false,
      autoConnect: false,
      transportClass: SockJS,
      logLevel,
    })

    const math = new KiteServer({
      name: 'math',
      auth: false,
      serverClass: SockJsServer,
      logLevel,
      api: {
        square: function(x, callback) {
          callback(null, x * x)
        },
      },
    })

    kite.on('open', () => {
      kite.tell('square', 5).then(res => expect(res).toBe(25)).finally(() => {
        kite.disconnect()
        math.close()
        done()
      })
    })

    math.listen(7780)
    kite.connect()
  })
})

describe('KiteServer with WebSocket', () => {
  describe('api definition', () => {
    it('uses kite auth option if method is defined as function', () => {
      const api = {
        square: function(x, callback) {
          callback(null, x * x)
        },
      }

      const math = new KiteServer({
        name: 'math',
        // use a custom authentication for test
        auth: { foo: 'bar' },
        logLevel,
        api: api,
      })

      console.log(math.api)

      expect(math.api.square).toBe(api.square)
      expect(math.api.square.mustAuth).toEqual({ foo: 'bar' })

      math.close()
    })
  })

  it('should be able to accept kite connections', done => {
    const kite = new Kite({
      url: 'ws://0.0.0.0:7780',
      autoReconnect: false,
      autoConnect: false,
      logLevel,
    })

    const math = new KiteServer({
      name: 'math',
      auth: false,
      logLevel,
      api: {
        square: function(x, callback) {
          callback(null, x * x)
        },
      },
    })

    kite.on('open', () => {
      kite.tell('square', 5).then(res => expect(res).toBe(25)).finally(() => {
        kite.disconnect()
        math.close()
        done()
      })
    })

    math.listen(7780)
    kite.connect()
  })
})

describe('kite operations', () => {
  // since we need a server to be able to test connection related methods of
  // kite we need to do these here.
  // TODO: export these tests into a more appropriate place.
  //
  describe('kite.disconnect()', () => {
    it('should set readyState to closed', done => {
      withServer((kite, server) => {
        kite.transport.addEventListener(Event.close, () => {
          process.nextTick(() => {
            expect(kite.readyState).toBe(State.CLOSED)
            server.close()
            done()
          })
        })

        kite.disconnect()
      })
    })

    it('should try to reconnect when reconnect arg is true', done => {
      const kite = new Kite({
        url: 'ws://0.0.0.0:7780',
        autoReconnect: true, // make sure autoReconnect is true
        autoConnect: false,
        logLevel,
      })

      withServer({ kite }, (kite, server) => {
        kite.once('open', () => {
          // if autoReconnect is working, this callbacck should be called again.
          kite.disconnect()
          server.close()
          done()
        })

        // tell disconnect to retry again by passing `true` as arg.
        kite.disconnect(true)
      })
    })
  })

  describe('kite.tell()', () => {
    it('accepts arguments as array', done => {
      const server = new KiteServer({
        name: 'server',
        auth: false,
        logLevel,
        api: {
          zeroArg(callback) {
            callback(null, true)
          },
          oneArg(arg1, callback) {
            callback(null, { arg1 })
          },
          twoArgs(arg1, arg2, callback) {
            callback(null, { arg1, arg2 })
          },
        },
      })

      withServer({ server }, (kite, server) => {
        Promise.all([
          kite.tell('zeroArg', []),
          kite.tell('oneArg', ['foo']),
          kite.tell('twoArgs', ['foo', 'bar']),
        ])
          .then(([res1, res2, res3]) => {
            expect(res1).toBe(true)
            expect(res2).toEqual({ arg1: 'foo' })
            expect(res3).toEqual({ arg1: 'foo', arg2: 'bar' })
          })
          .then(() => {
            kite.disconnect()
            server.close()
          })
          .then(() => done())
      })
    })
  })
})

const withServer = (options, callback) => {
  if (typeof options === 'function') {
    callback = options
    options = {}
  }

  const kite =
    options.kite ||
    new Kite({
      url: 'ws://0.0.0.0:7780',
      autoReconnect: false,
      autoConnect: false,
      logLevel,
    })

  const server =
    options.server ||
    new KiteServer({
      name: 'server',
      auth: false,
      logLevel,
    })

  kite.once('open', () => {
    callback(kite, server)
  })

  server.listen(7780)
  kite.connect()
}
