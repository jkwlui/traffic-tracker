var express = require('express');
var router = express.Router();

var tripCtrl = require('../controllers/trip');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Trip' });
});


router.post('/', function(req, res) {
  var trip = req.body.trip;
  console.log(req.body);

  if (!trip) {
    res.status(500).json({ error: 'No trip object in request' });
    return;
  }

  tripCtrl.createTrip(trip.geopoints,
    // onSuccess
    function (success) {
      res.json({ success: true });
    },
    function (err) {
      res.status(500).json({ error: err });
    }
  );

});

module.exports = router;
