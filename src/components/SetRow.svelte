<script lang="ts">
  import { tick } from 'svelte';
  import Icon from './Icon.svelte';
  import { endTyping } from '$lib/workouts/undo.svelte';
  import { deleteSet, formatNumber, parseReps, parseWeight, setItemUnit, updateSet } from '$lib/workouts/sets';
  import type { WorkoutSet } from '$lib/types';
  import * as ui from '$lib/ui/icons';

  // One set: its number (tap for warm-up), weight, reps and done. A done set shows its weight
  // and reps as plain text: a double-click (or double tap) makes them fields again, until Enter
  // or a tap elsewhere
  interface Props {
    set: WorkoutSet;
    label: string;
    exercise: string;
    /** Runs a change through the workout's undo history (see ExerciseCard). */
    change: (action: () => Promise<unknown>, typing?: string | null) => Promise<unknown>;
  }

  let { set, label, exercise, change }: Props = $props();

  const name = $derived(label === 'W' ? 'Warm-up' : `Set ${label}`);
  // Spelled out, to read at a glance
  const shownLabel = $derived(label === 'W' ? 'Warm up' : `Set ${label}`);

  // What's typed in each field while it has focus. The database's copy shows otherwise: a
  // write that lands after the next key press would undo that key, and "62." would read back
  // as "62"
  let weightDraft = $state<string | null>(null);
  let repsDraft = $state<string | null>(null);

  function typeWeight(e: Event) {
    weightDraft = (e.currentTarget as HTMLInputElement).value;
    const weight = parseWeight(weightDraft);
    if (weight !== undefined) change(() => updateSet(set.id, { weight }), `sets:${set.id}:weight`);
  }

  function typeReps(e: Event) {
    repsDraft = (e.currentTarget as HTMLInputElement).value;
    const reps = parseReps(repsDraft);
    if (reps !== undefined) change(() => updateSet(set.id, { reps }), `sets:${set.id}:reps`);
  }

  // Ticking it done pops the tick, as ticking a task off in Dumb Tasks
  let popping = $state(false);

  function toggleDone() {
    popping = !set.done;
    editing = false;
    change(() => updateSet(set.id, { done: !set.done }));
  }

  // A done set being changed: it stays done, with its fields back until focus leaves the row
  let editing = $state(false);
  const showFields = $derived(!set.done || editing);
  let row = $state<HTMLLIElement>();

  async function editFrom(field: 'weight' | 'reps') {
    editing = true;
    await tick();
    row?.querySelector<HTMLInputElement>(`input.${field}`)?.focus();
  }

  // Two taps or clicks close together. Counted here, as Safari on iPhone may send no dblclick
  // for plain text
  let lastTap = 0;
  function tapped(field: 'weight' | 'reps') {
    const now = Date.now();
    if (now - lastTap < 350) {
      lastTap = 0;
      editFrom(field);
    } else lastTap = now;
  }

  function leaveRow(e: FocusEvent) {
    if (editing && !row?.contains(e.relatedTarget as Node | null)) editing = false;
  }

  // Enter moves on to the reps, and from the reps closes the keypad. In a done set being
  // changed it's finished at once
  function next(e: KeyboardEvent) {
    if (e.key !== 'Enter') return;
    const input = e.currentTarget as HTMLInputElement;
    const reps = row?.querySelector<HTMLInputElement>('input.reps');
    if (reps && reps !== input && !editing) reps.focus();
    else input.blur();
  }
</script>

