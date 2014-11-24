/*
 *
 * http://contentdirect.csgi.com
 *
 * Copyright (c) 2014 David Caseria
 * Licensed under the MIT license.
 */

'use strict';

// Dependencies
var ContentDirect = require('content-direct'),
  extend = require('extend'),
  fs = require('fs'),
  mkdirp = require('mkdirp'),
  parse = require('csv-parse'),
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

// Log request/response has json files
function log(path, req, res) {
  // Replace special characters for file safety
  var regex = new RegExp('[|&:;$%@"<>()+,]', 'gi');
  path = path.replace(regex, '_');

  // Make log file path
  mkdirp(path, function (err) {
    if (err) {
      console.log(err);
    } else {
      // Write request to file
      fs.writeFile(path + '/request.json', JSON.stringify(req), function (err) {
        if (err) {
          console.log(err);
        }
      });

      // Write response to file
      fs.writeFile(path + '/response.json', JSON.stringify(res), function (err) {
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

    // Interate through properties in object path string
    while (props.length) {
      var prop = props.shift();
      var index = null;

      // Check if final property to set value
      if (!props.length) {
        // Check if the property has an array index
        index = prop.match(/\[(.*?)\]/);
        if (index) {
          prop = prop.replace(index[0], '');
          if (!ref[prop]) {
            ref[prop] = [];
          }
          ref = ref[prop];
          prop = index[1];
        }

        // Set value
        ref[prop] = value;
      } else {
        // Check if property has an array index
        index = prop.match(/\[(.*?)\]/);
        if (index) {
          prop = prop.replace(index[0], '');
          if (!ref[prop]) {
            ref[prop] = [];
          }
          ref = ref[prop];
          prop = index[1];
        }

        // Create object literal if object is null
        if (!ref[prop]) {
          ref[prop] = {};
        }

        // Move object reference
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
      // Get header row (list of properties)
      var properties = output[0];

      // Iterate through all rows below the header
      for (var r = 1; r < output.length; r++) {
        var obj = {};
        var row = output[r];

        // Iterate through all columns
        for (var c = 0; c < row.length; c++) {
          var value = row[c];
          if (value) {
            // Handle JSON has the cell value
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

            // Dynamically set the object value
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
      if (err) {
        console.log('Login Error');
        process.exit(1);
      }

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
              Person: 902,
              Playlist: 914,
              PricingPlan: 916,
              Product: 920,
              Segment: 926,
              SegmentationRule: 925,
              ShippingMethod: 943,
              Storefront: 974
            };

            // Check if retrieve returns not found error
            if (err && err.Code === errorCodes[entity]) {
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
      if (err) {
        console.log('Login Error');
        process.exit(1);
      }

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