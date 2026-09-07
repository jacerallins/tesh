import Combine
import CryptoKit
import Foundation
import Security

struct RemoteMemory: Identifiable, Decodable { let id: String; let content: String; let category: String; let importance: String }
struct RemoteConversation: Identifiable, Decodable { let id: String; let messages: [RemoteMessage] }
struct RemoteMessage: Identifiable, Decodable { let id: String; let role: String; let content: String; let timestamp: String }
struct RemoteRoutine: Identifiable, Decodable { let id: String; let name: String; let enabled: Bool; let trigger: RemoteTrigger; let actions: [RemoteAction] }
struct RemoteTrigger: Decodable { let type: String; let value: String }
struct RemoteAction: Decodable { let id: String; let type: String; let input: [String:String]; let requiresConfirmation: Bool }

@MainActor
final class TeshAppModel: ObservableObject {
    @Published var deviceName = "My iPhone"
    @Published var status = "Not paired"
    @Published var memories: [RemoteMemory] = []
    @Published var conversations: [RemoteConversation] = []
    @Published var routines: [RemoteRoutine] = []
    @Published var errorMessage = ""
    let identityStore = DeviceIdentityStore()
    var client: TeshCompanionClient?
    func createDeviceIdentity() { do { _ = try identityStore.ensureKeyPair(); status = "Device identity ready" } catch { status = "Identity error: \(error.localizedDescription)" } }
    func loadRemoteState() async { guard let client else { return }; do { memories = try await client.listMemories(); conversations = try await client.listConversations(); routines = try await client.listRoutines(); errorMessage = "" } catch { errorMessage = error.localizedDescription } }
}

struct DeviceIdentity { let privateKey: Curve25519.Signing.PrivateKey; let publicKey: Data }
struct DeviceIdentityStore {
    private let tag = "com.tesh.ios.device.signing"
    func ensureKeyPair() throws -> DeviceIdentity {
        if let existing = try loadPrivateKey() { return DeviceIdentity(privateKey: existing, publicKey: existing.publicKey.rawRepresentation) }
        let key = Curve25519.Signing.PrivateKey()
        let query: [String: Any] = [kSecClass as String:kSecClassKey, kSecAttrApplicationTag as String:tag.data(using:.utf8)!, kSecValueData as String:key.rawRepresentation, kSecAttrAccessible as String:kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess || status == errSecDuplicateItem else { throw NSError(domain:NSOSStatusErrorDomain, code:Int(status)) }
        return DeviceIdentity(privateKey:key, publicKey:key.publicKey.rawRepresentation)
    }
    private func loadPrivateKey() throws -> Curve25519.Signing.PrivateKey? {
        var item: CFTypeRef?
        let query: [String: Any] = [kSecClass as String:kSecClassKey, kSecAttrApplicationTag as String:tag.data(using:.utf8)!, kSecReturnData as String:true]
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = item as? Data else { throw NSError(domain:NSOSStatusErrorDomain, code:Int(status)) }
        return try Curve25519.Signing.PrivateKey(rawRepresentation:data)
    }
}
