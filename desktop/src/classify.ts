const credential = /(?:^|[\\/])(?:\.env(?:\..+)?|credentials(?:\..+)?|id_rsa|id_ed25519|\.netrc|auth\.json)$|\.(?:pem|p12|pfx|key)$|secret/i;
const sensitive = /(?:^|[\\/])(?:\.ssh|\.gnupg|wallet|keystore|passwords?)(?:$|[\\/])/i;
const source = /\.(?:ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|rb|c|h|cc|cpp|cs|swift|sql|md|json|yml|yaml|toml)$/i;
const testCommand = /\b(?:pytest|vitest|jest|mocha|phpunit|rspec|npx test|npm test|pnpm test|yarn test|cargo test|go test)\b/i;
const dangerousCommand = /\brm\s+-rf\b|\bsudo\b|\bchmod\s+777\b|\bcurl\b.+\|\s*(?:ba)?sh\b/i;

export function classifyFile(path: string): 'credential' | 'sensitive' | 'source' | 'unknown' {
  if (credential.test(path)) return 'credential';
  if (sensitive.test(path)) return 'sensitive';
  if (source.test(path)) return 'source';
  return 'unknown';
}

export function classifyCommand(command: string): { classification: 'test' | 'dangerous' | 'command'; isTest: boolean } {
  if (testCommand.test(command)) return { classification: 'test', isTest: true };
  if (dangerousCommand.test(command)) return { classification: 'dangerous', isTest: false };
  return { classification: 'command', isTest: false };
}

export function decodeClaudeProjectFolder(name: string): string {
  if (!name.startsWith('-')) return name.replace(/-/g, '/');
  return name.slice(1).replace(/-/g, '/');
}

export function repositoryHint(projectPath: string): string | undefined {
  const parts = projectPath.split(/[\\/]/).filter(Boolean);
  const last = parts.at(-1);
  return last && last.length <= 256 ? last : undefined;
}
