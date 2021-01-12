import QUnit from "steal-qunit";
import "./web-locks-polyfill";


QUnit.module("web-locks-polyfill");




QUnit.test("rejected-unlocks-immediately", function(assert) {

  var iframe = document.createIframe("iframe");
  iframe.srcDoc = `
  <script type="module">
   import "./web-locks-overwrite.js";
   import "./demo.js";
  </script>
  `;

  document.body.append(iframe);
});
