import Foundation
import CryptoKit
import Network
import Security
import Combine

@MainActor final class TeshCompanionClient: ObservableObject {
    @Published private(set) var connected = false
    private let store = DeviceIdentityStore()
    private var connection: NWConnection?
    private var buffer = Data()
    private var waiters: [String: CheckedContinuation<[String: Any], Error>] = [:]
    private var deviceID: String?
    private var sessionID: String?

    func pair(code: String, host: String, port: UInt16, name: String) async throws {
        let identity = try store.ensureKeyPair()
        try await open(host: host, port: port)
        let challenge = try await request(type: "PAIRING_CHALLENGE_REQUEST", deviceID: "pending", payload: [:])
        guard let challengeID = challenge["challengeId"] as? String else { throw CompanionError.invalidResponse }
        let signed = "\(challengeID):\(code):\(name):IOS:iPhone"
        let signature = try identity.privateKey.signature(for: Data(signed.utf8)).base64EncodedString()
        let response = try await request(type: "PAIR_REQUEST", deviceID: "pending", payload: ["challengeId": challengeID, "code": code, "name": name, "platform": "IOS", "deviceType": "iPhone", "publicKey": identity.publicKey.base64EncodedString(), "signature": signature])
        guard let id = response["id"] as? String else { throw CompanionError.invalidResponse }
        deviceID = id
    }

    func authenticate() async throws {
        guard let deviceID else { throw CompanionError.notPaired }
        let identity = try store.ensureKeyPair()
        let messageID = UUID().uuidString
        let requestID = UUID().uuidString
        let nonce = UUID().uuidString
        let timestamp = ISO8601DateFormatter().string(from: Date())
        let signed = "\(messageID):\(deviceID):\(requestID):\(timestamp):\(nonce)"
        let signature = try identity.privateKey.signature(for: Data(signed.utf8)).base64EncodedString()
        let response = try await request(messageID: messageID, requestID: requestID, type: "AUTH_REQUEST", deviceID: deviceID, payload: ["nonce": nonce, "signature": signature])
        guard let session = response["sessionId"] as? String else { throw CompanionError.invalidResponse }
        sessionID = session
        connected = true
    }

    func listMemories() async throws -> [RemoteMemory] { try await decodeList(command: "list_memories", keyType: RemoteMemory.self) }
    func listConversations() async throws -> [RemoteConversation] { try await decodeList(command: "list_conversations", keyType: RemoteConversation.self) }
    func listRoutines() async throws -> [RemoteRoutine] { try await decodeList(command: "list_routines", keyType: RemoteRoutine.self) }

    func sendMessage(_ content: String, conversationId: String? = nil) async throws -> RemoteConversation {
        guard let deviceID, let sessionID else { throw CompanionError.notAuthenticated }
        let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, trimmed.count <= 10000 else { throw CompanionError.invalidRequest }
        var input: [String: Any] = ["content": trimmed]
        if let conversationId, !conversationId.isEmpty { input["conversationId"] = conversationId }
        let p = try await request(type: "COMMAND_REQUEST", deviceID: deviceID, payload: ["sessionId": sessionID, "command": "chat", "input": input])
        guard let value = p["result"] else { throw CompanionError.invalidResponse }
        let data = try JSONSerialization.data(withJSONObject: value)
        return try JSONDecoder().decode(RemoteConversation.self, from: data)
    }

    private func decodeList<T: Decodable>(command: String, keyType: T.Type) async throws -> [T] {
        guard let deviceID, let sessionID else { throw CompanionError.notAuthenticated }
        let p = try await request(type: "COMMAND_REQUEST", deviceID: deviceID, payload: ["sessionId": sessionID, "command": command, "input": [:]])
        guard let values = p["result"] else { throw CompanionError.invalidResponse }
        return try JSONDecoder().decode([T].self, from: JSONSerialization.data(withJSONObject: values))
    }

