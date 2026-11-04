/**
 * Makes the phone's back button step back through the app, like any other app, instead of closing it.
 *
 * Every screen layer that should answer to back (an open sheet, the Quran reader, a tab reached from
 * another) pushes one browser history entry, stamped with its depth (how many layers are open, itself
 * included). Each popstate then says where the browser landed, and that depth is compared with the number of
 * layers the app has open:
 *   - lower: the user went back, so the top live layer's own back action runs;
 *   - higher: the browser went forward onto an entry no layer stands for (the Forward button, or a reload that
 *     kept old entries), so it is sent straight back;
 *   - equal: it is the echo of an entry removed on purpose, and nothing happens.
 * Layers closed from the screen take their entry away again, and layers closed from underneath another one are
 * stepped over later, so back always does something visible.
 */

export interface HistoryLike {
  pushState(state: unknown, title: string, url?: string | null): void;
  replaceState(state: unknown, title: string, url?: string | null): void;
  back(): void;
}

interface Layer {
  id: number;
  onBack: () => void;
  /** True once the screen it stood for is gone but its history entry could not be removed yet. */
  dead: boolean;
}

/** The depth stamped on a history entry. Entries the app did not push (the first one) count as 0. */
export const depthOf = (state: unknown): number => {
  const depth = (state as { backDepth?: unknown } | null | undefined)?.backDepth;
  return typeof depth === 'number' && Number.isInteger(depth) && depth > 0 ? depth : 0;
};

export class BackStack {
  private layers: Layer[] = [];
  private nextId = 1;
  /** An entry is waiting to be taken away; a layer opened in the same tick reuses it instead. */
  private pendingBack = false;

  constructor(private readonly history: HistoryLike) {}

  /** Adds a layer and its history entry. Returns an id for remove(). */
  push(onBack: () => void): number {
    const layer: Layer = { id: this.nextId, onBack, dead: false };
    this.nextId += 1;
    this.layers.push(layer);
    const state = { backDepth: this.layers.length };
    if (this.pendingBack) {
      // One screen closed and the next opened in the same render (picking an item from a sheet). The entry
      // of the first now stands for the second; sending back for it would land after this push and undo it.
      this.pendingBack = false;
      this.history.replaceState(state, '');
    } else {
      this.history.pushState(state, '');
    }
    return layer.id;
  }

  /** The screen closed by itself. Takes the entry away when it is the newest, otherwise marks it to be stepped over. */
  remove(id: number): void {
    const at = this.layers.findIndex((l) => l.id === id);
    if (at === -1) return;
    if (at === this.layers.length - 1) {
      this.layers.pop();
      this.releaseEntry();
    } else {
      this.layers[at].dead = true;
    }
  }

  /** Takes the newest entry away once the current tick is over, unless a layer opened meanwhile has claimed it. */
  private releaseEntry(): void {
    this.pendingBack = true;
    queueMicrotask(() => {
      if (!this.pendingBack) return;
      this.pendingBack = false;
      this.history.back();
    });
  }

  /** True while some screen on the trail would answer to back. False means back has nothing left to close. */
  hasLiveLayer(): boolean {
    return this.layers.some((layer) => !layer.dead);
  }

  /** The trail no longer matters (the reader went Home), so every entry is stepped over on the way out. */
  markAllDead(): void {
    for (const layer of this.layers) layer.dead = true;
  }

  /** Forgets every layer. For tests, which share one browser window between cases. */
  reset(): void {
    this.layers = [];
    this.pendingBack = false;
  }

  /** Call on every popstate, and once at start-up, with the state of the entry the browser is now on. */
  onPop(state: unknown): void {
    const depth = depthOf(state);
    const open = this.layers.length;
    if (depth === open) return;
    if (depth > open) {
      this.history.back();
      return;
    }
    const closed = this.layers.splice(depth);
    const live = [...closed].reverse().find((layer) => !layer.dead);
    if (live) live.onBack();
    else this.history.back(); // nothing on screen answered to these entries, so keep going (or leave the app)
  }
}

let shared: BackStack | null = null;

/** The app's one stack, created on first use and tied to the browser's history. */
export const getBackStack = (): BackStack => {
  if (shared) return shared;
  const stack = new BackStack(typeof window === 'undefined' ? { pushState() {}, replaceState() {}, back() {} } : window.history);
  shared = stack;
  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', (event) => stack.onPop(event.state));
    // After a reload the browser still holds the entries pushed before it, but no layer stands for them.
    stack.onPop(window.history.state);
  }
  return stack;
};
