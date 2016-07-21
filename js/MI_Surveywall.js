/** MI_Surveywall.js **********************************************************
 * $Id: MI_Surveywall.js 3415 2013-01-08 20:53:13Z hjones $
 * @fileoverview Class for implementing the Google Consumer Survey widget on story or gallery
 * pages.

 * @minify true
 * @author Jamison Kirk (jkirk [at] mcclatchyinteractive.com)
 * @requires jQuery-1.2.6+
 * @namespace mi
 * @aggpath js/MI_Surveywall.js
 **************************************************************************************/

/** Surveywall object constructor.
 * 
 * <p>Requirements to implement Surveywall on a page is:</p>
 * <ol>
 *   <li>Contact Google to have a google_site_id created for the market</li>
 * </ol>
 * <pre>
 * </pre>
 *
 * <h3>Configuration options</h3>
 * <dl>
 *   <dt>google_site_id</dt>
 *   <dd>Unique Id used by google to determine the market.</dd>
 *   <dt>use_asset_id</dt>
 *   <dd>boolean True/False. Allows Google to count page views by asset id. For galleries
 *       we need it turned off so that we can count views<d/d>
 *   <dt>paging_selector<dt>
 *   <dd>For use with galleries, set this to the id or class of the element controlling
 *       "next" paging</dd>
 *   <dt>view_limit</dt>
 *   <dd>Determines the number of in page views allowed such as with a photo gallery.
 *       Set to 1 to disable such as for use with story pages.</dd>
 *   <dt>page_permit</dt>
 *   <dd></dd>
 *   <dd>learn_more</dd>
 *   <dt>This message is displayed within the alternate action via the "Learn More" link.
 *       Leaving empty will hide the "Learn More" link.</dt>
 *   <dt>alternateActionObject<dt>
 *   <dd>This would be used within the Alternate Action pane of the Google Consumer Survey.
 *       It can either be a MI product function or a stand-alone object.</dd>
 *   <dt>deferred_listener_list</dt>
 *   <dd>An array of arrays. Used to apply listeners to elements in the alternate action once
 *       it's loaded.</dd>
 *   <dd>[["<selector>", "<event type>", "<handler>"],["<selector", "<event type>","<handler>"]]</dd>
 *   <dt>enabled</dt>
 *   <dd>Integer value to enable/disable Surveywall, default is enabled.<br>
 *     0 = fully disabled<br>
 *     1 = fully enabled<br>
 *   </dd>
 * </dl>
 * 
 * <h3>Instantiation Options</h3>
 * <dl>
 *   <dt>Setting a variable to the configuration object and passing that when calling new</dt>
 *   <dt>The configuration object should be in a conf file under the markets static and sits tight </dt>
 *   <dd>
 * var surveywall_conf = {
	google_site_id: "",
	use_asset_id: false,
	paging_selector: "",
	view_limit: 5,
	page_permit:{
		include:{type:[],
			section:[],
			asset:[]
			}
		exclude:{type:[],
			section:[],
			asset:[]
			}
	},
	learn_more: "This would display as a learn more message.",
	alternateActionObject: {
		object: null,
		css: "<url to css file>",
		name:"Digital Plus",
		html: "<url to html file>"
		deferred_listener_list : [
            ["#plus-link", "click", "flagForAltActStatusRecheck"]
        ]
	}
   }
   
   mi.surveywall = new mi.Surveywall(surveywall_conf, );
     </dd>
 * </dl>
 *   <dt>passing the configuration object directly when calling new</dt>
 *   <dd>
 * mi.surveywall = new mi.Surveywall({
	google_site_id: "value1",
	use_asset_id: false,
	paging_selector: "value2",
	page_permit: {
		include:{type:["gallery-detail"]}
	},
	learn_more: "Some text here."
	alternateActionObject: MI_ETCollect
   }
     </dd>
 * </dl>
 * 
 * @constructor
 * @this {mi.Surveywall}
 * @param {object} _config Configuration object literal
 */
