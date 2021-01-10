
//deleteAllCookies();
function setCookieStore(key, value, timeout){
  document.cookie = key+"="+JSON.stringify({
    expiresAt: new Date().getTime() + timeout,
    value
  });
}
function removeCookieItem(key) {
  document.cookie = key+"=";
}
function getCookieStore(key, timeout, clientId) {

  const parsed = JSON.parse(item);
  if (new Date().getTime() - parsed.expiresAt >= timeout) {
    console.log('FastMutex client "%s" removed an expired record on "%s"', clientId, key);
    document.cookie = key+"=";
    return null;
  }

  return parsed.value;
}

function debug(){
  if(true) {
    console.log.apply(console, arguments);
  }
}

class LockManagerPollyfill {
  constructor({ localStorageName, checkInterval, timeout = 5000, clientId } = {}){
    this._waitingFor = new Set();
    this._localStorageName = localStorageName || "web-lock-polyfill";
    this._checkInterval = checkInterval || 100;
    //this._checkForReleased = this._checkForReleased.bind(this);
    this._mutex = new FastMutex({cleanupOnUnload: true, timeout, clientId});
  }
  request(name, options, callback) {
    if(arguments.length === 2) {
      callback = options;
      options = {};
    }
    const defaultedOptions = {
      mode: "exclusive",
      ifAvailable: false,
      steal: false,
      ...options
    }
    const request = {name, callback};
    const requestGranted = new Promise((resolve, reject)=>{
      request.resolve = resolve;
      request.reject = reject;
    });

    this._mutex.lock(request.name, options.number).then(()=>{
      request.callback().then( (value)=> {
        request.resolve(value);
        this._mutex.release(name);
      });
    }, (reason)=>{
      request.reject(reason);
      this._mutex.release(name);
    })

    return requestGranted;
  }
  __checkForReleased(){
    const sharedData = JSON.parse( localStorage.getItem(this._localStorageName) ) || {};
    // what if items get added
    for(let request of this._waitingFor) {
      if(sharedData[request.name] == null || sharedData[request.name] === "released") {

        sharedData[request.name] = "locked";

        localStorage.setItem(this._localStorageName, JSON.stringify(sharedData));

        this._waitingFor.delete(request);

        // must setup some sort of date checker here
        // if the date checker is "stale" .. assume the browser closed and
        // it's released ...
        // also ... we should read the whole object everytime we are about to write it
        // if we have any sort of async behavior ...

        request.callback().then((value)=>{
          sharedData[request.name] = "released";
          localStorage.setItem(this._localStorageName, JSON.stringify(sharedData));
          request.resolve(value);
        }, (reason) => {
          sharedData[request.name] = "released";
          localStorage.setItem(this._localStorageName, JSON.stringify(sharedData));
          request.reject(reason);
        });
        break;
      }
    }
    if(this._waitingFor.size !== 0) {
      this.timeout = setTimeout(this._checkForReleased,this._checkInterval);
    }
  }
  __waitFor(request){
    this._waitingFor.add(request);
    if(this._waitingFor.size === 1) {
      this.timeout = setTimeout(this._checkForReleased,this._checkInterval);
    }
  }
}

/*
// how to know all the other active tabs?
localStorage.setItem("client-thing-random", "clientId")

// how to know the write -> read/write -> read performance

localStorage.setItem("test-performance",{
  source: clientId,
  updater: clientId,
  startValue: 0,
  currentValue: 0
})*/


const randomId = () => Math.random() + '';

class FastMutex {
  static mutexes = new Set();
  static unload(){
    for(let mutex of this.mutexes) {
      debug('Attempting to release any locks using FastMutex instance "%s"', mutex.clientId);
      for(let key of mutex.lockedKeys) {
        mutex.release(key);
      }
    }
  }
  constructor ({ clientId = randomId(), xPrefix = '_MUTEX_LOCK_X_', yPrefix = '_MUTEX_LOCK_Y_', timeout = 5000, localStorage, cleanupOnUnload = false} = {}) {
    console.log("clientId", clientId)
    this.clientId = clientId;
    this.xPrefix = xPrefix;
    this.yPrefix = yPrefix;
    this.timeout = timeout;
    this.localStorage = localStorage || window.localStorage;
    this.lockedKeys = new Set();
    this.lockNumber = 0;
    //this.resetStats();
    if(cleanupOnUnload) {
      this.constructor.mutexes.add(this);
    }
  }

