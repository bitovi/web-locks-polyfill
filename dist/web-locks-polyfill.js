/*[process-shim]*/
(function(global, env) {
	// jshint ignore:line
	if (typeof process === "undefined") {
		global.process = {
			argv: [],
			cwd: function() {
				return "";
			},
			browser: true,
			env: {
				NODE_ENV: env || "development"
			},
			version: "",
			platform:
				global.navigator &&
				global.navigator.userAgent &&
				/Windows/.test(global.navigator.userAgent)
					? "win"
					: ""
		};
	}
})(
	typeof self == "object" && self.Object == Object
		? self
		: typeof process === "object" &&
		  Object.prototype.toString.call(process) === "[object process]"
			? global
			: window,
	"development"
);

/*[global-shim-start]*/
(function(exports, global, doEval) {
	// jshint ignore:line
	var origDefine = global.define;

	var get = function(name) {
		var parts = name.split("."),
			cur = global,
			i;
		for (i = 0; i < parts.length; i++) {
			if (!cur) {
				break;
			}
			cur = cur[parts[i]];
		}
		return cur;
	};
	var set = function(name, val) {
		var parts = name.split("."),
			cur = global,
			i,
			part,
			next;
		for (i = 0; i < parts.length - 1; i++) {
			part = parts[i];
			next = cur[part];
			if (!next) {
				next = cur[part] = {};
			}
			cur = next;
		}
		part = parts[parts.length - 1];
		cur[part] = val;
	};
	var useDefault = function(mod) {
		if (!mod || !mod.__esModule) return false;
		var esProps = { __esModule: true, default: true };
		for (var p in mod) {
			if (!esProps[p]) return false;
		}
		return true;
	};

	var hasCjsDependencies = function(deps) {
		return (
			deps[0] === "require" && deps[1] === "exports" && deps[2] === "module"
		);
	};

	var modules =
		(global.define && global.define.modules) ||
		(global._define && global._define.modules) ||
		{};
	var ourDefine = (global.define = function(moduleName, deps, callback) {
		var module;
		if (typeof deps === "function") {
			callback = deps;
			deps = [];
		}
		var args = [],
			i;
		for (i = 0; i < deps.length; i++) {
			args.push(
				exports[deps[i]]
					? get(exports[deps[i]])
					: modules[deps[i]] || get(deps[i])
			);
		}
		// CJS has no dependencies but 3 callback arguments
		if (hasCjsDependencies(deps) || (!deps.length && callback.length)) {
			module = { exports: {} };
			args[0] = function(name) {
				return exports[name] ? get(exports[name]) : modules[name];
			};
			args[1] = module.exports;
			args[2] = module;
		}
		// Babel uses the exports and module object.
		else if (!args[0] && deps[0] === "exports") {
			module = { exports: {} };
			args[0] = module.exports;
			if (deps[1] === "module") {
				args[1] = module;
			}
		} else if (!args[0] && deps[0] === "module") {
			args[0] = { id: moduleName };
		}

		global.define = origDefine;
		var result = callback ? callback.apply(null, args) : undefined;
		global.define = ourDefine;

		// Favor CJS module.exports over the return value
		result = module && module.exports ? module.exports : result;
		modules[moduleName] = result;

		// Set global exports
		var globalExport = exports[moduleName];
		if (globalExport && !get(globalExport)) {
			if (useDefault(result)) {
				result = result["default"];
			}
			set(globalExport, result);
		}
	});
	global.define.orig = origDefine;
	global.define.modules = modules;
	global.define.amd = true;
	ourDefine("@loader", [], function() {
		// shim for @@global-helpers
		var noop = function() {};
		return {
			get: function() {
				return { prepareGlobal: noop, retrieveGlobal: noop };
			},
			global: global,
			__exec: function(__load) {
				doEval(__load.source, global);
			}
		};
	});
})(
	{},
	typeof self == "object" && self.Object == Object
		? self
		: typeof process === "object" &&
		  Object.prototype.toString.call(process) === "[object process]"
			? global
			: window,
	function(__$source__, __$global__) {
		// jshint ignore:line
		eval("(function() { " + __$source__ + " \n }).call(__$global__);");
	}
);

