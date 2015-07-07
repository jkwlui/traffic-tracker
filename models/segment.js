var mongoose = require('mongoose');
var Schema = mongoose.Schema;


// a Segment is two neighbouring nodes on a way
var SegmentSchema = new mongoose.Schema({
  aNode: Number,
  bNode: Number,
  way: Number,
  speeds: [Number]
});

var Segment = mongoose.model('Segment', SegmentSchema);

module.exports.Segment = Segment;

var findOneAndUpdateSegment = function (segment, callback, errCallback) {
    Segment.findOneAndUpdate(
      { aNode: segment.aNode, bNode: segment.bNode, way: segment.way },
      {
        $setOnInsert: { aNode: segment.aNode,
                        bNode: segment.bNode,
                        way: segment.way },
        $push: { speeds: segment.speed }
      },
      { upsert: true },
      function (err, msegment) {
        if (err)
          errCallback(err)
        else
          callback(msegment);
      }
    );
}

var getAllSegments = function (callback, errCallback) {
  Segment.find(function (err, segments) {
    if (!err)
      callback(segments);
    else
      errCallback(err)
  });
}

var getSegmentsByNodes = function (nodes, callback, errCallback) {
  var nodeIds = [];
  nodes.forEach(function (val) {
    nodeIds.push(nodes._id);
  });
  Segment.find()
      .where({ $or: [{ 'aNode': { $in: nodes }}, { 'bNode': { $in: nodes } }] })
      .exec(function (err, segments) {
        if (!err)
          callback(segments);
        else {
          errCallback(err);
        }
      });
}


module.exports.getAllSegments = getAllSegments;
module.exports.findOneAndUpdateSegment = findOneAndUpdateSegment;
module.exports.getSegmentsByNodes = getSegmentsByNodes;
