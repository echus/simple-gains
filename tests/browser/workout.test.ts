import { expect, test, type Page } from '@playwright/test';

// Logging a workout in a real browser: the build works, and IndexedDB keeps every edit.

async function startWorkout(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New workout' }).click();
  await expect(page.getByLabel('Add exercise')).toBeVisible();
}

/** An exercise's card, by its name. */
const exercise = (page: Page, name: string) => page.getByRole('listitem', { name, exact: true });

async function addExercise(page: Page, name: string) {
  const add = page.getByLabel('Add exercise');
  await add.fill(name);
  await add.press('Enter');
  await expect(exercise(page, name)).toBeVisible();
}

test('keeps a logged set through a reload', async ({ page }) => {
  await startWorkout(page);
  await addExercise(page, 'Bench press');

  await page.getByLabel('Set 1 weight in kg').fill('62,5');
  await page.getByLabel('Set 1 reps').fill('8');
  const done = page.getByRole('button', { name: 'Set 1 done' });
  await done.click();
  await expect(done).toHaveAttribute('aria-pressed', 'true'); // shown once it's written

  // Done: the numbers show as text, until it's unticked
  await expect(page.getByLabel('Set 1 weight', { exact: true })).toHaveText('62.5 kg');
  await expect(page.getByLabel('Set 1 reps')).toHaveText('8 reps');

  await page.reload();
  await expect(page.getByLabel('Set 1 weight', { exact: true })).toHaveText('62.5 kg');
  await expect(page.getByLabel('Set 1 reps')).toHaveText('8 reps');
  await expect(done).toHaveAttribute('aria-pressed', 'true');

  await done.click();
  await expect(page.getByLabel('Set 1 weight in kg')).toHaveValue('62.5');
  await expect(page.getByLabel('Set 1 reps')).toHaveValue('8');
});

test('changes a done set after a double-click, and keeps it done', async ({ page }) => {
  await startWorkout(page);
  await addExercise(page, 'Squat');
  await page.getByLabel('Set 1 weight in kg').fill('100');
  await page.getByLabel('Set 1 reps').fill('5');
  const done = page.getByRole('button', { name: 'Set 1 done' });
  await done.click();
  const shown = page.getByLabel('Set 1 weight', { exact: true });
  await expect(shown).toHaveText('100 kg');

  await shown.dblclick();
  const weight = page.getByLabel('Set 1 weight in kg');
  await expect(weight).toBeFocused();
  await weight.fill('105');
  await weight.press('Enter');
  await expect(shown).toHaveText('105 kg');
  await expect(done).toHaveAttribute('aria-pressed', 'true');

  // Leaving the row ends it too
  await page.getByLabel('Set 1 reps').dblclick();
  await page.getByLabel('Set 1 reps').fill('6');
  await page.getByLabel('Note for Squat').click();
  await expect(page.getByLabel('Set 1 reps')).toHaveText('6 reps');
});

test('folds an exercise down to its name and sets done', async ({ page }) => {
  await startWorkout(page);
  await addExercise(page, 'Squat');
  await page.getByRole('button', { name: 'Add set to Squat' }).click();
  await page.getByRole('button', { name: 'Set 1 done' }).click();

  await page.getByRole('button', { name: 'Hide sets of Squat' }).click();
  await expect(page.getByLabel('Set 1 weight', { exact: true })).toBeHidden();
  await expect(exercise(page, 'Squat')).toContainText('1/2 done');

  await page.getByRole('button', { name: 'Show sets of Squat' }).click();
  await expect(page.getByLabel('Set 2 weight in kg')).toBeVisible();
});

test('keeps what is typed while the write is on its way', async ({ page }) => {
  await startWorkout(page);
  await addExercise(page, 'Squat');
  const weight = page.getByLabel('Set 1 weight in kg');
  await weight.pressSequentially('102.5', { delay: 0 });
  await expect(weight).toHaveValue('102.5');
});

