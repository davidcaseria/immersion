/*global describe,it*/
'use strict';
var expect = require('chai').expect,
  immersion = require('../lib/immersion.js');

describe('immersion node module', function () {
  it('should have a create function', function () {
    expect(immersion.create).to.be.a('function');
  });

  it('should have a update function', function () {
    expect(immersion.update).to.be.a('function');
  });
});