  lock (key) {

    const x = this.xPrefix + key;
    const y = this.yPrefix + key;

    this.lockNumber++;
    const lockStats = {
      lockName: this.clientId+"_"+this.lockNumber,
      restartCount: 0,
      locksLost: 0,
      contentionCount: 0,
      acquireDuration: 0,
      acquireStart: new Date().getTime()
    }
    debug('Lock on "%s" using instance "%s"', key, lockStats.lockName);


    return new Promise((resolve, reject) => {

      // we need to differentiate between API calls to lock() and our internal
      // recursive calls so that we can timeout based on the original lock() and
      // not each subsequent call.  Therefore, create a new function here within
      // the promise closure that we use for subsequent calls:
      const acquireLock = () => {

        // Check if we've run too long. If we have reject the promise.
        const elapsedTime = new Date().getTime() - lockStats.acquireStart;

        if (elapsedTime >= this.timeout) {
          debug('Lock on "%s" could not be acquired within %sms by FastMutex client "%s"', key, this.timeout, this.clientId);
          return reject(new Error(`Lock could not be acquired within ${this.timeout}ms`));
        }


        this.setItem(x, lockStats.lockName);

        // if y exists, another client is (getting or has) a lock, so retry in a bit
        let lsY = this.getItem(y);

        if (lsY) {
          debug('Lock exists on Y (%s), restarting...', lsY);
          lockStats.restartCount++;
          setTimeout(() => acquireLock(key));
          return;
        }

        // ask for inner lock
        this.setItem(y, lockStats.lockName);

        // weirdly ... chrome can read X even though someone else wrote to it ...
        setTimeout(()=>{

          // if x was changed, another client is contending for an inner lock
          let lsX = this.getItem(x);
          if (lsX !== lockStats.lockName) {
            lockStats.contentionCount++;
            debug('Lock contention detected. X="%s"', lsX);
            lockStats.restartCount++;
            setTimeout(() => acquireLock(key));
            return;
            // Give enough time for critical section:
            setTimeout(() => {
              lsY = this.getItem(y);
              if (lsY === lockStats.lockName) {
                // we have a lock
                console.log(key, lsX, lsY, number, "contention");
                debug('Lock "%s" won the lock contention on "%s"', lockStats.lockName, key);
                this.resolveWithStats(resolve, lockStats, key);
              } else {
                // we lost the lock, restart the process again
                lockStats.restartCount++;
                lockStats.locksLost++;
                debug('Lock "%s" lost the lock contention on "%s" to another process (%s). Restarting...', lockStats.lockName, key, lsY);
                setTimeout(() => acquireLock(key));
              }
            }, 100);
            return;
          }

          // no contention:

          debug('Lock "%s" acquired a lock on "%s" with no contention', lockStats.lockName, key);
          this.resolveWithStats(resolve, lockStats, key);

        }, 100);

      };

      acquireLock(key);
    });

  }

  release (key) {
    debug('FastMutex client "%s" is releasing lock on "%s"', this.clientId, key);
    const y = this.yPrefix + key;
    this.removeItem(y);
    this.lockedKeys.delete(key);
    //this.lockStats.lockEnd = new Date().getTime();
    //this.lockStats.lockDuration = this.lockStats.lockEnd - this.lockStats.lockStart;
    //this.resetStats();
  }
  removeItem(key) {
    return removeCookieItem(key);
    this.localStorage.removeItem(key);
  }

  /**
   * Helper function to wrap all values in an object that includes the time (so
   * that we can expire it in the future) and json.stringify's it
   */
  setItem (key, value) {

    return setCookieStore(key, value, this.timeout);

    return this.localStorage.setItem(key, JSON.stringify({
      expiresAt: new Date().getTime() + this.timeout,
      value
    }));
  }

  /**
   * Helper function to parse JSON encoded values set in localStorage
   */
  getItem (key) {
    return getCookieStore(key, this.timeout);

    const item = this.localStorage.getItem(key);
    if (!item) return null;

    const parsed = JSON.parse(item);
    if (new Date().getTime() - parsed.expiresAt >= this.timeout) {
      console.log('FastMutex client "%s" removed an expired record on "%s"', this.clientId, key);
      this.localStorage.removeItem(key);
      return null;
    }

    return JSON.parse(item).value;
  }

  resolveWithStats(resolve, stats, key) {
    this.lockedKeys.add(key);
    const currentTime = new Date().getTime();
    stats.acquireEnd = currentTime;
    stats.acquireDuration = stats.acquireEnd - stats.acquireStart;
    stats.lockStart = currentTime;
    resolve(stats);
  }
}

let onBeforeUnLoadEvent = false;

window.onunload = window.onbeforeunload= function(){
  if( !onBeforeUnLoadEvent ) {
    onBeforeUnLoadEvent = true;
    FastMutex.unload();
  }
};


window.locksPolyfill = new LockManagerPollyfill({timeout: 60000});

//
// Part 1 of a polyfill with huge caveats:
//
// * Requires [SharedWorker support](http://caniuse.com/#feat=sharedworkers)
// * Doesn't handle disconnections (i.e. a tab holding a lock closing)
// * AbortSignal not supported
//
// TODO: Update to new API shape (navigator.locks, acquire method, etc)
//
// This part would be used in a page or worker, and loads the SharedWorker automatically.

