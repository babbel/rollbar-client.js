// Local Variables
const cyanForegroundEscapeSequence = renderColor('36');
const greenForegroundEscapeSequence = renderColor('32');
const redForegroundEscapeSequence = renderColor('31');
const resetEscapeSequence = renderColor('0');
const whiteForegroundEscapeSequence = renderColor('37');
const yellowForegroundEscapeSequence = renderColor('33');

// Local Functions
function printError(...parameters) {
  console.error(redForegroundEscapeSequence, ...parameters, resetEscapeSequence);
}

function printInfo(...parameters) {
  console.info(cyanForegroundEscapeSequence, ...parameters, resetEscapeSequence);
}

function printSuccess(...parameters) {
  console.info(greenForegroundEscapeSequence, ...parameters, resetEscapeSequence);
}

function printWarning(...parameters) {
  console.warn(yellowForegroundEscapeSequence, ...parameters, resetEscapeSequence);
}

function renderColor(color) {
  return `\u001B[${color}m`;
}

function white(targetString) {
  return `${whiteForegroundEscapeSequence}${targetString}${resetEscapeSequence}`;
}

// Module Exports
export { printError, printInfo, printSuccess, printWarning, white };
