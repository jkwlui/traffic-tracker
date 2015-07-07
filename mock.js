var fs = require('fs');
var Node = require('./models/node');
var Segment = require('./models/segment');
var express = require('express');
var router = express.Router();


router.get('/', function(req, res, next) {

  var data = JSON.parse(fs.readFileSync('vancouver.json', 'utf8'));

  var nodes = {}, ways = {};
  var trunNodes = {}, trunWays = {};

  data.elements.forEach(function (row) {
    if (row.type == "node") {
      nodes[row.id] = row;
    } else if (row.type = "way") {
      ways[row.id] = row;
    }
  });

  var wayCount = 0;
  for (var wayId in ways) {
    if (wayCount == 500)
      break;
    wayCount++;
    trunWays[wayId] = ways[wayId];
  }

  for (var wayId in trunWays) {
    for (var i = 0; i < trunWays[wayId].nodes.length - 1; i++) {
      var aNode = Math.min(trunWays[wayId].nodes[i], trunWays[wayId].nodes[i+1]);
      var bNode = Math.max(trunWays[wayId].nodes[i], trunWays[wayId].nodes[i+1]);
      var rand = Math.random() * 25;
      var segment = {
        aNode: aNode,
        bNode: bNode,
        way: wayId,
        speed: rand
      }
      Segment.findOneAndUpdateSegment(segment, function () {
        console.log("segment inserted");
      }, function () {
        console.log("error");
      });

      Node.findOrInsertNode(nodes[aNode], function () {
        console.log("aNode inserted");
      }, function () {
        console.log("error");
      });

      Node.findOrInsertNode(nodes[bNode], function () {
        console.log("aNode inserted");
      }, function () {
        console.log("error");
      })
    }
  }

  res.json({ 'success': true });

});

module.exports = router;
