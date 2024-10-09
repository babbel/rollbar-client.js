// External Imports
import ErrorStackParser from 'error-stack-parser';
import extend from 'just-extend';

// Local Variables
const configurationDefaults = {
  apiUrl: 'https://api.rollbar.com/api/1/item/',
  browserUnsupportedTitlePrefix: '[UNSUPPORTED BROWSER] ',
  hasConfigurationInPayload: false,
  isBrowserSupported: true,
  isVerbose: true,
  setContext: () => window.location.href,
  transform: () => {},
};
const configurationOptionsRequired = ['accessToken', 'environment'];
const libraryName = process.env.npm_package_name;
const libraryVersion = process.env.npm_package_version;

// Local Functions
function buildEnumerableObject(targetObject) {
  const enumerableObject = {};
  for (const key of Object.getOwnPropertyNames(targetObject)) {
    enumerableObject[key] = targetObject[key];
  }
  return enumerableObject;
}

function buildObjectDeepSorted(targetValue) {
  if (targetValue === null || typeof targetValue !== 'object' || Array.isArray(targetValue)) {
    return targetValue;
  }

  const newObject = {};
  for (const key of Object.keys(targetValue).sort((a, b) => a.localeCompare(b, 'en'))) {
    newObject[key] = buildObjectDeepSorted(targetValue[key]);
  }
  return newObject;
}

function getStackFrames(error) {
  return ErrorStackParser.parse(error).map((frame) => ({
    colno: frame.columnNumber,
    filename: frame.fileName,
    lineno: frame.lineNumber,
    method: frame.functionName,
  }));
}

function logToConsole(level, ...remainingArguments) {
  if (level === 'critical') {
    console.error('[ROLLBAR CRITICAL]', ...remainingArguments);
  } else if (['debug', 'error', 'info'].includes(level)) {
    // eslint-disable-next-line no-console -- the if() statement is limiting this to the expected allowlist of debug, error, info
    console[level](`[ROLLBAR ${level.toUpperCase()}]`, ...remainingArguments);
  } else if (level === 'warning') {
    console.warn('[ROLLBAR WARNING]', ...remainingArguments);
  }
}

function serializeConfigurationObject(configObject) {
  const serializedConfigObject = {};
  for (const [key, value] of Object.entries(configObject)) {
    if (key === 'accessToken') {
      // eslint-disable-next-line no-continue -- skip serializing accessToken
      continue;
    }

    const isFunction = value instanceof Function;
    const isRegex = value instanceof RegExp;
    if (isFunction || isRegex) {
      serializedConfigObject[key] = value.toString();
      // eslint-disable-next-line no-continue -- explicitly cast functions and regexes to strings; the default case is to serialize the raw value
      continue;
    }
    serializedConfigObject[key] = value;
  }
  return serializedConfigObject;
}

function submitOccurrence(url, payload) {
  if (typeof navigator.sendBeacon === 'function') {
    const isSubmitSuccessful = navigator.sendBeacon(url, JSON.stringify(payload));
    if (isSubmitSuccessful) {
      return;
    }
  }
  console.warn('[ROLLBAR COMMUNICATION ERROR] sendBeacon() failed; falling back to fetch()');

  // Fall back to using fetch() if the client doesn't support navigator.sendBeacon()
  // eslint-disable-next-line no-param-reassign -- TODO: remove the dual-mode fetch/sendBeacon ability, choose one
  payload.data.custom.reportingMethod = 'fetch';
  fetch(url, {
    body: JSON.stringify(payload),
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    method: 'POST',
  });
}

function validateReportArguments(...parameters) {
  const [level, , error, , actionHistory] = parameters;

  const acceptedLogLevels = ['critical', 'debug', 'error', 'info', 'warning'];
  if (!acceptedLogLevels.includes(level)) {
    throw new Error(`Log level can only be one of the following: ${acceptedLogLevels.join(', ')}`);
  }

  if (error && !(error instanceof Error)) {
    throw new TypeError('Error objects must be an instance of class "Error"');
  }

  if (actionHistory && !Array.isArray(actionHistory)) {
    throw new TypeError('actionHistory must be an array');
  }
}

// Class Definition
class RollbarClientSubmitter {
  constructor(configurationOptions) {
    for (const requiredKey of configurationOptionsRequired) {
      const hasKey = requiredKey in configurationOptions;
      if (!hasKey) {
        throw new Error(`Configuration key "${requiredKey}" is required`);
      }
    }

    const { browsersSupportedRegex: regex } = configurationOptions;
    this.configuration = {
      ...configurationDefaults,
      ...configurationOptions,
      ...(regex && { isBrowserSupported: regex.test(navigator.userAgent) }),
    };
    this.errorHistory = [];
  }

