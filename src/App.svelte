<script lang="ts">
  import HistoryButtons from './components/HistoryButtons.svelte';
  import Outdated from './components/Outdated.svelte';
  import ThemeToggle from './components/ThemeToggle.svelte';
  import Unreadable from './components/Unreadable.svelte';
  import Workout from './screens/Workout.svelte';
  import WorkoutList from './screens/WorkoutList.svelte';
  import { listPath, router } from '$lib/ui/routes.svelte';
  import { status } from '$lib/ui/status.svelte';

  const stopped = $derived(Boolean(status.error) || status.outdated);
</script>

<header>
  <h1>
    <!-- Back to the list from anywhere, as is the browser's back. Over a message that the
         database can't be used it loads the app again -->
    <a class="home" href={stopped ? './' : listPath}>simple gains</a>
  </h1>
  <div class="header-actions">
    {#if !stopped}<HistoryButtons />{/if}
    <ThemeToggle />
  </div>
</header>

{#if status.outdated}
  <Outdated />
{:else if status.error}
  <!-- Not an empty list, which would look as if the workouts were gone -->
  <Unreadable error={status.error} />
{:else if !status.ready}
  <p class="loading">
    <span class="spinner" aria-hidden="true"></span>{status.retrying ? 'Trying again...' : 'Loading workouts...'}
  </p>
{:else if router.route.screen === 'workout'}
  {#key router.route.id}
    <Workout id={router.route.id} />
  {/key}
{:else}
  <WorkoutList />
{/if}

<style>
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 0 8px;
  }

  h1 {
    margin: 0;
    font-family: var(--font-title);
    font-variation-settings: var(--title-opsz);
    font-size: 1.25rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    white-space: nowrap;
  }

  .header-actions {
    display: flex;
    gap: 4px;
  }

  .home {
    color: inherit;
    text-decoration: none;
  }

  .loading {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    padding: 12px 0;
    color: var(--muted);
    font-size: 0.9em;
  }

  /* A ring with one end open, turning */
  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: turn 800ms linear infinite;
  }

  @keyframes turn {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation-duration: 3s;
    }
  }
</style>
