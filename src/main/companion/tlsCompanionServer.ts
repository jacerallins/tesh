import crypto from "node:crypto";
import tls from "node:tls";
import { readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import type { AuditService } from "../auditService";
import type { CompanionService } from "./companionService";
import { parseCompanionMessage } from "../../shared/companionWire";

export interface CompanionServerOptions {
  host?: string;
  port?: number;
  certificate: string;
  privateKey: string;
  idleTimeoutMs?: number;
  maxRequestsPerMinute?: number;
}

export class TlsCompanionServer {
  private server?: tls.Server;
  constructor(
    private readonly service: CompanionService,
    private readonly audit: AuditService,
  ) {}
  async start(options: CompanionServerOptions): Promise<AddressInfo> {
    if (!options.certificate || !options.privateKey)
      throw new Error(
        "Companion TLS certificate and private key are required.",
      );
    const certificate = await this.readPem(options.certificate);
    const privateKey = await this.readPem(options.privateKey);
    const idleTimeoutMs = options.idleTimeoutMs ?? 60_000;
    const maxRequests = options.maxRequestsPerMinute ?? 60;
    this.server = tls.createServer(
      { cert: certificate, key: privateKey, minVersion: "TLSv1.3" },
      (socket) => {
        let buffer = "";
        let requests = 0;
        const windowStarted = Date.now();
        socket.setTimeout(idleTimeoutMs, () => socket.destroy());
        socket.setEncoding("utf8");
        socket.on("data", (chunk: string) => {
          buffer += chunk;
          if (buffer.length > 64 * 1024) {
            socket.destroy();
            return;
          }
          let newline = buffer.indexOf("\n");
          while (newline >= 0) {
            const line = buffer.slice(0, newline);
            buffer = buffer.slice(newline + 1);
            newline = buffer.indexOf("\n");
            if (!line) continue;
            if (Date.now() - windowStarted > 60_000) requests = 0;
            if (++requests > maxRequests) {
              socket.write(
                `${JSON.stringify({ type: "ERROR", error: "Rate limit exceeded." })}\n`,
              );
              socket.destroy();
              return;
            }
            void this.handleLine(socket, line);
          }
        });
        socket.on("close", () => this.audit.record("COMPANION_DISCONNECTED"));
      },
    );
    await new Promise<void>((resolve, reject) => {
      this.server!.once("error", reject);
      this.server!.listen(options.port ?? 0, options.host ?? "127.0.0.1", () =>
        resolve(),
      );
    });
    return this.server.address() as AddressInfo;
  }
  private async readPem(value: string): Promise<string> {
    try {
      return await readFile(value, "utf8");
    } catch {
      return value;
    }
  }
  private async handleLine(socket: tls.TLSSocket, line: string): Promise<void> {
    let requestId: string = crypto.randomUUID();
    let deviceId = "unknown";
    try {
      const message = parseCompanionMessage(JSON.parse(line) as unknown);
      requestId = message.requestId;
      deviceId = message.deviceId;
      if (message.type === "PAIRING_CHALLENGE_REQUEST") {
        const challenge = await this.service.createPairingChallenge();
        socket.write(
          `${JSON.stringify({ messageId: crypto.randomUUID(), deviceId: "desktop", type: "PAIRING_CHALLENGE_RESPONSE", timestamp: new Date().toISOString(), requestId: message.requestId, payload: challenge })}\n`,
        );
        return;
      }
      if (message.type === "PAIR_REQUEST") {
        const device = await this.service.pair(message.payload as never);
        socket.write(
          `${JSON.stringify({ messageId: crypto.randomUUID(), deviceId: device.id, type: "PAIR_RESPONSE", timestamp: new Date().toISOString(), requestId: message.requestId, payload: device })}\n`,
        );
        return;
      }
      if (message.type === "AUTH_REQUEST") {
        const session = this.service.authenticate(message as never);
        socket.write(
          `${JSON.stringify({ messageId: crypto.randomUUID(), deviceId: message.deviceId, type: "AUTH_RESPONSE", timestamp: new Date().toISOString(), requestId: message.requestId, payload: session })}\n`,
        );
        return;
      }
      if (message.type === "COMMAND_REQUEST") {
        const command = message as typeof message & {
          payload: { sessionId: string; command: string; input?: unknown };
        };
        const response = await this.service.handleCommand(
          {
            ...command,
            payload: {
              sessionId: command.payload.sessionId,
              command: command.payload.command,
              input: command.payload.input,
            },
          },
          async (name) => {
            if (name !== "get_tesh_status")
              throw new Error("Command is unavailable.");
            return {
              connectionState: "CONNECTED",
              interactionState: "idle",
              companionConnection: "CONNECTED",
            };
          },
        );
        socket.write(`${JSON.stringify(response)}\n`);
        return;
      }
      this.service.validateIncoming(message);
    } catch {
      this.audit.record("COMPANION_AUTH_FAILED", deviceId);
      socket.write(
        `${JSON.stringify({ messageId: crypto.randomUUID(), deviceId, type: "ERROR", timestamp: new Date().toISOString(), requestId, payload: { error: "Request rejected." } })}\n`,
      );
    }
  }
  async stop(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>((resolve) => this.server!.close(() => resolve()));
    this.server = undefined;
  }
}
