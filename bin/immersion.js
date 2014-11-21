#!/usr/bin/env node

/****************/
/* DEPENDENCIES */
/****************/

var deepExtend = require('deep-extend'),
    events = require('events'),
    eventEmitter = new events.EventEmitter(),
    fs = require('fs'),
    mkdirp = require('mkdirp'),
    parse = require('csv-parse'),
    program = require('commander'),
    promptly = require('promptly'),
    request = require('request');

/**********/
/* EVENTS */
/**********/

eventEmitter.on('create', function (opts, obj) {
    //Call Create{Entity} API
    request({
        uri: 'https://services.' + opts.environment + '.' + (['prd1', 'prd2', 'prd3'].indexOf(opts.environment) != -1 ? 'contentdirect.tv' : 'cdops.net') + '/Catalog/Create' + opts.entity,
        method: 'POST',
        headers: opts.headers,
        body: JSON.stringify(obj),
        json: true
    }, function (error, response, body) {
        var logPath = (opts.file.lastIndexOf('/') > -1 ? opts.file.substring(0, opts.file.lastIndexOf('/')) + '/' : '') + 'logs/Create' + opts.entity + '/' + obj[opts.entity].Id.Value;
        log(logPath, JSON.stringify(obj), JSON.stringify(body));
        console.log(obj[opts.entity].Id.Value + ': ' + (error || response.statusCode != 200 || body.Fault ? 'Create' + opts.entity + ' Error' : 'Success'));
    });
});

eventEmitter.on('retrieve', function (opts, obj) {
    //Check if Id is provided for object
    if (typeof obj[opts.entity] === 'undefined' || typeof obj[opts.entity].Id === 'undefined') {
        console.log('Undefined ' + opts.entity);
        return;
    }

    //Call Retrieve{Entity} API
    request({
        uri: 'https://services.' + opts.environment + '.' + (['prd1', 'prd2', 'prd3'].indexOf(opts.environment) != -1 ? 'contentdirect.tv' : 'cdops.net') + '/Catalog/Retrieve' + opts.entity,
        method: 'POST',
        headers: opts.headers,
        body: JSON.stringify({
            Id: obj[opts.entity].Id
        }),
        json: true
    }, function (error, response, body) {
        if (error || response.statusCode != 200) {
            //Display error
            console.log(obj[opts.entity].Id.Value + ': Retrieve' + opts.entity + ' Error');
            var logPath = (opts.file.lastIndexOf('/') > -1 ? opts.file.substring(0, opts.file.lastIndexOf('/')) + '/' : '') + 'logs/Retrieve' + opts.entity + '/' + obj[opts.entity].Id.Value;
            log(logPath, JSON.stringify({
                Id: obj[opts.entity].Id
            }), JSON.stringify(body));
        } else if (body.Fault && opts.method == 'create') {
            //Create entity
            eventEmitter.emit('create', opts, obj);
        } else if (body.Fault && opts.method == 'update') {
            //Entity not found (skip update)
            console.log(obj[opts.entity].Id.Value + ': ' + opts.entity + ' Not Found');
        } else if (!body.Fault && opts.method == 'create') {
            //Entity already exists (skip create)
            console.log(obj[opts.entity].Id.Value + ': ' + opts.entity + ' Already Exists');
        } else if (!body.Fault && opts.method == 'update') {
            //Update entity
            if (opts.target) {
                deepExtend(body, obj);
                eventEmitter.emit('update', opts, body);
            } else {
                eventEmitter.emit('update', opts, obj);
            }
        } else {
            console.log(obj[opts.entity].Id.Value + ': Invalid Method');
        }
    });
});

eventEmitter.on('update', function (opts, obj) {
    request({
        uri: 'https://services.' + opts.environment + '.' + (['prd1', 'prd2', 'prd3'].indexOf(opts.environment) != -1 ? 'contentdirect.tv' : 'cdops.net') + '/Catalog/Update' + opts.entity,
        method: 'POST',
        headers: opts.headers,
        body: JSON.stringify(obj),
        json: true
    }, function (error, response, body) {
        var logPath = (opts.file.lastIndexOf('/') > -1 ? opts.file.substring(0, opts.file.lastIndexOf('/')) + '/' : '') + 'logs/Update' + opts.entity + '/' + obj[opts.entity].Id.Value;
        log(logPath, JSON.stringify(obj), JSON.stringify(body));
        console.log(obj[opts.entity].Id.Value + ': ' + (error || response.statusCode != 200 || body.Fault ? 'Update' + opts.entity + ' Error' : 'Success'));
    });
});

