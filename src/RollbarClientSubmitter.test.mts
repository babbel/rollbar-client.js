// External Imports
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import * as ErrorStackParser from 'error-stack-parser';

// Internal Imports
import { name as expectedlibraryName, version as expectedlibraryVersion } from '../package.json';
import { RollbarClientSubmitter } from './RollbarClientSubmitter.mjs';

// Type Imports
import type { IConfigurationOptions, IPayload, TLogLevels } from './types.mjs';
import type { SpyInstance } from 'vitest';

// Local Variables
const acceptedLogLevels: TLogLevels[] = ['critical', 'debug', 'error', 'info', 'warning'];
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

function fetchMock(): Promise<Response> {
  return Promise.resolve(new Response());
}

function getStackFrames(error: Error) {
  return ErrorStackParser.parse(error).map((frame) => ({
    colno: frame.columnNumber,
    filename: frame.fileName,
    lineno: frame.lineNumber,
    method: frame.functionName,
  }));
}

function omitFromObject(key: string, object: Record<string, unknown>) {
  const { [key]: omitted, ...remaining } = object;
  return remaining;
}

function sendBeaconMock(): boolean {
  return true;
}

// Execute Tests
describe(`Class: ${RollbarClientSubmitter.name}`, () => {
  let submitter = new RollbarClientSubmitter(minimalCorrectConfig);

  beforeAll(() => {
    vi.spyOn(console, 'debug')
      .mockImplementation(() => {})
      .mockName('consoleDebugMock');
    vi.spyOn(console, 'error')
      .mockImplementation(() => {})
      .mockName('consoleErrorMock');
    vi.spyOn(console, 'info')
      .mockImplementation(() => {})
      .mockName('consoleInfoMock');
    vi.spyOn(console, 'warn')
      .mockImplementation(() => {})
      .mockName('consoleWarnMock');

    if (typeof navigator.sendBeacon !== 'function') {
      navigator.sendBeacon = sendBeaconMock;
    }
    vi.spyOn(navigator, 'sendBeacon').mockImplementation(sendBeaconMock).mockName('sendBeaconMock');

    // Override the user agent so the browsersSupportedRegex feature can be reliably tested
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('happy-dom');

    vi.spyOn(window, 'fetch').mockImplementation(fetchMock).mockName('fetchMock');
  });

  beforeEach(() => {
    submitter = new RollbarClientSubmitter(minimalCorrectConfig);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('Class instantiation and configuration', () => {
    const requiredKeys = ['accessToken', 'environment'];
    for (const key of requiredKeys) {
      test(`throws when required configuration key "${key}" is missing`, () => {
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
    describe('Validate input arguments: validateReportArgs()', () => {
      describe('All correct log levels are accepted', () => {
        for (const logLevel of acceptedLogLevels) {
          // eslint-disable-next-line @typescript-eslint/no-loop-func -- "submitter" is block scoped, so this appears to be a false alarm
          test(`${logLevel}`, async () => {
            await expect(submitter.report(logLevel, 'test message')).resolves.not.toThrow();
          });
        }
      });

      describe('Expected errors', () => {
        test('incorrect log level', async () => {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- allow invalid report level string because that's the point of this test (some users wont be using TS)
          // @ts-ignore
          await expect(submitter.report('magic', 'test message')).rejects.toThrow(
            'Log level can only be one of the following: critical, debug, error, info, warning',
          );
        });
      });
    });

    describe('Prevent duplicate errors from being submitted: this.shouldSkipDuplicateOccurrence()', () => {
      test('duplicate errors are skipped', async () => {
        const duplicateCount = 6;
        const reportPromises = [] as Promise<void>[];
        // eslint-disable-next-line no-plusplus -- needed for the for() loop
        for (let index = 0; index < duplicateCount + 1; ++index) {
          reportPromises.push(submitter.report('error', 'test message', new Error('test error')));
        }
        await Promise.all(reportPromises);

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
      const remainingArguments = ['test message', new Error('test error')] as const;

      describe('Nothing is logged to the console if configuration option "isVerbose" is set to "false"', () => {
        for (const logLevel of acceptedLogLevels) {
          test(`log level "${logLevel}"`, async () => {
            const clientSubmitter = new RollbarClientSubmitter({
              ...minimalCorrectConfig,
              isVerbose: false,
            });
            await clientSubmitter.report(logLevel, ...remainingArguments);
            expect(console.debug).toHaveBeenCalledTimes(0);
            expect(console.error).toHaveBeenCalledTimes(0);
            expect(console.info).toHaveBeenCalledTimes(0);
            expect(console.warn).toHaveBeenCalledTimes(0);
          });
        }
      });

      describe('Log to the console by default for each log level', () => {
        test('log level "critical"', async () => {
          await submitter.report('critical', ...remainingArguments);
          expect(console.debug).toHaveBeenCalledTimes(0);
          expect(console.error).toHaveBeenCalledTimes(1);
          expect(console.info).toHaveBeenCalledTimes(0);
          expect(console.warn).toHaveBeenCalledTimes(0);
          expect(console.error).toHaveBeenCalledWith('[ROLLBAR CRITICAL]', ...remainingArguments);
        });

        test('log level "debug"', async () => {
          await submitter.report('debug', ...remainingArguments);
          expect(console.debug).toHaveBeenCalledTimes(1);
          expect(console.error).toHaveBeenCalledTimes(0);
          expect(console.info).toHaveBeenCalledTimes(0);
          expect(console.warn).toHaveBeenCalledTimes(0);
          expect(console.debug).toHaveBeenCalledWith('[ROLLBAR DEBUG]', ...remainingArguments);
        });

        test('log level "error"', async () => {
          await submitter.report('error', ...remainingArguments);
          expect(console.debug).toHaveBeenCalledTimes(0);
          expect(console.error).toHaveBeenCalledTimes(1);
          expect(console.info).toHaveBeenCalledTimes(0);
          expect(console.warn).toHaveBeenCalledTimes(0);
          expect(console.error).toHaveBeenCalledWith('[ROLLBAR ERROR]', ...remainingArguments);
        });

        test('log level "info"', async () => {
          await submitter.report('info', ...remainingArguments);
          expect(console.debug).toHaveBeenCalledTimes(0);
          expect(console.error).toHaveBeenCalledTimes(0);
          expect(console.info).toHaveBeenCalledTimes(1);
          expect(console.warn).toHaveBeenCalledTimes(0);
          expect(console.info).toHaveBeenCalledWith('[ROLLBAR INFO]', ...remainingArguments);
        });

        test('log level "warning"', async () => {
          await submitter.report('warning', ...remainingArguments);
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
        test('error object not passed (without applicationState or actionHistory)', async () => {
          const testMessage = 'test message';
          await submitter.report('error', testMessage);

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

        test('error object passed (without applicationState or actionHistory)', async () => {
          const testErrorMessage = 'test error';
          const testError = new TypeError(testErrorMessage);
          const testMessage = 'test message';
          await submitter.report('error', testMessage, testError);

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

        test('custom class-derived error object passed, its class name is detected correctly (without applicationState or actionHistory)', async () => {
          const testErrorMessage = 'test error';
          const testError = new TestCustomError(testErrorMessage);
          const testMessage = 'test message';
          await submitter.report('error', testMessage, testError);

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

        test('error object passed (with applicationState, without actionHistory)', async () => {
          const applicationState = { isLoggedIn: false };
          const testErrorMessage = 'test error';
          const testError = new Error(testErrorMessage);
          const testMessage = 'test message';
          await submitter.report('error', testMessage, testError, applicationState);

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

        test('error object passed (without applicationState, with actionHistory)', async () => {
          const actionHistory = [
            { type: 'LOGIN_SUBMIT_START' },
            { payload: { username: 'testGuy' }, type: 'LOGIN_SUBMIT_SUCCESS' },
          ];
          const testErrorMessage = 'test error';
          const testError = new TypeError(testErrorMessage);
          const testMessage = 'test message';
          await submitter.report('error', testMessage, testError, undefined, actionHistory);

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

        test('error object passed (with applicationState and actionHistory)', async () => {
          const actionHistory = [
            { type: 'LOGIN_SUBMIT_START' },
            { payload: { username: 'testGuy' }, type: 'LOGIN_SUBMIT_SUCCESS' },
          ];
          const applicationState = { isLoggedIn: true, username: 'testGuy' };
          const testErrorMessage = 'test error';
          const testError = new Error(testErrorMessage);
          const testMessage = 'test message';
          await submitter.report('error', testMessage, testError, applicationState, actionHistory);

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

        test('reported library version matches expectation', async () => {
          const testMessage = 'test message';
          await submitter.report('error', testMessage);

          type MockSendBeacon = SpyInstance<
            Parameters<Navigator['sendBeacon']>,
            ReturnType<Navigator['sendBeacon']>
          >;
          const sendBeaconAsMock = navigator.sendBeacon as unknown as MockSendBeacon;
          const actualPayload = JSON.parse(sendBeaconAsMock.mock.calls[0][1] as string) as IPayload;
          const actualLibraryVersion = actualPayload.data.notifier.version;

          expect(actualLibraryVersion).toBe(expectedlibraryVersion);
        });
      });

      describe('Configuration options', () => {
        test('accessToken', async () => {
          const accessToken = 'some_access_token';
          const testMessage = 'test message';
          submitter = new RollbarClientSubmitter({ ...minimalCorrectConfig, accessToken });
          await submitter.report('error', testMessage);

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

        test('apiUrl', async () => {
          const testApiUrl = 'https://other.api.rollbar-compatible.biz/occurrence';
          const testMessage = 'test message';
          submitter = new RollbarClientSubmitter({ ...minimalCorrectConfig, apiUrl: testApiUrl });
          await submitter.report('error', testMessage);

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

        test('browsersSupportedRegex: user agent match', async () => {
          const browsersSupportedRegex = /happy-dom/;
          const testMessage = 'test message';
          submitter = new RollbarClientSubmitter({
            ...minimalCorrectConfig,
            browsersSupportedRegex,
          });
          await submitter.report('error', testMessage);

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

        test('browsersSupportedRegex: user agent miss', async () => {
          const browsersSupportedRegex = /userAgentMiss/;
          const testMessage = 'test message';
          const unsupportedBrowserTestMessage = `[UNSUPPORTED BROWSER] ${testMessage}`;
          submitter = new RollbarClientSubmitter({
            ...minimalCorrectConfig,
            browsersSupportedRegex,
          });
          await submitter.report('error', testMessage);

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

        test('browserUnsupportedTitlePrefix: user agent match', async () => {
          const browserUnsupportedTitlePrefix = 'TEST_PREFIX:';
          const testMessage = 'test message';
          submitter = new RollbarClientSubmitter({
            ...minimalCorrectConfig,
            browserUnsupportedTitlePrefix,
          });
          await submitter.report('error', testMessage);

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

        test('browserUnsupportedTitlePrefix: user agent miss', async () => {
          const browserUnsupportedTitlePrefix = 'TEST_PREFIX:';
          const browsersSupportedRegex = /userAgentMiss/;
          const testMessage = 'test message';
          const unsupportedBrowserTestMessage = `${browserUnsupportedTitlePrefix}${testMessage}`;
          submitter = new RollbarClientSubmitter({
            ...minimalCorrectConfig,
            browsersSupportedRegex,
            browserUnsupportedTitlePrefix,
          });
          await submitter.report('error', testMessage);

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

        test('commitHash', async () => {
          const commitHash = 'abcdef1234567890';
          const testMessage = 'test message';
          submitter = new RollbarClientSubmitter({ ...minimalCorrectConfig, commitHash });
          await submitter.report('error', testMessage);

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

        test('customPayloadFields', async () => {
          const some = {
            new: { stuff: 'is here' },
          };
          const customPayloadFields = {
            data: {
              custom: { some },
            },
          };
          const testMessage = 'test message';
          submitter = new RollbarClientSubmitter({ ...minimalCorrectConfig, customPayloadFields });
          await submitter.report('error', testMessage);

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
            fingerprint,
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

        test('customPayloadFields, payload is correctly deep-sorted alphabetically', async () => {
          const customPayloadFields = {
            data: { zAtTheEnd: 'its over...', arr: [1, { two: 'three' }, 4] }, // eslint-disable-line sort-keys -- this test requires improperly sorted data
            // eslint-disable-next-line sort-keys -- this test requires improperly sorted data
            aShouldBeFirst: {
              second: '2nd',
              third: 3,
              fourth: [4, 3, 2, 1], // eslint-disable-line sort-keys -- this test requires improperly sorted data
              fifth: { really: 'deep', object: ['sorting', 'works', 'ignoring', 'arrays'] }, // eslint-disable-line sort-keys -- this test requires improperly sorted data
            },
          };

          const testMessage = 'test message';
          submitter = new RollbarClientSubmitter({ ...minimalCorrectConfig, customPayloadFields });
          await submitter.report('error', testMessage);

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

        test('environment', async () => {
          const environment = 'test_environment';
          const testMessage = 'test message';
          submitter = new RollbarClientSubmitter({ ...minimalCorrectConfig, environment });
          await submitter.report('error', testMessage);

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

        test('fingerprint: passed-in string used', async () => {
          const fingerprint = 'test_fingerprint';
          const testMessage = 'test message';
          submitter = new RollbarClientSubmitter({ ...minimalCorrectConfig, fingerprint });
          await submitter.report('error', testMessage);

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

        test('fingerprint: defaults to the value of "title" if not passed in', async () => {
          const testMessage = 'test message for fingerprint';
          submitter = new RollbarClientSubmitter({ ...minimalCorrectConfig });
          await submitter.report('error', testMessage);

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

        test('fingerprint: can be disabled', async () => {
          const testMessage = 'test message';
          submitter = new RollbarClientSubmitter({ ...minimalCorrectConfig, fingerprint: false });
          await submitter.report('error', testMessage);

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

        test('hasConfigurationInPayload', async () => {
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
          const browsersSupportedRegex = /happy-dom/;
          submitter = new RollbarClientSubmitter({
            ...minimalCorrectConfig,
            browsersSupportedRegex,
            hasConfigurationInPayload: true,
            onUnhandledError,
            onUnhandledPromiseRejection,
            setContext,
            shouldIgnoreOccurrence,
          });
          await submitter.report('error', testMessage);

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
              browsersSupportedRegex: browsersSupportedRegex.toString(),
              browserUnsupportedTitlePrefix: '[UNSUPPORTED BROWSER] ',
              environment: 'test',
              hasConfigurationInPayload: true,
              isBrowserSupported: true,
              isVerbose: true,
              onUnhandledError: onUnhandledError.toString(),
              onUnhandledPromiseRejection: onUnhandledPromiseRejection.toString(),
              setContext: setContext.toString(),
              shouldIgnoreOccurrence: shouldIgnoreOccurrence.toString(),
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

        test('locationInfo', async () => {
          const locationInfo = {
            city: 'New York',
            country: 'USA',
          };
          const testMessage = 'test message';
          submitter = new RollbarClientSubmitter({ ...minimalCorrectConfig, locationInfo });
          await submitter.report('error', testMessage);

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

        test('setContext', async () => {
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
          await submitter.report('error', testMessage);

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

        test('shouldIgnoreOccurrence', async () => {
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
          await submitter.report('error', testMessage);

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

        test('userInfo', async () => {
          const userInfo = {
            email: 'test@run.biz',
            id: 'abcdef1234567890',
            username: 'testPerson',
          };
          const testMessage = 'test message';
          submitter = new RollbarClientSubmitter({ ...minimalCorrectConfig, userInfo });
          await submitter.report('error', testMessage);

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
            fingerprint: fingerprint!, // Always set in buildMinimalPayload()
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
      test('sendBeacon() submits correctly', async () => {
        const testErrorMessage = 'test syntax error';
        const testError = new SyntaxError(testErrorMessage);
        const testMessage = 'test message for test syntax error';
        await submitter.report('error', testMessage, testError);

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

      test('sendBeacon() is unavailable, fallback to fetch()', async () => {
        const sendBeaconBackup = navigator.sendBeacon;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- deleting a non-optional operand is necessary for this test condition
        // @ts-ignore deleting a non-optional operand is necessary for this test condition
        delete navigator.sendBeacon;

        const testErrorMessage = 'test reference error';
        const testError = new ReferenceError(testErrorMessage);
        const testMessage = 'test message for test reference error';
        await submitter.report('error', testMessage, testError);

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
