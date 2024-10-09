// Type Imports
import type { configurationDefaults } from './RollbarClientSubmitter.mjs';

// Local Types
type TConfigurationOptionCustom = Omit<IConfigurationOptions, 'accessToken'>;

type TConfigurationOptionsWithDefaults = IConfigurationOptions & typeof configurationDefaults;

type TConfigurationSerialized<T extends object> = {
  // eslint-disable-next-line @typescript-eslint/ban-types -- any function can be expected here
  [key in keyof T]: Exclude<T[key], undefined | false> extends RegExp | Function ? string : T[key];
};

type TLogLevels = 'critical' | 'debug' | 'error' | 'info' | 'warning';

type TSubmitterParameters = [TLogLevels, string, Error?, object?, IAction[]?];

// Local Interfaces
interface IAction {
  type: string;
  payload?: unknown;
}

interface IConfigurationOptions {
  accessToken: string;
  apiUrl?: string;
  browsersSupportedRegex?: RegExp;
  browserUnsupportedTitlePrefix?: string;
  commitHash?: string;
  customPayloadFields?: object;
  environment: string;
  fingerprint?: false | string;
  hasConfigurationInPayload?: boolean;
  isBrowserSupported?: boolean;
  isVerbose?: boolean;
  locationInfo?: object;
  onUnhandledError?: false | ((errorEvent: ErrorEvent) => void);
  onUnhandledPromiseRejection?: false | ((promiseRejectionEvent: PromiseRejectionEvent) => void);
  setContext?: () => string;
  shouldIgnoreOccurrence?: (payload: IPayload, configuration: IConfigurationOptions) => boolean;
  transform?: (payload: IPayload['data'], configuration: IConfigurationOptions) => void;
  userInfo?: object;
}

interface IPayload {
  access_token: string;
  data: {
    body: object;
    client: {
      javascript: {
        browser: string;
        guess_uncaught_frames: boolean;
        source_map_enabled: boolean;
        code_version?: string;
      };
    };
    fingerprint?: string;
    context: string;
    custom: {
      isBrowserSupported: boolean;
      languagePreferred: string;
      languages: string;
      reportingMethod: 'fetch' | 'sendBeacon';
      actionHistory?: string;
      applicationState?: string;
      configuration?: TConfigurationSerialized<TConfigurationOptionCustom>;
      locationInfo?: object;
      [key: string]: unknown;
    };
    environment: string;
    framework: string | false;
    language: string;
    level: string;
    notifier: {
      name: string | undefined;
      version: string | undefined;
    };
    platform: string;
    title: string;
    person?: object;
  };
}

// Module Exports
export type {
  IConfigurationOptions,
  IPayload,
  TConfigurationOptionsWithDefaults,
  TLogLevels,
  TSubmitterParameters,
};
