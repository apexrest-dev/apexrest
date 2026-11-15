/** The part of node-oracledb the web application's driver worker uses. */
declare module 'oracledb' {
  export interface BindParameter {
    dir?: number;
    type?: unknown;
    maxSize?: number;
    val?: unknown;
  }
  export interface Result {
    metaData?: { name: string; dbType?: unknown }[];
    rows?: unknown[];
    rowsAffected?: number;
    lastRowid?: string;
    outBinds?: unknown;
  }
  export interface ExecuteOptions {
    maxRows?: number;
    outFormat?: number;
    fetchTypeHandler?: unknown;
  }
  export interface Connection {
    callTimeout: number;
    execute(
      sql: string,
      binds?: Record<string, unknown> | unknown[],
      options?: ExecuteOptions,
    ): Promise<Result>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
    close(): Promise<void>;
  }
  export function getConnection(attributes: {
    user: string;
    password: string;
    connectString: string;
  }): Promise<Connection>;
  export const BIND_IN: number;
  export const BIND_INOUT: number;
  export const BIND_OUT: number;
  export const OUT_FORMAT_ARRAY: number;
  export const STRING: unknown;
  export const BUFFER: unknown;
  export const CLOB: unknown;
  export const DB_TYPE_DATE: unknown;
  export const DB_TYPE_TIMESTAMP: unknown;
  export const DB_TYPE_TIMESTAMP_TZ: unknown;
  export const DB_TYPE_TIMESTAMP_LTZ: unknown;
  export const DB_TYPE_CLOB: unknown;
  export const DB_TYPE_NCLOB: unknown;
  export const DB_TYPE_RAW: unknown;
  export const DB_TYPE_BLOB: unknown;
}
