import QUnit from "steal-qunit";
import "./web-locks-polyfill";
import makeIframeRequest from "./test/make-iframe-request";


QUnit.module("web-locks-polyfill");




QUnit.test("harness basics", function(assert) {
  const done = assert.async();

  makeIframeRequest((request, teardown)=>{
    const start = new Date();
    request("foo", function(){
      return new Promise((resolve) => setTimeout(()=> resolve("a"), 1000))
    }).then((value)=>{
      assert.equal(value,"a", "resolved value");
      const time = new Date() - start;
      assert.ok(time > 500 && time < 1500, "time right");
      teardown();
      done();
    })
  });

});

QUnit.test("harness basics", function(assert) {
  const done = assert.async();

  makeIframeRequest((request, teardown)=>{
    const start = new Date();
    request("foo", function(){
      return new Promise((resolve) => setTimeout(()=> resolve("a"), 1000))
    }).then((value)=>{
      assert.equal(value,"a", "resolved value");
      const time = new Date() - start;
      assert.ok(time > 500 && time < 1500, "time right");
      teardown();
      done();
    })
  });

});

QUnit.test("rejected unlocks immediately", (assert)=> {
  const done = assert.async();

  Promise.all([
    makeIframeRequest(),
    makeIframeRequest()
  ]).then( ([lock1, lock2])=> {
    var start = new Date();
    lock1.request("bar", function(){
      return new Promise((resolve, reject)=> {
        setTimeout( ()=> reject("bar"),20);
      })
    }).catch(()=>{});

    setTimeout(function(){
      lock2.request("bar", function(){
        var time = new Date() - start;
        assert.ok( time < 1000, "Time must be less than 2 seconds");
        lock1.teardown();
        lock2.teardown();
        done();
        return Promise.resolve();
      })
    },200)
  })
})
