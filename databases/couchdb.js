/*
	CouchDB Driver for RockMUD. Example REST driver.

	Basically we just make rest calls to an outlined database and grab JSON blobs.
	
	Objects have the same form as the default flat-file system.

	Databases should already be seetup within couch.
*/
'use strict';
var http = require('http');

module.exports = function(config) {
	// Setup driver wide properties
	var Driver = function() {
		var driver = this;

		driver.dataDbName = 'rockmud';
		driver.playerDbName = 'rockmud_players';
		driver.dbHost = '127.0.0.1';
		driver.dbPort = 5984;
		driver.username = 'makestuff';
		driver.password = 'makestuff';
		driver.dataView = 'areasByName',
		driver.playerView = '_design/players/_view/byName?key=';
		driver.authHeader = 'Basic ' + new Buffer(driver.username + ':' + driver.password).toString('base64');
		driver.createGenericOpt = function(method, db, data) {
			var path = '/' + driver.playerDbName;	

			return {
				hostname: driver.dbHost,
  				method: method,
				port: driver.dbPort,
				path: path,	
  				headers: {
    				'Content-Type': 'application/json',
					'Authorization': driver.authHeader,
					'Host': driver.dbHost
  				}
			};
		};

		return driver;
	};

	Driver.prototype.savePlayer = function(obj, fn) {
		var options = this.createGenericOpt('POST', this.playerDbName, obj),
		req = http.request(options, function(res) {
			res.on('data', function() {
			
			});

			res.on('end', function() {
    			fn(false, obj);
  			});
		});

		req.write(obj);
		req.end();
	};

	Driver.prototype.getPlayer = function(name, fn) {
		var driver = this,
		options = {
			method: 'GET',
			host: driver.dbHost, 
			path: '/' + driver.playerDbName + '/' + driver.playerView + '%22' + name.toLowerCase() + '%22',
			port: driver.dbPort,
			headers: {
				'Authorization': driver.authHeader,
				'Host': driver.dbHost
			}
		},
		result = '',
		req = http.request(options, function(res) {
			res.on('data', function(c) {
				result += c;
			});

			res.on('end', function() {
				result = JSON.parse(result);	

				if (result) {
					if (result.rows.length) {
						result = result.rows[0].value;
					} else {
						result = false;
					}
				}
	
				if (result) {
    				return fn(false, result);
				} else {
					return fn(true, false);
				}
  			});
		}).end();
	};

	return new Driver();
}
 
