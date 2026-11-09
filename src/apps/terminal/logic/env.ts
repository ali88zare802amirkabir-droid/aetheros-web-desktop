export interface TerminalEnv {
  vars: Record<string, string>;
  aliases: Record<string, string>;
  cwd: string;
}

export function createEnv(): TerminalEnv {
  return {
    vars: {
      USER: 'user',
      HOST: 'myos',
      HOME: '',
      PWD: '',
      PATH: '/bin',
      SHELL: '/bin/sh',
      TERM: 'xterm-256color',
    },
    aliases: {},
    cwd: '',
  };
}

export function expandVars(s: string, env: TerminalEnv): string {
  return s.replace(/\$([A-Za-z_][A-Za-z0-9_]*)|\$\{([^}]+)\}/g, (_, a, b) => {
    const key = a || b;
    if (key === 'PWD') return env.cwd || '/';
    if (key === 'HOME') return env.vars.HOME || '';
    return env.vars[key] ?? '';
  });
}
