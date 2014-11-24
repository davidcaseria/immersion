#! /usr/bin/env node

'use strict';

// Dependencies
var immersion = require('./lib/immersion.js'),
  program = require('commander');

// Command-line tool options
program
  .version('2.0.0')
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

    immersion.create(program.environment, program.file, entity);
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

    immersion.update(program.environment, program.file, program.target, entity);
  });

// Start command-line tool
program.parse(process.argv);