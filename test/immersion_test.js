/*global describe,it*/
'use strict';
var assert = require('assert'),
  immersion = require('../lib/immersion.js');

describe('immersion node module.', function() {
  it('must be awesome', function() {
    assert( immersion.awesome(), 'awesome');
  });
});
