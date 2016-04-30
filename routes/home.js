//include all nedded packages and models 
var express = require('express');
var async = require('async');
var router = express.Router();
var MyImage = require('../models/image');
var multer = require('multer');
var fs = require('fs');
router.use(multer({ dest: './public/images', inMemory: true }).single('image'));
var im = require('imagemagick');
var gm = require('gm').subClass({ imageMagick: true });
var dms2dec = require('dms2dec');
var request = require('request');
var orb = require('orbjs'); 
var LatLon = require('geodesy').LatLonEllipsoidal;
var Dms = require('geodesy').Dms; 
var exif = require('exif-reader');
var turf = require('turf');
var gju = require('geojson-utils');
var po = require('poly-overlap');
var reproject = require('reproject-spherical-mercator');
var merc = require('mercator-projection');
var proj4 = require('proj4');
var tools = require('./tools');
var countImages = 1

/**
* Get input from client and send calculated polygon coordinates 
*/
router.get('/showPolygon', function(req, res) {
  //get map rotation in radians and convert it to degrees
  var r = 360-Number(tools.radToDegree(req.query.mapRotation))
  //get gps coordinates of the image
  var originLat = Number(JSON.parse(req.query.origin)[0])
  var originLon = Number(JSON.parse(req.query.origin)[1])
  // read exif data of a current image
  var buf = fs.readFileSync('/root/Bachelor/public' + req.query.imagePath);      
  var parser = require('exif-parser').create(buf);
  var result = parser.parse();
  var focalLength = result.tags.FocalLength
  var sensorWidth = 6.17
  //calculate FOV
  var fov = 2*Math.atan(0.5*sensorWidth/Number(focalLength))
  //if only building(s) are defined by user
  if (req.query.objectCoordsMap!="y" && req.query.modalCameraRotation=="t") {
    var result = tools.findPolygonFromObject(fov, originLat, originLon, req.query.imageSize, req.query.objectCoords, req.query.objectCoordsMap)
  //if only rotation is defined by user
  } else if (req.query.modalCameraRotation=="f" && req.query.objectCoordsMap=="y") {
    var result = tools.findPolygonFromRotation(fov, req.query.mapRotation, originLat, originLon, focalLength)
  //if rotation and building(s) are defined by user
  } else if (req.query.modalCameraRotation=="f" && req.query.objectCoordsMap!="y") {
    var result = tools.findPolygonFromRotationAndObject(
      fov, req.query.mapRotation, 
      originLat, originLon, req.query.imageSize, 
      req.query.objectCoords, req.query.objectCoordsMap)
  } 
  //send the coordinates of the polygon
  res.send({ 
    polygonCoords: JSON.stringify(result)
  })
})

