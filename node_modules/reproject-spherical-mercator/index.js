// reproject-spherical-mercator index.js
var SphericalMercator = require('sphericalmercator'),
  bbox = require('geojson-bbox'),
  sm = new SphericalMercator({size: 256});
function projCoords(coords) {
  return coords.map(function(coord) {
    return sm.forward(coord);
  });
}

var reproject = function(g) {
  var pg = {type: g.type};
  if (g.type == 'Point') {
    pg.coordinates = sm.forward(g.coordinates);
  } else if (g.type == 'LineString' || g.type == 'MultiPoint') {
    pg.coordinates = projCoords(g.coordinates);
  } else if (g.type == 'Polygon' || g.type == 'MultiLineString') {
    pg.coordinates = g.coordinates.map(function(part) {
      return projCoords(part);
    });
  } else if (g.type =='MultiPolygon') {
    pg.coordinates = g.coordinates.map(function(poly) {
      return poly.map(function(part) {
        return projCoords(part);
      });
    });
  } else if (g.type == 'Feature') {
    pg.geometry = reproject(g.geometry);
    if (g.id) pg.id = g.id;
    if (g.properties) pg.properties = g.properties;
    if (g.bbox) pg.bbox = bbox(pg);
  } else if (g.type == 'FeatureCollection') {
    pg.features = g.features.map(function(f) {
      return reproject(f);
    });
    if (g.bbox) pg.bbox = bbox(pg);
  } else if (g.type == 'GeometryCollection') {
    pg.geometries = g.geometries.map(function(geom) {
      return reproject(geom);
    });
  } else {
    throw new Error('Not a valid geojson');  
  }
  return pg; 
};

module.exports = reproject;
