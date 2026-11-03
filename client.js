/**
 * Browser half of the Chat Chime bundle.
 *
 * The Session list already carries every Session's `running` state, so a
 * finish is the `running: true -> false` transition of one ordinary Session.
 * This plugin watches that transition, plays a short synthesized chime (Web
 * Audio, no asset), and pushes an interactive completion card into
 * `shell.overlay` whose primary action opens the Session that finished.
 *
 * Nothing here is derived from the session log and nothing is written to it:
 * preferences are browser-local, cards are presentation state, and every
 * resource (audio context, listeners, timers, styles) is owned by the plugin
 * effect or the component that renders it.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-chat-chime',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useCallback, useEffect, useRef, useState } = React;

    const NS = 'chatChime';
    const PREFS_KEY = 'dsh-chat-chime:prefs';
    const CARD_TTL_MS = 15000;
    const MAX_CARDS = 3;

    // ── dictionary ─────────────────────────────────────────────────────────
    const en = {
      'card.title': 'Reply finished',
      'card.hint': 'This chat finished while you were elsewhere.',
      'card.open': 'Open chat',
      'card.dismiss': 'Dismiss',
      'settings.title': 'Chat Chime',
      'settings.sound': 'Chime',
      'settings.sound.on': 'On',
      'settings.sound.off': 'Off',
      'settings.card': 'Completion card',
      'settings.card.note': 'Announces a chat that finishes while you are looking at something else, with a shortcut back to it. The open conversation already announces its own completion.',
      'settings.test': 'Test chime',
      'settings.blocked': 'The browser blocked audio. Click anywhere, then test again.',
      'card.aria': 'Chat completion notice'
    };

    const id = {
      'card.title': 'Balasan selesai',
      'card.hint': 'Chat ini selesai saat kamu sedang di tempat lain.',
      'card.open': 'Buka chat',
      'card.dismiss': 'Tutup',
      'settings.title': 'Chat Chime',
      'settings.sound': 'Nada',
      'settings.sound.on': 'Aktif',
      'settings.sound.off': 'Mati',
      'settings.card': 'Kartu selesai',
      'settings.card.note': 'Memberi tahu chat yang selesai saat kamu sedang melihat hal lain, dengan pintasan kembali ke chat itu. Percakapan yang sedang terbuka sudah mengumumkan penyelesaiannya sendiri.',
      'settings.test': 'Coba nada',
      'settings.blocked': 'Browser memblokir audio. Klik di mana saja, lalu coba lagi.',
      'card.aria': 'Pemberitahuan chat selesai'
    };

    const zh = {
      'card.title': '回复已完成',
      'card.hint': '你正在别处时，这个会话结束了。',
      'card.open': '打开会话',
      'card.dismiss': '关闭',
      'settings.title': 'Chat Chime',
      'settings.sound': '提示音',
      'settings.sound.on': '开',
      'settings.sound.off': '关',
      'settings.card': '完成卡片',
      'settings.card.note': '当你正在查看其他内容时，提示已结束的会话，并可直接跳回该会话。当前打开的对话本身已会播报完成。',
      'settings.test': '试听',
      'settings.blocked': '浏览器拦截了音频。先点击页面任意处，再试一次。',
      'card.aria': '会话完成提示'
    };

    // ── styles ─────────────────────────────────────────────────────────────
    const CSS = `
/* The overlay layer makes every direct child interactive; the doubled class
   out-specifies that rule so only the cards themselves take pointer events and
   an empty stack never blocks the chat underneath. The stack sits above the
   composer so a card never covers the place the reader types. */
