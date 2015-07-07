var express = require('express');
var router = express.Router();

var Segment = require('../models/segment');
var Node = require('../models/node');

router.get('/bbox', function (req, res, next) {
  if (!req.query.sw_lon || !req.query.sw_lat || !req.query.ne_lon || !req.query.ne_lat) {
    res.status(400).json({ status: 'error', error: 'Missing bounding box' });
    return;
  }
  var query = req.query;
  var bbox = {
    sw: { lat: query.sw_lat, lon: query.sw_lon },
    ne: { lat: query.ne_lat, lon: query.ne_lon }
  };
  Node.findNodesWithin(bbox, function (nodes) {
    var nodesObj = {};
    nodes.forEach(function (node) {
      nodesObj[node._id] = node;
    });
    Segment.getSegmentsByNodes(nodes, function (segments) {
      segments.forEach(function (segment) {
        var speed = takeAverage(segment.speeds);
        segment.speeds = speed;
      });
      res.status(200).json({ status: 'success', nodes: nodesObj, segments: segments });
    });
  }, function () {
    res.status(500).json({ status: 'error', error: 'db error: Node collection'});
  })
});

router.get('/', function(req, res, next) {
  Segment.getAllSegments(function (segments) {
    var nodeIDs = [];
    segments.forEach(function (segment) {
      if (nodeIDs.indexOf(segment.aNode) == -1)
        nodeIDs.push(segment.aNode);
      if (nodeIDs.indexOf(segment.bNode) == -1)
        nodeIDs.push(segment.bNode);

      // take average of segment speeds
      var speed = takeAverage(segment.speeds);
      segment.speeds = speed;
    });
    Node.findNodes(nodeIDs,
      function (nodes) {
        var nodesObj = {};
        nodes.forEach(function (node) {
          nodesObj[node._id] = node;
        });

        res.status(200)
        .json({
          status: "success",
          segments: segments,
          nodes: nodesObj
        });
      },
      function (err) {
        res.status(500).json({
          status: "error",
          error: "mongoDB error, collection: node"
        });
      }
    );
  }, function (err) {
    console.log(err);
    res.status(500).json({
      status: "error",
      error: "mongoDB error, collection: segment"
    })
  })
});

var takeAverage = function (arr) {
  if (arr.length == 0) return 0;
  var sum = 0;
  arr.forEach(function (n) {
    sum += n;
  })
  return sum/arr.length;
}

module.exports = router;
