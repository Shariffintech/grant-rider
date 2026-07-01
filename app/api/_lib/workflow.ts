import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

type CommandAttempt = {
  command: string;
  args: string[];
};

export async function runGrantCommand(args: string[]) {
  const commands: CommandAttempt[] = [
    { command: "uv", args: ["run", "python", ...args] },
    { command: "python3", args },
    { command: "python", args }
  ];
  const errors: string[] = [];

  for (const item of commands) {
    try {
      const { stdout } = await execFileAsync(item.command, item.args, {
        cwd: process.cwd(),
        maxBuffer: 1024 * 1024 * 12,
        env: process.env
      });
      return stdout;
    } catch (error) {
      errors.push(`${item.command}: ${error instanceof Error ? error.message : "failed"}`);
    }
  }

  throw new Error(errors.join("\n"));
}
