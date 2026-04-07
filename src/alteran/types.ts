export interface RegistryEntry {
  path: string;
  name?: string;
  title?: string;
  discovered?: boolean;
}

export interface AutoReimportSection {
  include: string[];
  exclude: string[];
}

export interface LoggingStreamConfig {
  mirror?: boolean;
  capture?: boolean;
}

export interface AlteranConfig {
  name: string;
  auto_refresh_before_run: boolean;
  deno_version?: string;
  logging: {
    stdout: LoggingStreamConfig;
    stderr: LoggingStreamConfig;
    logtape: boolean | Record<string, unknown>;
  };
  apps: Record<string, RegistryEntry>;
  tools: Record<string, RegistryEntry>;
  auto_reimport: {
    apps: AutoReimportSection;
    tools: AutoReimportSection;
  };
}

export interface RootDenoConfig {
  tasks?: Record<string, string>;
  imports?: Record<string, string>;
  workspace?: string[];
}

export interface AppConfig {
  name: string;
  id: string;
  version: string;
  title: string;
  standalone: boolean;
  view: {
    enabled: boolean;
  };
  entry: {
    core: string;
    view: string;
    app: string;
  };
}

export interface LogContext {
  run_id: string;
  root_run_id: string;
  parent_run_id: string | null;
  name: string;
  type: string;
}