mi.Surveywall = function( _config ) {
	mi.App.apply( this, arguments );
	mi.loadPageInfo();
	// without the ability to disable Surveywall globally Surveywall will
	// default to disabled
	if ( this.appStatus(_config) ) {
		var self = this;
		this.setConf("enabled", mi.control.surveywall);
		this.cache.baseGoogleSourceRequest = this.buildGoogleSourceRequest();
		this.initializeAlternateActionObject( _config.alternateActionObject ); // instantiate and execute any alt. action needs. This should set altact state.
		// Regex for the ajax insert of Google's api
		if ( !this.cache.google_script_regex ) {
			this.cache.google_script_regex = "(prompt|survey)\\?site=" + this.getConf("google_site_id");
		}
		this.initiatePrompt();
		jQuery(this.getConf("paging_selector")).bind("click", function() {
				self.initiatePrompt();
		});
		/* setViewsPassLimit() is being executed in the Project402 code as a callback once the
		 * microsurvey question is answered.
		 * Here we are setting the setViewsPassLimit() function to a variable because 
		 * Project402 was having difficulty executing mi.g1pman.setViewsPassLimit() 
		 * directly.
		 * UPDATE: this is no longer the case. The new pollElement() funcitonality
		 * makes it obsolete.
		 */ 
		window.mi_g1pman_setPhotoViewsPassLimit = function() {self.setViewsPassLimit()};
	}
	else {
		this.setConf("enabled",0);
		console.warn("Surveywall has been instantiated but disabled.");
	}
}

/* Checks for several requirements for running Surveywall
 * Each conditional may be dependent on the previous
 * 
 * @param {object} _config Configuration object literal
 */
mi.Surveywall.prototype.appStatus = function(_config) {
	if (
	 mi.control &&
	 mi.control.surveywall &&
	 this.checkCookie( _config.view_limit ) !== 0 &&
	 this.validPermitExists() &&
	 this.isPagePermitted( _config.page_permit )
	) {
		return true;
	}
	else {
		return false;
	}
}

/* Checks several requirements before executing loadScriptSource().
 * 
 * <p>Binded to the "paging_selector".</p>
 */
mi.Surveywall.prototype.initiatePrompt = function() {
	if ( this.getConf("enabled") && this.checkCookie() && !this.cache.prompt_active ) {
		// TODO: loadScriptSource returns true once script is put on page. This assumes google's stuff loads.
		// Instead, this should be fixed so that the user is unable to click Next such as
		// Remove/Re-apply listener
		if  ( !this.getAlternateActionStatus() ) {
			this.loadScriptSource(this.cache.baseGoogleSourceRequest.cloneNode());
		}
	}
}

/* Sets the cookie's threshold value to the view limit.
 * 
 * <p>Google is currently calling this function when the user satisfies the survey question(s)</p>
 */
mi.Surveywall.prototype.setViewsPassLimit = function() {
	var self = this;
	this.setCookieThreshold(this.cache.viewLimit);
}

/* Control to compare the cookie threshold value to the view_limit
 * A numerical value of 0 causes Surveywall to stand down.
 * @param {number} n 
 */
mi.Surveywall.prototype.checkCookie = function(n) {
	// if no limit speicifed set default of 5 views.
	n = this.cache.viewLimit = +n || +this.getConf("view_limit") || 5;
	// certify threshold values and limits are numbers with the + unary operator;
	
	if ( !this._cookie ) {
		this._cookie = new mi.Cookie(document, "mi_surveywall", null, "/");
		this._cookie.load();
		if ( (this._cookie.threshold = +this._cookie.threshold) === 0 ) {
			return this._cookie.threshold;
		}
	}
	else if ( (this._cookie.threshold = +this._cookie.threshold) <= n ) {
		if ( this._cookie.threshold === 1 ) {
			return this._cookie.threshold;
		}
		else if ( this._cookie.threshold > 1 && this._cookie.threshold <= n ) {
			this.setCookieThreshold(--this._cookie.threshold);
			return false;
		}
		else {
			this.setCookieThreshold();
			return false;
		}
	}
	else {
		this.setCookieThreshold(n);
		return false;
	}
}

