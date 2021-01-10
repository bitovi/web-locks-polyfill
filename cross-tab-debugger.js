
export default function makeDebugger(){
  if(typeof BroadcastChannel === "undefined") {
    return {onlock(){}, onunlock(){}, expiring(){}}
  }
  let clientId;
  const debuggerData = {
    onlock(lockId){
      var event = {type: "locked", clientId, lockId}
      testChannel.postMessage(JSON.stringify(event));
      handleEvent(event);
    },
    onunlock(){
      var event = {type: "unlocked", clientId};
      testChannel.postMessage(JSON.stringify(event));
      handleEvent(event);
    },
    expiring(data){
      console.log("\nexpiring\n", clientId);
      var event = {type: "expiring", data};
      testChannel.postMessage(JSON.stringify(event));
      handleEvent(event);
    },
    set clientId(cId) {
      clientId = cId;
    }
  };

  const testChannel = new BroadcastChannel('test_channel');
  const clients = new Map();
  let timer;
  // just keep sending we are here as other tabs join
  function keepAlive(){
    testChannel.postMessage(JSON.stringify({type: "add-client", clientId}));
    timer = setTimeout(keepAlive, 3000);
  }
  keepAlive();

  let onBeforeUnLoadEvent;
  function deleteClientOnUnload(){
    if( !onBeforeUnLoadEvent ) {
      onBeforeUnLoadEvent = true;
      testChannel.postMessage(JSON.stringify({type: "delete-client", clientId}));
    }
  }
  window.addEventListener("unload", deleteClientOnUnload);
  window.addEventListener("beforeunload",deleteClientOnUnload );

  let clientLocked;

  testChannel.onmessage = function(ev){
    var event = JSON.parse(ev.data);
    handleEvent(event);
  }

  var doubleLockedTime = 0;
  var lockedCount = 0;
  var doubleLockedStart;

  function handleEvent(event) {
    if(event.type === "add-client") {
      clients.set(event.clientId, {timestamp: new Date()})
    }
    else if(event.type === "delete-client") {
      clients.delete(event.clientId)
      if(clientLocked === event.clientId) {
        clientLocked = null;
      }
    }
    else if(event.type === "exit") {
      debuggerData.onexit();
      clearTimeout(timer);
      document.body.append("double lock!")
    }
    else if(event.type === "locked") {
      //console.log("someone locked", event.clientId);
      lockedCount++;


      if(lockedCount == 2) {
        doubleLockedStart = new Date().getTime();
        console.log(clientLocked,"was locked. now ", event.lockId,"is locked");
      }
      clientLocked = event.lockId;
    }
    else if(event.type === "unlocked") {
      //console.log("someone unlocked");
      clientLocked = null;
      lockedCount--;
      if(lockedCount === 1) {
        var lockedTime = new Date().getTime() - doubleLockedStart;
        doubleLockedTime = doubleLockedTime + lockedTime;
        console.log(" Double lock time: ",new Date().getTime() - doubleLockedStart,".");
        if(lockedTime > 200) {
          var event = {type: "exit", clientId}
          testChannel.postMessage(JSON.stringify(event));
          handleEvent(event);
        }
      }
    }
    else if(event.type === "expiring") {
      console.log(new Date().getTime(), "expiring", event);
    }
  }

  return debuggerData;
}
