// Imports
const {classes: Cc, interfaces: Ci, manager: Cm, results: Cr, utils: Cu, Constructor: CC} = Components;

Cu.import('resource:///modules/CustomizableUI.jsm');
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/XPCOMUtils.jsm');
const {TextDecoder, TextEncoder, OS} = Cu.import('resource://gre/modules/osfile.jsm', {});

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

const cui_cssUri = Services.io.newURI(core.addon.path.style + 'cui.css', null, null);
const NS_HTML = 'http://www.w3.org/1999/xhtml';
const NS_XUL = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
var panelview_onViewShowing_load; //used to set from onViewShowing and the body-height observer uses this to set heights on it otherwise it doesnt know the element
var iframe_onViewShowing_load;

// Lazy Imports
const myServices = {};
XPCOMUtils.defineLazyGetter(myServices, 'sb', function () { return Services.strings.createBundle(core.addon.path.locale + 'bootstrap.properties?' + Math.random()); /* Randomize URI to work around bug 719376 */ });

function extendCore() {
	// adds some properties i use to core
	switch (core.os.name) {
		case 'winnt':
		case 'winmo':
		case 'wince':
			core.os.version = parseFloat(Services.sysinfo.getProperty('version'));
			// http://en.wikipedia.org/wiki/List_of_Microsoft_Windows_versions
			if (core.os.version == 6.0) {
				core.os.version_name = 'vista';
			}
			if (core.os.version >= 6.1) {
				core.os.version_name = '7+';
			}
			if (core.os.version == 5.1 || core.os.version == 5.2) { // 5.2 is 64bit xp
				core.os.version_name = 'xp';
			}
			break;
			
		case 'darwin':
			var userAgent = myServices.hph.userAgent;
			//console.info('userAgent:', userAgent);
			var version_osx = userAgent.match(/Mac OS X 10\.([\d\.]+)/);
			//console.info('version_osx matched:', version_osx);
			
			if (!version_osx) {
				throw new Error('Could not identify Mac OS X version.');
			} else {
				var version_osx_str = version_osx[1];
				var ints_split = version_osx[1].split('.');
				if (ints_split.length == 1) {
					core.os.version = parseInt(ints_split[0]);
				} else if (ints_split.length >= 2) {
					core.os.version = ints_split[0] + '.' + ints_split[1];
					if (ints_split.length > 2) {
						core.os.version += ints_split.slice(2).join('');
					}
					core.os.version = parseFloat(core.os.version);
				}
				// this makes it so that 10.10.0 becomes 10.100
				// 10.10.1 => 10.101
				// so can compare numerically, as 10.100 is less then 10.101
				
				//core.os.version = 6.9; // note: debug: temporarily forcing mac to be 10.6 so we can test kqueue
			}
			break;
		default:
			// nothing special
	}
	
	core.os.toolkit = Services.appinfo.widgetToolkit.toLowerCase();
	core.os.xpcomabi = Services.appinfo.XPCOMABI;
	
	core.firefox = {};
	core.firefox.version = Services.appinfo.version;
	
	console.log('done adding to core, it is now:', core);
}
//start obs stuff
var observers = {
	'iframe-body-height': { // this trick detects actual load of iframe from bootstrap scope
		observe: function (aSubject, aTopic, aData) {
			obsHandler_iframeBodyHeight(aSubject, aTopic, aData);
		},
		reg: function () {
			Services.obs.addObserver(observers['iframe-body-height'], core.addon.id + '_iframe-body-height', false);
		},
		unreg: function () {
			Services.obs.removeObserver(observers['iframe-body-height'], core.addon.id + '_iframe-body-height');
		}
	}
};
//end obs stuff

