/* Functions */

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
var Vector3d = require('geodesy').Vector3d;
var Vec2D = require('vector2d');
var exif = require('exif-reader');
var turf = require('turf');
var gju = require('geojson-utils');
var po = require('poly-overlap');
var reproject = require('reproject-spherical-mercator');
var merc = require('mercator-projection');
var proj4 = require('proj4');

module.exports = {
	/**
	 * Converts radians to degrees
	 * @param {Number} rads
	 * @return {Number} degrees
	 */
	radToDegree: function (rad) {
	    var degrees = Math.abs(rad)*(180/Math.PI)
	    if (degrees > 360) { 
	        degrees = degrees - (Math.floor(degrees / 360)*360) 
	    } 
	    if (rad<0) {
	        degrees = 360 - degrees
	    }
	    return degrees
	},
	/**
	 * Checks if array contains a certain number
	 * @param {Number} random
	 * @param {[Number]} array
	 * @return {boolean} is in array
	 */
	randomInArray: function(random, array) {
		var result = false
	    for (var i=0;i<array.length;i++) {
	    	if (random==array[i]) {
		      	result = true
		      	break
	    	}  
	  	}
	  	return result
	},
	/**
	 * Finds target coordinates from rotation
	 * @param {Number} rotation
	 * @param {Number} tlat Latitude coordinate of the origin
	 * @param {Number} tlon Longitude coordinate of the origin
	 * @return {Number} distance Distance to the target
	 */
	targetFromRotation: function(rotation, tlat, tlon, distance) {
		var alpha = 0
		var lon = 0
		var lat = 0
		if (rotation<=1.5707963268) {
		    alpha = rotation
		    lon = -Math.sin(alpha)*distance
		    lat = -Math.cos(alpha)*distance
		} else if (rotation>1.5707963268 && rotation<=3.1415926536) {
		    alpha = 3.1415926536-rotation
		    lon = -Math.sin(alpha)*distance
		    lat = Math.cos(alpha)*distance
		} else if (rotation>3.1415926536 && rotation<=4.7123889804) {
		    alpha = rotation-3.1415926536
		    lon = Math.sin(alpha)*distance
		    lat = Math.cos(alpha)*distance
		} else {
		    alpha = 6.2831853072-rotation
		    lon = Math.sin(alpha)*distance
		    lat = -Math.cos(alpha)*distance
		}
		var targetLat3857 = Number(tlat)+Number(lon)
		var targetLon3857 = Number(tlon)+Number(-lat)
		return [targetLat3857, targetLon3857]
	},
	/**
	 * Finds polygon coordinates from rotation
	 * @param {Number} rotation
	 * @param {Number} tlat Latitude coordinate of the origin
	 * @param {Number} tlon Longitude coordinate of the origin
	 * @return {[String]} polygon coordinates and rotation
	 */
	findPolygonFromRotation: function(fov, rotation, tlat, tlon, focal) {
	  	var distance = 500
	  	var target = this.targetFromRotation(rotation, tlat, tlon, distance)
	  	var targetLat3857 = target[0]
	  	var targetLon3857 = target[1]
	  	var x = targetLat3857 - Number(tlat)
	  	var y = targetLon3857 - Number(tlon)
	  	var a = Number(fov)/2
	  	var xLeft = (x*Math.cos(a)) - (y*Math.sin(a)) + Number(tlat)
	  	var yLeft = (x*Math.sin(a)) + (y*Math.cos(a)) + Number(tlon)
	  	var xRight = (x*Math.cos(a)) + (y*Math.sin(a)) + Number(tlat)
	  	var yRight = (y*Math.cos(a)) - (x*Math.sin(a)) + Number(tlon)
	  	var result1 = [{ 
		    originLat: tlat,
		    originLon: tlon, 
		    targetLat: targetLat3857,
		    targetLon: targetLon3857,
		    leftLat: xLeft,
		    leftLon: yLeft,
		    rightLat: xRight,
		    rightLon: yRight
		}]
	  	var newRotation = 360-this.radToDegree(Number(rotation))
	  	return [ result1,  newRotation ]
	},
	/**
	 * Finds rotation from target coordinates
	 * @param {targetLat} tlat Latitude coordinate of the target
	 * @param {targetLon} tlon Longitude coordinate of the target
	 * @param {originLat} tlat Latitude coordinate of the origin
	 * @param {originLon} tlon Longitude coordinate of the origin
	 * @return {Number} rotation in degrees
	 */
	findRotationFromTarget: function(targetLat, targetLon, originLat, originLon) {
	  	var targetLon = Number(targetLon)
	  	var targetLat = Number(targetLat)
	  	var ix = Number(originLat)
	  	var iy = Number(originLon)
	  	var lat = targetLat-ix
	  	var lon = targetLon-iy
	  	var distance = Math.sqrt(Math.pow(lat,2)+Math.pow(lon,2))
	  	if ((targetLat>=ix) && (targetLon<=iy)) {
	    	var rad1 = Math.acos(lat/distance)
	    	var rad2 = Math.asin(-lon/distance)
	    	var rad = 3.1415926536-((rad1+rad2)/2)+1.5707963268
	    	return 360-this.radToDegree(rad) 
	  	} else if ((targetLat<=ix) && (targetLon<=iy)) {
	    	var rad1 = Math.acos(-lat/distance)
	    	var rad2 = Math.asin(-lon/distance)
	    	var rad = ((rad1+rad2)/2)+1.5707963268
	    	return 360-this.radToDegree(rad) 
	  	} else if ((targetLat>=ix) && (targetLon>=iy)) {
	    	var rad1 = Math.acos(lat/distance)
	    	var rad2 = Math.asin(lon/distance)
	    	var rad = 3.1415926536+((rad1+rad2)/2)+1.5707963268
	    	return 360-this.radToDegree(rad) 
	  	} else if ((targetLat<=ix) && (targetLon>=iy)) {
	    	var rad1 = Math.acos(-lat/distance)
		    var rad2 = Math.asin(lon/distance)
		    var rad = 6.2831853072-((rad1+rad2)/2) + 1.5707963268
		    return 360-this.radToDegree(rad) 
	  	}
	},
	/**
	 * Finds target coordinates from defined object
	 * @param {Number} fov: field of view
	 * @param {Number} lat: Latitude coordinate of the origin
	 * @param {Number} lon: Longitude coordinate of the origin
	 * @param {String} objectCoords: coordinates of the object on image
	 * @param {String} objectCoordsMap: coordinates of the object on map
	 * @return {String} target coordinates
	 */
	targetFromObject: function(fov, lat, lon, imageSize, objectCoords, objectCoordsMap) {
		
	  	var parsed = JSON.parse(objectCoordsMap) 
	  	var targetLat = Number(parsed[0].x)
	  	var targetLon = Number(parsed[0].y)
	  	var x = targetLat - Number(lat)
	  	var y = targetLon - Number(lon)
	  	var radInPixel = fov/Number(imageSize)
	  	var splitOb = objectCoords.split(" ")
	  	if ((Number(splitOb[0])==Number(splitOb[2])) && (Number(splitOb[1])==Number(splitOb[3]))) {
	  		var newObjectCoords = "253 120 413 250"
	  		splitOb = newObjectCoords.split(" ")
	  	}
	  	var selectionCenter = ((Number(splitOb[2])-Number(splitOb[0]))/2)+Number(splitOb[0])
	  	var offset = (Number(imageSize)/2)-selectionCenter
	  	var a = offset*radInPixel
	  	targetLat = ((x*Math.cos(a)) + (y*Math.sin(a)) + Number(lat)) 
	  	targetLon = ((y*Math.cos(a)) - (x*Math.sin(a))  + Number(lon)) 
	  	return [targetLat, targetLon]
	},
	/**
	 * Calculates the distance to the object
	 * @param {Number} lat: Latitude coordinate of the origin
	 * @param {Number} lon: Longitude coordinate of the origin
	 * @param {Number} targetLat: Latitude coordinate of the center of the object
	 * @param {Number} targetLon: Longitude coordinate of the center of the object
	 * @return {String} target coordinates
	 */
	distanceToObject: function(lat, lon, targetLat, targetLon) {
	  return Math.sqrt(Math.pow(targetLat-lat,2)+Math.pow(targetLon-lon,2))
	},
	/**
	 * Finds polygon coordinates from marked object
	 * @param {Number} fov: field of view
	 * @param {Number} lat: Latitude coordinate of the origin
	 * @param {Number} lon: Longitude coordinate of the origin
	 * @param {String} imageSize: image size
	 * @param {String} objectCoords: coordinates of the object on image
	 * @param {String} objectCoordsMap: coordinates of the object on map
	 * @return {[String]} polygon coordinates and rotation
	 */
	findPolygonFromObject: function(fov, lat, lon, imageSize, objectCoords, objectCoordsMap) {
	  	var target = this.targetFromObject(fov, lat, lon, imageSize, objectCoords, objectCoordsMap) 
	  	var targetLat = target[0]
	  	var targetLon = target[1]
	  	var distance = this.distanceToObject(Number(lat), Number(lon), targetLat, targetLon)
	   	var factor = 2.83477579755-(0.00522655115197*distance)
	   	if (factor<1.3) {
	    	factor = 1.3
	   	}
	  	x = (targetLat - Number(lat)) * factor
	  	y = (targetLon - Number(lon)) * factor
	  	a = Number(fov)/2
	  	var xLeft = (x*Math.cos(a)) - (y*Math.sin(a)) + Number(lat)
	  	var yLeft = (x*Math.sin(a)) + (y*Math.cos(a)) + Number(lon)
	  	var xRight = (x*Math.cos(a)) + (y*Math.sin(a)) + Number(lat)
	  	var yRight = (y*Math.cos(a)) - (x*Math.sin(a)) + Number(lon)
	  	var result = [{ 
	    	originLat: lat,
	    	originLon: lon, 
	    	targetLat: targetLat,
		    targetLon: targetLon,
		    leftLat: xLeft,
		    leftLon: yLeft,
		    rightLat: xRight,
		    rightLon: yRight
	  	}]
	  	var rotation = this.findRotationFromTarget(targetLat, targetLon, lat, lon)
	  	return [ result, rotation ]
	},
	/**
	 * Finds polygon coordinates from marked object nad given rotation
	 * @param {Number} fov: field of view
	 * @param {Number} rotation: rotation
	 * @param {Number} lat: Latitude coordinate of the origin
	 * @param {Number} lon: Longitude coordinate of the origin
	 * @param {String} imageSize: image size
	 * @param {String} objectCoords: coordinates of the object on image
	 * @param {String} objectCoordsMap: coordinates of the object on map
	 * @return {[String]} polygon coordinates and rotation
	 */
	findPolygonFromRotationAndObject: function(fov, rotation, lat, lon, imageSize, objectCoords, objectCoordsMap) {
	  	var targetO = this.targetFromObject(fov, lat, lon, imageSize, objectCoords, objectCoordsMap) 
	  	var targetLatO = targetO[0]
	  	var targetLonO = targetO[1]
	  	var distance = this.distanceToObject(Number(lat), Number(lon), targetLatO, targetLonO)
	  	var factor = 2.83477579755-(0.00522655115197*distance)
	   	if (factor<1.2) {
	    	factor = 1.2
	   	}
	  	var targetR = this.targetFromRotation(rotation, lat, lon, distance)
	  	var targetLatR = targetR[0]
	  	var targetLonR = targetR[1]
	  	var targetLat = (targetLatO + targetLatR)/2
	  	var targetLon = (targetLonO + targetLonR)/2
	  	var rotationO = this.findRotationFromTarget(targetLatO, targetLonO, lat, lon)
	  	var rotationResult = (Number(rotationO)  + (360-this.radToDegree(Number(rotation))))/2
	  	x = (targetLat - Number(lat)) * factor
	  	y = (targetLon - Number(lon)) * factor
	  	a = Number(fov)/2
	  	var xLeft = (x*Math.cos(a)) - (y*Math.sin(a)) + Number(lat)
	  	var yLeft = (x*Math.sin(a)) + (y*Math.cos(a)) + Number(lon)
	  	var xRight = (x*Math.cos(a)) + (y*Math.sin(a)) + Number(lat)
	  	var yRight = (y*Math.cos(a)) - (x*Math.sin(a)) + Number(lon)
	  	var result = [{ 
		    originLat: lat,
		    originLon: lon, 
		    targetLat: targetLat,
		    targetLon: targetLon,
		    leftLat: xLeft,
		    leftLon: yLeft,
		    rightLat: xRight,
		    rightLon: yRight
	  	}]
	  	return [ result, rotationResult ]
	},
	/**
	 * Finds outer points of the polygon
	 * @param {[Number]} nodes: polygon coordinates
	 * @return {[Number]} bounding box coordinates
	 */
	boundingBoxAroundPolyCoords: function(nodes) {
        var building = ""
        var coords = []
        var lats = []
        var lons = []
        for (node in nodes) {
            var lat = nodes[node].lat
            var lon = nodes[node].lon
            coords.push([ Number(lat), Number(lon) ])
            lats.push(Number(lat))
            lons.push(Number(lon))
        }
        sortedLats = lats.sort()
        sortedLons = lons.sort()
        var maximumLat = sortedLats[sortedLats.length-1]
        var maximumLon = sortedLons[sortedLons.length-1]
        var minimumLat = sortedLats[0]
        var minimumLon = sortedLons[0]
        var fromMaxLat = [maximumLat]
        var fromMinLat = [minimumLat]
        var fromMaxLon = []
        var fromMinLon = []
        for (i in coords) {
            if (coords[i][0]==maximumLat) {
            	if (coords[i][1]==maximumLon) {
            		var mxLon = maximumLon
            		var x = 2
            		while (mxLon==maximumLon && x>0) {
            			maximumLon = sortedLons[sortedLons.length-x]
            			x = x-1
            		}
            		
            	} else if (coords[i][1]==minimumLon) {
            		var mnLon = minimumLon
            		var x = 1
            		while (mnLon==minimumLon && x<sortedLons.length) {
            			minimumLon = sortedLons[x]
            			x = x+1
            		}          		
            	}
                fromMaxLat.push(coords[i][1])        
            } else if (coords[i][0]==minimumLat) {
            	if (coords[i][1]==maximumLon) {
            		maximumLon = sortedLons[sortedLons.length-2]
            	}
            	if (coords[i][1]==minimumLon) {
            		minimumLon = sortedLons[1]
            	}
                fromMinLat.push(coords[i][1])               
            }
            if (coords[i][1]==maximumLon) { 
                fromMaxLon.push(coords[i][0])
                fromMaxLon.push(maximumLon)        
            } else if (coords[i][1]==minimumLon) {
                fromMinLon.push(coords[i][0])
                fromMinLon.push(minimumLon)
            }
        }
        if (fromMaxLon.length==0 || fromMinLon.length==0) {
        	 for (i in coords) {
        	 	 if (coords[i][1]==maximumLon) { 
	                fromMaxLon.push(coords[i][0])
	                fromMaxLon.push(maximumLon)        
	            } else if (coords[i][1]==minimumLon) {
	                fromMinLon.push(coords[i][0])
	                fromMinLon.push(minimumLon)
	            }
        	 }
        } 
        return [ fromMaxLon, fromMaxLat,fromMinLon, fromMinLat]
  	},
	/**
	 * Finds buildings viewable on image
	 * @param {String} polygon: polygon coordinates
	 * @param {String} body: response from overpass API
	 * @param {String} latlon: origin coordintes
	 * @return {[json]} building
	 */
  	findViewableBuildings: function(polygon, body, latlon) {
    	var result = JSON.parse(body).elements 	
	    var buildings = []
	    var bodyString = body
	    var coords = []
	    var splitPolygon = polygon.split(" ")
	    var viewArea = turf.polygon([[
	      [Number(splitPolygon[1]), Number(splitPolygon[0])], 
	      [Number(splitPolygon[3]), Number(splitPolygon[2])], 
	      [Number(splitPolygon[5]), Number(splitPolygon[4])],
	      [Number(splitPolygon[1]), Number(splitPolygon[0])]
	    ]]) 
	    //check if element (building) is visible or not
	    for (element in result) {
	      	if (latlon!="") {
	        	var split = latlon.split(",")
	        	var lat = Number(split[0])
	        	var lon = Number(split[1])
	      	} else {
	        	var split = polygon.split(" ")
	        	var lat = Number(split[0])
	        	var lon = Number(split[1])
	      	}
      	var point = turf.point([lon, lat]); //origin
      	var poly1status = true
      	var poly2status = true
      	var poly3status = true
      	var poly4status = true
      	var poly5status = true
      	var add = true
      	var nodes = result[element].geometry //get all nodes of the building
      	var building = ""
      	var bounds = this.boundingBoxAroundPolyCoords(nodes)
      	var poly1 = turf.linestring([[lon, lat], [bounds[0][1], bounds[0][0]]])
      	var poly2 = turf.linestring([[lon, lat],[bounds[1][1], bounds[1][0]]])
        var poly3 = turf.linestring([[lon, lat],[bounds[2][1], bounds[2][0]]])
        var poly4= turf.linestring([[lon, lat],[bounds[3][1], bounds[3][0]]])
        var poly5 = turf.linestring([[lon, lat],[(bounds[0][1]+bounds[2][1])/2, (bounds[1][0]+bounds[3][0])/2]])
        var t1 = [(bounds[0][1]+bounds[2][1])/2, (bounds[1][0]+bounds[3][1])/2]
        var bbPoint1 = turf.point([bounds[0][1], bounds[0][0]])
        var bbPoint2 = turf.point([bounds[1][1], bounds[1][0]])
        var bbPoint3 = turf.point([bounds[2][1], bounds[2][0]])
        var bbPoint4 = turf.point([bounds[3][1], bounds[3][0]] )
        var boundsEl = result[element].bounds
        var array5 = [(Number(boundsEl.minlon)+Number(boundsEl.maxlon))/2, (Number(boundsEl.minlat)+Number(boundsEl.maxlat))/2]
        var bbPoint5 = turf.point(array5)
        var typeEl = result[element].tags.building
        var distanceEl = Math.sqrt(Math.pow(lon-array5[0],2)+Math.pow(lat-array5[1],2))
        var levelsEl = 0
        var heightEl = 0
        
        if (result[element].tags['building:levels']!=undefined) {
        	levelsEl = Number(result[element].tags['building:levels']) 
        }
        if (result[element].tags.height!=undefined) {
        	heightEl = Number(result[element].tags.height)
        }
        
        //check if lines intersect one of the found buildings
            for (x in result) {
              	if (result[x].id != result[element].id) {
                	var boundsX = this.boundingBoxAroundPolyCoords(result[x].geometry)
                	var levelsB = 0
                	var heightB = 0
                	var typeB = result[x].tags.building
                	if (result[x].tags['building:levels']!=undefined) {
			        	levelsB = Number(result[x].tags['building:levels']) 
			        }
			        if (result[x].tags.height!=undefined) {
			        	heightB = Number(result[x].tags.height)
			        }
                	var bbox = [
                  		Number(result[x].bounds.minlon), 
                  		Number(result[x].bounds.minlat), 
                  		Number(result[x].bounds.maxlon), 
                  		Number(result[x].bounds.maxlat)
                	]
                	var distanceB = Math.sqrt(Math.pow(lon-((bbox[0]+bbox[2])/2),2)+Math.pow(lat-((bbox[1]+bbox[3])/2),2))
                	var nodesX = result[x].geometry
                    var coordsX = []
                    for (node in nodesX) {
                      var lat = Number(nodesX[node].lat)
                      var lon = Number(nodesX[node].lon)
                      coordsX.push([lon,lat])               
                    }
                    coordsX.push(coordsX[0])
	                try { 
	                  var poly = turf.polygon([coordsX])
	                } catch(err) {
	                  console.log("TURF ERROR: " + err)
	                  break
	                }
	                var heightRatio = 0
	                if (heightEl>heightB && heightB!=0) {            	
	                	heightRatio = (heightEl*distanceB)/(heightB*distanceEl)
	                } else if (levelsEl>levelsB && levelsB!=0) {   
	                	heightRatio = (levelsEl*distanceB)/(levelsB*distanceEl)
	                } 
	                if (heightRatio>1) {
			        } else {
		                if (poly1status) {	                    
		                    if (!(turf.inside(bbPoint1,viewArea))) {
		                    	poly1status = false
		                  	} else {
		                  		var intersection1 = turf.intersect(poly1, poly)	 
		                  		if ((intersection1!=undefined) && (intersection1.geometry.type!="Point")) {
									poly1status = false								
		                  		}
		                  	} 
		                }
		                if (poly2status) {
		                   	if (!(turf.inside(bbPoint2,viewArea))) {
		                    	poly2status = false
		                  	} else {
		                  		var intersection2 = turf.intersect(poly2, poly)	 
		                  		if ((intersection2!=undefined) && (intersection2.geometry.type!="Point")) {
									poly2status = false
		                  		}
		                  	}
		                }
		                if (poly3status) {
		                  	if (!(turf.inside(bbPoint3,viewArea))) {
		                    	poly3status = false
		                  	} else {
		                  		var intersection3 = turf.intersect(poly3, poly)	 
		                  		if ((intersection3!=undefined) && (intersection3.geometry.type!="Point")) {
									poly3status = false
		                  		}
		                  	}
		                }
		                if (poly4status) {
		                   	if (!(turf.inside(bbPoint4,viewArea))) {
		                    	poly4status = false
		                  	} else {
		                  		var intersection4 = turf.intersect(poly4, poly)	 
		                  		if ((intersection4!=undefined) && (intersection4.geometry.type!="Point")) {
									poly4status = false
		                  		}
		                  	}
		                }
		                if (poly5status) {
		                  	if (!(turf.inside(bbPoint5,viewArea))) {
		                    	poly5status = false
		                  	} else {
		                  		var intersection5 = turf.intersect(poly5, poly)	 
		                  		if ((intersection5!=undefined) && (intersection5.geometry.type!="Point")) {
									poly5status = false
		                  		}
		                  	}
		                }
	            	}
	                if ((poly1status==false) && (poly2status==false) && (poly3status==false) && (poly4status==false) && (poly5status==false)) {
	                  	add = false
	                  	break
	                }                
              	}
            }
            //if element(building) is not hidden behind any other building --> save it
            if (add) {
              	var geometry = []
              	for (node in nodes) {
                    var lat = Number(nodes[node].lat)
                    var lon = Number(nodes[node].lon)
                    var oneNode = proj4(proj4('EPSG:4326'), proj4('EPSG:3857'), [ lon, lat ])
                    geometry.push(oneNode)
              	}
                buildings.push({ id: result[element].id, geometry: [geometry] }) 
            }  
        }
        return buildings
  	}
}