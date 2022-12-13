// Internal Imports
import type { IConfigurationOptions } from './interfaces';
import type { RollbarClientSubmitter } from './RollbarClientSubmitter';
import type { TSubmitterParameters } from './types';

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

  async log(...parameters: TSubmitterParameters) {
    if (!this.submitter) {
      const { RollbarClientSubmitter } = await import('./RollbarClientSubmitter.js');
      this.submitter = new RollbarClientSubmitter(this.configuration);
    }
    this.submitter.report(...parameters);
  }

  onErrorDefault = (errorEvent: ErrorEvent) => {
    this.log('warning', 'Unhandled error occurred', errorEvent.error as Error).catch(() => {});
  };

  onUnhandledRejectionDefault = (promiseRejectionEvent: PromiseRejectionEvent) => {
    this.log(
      'warning',
      'Unhandled promise rejection occurred',
      promiseRejectionEvent.reason as Error,
    ).catch(() => {});
  };
}

// Module Exports
export { RollbarClient };
