/**
 * Logger Utility
 * Centralized logging with prefixes for different services
 */

const COLORS = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    blue: '\x1b[34m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

function formatMessage(prefix, color, message) {
    const timestamp = new Date().toLocaleTimeString('en-IN');
    return `${color}[${timestamp}] ${prefix}${COLORS.reset} ${message}`;
}

export const logger = {
    server: (msg) => console.log(formatMessage('SERVER', COLORS.blue, msg)),
    pipeline: (msg) => console.log(formatMessage('PIPELINE', COLORS.cyan, msg)),
    threat: (msg) => console.log(formatMessage('THREAT', COLORS.yellow, msg)),
    admin: (msg) => console.log(formatMessage('ADMIN', COLORS.magenta, msg)),
    auth: (msg) => console.log(formatMessage('AUTH', COLORS.green, msg)),
    error: (msg) => console.error(formatMessage('ERROR', COLORS.red, msg)),
    python: (msg) => console.log(formatMessage('PYTHON', COLORS.green, msg))
};
