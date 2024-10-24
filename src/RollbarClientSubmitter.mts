// External Imports
import * as ErrorStackParser from 'error-stack-parser';
import extend from 'just-extend';

// Internal Imports
import type {
  IConfigurationOptions,
  IPayload,
  TConfigurationOptionsWithDefaults,
  TSubmitterParameters,
} from './types.mjs';

// Local Variables
const configurationDefaults = {
  apiUrl: 'https://api.rollbar.com/api/1/item/',
  browserUnsupportedTitlePrefix: '[UNSUPPORTED BROWSER] ',
  hasConfigurationInPayload: false,
  isBrowserSupported: true,
  isVerbose: true,
  setContext: () => window.location.href,
  transformPayload: (() => {}) as Required<IConfigurationOptions>['transformPayload'],
};
const configurationOptionsRequired = ['accessToken', 'environment'];
const libraryName = process.env['npm_package_name'];
const libraryVersion = process.env['npm_package_version'];

// Local Functions
function buildEnumerableObject(targetObject: Error) {
  const enumerableObject: Record<string, string | Error> = {};
  for (const key of Object.getOwnPropertyNames(targetObject)) {
    const value = (targetObject as Required<Error>)[key as keyof Error];
    enumerableObject[key] =
      typeof value === 'string' || value instanceof Error ? value : String(value);
  }
  return enumerableObject;
}

function buildObjectDeepSorted<T extends object>(targetValue: T): T {
  const newObject = {} as T;
  for (const key of Object.keys(targetValue).sort((a, b) => a.localeCompare(b, 'en'))) {
    const keyWithCast = key as keyof T;
    const value = targetValue[keyWithCast];
    const isObjectLiteral = typeof value === 'object' && value !== null && !Array.isArray(value);
    newObject[keyWithCast] = isObjectLiteral ? (buildObjectDeepSorted(value) as T[keyof T]) : value;
  }
  return newObject;
}

function getStackFrames(error: Error) {
  return ErrorStackParser.parse(error).map((frame) => ({
    colno: frame.columnNumber,
    filename: frame.fileName,
    lineno: frame.lineNumber,
    method: frame.functionName,
  }));
}

function logToConsole(...parameters: TSubmitterParameters) {
  const [level, ...remainingArguments] = parameters;
  // eslint-disable-next-line default-case -- no default case applies in this situation
  switch (level) {
    case 'critical':
      console.error('[ROLLBAR CRITICAL]', ...remainingArguments);
      break;
    case 'warning':
      console.warn('[ROLLBAR WARNING]', ...remainingArguments);
      break;
    case 'debug':
    case 'error':
    case 'info':
      // eslint-disable-next-line no-console -- the case statements are limiting this to the expected allowlist of debug, error, info
      console[level](`[ROLLBAR ${level.toUpperCase()}]`, ...remainingArguments);
      break;
  }
}

function serializeConfigurationObject(configObject: IConfigurationOptions) {
  const serializedConfigObject = {} as Required<IPayload['data']['custom']>['configuration'];
  for (const [key, value] of Object.entries(configObject)) {
    if (key === 'accessToken') {
      // eslint-disable-next-line no-continue -- skip serializing accessToken
      continue;
    }
    const keyWithCast = key as keyof typeof serializedConfigObject;
    const valueWithCast = value as IConfigurationOptions[typeof keyWithCast];
    if (valueWithCast instanceof Function || valueWithCast instanceof RegExp) {
      (serializedConfigObject[keyWithCast] as string) = valueWithCast.toString();
      // eslint-disable-next-line no-continue -- explicitly cast functions and regexes to strings; the default case is to serialize the raw value
      continue;
    }
    (serializedConfigObject[keyWithCast] as (typeof serializedConfigObject)[typeof keyWithCast]) =
      valueWithCast;
  }
  return serializedConfigObject;
}

async function submitOccurrence(url: string, payload: IPayload) {
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
  await fetch(url, {
    body: JSON.stringify(payload),
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    method: 'POST',
  });
}

function validateReportArguments(...parameters: TSubmitterParameters) {
  const [level] = parameters;
  const acceptedLogLevels = ['critical', 'debug', 'error', 'info', 'warning'];
  if (!acceptedLogLevels.includes(level)) {
    throw new Error(`Log level can only be one of the following: ${acceptedLogLevels.join(', ')}`);
  }
}

// Class Definition
class RollbarClientSubmitter {
  configuration: TConfigurationOptionsWithDefaults;
  errorHistory: object[]; // TODO: add more specific object shape

  constructor(configurationOptions: IConfigurationOptions) {
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

  buildPayload(...parameters: TSubmitterParameters): IPayload {
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
    const body =
      error && error instanceof Error
        ? {
            trace: {
              exception: {
                class: error.constructor?.name ?? error.name ?? '(unknown)',
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

    const payloadPreMerge: IPayload = {
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
        context: setContext ? setContext() : configurationDefaults.setContext(),
        custom: {
          isBrowserSupported: isBrowserSupported ?? true,
          languagePreferred: navigator.language,
          languages: navigator.languages.join(', '),
          reportingMethod: 'sendBeacon',
          ...(actionHistory && { actionHistory: JSON.stringify(actionHistory) }),
          ...(applicationState && { applicationState: JSON.stringify(applicationState) }),
          ...(hasConfigurationInPayload && {
            configuration: {
              ...serializeConfigurationObject(configuration),
            },
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

    const payloadMerged = extend(true, payloadPreMerge, customPayloadFields) as IPayload;
    return buildObjectDeepSorted(payloadMerged);
  }

  async report(...parameters: TSubmitterParameters) {
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
    const { apiUrl, transformPayload, shouldIgnoreOccurrence } = this.configuration;
    if (shouldIgnoreOccurrence && shouldIgnoreOccurrence(payload, this.configuration)) {
      console.info('[ROLLBAR CLIENT] Ignoring occurrence', payload, this.configuration);
      return;
    }

    // Allows consumers to mutate the payload similarly to official client
    transformPayload(payload.data, this.configuration);

    // Submit occurrence to Rollbar
    await submitOccurrence(apiUrl, payload);
  }

  shouldSkipDuplicateOccurrence(...parameters: TSubmitterParameters) {
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
export { configurationDefaults, RollbarClientSubmitter };
