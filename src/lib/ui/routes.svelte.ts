// Hash routes, so the system back button stays inside the installed app.

export type Route = { screen: 'list' } | { screen: 'workout'; id: string };

export function parseRoute(hash: string): Route {
  const workout = hash.match(/^#\/w\/([0-9A-Za-z]+)$/);
  if (workout) return { screen: 'workout', id: workout[1] };
  return { screen: 'list' };
}

export const workoutPath = (id: string) => `#/w/${id}`;
export const listPath = '#/';

const state = $state({ route: parseRoute(location.hash) });

addEventListener('hashchange', () => {
  state.route = parseRoute(location.hash);
});

export const router = {
  get route() {
    return state.route;
  },
};

/** Goes to a screen. Sets the route at once: hashchange comes a moment later. */
export function go(path: string) {
  location.hash = path;
  state.route = parseRoute(path);
}
