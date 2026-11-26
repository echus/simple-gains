<script lang="ts">
  import { endTyping } from '$lib/workouts/undo.svelte';

  // A text field that writes on every input. While it has focus it shows what was typed, not
  // what the database sends back: a write that lands after the next key press would otherwise
  // undo that key and move the caret.
  interface Props {
    value: string;
    save: (value: string) => void;
    label: string;
    placeholder?: string;
    multiline?: boolean;
    class?: string;
    autofocus?: boolean;
  }

  let { value, save, label, placeholder = '', multiline = false, class: className = '', autofocus = false }: Props =
    $props();

  let draft = $state<string | null>(null);
  const shown = $derived(draft ?? value);

  function oninput(e: Event) {
    draft = (e.currentTarget as HTMLInputElement | HTMLTextAreaElement).value;
    save(draft);
  }

  function onfocus() {
    endTyping(); // each visit to the field is one undo step
    draft = value;
  }

  function onblur() {
    draft = null;
  }

  function focusOnMount(node: HTMLElement) {
    if (autofocus) node.focus();
  }
</script>

{#if multiline}
  <textarea
    class={className}
    aria-label={label}
    {placeholder}
    rows="1"
    value={shown}
    {oninput}
    {onfocus}
    {onblur}
    use:focusOnMount
  ></textarea>
{:else}
  <input
    class={className}
    aria-label={label}
    {placeholder}
    value={shown}
    {oninput}
    {onfocus}
    {onblur}
    use:focusOnMount
    enterkeyhint="done"
    onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
  />
{/if}

<style>
  input,
  textarea {
    width: 100%;
    border: none;
    background: none;
    caret-color: var(--accent);
    outline: none;
  }

  /* Grows with its text where the browser can (not yet Firefox and Safari: those scroll) */
  textarea {
    field-sizing: content;
    min-height: 1.5em;
    resize: none;
    line-height: 1.4;
  }

  input::placeholder,
  textarea::placeholder {
    color: var(--icon-quiet);
    opacity: 1;
  }
</style>
