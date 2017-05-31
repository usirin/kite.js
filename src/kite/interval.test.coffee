expect = require 'expect'
Interval = require './interval'

describe 'Interval', ->

  it 'works', (done) ->
    ms = 250

    interval = new Interval fn = ->
      interval.clear()
      expect(interval.fn).toBe fn
      expect(interval.ms).toBe ms

      done()
    , ms

