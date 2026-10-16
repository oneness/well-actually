/**
 * The one browser API the extension uses, reached through the one shim it
 * needs.
 *
 * Firefox exposes a promise-returning `browser` namespace; Chrome exposes
 * `chrome`, which has returned promises for storage since Chrome 88. Both are
 * typed here by hand, narrowly, rather than pulling in a polyfill or a types
 * package for two methods.
 */

export interface StorageArea {
  get(keys: string | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export interface WebExtension {
  /**
   * `local`, not `sync`. The map is a few words the user typed, and keeping it
   * on the machine means nothing about what they read leaves it. `sync` would
   * carry the map through their browser account, which is a strange thing for
   * an extension that argues about saying precisely what things are to do
   * quietly in the background.
   */
  storage: { local: StorageArea };
}

declare global {
  var browser: WebExtension | undefined;
  var chrome: WebExtension | undefined;
}

/**
 * `undefined` outside an extension context, which is what makes the pure tests
 * able to import a module that mentions it.
 */
export const webExtension: WebExtension | undefined = globalThis.browser ?? globalThis.chrome;
