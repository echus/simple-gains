<script lang="ts">
  import Icon from './Icon.svelte';
  import { edit } from '$lib/workouts/undo.svelte';
  import { addItem } from '$lib/workouts/items';
  import * as ui from '$lib/ui/icons';

  // Adds an exercise by name. The picker with built-in exercises and matching replaces this in
  // build step 3
  let { workoutId, autofocus = false }: { workoutId: string; autofocus?: boolean } = $props();

  let name = $state('');

  async function add(e: SubmitEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const typed = name;
    name = '';
    await edit(workoutId, () => addItem(workoutId, typed));
  }

  function focusOnMount(node: HTMLInputElement) {
    if (autofocus && matchMedia('(hover: hover)').matches) node.focus(); // a keyboard popping up on a phone gets in the way
  }
</script>

<form onsubmit={add}>
  <span class="ring" aria-hidden="true"><Icon svg={ui.plus} size={14} /></span>
  <input
    aria-label="Add exercise"
    placeholder="Add exercise"
    autocomplete="off"
    autocapitalize="sentences"
    enterkeyhint="done"
    bind:value={name}
    use:focusOnMount
  />
  {#if name.trim()}
    <button class="enter" aria-label="Add">
      <Icon svg={ui.enter} size={16} />
    </button>
  {/if}
</form>

<style>
  /* Laid out like the New workout row, on a card of its own */
  form {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 46px;
    padding: 0 12px;
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow:
      inset 0 0 0 1px var(--glow-ring),
      0 0 10px var(--glow);
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

  input {
    flex: 1;
    min-width: 0;
    padding: 11px 0;
    border: none;
    background: none;
    line-height: 1.4;
    caret-color: var(--accent);
    outline: none;
  }

  input::placeholder {
    color: var(--icon-quiet);
    opacity: 1;
  }

  .enter {
    flex: none;
    display: grid;
    place-items: center;
    padding: 6px;
    margin-right: -6px;
    border: none;
    background: none;
    color: var(--muted);
    cursor: pointer;
  }

  .enter:hover {
    color: var(--text);
  }
</style>
