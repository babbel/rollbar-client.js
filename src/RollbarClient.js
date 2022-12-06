// TODO: when Node 14 launches, refactor to use .mjs native modules and remove Babel

// Class Definition
class RollbarClient {
  constructor(configurationOptions) {
    this.configuration = configurationOptions;
    this.onErrorDefault = this.onErrorDefault.bind(this);
    this.onUnhandledRejectionDefault = this.onUnhandledRejectionDefault.bind(this);
    this.submitter = undefined;
  }

  initializeEventListeners() {
    if (this.configuration.onUnhandledError !== false) {
      const errorListener = this.configuration.onUnhandledError || this.onErrorDefault;
      window.addEventListener('error', errorListener);
    }
    if (this.configuration.onUnhandledPromiseRejection !== false) {
      const unhandledrejectionListener =
        this.configuration.onUnhandledPromiseRejection || this.onUnhandledRejectionDefault;
      window.addEventListener('unhandledrejection', unhandledrejectionListener);
    }
  }

  async log(...parameters) {
    if (!this.submitter) {
      const { RollbarClientSubmitter } = await import('./RollbarClientSubmitter.js');
      this.submitter = new RollbarClientSubmitter(this.configuration);
    }
    this.submitter.report(...parameters);
  }

  onErrorDefault(errorEvent) {
    this.log('warning', 'Unhandled error occurred', errorEvent.error);
  }

  onUnhandledRejectionDefault(promiseRejectionEvent) {
    this.log('warning', 'Unhandled promise rejection occurred', promiseRejectionEvent.reason);
  }
}

// Module Exports
export { RollbarClient };
