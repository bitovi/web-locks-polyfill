# web-locks-polyfill

A partial polyfill for the [web-locks api](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API).

## Limitations

- This does not support an options argument to `navigator.locks.request(name, [options,] callback)`.
  Thus, only the default options are supported.
- `navigator.locks.query` is not currently supported.
- This uses localStorage as a form of lock. By default, it expects these locks to only
  last 2 seconds.  If you have a single JS task on the main window that lasts more than
  2 seconds, it's possible two callbacks can run at the same time.

## Setup

### Quick Setup

To create a `navigator.locks.request` method if none exists in the browser, add the following to your
HTML page:

```html
<script src="https://unpkg.com/web-locks-polyfill/dist/web-locks-polyfill.js"></script>
```

[See a demo of this in action](https://codepen.io/justinbmeyer/pen/gOwdLYM?editors=0010).  Open the
previous link in 2 browser tabs.  You should only see one yellow box at a time. Try it in a browser
that doesn't support web-locks like Safari.

### Setup with NPM

If you are using a module loader, you can install the polyfill with npm like:

```shell
npm install web-locks-polyfill
```

Import the default polyfill like:

```js
import "web-locks-polyfill";
```

## Use


### Basic Use

The primary use is just like the [web-locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API).

Request a lock and do something within the callback like:

```js
navigator.locks.request('my_resource', async lock => {
  // The lock has been acquired.
  await do_something();
  await do_something_else();
  // Now the lock will be released.
});
```

### Changing Default Configuration

You can configure your own request function by importing `makeLocksRequest` as follows:

```js
import makeLocksRequest from "web-locks-polyfil/make-locks-request";

if(!navigator.locks) {
  const request = makeLocksRequest({...OPTIONS});
  navigator.locks = {
    request,
    get query(){
      throw new Error("navigator.locks.query is not implemented by this polyfill ... yet!")
    }
  };
}
```

`makeLocksRequest` takes the following options:

#### storage

A cross-tab storage API that will be used to read/write as a form of mutex.

- type: [Storage interface](https://developer.mozilla.org/en-US/docs/Web/API/Storage)
- default: `window.localStorage`

#### outerPrefix

The outer lock key prefix used in the storageAPI

- type: String
- default: `'_MUT_OUT_LOCK_'`

#### innerPrefix

The inner lock key prefix used in the storageAPI

- type: String
- default: `'_MUT_IN_LOCK_'`

#### tick

Once a lock is requested, how many millseconds between checks. All requests for a
given tab are on the same timer, and it does very little. So it can be pretty small.

- type: Integer
- default: `20`

#### memorySafe

If `false`, the request will listen to `onbeforeunloaded` and `onunload`
in an attempt to clear any locks acquired by the tab.

The polyfill sets this to `false`. This is because it's expected you aren't going
to be building multiple `request` functions and need to discard them.

- type: Boolean
- default: true

#### lockTimeout

This is how long we consider a mutex-key-lock valid for.

Even with `memorySafe=false`, it's possible a tab crashes.
In this case, we don't want to keep its mutex-key-lock locks forever.
Thus, we ignore any mutex-key-locks held for longer than this time.
If your application has JS that can prevent other JS from running, you should
set this value greater than the maximum task JS execution time.
If your JS execution time exceeds this amount, it's possible
another lock request will be granted.

- type: Integer
- default: 2000

#### clientId

A clientId representing this tab. This is a randomly generated string.

- type: string
- default: something like "3412334521"


#### crossTabDebugger

A debugging utility that can combine data across tabs. The _cross-tab-debugger.js_ file
uses `BroadcastChannel` to see if any tab has more than 1 active lock.

- type: `{onexit, onlock, onunlock, set clientId(){}}`
- default: A mock object that does nothing.
