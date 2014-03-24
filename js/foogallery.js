(function($, window, undefined){
	if (!$ || !window) { return; } // if jquery or no window object exists exit

	/** @namespace - Contains all the core objects and logic for the FooGallery plugin. */
	window.FooGallery = {
		defaults: {
			columnWidth: 240, // The width of the columns (this does not include padding, border or margin)
			bestFit: true, // Whether or not to try and best fit the columns so you dont end up with some columns being excessively longer than others. If true the order of the images will not be the same as they were appended to the DOM.
			animate: true // If set to true this will add a class to the tiles which will allow them to animate position changes, hover effects, etc., in CSS3 capable browsers
		},
		instances: [],
		generateId: function(instance, id){
			if (typeof id == 'number'){
				FooGallery.instances[id - 1] = instance;
				return id;
			}
			return FooGallery.instances.push(this);
		}
	};

	/**
	 * This small helper function was created due to the instanceof method of checking an object failing on 1 particular site....
	 * @param {Object} obj - The object to check if it's a jQuery object.
	 * @returns {boolean}
	 */
	FooGallery.isjQuery = function(obj){
		return (obj instanceof jQuery) ? true : (obj && obj.jquery);
	};

	/**
	 * A simple timer object created around setTimeout that is used by FooGallery.
	 * @returns {FooGallery.Timer}
	 * @constructor
	 */
	FooGallery.Timer = function () {
		/** @type {number} - The id returned by the setTimeout function. */
		this.id = null;
		/** @type {boolean} - Whether or not the timer is currently counting down. */
		this.busy = false;

		/**
		 * @type {FooGallery.Timer} - Hold a reference to this instance of the object to avoid scoping issues.
		 * @private
		 */
		var _this = this;

		/**
		 * Starts the timer and waits the specified amount of milliseconds before executing the supplied function.
		 * @param {function} func - The function to execute once the timer runs out.
		 * @param {number} milliseconds - The time in milliseconds to wait before executing the supplied function.
		 * @param {*} [thisArg] - The value of this within the scope of the function.
		 */
		this.start = function (func, milliseconds, thisArg) {
			thisArg = thisArg || func;
			_this.stop();
			_this.id = setTimeout(function () {
				func.call(thisArg);
				_this.id = null;
				_this.busy = false;
			}, milliseconds);
			_this.busy = true;
		};

		/**
		 * Stops the timer if its running and resets it back to its starting state.
		 */
		this.stop = function () {
			if (_this.id === null || _this.busy === false) { return; }
			clearTimeout(_this.id);
			_this.id = null;
			_this.busy = false;
		};
		return this;
	};

	/**
	 * Registers FooGallery with jQuery. When used FooGallery is initialized on the selected objects using the optional arguments.
	 * @returns {jQuery}
	 */
	$.fn.foogallery = function(options){
		options = options || {};
		return this.each(function () {
			var i = $(this).data('fgl_instance');
			if (i instanceof FooGallery.Instance) {
				i.reinit(options);
			} else {
				// init a new instance if one doesn't exist
				i = new FooGallery.Instance();
				i.init(this, options);
			}
		});
	};

	FooGallery.Instance = function (id) {
		/** @type {number} - The id of the current FooGallery instance. */
		this.id = FooGallery.generateId(this, id);
		/** @type {jQuery} - The jQuery element the FooGallery is bound to. */
		this.element = null;
		/** @type {Object} - The options for the current FooGallery instance. */
		this.options = $.extend(true, {}, FooGallery.defaults);
		/** @type {Object} - An object containing all timers required by this FooGallery instance. */
		this.timers = {
			delay: new FooGallery.Timer(),
			resize: new FooGallery.Timer()
		};

		/**
		 * @type {FooGallery.Instance} - Hold a reference to this instance of the object to avoid scoping issues.
		 * @private
		 */
		var _this = this;

		/**
		 * Common init & reinit code wrapped in a private function.
		 * @private
		 */
		var _init = function(){
			_this.handlers.resize();
			if (_this.options.animate) {
				// Add the CSS class that animates the various transitions. This is in a timeout as Chrome animates the tiles on first load if
				// executed synchronously, which looks a little strange, so rather set the layout and then only animate after that.
				_this.timers.delay.start(function() {
					_this.element.add('.fgl-tile:not(.fgl-temp)').addClass('fgl-tile-animate');
				}, 10);
			}
			$(window).unbind('resize.fgl-tile').bind('resize.fgl-tile', function() {
				_this.timers.resize.start(_this.handlers.resize, 200);
			});
		};

		/**
		 * Initializes this instance of the object using the supplied element and options.
		 * @param {(jQuery|HTMLElement)} element - The jQuery or DOM element the FooGallery was initialized on.
		 * @param {Object} options - The options supplied when the FooGallery was initialized.
		 */
		this.init = function (element, options) {
			_this.element = FooGallery.isjQuery(element) ? element : $(element);
			_this.options = $.extend(true, {}, _this.options, options || {});
			_this.element.addClass('fgl-instance').data('fgl_instance', _this);
			_init();
		};

		/**
		 * Reinitializes this instance of the object using the supplied options.
		 * @param {Object} options - The options supplied when the FooGallery was reinitialized.
		 */
		this.reinit = function (options) {
			_this.options = $.extend(true, {}, _this.options, options || {});
			_init();
		};

		/**
		 * Gets the current tile info required to perform layout calculations.
		 * @returns {Object}
		 */
		this.info = function(){
			var $tmp = $('.fgl-tile.fgl-temp');
			if ($tmp.length <= 0) {
				$tmp = $('<div></div>').addClass('fgl-tile fgl-temp');
				_this.element.append($tmp);
			}
			var info = { };
			info.border = parseInt($tmp.css('border-left-width'));
			info.margin = parseInt($tmp.css('margin-left'));
			info.padding = parseInt($tmp.css('padding-left'));
			info.outerWidth = _this.options.columnWidth + (info.padding * 2) + (info.border * 2) + (info.margin * 2);
			var pw = _this.element.parent().innerWidth();
			info.columns = Math.floor((pw - (info.margin * 2)) / info.outerWidth);
			return info;
		};

		this.handlers = {
			/**
			 * Handles the resizing of the gallery whenever it is needed.
			 */
			resize: function(){
				var info = _this.info(),
					index = 0,
					positionLeft = info.margin,
					positionTop = [];

				// To ensure an even spacing between tiles and the container start the top positions in by the amount of tile margin.
				for(var i = 0; i < info.columns; i++) { positionTop.push(info.margin); }

				_this.element.children('.fgl-tile:not(.fgl-temp)').each(function() {
					var $tile = $(this);
					// If the bestFit option is set to false and the current index is outside the bounds of the columns array reset it to 0.
					if (!_this.options.bestFit && index >= info.columns) { index = 0; }
					else if (_this.options.bestFit) {
						// Otherwise if we need to bestFit the tiles lets work out which column is the smallest and add to that.
						var min = positionTop[0]; index = 0;
						for(var l = 0; l < positionTop.length; l++){
							if (positionTop[l] < min){ min = positionTop[l]; index = l; }
						}
					}
					// Calculate the left position of the tile.
					positionLeft = (index * info.outerWidth) + Math.floor((info.outerWidth - $tile.outerWidth()) / 2);

					$tile.css({ 'margin': info.margin, 'padding': info.padding, 'position': 'absolute', 'top': positionTop[index], 'left': positionLeft });

					positionTop[index] += $tile.outerHeight(true); // Increase the current column's top position for the next iteration.
					if (!_this.options.bestFit) { index++; } // If bestFit is set to false increment the column index for the next iteration.
				});

				// Calculate and set the container width and height.
				var cw = (info.columns * info.outerWidth) + (info.margin * 2);
				var ch = 0;
				for(var k = 0; k < info.columns; k++){ if (positionTop[k] > ch){ ch = positionTop[k]; } }
				ch = ch + info.margin;

				_this.element.css({ 'width': cw, 'height': ch }); // Set the container size.
			}
		};
	};

})(jQuery, window);