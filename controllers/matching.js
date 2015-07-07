var model = require('../models/trip');
var http = require('http');
var gpsUtil = require('gps-util');
var qs = require('querystring')
var util = require('util');
var request = require('request');
var config = require('./../config.js');

var Geopoint = model.Geopoint;
var Trip = model.Trip;

var matchTrip = function (geopoints, successCallback, errCallback) {

  var APP_ID = config.keys.TRACK_MATCHING.APP_ID;
  var APP_KEY = config.keys.TRACK_MATCHING.APP_KEY;

  var params = {
    app_id: APP_ID,
    app_key: APP_KEY,
    'output.groupByWays': true,
    'output.linkGeometries': true,
    'output.osmProjection': false,
    'output.linkMatchingError': true,
    'output.waypoints': true,
    'output.waypointsIds': true
  };

  var options =
    { method: 'POST',
      host: 'test.roadmatching.com',
      path: '/rest/mapmatch/?' + qs.stringify(params),
      headers: { 'Content-Type':'application/gpx+xml', 'Accept':'application/json' }
    };

  var body;

  toGPX(geopoints,
    // success callback
    function (results) {
      body = results;

      request({
        method: 'POST',
        uri: 'http://test.roadmatching.com/rest/mapmatch/?',
        headers: { 'Content-Type': 'application/gpx+xml', 'Accept': 'application/json' },
        qs: params,
        body: body
      }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
          console.log("matching request success");
          var raw = JSON.parse(body);
          var processed = processOutput(raw);
          successCallback(processed);
        } else {
          console.log("matching request error");
          console.log(error);
          errCallback(err);
        }
      });

    },
    // error callback
    function (err) {
      errCallback(err);
    }
  );

}

var processOutput = function (matched) {
  var waysArray = [];
  var diary = matched.diary;
  if (!diary) return [];
  var entries = diary.entries;
  if (!entries) return [];
  entries.forEach(function (entry) {
    var route = entry.route;
    if (!route) return;
    var links = route.links;
    if (!links) return;
    links.forEach(function (link) {
      var wayId = link.id;
      var wpts = link.wpts;
      if (!wpts || wpts.length < 1)
        return;
      waysArray.push(link);
    })
  });
  console.log(waysArray);
  return waysArray;
}


var toGPX = function (geopoints, callback, errCallback) {
  var geopoints_c = [];

  geopoints.forEach(function (val) {
    geopoints_c.push({
      lat: val.lat,
      lng: val.lon,
      time: new Date(val.time)
    });
  });

  gpsUtil.toGPX({
    points: geopoints_c
  }, function (err, result) {
    if (err) {
      errCallback(err);
    } else {
      callback(result);
    }
  }, "Trip");

};


module.exports.matchTrip = matchTrip;
