import Combine
import CryptoKit
import Foundation
import Security

@MainActor
final class TeshAppModel: ObservableObject {
    @Published var deviceName = "My iPhone"
    @Published var status = "Not paired"
    @Published var memories: [TeshMemory] = []
    @Published var routines: [TeshRoutine] = []

    let identityStore = DeviceIdentityStore()

    func createDeviceIdentity() {
        do { _ = try identityStore.ensureKeyPair(); status = "Device identity ready" }
        catch { status = "Identity error: \(error.localizedDescription)" }
    }
}

struct TeshMemory: Identifiable { let id: String; let title: String; let detail: String }
struct TeshRoutine: Identifiable { let id: String; let name: String; var enabled: Bool }

struct DeviceIdentity { let privateKey: Curve25519.Signing.PrivateKey; let publicKey: Data }

struct DeviceIdentityStore {
    private let tag = "com.tesh.ios.device.signing"
    func ensureKeyPair() throws -> DeviceIdentity {
        if let existing = try loadPrivateKey() { return DeviceIdentity(privateKey: existing, publicKey: existing.publicKey.rawRepresentation) }
        let key = Curve25519.Signing.PrivateKey()
        let query: [String: Any] = [kSecClass as String: kSecClassKey, kSecAttrApplicationTag as String: tag.data(using: .utf8)!, kSecValueData as String: key.rawRepresentation, kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess || status == errSecDuplicateItem else { throw NSError(domain: NSOSStatusErrorDomain, code: Int(status)) }
        return DeviceIdentity(privateKey: key, publicKey: key.publicKey.rawRepresentation)
    }
    private func loadPrivateKey() throws -> Curve25519.Signing.PrivateKey? {
        var item: CFTypeRef?
        let query: [String: Any] = [kSecClass as String: kSecClassKey, kSecAttrApplicationTag as String: tag.data(using: .utf8)!, kSecReturnData as String: true]
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = item as? Data else { throw NSError(domain: NSOSStatusErrorDomain, code: Int(status)) }
        return try Curve25519.Signing.PrivateKey(rawRepresentation: data)
    }
}
