import { IncludeEntry as UserIncludeEntry, Options as UserOptions } from "./types";

type RequiredInternalOptions = Required<
  Pick<
    UserOptions,
    | "release"
    | "finalize"
    | "dryRun"
    | "debug"
    | "silent"
    | "cleanArtifacts"
    | "telemetry"
    | "injectReleasesMap"
  >
>;

type OptionalInternalOptions = Partial<
  Pick<
    UserOptions,
    | "org"
    | "project"
    | "authToken"
    | "url"
    | "vcsRemote"
    | "dist"
    | "errorHandler"
    | "setCommits"
    | "deploy"
    | "configFile"
    | "customHeader"
  >
>;

type NormalizedInternalOptions = {
  entries: (string | RegExp)[] | ((filePath: string) => boolean) | undefined;
  include: InternalIncludeEntry[];
};

export type InternalOptions = RequiredInternalOptions &
  OptionalInternalOptions &
  NormalizedInternalOptions;

type RequiredInternalIncludeEntry = Required<
  Pick<
    UserIncludeEntry,
    "paths" | "ext" | "stripCommonPrefix" | "sourceMapReference" | "rewrite" | "validate"
  >
>;

type OptionalInternalIncludeEntry = Partial<
  Pick<UserIncludeEntry, "ignoreFile" | "urlPrefix" | "urlSuffix" | "stripPrefix">
>;

export type InternalIncludeEntry = RequiredInternalIncludeEntry &
  OptionalInternalIncludeEntry & {
    ignore: string[];
  };

export function normalizeUserOptions(userOptions: UserOptions): InternalOptions {
  return {
    // include is the only strictly required option
    // (normalizeInclude needs all userOptions to access top-level include options)
    include: normalizeInclude(userOptions),

    // These options must be set b/c we need them for release injection.
    // They can also be set as environment variables. Technically, they
    // could be set in the config file but this would be too late for
    // release injection because we only pass the config file path
    // to the CLI
    org: userOptions.org ?? process.env["SENTRY_ORG"],
    project: userOptions.project ?? process.env["SENTRY_PROJECT"],
    release: userOptions.release ?? process.env["SENTRY_RELEASE"] ?? "",

    // These options and can also be set via env variables or config file
    // but are only passed to Sentry CLI. They could remain undefined
    // because the config file is only read by the CLI
    authToken: userOptions.authToken ?? process.env["SENTRY_AUTH_TOKEN"],
    customHeader: userOptions.customHeader ?? process.env["CUSTOM_HEADER"],
    url: userOptions.url ?? process.env["SENTRY_URL"] ?? "https://sentry.io/",
    vcsRemote: userOptions.vcsRemote ?? process.env["SENTRY_VCS_REMOTE"] ?? "origin",

    // Options with default values
    finalize: userOptions.finalize ?? true,
    cleanArtifacts: userOptions.cleanArtifacts ?? false,
    dryRun: userOptions.dryRun ?? false,
    debug: userOptions.debug ?? false,
    silent: userOptions.silent ?? false,
    telemetry: userOptions.telemetry ?? true,
    injectReleasesMap: userOptions.injectReleasesMap ?? false,

    // Optional options
    setCommits: userOptions.setCommits,
    deploy: userOptions.deploy,
    entries: normalizeEntries(userOptions.entries),
    dist: userOptions.dist,
    errorHandler: userOptions.errorHandler,
    configFile: userOptions.configFile,
  };
}

/**
 * Converts the user-facing `entries` option to the internal `entries` option
 */
function normalizeEntries(
  userEntries: UserOptions["entries"]
): (string | RegExp)[] | ((filePath: string) => boolean) | undefined {
  if (userEntries === undefined) {
    return undefined;
  } else if (typeof userEntries === "function" || Array.isArray(userEntries)) {
    return userEntries;
  } else {
    return [userEntries];
  }
}

/**
 * Converts the user-facing `include` option to the internal `include` option,
 * resulting in an array of `InternalIncludeEntry` objects. This later on lets us
 * work with only one type of include data structure instead of multiple.
 *
 * During the process, we hoist top-level include options (e.g. urlPrefix) into each
 * object if they were not alrady specified in an `IncludeEntry`, making every object
 * fully self-contained. This is also the reason why we pass the entire options
 * object and not just `include`.
 *
 * @param userOptions the entire user-facing `options` object
 *
 * @return an array of `InternalIncludeEntry` objects.
 */
function normalizeInclude(userOptions: UserOptions): InternalIncludeEntry[] {
  const rawUserInclude = userOptions.include;

  let userInclude: UserIncludeEntry[];
  if (typeof rawUserInclude === "string") {
    userInclude = [convertIncludePathToIncludeEntry(rawUserInclude)];
  } else if (Array.isArray(rawUserInclude)) {
    userInclude = rawUserInclude.map((potentialIncludeEntry) => {
      if (typeof potentialIncludeEntry === "string") {
        return convertIncludePathToIncludeEntry(potentialIncludeEntry);
      } else {
        return potentialIncludeEntry;
      }
    });
  } else {
    userInclude = [rawUserInclude];
  }

  return userInclude.map((userIncludeEntry) =>
    normalizeIncludeEntry(userOptions, userIncludeEntry)
  );
}

function convertIncludePathToIncludeEntry(includePath: string): UserIncludeEntry {
  return {
    paths: [includePath],
  };
}

/**
 * Besides array-ifying the `ignore` option, this function hoists top level options into the items of the `include`
 * option. This is to simplify the handling of of the `include` items later on.
 */
function normalizeIncludeEntry(
  userOptions: UserOptions,
  includeEntry: UserIncludeEntry
): InternalIncludeEntry {
  const ignoreOption = includeEntry.ignore ?? userOptions.ignore ?? ["node_modules"];
  const ignore = Array.isArray(ignoreOption) ? ignoreOption : [ignoreOption];

  // We're prefixing all entries in the `ext` option with a `.` (if it isn't already) to align with Node.js' `path.extname()`
  const ext = includeEntry.ext ?? userOptions.ext ?? ["js", "map", "jsbundle", "bundle"];
  const dotPrefixedExt = ext.map((extension) => `.${extension.replace(/^\./, "")}`);

  return {
    paths: includeEntry.paths,
    ignore,
    ignoreFile: includeEntry.ignoreFile ?? userOptions.ignoreFile,
    ext: dotPrefixedExt,
    urlPrefix: includeEntry.urlPrefix ?? userOptions.urlPrefix,
    urlSuffix: includeEntry.urlSuffix ?? userOptions.urlSuffix,
    stripPrefix: includeEntry.stripPrefix ?? userOptions.stripPrefix,
    stripCommonPrefix: includeEntry.stripCommonPrefix ?? userOptions.stripCommonPrefix ?? false,
    sourceMapReference: includeEntry.sourceMapReference ?? userOptions.sourceMapReference ?? true,
    rewrite: includeEntry.rewrite ?? userOptions.rewrite ?? true,
    validate: includeEntry.validate ?? userOptions.validate ?? false,
  };
}
