import { writeFile, readFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

// Reference the original ignored regular ENV file; never materialize credentials
// in the qualification project or persisted metrics.
export async function prepareAgentInstructions(root, envFile, environment) {
  const text = `# Qualification project\n\nFor observable instruction-loading evidence, explicitly read CLAUDE.md in Claude Code or AGENTS.md in Codex before executing the task. The identified ${environment} application is configured in apexrest.json. Use the installed APEXREST plugin. Only task-scoped local source edits and read-only Oracle calls are authorized unless the current human prompt explicitly requests application import. Do not use the browser unless requested. No business DML, authentication changes, production changes, publishing, host settings or Git changes are authorized. Credentials may be read as literal data from the original ignored regular ENV file at ${path.resolve(envFile)} without exposing them. Do not copy that file or its values into this project or evidence.\n`;
  for (const name of ['AGENTS.md', 'CLAUDE.md'])
    await writeFile(path.join(root, name), text, { mode: 0o600 });
}

export function instructionReadObserved(records, fileName) {
  for (const r of records) {
    const calls =
      r.type === 'assistant'
        ? (r.message?.content?.filter((b) => b.type === 'tool_use') ?? [])
        : r.type === 'response_item' && r.payload?.type === 'function_call'
          ? [{ name: r.payload.name, input: r.payload.arguments }]
          : [];
    for (const call of calls) {
      const input = typeof call.input === 'string' ? call.input : JSON.stringify(call.input ?? {});
      if (
        input.includes(fileName) &&
        (/^Read$|read_file/i.test(call.name) ||
          (/Bash|exec_command|functions.exec/i.test(call.name) && /\bcat\b|\bsed\b|readFile/.test(input)))
      )
        return true;
    }
  }
  return false;
}

export async function auditPrivateArtifacts(root, secrets = []) {
  const result = { envCopiesRemoved: 0, credentialFilesRemoved: 0 };
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (entry.isFile()) {
        if (entry.name === 'test.env') {
          await rm(file);
          result.envCopiesRemoved++;
        } else {
          const text = await readFile(file, 'utf8');
          if (
            secrets.some(
              (secret) =>
                secret.length >= 4 &&
                (text.includes(secret) || text.includes(JSON.stringify(secret).slice(1, -1))),
            )
          ) {
            await rm(file);
            result.credentialFilesRemoved++;
          }
        }
      }
    }
  }
  await walk(root);
  return result;
}
