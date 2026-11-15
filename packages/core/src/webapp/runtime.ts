// Entry point of the web application runtime that `apexrest build webapp` copies into its output.
export { hashPassword, runWebapp, startWebapp, verifyPassword } from './server.ts';
export type { WebappAuth, WebappConfig, WebappOptions } from './server.ts';
