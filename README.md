# Chat Chime — DSH plugin

A short bell chime plus a clickable completion card for chats that finish while
you are not looking at them. Every sound is synthesized in the browser with Web
Audio, so there is no audio file and no npm dependency at all.

## Why this exists

DSH already announces the end of a turn to assistive technology — the chat view
renders a visually hidden `role="status"` / `aria-live="polite"` region
(`TurnProcessNodeView` in `@deepseek-ai/dsh-client-ui-chat`). That announcement
only exists **inside the conversation that is currently open**.

When a Session finishes while you are viewing a different Session, a different
panel, or an unfocused background tab, DSH offers no perceivable cue. The only
signal is the visual completion dot on that Session's sidebar row, which is
driven by `completionUnread` in `@deepseek-ai/dsh-client-ui-session` — a purely
visual state. Across the shipped Client packages there is no `AudioContext` used
for notification and no `Notification` API call.

This plugin fills that specific gap: a non-visual cue, plus a card that is also
a shortcut back to the chat that finished. It does **not** duplicate the
open-conversation announcement, because it only reacts to `completionUnread`,
which the framework sets exclusively when the finished Session is not the
main-view Session.

## Package contents

```
dsh-chat-chime/
  package.json       bundle manifest + the `dsh.client` section
  cordis.patch.yml   patch that inserts the `chat-chime` row
  index.js           Host half (intentionally empty: all work happens in the browser)
  client.js          browser half: chime, completion card, Settings row
  locale/en.json     Plugin Manager title + description (English)
  locale/id.json     Indonesian version
  locale/zh.json     Mandarin version
  icon.svg           plugin icon
```

There are no `dependencies` or `peerDependencies`: React comes from the browser
module table, and all Session data arrives through Slot standard props. Nothing
has to be installed first.

## Installation

### A. From the git repo (recommended for multiple machines)

```powershell
git clone https://github.com/RafiMM0609/dsh-chat-chime-push.git
```

Then ask the DSH agent on that machine to run `plugin_manager` with
`action: install_bundle` and `target` = the absolute path of the cloned folder.

To update later:

```powershell
cd dsh-chat-chime
git pull
```

`install_bundle` links the folder (junction/symlink) rather than copying it, so
changes to `client.js` take effect after the page is reloaded.

### B. From the zip archive

1. Extract `dsh-chat-chime-1.0.0.zip` into a `dsh-chat-chime` folder.
2. Install it as above with `target` = the path of that folder.

### C. Copy the folder as-is

Copy the folder anywhere on the target machine (do not place it inside
`~/.dsh/profiles/...`; let DSH create the link itself), then install it.

## After installation

1. Confirm the result is `application: applied`, then reload the Web GUI page.
2. **Click anywhere on the page** before testing the sound. Browsers refuse
   audio before a user interaction; after the first click the chime is ready.
3. Open Settings → General → **Chat Chime** to toggle the chime and the card, or
   press **Test chime** to confirm audio is not blocked.

## How it works

The completion signal is `completionUnread` from the Session status snapshot
read through `useSessionStatus` — the same fact that drives the sidebar's
completion dot. The plugin does not diff `running` itself, does not poll, and
writes nothing to the session log.

- **Chime**: a ~0.4 second bell triad through Web Audio, no assets.
- **Card**: appears at the bottom right, showing the chat title plus **Open chat**
  (calls `uiWorkspace.openSession`) and **Dismiss**. It disappears on its own
  after 15 seconds, with at most 3 cards stacked.
- Each completion is announced once: because `completionUnread` persists until
  the Session is opened, the plugin remembers what it already announced and
  resets that memory when the framework clears the flag.
- Subagent chats and unused blank Sessions do not trigger a notification.
- Animations are disabled when the OS reports `prefers-reduced-motion`.

## Compatibility notes

- Not tied to a specific DSH version. It uses only two Slots (`shell.overlay`,
  `settings.general.item`) and standard props (`useSessionStatus`, `useSessions`, `t`).
- If a Slot is absent from the target machine's composition, its registration
  becomes a no-op and the rest of DSH keeps working — no error is thrown. When
  `settings.general.item` is unavailable, the card and the chime still work; only
  the settings row does not appear.
- Preferences are stored in browser `localStorage`, per origin
  `http://127.0.0.1:<port>`. If the Web GUI port changes, the settings fall back
  to their defaults (chime on, card enabled).

## Accessibility notes

- One dedicated `role="status"` / `aria-live="polite"` region carries a single
  short sentence per completion ("Reply finished: <title>"). The cards stay in
  the normal accessibility tree, so their Open/Dismiss buttons remain reachable,
  but they are not live regions themselves and are never re-announced.
- The chime is a supplement, never the only channel: the card carries the same
  information visually and in text.
- Sound can be switched off independently of the card, and the card off
  independently of the sound.
- Motion is suppressed under `prefers-reduced-motion`.

## License

MIT — see [LICENSE](LICENSE).