/**
* Get input from the client, define polygon coordinates, rotation and displayed buildings
* and save all data in a database
*/
router.post('/submitToDatabase', function(req, res) {

  var focalLength = 0
  var fov = 0
  //get map rotation in radians and convert it to degrees
  var r = 360-Number(tools.radToDegree(req.body.mapRotation))
  //get image data
  var originLat = Number(JSON.parse(req.body.origin)[0])
  var originLon = Number(JSON.parse(req.body.origin)[1])
  var imageId = req.params.imageId
  var buf = fs.readFileSync('/root/Bachelor/public' + req.body.imagePath);      
  var parser = require('exif-parser').create(buf);
  var result = parser.parse();
  focalLength = Number(result.tags.FocalLength)
  var sensorWidth = 6.17
  //calculate FOV
  fov = 2*Math.atan(0.5*sensorWidth/Number(focalLength))
  //set new image name
  var imageNameOrder = countImages+5
  countImages = imageNameOrder
  imageNameOrder = imageNameOrder.toString()
  //move the image to another folder
  fs.rename('/root/Bachelor/public' + req.body.imagePath, '/var/www/html/'+ imageNameOrder + '.jpg', function(error) {
    if (error) {
      MyImage.find({}).exec(function(err,images) {
        if (err) {
          error = error + ", no images found"
        } 
        res.render('home.ejs', { 
          error: error + ".",
          coordsString: 'Home page', 
          properties: "[51.964045, 7.609542]",
          imageData: JSON.stringify(images)
        })
      }) 
     return 
    }
    
  })
  //if only one building is defined by user
  if (req.body.objectCoordsMap!="y" && req.body.modalCameraRotation=="t" && req.body.multipleObjects!="Yes" ) {
    //find coordinates of the camera viewing area
    var result = tools.findPolygonFromObject(fov, originLat, originLon, req.body.imageSize, req.body.objectCoords, req.body.objectCoordsMap)
  //if only rotation is defined by user
  } else if (req.body.modalCameraRotation=="f" && req.body.objectCoordsMap=="y") {
    //find coordinates of the camera viewing area
    var result = tools.findPolygonFromRotation(fov, req.body.mapRotation, originLat, originLon, focalLength)
  //if rotation and one building are defined by user
  } else if (req.body.modalCameraRotation=="f" && req.body.objectCoordsMap!="y" && req.body.multipleObjects!="Yes") {
    //find coordinates of the camera viewing area
    var result = tools.findPolygonFromRotationAndObject(
      fov, req.body.mapRotation, 
      originLat, originLon, req.body.imageSize, 
      req.body.objectCoords, req.body.objectCoordsMap)
  //if rotation and multiple buildings are defined by user
  } else if (req.body.multipleObjects=="Yes" && req.body.modalCameraRotation=="f") {
    //save image to db
    var image = new MyImage({ 
        name: imageNameOrder,
        path: '/root/Bachelor/public/db/images/' + imageNameOrder + '.jpg',
        coords: [ Number(originLat), Number(originLon) ],
        direction: 360-tools.radToDegree(Number(req.body.mapRotation)),
        buildings: JSON.parse(req.body.selectedBuildings)
    })
    image.save(function (error) {
      if (error) 
       MyImage.find({}).exec(function(err,images) {
        if (err) {
          error = error + ", no images found"
        } 
        res.render('home.ejs', { 
          error: error + ".",
          coordsString: 'Home page', 
          properties: "[51.964045, 7.609542]",
          imageData: JSON.stringify(images)
        })
      }) 
     return
    })
    //go to the home page
    res.redirect("/")
  //if only buildings are defined by user     
  } else if (req.body.multipleObjects=="Yes" && req.body.modalCameraRotation=="t") {
    //get building coordinates
    var parsed = JSON.parse(req.body.objectCoordsMap)
    var targetLat = Number(parsed[0].x)
    var targetLon = Number(parsed[0].y)
    //save image in db
    var image = new MyImage({ 
      name: imageNameOrder,
      path: '/root/Bachelor/public/db/images/' + imageNameOrder + '.jpg',
      coords: [ Number(originLat), Number(originLon) ],
      direction: Number(tools.findRotationFromTarget(targetLat, targetLon, originLat, originLon)),
      buildings: JSON.parse(req.body.selectedBuildings)
    })
     image.save(function (error) {
      if (error) 
       MyImage.find({}).exec(function(err,images) {
        if (err) {
          error = error + ", no images found"
        } 
        res.render('home.ejs', { 
          error: error + ".",
          coordsString: 'Home page', 
          properties: "[51.964045, 7.609542]",
          imageData: JSON.stringify(images)
        })
      }) 
     return
    })
    //go to the home page
    res.redirect("/")
  }
  // Transform coordinates from EPSG:4326 to EPSG:3857 
  var point1 = [ Number(result[0][0].originLat), Number(result[0][0].originLon) ]
  var point2 = [ Number(result[0][0].leftLat), Number(result[0][0].leftLon) ]
  var point3 = [ Number(result[0][0].rightLat), Number(result[0][0].rightLon) ]
  var point4 = [ Number(result[0][0].originLat), Number(result[0][0].originLon) ]
  var coords = []
  coords.push(point1)
  coords.push(point2)
  coords.push(point3)
  coords.push(point4)
  var polygon = ""
  for (x in coords) {
    var mercator = proj4(proj4('EPSG:3857'), proj4('EPSG:4326'), coords[x])
    polygon = polygon + mercator[1] + " " + mercator[0] + " "
  }
  // send overpass request 
  var latlon = ""
  var radius = "100"
  var data = 'way(poly:"' + polygon + '")["building"];'
  var url = 'http://overpass-api.de/api/interpreter?data=[out:json];' + data + 'out geom;';
  request(
    { method: 'GET'
    , uri: url
    , gzip: true
    , lalon: latlon
    , polygon: polygon
    , imageId: imageId
    }
    , function (error, response, body) { 
      //get overpass response
      var bodyString = body
      //find viewable buildings
      var buildings = tools.findViewableBuildings(polygon, body, latlon)
      //save image in db
      var image = new MyImage({ 
        name: imageNameOrder,
        path: '/root/Bachelor/public/db/images/' + imageNameOrder + '.jpg',
        coords: [ Number(originLat), Number(originLon) ],
        direction: Number(result[1]),
        buildings: buildings
      })
       image.save(function (error) {
        if (error) 
         MyImage.find({}).exec(function(err,images) {
          if (err) {
            error = error + ", no images found"
          } 
          res.render('home.ejs', { 
            error: error + ".",
            coordsString: 'Home page', 
            properties: "[51.964045, 7.609542]",
            imageData: JSON.stringify(images)
          })
        }) 
       return
      })
      //go to the home page
      res.redirect("/") 
    }
  )
})


