var matching = require('./matching')
var overpass = require('./overpass')
var gpsUtil = require('gps-util')
var util = require('util')
var async = require('async');

var Segment = require('../models/segment');
var Node = require('../models/node');

// main function: takes geopoints input and run through API services
var processData = function (geopoints) {
  async.waterfall([
    // snaps geopoints to roads
    function (callback) {
      matching.matchTrip(geopoints,
        function (matched) {
          var results = { geopoints: geopoints, matched: matched };
          callback(null, results)
        },
        function (error) {
          callback(error);
        });
    },
    // query overpass to get ways and nodes data
    function (results, callback) {
      // extracts all ways' IDs from matched results
      var matched = results.matched;

      var wayIDs = getWays(matched);
      overpass.queryWays(wayIDs,
        function (overpass, unreturned) {

          // remove any links in matched results that could not be queried using OP

          results.matched = removeUnreturned(matched, unreturned);
          results.overpass = overpass;

          callback(null, results);
        },
        function (error) {
          callback(error);
        }
      );
    },
    // post-processing of overpass results
    function (results, callback) {
      var matched = results.matched;
      var overpass = results.overpass;
      var geopoints = results.geopoints;

      // map every waypoints from matched results to the nearest node using OP
      mapToNearestNode(matched, overpass, function (err) { callback(err); });
      // remove duplicate waypoints (with same nodes)
      removeDuplicateWpts(matched);
      // create segments using matched and overpass results
      var segments = createSegments(matched, overpass, geopoints);
      results.segments = segments;

      callback(null, results);
    },
    // submit results to database
    function (results, callback) {
      var overpass = results.overpass;
      var segments = results.segments;

      insertSegments(segments, overpass,
        function (success) {
          callback(null);
        },
        function (error) {
          callback(error);
        }
      );
    }
  ], asyncCallback);
  // callback
  var asyncCallback = function (error, success) {
    if (error)
      console.error(error);
    else
      console.log("Trip processed successfully");
  }
}

// Given an array of matched waypoints, collect all Way IDs and return as array
var getWays = function (matched) {
  var ways = [];

  matched.forEach(function (link) {
    ways.push(link.id);
  });

  return ways;
}

// Occasionally, Overpass API response will miss some ways, remove them so it
// wouldn't cause error downstream.
var removeUnreturned = function (matched, unreturned) {
  var newLinks = [];

  matched.forEach(function (link) {
    // this link(way) is in the unreturned list
    if (unreturned.indexOf(link.id) == -1) {
      newLinks.push(link);
    }
  });

  return newLinks;
}

// For each waypoint, find its nearest node on the same way.
var mapToNearestNode = function (matched, overpass, cberror) {
  matched.forEach(function (link) {
    link.wpts.forEach(function (wpt) {
      var nearestNode = findNearestNode(overpass, link.id, wpt.y, wpt.x)
      if (!nearestNode) {
        cberror("Cannot find nearest node");
        // TODO: test remove waypoints for non-existent node instead of throwing error
        return;
      }
      wpt.nearestNode = nearestNode;
    });
  });
}

// Helper for mapToNearestNode, compute euclidean distance between the waypoint
// with the nodes on the way and find the closest match
var findNearestNode = function (overpass, wayId, lat, lon) {
  var minNode = { distance: Infinity, node: null }
  var thisWay = overpass.ways[wayId];

  thisWay.nodes.forEach(function (nodeId) {
    var node = overpass.nodes[nodeId];
    var distance = gpsUtil.getDistance(lat, lon, node.lat, node.lon);
    if (distance < minNode.distance) {
      minNode.distance = distance;
      minNode.node = node;
    }
  });

  return minNode.node;
}

// waypoints on a way that are too close together gives no useful
// speed information, so remove them:
var removeDuplicateWpts = function (matched) {
  matched.forEach(function (link) {
    // accumulator storing previously seen nodes
    var visitedNode = [];
    // create new array with unique wpts
    var wptsArray = [];

    link.wpts.forEach(function (wpt) {
      var nodeId = wpt.nearestNode.id;
      if (visitedNode.indexOf(nodeId) == -1) {
        visitedNode.push(nodeId);
        wptsArray.push(wpt);
      }
    });

    link.wpts = wptsArray;
  });
}

