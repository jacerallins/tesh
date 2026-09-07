import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var model: TeshAppModel
    var body: some View {
        TabView {
            NavigationStack { VStack(spacing: 20) { Text("TESH").font(.system(size: 44, weight: .semibold, design: .rounded)); Text(model.status).foregroundStyle(.secondary); Button("Create device identity") { model.createDeviceIdentity() }.buttonStyle(.bordered); NavigationLink("Pair this iPhone", destination: PairingView()); Button("Refresh Tesh state") { Task { await model.loadRemoteState() } }.buttonStyle(.borderedProminent); if !model.errorMessage.isEmpty { Text(model.errorMessage).foregroundStyle(.red).multilineTextAlignment(.center) }; Text("Your iPhone is a companion client. Permissions control what it can read or do on the desktop.").multilineTextAlignment(.center).foregroundStyle(.secondary) }.padding().navigationTitle("Home") }.tabItem { Label("Tesh", systemImage: "waveform") }
            NavigationStack { List(model.memories) { memory in VStack(alignment: .leading, spacing: 4) { Text(memory.category).font(.caption).foregroundStyle(.secondary); Text(memory.content); Text(memory.importance).font(.caption2).foregroundStyle(.secondary) } }.navigationTitle("Memory") }.tabItem { Label("Memory", systemImage: "brain") }
            ConversationView().tabItem { Label("Chat", systemImage: "bubble.left.and.bubble.right") }
            NavigationStack { List(model.routines) { routine in VStack(alignment: .leading, spacing: 4) { Text(routine.name).font(.headline); Text("\(routine.enabled ? "Enabled" : "Disabled") · \(routine.trigger.type) · \(routine.trigger.value)").foregroundStyle(.secondary) } }.navigationTitle("Routines") }.tabItem { Label("Routines", systemImage: "clock") }
            NavigationStack { VStack(alignment: .leading, spacing: 14) { Text("This iPhone").font(.headline); Text(model.status); Text("The desktop controls the trust relationship and can revoke this device at any time.").foregroundStyle(.secondary) }.padding().navigationTitle("Devices") }.tabItem { Label("Devices", systemImage: "iphone.and.arrow.forward") }
            NavigationStack { List { Section("Connection") { Button("Refresh shared state") { Task { await model.loadRemoteState() } } }; Section("Privacy") { Text("The iPhone never receives the desktop AI API key or direct filesystem access.") }; Section("Permissions") { Text("Chat, memory, conversations, routines, notifications and desktop commands are independently authorized by the desktop.") } }.navigationTitle("Settings") }.tabItem { Label("Settings", systemImage: "gearshape") }
        }
    }
}

private struct ConversationView: View {
    @EnvironmentObject private var model: TeshAppModel
    @State private var text = ""
    @State private var selectedConversation: String?
    var body: some View {
        NavigationStack {
            VStack {
                ScrollView { LazyVStack(alignment: .leading, spacing: 12) { ForEach(model.conversations.flatMap { conversation in conversation.messages.map { (conversation.id, $0) } }, id: \.1.id) { _, message in VStack(alignment: .leading) { Text(message.role).font(.caption).foregroundStyle(.secondary); Text(message.content) }.frame(maxWidth: .infinity, alignment: .leading) } }.padding() }.frame(maxWidth: .infinity)
                HStack { TextField("Message Tesh…", text: $text, axis: .vertical).textFieldStyle(.roundedBorder); Button("Send") { let message = text.trimmingCharacters(in: .whitespacesAndNewlines); guard !message.isEmpty else { return }; text = ""; Task { do { guard let client=model.client else { throw CompanionError.notAuthenticated }; let conversation=try await client.sendMessage(message,conversationId:selectedConversation); selectedConversation=conversation.id; if let index=model.conversations.firstIndex(where:{$0.id==conversation.id}){model.conversations[index]=conversation}else{model.conversations.insert(conversation,at:0)} } catch { model.errorMessage=error.localizedDescription } } }.buttonStyle(.borderedProminent) }.padding()
            }.navigationTitle("Chat")
        }
    }
}
