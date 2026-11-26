import { mount } from 'svelte';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import './app.css';
import App from './App.svelte';
import { db, isDatabaseNewer } from '$lib/db';
import { requestPersistentStorage } from '$lib/startup';
import { workoutToResume } from '$lib/workouts/workouts';
import { go, router, workoutPath } from '$lib/ui/routes.svelte';
import { showOutdated, showReady, showRetrying, showUnreadable } from '$lib/ui/status.svelte';

/** Stops this copy of the app using the database, which a newer version has upgraded. */
function stopUsingDatabase() {
  db.close({ disableAutoOpen: true });
}

async function start() {
  // Shown straight away, with "Loading" until the database has opened
  mount(App, { target: document.getElementById('app')! });

  // The database doesn't open or doesn't answer, even after a few tries: say so, with a button
  // to reload. Carrying on would show an empty list, as if the workouts were gone.
  let newer: boolean;
  try {
    newer = await isDatabaseNewer(showRetrying);
  } catch (error) {
    stopUsingDatabase();
    showUnreadable(error);
    return;
  }
  // A newer version of the app upgraded the database: leave the data alone and ask for a reload.
  if (newer) {
    stopUsingDatabase();
    showOutdated();
    return;
  }
  // Another tab is upgrading the database to a newer version: reload into that version
  // rather than keep writing the old shape.
  db.on('versionchange', () => {
    stopUsingDatabase();
    location.reload();
    return false; // instead of Dexie's own close, which reopens on the next write
  });

  requestPersistentStorage();

  // Opening the phone mid-session goes straight back to the workout. Only at startup on the
  // list: the list must stay reachable while a workout is going
  if (router.route.screen === 'list') {
    const resume = await workoutToResume().catch(() => undefined);
    if (resume) go(workoutPath(resume.id));
  }
  showReady();
}

start();
