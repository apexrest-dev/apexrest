# AI services and reasoning effort in APEX 26.2

The service's `advanced.providerApi` selects Responses for OpenAI, Generic OpenAI Compatible or Ollama, Generic/Responses for OCI, and Interactions for Gemini. Verify endpoint and model compatibility. Preserve custom headers and attributes during migration; do not infer API compatibility from provider name. OCI fields are `ociGenAI.compartmentId`, `servingMode`, `endpointId` and `projectId`; Responses requires a project and Dedicated requires an endpoint.

Agents set `advanced.reasoningEffort` independently. Values are none, minimal, low, medium, high, xhigh and max. Omit the property for provider default; default does not mean no reasoning. xhigh and max differ. Native Cohere does not support this control. Provider/model support and token/latency behavior require actual service checks.

```plsql
l_response := apex_ai.generate(
    p_prompt => 'Review the release dependencies.',
    p_service_static_id => 'review-service',
    p_reasoning_effort => apex_ai.c_reasoning_effort_medium );
```

APEX_AI.CHAT accepts the same parameter. Application AI Request Handlers can adjust `p_result.request.reasoning_effort`; constrain overrides to the intended component. This PL/SQL example is reference syntax, not an executed provider call.

AI navigation requires Show AI Assistant, an AI Agent and an application Request Handler. The application defines allowed destinations and parameters and validates/expands links locally. Keep final session URLs and checksums out of model messages; verify authorization for every destination. This facility is not a general agent tool or provider-hosted conversation memory.

Use the compiler-checked recipe for declaration syntax. The inventory describes metadata fields as well as source properties: component identifiers carry static IDs, so do not copy `advanced.staticId` into these declarations. The bundled AI metadata recipe is offline compiler evidence only. Creating workspace AI services/credentials is excluded from selected-file import and requires the existing full-import or separately authorized workspace workflow. No provider credential, service availability or runtime success is established by compilation.

Sources: [provider APIs and effort](https://blogs.oracle.com/apex/working-with-generative-ai-provider-apis-and-reasoning-effort), [AI navigation](https://docs.oracle.com/en/database/oracle/apex/26.2/htmrn/new-features.html).
