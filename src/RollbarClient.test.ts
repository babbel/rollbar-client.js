// Internal Imports
import { RollbarClient } from './RollbarClient';
import type { IConfigurationOptions } from './interfaces';
import type { TSubmitterParameters } from './types';

// Module Mocks
const mockReport = jest.fn();
jest.mock('./RollbarClientSubmitter', () => ({
  RollbarClientSubmitter: jest.fn().mockImplementation(() => ({
    report: mockReport,
  })),
}));

// Execute Tests
describe(`Class: ${RollbarClient.name}`, () => {
  beforeAll(() => {
    jest.spyOn(window, 'addEventListener');
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
      const onUnhandledError = jest.fn();
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
      const onUnhandledPromiseRejection = jest.fn();
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
      const onUnhandledError = jest.fn();
      const onUnhandledPromiseRejection = jest.fn();
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
      jest.spyOn(client, 'onErrorDefault').mockImplementation();
      jest.spyOn(client, 'onUnhandledRejectionDefault').mockImplementation();
      client.initializeEventListeners();
      window.dispatchEvent(errorEvent);
      window.dispatchEvent(unhandledRejectionEvent);

      expect(client.onErrorDefault).toHaveBeenCalledTimes(1);
      expect(client.onErrorDefault).toHaveBeenCalledWith(errorEvent);
      expect(client.onUnhandledRejectionDefault).toHaveBeenCalledTimes(1);
      expect(client.onUnhandledRejectionDefault).toHaveBeenCalledWith(unhandledRejectionEvent);
    });

    test('"error" listener override, "unhandledrejection" listener default', () => {
      const onUnhandledError = jest.fn();
      const configuration = { accessToken: 'abc123', environment: 'test', onUnhandledError };
      const client = new RollbarClient(configuration);
      const errorEvent = new Event('error');
      const unhandledRejectionEvent = new Event('unhandledrejection');
      jest.spyOn(client, 'onErrorDefault').mockImplementation();
      jest.spyOn(client, 'onUnhandledRejectionDefault').mockImplementation();
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
      const onUnhandledPromiseRejection = jest.fn();
      const configuration = {
        accessToken: 'abc123',
        environment: 'test',
        onUnhandledPromiseRejection,
      };
      const client = new RollbarClient(configuration);
      const errorEvent = new Event('error');
      const unhandledRejectionEvent = new Event('unhandledrejection');
      jest.spyOn(client, 'onErrorDefault').mockImplementation();
      jest.spyOn(client, 'onUnhandledRejectionDefault').mockImplementation();
      client.initializeEventListeners();
      window.dispatchEvent(errorEvent);
      window.dispatchEvent(unhandledRejectionEvent);

      expect(client.onErrorDefault).toHaveBeenCalledTimes(1);
      expect(client.onErrorDefault).toHaveBeenCalledWith(unhandledRejectionEvent);
      expect(client.onUnhandledRejectionDefault).toHaveBeenCalledTimes(0);
      expect(onUnhandledPromiseRejection).toHaveBeenCalledTimes(1);
      expect(onUnhandledPromiseRejection).toHaveBeenCalledWith(errorEvent);
    });

    test('both listener types overridden', () => {
      const onUnhandledError = jest.fn();
      const onUnhandledPromiseRejection = jest.fn();
      const configuration = {
        accessToken: 'abc123',
        environment: 'test',
        onUnhandledError,
        onUnhandledPromiseRejection,
      };
      const client = new RollbarClient(configuration);
      const errorEvent = new Event('error');
      const unhandledRejectionEvent = new Event('unhandledrejection');
      jest.spyOn(client, 'onErrorDefault').mockImplementation();
      jest.spyOn(client, 'onUnhandledRejectionDefault').mockImplementation();
      client.initializeEventListeners();
      window.dispatchEvent(errorEvent);
      window.dispatchEvent(unhandledRejectionEvent);

      expect(client.onErrorDefault).toHaveBeenCalledTimes(0);
      expect(onUnhandledError).toHaveBeenCalledTimes(1);
      expect(onUnhandledError).toHaveBeenCalledWith(unhandledRejectionEvent);
      expect(client.onUnhandledRejectionDefault).toHaveBeenCalledTimes(0);
      expect(onUnhandledPromiseRejection).toHaveBeenCalledTimes(1);
      expect(onUnhandledPromiseRejection).toHaveBeenCalledWith(errorEvent);
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

      const { RollbarClientSubmitter } = await import('./RollbarClientSubmitter.js');
      const submitter = new RollbarClientSubmitter(configuration);
      expect(submitter.report).toHaveBeenCalledTimes(1);
      expect(submitter.report).toHaveBeenCalledWith(...testArguments);
    });
  });
});
