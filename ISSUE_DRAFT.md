# Draft: GitHub issue for deepseek-ai/deepseek-harness

Paste the block below into a new issue. Before you file it, check the two
placeholders marked `TODO`.

Suggested title:

    Turn completion is announced to assistive technology only inside the open conversation

---

### What I observed

DSH already announces the end of a turn to assistive technology. The chat view
renders a visually hidden polite live region in `TurnProcessNodeView`:

```js
// packages/client/ui-chat — TurnProcessNodeView
const announcement = stopped ? t("message.stopped")
  : reason === "error" ? t("message.turnProcess.failed")
  : t("message.turnProcess.worked");
// <span className={visuallyHidden} role="status" aria-live="polite" aria-atomic="true">
```

That region only exists **inside the conversation that is currently mounted**.

When a Session finishes while the reader is looking at a different Session, a
different panel, or an unfocused background tab, I could not find any cue that
does not require sight:

- `completionUnread` in `@deepseek-ai/dsh-client-ui-session` records the fact
  correctly (it is set only when the finished Session is not the main-view
  Session), and `ui-workspace` renders it as a visual dot on the sidebar row.
- `DocumentTitle` in `ui-layout` sets `document.title` from the active Session
  title only; it does not change when a turn completes, so the OS window title
  carries no completion signal either.
- No shipped Client package uses `AudioContext` for notification, and none calls
  the `Notification` API. The only `AudioContext` use I found is unrelated
  (microphone input in the experimental voice-input package).

So the non-visual equivalent of "the sidebar dot turned green" does not exist.

### Why this matters

For a screen-reader or low-vision user working across several Sessions — a
common pattern when waiting on a long turn — the only way to learn that a turn
finished is to navigate back into that conversation and hear the announcement
there. There is no way to be notified *about* it.

This is also relevant for sighted users on long tasks, but the accessibility
case is the one I would like to argue: completion is information, and right now
it is available visually to everyone and audibly only to the reader who is
already looking at the right conversation.

### What I tried

I wrote a small out-of-tree bundle (`dsh-chat-chime`, MIT) that reads
`completionUnread` through `useSessionStatus` from the `shell.overlay` slot,
plays a short synthesized chime, and shows a card with an "Open chat" shortcut.
It adds a preference row to Settings → General for the sound and the card.

It deliberately does **not** react to the open conversation, so it does not
double-announce what `TurnProcessNodeView` already announces. Reported
limitations of an out-of-tree approach:

- It cannot reach the OS notification channel without shelling out per platform.
- A plugin author has to re-derive which Sessions count as "worth announcing"
  (subagent children, unused blank Sessions).
- Nothing coordinates the chime with other plugins that might later want one.

### What I am asking

Before I invest further, I would like to know whether this is a direction the
project wants:

1. Would a completion cue for **non-active** Sessions be welcome as an in-tree
   feature, or is it considered a preference better left to plugins?
2. If in-tree: should it live in `ui-session` (owner of `completionUnread`),
   in `ui-chat` (owner of the existing announcement), or as its own package?
3. Is there a preferred non-visual channel — spoken announcement, short earcon,
   or OS notification — for events that happen outside the focused view? If
   there is an existing convention I should follow, I would rather match it than
   invent one.

I am happy to open a PR against whichever surface you prefer. I have not sent
one yet because the placement question above would decide the whole design.

`TODO:` link to the repository/branch with the bundle, if you are comfortable
sharing it publicly.

`TODO:` confirm you have actually seen the card and heard the chime on a running
Web GUI before filing — do not claim behaviour I have not verified.

---

## Notes for you (not part of the issue)

- The issue deliberately does **not** claim "DSH has no accessibility support".
  It says the existing announcement is scoped to the mounted conversation, which
  is verifiable from the code and cannot be refuted with one grep.
- Keep the tone as a question, not a proposal. Asking "is this wanted / where
  should it live" is far more likely to get a reply than a finished PR.
- If a maintainer replies that it belongs to plugins, that is still a useful
  outcome: it tells you to publish on npm and a market index instead.
- Fill in both `TODO` lines or delete them before filing. An issue that claims
  verified behaviour without verification is the fastest way to lose trust.

