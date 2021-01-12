function makeIframe({
  loaded = ()=>{},
  unloaded = ()=>{},
  aquired = ()=>{},
  requestResolved = ()=>{},
  requestRejected = ()=>{}
}) {
  var iframe = document.createElement("iframe");
  const locks =  new Map();
  iframe.srcdoc = `
    <!DOCTYPE html>
    <body>
    <script type="module">
     import "./test/harness.js"
    </script>
    </body>
  `;
  document.body.appendChild(iframe);

  function listener(ev){

    const event = JSON.parse(ev.data);
    const lockId = event.lockId;
    const actions = {
      "lock-aquired": function(){
        aquired(event);
        if( locks.get(event.lockId) ) {
          locks.get(event.lockId).callback().then(
            (value)=> callbacks.resolveLock({lockId, value}),
            (reason)=> callbacks.rejectLock({lockId, reason})
          )
        }
      },
      "lock-request-resolved": function(){
        requestResolved(event);
        if(locks.get(event.lockId)) {
          locks.get(event.lockId).resolve(event.value)
        }
      },
      "lock-request-rejected": function(){
        requestRejected(event);
        if(locks.get(event.lockId)) {
          locks.get(event.lockId).reject(event.reason)
        }
      },
      "client-load": function(){
        loaded(event);
      },
      "client-unload": function(){
        unloaded(event);
      }
    };
    if(actions[event.type]) {
      actions[event.type]();
    }

  }
  window.addEventListener("message", listener);

  function sendToFrame(event) {
    if(iframe.contentWindow) {
      iframe.contentWindow.postMessage(JSON.stringify(event));
    }
  }


  var lockIdCounter = 0;
  const callbacks = {
    runLock({lockId}){
      sendToFrame({type: "run-lock", lockId});
    },
    resolveLock({lockId, value}){
      sendToFrame({type: "resolve-lock", lockId, value});
    },
    rejectLock({lockId, reject}){
      sendToFrame({type: "reject-lock", lockId, reject});
    },
    request(name, callback) {

      var lockId = lockIdCounter++;
      const lockRequest = {
        lockId,
        callback
      };
      locks.set(lockId, lockRequest);
      callbacks.runLock({lockId});

      return new Promise((resolve, reject)=>{
        lockRequest.resolve = resolve;
        lockRequest.reject = reject;
      })
    },
    iframe
  };
  return callbacks;
}

export default function(ready = ()=>{}){
  return new Promise((resolve, rejected) => {
    var locks = makeIframe({
      loaded(){
        function teardown(){
          document.body.removeChild(locks.iframe)
        }
        ready(locks.request, teardown);
        resolve({request: locks.request, teardown});
      }
    });
  })
}
