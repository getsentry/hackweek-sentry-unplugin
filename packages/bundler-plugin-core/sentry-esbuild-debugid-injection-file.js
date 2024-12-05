try {
  var globalObject = globalThis;

  var stack = new globalObject.Error().stack;

  if (stack) {
    globalObject._sentryDebugIds = globalObject._sentryDebugIds || {};
    globalObject._sentryDebugIds[stack] = "__SENTRY_DEBUG_ID__";
    globalObject._sentryDebugIdIdentifier = "sentry-dbid-__SENTRY_DEBUG_ID__";
  }
} catch (e) {}
