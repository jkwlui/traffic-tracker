try {
  var configJSON = require('./config.json');
} catch (e) {
  console.error("Error loading ./config.json");
}

module.exports.keys = configJSON.keys;
