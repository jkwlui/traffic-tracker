var app = angular.module('mapApp', []);

app.controller('mainCtrl', function ($scope, $http) {

  var polylines = [];

  var map;
  function initialize() {
    var mapOptions = {
      zoom: 13,
      center: new google.maps.LatLng(49.2827, -123.1207)
    };
    map = new google.maps.Map(document.getElementById('map-canvas'),
        mapOptions);


    google.maps.event.addListener(map, "idle", onIdle);
  }

  google.maps.event.addDomListener(window, 'load', initialize);


  function onIdle() {
    var bounds = map.getBounds();
    var sw = bounds.getSouthWest(),
        ne = bounds.getNorthEast();

    bBoxRequest(sw.lat(), sw.lng(), ne.lat(), ne.lng());
  }

  function bBoxRequest(sw_lat, sw_lon, ne_lat, ne_lon) {
    var config = {
      method: "GET",
      url: "/visualize/bbox",
      params:  {
        sw_lat: sw_lat,
        sw_lon: sw_lon,
        ne_lat: ne_lat,
        ne_lon: ne_lon
      }
    }

    console.log(config);

    $http(config)
    .then(function (res) {
      if (res.data.status == "success") {
        drawPolyLines(res.data);
        console.log(res.data);
      }
      else
        console.error(res);
    });
  }



  var drawPolyLines = function (data) {
    var segments = data.segments;
    var nodes = data.nodes;
    segments.forEach(function (segment) {
      var aLatLng = new google.maps.LatLng(
        nodes[segment.aNode].location[1],
        nodes[segment.aNode].location[0]
      );
      var bLatLng = new google.maps.LatLng(
        nodes[segment.bNode].location[1],
        nodes[segment.bNode].location[0]
      );
      var path = [aLatLng, bLatLng];
      var color = speedColor(segment.speeds);
      var polyline = new google.maps.Polyline({
        path: path,
        strokeColor: color,
        strokeWeight: 4
      });
      polyline.setMap(map);
      polylines.push(polyline);
    });
  };

  var speedColor = function (speed) {

    var color;

    if (speed < 3) {
      color = "#c0392b";
    } else if (speed < 6) {
      color = "#e67e22"
    } else if (speed < 9) {
      color = "#f1c40f"
    } else if (speed < 12) {
      color = "#16a085"
    } else {
      color = "#2ecc71"
    }

    return color;

  }
});