/* Sets the Surveywall cookie threshold value
 * 
 */
mi.Surveywall.prototype.setCookieThreshold = function(n) {
	this._cookie.threshold = ( n !== undefined ) ? n : this._cookie.threshold;
	this._cookie.store();
	return this._cookie.threshold;
}

/* Sets the Surveywall cookie expire value
 * 
 */
mi.Surveywall.prototype.setCookieExpiration = function(n) {
	this._cookie.expiration = ( n !== undefined ) ? n : this._cookie.expiration;
	this._cookie_store();
	return this._cookie.expiration;
}

/* Check to see if mi.pageInfo and any one of section.id, type, or asset.id 
 * exists. Return false if at least one does not.
 */
mi.Surveywall.prototype.validPermitExists = function() {
	var pageInfo = mi.pageInfo; //var assign to limit object traversals
	this.cache.section_id = ( pageInfo && pageInfo.section && pageInfo.section.id )
		? pageInfo.section.id : undefined;
	this.cache.type = ( pageInfo && pageInfo.type ) ? pageInfo.type : undefined;
	this.cache.asset_id = ( pageInfo && pageInfo.asset && pageInfo.asset.id )
		? pageInfo.asset.id : undefined;

	if ( this.cache.section_id || this.cache.type || this.cache.asset_id) {
		return true;
	}
	else {
		return false;
	}
}

/* Check permission configuration against page values
 * 
 */
mi.Surveywall.prototype.isPagePermitted = function( page_permit_obj ) {
	//local object to limit mi object traversal during for loop
	var page_values = {
		section : this.cache.section_id,
		type : this.cache.type,
		asset : this.cache.asset_id
	}
	//default Surveywall page permission state is denied.
	var permit = false;

	for (var action in page_permit_obj){
		for (var permit_facet in page_permit_obj[action]) {
			if (page_permit_obj[action][permit_facet].length !== 0) {
				var permission_values = page_permit_obj[action][permit_facet];
				var isMatch = permission_values.match(page_values[permit_facet]);
				switch (action) {
					case "exclude":
						if (isMatch) {
							permit = false;
						}
						else {
							permit = true;
						}
					break;
					case "include":
						if (isMatch) {
							permit = true;
						}
						else {
							permit = false;
						}
					break;
				}
			}
		}
	}
	// Wrap permit in if condition so that we can return a message instead of just false
	if (permit) {
		return true;
	} else {
		return false;
	}
}

/* Build request for Google's source code. This happens at page load and 
 * utilized later by  executeSurveyWallRequest for better user experience.
 */
mi.Surveywall.prototype.buildGoogleSourceRequest = function(request_obj) {
		// Each of these constants should be broken out into their own setter method
		// to encourage unit testing.
		
	if ( request_obj ) {
		var CONTENT_ID = (this.getConf("use_asset_id") && this.cache.asset_id !== undefined ) ? this.cache.asset_id : (new Date()).getTime();
		var random = (new Date).getTime() + 1;
		request_obj.src += (CONTENT_ID ? '&cid=' + 
			encodeURIComponent(CONTENT_ID) : "") + '&random=' + 
			random + '&after=1';
		return request_obj;
	}
	else {
		var ARTICLE_URL = window.location.href;
		var GOOGLE_SITE_ID = this.getConf("google_site_id");
		
		//buildng <script> element to hold the google source url
		var google_source_url =
			'http://survey.g.doubleclick.net/survey' +
			'?site=' + encodeURIComponent(GOOGLE_SITE_ID) +
			'&url=' + encodeURIComponent(ARTICLE_URL);
			
		var request_obj = document.createElement("script");
		request_obj.setAttribute("src", google_source_url);
		request_obj.setAttribute("type", "text/javascript");
		return request_obj;
	}
}

/* Appends a script src tag to the page.
 * 
 * @param {element object} request_obj
 * @param {element object} target
 * @return true
 */
