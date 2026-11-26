<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import { formatDate } from '$lib/workouts/dates';
  import { listWorkouts, newWorkout, type WorkoutSummary } from '$lib/workouts/workouts';
  import { watch } from '$lib/ui/live';
  import { go, workoutPath } from '$lib/ui/routes.svelte';
  import * as ui from '$lib/ui/icons';

  // Undefined until the first read
  let workouts = $state.raw<WorkoutSummary[] | undefined>(undefined);
  $effect(() => watch(listWorkouts, (read) => (workouts = read)));

  async function start() {
    go(workoutPath(await newWorkout()));
  }
</script>

<main>
  <div class="card">
    <button class="new" onclick={start}>
      <span class="ring" aria-hidden="true"><Icon svg={ui.plus} size={14} /></span>
      New workout
    </button>
    {#if workouts?.length}
      <ul aria-label="Workouts">
        {#each workouts as { workout, exerciseNames } (workout.id)}
          <li>
            <a href={workoutPath(workout.id)}>
              <span class="line">
                <span class="date">{formatDate(workout.date)}</span>
                {#if workout.name}<span class="name">{workout.name}</span>{/if}
                {#if !workout.finishedAt}<span class="going">in progress</span>{/if}
              </span>
              {#if exerciseNames.length}
                <span class="exercises">{exerciseNames.join(', ')}</span>
              {/if}
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
  {#if workouts?.length === 0}
    <p class="empty">No workouts yet.</p>
  {/if}
</main>

<style>
  main {
    flex: 1;
    padding: 8px 0 64px;
  }

  /* A white list on the page, as in Dumb Tasks */
  .card {
    position: relative;
    overflow: clip;
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: 0 0 10px var(--glow);
  }

  /* The glow's thin edge, drawn on top so rows and dividers don't cover it */
  .card::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 2;
    border-radius: inherit;
    box-shadow: inset 0 0 0 1px var(--glow-ring);
    pointer-events: none;
  }

  /* An empty ring with a +, like the add row in Dumb Tasks */
  .new {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 46px;
    padding: 0 12px;
    border: none;
    background: none;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
  }

  .ring {
    flex: none;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1px var(--border-strong);
    color: var(--muted);
  }

  .new:hover .ring {
    box-shadow: inset 0 0 0 1px var(--accent);
    color: var(--text);
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  /* Barely-there dividers: the page background colour, against the white list */
  li {
    border-top: 1px solid var(--bg);
  }

  a {
    display: block;
    padding: 10px 12px 10px 50px; /* in line with the text of the New row */
    color: inherit;
    text-decoration: none;
  }

  a:hover {
    background: color-mix(in srgb, var(--text) 4%, transparent);
  }

  .line {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 8px;
  }

  .date {
    font-weight: 600;
  }

  .going {
    color: var(--muted);
  }

  .exercises {
    display: block;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .empty {
    margin: 16px 2px;
    color: var(--muted);
  }
</style>