/*web-locks-polyfill@0.0.12#make-locks-request*/
define('web-locks-polyfill/make-locks-request', ['exports'], function (exports) {
    'use strict';
    Object.defineProperty(exports, '__esModule', { value: true });
    exports.default = makeLocksRequest;
    var _slicedToArray = function () {
        function sliceIterator(arr, i) {
            var _arr = [];
            var _n = true;
            var _d = false;
            var _e = undefined;
            try {
                for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
                    _arr.push(_s.value);
                    if (i && _arr.length === i)
                        break;
                }
            } catch (err) {
                _d = true;
                _e = err;
            } finally {
                try {
                    if (!_n && _i['return'])
                        _i['return']();
                } finally {
                    if (_d)
                        throw _e;
                }
            }
            return _arr;
        }
        return function (arr, i) {
            if (Array.isArray(arr)) {
                return arr;
            } else if (Symbol.iterator in Object(arr)) {
                return sliceIterator(arr, i);
            } else {
                throw new TypeError('Invalid attempt to destructure non-iterable instance');
            }
        };
    }();
    var COMPLETED_STATES = {
        'unexpected-state': true,
        'timed-out': true,
        'unlocked': true
    };
    function makeLocksRequest(_ref) {
        var _ref$storage = _ref.storage, storage = _ref$storage === undefined ? window.localStorage : _ref$storage, _ref$outerPrefix = _ref.outerPrefix, outerPrefix = _ref$outerPrefix === undefined ? '_MUT_OUT_LOCK_' : _ref$outerPrefix, _ref$innerPrefix = _ref.innerPrefix, innerPrefix = _ref$innerPrefix === undefined ? '_MUT_IN_LOCK_' : _ref$innerPrefix, _ref$tick = _ref.tick, tick = _ref$tick === undefined ? 20 : _ref$tick, _ref$memorySafe = _ref.memorySafe, memorySafe = _ref$memorySafe === undefined ? true : _ref$memorySafe, _ref$lockTimeout = _ref.lockTimeout, lockTimeout = _ref$lockTimeout === undefined ? 2000 : _ref$lockTimeout, _ref$clientId = _ref.clientId, clientId = _ref$clientId === undefined ? makeid(10) : _ref$clientId, _ref$crossTabDebugger = _ref.crossTabDebugger, crossTabDebugger = _ref$crossTabDebugger === undefined ? makeFakeCrossTabDebugger() : _ref$crossTabDebugger;
        debug('clientId', clientId);
        var lockRequestsByKey = new Map();
        var lockRequestCounter = 0;
        var timer = void 0;
        var exited = false;
        crossTabDebugger.onexit = function () {
            clearTimeout(timer);
            exited = true;
            debug('exited');
        };
        crossTabDebugger.clientId = clientId;
        function removeItem(key) {
            storage.removeItem(key);
        }
        function setItem(key, value) {
            storage.setItem(key, JSON.stringify({
                expiresAt: new Date().getTime() + lockTimeout,
                value: value
            }));
        }
        function getItem(key) {
            var item = storage.getItem(key);
            if (!item)
                return null;
            var parsed = JSON.parse(item);
            if (new Date().getTime() - parsed.expiresAt >= lockTimeout) {
                crossTabDebugger.expiring(item);
                return null;
            }
            return parsed.value;
        }
        function progressAllLocksStates() {
            var now = new Date().getTime();
            var _iteratorNormalCompletion = true;
            var _didIteratorError = false;
            var _iteratorError = undefined;
            try {
                for (var _iterator = lockRequestsByKey[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                    var _step$value = _slicedToArray(_step.value, 2), key = _step$value[0], lockRequestsForKey = _step$value[1];
                    progressKeyLocksStates(lockRequestsForKey, now);
                    if (lockRequestsForKey.lockRequests.length === 0) {
                        lockRequestsByKey.delete(key);
                    }
                }
            } catch (err) {
                _didIteratorError = true;
                _iteratorError = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion && _iterator.return) {
                        _iterator.return();
                    }
                } finally {
                    if (_didIteratorError) {
                        throw _iteratorError;
                    }
                }
            }
            if (lockRequestsByKey.size) {
                timer = setTimeout(progressAllLocksStates, tick);
            } else {
            }
        }
        function progressKeyLocksStates(lockRequestsForKey, now) {
            var firstLockRequest = void 0;
            while (firstLockRequest = lockRequestsForKey.lockRequests[0]) {
                var resultingState = progressLockState(firstLockRequest, now);
                if (COMPLETED_STATES[resultingState] === true) {
                    lockRequestsForKey.lockRequests.shift();
                } else {
                    break;
                }
            }
        }
        function progressLockState(lockRequest, now) {
            if (lockRequest.waitUntil && now < lockRequest.waitUntil) {
            } else if (lockRequest.state === 'requested' || lockRequest.state === 'set-outer') {
                setItem(lockRequest.outerKey, lockRequest.id);
                var innerOwner = getItem(lockRequest.innerKey);
                if (innerOwner && innerOwner !== lockRequest.id) {
                    innerKeyAlreadyOwned(lockRequest, now, innerOwner);
                } else {
                    setItem(lockRequest.innerKey, lockRequest.id);
                    lockRequest.state = 'set-inner';
                    debug(lockRequest.id, 'set innerKey. InnerKey was', innerOwner);
                }
            } else if (lockRequest.state === 'set-inner') {
                var outerOwner = getItem(lockRequest.outerKey);
                if (outerOwner !== lockRequest.id) {
                    outerKeyAlreadyOwned(lockRequest, now, outerOwner);
                } else {
                    var taskPromise = grantLockRequest(lockRequest, now), releaseFulfilledTask = makeReleaseFulfilledTask(lockRequest), releaseRejectedTask = makeReleaseRejectedTask(lockRequest);
                    taskPromise.then(releaseFulfilledTask, releaseRejectedTask);
                }
            } else if (lockRequest.state === 'locked') {
                setItem(lockRequest.innerKey, lockRequest.id);
            } else if (COMPLETED_STATES[lockRequest.state] === true) {
            } else {
                debug(lockRequest.id, 'unexpected-state', lockRequest.state);
                lockRequest.reject(new Error('Unexpected state ' + lockRequest.state));
                lockRequest.state = 'unexpected-state';
            }
            return lockRequest.state;
        }
        function outerKeyAlreadyOwned(lockRequest, now, outerOwner) {
            lockRequest.outerKeyAlreadyOwned++;
            lockRequest.state = 'requested';
            if (lockRequest.outerKeyAlreadyOwned > 1) {
                var backoffUnits = Math.random() * lockRequest.outerKeyAlreadyOwned;
                debug(lockRequest.id, 'outerKeyAlreadyOwned backing off. Owned by', outerOwner);
                lockRequest.waitUntil = now + tick * backoffUnits;
            } else {
                debug(lockRequest.id, 'outerKeyAlreadyOwned. Owned by', outerOwner);
            }
        }
        function innerKeyAlreadyOwned(lockRequest, now, innerOwner) {
            lockRequest.state = 'set-outer';
            lockRequest.innerKeyAlreadyOwned++;
            if (lockRequest.innerKeyAlreadyOwned > 1) {
                var backoffUnits = Math.random() * lockRequest.innerKeyAlreadyOwned;
                debug(lockRequest.id, 'innerKeyAlreadyOwned backing off. Owned by', innerOwner);
                lockRequest.waitUntil = now + tick * backoffUnits;
            } else {
                debug(lockRequest.id, 'innerKeyAlreadyOwned. Owned by', innerOwner);
            }
        }
        function grantLockRequest(lockRequest, now) {
            debug(lockRequest.id, 'locked');
            lockRequest.state = 'locked';
            crossTabDebugger.onlock(lockRequest.id);
            return lockRequest.callback();
        }
        function makeReleaseFulfilledTask(lockRequest) {
            return function releaseFulfilledTask(value) {
                debug(lockRequest.id, 'unlocked');
                crossTabDebugger.onunlock(lockRequest.id);
                if (!COMPLETED_STATES[lockRequest.state]) {
                    lockRequest.state = 'unlocked';
                    removeItem(lockRequest.innerKey);
                    lockRequest.resolve(value);
                }
            };
        }
        function makeReleaseRejectedTask(lockRequest) {
            return function releaseRejectedTask(reason) {
                debug(lockRequest.id, 'unlocked-error');
                crossTabDebugger.onunlock();
                if (!COMPLETED_STATES[lockRequest.state]) {
                    removeItem(lockRequest.innerKey);
                    lockRequest.state = 'unlocked';
                    lockRequest.reject(reason);
                }
            };
        }
        if (memorySafe === false) {
            var cleanUpOnUnload = function cleanUpOnUnload() {
                if (!onBeforeUnLoadEvent) {
                    onBeforeUnLoadEvent = true;
                }
                clearTimeout(timer);
                var _iteratorNormalCompletion2 = true;
                var _didIteratorError2 = false;
                var _iteratorError2 = undefined;
                try {
                    for (var _iterator2 = lockRequestsByKey[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                        var _step2$value = _slicedToArray(_step2.value, 2), key = _step2$value[0], lockRequestsForKey = _step2$value[1];
                        var _iteratorNormalCompletion3 = true;
                        var _didIteratorError3 = false;
                        var _iteratorError3 = undefined;
                        try {
                            for (var _iterator3 = lockRequestsForKey.lockRequests[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                                var lockRequest = _step3.value;
                                if (lockRequest.state === 'locked') {
                                    debug(lockRequest.id, 'deleting innerKey on unload');
                                    removeItem(lockRequest.innerKey);
                                }
                            }
                        } catch (err) {
                            _didIteratorError3 = true;
                            _iteratorError3 = err;
                        } finally {
                            try {
                                if (!_iteratorNormalCompletion3 && _iterator3.return) {
                                    _iterator3.return();
                                }
                            } finally {
                                if (_didIteratorError3) {
                                    throw _iteratorError3;
                                }
                            }
                        }
                    }
                } catch (err) {
                    _didIteratorError2 = true;
                    _iteratorError2 = err;
                } finally {
                    try {
                        if (!_iteratorNormalCompletion2 && _iterator2.return) {
                            _iterator2.return();
                        }
                    } finally {
                        if (_didIteratorError2) {
                            throw _iteratorError2;
                        }
                    }
                }
            };
            var onBeforeUnLoadEvent = void 0;
            window.addEventListener('unload', cleanUpOnUnload);
            window.addEventListener('beforeunload', cleanUpOnUnload);
        }
        return function request(key, options, callback) {
            if (exited) {
                return;
            }
            if (arguments.length === 2) {
                callback = options;
                options = {};
            }
            lockRequestCounter++;
            var lockRequest = {
                lockNumber: lockRequestCounter,
                id: clientId + ':' + lockRequestCounter,
                key: key,
                outerKey: outerPrefix + key,
                innerKey: innerPrefix + key,
                callback: callback,
                state: 'requested',
                outerKeyAlreadyOwned: 0,
                innerKeyAlreadyOwned: 0,
                waitUntil: 0
            };
            var lockPromise = new Promise(function (resolve, reject) {
                lockRequest.reject = reject;
                lockRequest.resolve = resolve;
            });
            var firstLock = false;
            if (lockRequestsByKey.size === 0) {
                firstLock = true;
            }
            if (!lockRequestsByKey.has(key)) {
                lockRequestsByKey.set(key, {
                    key: key,
                    lockRequests: []
                });
            }
            lockRequestsByKey.get(key).lockRequests.push(lockRequest);
            if (firstLock) {
                progressAllLocksStates();
            }
            return lockPromise;
        };
    }
    function debug() {
        if (false) {
            console.log.apply(console, ['' + new Date().getTime()].concat(Array.prototype.slice.call(arguments)));
        }
    }
    function makeid(length) {
        return ('' + Math.random()).substr(2);
    }
    function makeFakeCrossTabDebugger() {
        return {
            onlock: function onlock() {
            },
            onunlock: function onunlock() {
            },
            expiring: function expiring() {
            }
        };
    }
});
/*web-locks-polyfill@0.0.12#web-locks-polyfill*/
define('web-locks-polyfill', ['web-locks-polyfill/make-locks-request'], function (_makeLocksRequest) {
    'use strict';
    var _makeLocksRequest2 = _interopRequireDefault(_makeLocksRequest);
    function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : { default: obj };
    }
    if (typeof navigator !== 'undefined' && !navigator.locks) {
        navigator.locks = {
            request: (0, _makeLocksRequest2.default)({
                storage: localStorage,
                memorySafe: false
            }),
            get query() {
                throw new Error('navigator.locks.query is not implemented by this polyfill ... yet!');
            }
        };
    }
});
/*[global-shim-end]*/
(function(global) { // jshint ignore:line
	global._define = global.define;
	global.define = global.define.orig;
}
)(typeof self == "object" && self.Object == Object ? self : (typeof process === "object" && Object.prototype.toString.call(process) === "[object process]") ? global : window);