    private func open(host: String, port: UInt16) async throws {
        guard !host.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, let p = NWEndpoint.Port(rawValue: port), port > 0 else { throw CompanionError.notConnected }
        connection?.cancel()
        let parameters = NWParameters.tcp
        let tls = NWProtocolTLS.Options()
        sec_protocol_options_set_min_tls_protocol_version(tls.securityProtocolOptions, .TLSv13)
        parameters.defaultProtocolStack.applicationProtocols.insert(tls, at: 0)
        let c = NWConnection(host: NWEndpoint.Host(host), port: p, using: parameters)
        connection = c
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            var completed = false
            c.stateUpdateHandler = { [weak self] state in
                switch state {
                case .ready where !completed:
                    completed = true
                    cont.resume()
                case .failed(let error) where !completed:
                    completed = true
                    self?.failAllWaiters(CompanionError.notConnected)
                    cont.resume(throwing: error)
                case .cancelled where !completed:
                    completed = true
                    self?.failAllWaiters(CompanionError.notConnected)
                    cont.resume(throwing: CompanionError.notConnected)
                default:
                    break
                }
            }
            c.start(queue: DispatchQueue.global(qos: .userInitiated))
        }
        receive()
    }

    private func request(type: String, deviceID: String, payload: [String: Any]) async throws -> [String: Any] {
        try await request(messageID: UUID().uuidString, requestID: UUID().uuidString, type: type, deviceID: deviceID, payload: payload)
    }

    private func request(messageID: String, requestID: String, type: String, deviceID: String, payload: [String: Any]) async throws -> [String: Any] {
        guard let c = connection, c.state == .ready else { throw CompanionError.notConnected }
        let message: [String: Any] = ["messageId": messageID, "deviceId": deviceID, "type": type, "timestamp": ISO8601DateFormatter().string(from: Date()), "requestId": requestID, "payload": payload]
        let data = try JSONSerialization.data(withJSONObject: message) + Data([10])
        return try await withCheckedThrowingContinuation { (cont: CheckedContinuation<[String: Any], Error>) in
            waiters[requestID] = cont
            c.send(content: data, completion: .contentProcessed { [weak self] error in
                guard let self, let error else { return }
                if let waiter = self.waiters.removeValue(forKey: requestID) { waiter.resume(throwing: error) }
            })
        }
    }

    private func receive() {
        connection?.receive(minimumIncompleteLength: 1, maximumLength: 64 * 1024) { [weak self] data, _, complete, error in
            Task { @MainActor in
                guard let self else { return }
                if let data { self.buffer.append(data); self.consume() }
                if !complete && error == nil { self.receive() }
                else {
                    self.connected = false
                    self.sessionID = nil
                    self.failAllWaiters(CompanionError.notConnected)
                }
            }
        }
    }

    private func consume() {
        while let idx = buffer.firstIndex(of: 10) {
            let line = buffer.prefix(upTo: idx)
            buffer.removeSubrange(...idx)
            guard let object = try? JSONSerialization.jsonObject(with: line) as? [String: Any], let requestID = object["requestId"] as? String, let waiter = waiters.removeValue(forKey: requestID) else { continue }
            if object["type"] as? String == "ERROR" { waiter.resume(throwing: CompanionError.rejected) }
            else if let payload = object["payload"] as? [String: Any] { waiter.resume(returning: payload) }
            else { waiter.resume(throwing: CompanionError.invalidResponse) }
        }
    }

    private func failAllWaiters(_ error: Error) {
        let pending = waiters.values
        waiters.removeAll()
        pending.forEach { $0.resume(throwing: error) }
    }
}

enum CompanionError: LocalizedError {
    case notConnected, notPaired, notAuthenticated, invalidResponse, invalidRequest, rejected
    var errorDescription: String? {
        switch self {
        case .notConnected: "Not connected"
        case .notPaired: "iPhone is not paired"
        case .notAuthenticated: "iPhone is not authenticated"
        case .invalidResponse: "Tesh returned an invalid response"
        case .invalidRequest: "The request is invalid"
        case .rejected: "Tesh rejected the request"
        }
    }
}
