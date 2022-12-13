// External Imports
import * as ErrorStackParser from 'error-stack-parser';

// Internal Imports
import { name as expectedlibraryName, version as expectedlibraryVersion } from '../package.json';
import { RollbarClientSubmitter } from './RollbarClientSubmitter';
import type { IConfigurationOptions, IGenericObjectIndexSignature, IPayload } from './interfaces';

// Local Variables
const acceptedLogLevels = ['critical', 'debug', 'error', 'info', 'warning'];
const defaultApiUrl = 'https://api.rollbar.com/api/1/item/';
const minimalCorrectConfig = { accessToken: 'abc123', environment: 'test' };

// Local Classes
class TestCustomError extends RangeError {}

// Local Functions
function buildMinimalPayload(): IPayload {
  const { accessToken, environment } = minimalCorrectConfig;
  return {
    access_token: accessToken,
    data: {
      body: {},
      client: {
        javascript: {
          browser: navigator.userAgent,
          guess_uncaught_frames: true,
          source_map_enabled: true,
        },
      },
      context: window.location.href,
      custom: {
        isBrowserSupported: true,
        languagePreferred: navigator.language,
        languages: navigator.languages.join(', '),
        reportingMethod: 'sendBeacon',
      },
      environment,
      fingerprint: 'test message',
      framework: 'browser-js',
      language: 'javascript',
      level: 'error',
      notifier: {
        name: expectedlibraryName,
        version: expectedlibraryVersion,
      },
      platform: 'browser',
      title: 'test message',
    },
  };
}

const fetchMock = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve('test'),
  }),
) as jest.Mock;

function getStackFrames(error: Error) {
  return ErrorStackParser.parse(error).map((frame) => ({
    colno: frame.columnNumber,
    filename: frame.fileName,
    lineno: frame.lineNumber,
    method: frame.functionName,
  }));
}

function omitFromObject(key: string, object: IGenericObjectIndexSignature) {
  const { [key]: omitted, ...remaining } = object;
  return remaining;
}

const sendBeaconMock = jest.fn(() => true) as jest.Mock;

