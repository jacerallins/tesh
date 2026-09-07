import SwiftUI
@main struct TeshApp: App { @StateObject private var model = TeshAppModel(); var body: some Scene { WindowGroup { ContentView().environmentObject(model) } } }
