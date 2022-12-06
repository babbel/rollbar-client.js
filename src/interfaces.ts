// Local Interfaces
interface IConfigurationOptions {
  accessToken: string;
  apiUrl?: string;
  browsersSupportedRegex?: RegExp;
  browserUnsupportedTitlePrefix?: string;
  commitHash?: string;
  customPayloadFields?: any;
  environment: string;
  fingerprint?: string | false;
  hasConfigurationInPayload?: boolean;
  isBrowserSupported?: boolean;
  isVerbose?: boolean;
  locationInfo?: object;
  onUnhandledError?: (errorEvent: ErrorEvent) => void;
  onUnhandledPromiseRejection?: (promiseRejectionEvent: PromiseRejectionEvent) => void;
  setContext?: () => string;
  shouldIgnoreOccurrence?: (payload: object, configuration: IConfigurationInternal) => boolean; // TODO: use more specific param types
  userInfo?: object;
}

interface IConfigurationInternal {
  accessToken: string;
  apiUrl: string;
  browsersSupportedRegex: RegExp;
  browserUnsupportedTitlePrefix: string;
  commitHash: string;
  customPayloadFields: any;
  environment: string;
  fingerprint: string | false;
  hasConfigurationInPayload: boolean;
  isBrowserSupported: boolean;
  isVerbose: boolean;
  locationInfo: object;
  setContext: () => string;
  shouldIgnoreOccurrence: (payload: object, configuration: IConfigurationInternal) => boolean; // TODO: use more specific param types
  userInfo: object;
}

interface IErrorIndexSignature {
  [key: string]: string | Error;
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
      configuration?: Omit<IConfigurationInternal, 'accessToken'>;
      locationInfo?: object;
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
export {
  IConfigurationInternal,
  IConfigurationOptions,
  IErrorIndexSignature,
  IGenericObjectIndexSignature,
  IPayload,
};
