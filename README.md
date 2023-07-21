# NPM module `@babbel/rollbar-client.js`

Tiny, modern Rollbar TypeScript client whose code is mostly lazy-loaded if and when an error occurs.

## Background and Overview

This project started as an idea: "Why does an error reporting library need to load at all before an error happens? Can't we defer loading it until an error object is received? If an error never happens, why waste the bandwidth?"; apparently, I talk to myself more than I realize. Following this thought, I attempted to get lazy-loading working with the official Rollbar JS client; doing so ended up being ultimately impossible without major retooling unless I was OK with errors being reported with no details (hint: I'm not). Then I wondered whether Rollbar had an open API with documentation allowing me to write my own client; [they do](https://explorer.docs.rollbar.com/)! Thus, I proceeded to look through the official JavaScript client's source code and API documentation so all the most important features were retained.

This project's code has been used on production since November 2019 for all of our monitored applications, so we're confident it works well.

This project was moved into its own repository so it can be shared as an NPM package. The benefits are quite significant.

**Features at parity with the official JS client**

- Automatic reporting of uncaught errors and promise rejections
- Stack trace parsing and detailed display; uses same `error-stack-parser` library as the official Rollbar JS client
- Automatic deduplication of errors
- Uses source maps to extract code locations from source code instead of minified code
- Auto-extraction of error object class names from stack traces

**Advantages over the official JS client**

- Enforced 100% unit test line coverage so even future modifications will fail builds until all lines are covered
- Waits to lazy load most of its code until an error happens, otherwise does nothing
- Bundle size impact:
  - This code's main bundle size impact: **~0.4 KiB minified and gzip'd** (~0.3 KiB minified and Brotli'd)!
  - [Official client](https://bundlephobia.com/result?p=rollbar@latest) main bundle size impact: **~23 KiB minified and gzip'd** (over 50 times larger)
- Auto-categorizes reported errors into supported and unsupported browsers (based on a regex that can be auto-generated by NPM packages `browserslist` and `browserslist-useragent-regexp`; see the [Simulated Implementation section below](#simulated-implementation) for a production usage example)
- `sendBeacon()`-based error reporting with auto-fallback to using `fetch()` with `keepalive`
- Encourages fingerprinting overrides for more predictable error categorization based solely on reported error title; can be optionally disabled. Rollbar's default categorization behavior is far less predictable.
- Reports the full application state JSON (e.g. Redux) and/or action history by passing them to the 4th and 5th parameters of `log()`, respectively
- Reports the browser's list of available languages and currently-active language; visible at payload locations `data.custom.languages` and `data.custom.languagePreferred`, respectively
- Optionally reports the user's location information (e.g. city, country, longitude, etc.)
- Payload is alphabetically deep-sorted so payloads from different browsers and environments can be more easily `diff`ed

**Upcoming Features**

- Auto-capturing the request and response metadata for `fetch()` requests
- Supporting native modules in a `<script type="module">` environment

**Features missing vs. the official JS client (potentially will be added later)**

- Non-error-specific telemetry (e.g. page clicks, `console` object logging)

## Usage

**NOTE: this library is not transpiled. If you have the need to support browsers other than Chrome, Firefox, Safari, or Edge (Chromium), please transpile this code**

### Webpack and dynamic imports

By default, this library should work without any extra configuration. However, because this library uses relative dynamic import paths, HTML `<base>` elements can override the path prefix when fetching dynamic import code; thus, dynamic imports can break. To fix this, use Webpack's `publicPath` configuration option at build time or `__webpack_public_path__` global variable at runtime depending on your environment configuration. You can read more about it [here](https://webpack.js.org/guides/public-path/).

### Module Exports

Only a single class `RollbarClient` is exported; its usage follows.

```js
import { RollbarClient } from "@babbel/rollbar-client.js";
const configurationObject = {
  /* config here */
};
const rollbarClient = new RollbarClient(configurationObject);
```

Creates a new client instance and sets configuration options (`configurationObject`) to be used throughout the client instance's lifetime

#### Class Methods

```js
void RollbarClient.prototype.initializeEventListeners();
```

Starts listening for unhandled `error` and `unhandledrejection` events on the global scope  
**NOTE: when using more than one client instance and calling this method for each, multiple `error` and `unhandledrejection` will be attached unless you opt-out of doing so by using `false` as the `onUnhandledError` and/or `onUnhandledPromiseRejection` configuration option values**

```js
void async RollbarClient.prototype.log(errorLevel, errorTitle)
void async RollbarClient.prototype.log(errorLevel, errorTitle [, errorObject])
void async RollbarClient.prototype.log(errorLevel, errorTitle [, errorObject, applicationStateObject])
void async RollbarClient.prototype.log(errorLevel, errorTitle [, errorObject, applicationStateObject, actionHistoryArray])
```

Lazy-loads the rest of the codebase as a module singleton (so it's only ever fetched once) then submits the details of an occurrence

- `errorLevel` (required) string whose accepted values are `critical`, `debug`, `error`, `info`, `warning`
- `errorTitle` (required) can be any string
- `errorObject` (optional) must be an instance of `Error` or its derivatives (e.g. `TypeError`)
- `applicationStateObject` (optional) can be any object (payload location: `data.custom.applicationState`)
- `actionHistoryArray` (optional) can be any array (payload location: `data.custom.actionHistory`)

**NOTE: unreported exceptions will be thrown in the following circumstances:**

- `errorLevel` doesn't match any accepted value
- `errorObject` is not an instance of `Error` or its derivatives (e.g. `RangeError` or `class SomeError extends Error`)
- `actionHistoryArray` is not an array

### Configuration object keys:

| Key Name                        | Required | Data Type  | Default Value                                                      | Description                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------- | -------- | ---------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accessToken`                   | Y        | `String`   | `undefined`                                                        | Rollbar client access token (a.k.a. API key)                                                                                                                                                                                                                                                                                                                                                                     |
| `apiUrl`                        | N        | `String`   | `'https://api.rollbar.com/api/1/item/'`                            | `POST` URL for submitting occurrences to Rollbar                                                                                                                                                                                                                                                                                                                                                                 |
| `browsersSupportedRegex`        | N        | `RegExp`   | `undefined`                                                        | Used to identify if the current browser is supported or not. See `data.custom.isBrowserSupported` in the occurrence JSON to determine if the occurrence's browser is considered supported or not; `isBrowserSupported` defaults to `true` if this option is not used or `browsersSupportedRegex.test(navigator.userAgent)` if it is. Use NPM package `browserslist-useragent-regexp` for easiest implementation. |
| `browserUnsupportedTitlePrefix` | N        | `String`   | `'[UNSUPPORTED BROWSER] '`                                         | Prefix applied to a reported occurrence's title if the current browser is unsupported                                                                                                                                                                                                                                                                                                                            |
| `commitHash`                    | N        | `String`   | `undefined`                                                        | Commit hash of the current code deployment; usually only set during CI builds                                                                                                                                                                                                                                                                                                                                    |
| `customPayloadFields`           | N        | `Object`   | `undefined`                                                        | Object fields to be merged into the POST data submitted to Rollbar; intended to modify/overwrite the payload without restriction ([learn more](https://explorer.docs.rollbar.com/#operation/create-item))                                                                                                                                                                                                        |
| `environment`                   | Y        | `String`   | `undefined`                                                        | The execution environment (e.g. "development" or "production"); can be any value                                                                                                                                                                                                                                                                                                                                 |
| `fingerprint`                   | N        | `String`   | `undefined`                                                        | Used to group occurrences together; defaults to the value of `errorTitle`/`payload.data.title` if not used. To disable its usage, set it to `false`. See [Customizing Fingerprinting Rules](https://docs.rollbar.com/docs/grouping-algorithm#customizing-fingerprinting-rules) for more details                                                                                                                  |
| `hasConfigurationInPayload`     | N        | `Boolean`  | `false`                                                            | If enabled, submit the full configuration object with each occurrence                                                                                                                                                                                                                                                                                                                                            |
| `isVerbose`                     | N        | `Boolean`  | `true`                                                             | If enabled, arguments passed to `log()` are logged locally with `console` in addition to being sent to Rollbar                                                                                                                                                                                                                                                                                                   |
| `locationInfo`                  | N        | `Object`   | `undefined`                                                        | Device location details (e.g. city, country, longitude, etc.)                                                                                                                                                                                                                                                                                                                                                    |
| `onUnhandledError`              | N        | `Function` | See `onErrorDefault` [below](#default-error-handlers)              | Global `error` handler; can disable attaching a handler by setting it to `false`. Only used if `initializeEventListeners()` is called.                                                                                                                                                                                                                                                                           |
| `onUnhandledPromiseRejection`   | N        | `Function` | See `onUnhandledRejectionDefault` [below](#default-error-handlers) | Global `unhandledrejection` handler; can disable attaching a handler by setting it to `false`. Only used if `initializeEventListeners()` is called.                                                                                                                                                                                                                                                              |
| `setContext`                    | N        | `Function` | `() => window.location.href`                                       | Returns a string representing the state of the app during an occurrence; used to directly set payload value `data.context`                                                                                                                                                                                                                                                                                       |
| `shouldIgnoreOccurrence`        | N        | `Function` | `undefined`                                                        | Returns a boolean value determining whether the currently-processing occurrence should be sent to Rollbar. Function signature: `shouldIgnoreOccurrence(payload, configuration)` where `payload` is the payload object about to be sent to Rollbar and `configuration` is the configuration object                                                                                                                |
| `userInfo`                      | N        | `Object`   | `undefined`                                                        | User details (**NOTE: only "email", "id", and "username" fields are indexed by Rollbar**; you can send other fields, but they won't be searchable)                                                                                                                                                                                                                                                               |

### Default Error Handlers

```js
function onErrorDefault(errorEvent) {
  this.log("warning", "Unhandled error occurred", errorEvent.error);
}

function onUnhandledRejectionDefault(promiseRejectionEvent) {
  this.log("warning", "Unhandled promise rejection occurred", promiseRejectionEvent.reason);
}
```

### Simulated Implementation

```js
import { RollbarClient } from '@babbel/rollbar-client.js';
import { browsersSupportedRegex } from '../constants/regex';

const { environment, geo_data, uuid } = getEnvironmentConfig();
const rollbarConfiguration = {
  accessToken: process.env.ROLLBAR_CLIENT_ACCESS_TOKEN,
  browsersSupportedRegex,
  customPayloadFields: {
    data: {
      client: {
        javascript: {
          browser: 'modified user agent',
        },
      },
      custom: {
        isSecretSauce: true,
        veryImportantThing: ['secret', 'sauce'],
      },
    },
  },
  environment,
  locationInfo: { ...geo_data },
  userInfo: { id: uuid },
  ...(process.env.GITHUB_SHA && { commitHash: process.env.GITHUB_SHA }),
};
const rollbarClient = new RollbarClient(rollbarConfiguration);
rollbarClient.initializeEventListeners();

...

try {
  doSomethingKindaBad();
} catch (error) {
  rollbarClient.log(
    'warning',
    'I did something kinda bad',
    error,
    applicationState,
    applicationActionHistory,
  );
}

try {
  doSomethingReallyBad();
} catch (error) {
  rollbarClient.log(
    'error',
    'I did something REALLY bad',
    error,
    applicationState,
    applicationActionHistory,
  );
}
```
