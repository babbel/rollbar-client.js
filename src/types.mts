// Local Types
type TConfigurationObjectValue = string | RegExp | object | boolean | typeof Function;

type TCustomConfiguration = Omit<IConfigurationInternal, 'accessToken'> & {
  onUnhandledError?: string;
  onUnhandledPromiseRejection?: string;
};

type TSerializedObject<T extends object> = {
  // eslint-disable-next-line @typescript-eslint/ban-types -- any function can be expected here
  [key in keyof T]: T[key] extends Function | RegExp ? string : T[key];
};

type TSubmitterParameters = [
  string,
  string,
  Error?,
  object?,
  Array<{ type: string; payload?: any }>?,
];

// Local Interfaces
interface IConfigurationOptions {
  accessToken: string;
  apiUrl?: string;
  browsersSupportedRegex?: RegExp;
  browserUnsupportedTitlePrefix?: string;
  commitHash?: string;
  customPayloadFields?: object;
  environment: string;
  fingerprint?: string | false;
  hasConfigurationInPayload?: boolean;
  isBrowserSupported?: boolean;
  isVerbose?: boolean;
  locationInfo?: object;
  onUnhandledError?: false | ((errorEvent: ErrorEvent) => void);
  onUnhandledPromiseRejection?: false | ((promiseRejectionEvent: PromiseRejectionEvent) => void);
  setContext?: () => string;
  shouldIgnoreOccurrence?: (payload: IPayload, configuration: IConfigurationInternal) => boolean;
  userInfo?: object;
}

interface IConfigurationInternal {
  accessToken: string;
  apiUrl: string;
  browsersSupportedRegex: RegExp;
  browserUnsupportedTitlePrefix: string;
  commitHash?: string;
  customPayloadFields?: object;
  environment: string;
  fingerprint?: string | false;
  hasConfigurationInPayload?: boolean;
  isBrowserSupported: boolean;
  isVerbose: boolean;
  locationInfo?: object;
  setContext: () => string;
  shouldIgnoreOccurrence: (payload: IPayload, configuration: IConfigurationInternal) => boolean;
  userInfo?: object;
}

interface IGenericObjectIndexSignature {
  [key: string]: any;
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
      configuration?: TSerializedObject<TCustomConfiguration>;
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
  IConfigurationInternal,
  IConfigurationOptions,
  IGenericObjectIndexSignature,
  IPayload,
  TConfigurationObjectValue,
  TSubmitterParameters,
};
