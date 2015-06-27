// Imports
const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Cu.import('resource://gre/modules/osfile.jsm');

// Globals
const core = {
	addon: {
		name: 'Cashback',
		id: 'Cashback@jetpack',
		path: {
			name: 'cashback',
			content: 'chrome://cashback/content/',
			locale: 'chrome://cashback/locale/',
			resources: 'chrome://cashback/content/resources/',
			images: 'chrome://cashback/content/resources/images/',
			style: 'chrome://cashback/content/resources/styles/'
		}
	},
	os: {
		name: OS.Constants.Sys.Name.toLowerCase()
	}
};

/*
function getBodyHeight() {
	console.info('from within:', document.body.offsetHeight);
	return document.body.offsetHeight;
}
*/

document.addEventListener('DOMContentLoaded', function() {
	//console.info('from load:', document.body.offsetHeight);
	Services.obs.notifyObservers(null, core.addon.id + '_iframe-body-height', document.documentElement.offsetHeight);
}, false);