// START - Addon Functionalities
// start - observer handler - inline-options-shown
function obsHandler_iframeBodyHeight(aSubject, aTopic, aData) {
	
	console.error('in obsHandler_iframeBodyHeight', 'aSubject:', aSubject, 'aTopic:', aTopic, 'aData:', aData, 'panelview_onViewShowing_load:', panelview_onViewShowing_load);
	
	if (aData != 0) {
		// its a real (re)load while panel is showing, not the initial load on panel create
		panelview_onViewShowing_load.style.height = aData + 'px';
		iframe_onViewShowing_load.style.height = aData + 'px';
	}
	
	panelview_onViewShowing_load = null;
	iframe_onViewShowing_load = null;
	
}
// end - observer handler - inline-options-shown

/*start - windowlistener*/
var windowListener = {
	//DO NOT EDIT HERE
	onOpenWindow: function (aXULWindow) {
		// Wait for the window to finish loading
		let aDOMWindow = aXULWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
		aDOMWindow.addEventListener('load', function () {
			aDOMWindow.removeEventListener('load', arguments.callee, false);
			windowListener.loadIntoWindow(aDOMWindow);
		}, false);
	},
	onCloseWindow: function (aXULWindow) {},
	onWindowTitleChange: function (aXULWindow, aNewTitle) {},
	register: function () {
		
		// Load into any existing windows
		let DOMWindows = Services.wm.getEnumerator(null);
		while (DOMWindows.hasMoreElements()) {
			let aDOMWindow = DOMWindows.getNext();
			if (aDOMWindow.document.readyState == 'complete') { //on startup `aDOMWindow.document.readyState` is `uninitialized`
				windowListener.loadIntoWindow(aDOMWindow);
			} else {
				aDOMWindow.addEventListener('load', function () {
					aDOMWindow.removeEventListener('load', arguments.callee, false);
					windowListener.loadIntoWindow(aDOMWindow);
				}, false);
			}
		}
		// Listen to new windows
		Services.wm.addListener(windowListener);
	},
	unregister: function () {
		// Unload from any existing windows
		let DOMWindows = Services.wm.getEnumerator(null);
		while (DOMWindows.hasMoreElements()) {
			let aDOMWindow = DOMWindows.getNext();
			windowListener.unloadFromWindow(aDOMWindow);
		}
		
		//Stop listening so future added windows dont get this attached
		Services.wm.removeListener(windowListener);
	},
	//END - DO NOT EDIT HERE
	loadIntoWindow: function (aDOMWindow) {
		if (!aDOMWindow) {
			return;
		}
		
		if (aDOMWindow.gBrowser) {
			var domWinUtils = aDOMWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
			domWinUtils.loadSheet(cui_cssUri, domWinUtils.AUTHOR_SHEET);
		}
	},
	unloadFromWindow: function (aDOMWindow) {
		if (!aDOMWindow) {
			return;
		}
		
		if (aDOMWindow.gBrowser) {
			var domWinUtils = aDOMWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
			domWinUtils.removeSheet(cui_cssUri, domWinUtils.AUTHOR_SHEET);
			
			var panel = aDOMWindow.document.getElementById('cashback-view-panel');
			if (panel){
				panel.parentNode.removeChild(panel);
				console.error('succesfully removed panel')
			}
		}
	}
};
/*end - windowlistener*/
// END - Addon Functionalities

function install() {}
function uninstall() {}