test('adds a set as a copy of the last, and numbers warm-ups apart', async ({ page }) => {
  await startWorkout(page);
  await addExercise(page, 'Squat');
  await page.getByLabel('Set 1 weight in kg').fill('60');
  await page.getByLabel('Set 1 reps').fill('5');
  await page.getByRole('button', { name: /^Set 1 of Squat/ }).click(); // now a warm-up

  await page.getByRole('button', { name: 'Add set to Squat' }).click();
  await expect(page.getByLabel('Warm-up weight in kg')).toHaveCount(2);
  await page.getByRole('button', { name: /^Warm-up of Squat/ }).last().click(); // a working set again
  await expect(page.getByLabel('Set 1 weight in kg')).toHaveValue('60');
  await expect(page.getByLabel('Set 1 reps')).toHaveValue('5');
});

test('switches the unit of every set of an exercise', async ({ page }) => {
  await startWorkout(page);
  await addExercise(page, 'Leg press');
  await page.getByLabel('Set 1 weight in kg').fill('100');
  await page.getByRole('button', { name: 'Add set to Leg press' }).click();
  await page.getByRole('button', { name: 'Weights in kg. Switch to lb' }).first().click(); // the unit in set 1's weight box
  await expect(page.getByLabel('Set 1 weight in lb')).toHaveValue('100');
  await expect(page.getByLabel('Set 2 weight in lb')).toHaveValue('100');
});

test('shows the date, a timer and the start time, with no name to type', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 10, 26, 18, 5) });
  await startWorkout(page);
  await expect(page.getByLabel('Workout name')).toHaveCount(0);
  const title = page.getByRole('heading', { level: 2 }).first();
  const [date, timer, time] = await title.locator('span').all();
  await expect(date).toHaveText('Thu, Nov 26'); // en-US, the test browsers' language
  await expect(time).toHaveText('6:05 PM');
  await expect(timer).toHaveText('0 mins');
  const x = async (l: typeof date) => (await l.boundingBox())!.x;
  expect(await x(date)).toBeLessThan(await x(timer));
  expect(await x(timer)).toBeLessThan(await x(time));

  await page.clock.runFor(21 * 60_000);
  await expect(timer).toHaveText('21 mins');

  await addExercise(page, 'Squat');
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await page.getByRole('link', { name: /Nov 26/ }).click();
  await expect(page.getByLabel('Time since the start')).toHaveCount(0);
});

test('keeps an exercise note, shown as grey "Add note" while empty', async ({ page }) => {
  await startWorkout(page);
  await addExercise(page, 'Squat');
  const note = page.getByLabel('Note for Squat');
  await expect(note).toHaveAttribute('placeholder', 'Add note');
  await note.fill('Belt from set 3');
  await note.blur();
  await page.reload();
  await expect(page.getByLabel('Note for Squat')).toHaveValue('Belt from set 3');
});

test('deletes an exercise with its bin, and undo brings it back', async ({ page }) => {
  await startWorkout(page);
  await addExercise(page, 'Squat');
  await addExercise(page, 'Deadlift');
  await page.getByRole('button', { name: 'Delete Squat' }).click();
  await expect(exercise(page, 'Squat')).toBeHidden();
  await expect(exercise(page, 'Deadlift')).toBeVisible();

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(exercise(page, 'Squat')).toBeVisible();
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(exercise(page, 'Squat')).toBeHidden();
});

test('undoes a typed weight in one step, and every other change one at a time', async ({ page }) => {
  await startWorkout(page);
  await addExercise(page, 'Bench press');
  const weight = page.getByLabel('Set 1 weight in kg');
  await weight.pressSequentially('100');
  await weight.blur();
  await page.getByRole('button', { name: 'Set 1 done' }).click();

  const undo = page.getByRole('button', { name: 'Undo' });
  await undo.click();
  await expect(page.getByRole('button', { name: 'Set 1 done' })).toHaveAttribute('aria-pressed', 'false');
  await expect(weight).toHaveValue('100');
  await undo.click();
  await expect(weight).toHaveValue('');
  await undo.click(); // the exercise itself
  await expect(exercise(page, 'Bench press')).toBeHidden();
  await expect(undo).toBeDisabled();
});

