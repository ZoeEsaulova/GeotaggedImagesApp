# reproject-spherical-mercator

Reproject geojson geometry from WGS84 to Spherical Mercator. In backend I am using [sphericalmercator](https://www.npmjs.com/package/sphericalmercator) moduel to convert the coordinates from WGS84 (epsg:4326) to Spehrical Mercator (EPSG:3857) also called web mercator.

## installation 

npm install reproject-spherical-mercator

## usage 
```javascript
var reproject = require('reproject-spherical-mercator');
var reprojected-geojson = reproject(wgs84-geojson);
```

## license
This project is licensed under the terms of the MIT license.