  buildPayload(...parameters) {
    const [level, titleText, error, applicationState, actionHistory] = parameters;
    const { configuration } = this;
    const {
      accessToken,
      browserUnsupportedTitlePrefix,
      commitHash,
      customPayloadFields,
      environment,
      fingerprint,
      hasConfigurationInPayload,
      isBrowserSupported,
      locationInfo,
      setContext,
      userInfo,
    } = configuration;
    const title = `${isBrowserSupported ? '' : browserUnsupportedTitlePrefix}${titleText}`;

    // Build the payload's body object depending on whether or not an error object is passed in
    const body = error
      ? {
          trace: {
            exception: {
              // TODO: use optional chaining
              class: (error.constructor && error.constructor.name) || error.name || '(unknown)',

              description: title,
              message: error.message,
              raw: String(error),
              stack: error.stack,
            },
            frames: getStackFrames(error),
          },
        }
      : {
          message: { body: title },
        };

    const payloadPreMerge = {
      access_token: accessToken,
      data: {
        body,
        client: {
          javascript: {
            browser: navigator.userAgent,
            guess_uncaught_frames: true,
            source_map_enabled: true,
            ...(commitHash && { code_version: commitHash }),
          },
        },
        context: setContext(),
        custom: {
          isBrowserSupported,
          languagePreferred: navigator.language,
          languages: navigator.languages.join(', '),
          reportingMethod: 'sendBeacon',
          ...(actionHistory && { actionHistory: JSON.stringify(actionHistory) }),
          ...(applicationState && { applicationState: JSON.stringify(applicationState) }),
          ...(hasConfigurationInPayload && {
            configuration: { ...serializeConfigurationObject(configuration) },
          }),
          ...(locationInfo && { locationInfo }),
        },
        environment,
        framework: 'browser-js',
        language: 'javascript',
        level,
        notifier: {
          name: libraryName,
          version: libraryVersion,
        },
        platform: 'browser',
        title,
        ...(userInfo && { person: { ...userInfo } }),
      },
    };

    // Conditionally apply a fingerprint to this occurrence
    if (typeof fingerprint === 'string') {
      payloadPreMerge.data.fingerprint = fingerprint;
    } else if (fingerprint !== false) {
      payloadPreMerge.data.fingerprint = title;
    }

    const payloadMerged = extend(true, payloadPreMerge, customPayloadFields);
    return buildObjectDeepSorted(payloadMerged);
  }

  report(...parameters) {
    // Validate input arguments
    validateReportArguments(...parameters);

    // Deduplicate errors being submitted
    if (this.shouldSkipDuplicateOccurrence(...parameters)) {
      return;
    }

    // Log to the local console
    if (this.configuration.isVerbose) {
      logToConsole(...parameters);
    }

    // Build the payload to submit to Rollbar
    const payload = this.buildPayload(...parameters);

    // Bail out of reporting if shouldIgnoreOccurrence() returns a truthy value
    const { apiUrl, transform, shouldIgnoreOccurrence } = this.configuration;
    if (
      typeof shouldIgnoreOccurrence === 'function' &&
      shouldIgnoreOccurrence(payload, this.configuration)
    ) {
      console.info('[ROLLBAR CLIENT] Ignoring occurrence', payload, this.configuration);
      return;
    }

    // Allows consumers to mutate the payload similarly to official client
    transform(payload.data, this.configuration);

    // Submit occurrence to Rollbar
    submitOccurrence(apiUrl, payload);
  }

  shouldSkipDuplicateOccurrence(...parameters) {
    const enumerableArguments = parameters.map((a) =>
      a instanceof Error ? buildEnumerableObject(a) : a,
    );
    const enumerableArgumentsStringified = JSON.stringify(enumerableArguments);
    const isDuplicateOccurrence = this.errorHistory.some((oldArguments) => {
      const oldArgumentsStringified = JSON.stringify(oldArguments);
      return enumerableArgumentsStringified === oldArgumentsStringified;
    });
    if (isDuplicateOccurrence) {
      console.info('[ROLLBAR CLIENT] Skipping duplicate error', ...parameters);
      return true;
    }
    this.errorHistory.push(enumerableArguments);
    return false;
  }
}

// Module Exports
export { RollbarClientSubmitter };
