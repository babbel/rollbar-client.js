// External Imports
import { beforeAll, describe, expect, test, vi } from 'vitest';

// Internal Imports
import { RollbarClient } from './RollbarClient.mjs';
import type { IConfigurationOptions, TSubmitterParameters } from './types.mjs';

// Local Types
type TEventListenerUnhandledError =
  | ((errorEvent: ErrorEvent) => Promise<void>)
  | (() => Promise<Promise<void>>);
type TEventListenerUnhandledPromiseRejection =
  | (() => Promise<Promise<void>>)
  | ((promiseRejectionEvent: PromiseRejectionEvent) => Promise<void>);

// Local Variables
const onErrorDefault: TEventListenerUnhandledError = async () => {};
const onUnhandledRejectionDefault: TEventListenerUnhandledPromiseRejection = async () => {};

// Module Mocks
vi.mock('./RollbarClientSubmitter', () => {
  const RollbarClientSubmitter = vi.fn();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- TODO: determine how to type prototype as non-any
  RollbarClientSubmitter.prototype.report = vi.fn();
  return { RollbarClientSubmitter };
});

// Execute Tests
describe.only(`Class: ${RollbarClient.name}`, () => {
  beforeAll(() => {
    vi.spyOn(window, 'addEventListener');
  });

  describe('Class instantiation and event listener attachment', () => {
    test('default behavior', () => {
      const configuration: IConfigurationOptions = { accessToken: 'abc123', environment: 'test' };
      const client = new RollbarClient(configuration);
      client.initializeEventListeners();

      expect(window.addEventListener).toHaveBeenCalledTimes(2);
      expect(window.addEventListener).toHaveBeenNthCalledWith(1, 'error', client.onErrorDefault);
      expect(window.addEventListener).toHaveBeenNthCalledWith(
        2,
        'unhandledrejection',
        client.onUnhandledRejectionDefault,
      );
    });

    test('"error" listener disabled', () => {
      const configuration: IConfigurationOptions = {
        accessToken: 'abc123',
        environment: 'test',
        onUnhandledError: false,
      };
      const client = new RollbarClient(configuration);
      client.initializeEventListeners();

      expect(window.addEventListener).toHaveBeenCalledTimes(1);
      expect(window.addEventListener).toHaveBeenNthCalledWith(
        1,
        'unhandledrejection',
        client.onUnhandledRejectionDefault,
      );
    });

    test('"unhandledrejection" listener disabled', () => {
      const configuration: IConfigurationOptions = {
        accessToken: 'abc123',
        environment: 'test',
        onUnhandledPromiseRejection: false,
      };
      const client = new RollbarClient(configuration);
      client.initializeEventListeners();

      expect(window.addEventListener).toHaveBeenCalledTimes(1);
      expect(window.addEventListener).toHaveBeenNthCalledWith(1, 'error', client.onErrorDefault);
    });

    test('both listener types disabled', () => {
      const configuration: IConfigurationOptions = {
        accessToken: 'abc123',
        environment: 'test',
        onUnhandledError: false,
        onUnhandledPromiseRejection: false,
      };
      const client = new RollbarClient(configuration);
      client.initializeEventListeners();

      expect(window.addEventListener).toHaveBeenCalledTimes(0);
    });

    test('"error" listener override, "unhandledrejection" listener default', () => {
      const onUnhandledError = vi.fn();
      const configuration = { accessToken: 'abc123', environment: 'test', onUnhandledError };
      const client = new RollbarClient(configuration);
      client.initializeEventListeners();

      expect(window.addEventListener).toHaveBeenCalledTimes(2);
      expect(window.addEventListener).toHaveBeenNthCalledWith(1, 'error', onUnhandledError);
      expect(window.addEventListener).toHaveBeenNthCalledWith(
        2,
        'unhandledrejection',
        client.onUnhandledRejectionDefault,
      );
    });

    test('"error" listener default, "unhandledrejection" listener override', () => {
      const onUnhandledPromiseRejection = vi.fn();
      const configuration = {
        accessToken: 'abc123',
        environment: 'test',
        onUnhandledPromiseRejection,
      };
      const client = new RollbarClient(configuration);
      client.initializeEventListeners();

      expect(window.addEventListener).toHaveBeenCalledTimes(2);
      expect(window.addEventListener).toHaveBeenNthCalledWith(1, 'error', client.onErrorDefault);
      expect(window.addEventListener).toHaveBeenNthCalledWith(
        2,
        'unhandledrejection',
        onUnhandledPromiseRejection,
      );
    });

    test('both listener types overridden', () => {
      const onUnhandledError = vi.fn();
      const onUnhandledPromiseRejection = vi.fn();
      const configuration = {
        accessToken: 'abc123',
        environment: 'test',
        onUnhandledError,
        onUnhandledPromiseRejection,
      };
      const client = new RollbarClient(configuration);
      client.initializeEventListeners();

      expect(window.addEventListener).toHaveBeenCalledTimes(2);
      expect(window.addEventListener).toHaveBeenNthCalledWith(1, 'error', onUnhandledError);
      expect(window.addEventListener).toHaveBeenNthCalledWith(
        2,
        'unhandledrejection',
        onUnhandledPromiseRejection,
      );
    });
  });

  describe('Event listener firing', () => {
    test('default behavior', () => {
      const configuration = { accessToken: 'abc123', environment: 'test' };
      const client = new RollbarClient(configuration);
      const errorEvent = new Event('error');
      const unhandledRejectionEvent = new Event('unhandledrejection');
      vi.spyOn(client, 'onErrorDefault').mockImplementation(onErrorDefault);
      vi.spyOn(client, 'onUnhandledRejectionDefault').mockImplementation(
        onUnhandledRejectionDefault,
      );
      client.initializeEventListeners();
      window.dispatchEvent(errorEvent);
      window.dispatchEvent(unhandledRejectionEvent);

      expect(client.onErrorDefault).toHaveBeenCalledTimes(1);
      expect(client.onErrorDefault).toHaveBeenCalledWith(errorEvent);
      expect(client.onUnhandledRejectionDefault).toHaveBeenCalledTimes(1);
      expect(client.onUnhandledRejectionDefault).toHaveBeenCalledWith(unhandledRejectionEvent);
    });

    test('"error" listener override, "unhandledrejection" listener default', () => {
      const onUnhandledError = vi.fn();
      const configuration = { accessToken: 'abc123', environment: 'test', onUnhandledError };
      const client = new RollbarClient(configuration);
      const errorEvent = new Event('error');
      const unhandledRejectionEvent = new Event('unhandledrejection');
      vi.spyOn(client, 'onErrorDefault').mockImplementation(onErrorDefault);
      vi.spyOn(client, 'onUnhandledRejectionDefault').mockImplementation(
        onUnhandledRejectionDefault,
      );
      client.initializeEventListeners();
      window.dispatchEvent(errorEvent);
      window.dispatchEvent(unhandledRejectionEvent);

      expect(client.onErrorDefault).toHaveBeenCalledTimes(0);
      expect(onUnhandledError).toHaveBeenCalledTimes(1);
      expect(onUnhandledError).toHaveBeenCalledWith(errorEvent);
      expect(client.onUnhandledRejectionDefault).toHaveBeenCalledTimes(1);
      expect(client.onUnhandledRejectionDefault).toHaveBeenCalledWith(unhandledRejectionEvent);
    });

    test('"error" listener default, "unhandledrejection" listener override', () => {
      const onUnhandledPromiseRejection = vi.fn();
      const configuration = {
        accessToken: 'abc123',
        environment: 'test',
        onUnhandledPromiseRejection,
      };
      const client = new RollbarClient(configuration);
      const errorEvent = new Event('error');
      const unhandledRejectionEvent = new Event('unhandledrejection');
      vi.spyOn(client, 'onErrorDefault').mockImplementation(onErrorDefault);
      vi.spyOn(client, 'onUnhandledRejectionDefault').mockImplementation(
        onUnhandledRejectionDefault,
      );
      client.initializeEventListeners();
      window.dispatchEvent(errorEvent);
      window.dispatchEvent(unhandledRejectionEvent);

      expect(client.onErrorDefault).toHaveBeenCalledTimes(1);
      expect(client.onErrorDefault).toHaveBeenCalledWith(errorEvent);
      expect(client.onUnhandledRejectionDefault).toHaveBeenCalledTimes(0);
      expect(onUnhandledPromiseRejection).toHaveBeenCalledTimes(1);
      expect(onUnhandledPromiseRejection).toHaveBeenCalledWith(unhandledRejectionEvent);
    });

    test('both listener types overridden', () => {
      const onUnhandledError = vi.fn();
      const onUnhandledPromiseRejection = vi.fn();
      const configuration = {
        accessToken: 'abc123',
        environment: 'test',
        onUnhandledError,
        onUnhandledPromiseRejection,
      };
      const client = new RollbarClient(configuration);
      const errorEvent = new Event('error');
      const unhandledRejectionEvent = new Event('unhandledrejection');
      vi.spyOn(client, 'onErrorDefault').mockImplementation(onErrorDefault);
      vi.spyOn(client, 'onUnhandledRejectionDefault').mockImplementation(
        onUnhandledRejectionDefault,
      );
      client.initializeEventListeners();
      window.dispatchEvent(errorEvent);
      window.dispatchEvent(unhandledRejectionEvent);

      expect(client.onErrorDefault).toHaveBeenCalledTimes(0);
      expect(onUnhandledError).toHaveBeenCalledTimes(1);
      expect(onUnhandledError).toHaveBeenCalledWith(errorEvent);
      expect(client.onUnhandledRejectionDefault).toHaveBeenCalledTimes(0);
      expect(onUnhandledPromiseRejection).toHaveBeenCalledTimes(1);
      expect(onUnhandledPromiseRejection).toHaveBeenCalledWith(unhandledRejectionEvent);
    });
  });

  describe('RollbarClientSubmitter usage via this.log()', () => {
    test('correct behavior', async () => {
      const configuration = { accessToken: 'abc123', environment: 'test' };
      const client = new RollbarClient(configuration);
      const testError = new Error('unexpected thing happened');
      const applicationState = { one: 'two', other: 'thing' };
      const actionHistory = [{ type: 'ACTION_TYPE_ONE' }, { payload: 77, type: 'ACTION_TYPE_TWO' }];
      const testArguments: TSubmitterParameters = [
        'error',
        'test message',
        testError,
        applicationState,
        actionHistory,
      ];
      client.initializeEventListeners();
      await client.log(...testArguments);

      const { RollbarClientSubmitter } = await import('./RollbarClientSubmitter.mjs');
      const submitter = new RollbarClientSubmitter(configuration);
      expect(submitter.report).toHaveBeenCalledTimes(1);
      expect(submitter.report).toHaveBeenCalledWith(...testArguments);
    });
  });
});