(function(global) {
  'use strict';
  let worker = new SharedWorker('polyfill-worker.js'), counter = 0;
  worker.port.start();

  function postAndWaitForResponse(message) {
    return new Promise(resolve => {
      let request_id = ++counter;
      message.request_id = request_id;
      let listener = function(event) {
        if (event.data.request_id !== request_id) return;
        worker.port.removeEventListener(listener);
        let response = event.data;
        delete response.request_id;
        resolve(response);
      };
      worker.port.addEventListener('message', listener);
      worker.port.postMessage(message);
    });
  }

  let secret = Symbol();
  function Lock(s, id, scope, mode, waiting) {
    if (s !== secret) throw TypeError('Illegal constructor');
    this._id = id;
    this._state = 'held';
    this._scope = Object.freeze(scope.sort());
    this._mode = mode;
    this._released_promise = new Promise((resolve, reject) => {
      this._resolve_released_promise = resolve;
      this._reject_released_promise = reject;
    });
    this._addToWaitingPromises(waiting);
  }
  Lock.prototype = {
    get scope() {
      // Returns a frozen array containing the DOMStrings from the
      // associated scope of the lock, in sorted in lexicographic
      // order.
      return this._scope;
    },
    get mode() {
      // Returns a DOMString containing the associated mode of the
      // lock.
      return this._mode;
    },
    get released() {
      // Returns the associated released promise of the lock.
      return this._released_promise;
    },
    waitUntil: function(p) {
      // 1. If waitUntil(p) is called and state is "released", then
      // return Promise.reject(new TypeError)
      if (this._state === 'released')
        return Promise.resolve(new TypeError('Lock is released'));

      // 2. Add p to lock's waiting promise set
      this._addToWaitingPromises(p);

      // 3. Return lock's released promise.
      return this._released_promise;
    },

    _addToWaitingPromises: function(p) {
      p = this._waiting_promises
        ? Promise.all([this._waiting_promises, p])
        : Promise.resolve(p);
      let latest = p.then(
        result => {
          if (latest !== this._latest) return;
          // When every promise in lock's waiting promise set
          // fulfills:

          // 1. set lock's state to "released".
          this._state = 'released';
          worker.port.postMessage({action: 'release', id: this._id});

          // 2. fulfill lock's released promise.
          this._resolve_released_promise();
        },
        reason => {
          if (latest !== this._latest) return;
          // If any promise in lock's waiting promise set rejects:

          // 1. set lock's state to "released".
          this._state = 'released';
          worker.port.postMessage({action: 'release', id: this._id});

          // 2. reject lock's released promise.
          this._reject_released_promise(reason);
        });
      this._latest = latest;
    }
  };

  global.requestLock = function(scope, options) {
    if (arguments.length < 1) throw TypeError('Expected 1 arguments');

    options = Object.assign({}, options);

    // 1. Let scope be the set of unique DOMStrings in scope if a
    // sequence was passed, otherwise a set containing just the string
    // passed as scope
    if (typeof scope === 'object' && Symbol.iterator in scope)
      scope = Array.from(new Set(Array.from(scope).map(i => String(i))));
    else
      scope = [String(scope)];

    // 2. If scope is empty, return a new Promise rejected with TypeError
    if (scope.length === 0)
      return Promise.reject(TypeError(
        'The "scope" argument must not be empty'));

    // 3. Let mode be the value of options.mode
    const mode = String(options.mode);
    if (mode !== 'shared' && mode !== 'exclusive')
      throw TypeError('The "mode" argument must be "shared" or "exclusive"');

    // TODO: options.signal

    // 5. Return the result of running the request a lock algorithm,
    // passing scope, mode and timeout.

    // Algorithm: request a lock

    // 1. Let p be a new promise
    let p = new Promise((resolve, reject) => {
      // 2. Run the following steps in parallel:
      postAndWaitForResponse({
        action: 'request',
        scope: scope,
        mode: mode
      }).then(response => {
        // i. - v. done in worker

        // vi: Let waiting be a new promise.
        let resolve_waiting;
        let waiting = new Promise(r => { resolve_waiting = r; });

        // vii. Let lock be a lock with state "held", mode mode, scope
        // scope, and add waiting to lock's waiting promise set.
        let lock = new Lock(secret, response.id, scope, mode, waiting);

        // viii. Remove request from queue
        // (done in worker)

        // ix. Resolve p with a new Lock object associated with lock
        resolve(lock);

        // x. Schedule a microtask to resolve waiting.
        Promise.resolve().then(resolve_waiting);
      });
    });

    // 3. Return p.
    return p;
  };

}(self));


/*const elapsedTime = now - lockRequest.requestStart;

if (elapsedTime >= timeout) {
  console.log(new Date().getTime(), lockRequest.id, "timed-out!");
  // TODO: clean this up ... organize teardown activities
  if(lockRequest.state === "set-inner" || lockRequest.state === "locked") {
    onunlock(lockRequest.id); // the key is unlocked, so even if fn is running, it's technically not.
    removeItem(lockRequest.innerKey);
  }

  lockRequest.state = "timed-out";
  // this should only happen if we actually held anything ...
  lockRequest.reject(new Error(`Lock could not be acquired within ${timeout}ms`));
}
// if we are rolling back, do nothing
else */
