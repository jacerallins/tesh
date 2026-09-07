# Milestone 15 companion connection

The desktop companion listener is owned by the Electron main process. It accepts newline-delimited JSON over TLS 1.3 only and defaults to `127.0.0.1`; it is not exposed to the renderer.

## Desktop configuration

Set these environment variables before starting Tesh:

- `TESH_COMPANION_TLS_CERT`: path to the desktop TLS certificate PEM.
- `TESH_COMPANION_TLS_KEY`: path to the matching private key PEM.
- `TESH_COMPANION_BIND_HOST`: an explicit local-network address, such as the PC Wi-Fi IPv4 address. Do not use `0.0.0.0` unless the host firewall independently restricts access.
- `TESH_COMPANION_PORT`: a fixed unoccupied TCP port, for example `45931`.

The listener requires TLS credentials and uses TLS 1.3 or newer. A firewall rule, if needed, should allow inbound TCP only on the selected port and only on the Private network profile. No public-internet exposure is required.

The server enforces a 64 KiB frame limit, an idle timeout, and a configurable default limit of 60 messages per minute per socket. Pairing challenges expire after two minutes, are single-use, and accept at most five attempts. Sessions expire after 15 minutes. The existing device permission and desktop authorization checks remain in the command path.

## Mobile configuration

Build the Android app with the desktop address and certificate pin:

```text
flutter run --dart-define=TESH_DESKTOP_HOST=192.168.1.20 --dart-define=TESH_DESKTOP_PORT=45931 --dart-define=TESH_DESKTOP_CERT_SHA256=<base64url-sha256-of-certificate-der>
```

The mobile private Ed25519 key remains in platform secure storage. The public key is sent during signed pairing and the desktop stores only that public key. The mobile client validates response framing and rejects unknown or malformed messages.

Automatic mDNS/Bonjour discovery is not included because platform support and trust bootstrapping vary across Android, Windows, and network profiles. The supported fallback is manual local address entry/build configuration plus certificate pinning.

## Pairing flow

1. Create a challenge in the desktop companion panel.
2. Connect the phone to the configured desktop address.
3. Request the short-lived challenge from the desktop.
4. Submit the code with the phone's signed Ed25519 public identity.
5. Authenticate subsequent connections using the desktop-assigned device ID and a fresh signed nonce.

Revoked devices cannot authenticate again. Reconnecting always creates a new authenticated session.

## Validation status

Desktop companion tests and TypeScript checks are run with `npm test -- src/main/companion` and `npm run typecheck`.

Flutter validation requires a Flutter SDK and Android SDK on PATH. A physical-device test requires an Android phone on the same private network as the desktop; this workspace does not claim that test unless it is run separately.
