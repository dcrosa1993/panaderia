const CONNECTION_URL =
  /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s"'<>]+/gi;
const CREDENTIAL_ASSIGNMENT =
  /\b(password|token|secret|authorization)\b\s*[:=]\s*("[^"]*"|'[^']*'|[^\s,;]+)/gi;
const BEARER_TOKEN = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;

export function formatBootstrapError(
  error: unknown,
  sensitiveValues: readonly string[],
): string {
  const rawErrorName =
    error instanceof Error && error.name ? error.name : 'UnknownError';
  const errorName = /^[A-Za-z][A-Za-z0-9_.]*$/.test(rawErrorName)
    ? rawErrorName
    : 'UnknownError';
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'An unrecognized error occurred.';
  const code = getPrismaCode(error);
  const details = redactSensitiveValues(message, sensitiveValues)
    .replace(CONNECTION_URL, '[redacted connection URL]')
    .replace(CREDENTIAL_ASSIGNMENT, '$1=[redacted]')
    .replace(BEARER_TOKEN, 'Bearer [redacted]')
    .replace(/[\r\n\t]+/g, ' ')
    .trim();

  return `Bootstrap failed [${errorName}${code ? `, ${code}` : ''}]: ${details || 'No error message available.'}`;
}

function getPrismaCode(error: unknown): string | undefined {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    /^P\d{4}$/.test(error.code)
  ) {
    return error.code;
  }
  return undefined;
}

function redactSensitiveValues(
  message: string,
  sensitiveValues: readonly string[],
): string {
  return [...new Set(sensitiveValues)]
    .filter((value) => value.length > 0)
    .sort((left, right) => right.length - left.length)
    .reduce(
      (safeMessage, value) => safeMessage.replaceAll(value, '[redacted]'),
      message,
    );
}
