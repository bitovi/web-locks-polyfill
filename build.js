var stealTools = require("steal-tools");

var globalJS = require("steal-tools/lib/build/helpers/global").js;
var baseNormalize = globalJS.normalize();

stealTools.export({
	steal: {
		config: __dirname + "/package.json!npm",
		main: "web-locks-polyfill",
	},
	outputs: {
		"global core": {
			modules: ["web-locks-polyfill"],
			format: "global",
			dest: __dirname + "/dist/web-locks-polyfill.js",
			removeDevelopmentCode: false,
			useNormalizedDependencies: true,
			//exports: {
			//	"web-locks-polyfill": "reactToWebComponent"
			//},
			normalize: function(depName, depLoad, curName, curLoad, loader){
				return baseNormalize.call(this, depName, depLoad, curName, curLoad, loader, true);
			},
		}
	}
}).catch(function(e){

	setTimeout(function(){
		throw e;
	},1);

});
