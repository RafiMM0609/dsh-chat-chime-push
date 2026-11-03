/**
 * Host half of the Chat Chime bundle.
 *
 * The Host has nothing to compute here: the browser already receives every
 * Session's `running` state through the Session list and the
 * `api-session/status` stream, so the completion signal, the synthesized
 * chime, and the card are all Client-side. This entry exists so the Loader
 * owns the package and the Web boot graph serves the `./client` artifact; it
 * registers no service, listener, or projection.
 *
 * @param {object} ctx - the Host plugin context.
 */
export function apply(ctx) {
  ctx.effect(
    () => () => {},
    'chat-chime: host half is inert (client-only bundle)',
  );
}
