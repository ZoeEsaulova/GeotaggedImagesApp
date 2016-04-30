/* Database schema for uploaded images*/

var mongoose = require('mongoose');
var mongooseToCsv = require('mongoose-to-csv');

var imageSchema = mongoose.Schema({
	name: { type: String },
	path: String,
	coords: [ Number ],
	direction: Number,
	buildings: []
});

imageSchema.plugin(mongooseToCsv, {
  headers: 'ID Name path direction',
  constraints: {
    'Name': 'name',
    'path': 'path',
    'direction': 'direction'
  },
    virtuals: {
    'ID': function(doc) {
		return doc._id	
    }
  }
});

module.exports = mongoose.model('Image', imageSchema);