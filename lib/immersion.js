/*
 *
 * http://contentdirect.csgi.com
 *
 * Copyright (c) 2014 David Caseria
 * Licensed under the MIT license.
 */

'use strict';

var ContentDirect = require('content-direct'),
  extend = require('extend'),
  fs = require('fs'),
  mkdirp = require('mkdirp'),
  parse = require('csv-parse'),
  program = require('commander'),
  promptly = require('promptly');

function authenticate(environment, callback) {
  var cd = new ContentDirect(environment);

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

          cd.Security.CreateSession({
            Login: user,
            Password: password
          }, function (err, res) {
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

function log(path, req, res) {
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
}

function parseFile(file, callback) {
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
  fs.readFile(file, 'utf8', function (err, data) {
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

        callback(obj);
      }
    });
  });
}

module.exports = {
  create: function (environment, file, entity) {
    // Authenticate user
    authenticate(environment, function (err, headers) {
      // Initialize Content Direct bindings
      var cd = new ContentDirect(environment, headers);

      // Parse CSV file
      parseFile(file, function (obj) {
        // Create retrieve request
        var retrieveReq = {
          Id: obj[entity].Id
        };
        cd.Catalog['Retrieve' + entity](retrieveReq, function (err, retrieveRes) {
          var retrievePath = (file.lastIndexOf('/') > -1 ? file.substring(0, file.lastIndexOf('/')) + '/' : '') + 'logs/Retrieve' + entity + '/' + obj[entity].Id.Value;
          log(retrievePath, retrieveReq, err ? err : retrieveRes);

          if (err) {
            // Core error codes
            var errorCodes = {
              Category: 918,
              Coupon: 905,
              CouponRedemptionCode: 906,
              Discount: 909,
              DistributionChannel: 112,
              GlobalDiscount: 909,
              Media: 900,
              Person: 900,
              Playlist: 914,
              PricingPlan: 916,
              Product: 920,
              Segment: 926,
              SegmentationRule: 925,
              ShippingMethod: 943,
              Storefront: 974
            };

            // Check if retrieve returns not found error
            if (err.Fault && err.Fault.Code === errorCodes[entity]) {
              cd.Catalog['Create' + entity](obj, function (err, createRes) {
                var createPath = (file.lastIndexOf('/') > -1 ? file.substring(0, file.lastIndexOf('/')) + '/' : '') + 'logs/Create' + entity + '/' + obj[entity].Id.Value;
                log(createPath, obj, err ? err : createRes);

                // Check create response
                if (err) {
                  console.log(obj[entity].Id.Value + ': Error (see Create' + entity + ' logs)');
                } else {
                  console.log(obj[entity].Id.Value + ': Success');
                }
              });
            } else {
              console.log(obj[entity].Id.Value + ': Error (see Retrieve' + entity + ' logs)');
            }
          } else {
            console.log(obj[entity].Id.Value + ': Already Exists');
          }
        });
      });
    });
  },
  update: function (environment, file, target, entity) {
    // Authenticate user
    authenticate(environment, function (err, headers) {
      // Initialize Content Direct bindings
      var cd = new ContentDirect(environment, headers);

      // Parse CSV file
      parseFile(file, function (obj) {
        // Create retrieve request
        var retrieveReq = {
          Id: obj[entity].Id
        };
        cd.Catalog['Retrieve' + entity](retrieveReq, function (err, retrieveRes) {
          var retrievePath = (file.lastIndexOf('/') > -1 ? file.substring(0, file.lastIndexOf('/')) + '/' : '') + 'logs/Retrieve' + entity + '/' + obj[entity].Id.Value;
          log(retrievePath, retrieveReq, err ? err : retrieveRes);

          if (err) {
            console.log(obj[entity].Id.Value + ': Error (see Retrieve' + entity + ' logs)');
          } else {
            var updateReq = target ? extend(true, retrieveRes, obj) : obj;

            cd.Catalog['Update' + entity](updateReq, function (err, updateRes) {
              var updatePath = (file.lastIndexOf('/') > -1 ? file.substring(0, file.lastIndexOf('/')) + '/' : '') + 'logs/Update' + entity + '/' + obj[entity].Id.Value;
              log(updatePath, obj, err ? err : updateRes);

              // Check update response
              if (err) {
                console.log(obj[entity].Id.Value + ': Error (see Update' + entity + ' logs)');
              } else {
                console.log(obj[entity].Id.Value + ': Success');
              }
            });
          }
        });
      });
    });
  }
};