.dcc-stack.dcc-stack{position:absolute;right:24px;bottom:104px;z-index:40;display:flex;flex-direction:column;align-items:flex-end;gap:10px;pointer-events:none;max-width:calc(100vw - 48px)}
.dcc-card{box-sizing:border-box;pointer-events:auto;width:326px;max-width:calc(100vw - 40px);display:flex;flex-direction:column;gap:9px;padding:12px 14px;border-radius:12px;background:var(--dsw-alias-bg-overlay);border:.5px solid var(--dsw-alias-border-l2);box-shadow:var(--dsw-elevation-soft,none);color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.45;animation:dcc-in .22s cubic-bezier(.2,.7,.3,1)}
.dcc-card[data-leaving="true"]{animation:dcc-out .16s ease-in forwards}
.dcc-head{display:flex;align-items:center;gap:8px;min-width:0}
.dcc-dot{flex:none;width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-state-success-primary);animation:dcc-pulse 1.1s ease-out 2}
.dcc-title{font-weight:500;letter-spacing:-.01em;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dcc-body{display:flex;flex-direction:column;gap:2px;min-width:0}
.dcc-session{color:var(--dsw-alias-label-primary);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dcc-hint{color:var(--dsw-alias-label-secondary);font-size:12px}
.dcc-actions{display:flex;align-items:center;gap:8px;margin-top:2px}
.dcc-primary{font:inherit;font-size:12px;padding:4px 12px;border-radius:8px;cursor:pointer;border:.5px solid var(--dsw-alias-brand-primary);background:transparent;color:var(--dsw-alias-label-primary)}
.dcc-primary:hover{background:var(--dsw-alias-bg-layer-2)}
.dcc-ghost{font:inherit;font-size:12px;padding:4px 10px;border-radius:8px;cursor:pointer;border:.5px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary);margin-left:auto}
.dcc-ghost:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.dcc-row{box-sizing:border-box;display:flex;flex-direction:column;gap:8px;padding:16px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.dcc-row-title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}
.dcc-chip-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.dcc-chip{box-sizing:border-box;font:inherit;font-size:13px;line-height:20px;padding:5px 14px;border-radius:9px;cursor:pointer;border:.5px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary)}
.dcc-chip:hover:not([aria-pressed="true"]){background:var(--dsw-alias-bg-layer-2)}
.dcc-chip[aria-pressed="true"]{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}
.dcc-switch-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.dcc-switch{position:relative;flex:none;width:38px;height:22px;border-radius:999px;border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);cursor:pointer;padding:0}
.dcc-switch[aria-checked="true"]{background:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}
.dcc-knob{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-bg-base);transition:transform .16s ease}
.dcc-switch[aria-checked="true"] .dcc-knob{transform:translateX(16px)}
.dcc-note{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.4;margin:0}
.dcc-blocked{color:var(--dsw-alias-state-warn-primary);font-size:12px;margin:0}
.dcc-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@keyframes dcc-in{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
@keyframes dcc-out{to{opacity:0;transform:translateY(6px) scale(.99)}}
@keyframes dcc-pulse{0%{box-shadow:0 0 0 0 var(--dsw-alias-state-success-primary);opacity:1}100%{box-shadow:0 0 0 7px transparent;opacity:.85}}
@media (prefers-reduced-motion: reduce){.dcc-card,.dcc-card[data-leaving="true"]{animation:none}.dcc-dot{animation:none}.dcc-knob{transition:none}}
`;

    // ── preferences ────────────────────────────────────────────────────────
    /**
     * Read the stored preferences.
     * @returns {{sound: 'on'|'off', card: boolean}} normalized preferences.
     */
    function readPrefs() {
      const fallback = { sound: 'on', card: true };
      try {
        const raw = window.localStorage.getItem(PREFS_KEY);
        if (raw === null) return fallback;
        const parsed = JSON.parse(raw);
        // An older build stored "always"/"background"; both meant "sound on".
        const sound = parsed.sound === 'off' ? 'off' : 'on';
        return { sound, card: parsed.card !== false };
      } catch {
        return fallback;
      }
    }

    /**
     * Write the preferences, ignoring unavailable storage.
     * @param {object} next - preferences to persist.
     * @returns {void}
     */
    function writePrefs(next) {
      try {
        window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        // A blocked storage area only costs persistence, never the feature.
      }
    }

    /**
     * Create the process-local preference source shared by the settings row and
     * the overlay. It is a derived cache: losing it costs nothing but defaults.
     * @returns {object} getSnapshot/subscribe/set.
     */
    function createPrefsSource() {
      let current = readPrefs();
      const listeners = new Set();
      return {
        getSnapshot: () => current,
        subscribe(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
        set(patch) {
          current = { ...current, ...patch };
          writePrefs(current);
          for (const listener of [...listeners]) listener();
        }
      };
    }

    /**
     * Bind one component to a preference source.
     * @param {object} source - the preference source.
     * @returns {object} the current preferences.
     */
    function usePrefs(source) {
      const [value, setValue] = useState(source.getSnapshot);
      useEffect(() => {
        const read = () => setValue(source.getSnapshot());
        read();
        return source.subscribe(read);
      }, [source]);
      return value;
    }

    // ── chime ──────────────────────────────────────────────────────────────
    /**
     * One lazily created audio graph, unlocked by the first user gesture.
     * Browsers refuse to start audio before an interaction, so `play()` reports
     * whether it started and the settings row surfaces a refused test.
     */
    function createChime() {
      let context;
      const notes = [
        { frequency: 880, delay: 0, gain: 0.16 },
        { frequency: 1174.66, delay: 0.085, gain: 0.12 },
        { frequency: 1567.98, delay: 0.17, gain: 0.09 }
      ];

      /**
       * Create the audio context on demand.
       * @returns {AudioContext | undefined} the context, or undefined when unavailable.
       */
      function ensureContext() {
        if (context !== undefined) return context;
        const Ctor = window.AudioContext ?? window.webkitAudioContext;
        if (typeof Ctor !== 'function') return undefined;
        try {
          context = new Ctor();
        } catch {
          return undefined;
        }
        return context;
      }

      /** Resume a suspended context after an interaction. */
      function unlock() {
        const audio = ensureContext();
        if (audio === undefined) return;
        if (audio.state === 'suspended') audio.resume().catch(() => {});
      }

      /**
       * Play the bell triad.
       * @returns {boolean} whether playback started.
       */
      function play() {
        const audio = ensureContext();
        if (audio === undefined) return false;
        try {
          if (audio.state === 'suspended') audio.resume().catch(() => {});
          if (audio.state !== 'running') return false;
          const start = audio.currentTime + 0.02;
          for (const note of notes) {
            const oscillator = audio.createOscillator();
            const envelope = audio.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.value = note.frequency;
            envelope.gain.setValueAtTime(0.0001, start + note.delay);
            envelope.gain.exponentialRampToValueAtTime(note.gain, start + note.delay + 0.012);
            envelope.gain.exponentialRampToValueAtTime(0.0001, start + note.delay + 0.42);
            oscillator.connect(envelope).connect(audio.destination);
            oscillator.start(start + note.delay);
            oscillator.stop(start + note.delay + 0.46);
          }
        } catch {
          // A refused audio graph must never break the card that reported it.
          return false;
        }
        return true;
      }

      return {
        play,
        unlock,
        dispose() {
          if (context === undefined) return;
          const closing = context;
          context = undefined;
          closing.close().catch(() => {});
        }
      };
    }

    // ── overlay ────────────────────────────────────────────────────────────
    /**
     * Render the stacked completion cards.
     *
     * @param {object} props - composed slot props.
     * @returns {object | null} the card stack.
     */
    function CompletionOverlay(props) {
      const { t, useSessionStatus, prefs, chime, openSession } = props;
      const statuses = useSessionStatus((snapshot) => snapshot);
      const timers = useRef(new Map());
      const exits = useRef(undefined);
      const announced = useRef(new Set());
      const [cards, setCards] = useState([]);
      const [leaving, setLeaving] = useState(undefined);
      const preferences = usePrefs(prefs);

      const dismiss = useCallback((cardId) => {
        const timer = timers.current.get(cardId);
        if (timer !== undefined) {
          window.clearTimeout(timer);
          timers.current.delete(cardId);
        }
        setLeaving(cardId);
        const exit = window.setTimeout(() => {
          exits.current = undefined;
          setCards((current) => current.filter((card) => card.id !== cardId));
          setLeaving((current) => (current === cardId ? undefined : current));
        }, 180);
        exits.current = exit;
      }, []);

      const pushCard = useCallback(
        (sessionId, title) => {
          const card = {
            id: `${sessionId}:${Date.now().toString(36)}`,
            sessionId,
            title
          };
          setCards((current) => [...current, card].slice(-MAX_CARDS));
          const timer = window.setTimeout(() => dismiss(card.id), CARD_TTL_MS);
          timers.current.set(card.id, timer);
        },
        [dismiss]
      );

      // One owner for every timer: a card that leaves the list — dismissed,
      // expired, or pushed out by a newer one — loses its timer here instead of
      // inside a state updater, which React may run more than once.
      useEffect(() => {
        const present = new Set(cards.map((card) => card.id));
        for (const [cardId, timer] of timers.current) {
          if (present.has(cardId)) continue;
          window.clearTimeout(timer);
          timers.current.delete(cardId);
        }
      }, [cards]);

      useEffect(() => {
        return () => {
          for (const timer of timers.current.values()) window.clearTimeout(timer);
          timers.current.clear();
          if (exits.current !== undefined) window.clearTimeout(exits.current);
          exits.current = undefined;
        };
      }, []);

      // The completion signal is the framework's own `completionUnread` fact:
      // ui-session sets it exactly when a Session stops running while it is NOT
      // the main-view Session, and clears it as soon as that Session is shown or
      // runs again. Reading it — instead of diffing `running` ourselves — keeps
      // this plugin aligned with the sidebar's own completion dot and avoids
      // announcing the conversation the reader is already looking at, which the
      // chat view announces in its own aria-live region.
      useEffect(() => {
        const announced = announced.current;
        let sounded = false;
        for (const [sessionId, status] of statuses) {
          if (status.completionUnread !== true) {
            // The framework cleared the fact (the Session was opened or ran
            // again), so a later completion may announce again.
            announced.delete(sessionId);
            continue;
          }
          // `completionUnread` stays true until acknowledged, so a re-run of this
          // effect must not repeat the card or the chime for the same completion.
          if (announced.has(sessionId)) continue;
          const subject = openSession.describe(sessionId);
          if (subject === undefined || subject === null) continue;
          announced.add(sessionId);
          if (preferences.card) pushCard(sessionId, subject.title);
          sounded = true;
        }
        if (sounded && preferences.sound === 'on') chime.play();
      }, [statuses, preferences.card, preferences.sound, chime, openSession, pushCard]);

      if (cards.length === 0) return null;

      const latest = cards[cards.length - 1];

      // One dedicated live region carries the announcement. The cards stay in
      // the normal accessibility tree — their Open/Dismiss buttons must remain
      // reachable — but they are not live regions themselves, so adding a card
      // never re-announces the whole markup.
      return h(
        'div',
        { className: 'dcc-stack', 'data-plugin': '@local/dsh-chat-chime' },
        h(
          'div',
          { className: 'dcc-sr', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' },
          `${t('card.title')}: ${latest.title}`
        ),
        cards.map((card) =>
          h(
            'div',
            {
              key: card.id,
              className: 'dcc-card',
              'data-leaving': leaving === card.id ? 'true' : 'false',
              role: 'group',
              'aria-label': t('card.aria')
            },
            h(
              'div',
              { className: 'dcc-head' },
              h('span', { className: 'dcc-dot', 'aria-hidden': 'true' }),
              h('span', { className: 'dcc-title' }, t('card.title'))
            ),
            h(
              'div',
              { className: 'dcc-body' },
              h('span', { className: 'dcc-session', title: card.title }, card.title),
              h('span', { className: 'dcc-hint' }, t('card.hint'))
            ),
            h(
              'div',
              { className: 'dcc-actions' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'dcc-primary',
                  onClick: () => {
                    openSession.open(card.sessionId);
                    dismiss(card.id);
                  }
                },
                t('card.open')
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dcc-ghost',
                  onClick: () => dismiss(card.id)
                },
                t('card.dismiss')
              )
            )
          )
        )
      );
    }

    // ── settings row ───────────────────────────────────────────────────────
    /**
     * Render the General-section row: sound mode, card toggle, test button.
     *
     * @param {object} props - composed slot props.
     * @returns {object} the row element tree.
     */
    function SettingsRow(props) {
      const { t, prefs, chime } = props;
      const preferences = usePrefs(prefs);
      const [blocked, setBlocked] = useState(false);
      const retry = useRef(undefined);

      useEffect(() => () => {
        if (retry.current !== undefined) window.clearTimeout(retry.current);
        retry.current = undefined;
      }, []);

      // The first gesture resumes a suspended context asynchronously, so a test
      // that reports failure once retries after the resume settles before it
      // tells the reader the browser refused audio.
      const preview = useCallback(() => {
        chime.unlock();
        if (chime.play()) {
          setBlocked(false);
          return;
        }
        if (retry.current !== undefined) window.clearTimeout(retry.current);
        retry.current = window.setTimeout(() => {
          retry.current = undefined;
          setBlocked(!chime.play());
        }, 180);
      }, [chime]);

      const modes = [
        { value: 'on', label: t('settings.sound.on') },
        { value: 'off', label: t('settings.sound.off') }
      ];

      return h(
        'div',
        { className: 'dcc-row', 'data-plugin': '@local/dsh-chat-chime' },
        h('div', { className: 'dcc-row-title' }, t('settings.title')),
        h(
          'div',
          { className: 'dcc-chip-row', role: 'group', 'aria-label': t('settings.sound') },
          modes.map((mode) =>
            h(
              'button',
              {
                key: mode.value,
                type: 'button',
                className: 'dcc-chip',
                'aria-pressed': preferences.sound === mode.value,
                onClick: () => {
                  prefs.set({ sound: mode.value });
                  if (mode.value !== 'off') preview();
                }
              },
              mode.label
            )
          )
        ),
        h(
          'div',
          { className: 'dcc-switch-row' },
          h(
            'button',
            {
              type: 'button',
              className: 'dcc-switch',
              role: 'switch',
              'aria-checked': preferences.card,
              'aria-label': t('settings.card'),
              onClick: () => prefs.set({ card: !preferences.card })
            },
            h('span', { className: 'dcc-knob', 'aria-hidden': 'true' })
          ),
          h('span', null, t('settings.card')),
          h(
            'button',
            { type: 'button', className: 'dcc-ghost', onClick: preview },
            t('settings.test')
          )
        ),
        h('p', { className: 'dcc-note' }, t('settings.card.note')),
        blocked ? h('p', { className: 'dcc-blocked' }, t('settings.blocked')) : null
      );
    }

    // ── registration ───────────────────────────────────────────────────────
    /** Services this plugin needs from the browser runtime. */
    const inject = ['slots', 'locale'];

    /**
     * Mount the completion overlay and its preference row.
     *
     * @param {object} ctx - the browser plugin context.
     */
    function apply(ctx) {
      ctx.effect(() => {
        const tag = document.createElement('style');
        tag.setAttribute('data-plugin', '@local/dsh-chat-chime');
        tag.textContent = CSS;
        document.head.appendChild(tag);
        return () => tag.remove();
      }, 'chat-chime: styles');

      ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'chat-chime: dictionaries');
      // Indonesian copy is registered for the reader's language without adding a
      // half-translated UI language to the catalog: if an `id` language pack is
      // ever composed, this plugin's own text already follows it, and English
      // answers otherwise.
      ctx.effect(() => ctx.locale.register(NS, 'id', id), 'chat-chime: indonesian dictionary');

      const prefs = createPrefsSource();
      const chime = createChime();

      ctx.effect(() => {
        const unlock = () => chime.unlock();
        document.addEventListener('pointerdown', unlock, { passive: true });
        document.addEventListener('keydown', unlock);
        return () => {
          document.removeEventListener('pointerdown', unlock);
          document.removeEventListener('keydown', unlock);
        };
      }, 'chat-chime: audio unlock');

      ctx.effect(() => () => chime.dispose(), 'chat-chime: audio context');

      const sessions = () => ctx.get('sessions');
      const uiWorkspace = () => ctx.get('uiWorkspace');

      const openSession = {
        /**
         * Read the row a completion card should name.
         * @param {string} sessionId - finished Session.
         * @returns {{title: string} | undefined} the subject, or undefined to stay silent.
         */
        describe(sessionId) {
          const service = sessions();
          const row = service?.list?.getSnapshot?.()?.byId?.[sessionId];
          if (row === undefined) return undefined;
          // Subagent children and unused blank Sessions finish for reasons the
          // reader did not start, so they never raise a notice.
          if (row.origin === 'subagent' || row.blank === true) return undefined;
          const title = typeof row.displayTitle === 'string' && row.displayTitle.length > 0
            ? row.displayTitle
            : row.title ?? sessionId;
          return { title };
        },
        /** Open one Session in the main view. */
        open(sessionId) {
          uiWorkspace()?.openSession(sessionId);
        }
      };

      ctx.slots.inject('shell.overlay', () =>
        ctx.slots.register(
          {
            name: 'shell.overlay',
            id: 'chat-chime.cards',
            order: 60,
            locale: NS,
            inject: () => ({ prefs, chime, openSession })
          },
          CompletionOverlay
        )
      );

      ctx.slots.inject('settings.general.item', () =>
        ctx.slots.register(
          {
            name: 'settings.general.item',
            id: 'chat-chime',
            order: 19,
            locale: NS,
            inject: () => ({ prefs, chime })
          },
          SettingsRow
        )
      );
    }

    return { apply, inject };
  }
});
