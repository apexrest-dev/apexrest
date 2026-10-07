import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);
import {
  ArtifactService,
  JobService,
  dispatch,
  schemas,
  settleInlineJobs,
  shutdownOracle,
  toolCatalog
} from "./chunk-DLVT3ED2.mjs";
import {
  VERSION
} from "./chunk-Q357QWPS.mjs";
import {
  AjvJsonSchemaValidator,
  CallToolRequestSchema,
  CallToolResultSchema,
  CreateMessageResultSchema,
  CreateMessageResultWithToolsSchema,
  CreateTaskResultSchema,
  ElicitResultSchema,
  EmptyResultSchema,
  ErrorCode,
  InitializeRequestSchema,
  InitializedNotificationSchema,
  LATEST_PROTOCOL_VERSION,
  ListRootsResultSchema,
  ListToolsRequestSchema,
  LoggingLevelSchema,
  McpError,
  Protocol,
  ReadBuffer,
  SUPPORTED_PROTOCOL_VERSIONS,
  SetLevelRequestSchema,
  assertClientRequestTaskCapability,
  assertToolsCallTaskCapability,
  getLiteralValue,
  getObjectShape,
  mergeCapabilities,
  safeParse,
  serializeMessage
} from "./chunk-XXDZEVC4.mjs";
import "./chunk-WPD35JL5.mjs";
import {
  loadProject,
  parse
} from "./chunk-TFGUUAFT.mjs";
import {
  external_exports
} from "./chunk-U7MVLA3R.mjs";
import {
  Fault,
  failure,
  hash,
  sanitized,
  success
} from "./chunk-I5KYBPSK.mjs";

// node_modules/@modelcontextprotocol/sdk/dist/esm/experimental/tasks/server.js
var ExperimentalServerTasks = class {
  constructor(_server) {
    this._server = _server;
  }
  /**
   * Sends a request and returns an AsyncGenerator that yields response messages.
   * The generator is guaranteed to end with either a 'result' or 'error' message.
   *
   * This method provides streaming access to request processing, allowing you to
   * observe intermediate task status updates for task-augmented requests.
   *
   * @param request - The request to send
   * @param resultSchema - Zod schema for validating the result
   * @param options - Optional request options (timeout, signal, task creation params, etc.)
   * @returns AsyncGenerator that yields ResponseMessage objects
   *
   * @experimental
   */
  requestStream(request, resultSchema, options) {
    return this._server.requestStream(request, resultSchema, options);
  }
  /**
   * Sends a sampling request and returns an AsyncGenerator that yields response messages.
   * The generator is guaranteed to end with either a 'result' or 'error' message.
   *
   * For task-augmented requests, yields 'taskCreated' and 'taskStatus' messages
   * before the final result.
   *
   * @example
   * ```typescript
   * const stream = server.experimental.tasks.createMessageStream({
   *     messages: [{ role: 'user', content: { type: 'text', text: 'Hello' } }],
   *     maxTokens: 100
   * }, {
   *     onprogress: (progress) => {
   *         // Handle streaming tokens via progress notifications
   *         console.log('Progress:', progress.message);
   *     }
   * });
   *
   * for await (const message of stream) {
   *     switch (message.type) {
   *         case 'taskCreated':
   *             console.log('Task created:', message.task.taskId);
   *             break;
   *         case 'taskStatus':
   *             console.log('Task status:', message.task.status);
   *             break;
   *         case 'result':
   *             console.log('Final result:', message.result);
   *             break;
   *         case 'error':
   *             console.error('Error:', message.error);
   *             break;
   *     }
   * }
   * ```
   *
   * @param params - The sampling request parameters
   * @param options - Optional request options (timeout, signal, task creation params, onprogress, etc.)
   * @returns AsyncGenerator that yields ResponseMessage objects
   *
   * @experimental
   */
  createMessageStream(params, options) {
    const clientCapabilities = this._server.getClientCapabilities();
    if ((params.tools || params.toolChoice) && !clientCapabilities?.sampling?.tools) {
      throw new Error("Client does not support sampling tools capability.");
    }
    if (params.messages.length > 0) {
      const lastMessage = params.messages[params.messages.length - 1];
      const lastContent = Array.isArray(lastMessage.content) ? lastMessage.content : [lastMessage.content];
      const hasToolResults = lastContent.some((c) => c.type === "tool_result");
      const previousMessage = params.messages.length > 1 ? params.messages[params.messages.length - 2] : void 0;
      const previousContent = previousMessage ? Array.isArray(previousMessage.content) ? previousMessage.content : [previousMessage.content] : [];
      const hasPreviousToolUse = previousContent.some((c) => c.type === "tool_use");
      if (hasToolResults) {
        if (lastContent.some((c) => c.type !== "tool_result")) {
          throw new Error("The last message must contain only tool_result content if any is present");
        }
        if (!hasPreviousToolUse) {
          throw new Error("tool_result blocks are not matching any tool_use from the previous message");
        }
      }
      if (hasPreviousToolUse) {
        const toolUseIds = new Set(previousContent.filter((c) => c.type === "tool_use").map((c) => c.id));
        const toolResultIds = new Set(lastContent.filter((c) => c.type === "tool_result").map((c) => c.toolUseId));
        if (toolUseIds.size !== toolResultIds.size || ![...toolUseIds].every((id) => toolResultIds.has(id))) {
          throw new Error("ids of tool_result blocks and tool_use blocks from previous message do not match");
        }
      }
    }
    return this.requestStream({
      method: "sampling/createMessage",
      params
    }, CreateMessageResultSchema, options);
  }
  /**
   * Sends an elicitation request and returns an AsyncGenerator that yields response messages.
   * The generator is guaranteed to end with either a 'result' or 'error' message.
   *
   * For task-augmented requests (especially URL-based elicitation), yields 'taskCreated'
   * and 'taskStatus' messages before the final result.
   *
   * @example
   * ```typescript
   * const stream = server.experimental.tasks.elicitInputStream({
   *     mode: 'url',
   *     message: 'Please authenticate',
   *     elicitationId: 'auth-123',
   *     url: 'https://example.com/auth'
   * }, {
   *     task: { ttl: 300000 } // Task-augmented for long-running auth flow
   * });
   *
   * for await (const message of stream) {
   *     switch (message.type) {
   *         case 'taskCreated':
   *             console.log('Task created:', message.task.taskId);
   *             break;
   *         case 'taskStatus':
   *             console.log('Task status:', message.task.status);
   *             break;
   *         case 'result':
   *             console.log('User action:', message.result.action);
   *             break;
   *         case 'error':
   *             console.error('Error:', message.error);
   *             break;
   *     }
   * }
   * ```
   *
   * @param params - The elicitation request parameters
   * @param options - Optional request options (timeout, signal, task creation params, etc.)
   * @returns AsyncGenerator that yields ResponseMessage objects
   *
   * @experimental
   */
  elicitInputStream(params, options) {
    const clientCapabilities = this._server.getClientCapabilities();
    const mode = params.mode ?? "form";
    switch (mode) {
      case "url": {
        if (!clientCapabilities?.elicitation?.url) {
          throw new Error("Client does not support url elicitation.");
        }
        break;
      }
      case "form": {
        if (!clientCapabilities?.elicitation?.form) {
          throw new Error("Client does not support form elicitation.");
        }
        break;
      }
    }
    const normalizedParams = mode === "form" && params.mode === void 0 ? { ...params, mode: "form" } : params;
    return this.requestStream({
      method: "elicitation/create",
      params: normalizedParams
    }, ElicitResultSchema, options);
  }
  /**
   * Gets the current status of a task.
   *
   * @param taskId - The task identifier
   * @param options - Optional request options
   * @returns The task status
   *
   * @experimental
   */
  async getTask(taskId, options) {
    return this._server.getTask({ taskId }, options);
  }
  /**
   * Retrieves the result of a completed task.
   *
   * @param taskId - The task identifier
   * @param resultSchema - Zod schema for validating the result
   * @param options - Optional request options
   * @returns The task result
   *
   * @experimental
   */
  async getTaskResult(taskId, resultSchema, options) {
    return this._server.getTaskResult({ taskId }, resultSchema, options);
  }
  /**
   * Lists tasks with optional pagination.
   *
   * @param cursor - Optional pagination cursor
   * @param options - Optional request options
   * @returns List of tasks with optional next cursor
   *
   * @experimental
   */
  async listTasks(cursor, options) {
    return this._server.listTasks(cursor ? { cursor } : void 0, options);
  }
  /**
   * Cancels a running task.
   *
   * @param taskId - The task identifier
   * @param options - Optional request options
   *
   * @experimental
   */
  async cancelTask(taskId, options) {
    return this._server.cancelTask({ taskId }, options);
  }
};

