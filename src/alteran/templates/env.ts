export interface EnvTemplateInput {
  runtimeDir: string;
  cacheDir: string;
  platformDir: string;
  denoBinDir: string;
  alteranEntry: string;
  appAliases: string[];
  toolAliases: string[];
}

export function renderShellEnv(input: EnvTemplateInput): string {
  return [
    `export ALTERAN_HOME="${input.runtimeDir}"`,
    `export DENO_DIR="${input.cacheDir}"`,
    `export DENO_INSTALL_ROOT="${input.platformDir}"`,
    `export PATH="${input.denoBinDir}:$PATH"`,
    `alteran() { deno run -A "${input.alteranEntry}" "$@"; }`,
    "alias alt='alteran'",
    "alias arun='alteran run'",
    "alias atask='alteran task'",
    "alias atest='alteran test'",
    "alias ax='alteran x'",
    "alias adeno='alteran deno'",
    ...input.appAliases,
    ...input.toolAliases,
    "",
  ].join("\n");
}

export function renderBatchEnv(input: EnvTemplateInput): string {
  return [
    "@echo off",
    `set "ALTERAN_HOME=${input.runtimeDir}"`,
    `set "DENO_DIR=${input.cacheDir}"`,
    `set "DENO_INSTALL_ROOT=${input.platformDir}"`,
    `set "PATH=${input.denoBinDir};%PATH%"`,
    `doskey alteran=deno run -A "${input.alteranEntry}" $*`,
    "doskey alt=alteran $*",
    "doskey arun=alteran run $*",
    "doskey atask=alteran task $*",
    "doskey atest=alteran test $*",
    "doskey ax=alteran x $*",
    "doskey adeno=alteran deno $*",
    ...input.appAliases,
    ...input.toolAliases,
    "",
  ].join("\r\n");
}