function startup(aData, aReason) {
	//core.addon.aData = aData;
	extendCore();

	CustomizableUI.createWidget({
		id: 'cui_cashback',
		type: 'view',
		viewId : 'cashback-view-panel',
		defaultArea: CustomizableUI.AREA_NAVBAR,
		label: myServices.sb.GetStringFromName('cui_cashback_lbl'),
		tooltiptext: myServices.sb.GetStringFromName('cui_cashback_tip'),
		/*
		onCommand: function(aEvent) {
			var aDOMWin = aEvent.target.ownerDocument.defaultView;
			
		},
		*/
		onBeforeCreated: function(aDoc) {
			var aDOMWin = aDoc.defaultView;
			
			var doc = aDOMWin.document;
			var panel = doc.createElementNS(NS_XUL, 'panelview');
			var iframe = doc.createElementNS(NS_HTML, 'iframe');
			 
			panel.setAttribute('id', 'cashback-view-panel');
			panel.addEventListener('popuphiding', function(e) {
				e.stopPropagation();
				e.preventDefault();
				e.returnValue = false;
				return false;
			}, false);
			
			iframe.setAttribute('id', 'cashback-view-iframe');
			iframe.setAttribute('type', 'content');
			iframe.setAttribute('src', core.addon.path.content + 'view.xhtml');
			iframe.setAttribute('style', 'border:0;');
			 
			panel.appendChild(iframe);
			doc.getElementById('PanelUI-multiView').appendChild(panel);
			
		},
		onViewShowing: function(aEvent) {
			console.log('view showing baby');
			// since the panelview node is moved and the iframe is reset in some
			// cases, this hack ensures that the code runs once the iframe is
			// valid.
			panelview_onViewShowing_load = aEvent.target;
			iframe_onViewShowing_load = panelview_onViewShowing_load.childNodes[0];
			
			var timer = Cc['@mozilla.org/timer;1'].createInstance(Ci.nsITimer);
			timer.initWithCallback({
				notify: function() {
					var aDOMWin = aEvent.target.ownerDocument.defaultView;
					var aPanelView = aEvent.target;
					var aIFrame = aPanelView.childNodes[0];
					//console.info('aDOMWin.wrappedJSObject.getBodyHeight:', aIFrame.contentWindow.wrappedJSObject.getBodyHeight);
					//var bodyHeight = aIFrame.contentWindow.wrappedJSObject.getBodyHeight();
					//console.info('extern got bodyHeight:', bodyHeight);
					/*
					var promise_updateScores = xhr('http://www.bing.com/', {
						aTimeout: 10000,
						aResponseType: 'text'
					});
					promise_updateScores.then(
						function(aVal) {
							console.log('Fullfilled - promise_updateScores - ', aVal);
							// start - do stuff here - promise_updateScores
							aDOMWin.document.getElementById('cashback-view-iframe').contentDocument.body.textContent = 'xhr succesful!';
							// end - do stuff here - promise_updateScores
						},
						function(aReason) {
							var rejObj = {name:'promise_updateScores', aReason:aReason};
							console.warn('Rejected - promise_updateScores - ', rejObj);
							Services.prompt.alert(aDOMWin, myServices.sb.GetStringFromName('fetch_fail_title'), myServices.sb.formatStringFromName('fetch_fail_msg', [aReason.aReason], 1));
						}
					).catch(
						function(aCaught) {
							var rejObj = {name:'promise_updateScores', aCaught:aCaught};
							console.error('Caught - promise_updateScores - ', rejObj);
							Services.prompt.alert(aDOMWin, myServices.sb.GetStringFromName('fetch_devfail_title'), myServices.sb.GetStringFromName('fetch_devfail_msg'));
						}
					);
					*/
				}
			}, 1000, Ci.nsITimer.TYPE_ONE_SHOT);
		},
		onViewHiding: function(aEvent) {
			console.log('view now hiding');
			var aDOMWin = aEvent.target.ownerDocument.defaultView;
			aDOMWin.document.getElementById('cashback-view-iframe').contentDocument.body.textContent = 'panel closed';
		}
	});
	
	//start observers stuff more
	for (var o in observers) {
		observers[o].reg();
	}
	//end observers stuff more
	
	windowListener.register();
}

function shutdown(aData, aReason) {
	if (aReason == APP_SHUTDOWN) { return }

	//start observers stuff more
	for (var o in observers) {
		observers[o].unreg();
	}
	//end observers stuff more
	
	CustomizableUI.destroyWidget('cui_cashback');
	
	windowListener.unregister();
}

// start - common helper functions
// end - common helper functions