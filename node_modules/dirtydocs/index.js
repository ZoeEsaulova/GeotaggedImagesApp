#!/usr/bin/env node

var fs = require('fs'),
    nunjucks = require('nunjucks'),
    _ = require('lodash'),
    JSPath = require('jspath');

/**
 * Organises `doclets` Array into Object with "classes" Array with each class containing
 * it's public members to make writing tempates easier
 * @param doclets {Array} Output of `jsdoc --explain` parsed into an Array.
 * @returns {Object} Object suitable for passing to `render`.
 */
function munge(doclets) {

    // Build an object we can pass to our template
    var content = _.reduce(doclets, function(result, item) {
        // Skip undocumented or private stuff
        if (item.undocumented || (item.access && item.access === 'private')) {
            return result;
        }
        if (item.kind === 'class') {
            result._classes[item.longname] = item;
            item.methods = [];
            result.classes.push(item);
        } else if (item.kind === 'function') {
            if (item.memberof) {
                result._classes[item.memberof].methods.push(item)
            } else {
                result.functions.push(item);
            }
        }
        if (item.kind === 'class' || item.kind === 'function') {
            item.signature = _.map(item.params, function(param) {
                return param.name;
            });
        }
        return result;
    }, {classes: [], _classes: {}});

    // Delete intermediate property
    delete content._classes;

    // Remove newlines from parameter descriptions to avoid breaking tables and close
    // up extra whitespace
    _.forEach(JSPath.apply('..params..{.description}', content.classes), function(item) {
        item.description = item.description.replace(/\n/g, ' ').replace(/\s+/g, ' ');
    });

    return content;

}

/**
 * Renders template using supplied docs Object.
 * @param template {String} Path to nunjucks template file.
 * @returns {String} Rendered template.
 */
function render(template, docs) {
    nunjucks.configure({autoescape: false});
    return nunjucks.render(template, docs);
}

// Export our functions
module.exports = {
    munge: munge,
    render: render
};
