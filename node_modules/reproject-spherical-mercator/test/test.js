var expect = require('chai').expect,
  reproject = require('../'),
  GeoEq = require('geojson-equality'),
  testData = require('./test-data.js');

describe('reproject spherical mercator', function() {
  var eq = new GeoEq({precision: 5});
  it('Point', function() {
    expect(
      eq.compare(
        reproject(testData['Point'].input),
        testData['Point'].output
      )
    ).to.be.true;
  });
  it('LineString', function() {
    expect(
      eq.compare(
        reproject(testData['LineString'].input),
        testData['LineString'].output
      )
    ).to.be.true;
  });
  it('Polygon', function() {
    expect(
      eq.compare(
        reproject(testData['Polygon'].input),
        testData['Polygon'].output
      )
    ).to.be.true;
  });
  it('Polygon with hole', function() {
    expect(
      eq.compare(
        reproject(testData['Polygon with hole'].input),
        testData['Polygon with hole'].output
      )
    ).to.be.true;
  });
  it('MultiPoint', function() {
    expect(
      eq.compare(
        reproject(testData['MultiPoint'].input),
        testData['MultiPoint'].output
      )
    ).to.be.true;
  });
  it('MultiLineString', function() {
    expect(
      eq.compare(
        reproject(testData['MultiLineString'].input),
        testData['MultiLineString'].output
      )
    ).to.be.true;
  });
  it('MultiPolygon', function() {
    expect(
      eq.compare(
        reproject(testData['MultiPolygon'].input),
        testData['MultiPolygon'].output
      )
    ).to.be.true;
  });
  it('MultiPolygon with hole', function() {
    expect(
      eq.compare(
        reproject(testData['MultiPolygon with hole'].input),
        testData['MultiPolygon with hole'].output
      )
    ).to.be.true;
  });
  it('Feature', function() {
    var projected = reproject(testData['Feature'].input);
    expect(projected).to.have.property('bbox')
      .that.is.an('array')
      .that.to.have.length(4);
    var testbbox = projected.bbox;
    var expbbox = testData['Feature'].output.bbox;
    testbbox.forEach(function(coord, i) {
      expect(coord).to.be.closeTo(expbbox[i], 0.0001);
    });
    expect(
      eq.compare(projected,
        testData['Feature'].output
      )
    ).to.be.true;
  });
  it('Not a valid geojson', function() {
    expect(
      reproject.bind(this,{type:"Geometry", coordinates: [10,20]})
    ).to.throw(Error);
  });
  it('FeatureCollection', function() {
    var projected = reproject(testData['FeatureCollection'].input);
    expect(projected).to.have.property('type','FeatureCollection');
    expect(projected).to.have.property('bbox')
      .that.is.an('array')
      .that.to.have.length(4);
    var testbbox = projected.bbox;
    var expbbox = testData['FeatureCollection'].output.bbox;
    testbbox.forEach(function(coord, i) {
      expect(coord).to.be.closeTo(expbbox[i], 0.0001);
    });
    expect(
      testData['FeatureCollection'].output.features.every(function(expFeat) {
        return projected.features.some(function(projFeat) {
          return eq.compare(projFeat,expFeat);
        });
      })
    ).to.be.true;
  });
  it('GeometryCollection', function() {
    var projected = reproject(testData['GeometryCollection'].input);
    expect(projected).to.have.property('type','GeometryCollection');
    expect(
      testData['GeometryCollection'].output.geometries.every(function(expFeat) {
        return projected.geometries.some(function(projFeat) {
          return eq.compare(projFeat,expFeat);
        });
      })
    ).to.be.true;
  });
});