// Execute Tests
describe(`Class: ${RollbarClientSubmitter.name}`, () => {
  describe('Class instantiation and configuration', () => {
    const requiredKeys = ['accessToken', 'environment'];
    for (const key of requiredKeys) {
      test(`throws when required configuration key "${key}" is missing`, () => {
        // TODO: remove this old code when this is verified working
        // const badConfig = { ...minimalCorrectConfig };
        // delete badConfig[key];

        const badConfig = omitFromObject(key, minimalCorrectConfig);
        expect(() => new RollbarClientSubmitter(badConfig as IConfigurationOptions)).toThrow(
          `Configuration key "${key}" is required`,
        );
      });
    }

    test('does not throw when it receives a correct configuration options object', () => {
      expect(() => new RollbarClientSubmitter({ ...minimalCorrectConfig })).not.toThrow();
    });
  });

  describe('Error occurrence submission', () => {
    // Setup lifecycle behavior
    let submitter = new RollbarClientSubmitter(minimalCorrectConfig);

    beforeAll(() => {
      jest.spyOn(console, 'debug').mockImplementation().mockName('consoleDebugMock');
      jest.spyOn(console, 'error').mockImplementation().mockName('consoleErrorMock');
      jest.spyOn(console, 'info').mockImplementation().mockName('consoleInfoMock');
      jest.spyOn(console, 'warn').mockImplementation().mockName('consoleWarnMock');

      // Stub and mock features unsupported by Jest
      if (typeof window.fetch !== 'function') {
        window.fetch = fetchMock;
      }
      jest.spyOn(window, 'fetch').mockImplementation(fetchMock).mockName('fetchMock');

      // if (typeof navigator.sendBeacon !== 'function') {
      //   navigator.sendBeacon = sendBeaconMock;
      // }
      jest
        .spyOn(navigator, 'sendBeacon')
        .mockImplementation(sendBeaconMock)
        .mockName('sendBeaconMock');
    });

    beforeEach(() => {
      submitter = new RollbarClientSubmitter(minimalCorrectConfig);
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    // Begin Tests
    describe('Validate input arguments: validateReportArgs()', () => {
      describe('All correct log levels are accepted', () => {
        for (const logLevel of acceptedLogLevels) {
          // eslint-disable-next-line @typescript-eslint/no-loop-func -- "submitter" is block scoped, so this appears to be a false alarm
          test(`${logLevel}`, () => {
            expect(() => submitter.report(logLevel, 'test message')).not.toThrow();
          });
        }
      });

      describe('Expected errors', () => {
        test('incorrect log level', () => {
          expect(() => submitter.report('magic', 'test message')).toThrow(
            'Log level can only be one of the following: critical, debug, error, info, warning',
          );
        });

        test('error object is not an instance of class "Error"', () => {
          expect(() =>
            submitter.report('error', 'test message', new Error('bad thing happened')),
          ).toThrow('Error objects must be an instance of class "Error"');
        });

        test('actionHistory is not an array', () => {
          const testError = new Error('test error');
          expect(() =>
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- the wrong data type is the test condition
            // @ts-ignore the wrong data type is the test condition
            submitter.report('error', 'test message', testError, {}, { type: 'TEST' }),
          ).toThrow('actionHistory must be an array');
        });
      });
    });

    describe('Prevent duplicate errors from being submitted: this.shouldSkipDuplicateOccurrence()', () => {
      test('duplicate errors are skipped', () => {
        const duplicateCount = 6;
        // eslint-disable-next-line no-plusplus -- needed for the for() loop
        for (let index = 0; index < duplicateCount + 1; ++index) {
          submitter.report('error', 'test message', new Error('test error'));
        }

        expect(window.fetch).toHaveBeenCalledTimes(0);
        expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
        expect(console.info).toHaveBeenCalledTimes(duplicateCount);

        // eslint-disable-next-line no-plusplus -- needed for the for() loop
        for (let index = 0; index < duplicateCount; ++index) {
          expect(console.info).toHaveBeenNthCalledWith(
            index + 1,
            '[ROLLBAR CLIENT] Skipping duplicate error',
            'error',
            'test message',
            new Error('test error'),
          );
        }
      });
    });

    describe('Report to the local console: logToConsole()', () => {
      const remainingArguments: [string, Error] = ['test message', new Error('test error')];

      describe('Nothing is logged to the console if configuration option "isVerbose" is set to "false"', () => {
        for (const logLevel of acceptedLogLevels) {
          test(`log level "${logLevel}"`, () => {
            const clientSubmitter = new RollbarClientSubmitter({
              ...minimalCorrectConfig,
              isVerbose: false,
            });
            clientSubmitter.report(logLevel, ...remainingArguments);
            expect(console.debug).toHaveBeenCalledTimes(0);
            expect(console.error).toHaveBeenCalledTimes(0);
            expect(console.info).toHaveBeenCalledTimes(0);
            expect(console.warn).toHaveBeenCalledTimes(0);
          });
        }
      });

      describe('Log to the console by default for each log level', () => {
        test('log level "critical"', () => {
          submitter.report('critical', ...remainingArguments);
          expect(console.debug).toHaveBeenCalledTimes(0);
          expect(console.error).toHaveBeenCalledTimes(1);
          expect(console.info).toHaveBeenCalledTimes(0);
          expect(console.warn).toHaveBeenCalledTimes(0);
          expect(console.error).toHaveBeenCalledWith('[ROLLBAR CRITICAL]', ...remainingArguments);
        });

        test('log level "debug"', () => {
          submitter.report('debug', ...remainingArguments);
          expect(console.debug).toHaveBeenCalledTimes(1);
          expect(console.error).toHaveBeenCalledTimes(0);
          expect(console.info).toHaveBeenCalledTimes(0);
          expect(console.warn).toHaveBeenCalledTimes(0);
          expect(console.debug).toHaveBeenCalledWith('[ROLLBAR DEBUG]', ...remainingArguments);
        });

        test('log level "error"', () => {
          submitter.report('error', ...remainingArguments);
          expect(console.debug).toHaveBeenCalledTimes(0);
          expect(console.error).toHaveBeenCalledTimes(1);
          expect(console.info).toHaveBeenCalledTimes(0);
          expect(console.warn).toHaveBeenCalledTimes(0);
          expect(console.error).toHaveBeenCalledWith('[ROLLBAR ERROR]', ...remainingArguments);
        });

        test('log level "info"', () => {
          submitter.report('info', ...remainingArguments);
          expect(console.debug).toHaveBeenCalledTimes(0);
          expect(console.error).toHaveBeenCalledTimes(0);
          expect(console.info).toHaveBeenCalledTimes(1);
          expect(console.warn).toHaveBeenCalledTimes(0);
          expect(console.info).toHaveBeenCalledWith('[ROLLBAR INFO]', ...remainingArguments);
        });

        test('log level "warning"', () => {
          submitter.report('warning', ...remainingArguments);
          expect(console.debug).toHaveBeenCalledTimes(0);
          expect(console.error).toHaveBeenCalledTimes(0);
          expect(console.info).toHaveBeenCalledTimes(0);
          expect(console.warn).toHaveBeenCalledTimes(1);
          expect(console.warn).toHaveBeenCalledWith('[ROLLBAR WARNING]', ...remainingArguments);
        });
      });
    });

    describe('Build the payload to submit to Rollbar: this.buildPayload()', () => {
      describe('Minimal configuration', () => {
        test('error object not passed (without applicationState or actionHistory)', () => {
          const testMessage = 'test message';
          submitter.report('error', testMessage);

          const payload = buildMinimalPayload();
          payload.data.body = {
            message: {
              body: testMessage,
            },
          };

          expect(window.fetch).toHaveBeenCalledTimes(0);
          expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
          expect(navigator.sendBeacon).toHaveBeenCalledWith(defaultApiUrl, JSON.stringify(payload));
        });

        test('error object passed (without applicationState or actionHistory)', () => {
          const testErrorMessage = 'test error';
          const testError = new TypeError(testErrorMessage);
          const testMessage = 'test message';
          submitter.report('error', testMessage, testError);

          const payload = buildMinimalPayload();
          payload.data.body = {
            trace: {
              exception: {
                class: 'TypeError',
                description: testMessage,
                message: testErrorMessage,
                raw: String(testError),
                stack: testError.stack,
              },
              frames: getStackFrames(testError),
            },
          };

          expect(window.fetch).toHaveBeenCalledTimes(0);
          expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
          expect(navigator.sendBeacon).toHaveBeenCalledWith(defaultApiUrl, JSON.stringify(payload));
        });

        test('custom class-derived error object passed, its class name is detected correctly (without applicationState or actionHistory)', () => {
          const testErrorMessage = 'test error';
          const testError = new TestCustomError(testErrorMessage);
          const testMessage = 'test message';
          submitter.report('error', testMessage, testError);

          const payload = buildMinimalPayload();
          payload.data.body = {
            trace: {
              exception: {
                class: 'TestCustomError',
                description: testMessage,
                message: testErrorMessage,
                raw: String(testError),
                stack: testError.stack,
              },
              frames: getStackFrames(testError),
            },
          };

          expect(window.fetch).toHaveBeenCalledTimes(0);
          expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
          expect(navigator.sendBeacon).toHaveBeenCalledWith(defaultApiUrl, JSON.stringify(payload));
        });

        test('error object passed (with applicationState, without actionHistory)', () => {
          const applicationState = { isLoggedIn: false };
          const testErrorMessage = 'test error';
          const testError = new Error(testErrorMessage);
          const testMessage = 'test message';
          submitter.report('error', testMessage, testError, applicationState);

          const payload = buildMinimalPayload();
          payload.data.body = {
            trace: {
              exception: {
                class: 'Error',
                description: testMessage,
                message: testErrorMessage,
                raw: String(testError),
                stack: testError.stack,
              },
              frames: getStackFrames(testError),
            },
          };
          payload.data.custom = {
            applicationState: JSON.stringify(applicationState),
            ...payload.data.custom,
          };

          expect(window.fetch).toHaveBeenCalledTimes(0);
          expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
          expect(navigator.sendBeacon).toHaveBeenCalledWith(defaultApiUrl, JSON.stringify(payload));
        });

        test('error object passed (without applicationState, with actionHistory)', () => {
          const actionHistory = [
            { type: 'LOGIN_SUBMIT_START' },
            { payload: { username: 'testGuy' }, type: 'LOGIN_SUBMIT_SUCCESS' },
          ];
          const testErrorMessage = 'test error';
          const testError = new TypeError(testErrorMessage);
          const testMessage = 'test message';
          submitter.report('error', testMessage, testError, undefined, actionHistory);

          const payload = buildMinimalPayload();
          payload.data.body = {
            trace: {
              exception: {
                class: 'TypeError',
                description: testMessage,
                message: testErrorMessage,
                raw: String(testError),
                stack: testError.stack,
              },
              frames: getStackFrames(testError),
            },
          };
          payload.data.custom = {
            actionHistory: JSON.stringify(actionHistory),
            ...payload.data.custom,
          };

          expect(window.fetch).toHaveBeenCalledTimes(0);
          expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
          expect(navigator.sendBeacon).toHaveBeenCalledWith(defaultApiUrl, JSON.stringify(payload));
        });

        test('error object passed (with applicationState and actionHistory)', () => {
          const actionHistory = [
            { type: 'LOGIN_SUBMIT_START' },
            { payload: { username: 'testGuy' }, type: 'LOGIN_SUBMIT_SUCCESS' },
          ];
          const applicationState = { isLoggedIn: true, username: 'testGuy' };
          const testErrorMessage = 'test error';
          const testError = new Error(testErrorMessage);
          const testMessage = 'test message';
          submitter.report('error', testMessage, testError, applicationState, actionHistory);

          const payload = buildMinimalPayload();
          payload.data.body = {
            trace: {
              exception: {
                class: 'Error',
                description: testMessage,
                message: testErrorMessage,
                raw: String(testError),
                stack: testError.stack,
              },
              frames: getStackFrames(testError),
            },
          };
          payload.data.custom = {
            actionHistory: JSON.stringify(actionHistory),
            applicationState: JSON.stringify(applicationState),
            ...payload.data.custom,
          };

          expect(window.fetch).toHaveBeenCalledTimes(0);
          expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
          expect(navigator.sendBeacon).toHaveBeenCalledWith(defaultApiUrl, JSON.stringify(payload));
        });

        test('reported library version matches expectation', () => {
          const testMessage = 'test message';
          submitter.report('error', testMessage);

          const actualPayload = JSON.parse(navigator.sendBeacon.mock.calls[0][1]) as IPayload;
          const actualLibraryVersion = actualPayload.data.notifier.version;

          expect(actualLibraryVersion).toBe(expectedlibraryVersion);
        });
      });

      describe('Configuration options', () => {
        test('accessToken', () => {
          const accessToken = 'some_access_token';
          const testMessage = 'test message';
          submitter = new RollbarClientSubmitter({ ...minimalCorrectConfig, accessToken });
          submitter.report('error', testMessage);

          const payload = buildMinimalPayload();
          payload.data.body = {
            message: {
              body: testMessage,
            },
          };
          payload.access_token = accessToken;

          expect(window.fetch).toHaveBeenCalledTimes(0);
          expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
          expect(navigator.sendBeacon).toHaveBeenCalledWith(defaultApiUrl, JSON.stringify(payload));
        });

        test('apiUrl', () => {
          const testApiUrl = 'https://other.api.rollbar-compatible.biz/occurrence';
          const testMessage = 'test message';
          submitter = new RollbarClientSubmitter({ ...minimalCorrectConfig, apiUrl: testApiUrl });
          submitter.report('error', testMessage);

          const payload = buildMinimalPayload();
          payload.data.body = {
            message: {
              body: testMessage,
            },
          };

          expect(window.fetch).toHaveBeenCalledTimes(0);
          expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
          expect(navigator.sendBeacon).toHaveBeenCalledWith(testApiUrl, JSON.stringify(payload));
        });

        test('browsersSupportedRegex: user agent match', () => {
          const browsersSupportedRegex = /jsdom/;
          const testMessage = 'test message';
          submitter = new RollbarClientSubmitter({
            ...minimalCorrectConfig,
            browsersSupportedRegex,
          });
          submitter.report('error', testMessage);

          const payload = buildMinimalPayload();
          payload.data.body = {
            message: {
              body: testMessage,
            },
          };

          expect(window.fetch).toHaveBeenCalledTimes(0);
          expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
          expect(navigator.sendBeacon).toHaveBeenCalledWith(defaultApiUrl, JSON.stringify(payload));
        });

        test('browsersSupportedRegex: user agent miss', () => {
          const browsersSupportedRegex = /userAgentMiss/;
          const testMessage = 'test message';
          const unsupportedBrowserTestMessage = `[UNSUPPORTED BROWSER] ${testMessage}`;
          submitter = new RollbarClientSubmitter({
            ...minimalCorrectConfig,
            browsersSupportedRegex,
          });
          submitter.report('error', testMessage);

          const payload = buildMinimalPayload();
          payload.data.body = {
            message: {
              body: unsupportedBrowserTestMessage,
            },
          };
          payload.data.custom.isBrowserSupported = false;
          payload.data.fingerprint = unsupportedBrowserTestMessage;
          payload.data.title = unsupportedBrowserTestMessage;

          expect(window.fetch).toHaveBeenCalledTimes(0);
          expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
          expect(navigator.sendBeacon).toHaveBeenCalledWith(defaultApiUrl, JSON.stringify(payload));
        });

        test('browserUnsupportedTitlePrefix: user agent match', () => {
          const browserUnsupportedTitlePrefix = 'TEST_PREFIX:';
          const testMessage = 'test message';
          submitter = new RollbarClientSubmitter({
            ...minimalCorrectConfig,
            browserUnsupportedTitlePrefix,
          });
          submitter.report('error', testMessage);

          const payload = buildMinimalPayload();
          payload.data.body = {
            message: {
              body: testMessage,
            },
          };

          expect(window.fetch).toHaveBeenCalledTimes(0);
          expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
          expect(navigator.sendBeacon).toHaveBeenCalledWith(defaultApiUrl, JSON.stringify(payload));
        });

        test('browserUnsupportedTitlePrefix: user agent miss', () => {
          const browserUnsupportedTitlePrefix = 'TEST_PREFIX:';
          const browsersSupportedRegex = /userAgentMiss/;
          const testMessage = 'test message';
          const unsupportedBrowserTestMessage = `${browserUnsupportedTitlePrefix}${testMessage}`;
          submitter = new RollbarClientSubmitter({
            ...minimalCorrectConfig,
            browsersSupportedRegex,
            browserUnsupportedTitlePrefix,
          });
          submitter.report('error', testMessage);

          const payload = buildMinimalPayload();
          payload.data.body = {
            message: {
              body: unsupportedBrowserTestMessage,
            },
          };
          payload.data.custom.isBrowserSupported = false;
          payload.data.fingerprint = unsupportedBrowserTestMessage;
          payload.data.title = unsupportedBrowserTestMessage;

          expect(window.fetch).toHaveBeenCalledTimes(0);
          expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
          expect(navigator.sendBeacon).toHaveBeenCalledWith(defaultApiUrl, JSON.stringify(payload));
        });

        test('commitHash', () => {
          const commitHash = 'abcdef1234567890';
          const testMessage = 'test message';
          submitter = new RollbarClientSubmitter({ ...minimalCorrectConfig, commitHash });
          submitter.report('error', testMessage);

          const payload = buildMinimalPayload();
          // eslint-disable-next-line @typescript-eslint/naming-convention -- the library uses these fields, so tests cannot avoid these naming conventions
          const { browser, guess_uncaught_frames, source_map_enabled } =
            payload.data.client.javascript;
          payload.data.body = {
            message: {
              body: testMessage,
            },
          };
          payload.data.client.javascript = {
            browser,
            code_version: commitHash,
            guess_uncaught_frames,
            source_map_enabled,
          };

          expect(window.fetch).toHaveBeenCalledTimes(0);
          expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
          expect(navigator.sendBeacon).toHaveBeenCalledWith(defaultApiUrl, JSON.stringify(payload));
        });

        test('customPayloadFields', () => {
          const some = {
            new: { stuff: 'is here' },
          };
          const customPayloadFields = {
            data: { some },
          };
          const testMessage = 'test message';
          submitter = new RollbarClientSubmitter({ ...minimalCorrectConfig, customPayloadFields });
          submitter.report('error', testMessage);

          const payload = buildMinimalPayload();
          const {
            client,
            context,
            custom,
            environment,
            fingerprint,
            framework,
            language,
            level,
            notifier,
            platform,
          } = payload.data;
          payload.data = {
            body: {
              message: {
                body: testMessage,
              },
            },
            client,
            context,
            custom: {
              ...custom,
              some,
            },
            environment,
            fingerprint: fingerprint as string,
            framework,
            language,
            level,
            notifier,
            platform,
            title: testMessage,
          };

          expect(window.fetch).toHaveBeenCalledTimes(0);
          expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
          expect(navigator.sendBeacon).toHaveBeenCalledWith(defaultApiUrl, JSON.stringify(payload));
        });

        test('customPayloadFields, payload is correctly deep-sorted alphabetically', () => {
          // Need to JSON.parse() stringified objects to not violoate ESLint sorting rules
          const customPayloadFields = JSON.parse(
            '{"data":{"zAtTheEnd":"its over...","arr":[1,{"two":"three"},4]},"aShouldBeFirst":{"second":"2nd","third":3,"fourth":[4,3,2,1],"fifth":{"really":"deep","object":["sorting","works","ignoring","arrays"]}}}',
          ) as IPayload;
          const testMessage = 'test message';
          submitter = new RollbarClientSubmitter({ ...minimalCorrectConfig, customPayloadFields });
          submitter.report('error', testMessage);

          // eslint-disable-next-line @typescript-eslint/naming-convention -- the library uses these fields, so tests cannot avoid these naming conventions
          const { access_token, data } = buildMinimalPayload();
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- deleting this field is part of the test, so this action is unavoidable
          // @ts-ignore deleting this field is part of the test, so this action is unavoidable
          delete data.body;
          const payload = {
            access_token,
            aShouldBeFirst: {
              fifth: {
                object: ['sorting', 'works', 'ignoring', 'arrays'],
                really: 'deep',
              },
              fourth: [4, 3, 2, 1],
              second: '2nd',
              third: 3,
            },
            data: {
              arr: [1, { two: 'three' }, 4],
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- creating badly-sorted data is part of this test, TS has to be ignored here
              // @ts-ignore creating badly-sorted data is part of this test, TS has to be ignored here
              body: {
                message: {
                  body: testMessage,
                },
              },
              ...data,
              zAtTheEnd: 'its over...',
            },
          };

          expect(window.fetch).toHaveBeenCalledTimes(0);
          expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
          expect(navigator.sendBeacon).toHaveBeenCalledWith(defaultApiUrl, JSON.stringify(payload));
        });

        test('environment', () => {
          const environment = 'test_environment';
          const testMessage = 'test message';
          submitter = new RollbarClientSubmitter({ ...minimalCorrectConfig, environment });
          submitter.report('error', testMessage);

          const payload = buildMinimalPayload();
          payload.data.body = {
            message: {
              body: testMessage,
            },
          };
          payload.data.environment = environment;

          expect(window.fetch).toHaveBeenCalledTimes(0);
          expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
          expect(navigator.sendBeacon).toHaveBeenCalledWith(defaultApiUrl, JSON.stringify(payload));
        });

        test('fingerprint: passed-in string used', () => {
          const fingerprint = 'test_fingerprint';
          const testMessage = 'test message';
          submitter = new RollbarClientSubmitter({ ...minimalCorrectConfig, fingerprint });
          submitter.report('error', testMessage);

          const payload = buildMinimalPayload();
          payload.data.body = {
            message: {
              body: testMessage,
            },
          };
          payload.data.fingerprint = fingerprint;

          expect(window.fetch).toHaveBeenCalledTimes(0);
          expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
          expect(navigator.sendBeacon).toHaveBeenCalledWith(defaultApiUrl, JSON.stringify(payload));
        });

        test('fingerprint: defaults to the value of "title" if not passed in', () => {
          const testMessage = 'test message for fingerprint';
          submitter = new RollbarClientSubmitter({ ...minimalCorrectConfig });
          submitter.report('error', testMessage);

          const payload = buildMinimalPayload();
          payload.data.body = {
            message: {
              body: testMessage,
            },
          };
          payload.data.fingerprint = testMessage;
          payload.data.title = testMessage;

          expect(window.fetch).toHaveBeenCalledTimes(0);
          expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
          expect(navigator.sendBeacon).toHaveBeenCalledWith(defaultApiUrl, JSON.stringify(payload));
        });

        test('fingerprint: can be disabled', () => {
          const testMessage = 'test message';
          submitter = new RollbarClientSubmitter({ ...minimalCorrectConfig, fingerprint: false });
          submitter.report('error', testMessage);

          const payload = buildMinimalPayload();
          payload.data.body = {
            message: {
              body: testMessage,
            },
          };
          delete payload.data.fingerprint;

          expect(window.fetch).toHaveBeenCalledTimes(0);
          expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
          expect(navigator.sendBeacon).toHaveBeenCalledWith(defaultApiUrl, JSON.stringify(payload));
        });

        test('hasConfigurationInPayload', () => {
          // eslint-disable-next-line unicorn/consistent-function-scoping -- colocate this with other test setup for clarity
          function onUnhandledError() {
            return 'some unhandled error';
          }
          // eslint-disable-next-line unicorn/consistent-function-scoping -- colocate this with other test setup for clarity
          function onUnhandledPromiseRejection() {
            return 'some unhandled promise rejection';
          }
          // eslint-disable-next-line unicorn/consistent-function-scoping -- colocate this with other test setup for clarity
          function setContext() {
            return 'current/app$state';
          }
          // eslint-disable-next-line unicorn/consistent-function-scoping -- colocate this with other test setup for clarity
          function shouldIgnoreOccurrence() {
            return false;
          }
          const testMessage = 'test message';
          const browsersSupportedRegex = /jsdom/;
          submitter = new RollbarClientSubmitter({
            ...minimalCorrectConfig,
            browsersSupportedRegex,
            hasConfigurationInPayload: true,
            onUnhandledError,
            onUnhandledPromiseRejection,
            setContext,
            shouldIgnoreOccurrence,
          });
          submitter.report('error', testMessage);

          const payload = buildMinimalPayload();
          const { isBrowserSupported, languagePreferred, languages, reportingMethod } =
            payload.data.custom;
          payload.data.body = {
            message: {
              body: testMessage,
            },
          };
          payload.data.context = setContext();
          payload.data.custom = {
            configuration: {
              apiUrl: defaultApiUrl,
              browsersSupportedRegex,
              browserUnsupportedTitlePrefix: '[UNSUPPORTED BROWSER] ',
              environment: 'test',
              hasConfigurationInPayload: true,
              isBrowserSupported: true,
              isVerbose: true,
              setContext,
              shouldIgnoreOccurrence,
            },
            isBrowserSupported,
            languagePreferred,
            languages,
            reportingMethod,
          };

          expect(window.fetch).toHaveBeenCalledTimes(0);
          expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
          expect(navigator.sendBeacon).toHaveBeenCalledWith(defaultApiUrl, JSON.stringify(payload));
        });

        // isVerbose: tested in the logToConsole() section

        test('locationInfo', () => {
          const locationInfo = {
            city: 'New York',
            country: 'USA',
          };
          const testMessage = 'test message';
          submitter = new RollbarClientSubmitter({ ...minimalCorrectConfig, locationInfo });
          submitter.report('error', testMessage);

          const payload = buildMinimalPayload();
          const { isBrowserSupported, languagePreferred, languages, reportingMethod } =
            payload.data.custom;
          payload.data.body = {
            message: {
              body: testMessage,
            },
          };
          payload.data.custom = {
            isBrowserSupported,
            languagePreferred,
            languages,
            locationInfo,
            reportingMethod,
          };

          expect(window.fetch).toHaveBeenCalledTimes(0);
          expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
          expect(navigator.sendBeacon).toHaveBeenCalledWith(defaultApiUrl, JSON.stringify(payload));
        });

        // onUnhandledError: tested in RollbarClient.test.js
        // onUnhandledPromiseRejection: tested in RollbarClient.test.js

        test('setContext', () => {
          const contextString = 'page/1#logging-in';
          function setContext() {
            return contextString;
          }
          const testMessage = 'test message';
          const rollbarConfiguration = {
            ...minimalCorrectConfig,
            setContext,
          };
          submitter = new RollbarClientSubmitter(rollbarConfiguration);
          submitter.report('error', testMessage);

          const payload = buildMinimalPayload();
          payload.data.body = {
            message: {
              body: testMessage,
            },
          };
          payload.data.context = contextString;

          expect(window.fetch).toHaveBeenCalledTimes(0);
          expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
          expect(navigator.sendBeacon).toHaveBeenCalledWith(defaultApiUrl, JSON.stringify(payload));
        });

        test('shouldIgnoreOccurrence', () => {
          function setContext() {
            return window.location.href;
          }
          // eslint-disable-next-line unicorn/consistent-function-scoping -- colocate this with other test setup for clarity
          function shouldIgnoreOccurrence() {
            return true;
          }
          const testMessage = 'test message';
          const rollbarConfiguration = {
            ...minimalCorrectConfig,
            apiUrl: defaultApiUrl,
            browserUnsupportedTitlePrefix: '[UNSUPPORTED BROWSER] ',
            customPayloadFields: {},
            hasConfigurationInPayload: false,
            isBrowserSupported: true,
            isVerbose: true,
            setContext,
            shouldIgnoreOccurrence,
          };
          submitter = new RollbarClientSubmitter(rollbarConfiguration);
          submitter.report('error', testMessage);

          const payload = buildMinimalPayload();
          payload.data.body = {
            message: {
              body: testMessage,
            },
          };

          expect(console.info).toHaveBeenCalledTimes(1);
          expect(console.info).toHaveBeenCalledWith(
            '[ROLLBAR CLIENT] Ignoring occurrence',
            payload,
            rollbarConfiguration,
          );
          expect(window.fetch).toHaveBeenCalledTimes(0);
          expect(navigator.sendBeacon).toHaveBeenCalledTimes(0);
        });

        test('userInfo', () => {
          const userInfo = {
            email: 'test@run.biz',
            id: 'abcdef1234567890',
            username: 'testPerson',
          };
          const testMessage = 'test message';
          submitter = new RollbarClientSubmitter({ ...minimalCorrectConfig, userInfo });
          submitter.report('error', testMessage);

          const payload = buildMinimalPayload();
          const {
            client,
            context,
            custom,
            environment,
            fingerprint,
            framework,
            language,
            level,
            notifier,
            platform,
          } = payload.data;
          payload.data = {
            body: {
              message: {
                body: testMessage,
              },
            },
            client,
            context,
            custom,
            environment,
            fingerprint: fingerprint as string, // Always set in buildMinimalPayload()
            framework,
            language,
            level,
            notifier,
            person: { ...userInfo },
            platform,
            title: testMessage,
          };

          expect(window.fetch).toHaveBeenCalledTimes(0);
          expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
          expect(navigator.sendBeacon).toHaveBeenCalledWith(defaultApiUrl, JSON.stringify(payload));
        });
      });
    });

    // Bail out of reporting if shouldIgnoreOccurrence() returns a truthy value: tested above

    describe('Submit occurrence to Rollbar: submitOccurrence()', () => {
      test('sendBeacon() submits correctly', () => {
        const testErrorMessage = 'test syntax error';
        const testError = new SyntaxError(testErrorMessage);
        const testMessage = 'test message for test syntax error';
        submitter.report('error', testMessage, testError);

        const payload = buildMinimalPayload();
        payload.data.title = testMessage;
        payload.data.fingerprint = testMessage;
        payload.data.body = {
          trace: {
            exception: {
              class: 'SyntaxError',
              description: testMessage,
              message: testErrorMessage,
              raw: String(testError),
              stack: testError.stack,
            },
            frames: getStackFrames(testError),
          },
        };

        expect(window.fetch).toHaveBeenCalledTimes(0);
        expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
        expect(navigator.sendBeacon).toHaveBeenCalledWith(defaultApiUrl, JSON.stringify(payload));
      });

      test('sendBeacon() is unavailable, fallback to fetch()', () => {
        const sendBeaconBackup = navigator.sendBeacon;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- deleting a non-optional operand is necessary for this test condition
        // @ts-ignore deleting a non-optional operand is necessary for this test condition
        delete navigator.sendBeacon;

        const testErrorMessage = 'test reference error';
        const testError = new ReferenceError(testErrorMessage);
        const testMessage = 'test message for test reference error';
        submitter.report('error', testMessage, testError);

        const payload = buildMinimalPayload();
        payload.data.custom.reportingMethod = 'fetch';
        payload.data.fingerprint = testMessage;
        payload.data.title = testMessage;
        payload.data.body = {
          trace: {
            exception: {
              class: 'ReferenceError',
              description: testMessage,
              message: testErrorMessage,
              raw: String(testError),
              stack: testError.stack,
            },
            frames: getStackFrames(testError),
          },
        };

        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledWith(
          '[ROLLBAR COMMUNICATION ERROR] sendBeacon() failed; falling back to fetch()',
        );
        expect(window.fetch).toHaveBeenCalledTimes(1);
        expect(window.fetch).toHaveBeenCalledWith(defaultApiUrl, {
          body: JSON.stringify(payload),
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          method: 'POST',
        });

        navigator.sendBeacon = sendBeaconBackup;
      });
    });
  });
});
