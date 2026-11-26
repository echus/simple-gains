<script lang="ts">
  // Shown in place of the screens when the browser can't open this device's database or read
  // from it, after the app's own tries. With the browser's own error, the only clue to
  // what went wrong.
  let { error }: { error: unknown } = $props();

  // An installed app runs standalone: there is no browser to close
  const window = matchMedia('(display-mode: standalone)').matches ? 'app' : 'browser';

  // Dexie wraps the browser's error and repeats it in its own message: show the browser's
  const detail = $derived.by(() => {
    const cause = (error as { inner?: unknown } | null)?.inner ?? error;
    return cause instanceof Error || cause instanceof DOMException ? `${cause.name}: ${cause.message}` : String(cause);
  });
</script>

<main>
  <p>Unable to read workouts stored on this device.</p>
  <p>Try reloading the app. If this message shows again, close the {window} and open it again.</p>
  <button onclick={() => location.reload()}>Reload</button>
  <p class="detail">{detail}</p>
</main>

<style>
  main {
    flex: 1;
    padding: 24px 0;
  }

  p {
    margin: 0 0 12px;
  }

  .detail {
    margin-top: 16px;
    color: var(--muted);
    font-size: 0.85em;
    overflow-wrap: anywhere;
  }

  /* A plain outlined button */
  button {
    padding: 6px 12px;
    border: none;
    border-radius: var(--radius);
    background: none;
    box-shadow: inset 0 0 0 1px var(--border-strong);
    font-size: 0.9em;
    font-weight: 600;
    cursor: pointer;
  }

  button:hover {
    box-shadow: inset 0 0 0 1px var(--accent);
  }
</style>
