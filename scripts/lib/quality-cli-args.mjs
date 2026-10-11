// Project overrides replace the default; CLI rejects duplicate options.
export function qualityCliArgs(runtime, operation, project, args = {}) {
  const { project: override, ...options } = args;
  const result = [runtime, ...operation.split(' '), '--project', override ?? project, '--json'];
  for (const [key, value] of Object.entries(options))
    result.push(
      '--' + key.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase()),
      ...(Array.isArray(value) ? value.map(String) : [String(value)]),
    );
  return result;
}
