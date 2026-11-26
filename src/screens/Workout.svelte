<script lang="ts">
  import { onDestroy } from 'svelte';
  import AddExercise from '../components/AddExercise.svelte';
  import ExerciseCard from '../components/ExerciseCard.svelte';
  import TextField from '../components/TextField.svelte';
  import { exerciseColours } from '$lib/workouts/colours';
  import { formatDate, formatElapsed, formatTime } from '$lib/workouts/dates';
  import { clearHistory, edit } from '$lib/workouts/undo.svelte';
  import {
    dropIfEmpty,
    finishWorkout,
    loadWorkout,
    updateWorkout,
    type LoadedWorkout,
  } from '$lib/workouts/workouts';
  import { watch } from '$lib/ui/live';
  import { go, listPath } from '$lib/ui/routes.svelte';

  // One workout: logging it and editing it later are the same screen
  let { id }: { id: string } = $props();

  // Undefined until the first read, null once it's gone (deleted, or a link to nothing)
  let loaded = $state.raw<LoadedWorkout | null | undefined>(undefined);
  $effect(() => watch(() => loadWorkout(id), (read) => (loaded = read ?? null)));

  // The clock for the timer: each 10 seconds is often enough for whole minutes
  let now = $state(Date.now());
  $effect(() => {
    const timer = setInterval(() => (now = Date.now()), 10_000);
    return () => clearInterval(timer);
  });

  // Undo and redo cover this workout only, while it's open
  clearHistory();

  // Left with nothing in it: it goes, so stray taps on New don't fill the list
  onDestroy(() => {
    clearHistory();
    dropIfEmpty(id);
  });

  async function finish() {
    await finishWorkout(id);
    go(listPath);
  }
</script>

<main>
  {#if loaded === null}
    <p class="gone">This workout is not on this device.</p>
  {:else if loaded}
    {@const { workout, items } = loaded}
    {@const colours = exerciseColours(items.map(({ item }) => item.exerciseId))}
    <!-- No name to type: the date and start time say which workout it is. The timer in the
         middle runs until it's finished -->
    <h2 class="title">
      <span class="date">{formatDate(workout.date)}</span>
      {#if !workout.finishedAt}
        <span class="timer" aria-label="Time since the start">{formatElapsed(now - Date.parse(workout.createdAt))}</span>
      {/if}
      {#if workout.time}<span class="time">{formatTime(workout.time)}</span>{/if}
    </h2>

    <!-- Under the date, as the exercise notes sit under their names: grey until written in -->
    <div class="notes">
      <TextField
        multiline
        label="Workout note"
        placeholder="Add a workout note"
        value={workout.notes}
        save={(notes) => edit(id, () => updateWorkout(id, { notes }), `workouts:${id}:notes`)}
      />
    </div>

    <ul class="items" aria-label="Exercises">
      {#each items as { item, sets }, i (item.id)}
        <ExerciseCard {item} {sets} colour={colours[i]} />
      {/each}
    </ul>

    <AddExercise workoutId={id} autofocus={items.length === 0} />

    {#if !workout.finishedAt}
      <button class="finish" onclick={finish}>Finish workout</button>
    {/if}
  {/if}
</main>

<style>
  main {
    flex: 1;
    padding: 0 0 64px;
  }

  .gone {
    color: var(--muted);
  }

  /* Date, timer and time across one line: the timer stays centred */
  .title {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: baseline;
    gap: 8px;
    margin: 0;
    padding: 12px 2px;
    font-family: var(--font-title);
    font-variation-settings: var(--title-opsz);
    font-size: 1rem; /* below the brand's 1.25rem */
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  .date {
    grid-column: 1;
    white-space: nowrap;
  }

  .timer {
    grid-column: 2;
    color: var(--muted);
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .time {
    grid-column: 3;
    justify-self: end;
    color: var(--muted);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .items {
    display: grid;
    gap: 12px;
    margin: 0 0 12px;
    padding: 0;
    list-style: none;
  }

  .notes {
    margin: -6px 2px 12px;
  }

  /* Filled in ink: the one big action on the screen */
  .finish {
    display: block;
    width: 100%;
    margin-top: 20px;
    padding: 12px;
    border: none;
    border-radius: var(--radius);
    background: var(--accent);
    color: var(--on-accent);
    font-weight: 600;
    cursor: pointer;
  }
</style>
