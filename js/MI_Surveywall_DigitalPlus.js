mi.Surveywall.prototype.getAlternateActionStatus = function() {
	this.ppCookie = new mi.Cookie(document, "ppUser", null, "/");
	if ( this.ppCookie.load() ) {
		this.setCookieThreshold(0);
		this.setConf("enabled", 0);
		return true;
	}
	else {
		return false;
	}
}