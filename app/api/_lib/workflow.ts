import { execFile } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

type CommandAttempt = {
  command: string;
  args: string[];
};

export async function runGrantCommand(args: string[]) {
  const rootDir = process.cwd();
  const commandPath = [
    "/usr/local/bin",
    "/opt/homebrew/bin",
    "/usr/bin",
    "/bin",
    process.env.PATH ?? ""
  ]
    .filter(Boolean)
    .join(":");
  const env = { ...process.env, PATH: commandPath };
  const localPython = path.join(rootDir, ".venv", "bin", "python");
  const commands: CommandAttempt[] = [
    { command: "/usr/local/bin/uv", args: ["run", "python", ...args] },
    { command: "/opt/homebrew/bin/uv", args: ["run", "python", ...args] },
    { command: "uv", args: ["run", "python", ...args] },
    { command: localPython, args },
    { command: "/usr/local/bin/python3", args },
    { command: "/opt/homebrew/bin/python3", args },
    { command: "/usr/bin/python3", args },
    { command: "python3", args },
    { command: "python", args }
  ].filter((item) => !item.command.includes("/") || existsSync(item.command));
  const errors: string[] = [];

  for (const item of commands) {
    try {
      const { stdout } = await execFileAsync(item.command, item.args, {
        cwd: rootDir,
        maxBuffer: 1024 * 1024 * 12,
        env
      });
      return stdout;
    } catch (error) {
      errors.push(`${item.command}: ${error instanceof Error ? error.message : "failed"}`);
    }
  }

  throw new Error(
    [
      "Could not start the local Grant Rider Python workflow.",
      "Install uv or Python, or set GRANT_RIDER_API_URL to use a remote backend.",
      ...errors
    ].join("\n")
  );
}
