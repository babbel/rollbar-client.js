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

  async log(...parameters: TSubmitterParameters) {
    if (!this.submitter) {
      // eslint-disable-next-line import/no-unresolved -- false positive of an unimportable package
      const { RollbarClientSubmitter } = await import('./RollbarClientSubmitter.mjs');
      this.submitter = new RollbarClientSubmitter(this.configuration);
    }
    this.submitter.report(...parameters);
  }

  onErrorDefault = async (errorEvent: ErrorEvent) => {
    await this.log('warning', 'Unhandled error occurred', errorEvent.error as Error);
  };

  onUnhandledRejectionDefault = async (promiseRejectionEvent: PromiseRejectionEvent) => {
    await this.log(
      'warning',
      'Unhandled promise rejection occurred',
      promiseRejectionEvent.reason as Error,
    );
  };
}

// Module Exports
export { RollbarClient };