// Create segments (a section of a road between 2 nodes on a way) given
// the matched route, nodes/segments data from Overpass
var createSegments = function (matched, overpass, geopoints) {

  var segments = [];

  matched.forEach(function (link) {
    var wayId = link.id;
    var way = overpass.ways[wayId];
    var nodesOnWay = way.nodes;
    var wpts = link.wpts;

    var newSegments = [];
    // construct newSegments for each pair of waypoints
    for (var i = 0; i < wpts.length - 1; i++) {
      var fWpt = wpts[i];
      var sWpt = wpts[i + 1];

      var nodeDistance = nodesOnWay.indexOf(sWpt.nearestNode.id)
            - nodesOnWay.indexOf(fWpt.nearestNode.id);
      //speed is shared regardless of intermediate nodes
      var speed = calculateSpeed(fWpt.id, sWpt.id, geopoints);

      // nodes exists as neighbouring nodes
      if (Math.abs(nodeDistance) == 1) {
        var sNode = Math.min(fWpt.nearestNode.id, sWpt.nearestNode.id);
        var lNode = Math.max(fWpt.nearestNode.id, sWpt.nearestNode.id);

        newSegments = [{
          aNode: sNode,
          bNode: lNode,
          way: wayId,
          speed: speed
        }];
      } else {

        console.log('else!',  nodeDistance)
        // segment has intermediate nodes
        if (nodeDistance > 0) {
          console.log('positive!')
          // nodes are in ascending direction
          var iAtFirst = nodesOnWay.indexOf(fWpt.nearestNode.id);

          for (var j = 0; j < nodeDistance; j++) {
            var sNode = Math.min(nodesOnWay[iAtFirst+j], nodesOnWay[iAtFirst+j+1]);
            var lNode = Math.max(nodesOnWay[iAtFirst+j], nodesOnWay[iAtFirst+j+1]);

            newSegments.push({
              aNode: sNode,
              bNode: lNode,
              way: wayId,
              speed: speed
            });
          }

        } else {

          var iAtLast = nodesOnWay.indexOf(sWpt.nearestNode.id);

          for (var j = 0; j < Math.abs(nodeDistance); j++) {
            var sNode = Math.min(nodesOnWay[iAtLast-j], nodesOnWay[iAtLast-j-1]);
            var lNode = Math.max(nodesOnWay[iAtLast-j], nodesOnWay[iAtLast-j-1]);

            newSegments.push({
              aNode: sNode,
              bNode: lNode,
              way: wayId,
              speed: speed
            });
          }
        }
      }
      segments = segments.concat(newSegments);
    }
  });

  return segments;
};

// Calculate distance between the points to find speed in a segment.
// * Only computes the direct distance between two points, not factoring in
// the curvature of the way.
var calculateSpeed = function (fWptID, sWptID, geopoints) {
  var fWpt = geopoints[fWptID];
  var sWpt = geopoints[sWptID];

  var fWptTime = new Date(fWpt.time);
  var sWptTime = new Date(sWpt.time);

  // in meters
  var distance = gpsUtil.getDistance(fWpt.lon, fWpt.lat, sWpt.lon, sWpt.lat);
  // in seconds
  var timeDiff = (sWptTime - fWptTime) / 1000;

  if (timeDiff <= 0)
    console.error("Time difference less than or equal to 0");

  var speed = distance / timeDiff;

  return speed;
};

// Insert segments and nodes into database
var insertSegments = function (segments, overpass, cb, errcb) {
  async.each(segments,
    function (segment, sCallback) {

      var node1Id = segment.aNode;
      var node2Id = segment.bNode;

      async.parallel([
        function (callback) {
          Node.findOrInsertNode(
            {
              id: node1Id,
              lat: overpass.nodes[node1Id].lat,
              lon: overpass.nodes[node1Id].lon
            },
            function (node) {
              console.log("node added to db");
              callback(null, true);
            },
            function (err) {
              console.log("node db error");
              callback(err);
            }
          );
        },
        function (callback) {
          Node.findOrInsertNode(
            {
              id: node2Id,
              lat: overpass.nodes[node2Id].lat,
              lon: overpass.nodes[node2Id].lon
            },
            function (node) {
              console.log("node added to db");
              callback(null, true);
            },
            function (err) {
              console.log("node db error");
              callback(err);
            }
          );
        },
        function (callback) {
          Segment.findOneAndUpdateSegment(segment,
            // success callback
          function (segment) {
            console.log("segment added to db");
            callback(null, true);
          },
            // err callback
          function (err) {
            console.log("segment db error");
            callback(err);
          });
        }
      ], function (err, results) {
        if (err)
          sCallback(err);
        else {
          sCallback(true);
        }
      });
  }, function (err) {
    if (err)
      errcb(err);
    else
      cb(true);
  });
}


module.exports.processData = processData;
