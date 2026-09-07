# Tesh multi-device architecture

Tesh is designed as one personal assistant with multiple trusted clients rather than separate assistants running independently.

## Clients

- **Windows desktop:** primary client with the full Electron shell, local tools, local memory database, native microphone, wake-word detection, and desktop automation.
- **iPhone:** companion client for conversations, notifications, device status, approved commands, memory access, and cross-device continuity.
- **Future clients:** macOS, Linux, and Android can use the same companion protocol.

The existing companion model already represents iOS devices and requires public-key authenticated pairing before a device can become trusted.

## Shared state

The sync layer treats memories, conversations, routines, approved preferences, permission state, and device state as syncable entities. Each change carries a device ID, entity ID, version, timestamp, and operation type so clients can synchronize incrementally.

Sensitive information does not become available merely because a device is paired. Companion permissions remain explicit. Examples include:

- `COMPANION_VIEW_STATUS`
- `COMPANION_RECEIVE_NOTIFICATIONS`
- `COMPANION_SEND_COMMAND`
- `COMPANION_SYNC_MEMORY`
- `COMPANION_SYNC_CONVERSATIONS`
- `COMPANION_SYNC_ROUTINES`

## iPhone experience

The intended iPhone flow is:

1. Install the Tesh iOS client.
2. On the Windows Tesh app, open **Settings → Companion / Devices** and create a pairing challenge.
3. Pair the iPhone using the short-lived challenge and the iPhone's generated public key.
4. Tesh stores the paired device identity and starts with status-only access.
5. The user explicitly enables additional capabilities such as conversation sync, memory sync, notifications, or desktop commands.
6. Revoking the iPhone immediately invalidates its device sessions.

The iPhone client should keep its private key in the platform secure key store and communicate with Tesh using authenticated, replay-protected companion messages.

## Product behavior

The goal is continuity, not duplication. A conversation started on the PC can be continued on the iPhone, routines can be managed from either trusted client, and Tesh can notify the user on the appropriate device without requiring every device to have full desktop access.

Desktop-only capabilities remain desktop-only. The iPhone does not receive arbitrary filesystem or operating-system control unless Tesh explicitly exposes and authorizes a safe capability.

## Current implementation boundary

The repository now contains the shared multi-device contracts, a local sync queue abstraction, and companion message types for sync and notifications. The actual native iOS application and remote transport are still separate implementation work; the protocol is being defined first so the iPhone client can use the same trust and permission model as the desktop app.