test('keeps every card while notes are typed into a later one', async ({ page }) => {
  await startWorkout(page);
  await addExercise(page, 'Bench press');
  await addExercise(page, 'Lat pulldown');
  await page.getByLabel('Note for Lat pulldown').pressSequentially('Wide grip');
  await page.getByLabel('Note for Lat pulldown').blur();
  await expect(exercise(page, 'Bench press')).toBeVisible();
  await expect(exercise(page, 'Lat pulldown')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Exercise name')).toHaveCount(2);
});

test('drops a name not yet saved when undo is pressed', async ({ page }) => {
  await startWorkout(page);
  await addExercise(page, 'Squat');
  await page.getByLabel('Set 1 reps').fill('5');
  await page.getByLabel('Set 1 reps').blur();
  await page.getByLabel('Exercise name').fill('Front squat');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByLabel('Exercise name')).toHaveValue('Squat');
  await expect(page.getByLabel('Set 1 reps')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Redo' })).toBeEnabled();
});

test('renames an exercise when the field is left', async ({ page }) => {
  await startWorkout(page);
  await addExercise(page, 'Sqat');
  const name = page.getByLabel('Exercise name');
  await name.fill('Back squat');
  await name.press('Enter');
  await expect(exercise(page, 'Back squat')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Exercise name')).toHaveValue('Back squat');

  // A blank name puts the old one back
  await page.getByLabel('Exercise name').fill('');
  await page.getByLabel('Exercise name').blur();
  await expect(page.getByLabel('Exercise name')).toHaveValue('Back squat');
});

test('finishes into the list, which shows the workout', async ({ page }) => {
  await startWorkout(page);
  await addExercise(page, 'Squat');
  await page.getByRole('button', { name: 'Finish workout' }).click();
  const row = page.getByRole('list', { name: 'Workouts' }).getByRole('link');
  await expect(row).toContainText('Squat');
  await expect(row).not.toContainText('in progress');

  // Finished: the app opens on the list, not in the workout
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'New workout' })).toBeVisible();
});

test('opens back into a workout that is going', async ({ page }) => {
  await startWorkout(page);
  await addExercise(page, 'Squat');
  const url = page.url();
  await page.goto('/');
  await expect(page).toHaveURL(url);
  await expect(exercise(page, 'Squat')).toBeVisible();
});

test('drops a workout left with nothing in it', async ({ page }) => {
  await startWorkout(page);
  await page.goBack(); // the browser's back, as there is no back link
  await expect(page.getByText('No workouts yet.')).toBeVisible();
});

test('fits a set row on a 360 px wide phone', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await startWorkout(page);
  await addExercise(page, 'Bench press');
  const row = page.getByRole('list', { name: 'Sets of Bench press' }).getByRole('listitem');
  const tick = await page.getByRole('button', { name: 'Set 1 done' }).boundingBox();
  const box = await row.boundingBox();
  expect(tick!.x + tick!.width).toBeLessThanOrEqual(box!.x + box!.width);
  expect(box!.x + box!.width).toBeLessThanOrEqual(360);
  for (const name of ['Set 1 weight in kg', 'Set 1 reps']) {
    await expect(page.getByLabel(name)).toBeInViewport();
  }
});

test.describe('on an iPhone', () => {
  test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });

  test('stops Safari zooming into the small fields', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('meta[name=viewport]')).toHaveAttribute('content', /maximum-scale=1/);
  });
});

test('leaves pinch zoom alone elsewhere', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('meta[name=viewport]')).not.toHaveAttribute('content', /maximum-scale/);
});
