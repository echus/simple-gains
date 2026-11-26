// Whether the database can be used. The screens wait for `ready`; until then the app says it's
// loading. A database that can't be read is kept as an error, so the app can say so: an empty
// list would look as if the workouts were gone.

const state = $state({ ready: false, retrying: false, outdated: false, error: null as unknown });

export const status = {
  get ready() {
    return state.ready;
  },
  /** The open failed once and is being tried again. */
  get retrying() {
    return state.retrying;
  },
  /** A newer version of the app has upgraded the database: this copy must leave it alone. */
  get outdated() {
    return state.outdated;
  },
  /** Why the workouts can't be read, if they can't. */
  get error() {
    return state.error;
  },
};

export const showReady = () => (state.ready = true);
export const showRetrying = () => (state.retrying = true);
export const showOutdated = () => (state.outdated = true);
export const showUnreadable = (e: unknown) => (state.error = e);
