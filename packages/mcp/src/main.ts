if (Number(process.versions.node.split('.')[0]) < 24) {
  process.stderr.write('APEXREST requires Node.js 24 or newer.\n');
  process.exit(3);
}
const { startMcp } = await import('./server.ts');
await startMcp();
