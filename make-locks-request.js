const COMPLETED_STATES = {
  "unexpected-state": true,
  "timed-out": true,
  "unlocked": true
};

// Returns a request function that mimics the `navigator.locks.request` API.
export default function makeLocksRequest( {
  // A cross-tab storage API that will be used to read/write as a form of mutex.
  storage = window.localStorage,
  // The outer lock key prefix used in the storageAPI
  outerPrefix = '_MUT_OUT_LOCK_',
  // The outer lock key prefix used in the storageAPI
  innerPrefix = '_MUT_IN_LOCK_',
  // Once a lock is requested, how many millseconds between checks.
  tick = 20,

  // If false, the request will listen to onbeforeunloaded and onunload
  // in an attempt to clear any locks aquired by the tab.
  memorySafe = true,

  // Lock timeout.
  // This is how long we consider a mutex-key-lock valid for.
  // Even with `memorySafe=false`, it's possible a tab crashes.
  // In this case, we don't want to keep its mutex-key-lock locks forever.
  // Thus, we ignore any mutex-key-locks held for longer than this time.
  // If your application has JS that can prevent other JS from running, you should
  // set this value greater than the maximum task JS execution time.
  // If your JS execution time exceeds this amount, it's possible
  // another lock request will be granted.
  lockTimeout = 2000,

  // A clientId representing this tab.
  clientId = makeid(10),

  // A debugging utility that can combine data across tabs
  crossTabDebugger = makeFakeCrossTabDebugger()
}) {

  debug("clientId", clientId);

  const lockRequestsByKey = new Map();
  let lockRequestCounter = 0;
  let timer;
  let exited = false;

  // This allows the cross-tab debugger to shut down everything.
  crossTabDebugger.onexit = function(){
    clearTimeout(timer);
    exited = true;
    debug("exited");
  };
  crossTabDebugger.clientId = clientId;



  // ========================
  // START HELPERS
  // Helpers used to add / remove to a storage-like API
  // But they include an expiresAt, so they can be automatically ignored
  function removeItem(key) {
    storage.removeItem(key);
  }
  function setItem (key, value) {
    storage.setItem(key, JSON.stringify({
      expiresAt: new Date().getTime() + lockTimeout,
      value
    }))
  }
  function getItem (key) {
    const item = storage.getItem(key);
    if (!item) return null;

    const parsed = JSON.parse(item);
    if (new Date().getTime() - parsed.expiresAt >= lockTimeout) {
      crossTabDebugger.expiring(item);
      return null;
    }
    return parsed.value;
  }

  // ========================
  // START STATE MECHANIC

  //
  // Loops through every key, calls progressKeyLocksStates to progress
  // that key's lockRequest objects.
  // If the key has no more lockRequests, it removes the key.
  // If there are no more lockRequests, it stops calling setTimout.
  function progressAllLocksStates(){
    const  now = new Date().getTime();

    for(const [key, lockRequestsForKey] of lockRequestsByKey) {
      progressKeyLocksStates(lockRequestsForKey, now);

      // if there are no more locks, remove this
      if(lockRequestsForKey.lockRequests.length === 0) {
        lockRequestsByKey.delete(key);
      }
    }
    if(lockRequestsByKey.size) {
      timer = setTimeout(progressAllLocksStates, tick);
    } else {
      //debug("exited");
    }
  }

  // This will take the first lockRequest for a key. It will
  // try to progress the lockRequest's state.
  // If the lockRequest is in a completed state, it will attempt to do the same
  // for the next lockRequest.
  // Only one in-progress lockRequest is handled at a time.
  function progressKeyLocksStates(lockRequestsForKey, now){
    let firstLockRequest;
    //let nextTickTime = 1;
    while( firstLockRequest = lockRequestsForKey.lockRequests[0] ) {
      let resultingState = progressLockState(firstLockRequest, now);

      // if lock request is complete, remove so the next one can try
      if(COMPLETED_STATES[resultingState] === true) {
        lockRequestsForKey.lockRequests.shift();
      } else {
        // otherwise, we only handle on lock per key per timeout
        break;
      }
    }
  }

  // This moves an individual lockRequest to the next state and
  // returns the new state it is in.
  // The main state flow works as follows:
  // - `requested` || `set-outer`
  //   Write to the outer lock, see if the inner lock is free to own.
  //   If inner lock is NOT free, set state to `set-outer`.
  //   If inner lock IS free, set it, set state`set-inner`
  //   - `set-inner`
  //     See if you still own the outer lock.
  //     If you OWN the outer lock, lock the lock request.
  //     If you DONT own the outer lock, set state to `requested`.
  function progressLockState(lockRequest, now){

    // WaitUnil is used to skip ticks. This is part of back-off.
    if( lockRequest.waitUntil && now < lockRequest.waitUntil ) {
      // do nothing
    }
    // If this is a new request, or we set the outerKey without having the innerKey.
    else if(lockRequest.state === "requested" || lockRequest.state === "set-outer"  ) {

      // Attempt to own outerKey.
      setItem(lockRequest.outerKey, lockRequest.id);

      // Check if we can (or already do) own the innerKey.
      let innerOwner = getItem(lockRequest.innerKey);
      if( innerOwner && innerOwner !== lockRequest.id) {
        // If someone else owns the innerKey, we will try again later.
        innerKeyAlreadyOwned(lockRequest, now, innerOwner);
      } else {
        // Set the innerKey, we will see in a moment if our outerKey holds up
        setItem(lockRequest.innerKey, lockRequest.id);
        lockRequest.state = "set-inner";

        debug(lockRequest.id, "set innerKey. InnerKey was", innerOwner );
      }
    }
    // If we have set the innerKey.
    else if( lockRequest.state === "set-inner" ) {

      // Check if we still own the outerKey
      let outerOwner = getItem(lockRequest.outerKey);
      if (outerOwner !== lockRequest.id) {
        // We lost ownership, try everything again in a bit.
        outerKeyAlreadyOwned(lockRequest, now, outerOwner);
      } else {
        // Grant the lock.
        const taskPromise = grantLockRequest(lockRequest, now),
          releaseFulfilledTask = makeReleaseFulfilledTask(lockRequest),
          releaseRejectedTask = makeReleaseRejectedTask(lockRequest);

        // When the callback task is complete, release the lock for the
        // type of task.
        taskPromise.then( releaseFulfilledTask, releaseRejectedTask );
      }
    }
    // If we have granted a lock.
    else if( lockRequest.state === "locked" ) {
      // keep setting the innerKey so it doesn't expire.
      setItem(lockRequest.innerKey, lockRequest.id);
    }
    // If we are in the completed state
    else if( COMPLETED_STATES[lockRequest.state] === true ) {
      // do nothing, `progressKeyLocksStates` will discard this lockRequest
    }
    // UH OH!!!
    else {
      debug(lockRequest.id, "unexpected-state", lockRequest.state);
      lockRequest.reject(new Error(`Unexpected state ${lockRequest.state}`));
      lockRequest.state = "unexpected-state";
    }
    // Return the current state of the lockRequest so `progressKeyLocksStates`
    // can use it to do the right thing.
    return lockRequest.state;
  }

  function outerKeyAlreadyOwned(lockRequest, now, outerOwner) {
    lockRequest.outerKeyAlreadyOwned++;
    lockRequest.state = "requested";
    if(lockRequest.outerKeyAlreadyOwned > 1) {
      // we should back off and check back later ...
      const backoffUnits = Math.random() * lockRequest.outerKeyAlreadyOwned
      debug(lockRequest.id, "outerKeyAlreadyOwned backing off. Owned by",outerOwner);
      lockRequest.waitUntil = now + tick * backoffUnits;
    } else {
      debug(lockRequest.id, "outerKeyAlreadyOwned. Owned by", outerOwner);
    }
  }

  function innerKeyAlreadyOwned(lockRequest, now, innerOwner) {
    lockRequest.state = "set-outer";
    lockRequest.innerKeyAlreadyOwned++;

    if(lockRequest.innerKeyAlreadyOwned > 1) {
      // we should back off and check back later ...
      const backoffUnits = Math.random() * lockRequest.innerKeyAlreadyOwned
      debug(lockRequest.id, "innerKeyAlreadyOwned backing off. Owned by",innerOwner);
      lockRequest.waitUntil = now + tick * backoffUnits;
    } else {
      debug(lockRequest.id, "innerKeyAlreadyOwned. Owned by", innerOwner);
    }
  }

  function grantLockRequest(lockRequest, now){
    debug(lockRequest.id, "locked" );
    // we are the owner, lets go!
    lockRequest.state = "locked";
    crossTabDebugger.onlock(lockRequest.id);
    return lockRequest.callback()
  }

  // Makes a fulfilled function for what happens after the task completes.
  function makeReleaseFulfilledTask(lockRequest) {
    return function releaseFulfilledTask(value) {

      debug(lockRequest.id, "unlocked");
      crossTabDebugger.onunlock(lockRequest.id);
      // if already complete, do nothing
      if(!COMPLETED_STATES[lockRequest.state]) {
        lockRequest.state = "unlocked";
        removeItem(lockRequest.innerKey);
        lockRequest.resolve();
      }
    };
  }
  function makeReleaseRejectedTask(lockRequest) {
    return function releaseRejectedTask(reason) {
      debug(lockRequest.id, "unlocked-error");
      crossTabDebugger.onunlock()
      if(!COMPLETED_STATES[lockRequest.state]) {
        lockRequest.state = "unlocked";
        lockRequest.reject(reason);
      }
    };
  }


  if(memorySafe === false) {
    let onBeforeUnLoadEvent;
    function cleanUpOnUnload(){
      if( !onBeforeUnLoadEvent ) {
        onBeforeUnLoadEvent = true;
      }
      clearTimeout(timer);
      // clear any inner key if held
      for(const [key, lockRequestsForKey] of lockRequestsByKey) {
        for( const lockRequest of lockRequestsForKey.lockRequests) {
          // TODO: should we also remove if state is set-inner?
          if(lockRequest.state === "locked") {
            debug(lockRequest.id, "deleting innerKey on unload");
            removeItem(lockRequest.innerKey);
          }
        }
      }
    }
    window.addEventListener("unload", cleanUpOnUnload);
    window.addEventListener("beforeunload",cleanUpOnUnload );
  }



  return function request(key, options, callback) {
    if(exited) {
      return;
    }
    if(arguments.length === 2) {
      callback = options;
      options = {};
    }

    lockRequestCounter++;

    const lockRequest = {
      lockNumber: lockRequestCounter,
      id: clientId+":"+lockRequestCounter,
      key,
      outerKey: outerPrefix+key,
      innerKey: innerPrefix+ key,
      callback,
      state: "requested",
      outerKeyAlreadyOwned: 0,
      innerKeyAlreadyOwned: 0,
      // this is used to wait extra time to break deadlocks
      waitUntil: 0
    }

    const lockPromise = new Promise(function(resolve, reject){
      lockRequest.reject = reject;
      lockRequest.resolve = resolve;
    });

    let firstLock = false;
    // add to the active collection of requests for this lock
    if(lockRequestsByKey.size === 0) {
      firstLock = true;
    }
    if(!lockRequestsByKey.has(key)) {
      lockRequestsByKey.set(key, {key: key, lockRequests: [] });
    }
    lockRequestsByKey.get(key).lockRequests.push(lockRequest);
    if(firstLock) {
      progressAllLocksStates();
    }

    return lockPromise;
  }
}

function debug(){
  if(true) {
    console.log.apply(console, [""+new Date().getTime(), ...arguments]);
  }
}

function makeid(length) {
  return (""+Math.random()).substr(2)
}

function makeFakeCrossTabDebugger(){
  return {onlock(){}, onunlock(){}, expiring(){}};
}
