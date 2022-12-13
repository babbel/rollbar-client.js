// Local Types
type TConfigurationObjectValue = string | RegExp | object | boolean | typeof Function;

type TSubmitterParameters = [
  string,
  string,
  Error?,
  object?,
  Array<{ type: string; payload?: any }>?,
];

// Module Exports
export { TConfigurationObjectValue, TSubmitterParameters };
