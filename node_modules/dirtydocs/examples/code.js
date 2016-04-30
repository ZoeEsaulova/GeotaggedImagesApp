/**
 * OpenLayers 3 Popup Overlay.
 * See [the examples](./examples) for usage. Styling can be done via CSS.
 * @constructor
 * @extends {ol.Overlay}
 * @param {Object} opt_options Overlay options, extends olx.OverlayOptions adding:
 *                              **`panMapIfOutOfView`** `Boolean` - Should the
 *                              map be panned so that the popup is entirely
 *                              within view.
 */
ol.Overlay.Popup = function(opt_options) {
    // ...
};

ol.inherits(ol.Overlay.Popup, ol.Overlay);

/**
 * Show the popup.
 * @param {ol.Coordinate} coord Where to anchor the popup.
 * @param {String} html String of HTML to display within the popup.
 */
ol.Overlay.Popup.prototype.show = function(coord, html) {
    // ...
};

/**
 * @private
 */
ol.Overlay.Popup.prototype.panIntoView_ = function(coord) {
    // ...
};

/**
 * Hide the popup.
 */
ol.Overlay.Popup.prototype.hide = function() {
    // ...
};
