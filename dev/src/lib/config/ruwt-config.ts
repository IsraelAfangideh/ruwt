/**
 * Parser for .ruwt.yml configuration files.
 *
 * These files live at the root of a project and tell the IDE:
 * - What mode the project needs (browser or cloud)
 * - Machine specs for cloud mode
 * - Setup commands to run on first boot
 * - Available tasks (shown in the IDE task runner)
 * - Environment variables needed at runtime
 */
import { parse as parseYaml } from 'yaml';

/** A single task definition from the config. */
export interface RuwtTask {
  command: string;
  label: string;
}

/** Parsed .ruwt.yml configuration. */
export interface RuwtConfig {
  name: string;
  mode?: 'browser' | 'cloud';
  machine?: {
    spec?: string;
    region?: string;
  };
  setup?: string[];
  tasks?: Record<string, RuwtTask>;
  env?: string[];
}

/**
 * Parse a .ruwt.yml string into a typed RuwtConfig.
 * Throws if the YAML is invalid or required fields are missing.
 */
export function parseRuwtConfig(yaml: string): RuwtConfig {
  const raw = parseYaml(yaml);

  if (raw == null || typeof raw !== 'object') {
    throw new Error('Invalid .ruwt.yml: expected a YAML mapping');
  }

  if (typeof raw.name !== 'string' || raw.name.trim() === '') {
    throw new Error('Invalid .ruwt.yml: "name" is required and must be a non-empty string');
  }

  const config: RuwtConfig = {
    name: raw.name.trim(),
  };

  // mode
  if (raw.mode !== undefined) {
    if (raw.mode !== 'browser' && raw.mode !== 'cloud') {
      throw new Error('Invalid .ruwt.yml: "mode" must be "browser" or "cloud"');
    }
    config.mode = raw.mode;
  }

  // machine
  if (raw.machine !== undefined) {
    if (typeof raw.machine !== 'object' || raw.machine === null) {
      throw new Error('Invalid .ruwt.yml: "machine" must be a mapping');
    }
    config.machine = {};
    if (raw.machine.spec !== undefined) {
      config.machine.spec = String(raw.machine.spec);
    }
    if (raw.machine.region !== undefined) {
      config.machine.region = String(raw.machine.region);
    }
  }

  // setup
  if (raw.setup !== undefined) {
    if (!Array.isArray(raw.setup)) {
      throw new Error('Invalid .ruwt.yml: "setup" must be an array');
    }
    config.setup = raw.setup.map((item: unknown) => String(item));
  }

  // tasks
  if (raw.tasks !== undefined) {
    if (typeof raw.tasks !== 'object' || raw.tasks === null || Array.isArray(raw.tasks)) {
      throw new Error('Invalid .ruwt.yml: "tasks" must be a mapping');
    }
    config.tasks = {};
    for (const [key, value] of Object.entries(raw.tasks)) {
      if (typeof value !== 'object' || value === null) {
        throw new Error(`Invalid .ruwt.yml: task "${key}" must be a mapping with "command" and "label"`);
      }
      const taskObj = value as Record<string, unknown>;
      if (typeof taskObj.command !== 'string') {
        throw new Error(`Invalid .ruwt.yml: task "${key}" is missing "command"`);
      }
      if (typeof taskObj.label !== 'string') {
        throw new Error(`Invalid .ruwt.yml: task "${key}" is missing "label"`);
      }
      config.tasks[key] = {
        command: taskObj.command,
        label: taskObj.label,
      };
    }
  }

  // env
  if (raw.env !== undefined) {
    if (!Array.isArray(raw.env)) {
      throw new Error('Invalid .ruwt.yml: "env" must be an array');
    }
    config.env = raw.env.map((item: unknown) => String(item));
  }

  return config;
}
