/** Returns true if code already reads stdin (model ignored instructions). */
function codeReadsStdin(code: string, lang: string): boolean {
  if (lang === 'python') return /\bsys\.stdin\b|\binput\s*\(/.test(code);
  return /process\.stdin|fs\.readFileSync\s*\(\s*0/.test(code);
}

function stdinOutputGuard(lang: string): { prefix: string; restore: string } {
  if (lang === 'python') {
    const _null = 'type("",(),{"write":lambda *a:0,"flush":lambda *a:0})()';
    return {
      prefix: `import sys as _sys;_stdout=_sys.stdout;_stderr=_sys.stderr;_sys.stdout=${_null};_sys.stderr=${_null}\ntry:\n`,
      restore: '\nexcept:\n    pass\n_sys.stdout=_stdout;_sys.stderr=_stderr\n',
    };
  }
  return {
    prefix: [
      'const _stdw=process.stdout.write.bind(process.stdout);process.stdout.write=()=>true;',
      'const _stde=process.stderr.write.bind(process.stderr);process.stderr.write=()=>true;',
      'try{',
    ].join('\n') + '\n',
    restore: [
      '',
      '}catch(_e){}',
      'process.stdout.write=_stdw;process.stderr.write=_stde;',
      'process.on("uncaughtException",(e)=>{if(e instanceof ReferenceError){console.error(e.message+". Make sure your code defines this function.");process.exit(1);}});',
    ].join('\n') + '\n',
  };
}

function assembleStdinCode(sourceCode: string, language: string, testHarness: string): string {
  const guard = stdinOutputGuard(language);
  const wrapped = language === 'python'
    ? sourceCode.split('\n').map((l) => '    ' + l).join('\n')
    : sourceCode;
  return guard.prefix + wrapped + guard.restore + testHarness;
}

export function assembleVersusCode(
  sourceCode: string,
  language: string,
  challenge: { testHarness?: string | null; useStdin?: number | null; readonlyPrefix?: string | null },
): string {
  const useStdin = !!challenge.useStdin;
  let codeToRun = sourceCode;
  const skipHarness = useStdin && challenge.testHarness && codeReadsStdin(sourceCode, language);
  if (challenge.testHarness && !skipHarness) {
    if (useStdin) {
      codeToRun = assembleStdinCode(codeToRun, language, challenge.testHarness);
    } else {
      codeToRun += '\n' + challenge.testHarness;
    }
  }
  if (challenge.readonlyPrefix) codeToRun = challenge.readonlyPrefix + '\n' + codeToRun;
  return codeToRun;
}
