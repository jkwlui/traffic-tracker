# Traffic Tracker

Built to support humanitarian efforts in Nepal, this app collects and aggregates traffic data from GPS traces to easily visualize traffic speed pattern across cities.

### Run locally

##### Install Node dependencies
```shell
$  npm install
```

##### Set up API keys
This application uses the [TrackMatching API](https://mapmatching.3scale.net/) to snap GPS coordinates onto roads. You need to get a free API key from their [website](https://mapmatching.3scale.net/login) in order for it to work. Place your App ID and App Key in a file named `config.json` at the root of the project like so:
```json
{
  "keys": {
    "TRACK_MATCHING": {
      "APP_ID": "YOUR_APP_ID_HERE",
      "APP_KEY": "YOUR_APP_KEY_HERE"
    }
  }
}
```

##### Start server
```shell
$  npm start
```
Server is running at `http://localhost:3000`

## Upload GPS traces

#### Endpoint ` POST /trip `

Include a `trip` JSON object in the request body:

```javascript
{
  "trip": {
    "geopoints": [
      {
        "lat": 49.165843,
        "lon": -123.107281,
        "time": "Tue Jun 09 2015 11:31:53 GMT-0700 (PDT)" // JS Date String
      },
      
      ...
    ]
  }
}
```

Server returns a  `200` status code immediately on success, while the request is processed in the background.

## Getting traffic speeds

#### Endpoint ` GET /visualize `

The `visualize` endpoint gets all speed data from the server using no params. The result is a JSON object:

```javascript
{
  "status": "success",
  "segments": [
    {
      "_id": "557619b42bba3087b53e5053",
      "aNode": 97998243,
      "bNode": 553101333,
      "way": 74366445,
      "__v": 0,
      "speeds": [
        4.319808545526469
      ]
    },
    {
      "_id": "557619b42bba3087b53e5054",
      "aNode": 253491085,
      "bNode": 553101333,
      "way": 74366445,
      "__v": 0,
      "speeds": [
        4.319808545526469
      ]
    }
  ],
  "nodes": {
    "97998243": {
      "_id": 97998243,
      "location": [
        -123.122786,
        49.2832809
      ],
      "__v": 0
    },
    "253491085": {
      "_id": 253491085,
      "location": [
        -123.1217731,
        49.2826492
      ],
      "__v": 0
    },
    "553101333": {
      "_id": 553101333,
      "location": [
        -123.1222277,
        49.2829285
      ],
      "__v": 0
    }
  }
}
```

##### Node

Nodes are points on a map.

`_id` references [OSM node IDs](http://wiki.openstreetmap.org/wiki/Node)

`location` are in [GeoJSON](http://geojson.org) format: `"location": [lng, lat]`

##### Segment

Segments are a roadway between two nodes on an [OSM way](http://wiki.openstreetmap.org/wiki/Way)

`aNode` and `bNode` always refers to a node in `nodes`.

`aNode` ID is by design smaller than `bNode` to avoid duplicate Segment entries in the database.

Note: While `segments` is an array, `nodes` is a hash with keys that reference to its OSM node IDs for quick searching.

#### Endpoint `GET /visualize/bbox`

Specify a bounding box in the query string of the GET request to return only segments covered by the box.

##### Example

```shell
$  CURL "/visualize/bbox/?sw_lat=49.195&sw_lon=-123.27&ne_lat=49.315&ne_lon=-123.020"
```

Response is in same format as the `GET /visualize` endpoint.
