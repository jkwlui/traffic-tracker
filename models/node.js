var mongoose = require('mongoose');


// a Node is a OSM coordinate when a way intersects or changes direction
var NodeSchema = new mongoose.Schema({
  _id: Number,
  location: {
    type: [Number],
    index: '2dsphere'
  }
});

var Node = mongoose.model('Node', NodeSchema);

module.exports.Node = Node;

var findOrInsertNode = function (node, callback, errCallback) {
  console.log(node);
    Node.findOneAndUpdate(
      { _id: node.id },
      {
        $setOnInsert: { nodeId: node.id,
                        location: [node.lon, node.lat] }
      },
      { upsert: true },
      function (err, mnode) {
        if (err)
          errCallback(err)
        else
          callback(mnode);
      }
    );
}
module.exports.findOrInsertNode = findOrInsertNode;

var findNodes = function (nodeIDs, callback, errCallback) {
  Node.find({
    '_id': {
      $in: nodeIDs
    }
  }, function (err, nodes) {
    if (!err)
      callback(nodes);
    else
      errCallback(err);
  });
}

var findNodesWithin = function (bbox, callback, errCallback) {
  var sw = [bbox.sw.lon, bbox.sw.lat];
  var ne = [bbox.ne.lon, bbox.ne.lat];

  console.log(sw);
  console.log(ne);

  Node.find().where('location').within().box(sw, ne).exec(function (err, nodes) {
    if (!err)
      callback(nodes);
    else
      errCallback(err);
  });
}

module.exports.findNodes = findNodes;
module.exports.findNodesWithin = findNodesWithin;
