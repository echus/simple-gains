<script lang="ts">
  import { slide } from 'svelte/transition';
  import Icon from './Icon.svelte';
  import SetRow from './SetRow.svelte';
  import TextField from './TextField.svelte';
  import { deleteItem, renameItem, updateItemNotes } from '$lib/workouts/items';
  import { edit, isLeavingForUndo } from '$lib/workouts/undo.svelte';
  import { addSet, setLabels } from '$lib/workouts/sets';
  import type { WorkoutItem, WorkoutSet } from '$lib/types';
  import * as ui from '$lib/ui/icons';

  // One exercise in a workout: its name, add set, its note, its sets and delete. The caret
  // folds it down to its name and a count of sets done
  // `colour` fills its done ticks (see colours.ts)
  let { item, sets, colour }: { item: WorkoutItem; sets: WorkoutSet[]; colour: string } = $props();

  const labels = $derived(setLabels(sets));

  // The name saves when the field is left or on Enter, not on each key press: each name
  // points to an exercise, and the letters on the way would make exercises of their own
  let nameDraft = $state<string | null>(null);

  function saveName() {
    const typed = nameDraft?.trim().replace(/\s+/g, ' ');
    nameDraft = null;
    if (isLeavingForUndo()) return; // undo wins over a name not yet saved
    if (typed && typed !== item.nameAsTyped) change(() => renameItem(item.id, typed));
  }

  // Folded: kept while the workout is open, not saved
  let collapsed = $state(false);
  const doneCount = $derived(sets.filter((s) => s.done).length);
  const MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 150;

  // Every change goes through the workout's undo history
  const change = <T,>(action: () => Promise<T>, typing: string | null = null) => edit(item.workoutId, action, typing);
</script>

<li class="card" aria-label={item.nameAsTyped} style:--circle={colour}>
  <div class="head">
    <div class="title">
      <input
        class="name"
        aria-label="Exercise name"
        autocomplete="off"
        autocapitalize="sentences"
        enterkeyhint="done"
        value={nameDraft ?? item.nameAsTyped}
        onfocus={() => (nameDraft = item.nameAsTyped)}
        oninput={(e) => (nameDraft = e.currentTarget.value)}
        onblur={saveName}
        onkeydown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            nameDraft = null;
            e.currentTarget.blur();
          }
        }}
      />
    </div>
    {#if collapsed}
      <span class="summary">{doneCount}/{sets.length} done</span>
    {:else}
      <!-- A copy of the last set -->
      <button class="add-set" aria-label="Add set to {item.nameAsTyped}" title="Add set" onclick={() => change(() => addSet(item.id))}>
        <span class="ring"><Icon svg={ui.plus} size={14} /></span>
      </button>
    {/if}
    <button
      class="fold"
      class:closed={collapsed}
      aria-label="{collapsed ? 'Show' : 'Hide'} sets of {item.nameAsTyped}"
      aria-expanded={!collapsed}
      onclick={() => (collapsed = !collapsed)}><Icon svg={ui.caretDown} size={14} /></button
    >
  </div>

  {#if !collapsed}
    <div class="body" transition:slide={{ duration: MOTION }}>
      <!-- Always there: grey "Add note" until something is written -->
      <div class="note">
        <TextField
          multiline
          label="Note for {item.nameAsTyped}"
          placeholder="Add note"
          value={item.notes}
          save={(notes) => change(() => updateItemNotes(item.id, notes), `items:${item.id}:notes`)}
        />
      </div>


      <ul class="sets" aria-label="Sets of {item.nameAsTyped}">
        {#each sets as set, i (set.id)}
          <SetRow {set} label={labels[i]} exercise={item.nameAsTyped} {change} />
        {/each}
      </ul>

      <!-- Undo brings it back -->
      <button class="delete" aria-label="Delete {item.nameAsTyped}" title="Delete exercise" onclick={() => change(() => deleteItem(item.id))}>
        <Icon svg={ui.trash} size={16} />
      </button>
    </div>
  {/if}
</li>

<style>
  /* A white card on the page, as the lists in Dumb Tasks */
  .card {
    position: relative;
    padding: 4px 8px 8px;
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow:
      inset 0 0 0 1px var(--glow-ring),
      0 0 10px var(--glow);

    /* The set row's columns: handle (build step 2), set number,
       weight, reps, done, and on a computer the delete × */
    --cols: 4px 52px minmax(0, 1fr) minmax(0, 1fr) 36px;
    --col-gap: 4px;
  }

  /* A mouse gets the × on each set, where there's room for it */
  @media (hover: hover) and (min-width: 420px) {
    .card {
      --cols: 4px 52px minmax(0, 1fr) minmax(0, 1fr) 36px 24px;
    }
  }

  .head {
    display: flex;
    align-items: center;
    gap: 2px;
    min-height: 40px;
    padding-left: 4px;
  }

  .summary {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  /* As the done rows' caret in Dumb Tasks: down when open, turned to point right when folded */
  .fold {
    display: grid;
    place-items: center;
    width: 32px;
    height: 36px;
    padding: 0;
    border: none;
    background: none;
    color: var(--muted);
    cursor: pointer;
    transition: transform 150ms;
  }

  .fold:hover {
    color: var(--text);
  }

  .fold.closed {
    transform: rotate(-90deg);
  }

  @media (prefers-reduced-motion: reduce) {
    .fold {
      transition: none;
    }
  }

  .title {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: 1em;
    font-weight: 600;
  }

  /* Reads as the card's title: a field only once tapped */
  .name {
    width: 100%;
    padding: 4px 0;
    border: none;
    border-radius: var(--radius);
    background: none;
    font-weight: inherit;
    text-overflow: ellipsis;
    caret-color: var(--accent);
    outline: none;
  }

  .name:focus {
    box-shadow: 0 1px 0 var(--accent);
    border-radius: 0;
  }

  /* Typed text in ink; the empty field's "Add note" stays grey */
  .note {
    margin: 0 0 6px 4px;
    color: var(--text);
  }

  .sets {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* A + in an empty ring, like the add rows */
  .add-set {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border: none;
    background: none;
    color: var(--muted);
    cursor: pointer;
  }

  .ring {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1px var(--border-strong);
  }

  .add-set:hover {
    color: var(--text);
  }

  .add-set:hover .ring {
    box-shadow: inset 0 0 0 1px var(--accent);
  }
  /* Small and grey, at the bottom right under the ticks */
  .delete {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    margin: 4px 0 -4px auto;
    padding: 0;
    border: none;
    border-radius: var(--radius);
    background: none;
    color: var(--muted);
    cursor: pointer;
  }

  .delete:hover {
    background: var(--fill-quiet);
    color: var(--text);
  }
</style>
