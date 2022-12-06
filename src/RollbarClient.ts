// Internal Imports
import type { IConfigurationOptions } from './interfaces';
import type { TSubmitterParameters } from './types';

// Class Definition
class RollbarClient {
  configuration: IConfigurationOptions;
  submitter?: object; // TODO: make this typing more specific

  constructor(configurationOptions: IConfigurationOptions) {
    this.configuration = configurationOptions;
  }

  initializeEventListeners() {
    window.addEventListener('error', this.configuration.onUnhandledError ?? this.onErrorDefault);
    window.addEventListener(
      'unhandledrejection',
      this.configuration.onUnhandledPromiseRejection ?? this.onUnhandledRejectionDefault,
    );
  }

  async log(...parameters: TSubmitterParameters) {
    if (!this.submitter) {
      const { RollbarClientSubmitter } = await import('./RollbarClientSubmitter.js');
      this.submitter = new RollbarClientSubmitter(this.configuration);
    }
    // @ts-ignore TODO: add more specific typing to this.submitter
    this.submitter.report(...parameters);
  }

  onErrorDefault = (errorEvent: ErrorEvent) => {
    this.log('warning', 'Unhandled error occurred', errorEvent.error);
  };

  onUnhandledRejectionDefault = (promiseRejectionEvent: PromiseRejectionEvent) => {
    this.log('warning', 'Unhandled promise rejection occurred', promiseRejectionEvent.reason);
  };
}

// Module Exports
export { RollbarClient };
