export function extractAssistantUsage(event) {
  const info = event && event.type === "message.updated"
    && event.properties && event.properties.info;
  if (!info || info.role !== "assistant" || typeof info.id !== "string" || !info.id) return null;
  const sessionId = typeof info.sessionID === "string" && info.sessionID ? info.sessionID : null;
  if (!sessionId) return null;
  const tokens = info.tokens && typeof info.tokens === "object" ? info.tokens : {};
  return {
    sessionId,
    messageId: info.id,
    model: typeof info.modelID === "string" && info.modelID ? info.modelID : null,
    provider: typeof info.providerID === "string" && info.providerID ? info.providerID : null,
    inputTokens: Number.isFinite(tokens.input) && tokens.input >= 0 ? Math.floor(tokens.input) : 0,
    outputTokens: Number.isFinite(tokens.output) && tokens.output >= 0 ? Math.floor(tokens.output) : 0,
    totalCost: Number.isFinite(info.cost) && info.cost >= 0 ? info.cost : 0,
  };
}

export function accumulateAssistantUsage(event, usageMessagesPerSession) {
  const usage = extractAssistantUsage(event);
  if (!usage) return null;
  let messages = usageMessagesPerSession.get(usage.sessionId);
  if (!messages) {
    messages = new Map();
    usageMessagesPerSession.set(usage.sessionId, messages);
  }
  messages.set(usage.messageId, usage);
  let inputTokens = 0;
  let outputTokens = 0;
  let totalCost = 0;
  for (const message of messages.values()) {
    inputTokens += message.inputTokens;
    outputTokens += message.outputTokens;
    totalCost += message.totalCost;
  }
  return {
    sessionId: usage.sessionId,
    model: usage.model,
    provider: usage.provider,
    inputTokens,
    outputTokens,
    totalCost,
  };
}
