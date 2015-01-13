#!/usr/bin/env node

'use strict';

// Semantic Versioning
var version = '2.0.11';

// Dependencies
var ContentDirect = require('content-direct'),
  immersion = require('../lib/immersion.js'),
  fs = require('fs'),
  program = require('commander'),
  promptly = require('promptly');

// Authenticate user in specified environment
function authenticate(environment, callback) {
  // Load Content Direct bindings
  var cd = new ContentDirect(environment);

  // Load previous user/system id
  fs.readFile('config.json', 'utf8', function (err, data) {
    var config = {};
    if (!err && data) {
      config = JSON.parse(data);
    }

    // Prompt for user (or confirm previous user)
    promptly.prompt('User: ' + (config.user ? '(' + config.user + ')' : ''), {
      default: config.user
    }, function (err, user) {
      // Prompt for password (password is never saved)
      promptly.password('Password: ', function (err, password) {
        // Prompt for system id (or confirm previous system id)  
        promptly.prompt('System Id: ' + (config.systemId ? '(' + config.systemId + ')' : ''), {
          default: config.systemId
        }, function (err, systemId) {
          // Write to config file for future uses
          fs.writeFile('config.json', JSON.stringify({
            user: user,
            systemId: systemId
          }, null, 4), function () {});

          // Create user session
          console.log(user, password, systemId);
          console.log(JSON.stringify({
            Login: user,
            Password: password
          }));
          cd.Security.CreateSession({
            Login: user,
            Password: password
          }, function (err) {
            callback(err, {
              'CD-User': user,
              'CD-Password': password,
              'CD-SystemId': systemId
            });
          });
        });
      });
    });
  });
}

// Command-line tool options
program
  .version(version)
  .option('-e, --environment <environment>', 'int1, sbx1 (default), stg1, etc.', 'sbx1')
  .option('-f, --file <file>', 'csv file to immerse')
  .option('-t, --target', 'updates only fields in the csv file');

// Command-line tool command: create
program
  .command('create <entity>')
  .description('creates Category, Media, Person, Playlist, or Product')
  .action(function (entity) {
    if (!program.file) {
      console.log('Undefined file');
      process.exit(1);
    }

    authenticate(program.environment, function (err, headers) {
      if (err) {
        console.log('Login Error', err);
        process.exit(1);
      }

      immersion.create(program.environment, headers, program.file, entity);
    });
  });

// Command-line tool command: update
program
  .command('update <entity>')
  .description('updates Category, Media, Person, Playlist, or Product')
  .action(function (entity) {
    if (!program.file) {
      console.log('Undefined file');
      process.exit(1);
    }

    authenticate(program.environment, function (err, headers) {
      if (err) {
        console.log('Login Error', err);
        process.exit(1);
      }

      immersion.update(program.environment, headers, program.file, program.target, entity);
    });
  });

// Start command-line tool
program.parse(process.argv);