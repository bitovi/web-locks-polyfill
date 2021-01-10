import makeLocksRequest from "./make-locks-request.js";
import crossTabDebugger from "./cross-tab-debugger.js"

const request = makeLocksRequest({storage: localStorage, memorySafe: false, crossTabDebugger: crossTabDebugger()});
if(!navigator.locks) {
  navigator.locks = {
    request,
    get query(){
      throw new Error("navigator.locks.query is not implemented by this polyfill ... yet!")
    }
  };
} else {
    navigator.locks.request = request;
    navigator.locks.query = function(){
      throw new Error("navigator.locks.query is not implemented by this polyfill ... yet!");
    }
}