/*************/
/* FUNCTIONS */
/*************/

var authenticate = function (callback) {
    fs.readFile('config.json', 'utf8', function (err, data) {
        var config = {};
        if (!err && data) {
            config = JSON.parse(data);
        }
        promptly.prompt('User: ' + (config.user ? '(' + config.user + ')' : ''), {
            default: config.user
        }, function (err, user) {
            promptly.password('Password: ', function (err, password) {
                promptly.prompt('System Id: ' + (config.systemId ? '(' + config.systemId + ')' : ''), {
                    default: config.systemId
                }, function (err, systemId) {
                    fs.writeFile('config.json', JSON.stringify({
                        user: user,
                        systemId: systemId
                    }, null, 4), function (err) {});
                    callback({
                        'CD-User': user,
                        'CD-Password': password,
                        'CD-SystemId': systemId
                    });
                });
            });
        });
    })
};

var immerse = function (opts) {
    console.log('\nProcessing...');

    //Sets string property path to value
    var setObjectValue = function (obj, path, value) {
        var ref = obj;
        var props = path.split('.');

        while (props.length) {
            var prop = props.shift();
            if (!props.length) {
                var index = prop.match(/\[(.*?)\]/);
                if (index) {
                    prop = prop.replace(index[0], '');
                    if (!ref[prop]) ref[prop] = []
                    ref = ref[prop];
                    prop = index[1];
                }

                ref[prop] = value;
            } else {
                var index = prop.match(/\[(.*?)\]/);
                if (index) {
                    prop = prop.replace(index[0], '');
                    if (!ref[prop]) ref[prop] = []
                    ref = ref[prop];
                    prop = index[1];
                }

                if (!ref[prop]) ref[prop] = {}
                ref = ref[prop];
            }
        }

        return obj;
    };

    //Read file
    fs.readFile(opts.file, 'utf8', function (err, data) {
        if (err) {
            console.log(err);
            process.exit(1);
        }

        //Parse csv file
        parse(data, {
            comment: '#'
        }, function (err, output) {
            var properties = output[0];
            for (var r = 1; r < output.length; r++) {
                var obj = {};
                var row = output[r];

                for (var c = 0; c < row.length; c++) {
                    var value = row[c];
                    if (value) {
                        try {
                            value = JSON.parse(value);
                        } catch (e) {
                            if (value.toUpperCase() === 'TRUE') {
                                value = true;
                            } else if (value.toUpperCase() === 'FALSE') {
                                value = false;
                            } else if (value.toUpperCase() === 'NULL') {
                                value = null;
                            }
                        }
                        obj = setObjectValue(obj, properties[c], value);
                    }
                }

                eventEmitter.emit('retrieve', opts, obj);
            }
        });
    });
};

var log = function (path, req, res) {
    var regex = new RegExp('[|&:;$%@"<>()+,]', 'gi');
    path = path.replace(regex, '_');
    mkdirp(path, function (err) {
        if (err) {
            console.log(err);
        } else {
            fs.writeFile(path + '/request.json', req, function (err) {
                if (err) {
                    console.log(err);
                }
            });
            fs.writeFile(path + '/response.json', res, function (err) {
                if (err) {
                    console.log(err);
                }
            });
        }
    });
};

/***********/
/* PROGRAM */
/***********/

program
    .version('1.1.11')
    .option('-e, --environment <environment>', 'int1, sbx1 (default), stg1, etc.', 'sbx1')
    .option('-f, --file <file>', 'csv file to immerse')
    .option('-t, --target', 'updates only fields in the csv file');

program
    .command('create <entity>')
    .description('creates Category, Media, Person, Playlist, or Product')
    .action(function (entity) {
        if (!program.file) {
            console.log('Undefined file');
            process.exit(1);
        }

        authenticate(function (headers) {
            immerse({
                environment: program.environment,
                headers: headers,
                method: 'create',
                entity: entity,
                file: program.file
            });
        });
    });

program
    .command('update <entity>')
    .description('updates Category, Media, Person, Playlist, or Product')
    .action(function (entity) {
        if (!program.file) {
            console.log('Undefined file');
            process.exit(1);
        }

        authenticate(function (headers) {
            immerse({
                environment: program.environment,
                headers: headers,
                method: 'update',
                entity: entity,
                file: program.file,
                target: program.target
            });
        });
    });

program.parse(process.argv);