/* Render the home page */
router.get('/', function(req, res) {
  // Find saved images and send them to the client
  MyImage.find({}).exec(function(err,images) {
    var error = "0"
    if (err) {
      error = "No images found"
    } 
    res.render('home.ejs', { 
      error: error + ".",
      coordsString: 'Home page', 
      properties: "[51.964045, 7.609542]",
      imageData: JSON.stringify(images)
    })
  })     
})

/* Get nodes, ways and relations inside a triangle polygon or within a certain radius*/
router.post('/overpass', function(req, res) {
  var latlon = ""
  var polygon = ""
  var radius = "100"
  //if polygon coords are available
  /*if (req.body.polyCoords!="x") {
    //create a data query
    var polygon = req.body.polyCoords
    var data = 'way(poly:"' + polygon + '")["building"];'   
  //if no polygon coords are available
  } else {*/
    //create a data query
    radius = req.body.radius
    var latlon = req.body.properties.slice(1, req.body.properties.length-1)
    var data = 'way(around:' + radius + ',' + latlon +  ')["building"];'
  //}
  var url = 'http://overpass-api.de/api/interpreter?data=[out:json];' + data + 'out geom;'
  //send request to the Overpass API
  request(
      { method: 'GET'
      , uri: url
      , gzip: true
      , lalon: latlon
      , polygon: polygon
      }
    , function (error, response, body) { 
      if (error) {
         MyImage.find({}).exec(function(err,images) {
            if (err) {
              error = error + ", no images found"
            } 
            res.render('home.ejs', { 
              error: error + ".",
              coordsString: 'Home page', 
              properties: "[51.964045, 7.609542]",
              imageData: JSON.stringify(images)
            })
          }) 
        return
      } else {
        //get found elements
        var result = JSON.parse(body).elements
        var buildings = []
        var bodyString = body
        var coords = []
        //if no polygon coords are available, save all found buildings
        if (polygon=="") {
          for (element in result) {          
            var nodes = result[element].geometry
            var geometry = []
              for (node in nodes) {
                var lat = Number(nodes[node].lat)
                var lon = Number(nodes[node].lon)
                var oneNode = proj4(proj4('EPSG:4326'), proj4('EPSG:3857'), [ lon, lat ])
                geometry.push(oneNode)
              }
              buildings.push({ id: result[element].id, geometry: [geometry] }) 
          }
        //if polygon coords are available, find viewable buildings
        } else {
          buildings = tools.findViewableBuildings(polygon, body, latlon)
        }
        //render image page
        res.render("image.ejs", {
          imagePath: req.body.imagePath,
          properties: req.body.properties,
          buildingCoords: JSON.stringify(buildings),
          building: true,
          radius: radius,
          bodyString: bodyString,
          rotation: req.body.mapRotation,
          icon: req.body.icon
        })
      }
    }
  )
})


/* Upload an image */
router.post('/upload', function(req, res) {
  var serverPath = '/images/' + req.file.originalname;
  fs.rename(req.file.path, '/root/Bachelor/public' + serverPath, function(error) {
    if (error) {
      res.send({
        error: 'Image upload failed'
      });
      return
    } else {
      // read exif
      var buf = fs.readFileSync('/root/Bachelor/public' + serverPath);      
      try { 
        var parser = require('exif-parser').create(buf) 
        var result = parser.parse()
      }
      catch(error) {
         MyImage.find({}).exec(function(err,images) {
          if (err) {
            error = error + ", no images found"
          } 
          res.render('home.ejs', { 
            error: error + ".",
            coordsString: 'Home page', 
            properties: "[51.964045, 7.609542]",
            imageData: JSON.stringify(images)
          })
        }) 
        return
      }
      
      var dec = [ result.tags.GPSLatitude, result.tags.GPSLongitude ]
      if ((dec[0]==undefined) || (dec[1]==undefined)) {
        var error = "Please upload a geotagged image (with GPS Coordinates available)"
         MyImage.find({}).exec(function(err,images) {
          if (err) {
            error = error + ", no images found"
          } 
          res.render('home.ejs', { 
            error: error + ".",
            coordsString: 'Home page', 
            properties: "[51.964045, 7.609542]",
            imageData: JSON.stringify(images)
          })
        }) 
        return
      }
      res.render('image.ejs', { 
        imagePath: serverPath,         
        properties: JSON.stringify(dec),
        building: false,
        radius: "100",
        rotation: '0',
        icon: '"Point"'
      })
    } 
  })                   
})

module.exports = router;