// node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js
var Server = class extends Protocol {
  /**
   * Initializes this server with the given name and version information.
   */
  constructor(_serverInfo, options) {
    super(options);
    this._serverInfo = _serverInfo;
    this._loggingLevels = /* @__PURE__ */ new Map();
    this.LOG_LEVEL_SEVERITY = new Map(LoggingLevelSchema.options.map((level, index) => [level, index]));
    this.isMessageIgnored = (level, sessionId) => {
      const currentLevel = this._loggingLevels.get(sessionId);
      return currentLevel ? this.LOG_LEVEL_SEVERITY.get(level) < this.LOG_LEVEL_SEVERITY.get(currentLevel) : false;
    };
    this._capabilities = options?.capabilities ?? {};
    this._instructions = options?.instructions;
    this._jsonSchemaValidator = options?.jsonSchemaValidator ?? new AjvJsonSchemaValidator();
    this.setRequestHandler(InitializeRequestSchema, (request) => this._oninitialize(request));
    this.setNotificationHandler(InitializedNotificationSchema, () => this.oninitialized?.());
    if (this._capabilities.logging) {
      this.setRequestHandler(SetLevelRequestSchema, async (request, extra) => {
        const transportSessionId = extra.sessionId || extra.requestInfo?.headers["mcp-session-id"] || void 0;
        const { level } = request.params;
        const parseResult = LoggingLevelSchema.safeParse(level);
        if (parseResult.success) {
          this._loggingLevels.set(transportSessionId, parseResult.data);
        }
        return {};
      });
    }
  }
  /**
   * Access experimental features.
   *
   * WARNING: These APIs are experimental and may change without notice.
   *
   * @experimental
   */
  get experimental() {
    if (!this._experimental) {
      this._experimental = {
        tasks: new ExperimentalServerTasks(this)
      };
    }
    return this._experimental;
  }
  /**
   * Registers new capabilities. This can only be called before connecting to a transport.
   *
   * The new capabilities will be merged with any existing capabilities previously given (e.g., at initialization).
   */
  registerCapabilities(capabilities) {
    if (this.transport) {
      throw new Error("Cannot register capabilities after connecting to transport");
    }
    this._capabilities = mergeCapabilities(this._capabilities, capabilities);
  }
  /**
   * Override request handler registration to enforce server-side validation for tools/call.
   */
  setRequestHandler(requestSchema, handler) {
    const shape = getObjectShape(requestSchema);
    const methodSchema = shape?.method;
    if (!methodSchema) {
      throw new Error("Schema is missing a method literal");
    }
    const methodValue = getLiteralValue(methodSchema);
    if (typeof methodValue !== "string") {
      throw new Error("Schema method literal must be a string");
    }
    const method = methodValue;
    if (method === "tools/call") {
      const wrappedHandler = async (request, extra) => {
        const validatedRequest = safeParse(CallToolRequestSchema, request);
        if (!validatedRequest.success) {
          const errorMessage = validatedRequest.error instanceof Error ? validatedRequest.error.message : String(validatedRequest.error);
          throw new McpError(ErrorCode.InvalidParams, `Invalid tools/call request: ${errorMessage}`);
        }
        const { params } = validatedRequest.data;
        const result = await Promise.resolve(handler(request, extra));
        if (params.task) {
          const taskValidationResult = safeParse(CreateTaskResultSchema, result);
          if (!taskValidationResult.success) {
            const errorMessage = taskValidationResult.error instanceof Error ? taskValidationResult.error.message : String(taskValidationResult.error);
            throw new McpError(ErrorCode.InvalidParams, `Invalid task creation result: ${errorMessage}`);
          }
          return taskValidationResult.data;
        }
        const validationResult = safeParse(CallToolResultSchema, result);
        if (!validationResult.success) {
          const errorMessage = validationResult.error instanceof Error ? validationResult.error.message : String(validationResult.error);
          throw new McpError(ErrorCode.InvalidParams, `Invalid tools/call result: ${errorMessage}`);
        }
        return validationResult.data;
      };
      return super.setRequestHandler(requestSchema, wrappedHandler);
    }
    return super.setRequestHandler(requestSchema, handler);
  }
  assertCapabilityForMethod(method) {
    switch (method) {
      case "sampling/createMessage":
        if (!this._clientCapabilities?.sampling) {
          throw new Error(`Client does not support sampling (required for ${method})`);
        }
        break;
      case "elicitation/create":
        if (!this._clientCapabilities?.elicitation) {
          throw new Error(`Client does not support elicitation (required for ${method})`);
        }
        break;
      case "roots/list":
        if (!this._clientCapabilities?.roots) {
          throw new Error(`Client does not support listing roots (required for ${method})`);
        }
        break;
      case "ping":
        break;
    }
  }
  assertNotificationCapability(method) {
    switch (method) {
      case "notifications/message":
        if (!this._capabilities.logging) {
          throw new Error(`Server does not support logging (required for ${method})`);
        }
        break;
      case "notifications/resources/updated":
      case "notifications/resources/list_changed":
        if (!this._capabilities.resources) {
          throw new Error(`Server does not support notifying about resources (required for ${method})`);
        }
        break;
      case "notifications/tools/list_changed":
        if (!this._capabilities.tools) {
          throw new Error(`Server does not support notifying of tool list changes (required for ${method})`);
        }
        break;
      case "notifications/prompts/list_changed":
        if (!this._capabilities.prompts) {
          throw new Error(`Server does not support notifying of prompt list changes (required for ${method})`);
        }
        break;
      case "notifications/elicitation/complete":
        if (!this._clientCapabilities?.elicitation?.url) {
          throw new Error(`Client does not support URL elicitation (required for ${method})`);
        }
        break;
      case "notifications/cancelled":
        break;
      case "notifications/progress":
        break;
    }
  }
  assertRequestHandlerCapability(method) {
    if (!this._capabilities) {
      return;
    }
    switch (method) {
      case "completion/complete":
        if (!this._capabilities.completions) {
          throw new Error(`Server does not support completions (required for ${method})`);
        }
        break;
      case "logging/setLevel":
        if (!this._capabilities.logging) {
          throw new Error(`Server does not support logging (required for ${method})`);
        }
        break;
      case "prompts/get":
      case "prompts/list":
        if (!this._capabilities.prompts) {
          throw new Error(`Server does not support prompts (required for ${method})`);
        }
        break;
      case "resources/list":
      case "resources/templates/list":
      case "resources/read":
        if (!this._capabilities.resources) {
          throw new Error(`Server does not support resources (required for ${method})`);
        }
        break;
      case "tools/call":
      case "tools/list":
        if (!this._capabilities.tools) {
          throw new Error(`Server does not support tools (required for ${method})`);
        }
        break;
      case "tasks/get":
      case "tasks/list":
      case "tasks/result":
      case "tasks/cancel":
        if (!this._capabilities.tasks) {
          throw new Error(`Server does not support tasks capability (required for ${method})`);
        }
        break;
      case "ping":
      case "initialize":
        break;
    }
  }
  assertTaskCapability(method) {
    assertClientRequestTaskCapability(this._clientCapabilities?.tasks?.requests, method, "Client");
  }
  assertTaskHandlerCapability(method) {
    if (!this._capabilities) {
      return;
    }
    assertToolsCallTaskCapability(this._capabilities.tasks?.requests, method, "Server");
  }
  async _oninitialize(request) {
    const requestedVersion = request.params.protocolVersion;
    this._clientCapabilities = request.params.capabilities;
    this._clientVersion = request.params.clientInfo;
    const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requestedVersion) ? requestedVersion : LATEST_PROTOCOL_VERSION;
    return {
      protocolVersion,
      capabilities: this.getCapabilities(),
      serverInfo: this._serverInfo,
      ...this._instructions && { instructions: this._instructions }
    };
  }
  /**
   * After initialization has completed, this will be populated with the client's reported capabilities.
   */
  getClientCapabilities() {
    return this._clientCapabilities;
  }
  /**
   * After initialization has completed, this will be populated with information about the client's name and version.
   */
  getClientVersion() {
    return this._clientVersion;
  }
  getCapabilities() {
    return this._capabilities;
  }
  async ping() {
    return this.request({ method: "ping" }, EmptyResultSchema);
  }
  // Implementation
  async createMessage(params, options) {
    if (params.tools || params.toolChoice) {
      if (!this._clientCapabilities?.sampling?.tools) {
        throw new Error("Client does not support sampling tools capability.");
      }
    }
    if (params.messages.length > 0) {
      const lastMessage = params.messages[params.messages.length - 1];
      const lastContent = Array.isArray(lastMessage.content) ? lastMessage.content : [lastMessage.content];
      const hasToolResults = lastContent.some((c) => c.type === "tool_result");
      const previousMessage = params.messages.length > 1 ? params.messages[params.messages.length - 2] : void 0;
      const previousContent = previousMessage ? Array.isArray(previousMessage.content) ? previousMessage.content : [previousMessage.content] : [];
      const hasPreviousToolUse = previousContent.some((c) => c.type === "tool_use");
      if (hasToolResults) {
        if (lastContent.some((c) => c.type !== "tool_result")) {
          throw new Error("The last message must contain only tool_result content if any is present");
        }
        if (!hasPreviousToolUse) {
          throw new Error("tool_result blocks are not matching any tool_use from the previous message");
        }
      }
      if (hasPreviousToolUse) {
        const toolUseIds = new Set(previousContent.filter((c) => c.type === "tool_use").map((c) => c.id));
        const toolResultIds = new Set(lastContent.filter((c) => c.type === "tool_result").map((c) => c.toolUseId));
        if (toolUseIds.size !== toolResultIds.size || ![...toolUseIds].every((id) => toolResultIds.has(id))) {
          throw new Error("ids of tool_result blocks and tool_use blocks from previous message do not match");
        }
      }
    }
    if (params.tools) {
      return this.request({ method: "sampling/createMessage", params }, CreateMessageResultWithToolsSchema, options);
    }
    return this.request({ method: "sampling/createMessage", params }, CreateMessageResultSchema, options);
  }
  /**
   * Creates an elicitation request for the given parameters.
   * For backwards compatibility, `mode` may be omitted for form requests and will default to `'form'`.
   * @param params The parameters for the elicitation request.
   * @param options Optional request options.
   * @returns The result of the elicitation request.
   */
  async elicitInput(params, options) {
    const mode = params.mode ?? "form";
    switch (mode) {
      case "url": {
        if (!this._clientCapabilities?.elicitation?.url) {
          throw new Error("Client does not support url elicitation.");
        }
        const urlParams = params;
        return this.request({ method: "elicitation/create", params: urlParams }, ElicitResultSchema, options);
      }
      case "form": {
        if (!this._clientCapabilities?.elicitation?.form) {
          throw new Error("Client does not support form elicitation.");
        }
        const formParams = params.mode === "form" ? params : { ...params, mode: "form" };
        const result = await this.request({ method: "elicitation/create", params: formParams }, ElicitResultSchema, options);
        if (result.action === "accept" && result.content && formParams.requestedSchema) {
          try {
            const validator = this._jsonSchemaValidator.getValidator(formParams.requestedSchema);
            const validationResult = validator(result.content);
            if (!validationResult.valid) {
              throw new McpError(ErrorCode.InvalidParams, `Elicitation response content does not match requested schema: ${validationResult.errorMessage}`);
            }
          } catch (error) {
            if (error instanceof McpError) {
              throw error;
            }
            throw new McpError(ErrorCode.InternalError, `Error validating elicitation response: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        return result;
      }
    }
  }
  /**
   * Creates a reusable callback that, when invoked, will send a `notifications/elicitation/complete`
   * notification for the specified elicitation ID.
   *
   * @param elicitationId The ID of the elicitation to mark as complete.
   * @param options Optional notification options. Useful when the completion notification should be related to a prior request.
   * @returns A function that emits the completion notification when awaited.
   */
  createElicitationCompletionNotifier(elicitationId, options) {
    if (!this._clientCapabilities?.elicitation?.url) {
      throw new Error("Client does not support URL elicitation (required for notifications/elicitation/complete)");
    }
    return () => this.notification({
      method: "notifications/elicitation/complete",
      params: {
        elicitationId
      }
    }, options);
  }
  async listRoots(params, options) {
    return this.request({ method: "roots/list", params }, ListRootsResultSchema, options);
  }
  /**
   * Sends a logging message to the client, if connected.
   * Note: You only need to send the parameters object, not the entire JSON RPC message
   * @see LoggingMessageNotification
   * @param params
   * @param sessionId optional for stateless and backward compatibility
   */
  async sendLoggingMessage(params, sessionId) {
    if (this._capabilities.logging) {
      if (!this.isMessageIgnored(params.level, sessionId)) {
        return this.notification({ method: "notifications/message", params });
      }
    }
  }
  async sendResourceUpdated(params) {
    return this.notification({
      method: "notifications/resources/updated",
      params
    });
  }
  async sendResourceListChanged() {
    return this.notification({
      method: "notifications/resources/list_changed"
    });
  }
  async sendToolListChanged() {
    return this.notification({ method: "notifications/tools/list_changed" });
  }
  async sendPromptListChanged() {
    return this.notification({ method: "notifications/prompts/list_changed" });
  }
};

// node_modules/@modelcontextprotocol/sdk/dist/esm/server/stdio.js
import process2 from "node:process";
var StdioServerTransport = class {
  constructor(_stdin = process2.stdin, _stdout = process2.stdout, options) {
    this._stdin = _stdin;
    this._stdout = _stdout;
    this._started = false;
    this._ondata = (chunk) => {
      try {
        this._readBuffer.append(chunk);
        this.processReadBuffer();
      } catch (error) {
        this.onerror?.(error);
        this.close().catch(() => {
        });
      }
    };
    this._onerror = (error) => {
      this.onerror?.(error);
    };
    this._readBuffer = new ReadBuffer({ maxBufferSize: options?.maxBufferSize });
  }
  /**
   * Starts listening for messages on stdin.
   */
  async start() {
    if (this._started) {
      throw new Error("StdioServerTransport already started! If using Server class, note that connect() calls start() automatically.");
    }
    this._started = true;
    this._stdin.on("data", this._ondata);
    this._stdin.on("error", this._onerror);
  }
  processReadBuffer() {
    while (true) {
      try {
        const message = this._readBuffer.readMessage();
        if (message === null) {
          break;
        }
        this.onmessage?.(message);
      } catch (error) {
        this.onerror?.(error);
      }
    }
  }
  async close() {
    this._stdin.off("data", this._ondata);
    this._stdin.off("error", this._onerror);
    const remainingDataListeners = this._stdin.listenerCount("data");
    if (remainingDataListeners === 0) {
      this._stdin.pause();
    }
    this._readBuffer.clear();
    this.onclose?.();
  }
  send(message) {
    return new Promise((resolve) => {
      const json = serializeMessage(message);
      if (this._stdout.write(json)) {
        resolve();
      } else {
        this._stdout.once("drain", resolve);
      }
    });
  }
};

// packages/mcp/src/server.ts
import path from "node:path";
import { fileURLToPath } from "node:url";

// packages/mcp/src/output.ts
var inlineLimit = 8192;
var readerLimit = 32768;
var archives = /* @__PURE__ */ new Map();
var pruneIntervalMs = 36e5;
var pruned = /* @__PURE__ */ new Map();
async function pruneArchives(service, project, now = Date.now()) {
  const last = pruned.get(project);
  if (last !== void 0 && now - last < pruneIntervalMs) return;
  pruned.set(project, now);
  if (pruned.size > 32) pruned.delete(pruned.keys().next().value);
  await service.prune("results").catch(() => void 0);
}
function preview(value, depth = 0) {
  if (Array.isArray(value)) return { count: value.length };
  if (!value || typeof value !== "object") return typeof value === "string" ? value.slice(0, 400) : value;
  const data = value;
  const result = {};
  for (const key of [
    "id",
    "jobId",
    "projectId",
    "project",
    "root",
    "status",
    "ok",
    "operation",
    "exitCode",
    "summary",
    "configured",
    "trusted",
    "browserMode",
    "nextAction",
    "digest",
    "sourceDigest",
    "targetDigest",
    "environment",
    "expiresAt",
    "scope",
    "compiler",
    "approval",
    "backupRequired",
    "mode",
    "backupStrategy",
    "syncId",
    "revision",
    "exportedAt",
    "dirty",
    "blocked",
    "blockedReason",
    "serverFreshness",
    "backupId",
    "importingRunId",
    "phase",
    "runner",
    "planId",
    "planDigest",
    "planPath",
    "runId",
    "warningCount"
  ]) {
    const entry = data[key];
    if (["string", "number", "boolean"].includes(typeof entry))
      result[key] = typeof entry === "string" ? entry.slice(0, 400) : entry;
  }
  for (const key of ["sync", "jobs", "deployments", "diagnostics", "artifacts", "verification"])
    if (Array.isArray(data[key])) result[key + "Count"] = data[key].length;
  if (Array.isArray(data.diagnostics))
    result.diagnostics = data.diagnostics.slice(0, 5).map(
      (entry) => entry && typeof entry === "object" ? Object.fromEntries(
        ["severity", "code", "message", "file", "line", "column", "type", "hint"].filter((key) => ["string", "number"].includes(typeof entry[key])).map((key) => [key, typeof entry[key] === "string" ? entry[key].slice(0, 600) : entry[key]])
      ) : String(entry).slice(0, 300)
    );
  for (const key of ["application", "grant", "verification", "sources"])
    if (data[key] && typeof data[key] === "object" && JSON.stringify(data[key]).length <= 1200)
      result[key] = data[key];
  if (Array.isArray(data.phases) && JSON.stringify(data.phases).length <= 1200) result.phases = data.phases;
  for (const key of ["artifacts", "nextActions", "risks"])
    if (Array.isArray(data[key])) {
      result[key] = data[key].slice(0, 4).map((entry) => String(entry).slice(0, 200));
      result[key + "Omitted"] = Math.max(0, data[key].length - 4);
    }
  for (const key of ["connections", "permissions", "changes", "toolchain"])
    if (data[key] && typeof data[key] === "object") {
      const value2 = data[key];
      if (JSON.stringify(value2).length <= 1200) result[key] = value2;
      else if (key === "connections") result.connections = { count: Object.keys(value2).length };
      else if (key === "permissions")
        result.permissions = {
          activeGrantCount: Array.isArray(value2.activeGrants) ? value2.activeGrants.length : 0
        };
      else if (key === "changes")
        result.changes = {
          status: value2.status,
          fileCount: Array.isArray(value2.files) ? value2.files.length : 0
        };
    }
  if (data.lastSuccessfulImport && typeof data.lastSuccessfulImport === "object")
    result.lastSuccessfulImport = data.lastSuccessfulImport;
  if (data.workingCopy && typeof data.workingCopy === "object") result.workingCopy = data.workingCopy;
  if (data.importSelection && typeof data.importSelection === "object") {
    const selection = data.importSelection;
    const files = Array.isArray(selection.files) ? selection.files.filter((file) => typeof file === "string") : [];
    const shown = [];
    for (const file of files.slice(0, 10)) {
      if (JSON.stringify([...shown, file]).length > 1600) break;
      shown.push(file);
    }
    const count = typeof selection.fileCount === "number" ? selection.fileCount : files.length;
    result.importSelection = {
      requestedMode: selection.requestedMode,
      resolvedMode: selection.resolvedMode,
      ...typeof selection.readbackPolicy === "string" ? { readbackPolicy: selection.readbackPolicy } : {},
      fileCount: count,
      files: shown,
      filesTruncated: count > shown.length || selection.filesTruncated === true,
      reasons: Array.isArray(selection.reasons) ? selection.reasons.slice(0, 5).map((reason) => String(reason).slice(0, 200)) : []
    };
  }
  if (depth < 2 && data.plan && typeof data.plan === "object") result.plan = preview(data.plan, depth + 1);
  if (depth < 2 && data.result && typeof data.result === "object")
    result.result = preview(data.result, depth + 1);
  if (data.operation === "deploy.plan" && data.data && depth < 2) result.data = preview(data.data, depth + 1);
  const plan = ["full-application-import", "selected-file-import"].includes(String(data.scope)) && typeof data.digest === "string";
  if (plan) {
    const operations = data.operations;
    if (Array.isArray(operations))
      result.operationCounts = Object.fromEntries(
        ["migration", "package", "import", "verify", "test"].map((kind) => [
          kind,
          operations.filter((entry) => entry?.kind === kind).length
        ])
      );
    if (data.target && typeof data.target === "object") {
      if (JSON.stringify(data.target).length <= 1200) result.target = data.target;
      else result.targetOmitted = true;
    }
    if (data.sources && typeof data.sources === "object")
      result.sourceCount = Object.keys(data.sources).length;
  } else if (data.sources && typeof data.sources === "object")
    result.sourceCounts = Object.fromEntries(
      Object.entries(data.sources).slice(0, 8).map(([key, files]) => [
        key.slice(0, 80),
        files && typeof files === "object" ? Object.keys(files).length : null
      ])
    );
  return result;
}
async function toolOutput(original, project) {
  const full = sanitized(original);
  const serialized = JSON.stringify(full);
  const reader = ["docs.read", "artifacts.read", "reference"].includes(full.operation);
  let result = full;
  if (serialized.length > (reader ? readerLimit : inlineLimit)) {
    let artifactId;
    let capturedRunId;
    try {
      if (!project) throw new Error("No project is available for a local result artifact.");
      const service = new ArtifactService(await loadProject(project));
      await pruneArchives(service, project);
      const key = hash(project + JSON.stringify({ ...full, runId: "" }));
      const cached = archives.get(key);
      if (cached && await service.read(cached.artifactId, 0, 1).then(
        () => true,
        () => false
      )) {
        ({ artifactId, capturedRunId } = cached);
      } else {
        artifactId = await service.saveJson(full, "mcp-result");
        capturedRunId = full.runId;
        archives.set(key, { artifactId, capturedRunId });
        if (archives.size > 32) archives.delete(archives.keys().next().value);
      }
    } catch {
      artifactId = void 0;
    }
    result = {
      ...full,
      summary: full.summary.slice(0, 600),
      diagnostics: full.diagnostics.slice(0, 5),
      artifacts: artifactId ? [artifactId] : [],
      nextActions: [
        ...full.nextActions.slice(0, 3),
        artifactId ? "For omitted details, use apexrest_artifact_read with output.artifactId and the same project. Follow nextOffset as needed; do not repeat the operation." : "The complete result could not be archived. Inspect the existing local operation record; do not rerun a completed operation."
      ],
      data: {
        ...preview(full.data),
        output: {
          compacted: true,
          characters: serialized.length,
          diagnosticsCount: full.diagnostics.length,
          artifactsCount: full.artifacts.length,
          ...artifactId ? { artifactId, capturedRunId } : { recovery: "unavailable" }
        }
      }
    };
    if (JSON.stringify(result).length > inlineLimit) {
      const data = result.data;
      result.data = Object.fromEntries(
        ["id", "jobId", "status", "phase", "ok", "planPath", "planDigest", "importSelection", "output"].filter((key) => data[key] !== void 0).map((key) => [key, data[key]])
      );
      if (data.result && typeof data.result === "object") {
        const nested = data.result;
        result.data.result = Object.fromEntries(
          ["id", "ok", "status", "exitCode", "operation", "summary"].filter((field) => ["string", "number", "boolean"].includes(typeof nested[field])).map((field) => [field, nested[field]])
        );
      }
      if (JSON.stringify(result).length > inlineLimit)
        result.diagnostics = result.diagnostics.map((d) => ({ ...d, message: d.message.slice(0, 400) }));
    }
  }
  return {
    isError: !result.ok,
    content: [{ type: "text", text: result === full ? serialized : JSON.stringify(result) }]
  };
}

// packages/mcp/src/job-tools.ts
var jobWaitSeconds = external_exports.number().int().min(0).max(30).default(25).describe("Wait for the result or return the existing jobId; default 25 seconds, 0 queues immediately.");
var shipWaitSeconds = external_exports.number().int().min(0).max(120).default(25).describe("Wait for the result or return the existing jobId; default 25 seconds, 0 queues immediately.");
var completedResultSchema = external_exports.object({
  schemaVersion: external_exports.literal(1),
  ok: external_exports.boolean(),
  operation: external_exports.string(),
  status: external_exports.string(),
  runId: external_exports.string(),
  summary: external_exports.string(),
  diagnostics: external_exports.array(
    external_exports.object({
      severity: external_exports.enum(["error", "warning", "info"]),
      code: external_exports.string(),
      message: external_exports.string(),
      file: external_exports.string().optional(),
      line: external_exports.number().int().optional(),
      column: external_exports.number().int().optional(),
      type: external_exports.string().optional(),
      hint: external_exports.string().optional(),
      validValues: external_exports.array(external_exports.string()).optional()
    }).transform(({ severity, code, message, file, line, column, type, hint, validValues }) => ({
      severity,
      code,
      message,
      ...file !== void 0 ? { file } : {},
      ...line !== void 0 ? { line } : {},
      ...column !== void 0 ? { column } : {},
      ...type !== void 0 ? { type } : {},
      ...hint !== void 0 ? { hint } : {},
      ...validValues !== void 0 ? { validValues } : {}
    }))
  ),
  artifacts: external_exports.array(external_exports.string()),
  nextActions: external_exports.array(external_exports.string()),
  data: external_exports.unknown().optional(),
  exitCode: external_exports.union([
    external_exports.literal(0),
    external_exports.literal(1),
    external_exports.literal(2),
    external_exports.literal(3),
    external_exports.literal(4),
    external_exports.literal(5),
    external_exports.literal(6)
  ])
});
function jobToolResult(operation, job) {
  const active = job.status === "queued" || job.status === "running" ? job.status : void 0;
  if (!active && job.result !== void 0) {
    const nested = completedResultSchema.safeParse(job.result);
    if (nested.success && nested.data.operation === operation) return { ...nested.data, data: job };
  }
  const nextActions = typeof job.nextAction === "string" ? [job.nextAction] : ["Read apexrest_job action:status with this jobId; inspect the existing operation before any retry."];
  if (job.status === "completed") {
    const result2 = failure(
      operation,
      new Fault(
        "JOB_RESULT_UNREADABLE",
        "The job completed but its recorded result cannot be read for this operation. Inspect its existing record; do not repeat the operation.",
        1,
        "completed_unreadable"
      )
    );
    return { ...result2, nextActions, data: job };
  }
  if (active)
    return {
      ...success(operation, job, `Job ${job.status}; use the existing jobId to retrieve its result.`),
      status: active,
      nextActions
    };
  const status = job.status === "failed" || job.status === "cancelled" ? job.status : "outcome_unknown";
  const result = failure(
    operation,
    new Fault(
      status === "failed" ? "JOB_FAILED" : status === "cancelled" ? "CANCELLED" : "JOB_OUTCOME_UNKNOWN",
      status === "outcome_unknown" ? "The job outcome is unknown. Inspect its existing record; do not repeat the operation." : `Job ${status}. Inspect the existing operation record.`,
      status === "failed" ? 1 : 6,
      status
    )
  );
  return { ...result, nextActions, data: job };
}
async function runJobTool(jobs, operation, input, runtime, signal, options = {}) {
  const { waitSeconds: requestedWait, ...domainInput } = input;
  const waitSeconds = parse(options.waitSchema ?? jobWaitSeconds, requestedWait);
  if (signal?.aborted)
    throw new Fault("CANCELLED", "Request cancelled before starting a job.", 6, "cancelled");
  const started = options.inline ? await options.inline(operation, domainInput) : await jobs.start(operation, domainInput, runtime);
  if (waitSeconds === 0) return started;
  try {
    const state = await jobs.status(started.jobId, waitSeconds, signal);
    const { nextAction, ...receipt } = started;
    return {
      ...receipt,
      ...state,
      jobId: started.jobId,
      ...["queued", "running"].includes(state.status) ? { nextAction } : {}
    };
  } catch {
    return {
      ...started,
      status: "outcome_unknown",
      nextAction: "Read apexrest_job action:status with this jobId; do not repeat the operation. No cancellation or rollback is confirmed."
    };
  }
}

// packages/mcp/src/server.ts
var absoluteProject = external_exports.string().min(1).max(4096).refine(
  (value) => path.isAbsolute(value) && (process.platform !== "win32" || /^(?:[A-Za-z]:[\\/]|[\\/]{2}[^\\/]+[\\/][^\\/]+)/.test(value)),
  "Provide the absolute project directory containing apexrest.json; the plugin runs from its installation directory."
).describe("Absolute project directory containing apexrest.json; never the plugin cache.");
var projectOptional = /* @__PURE__ */ new Set(["reference", "status", "project"]);
var mcpSchemas = /* @__PURE__ */ new Map();
for (const { operation, long } of toolCatalog) {
  const schema = schemas[operation];
  const transportSchema = "project" in schema.shape ? schema.safeExtend({
    project: projectOptional.has(operation) ? absoluteProject.optional() : absoluteProject
  }) : schema;
  const boundarySchema = operation === "project" ? transportSchema.safeExtend({
    directory: absoluteProject.describe("Absolute directory for init.").optional(),
    passwordFile: absoluteProject.describe("Absolute private password file.").optional(),
    envFile: absoluteProject.describe("Absolute ignored local ENV credential file.").optional()
  }) : transportSchema;
  mcpSchemas.set(
    operation,
    long ? boundarySchema.safeExtend({ waitSeconds: operation === "ship" ? shipWaitSeconds : jobWaitSeconds }) : boundarySchema
  );
}
function listTools() {
  return toolCatalog.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: external_exports.toJSONSchema(mcpSchemas.get(t.operation), { target: "draft-7", io: "input" }),
    annotations: {
      readOnlyHint: t.readOnly,
      destructiveHint: t.destructive ?? false,
      idempotentHint: t.readOnly,
      openWorldHint: t.openWorld ?? false
    }
  }));
}
function detachedJob(operation, _input) {
  const tool = toolCatalog.find((t) => t.operation === operation);
  return tool?.worker ?? false;
}
async function startMcp() {
  const server = new Server({ name: "apexrest-apex", version: VERSION }, { capabilities: { tools: {} } });
  let catalog;
  const runtime = path.join(path.dirname(fileURLToPath(import.meta.url)), "apexrest.mjs");
  server.setRequestHandler(ListToolsRequestSchema, async () => catalog ??= { tools: listTools() });
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const tool = toolCatalog.find((t) => t.name === request.params.name);
    let result;
    let project;
    try {
      if (!tool) throw new Fault("UNKNOWN_TOOL", "Tool is not in the catalog.", 2);
      const input = parse(mcpSchemas.get(tool.operation), request.params.arguments ?? {});
      project = typeof input.project === "string" ? input.project : void 0;
      const localSync = tool.operation === "apex.sync" && input.action === "status";
      const planOnly = tool.operation === "ship" && input.mode === "plan";
      if (localSync || planOnly) delete input.waitSeconds;
      if (tool.long && !localSync && !planOnly) {
        const jobs = new JobService(await loadProject(String(input.project)));
        if (tool.operation === "ship" && input.mode === "apply") {
          const { waitSeconds, ...domainInput } = input;
          const planned = await dispatch("ship", { ...domainInput, mode: "plan" }, extra.signal);
          if (!planned.ok) result = planned;
          else {
            const planPath = planned.data.planPath;
            const job = await runJobTool(
              jobs,
              "ship.apply",
              {
                project: input.project,
                env: input.env,
                plan: planPath,
                userRequest: input.userRequest,
                confirmation: input.confirmation,
                waitSeconds
              },
              runtime,
              extra.signal,
              { waitSchema: shipWaitSeconds }
            );
            result = jobToolResult("ship.apply", job);
            result = {
              ...result,
              operation: "ship",
              data: { ...result.data, plan: planned.data }
            };
          }
        } else {
          const inline = detachedJob(tool.operation, input) ? void 0 : (operation, domainInput) => jobs.startInline(
            operation,
            domainInput,
            (op, args, signal, progress) => dispatch(op, args, signal, progress)
          );
          result = jobToolResult(
            tool.operation,
            await runJobTool(jobs, tool.operation, input, runtime, extra.signal, inline ? { inline } : {})
          );
        }
      } else result = await dispatch(tool.operation, input, extra.signal);
    } catch (e) {
      result = failure(tool?.operation ?? "unknown", e);
    }
    return toolOutput(result, project);
  });
  const transport = new StdioServerTransport();
  const shutdown = async () => {
    await settleInlineJobs();
    await shutdownOracle();
  };
  for (const signal of ["SIGTERM", "SIGINT"])
    process.once(signal, () => {
      void shutdown().finally(() => process.exit(0));
    });
  await server.connect(transport);
  server.onclose = () => {
    void shutdown().finally(() => process.exit(0));
  };
}
export {
  detachedJob,
  listTools,
  mcpSchemas,
  startMcp
};
