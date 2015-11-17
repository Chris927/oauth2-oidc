"use strict";

describe('userinfo', function() {
  let oidc

  beforeEach(function() {
    oidc = new OAuth2OIDC({ state: {}, login_url: '/login', })
  })

  describe('having an access token', function() {
    let config, user, access
    beforeEach(function(done) {
      buildTestConfig().then((c) => {
        config = c
        return buildUser()
      }).then((user) => {
        debug('user', user)
        return config.state.collections.user.create(user)
      }).then((savedUser) => {
        debug('savedUser', savedUser)
        user = savedUser
        return buildAccess({ user: savedUser.id })
      }).then((acc) => {
        debug('acc', acc)
        return config.state.collections.access.create(acc)
      }).then((savedAccess) => {
        debug('savedAccess', savedAccess)
        access = savedAccess
        done()
      }).catch((err) => {
        debug('err', err)
        done(err)
      })
    })
    afterEach(function(done) {
      config.state.connections.default._adapter.teardown(done)
    })
    it('retrieves access token and user info', function(done) {
      const req = createRequest({
        headers: {
          authorization: `Bearer ${ access.token }`
        }
      }), res = createResponse()
      req.state = config.state
      oidc._getAccessTokenAndUserOnRequest()(req, res, (err) => {
        expect(JSON.stringify(err)).toBe(undefined)
        // expect(res.token).toEqual(access)
        // expect(res.user).toEqual(user)
        done()
      })
    })
    it('checks scopes', function(done) {
      const app = express(),
            req = createRequest({
              headers: {
                authorization: `Bearer ${ access.token }`
              }
            }),
            res = createResponse()
      oidc.options.state = config.state
      access.scope = [ 'changed', 'email' ]
      access.save().then(() => {
        app.use(oidc.userinfo())
        app.handle(req, res, function(err) {
          expect(err).not.toBeFalsy()
          expect(err).toMatch(/required but not present/)
          done()
        })
      })
    })
    it('checks scopes', function() {
      const scenarios = [
        { requested: [ 'email' ], given: [ 'email' ], expectError: false },
        { requested: [], given: [], expectError: false },
        { requested: [ 'email' ], given: [], expectError: true },
        { requested: [ 'email' ], given: [ 'em', 'ail' ], expectError: true },
        { requested: [ 'email' ], given: [ 'em', 'email' ], expectError: false },
        { requested: [ 'x', 'email' ], given: [ 'x', 'email' ], expectError: false },
        { requested: [ 'x', 'email' ], given: [ 'x', 'email', 'y' ], expectError: false },
        { requested: [ 'x|email' ], given: [ 'x', 'email' ], expectError: false },
        { requested: [ 'x|email' ], given: [ 'x' ], expectError: false },
        { requested: [ 'x|email' ], given: [ 'email' ], expectError: false },
      ]
      scenarios.forEach(function(scenario) {
        const req = { token: { scope: scenario.given } }
        oidc._hasScopes(...scenario.requested)(req, {}, function(err) {
          if (scenario.expectError) {
            expect(err).toBeTruthy()
          } else {
            expect(err).toBeFalsy()
          }
        })
      })
    })
    it('provides userinfo', function(done) {
      /** TODO: this is how we *could* test a full req/res cycle without
       * actually listening: */
      /*
      const app = express(),
            request = createRequest(),
            response = createResponse()
      app.all(oidc.userinfo())
      app.handle(request, response, function(err) {
        expect(true).toBe(false) // TODO
        done()
      })
      */
      const req = createRequest()
      req.user = user
      const res = createResponse()
      oidc._sendUserInfo(req, res, function(err) {
        expect(err).toBe(undefined)
        const data = res._getData()
        debug('data', data)
        expect(data.sub).toEqual(user.sub)
        expect(data.name).toEqual('dummy')
        done()
      })
    })
  })

})