mi.Surveywall.prototype.loadScriptSource = function(request_obj, target) {
	var self = this;
	
	if (!target) {
		var target = document.getElementsByTagName('head')[0] ||
		document.getElementsByTagName('body')[0];
	}
	
	request_obj = this.buildGoogleSourceRequest(request_obj);
	/* append the built <script> element to <head>
	 * to make async request of Google Consumer Survey code
	 */
	this.pollElement(0, "#contain-402");
	target.appendChild(request_obj);

	var list = document.getElementsByTagName("script")
	for ( x=0; x < list.length; x++ ) {
		if ( (value = list[x].src.match(this.cache.google_script_regex)) ) {
			return true;
		}
	}
}

/* Creates the alternate action object as a sub object of Surveywall
 * @param {object} set in configuration
 */
mi.Surveywall.prototype.initializeAlternateActionObject = function( alternateAction ) {
	if ( typeof alternateAction.object == "function" ) {
		this._alternateAction = new alternateAction.object();
		for ( x in alternateAction ) {
			if ( typeof x === "number" || typeof x === "string" ) {
				this._alternateAction[x] = alternateAction[x];
			}
		}
		return false;
	}
	else {
		this._alternateAction = alternateAction;
	}
}

/* Assigns the document object of the alternateaction as an attribute of
 * surveywall's _alternateAction object handle.
 * Executed from within alternate action iframe
 *
 * @param {object} element object
 */
mi.Surveywall.prototype.initializeAlternateActionTarget = function( altActionDocObject ) {
	/* Tests should always pass no mater the extenuating circumstance.
	 * If this were to test the ability for the script in the alt act,
	 * which is really just this method call, 
	 * to successfully get it's methods and html then it should test 
	 * for something to make sure that it has what it needs.
	 * if ( everthing is in place ) {
	 *   code to get the alt act code in window.top
	 * }
	 */
	var self = this;
	this._alternateAction.iframeDocument = altActionDocObject;
	
	this.cache.learnMoreLink = this.buildLearnMoreLink();
	//this._alternateAction.iframeDocument.getElementsByTagName("head");
	jQuery("<link rel=\"stylesheet\" type=\"text/css\">")
		.attr("href", self.getConf("alternateActionObject").css)
		.appendTo(
			jQuery(self._alternateAction.iframeDocument)
			.find("head"));

	this.injectAlternateAction(this.getConf("alternateActionObject").html);
	//apply altact events here.
	this.applyListeners(this._alternateAction.deferred_listener_list);
}

/* Injects the configured alternate action code into the survey iframe space.
 * @param {string} url or html block
 */
mi.Surveywall.prototype.injectAlternateAction = function ( payload ) {
	/* This should be able to put anything into the altact iframe which could
	* include attaching event listeners (passed in as params)in one swoop.
	* Attach listeners after injection.
	* Executed once Google Prompt is loaded and callback from Alternate Action
	* iframe is received.
	*/
	//inject css link.
	var self = this;
	var targetFrameBody = this._alternateAction.iframeDocument.getElementsByTagName("body")[0];
	if ( payload.indexOf("http://") == 0 ) {
		jQuery.ajax({
			url: self.getConf("alternateActionObject").html,
			success: function(d,t) {
				jQuery(d)
					.appendTo(targetFrameBody);
				self.injectLearnMoreLink(targetFrameBody);
				return t;
			},
			async: false
		});
	}
	else {
		jQuery(payload)
			.appendTo(targetFrameBody);
		self.injectLearnMoreLink(targetFrameBody);
	}
	// Append "Learn More" link if it exists.
}

/* builds the Learn More Link into the alternate action
 * 
 */
mi.Surveywall.prototype.buildLearnMoreLink = function() {
	var self = this;
	if (this.getConf("learn_more")) {
		var link = this._alternateAction.iframeDocument.createElement("a");
		link.id = "info-link";
		link.innerHTML = "Learn More";
		link.style.cssText = "float: right; font-size: .8em; color:#378707;";
		link.href = "javascript:void(0)";
		
		jQuery(link).click(function() {self.displayMessage(self.getConf("learn_more"))});
		return link;
	}
	else {return false}
}

