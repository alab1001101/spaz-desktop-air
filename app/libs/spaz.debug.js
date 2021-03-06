var Spaz; if (!Spaz) Spaz = {};

/***********
Spaz.Debug
************/
if (!Spaz.Debug) Spaz.Debug = {};

Spaz.Debug.enable = function() {
	Spaz.Prefs.set('debug-enabled', true);
};

Spaz.Debug.disable = function() {
	Spaz.Prefs.set('debug-enabled', false);
};

Spaz.Debug.setEnable = function(state) {
	if (state) {
		Spaz.Debug.enable();
	} else {
		Spaz.Debug.disable();
	}
};

Spaz.Debug.dump = function(msg, type) {
	if ( Spaz.Prefs && Spaz.Prefs.get('debug-enabled') ) {
		
		if (!type) {
			type = 'info';
		}

		if (air.Introspector && air.Introspector.Console && air.Introspector.Console[type]) {
			air.Introspector.Console[type](msg);
		} else {
			sch.dump(msg);
		}
	
		Spaz.Debug.logToFile(msg);
	}
}


Spaz.Debug.logToFile = function(msg) {
	var cr = air.File.lineEnding;
	var file   = air.File.documentsDirectory;
	file       = file.resolvePath("spaz-debug.log");
	var stream = new air.FileStream();
	stream.open(file, air.FileMode.APPEND);
	now = new Date();
	stream.writeUTFBytes(now.toString() + ' : ' + msg + cr);
	stream.close();
}



Spaz.Debug.showProps = function(obj, objName) {
	sch.dump('dumping '+objName);
	var result = "";
	for (var i in obj) {
	   result += objName + "." + i + " = " + obj[i] + "\n";
	}
	sch.dump(result);
}



Spaz.Debug.dumpHTML = function() {
	var docsDir = air.File.documentsDirectory;
	try {
		docsDir.browseForSave("Save HTML As");
		docsDir.addEventListener(air.Event.SELECT, Spaz.Debug.dumpHTMLSelectListener);
	} catch (error) {
		sch.debug("Failed:"+error.message, 'error');
	}
};

Spaz.Debug.dumpHTMLSelectListener = function(event) {
	var newFile = event.target;
	sch.debug('got newFile '+newFile.url);
	
	var html = $('html')[0].outerHTML;
	html = html.replace(/app:\/\//, '');
	html = html.replace(/onclick="Spaz\.UI\.setSelectedTab\(this\)"/, '');
	
	sch.debug('got html '.html);

	var stream = new air.FileStream();
	sch.debug('made stream ');
	stream.open(newFile, air.FileMode.UPDATE);
	sch.debug('opened stream '+newFile.url);
	stream.writeUTFBytes(html);
	sch.debug('write utfbytes '+html);
	stream.close();
	sch.debug('close stream')

}


Spaz.Debug.insertDebugScripts = function() {
	sch.dump("INSERT DEBUGGING SCRIPTS");
	var e = document.createElement("script");
	e.src = "vendors/air/AIRIntrospector.js";
	e.type= "text/javascript";
	document.getElementsByTagName("head")[0].appendChild(e);
	//<base href="app:/"/>
	//<script src="vendors/jquery/jquery-profile.js" type="text/javascript" charset="utf-8"></script>
};