"use strict";

const readline = require("readline");
const { listTools, callTool } = require("./tools");
const { log } = require("./utils/logger");
const { preloadGlobalContextCache } = require("./utils/global_context_cache");

const PROTOCOL_VERSION = "2024-11-05";

function sendMessage(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function sendError(id, code, message, data) {
  sendMessage({
    jsonrpc: "2.0",
    id,
    error: { code, message, data },
  });
}

function sendResult(id, result) {
  sendMessage({ jsonrpc: "2.0", id, result });
}

function runServer() {
  const rl = readline.createInterface({ input: process.stdin });

  rl.on("line", async (line) => {
    if (!line.trim()) return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch (err) {
      return sendError(null, -32700, "Parse error");
    }

    if (!msg || msg.jsonrpc !== "2.0") {
      return sendError(msg && msg.id ? msg.id : null, -32600, "Invalid Request");
    }

    const id = msg.id ?? null;
    const method = msg.method;

    try {
      if (method === "initialize") {
        preloadGlobalContextCache();
        const result = {
          protocolVersion: PROTOCOL_VERSION,
          serverInfo: {
            name: "scout-mcp",
            version: "0.1.0",
          },
          capabilities: {
            tools: {},
          },
        };
        return sendResult(id, result);
      }

      if (method === "tools/list") {
        return sendResult(id, { tools: listTools() });
      }

      if (method === "tools/call") {
        const params = msg.params || {};
        const name = params.name;
        const args = params.arguments || {};
        const started = Date.now();
        log("info", "tool_call", { name });
        const result = await callTool(name, args);
        log("info", "tool_done", { name, ms: Date.now() - started, isError: result.isError === true });
        return sendResult(id, result);
      }

      if (method === "ping") {
        return sendResult(id, {});
      }

      return sendError(id, -32601, "Method not found", { method });
    } catch (err) {
      return sendError(id, -32000, "Server error", {
        message: err && err.message ? err.message : String(err),
      });
    }
  });
}

module.exports = { runServer };
