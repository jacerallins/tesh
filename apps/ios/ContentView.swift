import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var model: TeshAppModel
    var body: some View {
        TabView {
            NavigationStack { VStack(spacing: 22) { Text("TESH").font(.system(size: 44, weight: .semibold, design: .rounded)); Text(model.status).foregroundStyle(.secondary); NavigationLink("Pair this iPhone", destination: PairingView()).buttonStyle(.borderedProminent) }.padding().navigationTitle("Home") }.tabItem { Label("Tesh", systemImage: "waveform") }
            NavigationStack { List(model.memories) { memory in VStack(alignment: .leading) { Text(memory.title).font(.headline); Text(memory.detail).foregroundStyle(.secondary) } }.navigationTitle("Memory") }.tabItem { Label("Memory", systemImage: "brain") }
            NavigationStack { List($model.routines) { $routine in Toggle(routine.name, isOn: $routine.enabled) }.navigationTitle("Routines") }.tabItem { Label("Routines", systemImage: "clock") }
            NavigationStack { VStack(alignment: .leading, spacing: 12) { Text("This iPhone").font(.headline); Text(model.status); Text("Desktop capabilities are device-scoped and permission-gated.").foregroundStyle(.secondary) }.padding().navigationTitle("Devices") }.tabItem { Label("Devices", systemImage: "iphone.and.arrow.forward") }
            NavigationStack { List { Section("Privacy") { Text("The iPhone never receives the desktop AI API key or direct filesystem access.") }; Section("Permissions") { Text("Memory, conversation, routine, notification and desktop-command access are separately authorized.") } }.navigationTitle("Settings") }.tabItem { Label("Settings", systemImage: "gearshape") }
        }
    }
}
