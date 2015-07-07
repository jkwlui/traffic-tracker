var model = require('../models/trip');
var matching = require('../controllers/matching');
var processor = require('../controllers/processor');
var processor_async = require('../controllers/processor_async');

var Geopoint = model.Geopoint;
var Trip = model.Trip;

var createTrip = function (geopoints, callback, errCallback) {
  if (geopoints == null || geopoints.length == 0) {
    errCallback('No geopoints');
    return;
  }

  var trip = new Trip();
  geopoints.forEach(function (geopoint) {

    var p = new Geopoint({
      lat: geopoint.lat,
      lon: geopoint.lon,
      time: geopoint.time
    });

    trip.geopoints.push(p);
  });

  trip.save(function (err, trip) {
    if (!err) {
      callback(true);
      console.log('Trip created successfully');
      console.log(trip._id);
      processor_async.processData(geopoints);
    } else {
      errCallback(err);
    }
  });
};

module.exports.createTrip = createTrip;