<li class:done={set.done} class:warmup={set.isWarmup} bind:this={row} onfocusout={leaveRow}>
  <span></span>
  <button
    class="label"
    aria-label="{name} of {exercise}. {set.isWarmup ? 'Make it a working set' : 'Make it a warm-up'}"
    title={set.isWarmup ? 'Warm-up: tap for a working set' : 'Tap for a warm-up'}
    onclick={() => change(() => updateSet(set.id, { isWarmup: !set.isWarmup }))}>{shownLabel}</button
  >

  <!-- Fields and done text share one layout: the number centred in a box and the unit just
       outside it, so nothing moves when a set is ticked -->
  {#if showFields}
    <label class="field for-weight">
      <input
        class="weight"
        aria-label="{name} weight in {set.unit}"
        inputmode="decimal"
        autocomplete="off"
        enterkeyhint="next"
        value={weightDraft ?? formatNumber(set.weight)}
        oninput={typeWeight}
        onfocus={() => {
          endTyping();
          weightDraft = formatNumber(set.weight);
        }}
        onblur={() => (weightDraft = null)}
        onkeydown={next}
      />
      <!-- The unit switches every set of the exercise between kg and lb, numbers as typed -->
      <button
        class="suffix unit"
        tabindex="-1"
        aria-label="Weights in {set.unit}. Switch to {set.unit === 'kg' ? 'lb' : 'kg'}"
        title="Switch to {set.unit === 'kg' ? 'lb' : 'kg'}"
        onclick={(e) => {
          e.preventDefault(); // a tap on the unit switches it, and doesn't focus the field
          change(() => setItemUnit(set.itemId, set.unit === 'kg' ? 'lb' : 'kg'));
        }}>{set.unit}</button
      >
    </label>

    <label class="field for-reps">
      <input
        class="reps"
        aria-label="{name} reps"
        inputmode="numeric"
        autocomplete="off"
        enterkeyhint="done"
        value={repsDraft ?? formatNumber(set.reps)}
        oninput={typeReps}
        onfocus={() => {
          endTyping();
          repsDraft = formatNumber(set.reps);
        }}
        onblur={() => (repsDraft = null)}
        onkeydown={next}
      />
      <span class="suffix" aria-hidden="true">reps</span>
    </label>
  {:else}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span class="field for-weight shown" class:fresh={popping} aria-label="{name} weight" title="Double-click to change" onpointerup={() => tapped('weight')}
      ><span class="number">{formatNumber(set.weight) || '–'}</span> <span class="suffix">{set.unit}</span></span
    >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span class="field for-reps shown" class:fresh={popping} aria-label="{name} reps" title="Double-click to change" onpointerup={() => tapped('reps')}
      ><span class="number">{formatNumber(set.reps) || '–'}</span> <span class="suffix">reps</span></span
    >
  {/if}

  <button
    class="tick"
    aria-label="{name} done"
    aria-pressed={set.done}
    class:popping
    onanimationend={() => (popping = false)}
    onclick={toggleDone}><Icon svg={ui.check} size={14} /></button
  >

  <!-- A mouse deletes with this; touch gets swipe in build step 2 -->
  <button class="delete" aria-label="Delete {name.toLowerCase()} of {exercise}" onclick={() => change(() => deleteSet(set.id))}
    ><Icon svg={ui.x} size={12} /></button
  >
</li>

<style>
  li {
    display: grid;
    grid-template-columns: var(--cols);
    gap: var(--col-gap);
    align-items: center;
    min-height: 44px;
    border-radius: var(--radius);
  }

  .label {
    height: 36px;
    padding: 0 4px; /* clear of the hover fill's edges */
    text-align: center;
    white-space: nowrap;
    border: none;
    border-radius: var(--radius);
    background: none;
    color: var(--muted);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
  }

  .label:hover {
    background: var(--fill-quiet);
  }

  /* Smaller, so "Warm up" takes about the room of "Set 1" */
  li.warmup .label {
    color: var(--text);
    font-size: 11px;
  }

  /* A rounded grey box with the number centred in it, and its unit just outside. The card's
     one text size, in fields and done text alike */
  .field {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    cursor: text;
  }

  input,
  .number {
    flex: 1;
    min-width: 0;
    height: 36px;
    padding: 0 4px;
    line-height: 36px;
    text-align: center;
  }

  input {
    border: none;
    border-radius: var(--radius);
    background: var(--fill-field);
    font: inherit;
    caret-color: var(--accent);
    outline: none;
  }

  input:focus {
    box-shadow: inset 0 0 0 1px var(--accent);
  }

  /* A set width for each unit, so the boxes line up from row to row */
  .suffix {
    flex: none;
    color: var(--muted);
    font-weight: 400;
    text-align: left;
  }

  .for-weight .suffix {
    width: 1.3em; /* "kg" or "lb" */
  }

  .for-reps .suffix {
    width: 2.2em; /* "reps" */
  }

  /* The weight's unit is a switch: dotted, as a hint it does something */
  .unit {
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    font-weight: 400;
    color: var(--muted);
    text-decoration: underline dotted;
    text-underline-offset: 3px;
    cursor: pointer;
  }

  .unit:hover {
    color: var(--text);
  }

  /* More room between the weight and the reps */
  .for-weight {
    margin-right: 4px;
  }

  .for-reps {
    margin-left: 4px;
  }

  /* A done set: the same, as text with no box. Double-clicked, it's fields again. Not bold:
     the fields' numbers are, so a done set reads quieter */
  .field.shown {
    font-weight: 400;
    cursor: default;
    touch-action: manipulation; /* a double tap reaches the page, not the zoom */
    user-select: none;
  }

  /* An empty ring; filled in ink with the tick once done */
  .tick {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    margin: auto;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: none;
    box-shadow: inset 0 0 0 1px var(--border-strong);
    color: var(--border-strong);
    cursor: pointer;
  }

  .tick:hover {
    box-shadow: inset 0 0 0 1px var(--accent);
    color: var(--text);
  }

  /* Done: filled with the exercise's colour (see colours.ts) */
  .tick[aria-pressed='true'] {
    background: color-mix(in srgb, var(--circle, var(--accent)) var(--circle-tint), var(--tint-base));
    box-shadow: none;
    color: var(--on-tint);
  }

  /* Ticked: the circle fills and pops, and the tick grows into it */
  .tick.popping {
    animation: pop 320ms cubic-bezier(0.3, 1.6, 0.5, 1);
  }

  .tick.popping :global(svg) {
    animation: grow 320ms cubic-bezier(0.3, 1.6, 0.5, 1);
  }

  @keyframes pop {
    0% {
      transform: scale(0.8);
    }
    45% {
      transform: scale(1.2);
    }
  }

  @keyframes grow {
    0% {
      transform: scale(0);
    }
  }

  /* Just ticked: the numbers fade in where the fields were */
  .field.fresh {
    animation: settle 200ms ease-out;
  }

  @keyframes settle {
    from {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tick.popping,
    .tick.popping :global(svg),
    .field.fresh {
      animation: none;
    }
  }

  .delete {
    display: none;
  }

  /* Only where there's a real mouse and room for it, and only on the row it's over */
  @media (hover: hover) and (min-width: 420px) {
    .delete {
      display: grid;
      place-items: center;
      width: 24px;
      height: 24px;
      padding: 0;
      border: none;
      background: none;
      color: var(--muted);
      cursor: pointer;
      opacity: 0;
    }

    li:hover .delete,
    .delete:focus-visible {
      opacity: 1;
    }

    .delete:hover {
      color: var(--text);
    }
  }
</style>
