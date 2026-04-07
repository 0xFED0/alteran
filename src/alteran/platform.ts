export interface PlatformInfo {
  os: string;
  arch: string;
  id: string;
  denoBinaryName: string;
  archiveTarget: string;
  archiveExtension: "zip" | "gz";
  pathSeparator: string;
}

function normalizeArch(arch: string): string {
  switch (arch) {
    case "x86_64":
    case "amd64":
      return "x64";
    case "aarch64":
      return "arm64";
    default:
      return arch;
  }
}

function normalizeOs(os: string): string {
  switch (os) {
    case "darwin":
      return "macos";
    case "windows":
      return "windows";
    default:
      return os;
  }
}

export function detectPlatform(): PlatformInfo {
  const os = normalizeOs(Deno.build.os);
  const arch = normalizeArch(Deno.build.arch);

  let archiveTarget: string;
  let archiveExtension: "zip" | "gz";

  switch (`${os}-${arch}`) {
    case "macos-x64":
      archiveTarget = "x86_64-apple-darwin";
      archiveExtension = "zip";
      break;
    case "macos-arm64":
      archiveTarget = "aarch64-apple-darwin";
      archiveExtension = "zip";
      break;
    case "linux-x64":
      archiveTarget = "x86_64-unknown-linux-gnu";
      archiveExtension = "zip";
      break;
    case "linux-arm64":
      archiveTarget = "aarch64-unknown-linux-gnu";
      archiveExtension = "zip";
      break;
    case "windows-x64":
      archiveTarget = "x86_64-pc-windows-msvc";
      archiveExtension = "zip";
      break;
    case "windows-arm64":
      archiveTarget = "aarch64-pc-windows-msvc";
      archiveExtension = "zip";
      break;
    default:
      archiveTarget = `${Deno.build.arch}-${Deno.build.os}`;
      archiveExtension = "zip";
      break;
  }

  return {
    os,
    arch,
    id: `${os}-${arch}`,
    denoBinaryName: Deno.build.os === "windows" ? "deno.exe" : "deno",
    archiveTarget,
    archiveExtension,
    pathSeparator: Deno.build.os === "windows" ? ";" : ":",
  };
}
