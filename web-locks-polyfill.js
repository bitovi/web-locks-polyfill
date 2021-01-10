import makeLocksRequest from "./make-locks-request.js";

if(!navigator.locks) {
  navigator.locks = {
    request: makeLocksRequest({storage: localStorage, memorySafe: false}),
    get query(){
      throw new Error("navigator.locks.query is not implemented by this polyfill ... yet!")
    }
  };
}
