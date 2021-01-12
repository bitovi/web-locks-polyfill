const TRY_TO_DO_SOMETHING_EVERY_MS = 10000;
const HOW_LONG_DOES_IT_TAKE = 8000;

function doSomething(){
  return new Promise(function(resolve){
    setTimeout(resolve, HOW_LONG_DOES_IT_TAKE);
  })
}

function rounToMSInterval(x){
    return Math.ceil(x/TRY_TO_DO_SOMETHING_EVERY_MS)*TRY_TO_DO_SOMETHING_EVERY_MS;
}
var last = 0;

var counter = 0;

//var request = /*navigator.locks.request ||*/ window.locksPolyfill.request.bind(window.locksPolyfill);

function checkTime(){
  var roundedNow = rounToMSInterval(new Date());
  if(roundedNow - last >= TRY_TO_DO_SOMETHING_EVERY_MS  ) {
    last = roundedNow;
    counter++;
    var myCount = counter;

    //console.log(window.location.pathname, myCount, "REQUESTING" );
    var div = document.createElement("div");
    div.innerHTML = myCount;
    div.style.float = "left";
    div.style.width = "50px"
    div.style.height = "50px";

    document.body.appendChild(div);
    div.style.backgroundColor = "gray";

    navigator.locks.request("my-locker", async function(){
      //console.log(window.location.pathname, myCount, "RUNNING" );
      div.style.backgroundColor = "yellow";

      await doSomething();
      throw "there's a problem";
      //console.log(window.location.pathname, myCount, "COMPLETING" );

    }).then(()=> {
      div.style.backgroundColor = "green";
    },
    (e)=> {
      //console.log(window.location.pathname, myCount, "FAILED" );
      div.style.backgroundColor = "Red"
    });
  }
  setTimeout(checkTime,20);
}
checkTime();
