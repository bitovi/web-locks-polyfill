import "../web-locks-overwrite.js";


function makeid(length) {
  return (""+Math.random()).substr(2)
}
const clientId = makeid();
let lockIdCounter = 0;
const locks = new Map();

function sendToParent(event) {
  window.parent.postMessage(JSON.stringify({clientId, ...event}));
}

window.onload = function(){
  sendToParent({type: "client-load"});
}

window.onbeforeunloaded = function(){
  sendToParent({type: "client-unload"});
}

window.addEventListener("message", function(ev){
  const event = JSON.parse(ev.data);

  if(event.type === "run-lock") {
    runLock(event);
  }
  else if(event.type === "resolve-lock") {
    locks.get(event.lockId).resolve(event.value);
  }
  else if(event.type === "reject-lock") {
    locks.get(event.lockId).reject(event.reason);
  }
});



function runLock({requestName = "lock", lockId}){

  if(lockId == undefined) {
    throw new Error("lock id");
  }

  var lock = {
    id: lockId
  };
  locks.set(lockId, lock);
  var p = new Promise( (request, reject) => {
    lock.resolve = request;
    lock.reject = reject;
  })

  sendToParent({type: "lock-requested", lockId});

  navigator.locks.request(requestName, function(){
    sendToParent({type: "lock-aquired", lockId});

    return p;
  }).then((value)=> {
    sendToParent({type: "lock-request-resolved", value, lockId});
    locks.delete(lockId, lock);
  }, (reason)=> {
    sendToParent({type: "lock-request-rejected", reason, lockId});
    locks.delete(lockId, lock);
  })
}
