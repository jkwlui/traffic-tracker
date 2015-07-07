var matching = require('./matching');
var overpass = require('./overpass');
var gpsUtil = require('gps-util');
var util = require('util');

var Segment = require('../models/segment');
var Node = require('../models/node');

var points, matchedResult, opData, segments, nodes;

var processData = function (geopoints) {
  points = geopoints;
  matchedResult = null;
  opData = null;
  segments = [];
  nodes = [];
  matching.matchTrip(geopoints, matchedCallback, errCallback);
}

var matchedCallback = function (result) {
  console.log("route matched");
  console.log(util.inspect(result, false, null));

  matchedResult = result;
  // get all the ways in the result
  var ways = parseWays(result);

  overpass.queryWays(ways, overpassCallback, errCallback);
};

var overpassCallback = function (data) {
  console.log('overpass success');
  console.log(util.inspect(data, false, null));

  opData = data;

  mapToNearestNode();

  console.log('node-mapped wpts');
  console.log(util.inspect(matchedResult, false, null));

  removeDuplicateWpts();

  console.log("duplicates removed");
  console.log(util.inspect(matchedResult, false, null));

  createSegments();

  console.log(util.inspect(segments, false, null));

  segments.forEach(function (segment) {

    var node1Id = segment.aNode;
    var node2Id = segment.bNode;

    Node.findOrInsertNode(
      {
        id: node1Id,
        lat: opData.nodes[node1Id].lat,
        lon: opData.nodes[node1Id].lon
      },
      function (node) {
        console.log("node added to db");
      },
      function (err) {
        console.log("node db error");
      }
    );

    Node.findOrInsertNode(
      {
        id: node2Id,
        lat: opData.nodes[node2Id].lat,
        lon: opData.nodes[node2Id].lon
      },
      function (node) {
        console.log("node added to db");
      },
      function (err) {
        console.log("node db error");
      }
    );

    Segment.findOneAndUpdateSegment(segment,
      // success callback
    function (segment) {
      console.log("segment synced to db");
    },
      // err callback
    function (err) {
      console.log("db error");
    });
  });

}

var errCallback = function (err) {
  console.log('overpass error');
  console.log(err);
};

var parseWays = function (result) {

  var ways = [];

  var diary = result.diary;
  diary.entries.forEach(function (entry) {
    var route = entry.route;
    var links = route.links;
    links.forEach(function (way) {
      ways.push(way.id);
    });
  });
  console.log(ways);

  return ways;
}

var mapToNearestNode = function () {
  var diary = matchedResult.diary;
  diary.entries.forEach(function (entry) {
    var route = entry.route;
    var links = route.links;
    links.forEach(function (link) {
      var wayId = link.id;
      var wpts = link.wpts;
      if (!wpts)
        return;

      wpts.forEach(function (wpt) {
        wpt.nearestNode = findNearestNode(wayId, wpt.y, wpt.x);
      });
    });
  });
}

var findNearestNode = function (wayId, lat, lon) {
  var minNode = {
    distance: Infinity,
    node: null
  }

  var thisWay = opData.ways[wayId];
  thisWay.nodes.forEach(function (nodeId) {
    var node = opData.nodes[nodeId];

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
var removeDuplicateWpts = function () {
  // stores node IDs of visited nodes
  matchedResult.diary.entries.forEach(function (entry) {
    entry.route.links.forEach(function (link) {
      var visitedNode = [];
      var wptsArray = [];

      if (!link.wpts)
        return;

      link.wpts.forEach(function (wpt) {
        var nodeId = wpt.nearestNode.id;
        if (visitedNode.indexOf(nodeId) == -1) {
          visitedNode.push(nodeId);
          wptsArray.push(wpt);
        }
      });
      link.wpts = wptsArray;
    });
  });

}

// create segments (two subsequent waypoints on a way)
var createSegments = function () {
  matchedResult.diary.entries.forEach(function (entry) {
    entry.route.links.forEach(function (link) {
      var wayId = link.id;
      var way = opData.ways[wayId];
      var nodesOnWay = way.nodes;
      var wpts = link.wpts;

      if (!wpts)
        return;

      var newSegments = [];
      // construct newSegments for each pair of waypoints
      for (var i = 0; i < wpts.length - 1; i++) {
        var fWpt = wpts[i];
        var sWpt = wpts[i + 1];

        var nodeDistance = nodesOnWay.indexOf(sWpt.nearestNode.id)
              - nodesOnWay.indexOf(fWpt.nearestNode.id);
        //speed is shared regardless of intermediate nodes
        var speed = calculateSpeed(fWpt.id, sWpt.id);

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
  });
};

var calculateSpeed = function (fWptID, sWptID) {
  // TODO: calculate speed according to the original distance and time, not from
  // matched results.
  var fWpt = points[fWptID];
  var sWpt = points[sWptID];

  var fWptTime = new Date(fWpt.time);
  var sWptTime = new Date(sWpt.time);

  // in meters
  var distance = gpsUtil.getDistance(fWpt.lon, fWpt.lat, sWpt.lon, sWpt.lat);
  // in seconds
  var timeDiff = (sWptTime - fWptTime) / 1000;

  var speed = distance / timeDiff;

  return speed;
};



module.exports.processData = processData;
