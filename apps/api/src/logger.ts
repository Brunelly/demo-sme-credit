// One JSON object per line on stdout/stderr: the platform keeps the recent lines and shows them when the app
// crashes. Log what happened and the ids involved; never log secrets, keys or whole request bodies.

type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const ORDER: Record<Level | "silent", number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

function threshold(): number {
  const configured = process.env.LOG_LEVEL as keyof typeof ORDER | undefined;
  return ORDER[configured ?? "info"] ?? ORDER.info;
}

function serialise(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack, cause: serialise(value.cause) };
  }
  return value;
}

function write(level: Level, message: string, fields: Fields = {}): void {
  if (ORDER[level] < threshold()) return;
  const entry: Fields = { time: new Date().toISOString(), level, message };
  for (const [key, value] of Object.entries(fields)) entry[key] = serialise(value);
  const line = JSON.stringify(entry);
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, fields?: Fields) => write("debug", message, fields),
  info: (message: string, fields?: Fields) => write("info", message, fields),
  warn: (message: string, fields?: Fields) => write("warn", message, fields),
  error: (message: string, fields?: Fields) => write("error", message, fields),
};
