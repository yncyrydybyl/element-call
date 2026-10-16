# Element Call for Marcade

This branch (`marcade`) is Element Call, built as a room widget for
[marcade.store](https://marcade.store) and the Marcade Player. It is upstream
[element-hq/element-call](https://github.com/element-hq/element-call) at a
release tag plus a few small patches, so that the widget works when a user adds
it from the store rather than a client setting it up as its own call widget.

Store id: `io.element.call`. License: AGPL-3.0-only (the upstream code is also
offered under Element's commercial license; this fork's additions are
AGPL-3.0-only).

## What the fork changes

| Change | Where | Why |
|---|---|---|
| Reads `matrix_room_id`, `matrix_user_id`, `matrix_device_id`, `matrix_base_url`, `matrix_display_name`, `matrix_client_language`, `matrix_client_theme` when Element Call's own parameter names are absent; ignores unresolved `$…` template values | `src/marcade.ts`, `ParamParser.getParam` in `src/UrlParams.ts` | The Player appends these names (the matrix-widget-toolkit convention) to every store widget. Element Call only knew `roomId`, `userId`, … |
| A widget without an `intent` behaves like `intent=join_existing` (lobby first, confined to the room) instead of the standalone app | `computeUrlParams` in `src/UrlParams.ts` | A store install states no intent. Element Web's own call widget always passes one, so nothing changes there |
| Framed without room/user/device/homeserver, it shows the `/addwidget` line that works, instead of falling back to the standalone app's login | `missingWidgetParamsError` in `src/marcade.ts`, `src/main.tsx` | A bare `/addwidget https://marcade.store/apps/io.element.call/<version>/` in Element Web gives the widget only `widgetId` and `parentUrl` |
| A widget always renders the call, whatever path it is served from | `src/App.tsx` | The standalone router shows its home page at `/`; Element Web serves the widget at `…/room`, a store or a host of its own can serve it at a directory root |
| The fatal-error text is shown (the body stays hidden until the app sets a theme) and wraps | `src/main.tsx` | Otherwise the missing-parameter explanation above is invisible |
| `pnpm build:marcade`: the embedded build without sourcemaps | `package.json` | What the store builds: relative asset paths, no `config.json` (so no analytics or rageshake endpoint configured), 18 MB smaller |

Everything else is upstream. Updating to a new Element Call release is a rebase
of this branch onto the new tag.

## Adding it to a room

- **Marcade Player:** Apps tab → Element Call. The Player fills in every
  parameter.
- **Element Web:** the URL needs Element Call's parameters in the fragment,
  which Element Web substitutes:

  ```
  /addwidget https://marcade.store/apps/io.element.call/<version>/#?roomId=$matrix_room_id&userId=$matrix_user_id&deviceId=$org.matrix.msc3819.matrix_device_id&baseUrl=$org.matrix.msc4039.matrix_base_url&displayName=$matrix_display_name&theme=$org.matrix.msc2873.client_theme&lang=$org.matrix.msc2873.client_language
  ```

## What it needs from the homeserver

Element Call does not talk to a Marcade service. Media goes through a LiveKit
SFU that the user's homeserver offers for MatrixRTC (MSC4143): the client asks
the homeserver for its RTC transports (`get_rtc_transports`, MSC4515), gets a
LiveKit token from the homeserver's MatrixRTC authorisation service with an
OpenID token, and connects to LiveKit over WebSocket and WebRTC. A homeserver
without MatrixRTC (for example a plain Synapse without LiveKit) cannot place
calls. Element Server Suite ships both parts.

Call membership is room state (`org.matrix.msc3401.call.member`, not
encrypted); a delayed leave event (MSC4140/MSC4157) removes a member whose
client disappears. In an encrypted room the media is end-to-end encrypted per
participant, with keys sent as encrypted to-device messages.

## Capabilities

`marcade/capabilities.txt` is what the widget requests, with the user, device
and room ids it puts into some of them replaced by `{userId}`, `{deviceId}` and
`{roomId}`. The store entry lists the same set.

## Tested

2026-10-16, v0.28.0 + these patches: a two-client call between the Marcade
Player (this build, the Apps-tab URL with only the `matrix_*` parameters) and
Element Web's built-in Element Call on chat.blackpony.club, encrypted room,
BPC's LiveKit SFU. Both sides see both live video feeds, decrypted
(`~/projects/marcade/supertest/elementcall/run-ec-marcade.mjs`, 7/7).

## Checks

```sh
pnpm install --frozen-lockfile
pnpm exec vitest run --project=unit src/marcade.test.ts src/UrlParams.test.ts
pnpm build:marcade
node marcade/e2e/probe.mjs            # mock Player: capabilities match the list, lobby renders,
                                      # a bare URL explains the /addwidget line
node marcade/e2e/probe.mjs --write    # after an upstream update: refresh capabilities.txt
```

The store builds in the `node:22` image with
`npm install -g pnpm@11.21.0 && pnpm install --frozen-lockfile && pnpm build:marcade`.
pnpm comes from npm, not corepack: the matrix-js-sdk git dependency pins its
own pnpm version, and only a pnpm installed this way can switch to it.
