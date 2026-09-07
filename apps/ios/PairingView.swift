import SwiftUI

struct PairingView: View {
    @EnvironmentObject private var model: TeshAppModel
    @StateObject private var client = TeshCompanionClient()
    @State private var host = "192.168.1.10"
    @State private var port = "443"
    @State private var code = ""
    @State private var message = "Enter the Tesh desktop address and pairing code."

    var body: some View {
        Form {
            Section("Tesh desktop") {
                TextField("Host", text: $host).textInputAutocapitalization(.never).autocorrectionDisabled()
                TextField("Port", text: $port).keyboardType(.numberPad)
                TextField("Pairing code", text: $code).textInputAutocapitalization(.characters).autocorrectionDisabled()
                Button("Pair iPhone") {
                    Task {
                        do {
                            try await client.pair(code: code.trimmingCharacters(in: .whitespacesAndNewlines).uppercased(), host: host, port: UInt16(port) ?? 443, name: model.deviceName)
                            try await client.authenticate()
                            model.status = "Paired and authenticated"
                            message = model.status
                        } catch { message = error.localizedDescription }
                    }
                }
            }
            Section("Status") { Text(message) }
        }.navigationTitle("Pair Tesh")
    }
}
