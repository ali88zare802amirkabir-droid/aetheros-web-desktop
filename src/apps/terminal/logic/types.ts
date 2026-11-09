export interface CmdResult {
  stdout: string;
  stderr: string;
  code: number;
}

export interface ShellContext {
  cwd: string;
  env: Record<string, string>;
  aliases: Record<string, string>;
  history: string[];
  vfs: any;
  state: any;
  openApp?: (id: string, args?: any) => void;
  openWith?: (node: any, name: string) => void;
}

export interface TerminalCommand {
  name: string;
  description: string;
  usage?: string;
  run(ctx: ShellContext, args: string[], stdin?: string): CmdResult | Promise<CmdResult>;
}
