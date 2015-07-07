var query_overpass = require('query-overpass');
var request = require('request');

var queryWays = function (ways, callback, errCallback) {
  var query = prepareQuery(ways);

  console.log(ways);
  request({
    uri: 'http://overpass-api.de/api/interpreter',
    method: 'GET',
    qs: { data: query }
  }, function (error, response, body) {
    if (!error) {
      // TODO: add try block
      var results = JSON.parse(body);
      var organizedResults = organizeResult(results);
      var unreturnedWays = checkUnreturned(ways, organizedResults);
      callback(organizedResults, unreturnedWays);
    } else {
      errCallback(error);
    }
  });
}

var checkUnreturned = function (ways, results) {
  var unreturned = [];
  ways.forEach(function (way) {
    if (!results.ways[way])
      unreturned.push(way);
  });
  return unreturned
}

var organizeResult = function (results) {
  var organizedResult = {
    nodes: {},
    ways: {}
  }

  var elements = results.elements;
  elements.forEach(function (element) {
    if (element.type == 'node')
      organizedResult.nodes[element.id] = element;
    else if (element.type == 'way')
      organizedResult.ways[element.id] = element;
  });

  return organizedResult;
}

var prepareQuery = function (ways) {
  var query = "[out:json];(";
  ways.forEach(function (wayId) {
    query += "way(" + wayId + ");";
  });
  query += ");";
  query += "(._;>;);";
  query += "out;";
  return query;
}

module.exports.queryWays = queryWays;
