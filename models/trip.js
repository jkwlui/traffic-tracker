var mongoose = require('mongoose');


// a geopoint is a GPS coordinate at a single point of time
var GeopointSchema = new mongoose.Schema({
  lat: Number,
  lon: Number,
  time: Date
});

// a trip is a collection of GPS coordinates during a trip that
// a user has taken
var TripSchema = new mongoose.Schema({
  geopoints: [GeopointSchema]
});

var Geopoint = mongoose.model('Geopoint', GeopointSchema);
var Trip = mongoose.model('Trip', TripSchema);

module.exports = {
  Geopoint: Geopoint,
  Trip: Trip
};