/* Append "Learn More" link if it does not exist already.
 * @param {element object} the link.
 */
mi.Surveywall.prototype.injectLearnMoreLink = function ( targetFrameBody ) {
	if ( this.getConf("learn_more") && !jQuery(targetFrameBody).find("#info-link")[0] ) {
		targetFrameBody.appendChild(this.cache.learnMoreLink);
	}
	else {return false}
}

/* Displays a default format message in the alternate action area.
 * You can set your special messages up in the config and apply this
 * message to event listeners.
 * ex. this.displayMessage(this.getConf("my_message_name"))
 */
mi.Surveywall.prototype.displayMessage = function( message ) {
	iframe_body = this._alternateAction.iframeDocument;
	jQuery(iframe_body).find("#msg").html(message);
	jQuery(iframe_body).find("#msgBlock").fadeIn();
	jQuery(iframe_body).find("#msgButton").click(function() {jQuery(iframe_body).find("#msgBlock").fadeOut()});
}

/* Apply listeners, accepts an array.
 * <p>called during altact init after altact injection.</p>
 */
mi.Surveywall.prototype.applyListeners = function( listener_list ) {
	if ( listener_list ) {
		var self = this;
		//Loop through the array set up in sites configuration file (deferred_listener_list)
		for ( x=0; x<listener_list.length; x++ ) {
			var y = listener_list[x];
			//Find selector in the alternate action iframe
			var selector = jQuery(this._alternateAction.iframeDocument).find(y[0]);
			//Apply listener to selector
			jQuery(selector).bind(y[1],function() {self[y[2]](y[3])});
		}
	}
}

/* Polls the polling target element such as the Google Consumer Survey container every half-second.
 * 
 */
mi.Surveywall.prototype.pollElement = function(runmode, poll_target_element, interval) {
	var self = this;
	if (poll_target_element != undefined) {
		
		return false;
	}
	interval = interval || 500;
	
	setTimeout(function () {
		//GCS iframe container
		element_state = jQuery(poll_target_element).get(0);
		element_state = (element_state !== undefined) ? element_state.style.display : element_state;
		
		//checking for inactive until active
		if (runmode == 0) {
			//if element isn't in the DOM, restart pollElement with same runmode
			if ( element_state === undefined ) {
				self.cache.prompt_active = false;
				self.pollElement(runmode, poll_target_element);
			}
			//if element is found in the DOM, restart pollElement with runmode 1
			else {
				self.cache.prompt_active = true;
				self.pollElement(1, poll_target_element);
			}
		}
		//checking for active until inactive
		else if (runmode == 1) {
			//if element is visibly in the DOM, restart pollElement with same runmode
			if ( element_state !== "none" && element_state !== undefined) {
				console.log("element_state = " + element_state);
				self.cache.prompt_active = true;
				self.pollElement(runmode, poll_target_element, 1000);
			}
			else {
				//end polling for the element.
				self.cache.prompt_active = false;
				
				//remove the script tag we added to the page.
				jQuery("head").find("script").each(function() {
					if ( (value = this.src.match(self.cache.google_script_regex)) ) {
						this.parentElement.removeChild(this)
					}
				});
				if ( element_state === "none" ) {
					jQuery(poll_target_element).remove();
					self.setViewsPassLimit();
				}
			}
		}
		else {
			console.warn("Mode must be set when using MI_Survewall.pollElement.");
		}
	},interval);
}

/* A customizable hook that returns the status of the alternate action.
 * @return {true}
 * Method is designed to be overriden when implementing an alternateAction.
 * In some cases, this method may just return a boolean value telling Surveywall 
 * a it's a go or no go. Other cases this may be more nuanced such as telling surveywall 
 * to display a special message ( via surveywalls displayMessage() method ) upon some event.
 */
mi.Surveywall.prototype.getAlternateActionStatus = function() {
	//This function is a place holder.
	return true;
}
/* MI_Surveywall.js ^ ****************************************************** */
