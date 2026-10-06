import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

const sql = spawnSync('which', ['sql'], { encoding: 'utf8' }).stdout?.trim();
const sqlclHome = process.env.APEXREST_TEST_SQLCL_HOME || (sql ? path.dirname(path.dirname(sql)) : '');
// SQLcl 26.1 ships the compiler in lib/, 26.3 in lib/ext/; the bridge classpath covers both.
const available =
  ['lib/apexlang-compiler.jar', 'lib/ext/apexlang-compiler.jar'].some((jar) =>
    existsSync(path.join(sqlclHome, jar)),
  ) && spawnSync('javac', ['-version']).status === 0;
const classpath = [path.join(sqlclHome, 'lib', '*'), path.join(sqlclHome, 'lib', 'ext', '*')].join(
  path.delimiter,
);

test(
  'ORDS bridge uses the real Oracle compiler and preserves one-request import payloads',
  { skip: !available },
  async (t) => {
    const directory = await mkdtemp(path.join(tmpdir(), 'apexrest-ords-bridge-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const compiled = spawnSync(
      'javac',
      ['-cp', classpath, '-d', directory, 'resources/ords/OrdsBridge.java'],
      { encoding: 'utf8' },
    );
    assert.equal(compiled.status, 0, compiled.stderr);
    let sequence = 0;
    const run = async (job: Record<string, unknown>) => {
      const output = path.join(directory, `report-${++sequence}.json`);
      const jobFile = path.join(directory, `job-${sequence}.json`);
      await writeFile(jobFile, JSON.stringify({ ...job, output }));
      const execution = spawnSync(
        'java',
        ['-cp', `${directory}${path.delimiter}${classpath}`, 'OrdsBridge', jobFile],
        { encoding: 'utf8', timeout: 60000 },
      );
      const report = JSON.parse(await readFile(output, 'utf8'));
      return { execution, report };
    };
    const deployment = path.join(directory, 'deployment.json');
    await writeFile(
      deployment,
      JSON.stringify({
        app: {
          id: 912345,
          alias: 'ORDS-VERIFY',
          name: 'ORDS Unicode Україна',
          databaseSession: { parsingSchema: 'ORDS_VERIFY' },
        },
        workspace: { name: 'ORDS_VERIFY' },
      }),
    );
    const good = await run({
      operation: 'compile',
      input: path.resolve('templates/blank-app/application'),
      deployment,
    });
    assert.equal(good.execution.status, 0, good.report.message);
    assert.equal(good.report.status, 'succeeded');
    assert.equal(good.report.compilerMmdVersion, '26.1.0+3102');
    assert.equal(good.report.databaseRequests, 1);
    assert.equal(good.report.targetConfigured, true);
    assert.ok(good.report.blockCount >= 3);
    assert.match(good.report.statement, /json_table\(\?,/i);
    assert.match(good.report.statement, /order by ordinal/i);
    assert.match(good.report.blocks[0], /set_workspace\('ORDS_VERIFY'\)/);
    assert.match(good.report.blocks[0], /set_application_id\(912345\)/);
    const source = good.report.blocks.join('\n');
    assert.match(source, /import_begin/);
    assert.match(source, /import_end/);
    assert.match(source, /ORDS-VERIFY/);
    assert.ok(source.includes("unistr('ORDS Unicode \\0423\\043A\\0440\\0430\\0457\\043D\\0430')"));
    assert.ok(!good.report.blocks.some((block: string) => /^\s*\/\s*$/m.test(block)));
    assert.match(good.execution.stdout, /APEXREST_ORDS_COMPLETE/);

    const badSource = path.join(directory, 'invalid');
    await cp('templates/blank-app/application', badSource, { recursive: true });
    await writeFile(path.join(badSource, 'application.apx'), 'app BROKEN ( unknownProperty: value )');
    const bad = await run({ operation: 'compile', input: badSource, deployment });
    assert.notEqual(bad.execution.status, 0);
    assert.equal(bad.report.status, 'failed');
    assert.equal(bad.report.writeStarted, undefined);

    const scripts = path.join(directory, 'scripts');
    await mkdir(scripts);
    await writeFile(path.join(scripts, 'install.sql'), 'set define off\n@@body.sql\nprompt done\n');
    await writeFile(path.join(scripts, 'body.sql'), "begin dbms_output.put_line('Україна'); end;\n/\n");
    const expanded = await run({ operation: 'prepare-script', input: path.join(scripts, 'install.sql') });
    assert.equal(expanded.report.status, 'succeeded');
    assert.match(expanded.report.script, /Україна/);
    assert.ok(!expanded.report.script.includes('@@'));
    await writeFile(path.join(scripts, 'body.sql'), '@@install.sql\n');
    const cyclic = await run({ operation: 'prepare-script', input: path.join(scripts, 'install.sql') });
    assert.equal(cyclic.report.status, 'failed');
    assert.match(cyclic.report.message, /cyclic/);
    await writeFile(path.join(scripts, 'body.sql'), '@@../outside.sql\n');
    await writeFile(path.join(directory, 'outside.sql'), 'select 1 from dual;');
    const escaping = await run({ operation: 'prepare-script', input: path.join(scripts, 'install.sql') });
    assert.equal(escaping.report.status, 'failed');
    assert.match(escaping.report.message, /Unsafe/);
  },
);

test(
  'ORDS archive extraction rejects traversal and preserves binary and hidden metadata',
  { skip: !available },
  async (t) => {
    const directory = await mkdtemp(path.join(tmpdir(), 'apexrest-ords-zip-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const harness = path.join(directory, 'ArchiveChecks.java');
    await writeFile(
      harness,
      `
import java.io.*; import java.nio.file.*; import java.util.*; import java.util.zip.*;
public class ArchiveChecks {
  static byte[] zip(String name, byte[] bytes) throws Exception {
    var out = new ByteArrayOutputStream();
    try (var zip = new ZipOutputStream(out)) { zip.putNextEntry(new ZipEntry(name)); zip.write(bytes); zip.closeEntry(); }
    return out.toByteArray();
  }
  public static void main(String[] args) throws Exception {
    Path root = Path.of(args[0]);
    byte[] bytes = new byte[]{0, 1, 2, -1, 0, -128};
    OrdsBridge.extractZip(zip("shared-components/static-files/image.bin", bytes), root.resolve("good"));
    if (!Arrays.equals(bytes, Files.readAllBytes(root.resolve("good/shared-components/static-files/image.bin")))) throw new Exception("Binary changed");
    OrdsBridge.extractZip(zip(".apex/apexlang.json", "{}".getBytes()), root.resolve("metadata"));
    if (!Files.exists(root.resolve("metadata/.apex/apexlang.json"))) throw new Exception("Metadata lost");
    for (String name : List.of("../escape", "/absolute", "folder/../../escape", "folder\\\\escape")) {
      try { OrdsBridge.extractZip(zip(name, bytes), root.resolve("unsafe-" + Math.abs(name.hashCode()))); throw new Exception("Unsafe path accepted"); }
      catch (IOException expected) { }
    }
  }
}`,
    );
    const compile = spawnSync(
      'javac',
      ['-cp', classpath, '-d', directory, 'resources/ords/OrdsBridge.java', harness],
      { encoding: 'utf8' },
    );
    assert.equal(compile.status, 0, compile.stderr);
    const run = spawnSync(
      'java',
      ['-cp', `${directory}${path.delimiter}${classpath}`, 'ArchiveChecks', directory],
      { encoding: 'utf8', timeout: 30000 },
    );
    assert.equal(run.status, 0, run.stderr);
  },
);
