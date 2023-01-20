// Internal Imports
import type { IConfigurationOptions, TSubmitterParameters } from './types.mjs';
import type { RollbarClientSubmitter } from './RollbarClientSubmitter.mjs';

// Class Definition
class RollbarClient {
  configuration: IConfigurationOptions;
  submitter?: RollbarClientSubmitter;

  constructor(configurationOptions: IConfigurationOptions) {
    this.configuration = configurationOptions;
  }

  initializeEventListeners() {
    if (this.configuration.onUnhandledError !== false) {
      window.addEventListener('error', this.configuration.onUnhandledError ?? this.onErrorDefault);
    }
    if (this.configuration.onUnhandledPromiseRejection !== false) {
      window.addEventListener(
        'unhandledrejection',
        this.configuration.onUnhandledPromiseRejection ?? this.onUnhandledRejectionDefault,
      );
    }
  }

  // Same as TSubmitterParameters but listed explicitly so end users get better autocomplete
  async log(
    logLevel: TSubmitterParameters[0],
    titleText: TSubmitterParameters[1],
    error?: TSubmitterParameters[2],
    applicationState?: TSubmitterParameters[3],
    actionHistory?: TSubmitterParameters[4],
  ) {
    if (!this.submitter) {
      // eslint-disable-next-line import/no-unresolved -- false positive of an unimportable package
      const { RollbarClientSubmitter } = await import('./RollbarClientSubmitter.mjs');
      this.submitter = new RollbarClientSubmitter(this.configuration);
    }
    await this.submitter.report(logLevel, titleText, error, applicationState, actionHistory);
  }

  onErrorDefault = (errorEvent: ErrorEvent) =>
    this.log('warning', 'Unhandled error occurred', errorEvent.error as Error);

  onUnhandledRejectionDefault = (promiseRejectionEvent: PromiseRejectionEvent) =>
    this.log(
      'warning',
      'Unhandled promise rejection occurred',
      promiseRejectionEvent.reason as Error,
    );
}

// Module Exports
export { RollbarClient };
