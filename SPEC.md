# Simple Gains spec

A simple local-first log for weight training.

## Overview

### Design choices

- Static web app in TypeScript made with Svelte 5 and Vite
- PWA with a service worker - works offline in a gym with no signal and installs on a phone
- All data in IndexedDB through Dexie - the app needs no server to work and has no accounts
- Every edit writes to IndexedDB straight away - there is no save button
- CSV with one row per set is the only import and export format - it is the contract with
  other tools
- Exercise names are free text. Each name points to a canonical exercise through an alias so
  history groups one lift under any name
- Built-in exercises ship in the code and custom exercises live in IndexedDB - a new app version
  can add or fix built-in exercises without a database upgrade
- Order is a fractional index string on each row - a move writes one row
- Drag and drop is custom code adapted from the task list app [Dumb Tasks](https://github.com/echus/dumb-tasks)
- Runs in the latest Chrome, Edge, Firefox and Safari on phones and computers
- Sync is optional - JSON files in the user's Google Drive or WebDAV server (see Plans)

### File structure

```
index.html                  page shell
src/
  main.ts                   starts the app
  App.svelte                routes between the screens
  app.css                   global styles and theme colours
  screens/
    WorkoutList.svelte      workouts by date, new and repeat, menu with export and import
    Workout.svelte          one workout - logging and editing a past one use this screen
    ExerciseHistory.svelte  every session of one exercise and its chart
    Import.svelte           CSV review and summary
  components/
    ExerciseCard.svelte     one exercise in a workout with its set rows and last time
    SetRow.svelte           set number, weight, reps and done
    ExercisePicker.svelte   type-ahead to add or change an exercise
    HistoryButtons.svelte   undo and redo in the header
    Chart.svelte            SVG line chart
    TextField.svelte        text field that writes on every key press
  lib/                      everything that is not a component, imported as $lib
    types.ts                data model
    db.ts                   IndexedDB tables
    settings.ts             default unit
    startup.ts              persistent storage request
    workouts/               workout, item and set operations, undo, order, dates, repeat, last time, history
    exercises/              built-in list, normalising, matching, aliases
    csv/                    columns, export, parse, import plan, commit
    ui/                     drag and drop, swipe, routes, live queries, database status
scripts/
  build-exercise-list.ts    writes the built-in list from free-exercise-db and exercise-picks.ts
  exercise-picks.ts         the picked exercises with their ids and hand-added attributes
public/                     icons
tests/                      same layout as src/
  lib/ components/          unit tests (npm test)
  browser/                  Playwright tests of the production build by mouse and touch
vite.config.ts              build, PWA and test projects
wrangler.jsonc              Cloudflare deploy
```

### Data flow

A set edit:

```
user changes weight, reps or done on a set row
  |
  v
workouts/sets.ts        writes the set to IndexedDB
  |
  v
Workout.svelte          live query sees the change and redraws the card
```

Adding an exercise:

```
user types a name in the picker
  |
  v
exercises/match.ts      alias lookup and then fuzzy candidates on each key press
  |
  v
ExercisePicker.svelte   user taps a candidate or "Create"
  |
  v
exercises/aliases.ts    saves the typed name as an alias of the pick
  |
  v
workouts/items.ts       adds the exercise to the workout with its first set
```

A CSV import:

```
CSV file
  |
  v
csv/parse.ts            Papa Parse reads the rows and groups them into workouts
  |
  v
csv/plan.ts             runs each unique name through the matcher and finds duplicates
  |
  v
Import.svelte           review of the names that need a pick and then the summary
  |
  v
csv/commit.ts           writes aliases, custom exercises, workouts, items and sets
                        in one transaction
```

## Data

```
src/lib/types.ts               data model
src/lib/db.ts                  Dexie tables and opening with retries
src/lib/startup.ts             persistent storage request
src/lib/ui/live.ts             Dexie live queries for the screens
src/lib/ui/status.svelte.ts    whether the database can be used
```

### Model

```
Exercise     { id, displayName, movement, equipment, grip, angle, primaryMuscles[], assisted, isCustom }
Alias        { name, exerciseId }
Workout      { id, date, time, name, notes, finishedAt, createdAt, updatedAt }
WorkoutItem  { id, workoutId, exerciseId, nameAsTyped, position, notes }
Set          { id, itemId, position, weight, unit, reps, isWarmup, done }
```

`Set` is `WorkoutSet` in the code - JavaScript has its own `Set`.

| Table | Indexes | Note |
| --- | --- | --- |
| `exercises` | `id` | Custom exercises only - built-in ones are in `built-in.json` |
| `aliases` | `name, exerciseId` | `name` is the normalised key and is unique |
| `workouts` | `id, date` | |
| `items` | `id, workoutId, exerciseId` | One exercise in one workout |
| `sets` | `id, itemId` | |
| `settings` | `key` | Default unit and later the AI toggle |

### Fields

| Field | Note |
| --- | --- |
| Row ids | ULID |
| `Exercise.id` | Built-in - readable snake case such as `barbell_bench_press` that never changes. Custom - `custom_` and the first typed name in snake case, e.g. `custom_cable_y_raise`. A number is added if that id is taken |
| `Workout.date` | `YYYY-MM-DD` in local time |
| `Workout.time` | `HH:MM` or null - imported workouts can have no time |
| `Workout.finishedAt` | Set by Finish. Only decides which workout the app opens into |
| `position` | Fractional index (fractional-indexing) within the workout or the item |
| `Set.weight` | As typed in `unit`. Per hand for dumbbells. 0 or the added load for bodyweight. Negative for assistance. Null until typed |
| `Set.reps` | Null until typed |
| `Set.unit` | `kg` or `lb` on each set - one gym can have both |
| `Set.done` | False until ticked. Imported sets are done unless the file says otherwise |

### Storage

- Persistent storage is requested on first run - the browser can clear the data otherwise
- A database that fails to open or gives no answer in 10 seconds shows a message in place of
  the list - an empty list would look like lost workouts

## Screens

```
src/App.svelte                shows the screen for the address
src/lib/ui/routes.svelte.ts   hash routes
```

Hash routes keep the system back button inside the installed app.

| Address | Screen |
| --- | --- |
| `#/` | Workout list |
| `#/w/<id>` | A workout |
| `#/e/<exerciseId>` | History of one exercise |
| `#/import` | Import review |

- The app opens into a workout that is not finished and was started in the last 6 hours -
  opening the phone mid-session goes straight back to it
- Otherwise it opens on the workout list

## Logging a workout

```
src/screens/Workout.svelte           the workout screen
src/components/ExerciseCard.svelte   one exercise with its name, note, sets, last time and delete
src/lib/workouts/colours.ts          tick colour for each exercise
src/components/SetRow.svelte         one set
src/lib/workouts/workouts.ts         new, repeat, finish
src/lib/workouts/items.ts            add, change, move and delete an exercise
src/lib/workouts/sets.ts             add, edit, move and delete a set, typed numbers
src/lib/workouts/order.ts            fractional index order
```

### Starting

- New - a blank workout with today's date and the current time
- A workout has no name to type - its date and time say which one it is. `Workout.name` stays for
  CSV files that have one
- The top of the workout shows the day and date on the left and the start time on the right, in
  the browser's own time format (6:05 pm or 18:05). Smaller than the "simple gains" text mark
- A timer in the middle shows the time since the start in whole minutes, e.g. "1 min" or
  "1 hr 5 mins". It shows until the workout is finished
- Workout note - a text field under the date, always there. It shows "Add a workout note" in grey
  while empty
- No back link - the "simple gains" text mark and the browser's back both go to the list
- Repeat - from any earlier workout in the list. Copies the name, the exercises with their
  typed names and notes and the sets with weight, unit, reps and warm-up
- Repeated sets start not done. Workout notes are not copied - they are about that day
- A workout left with no exercise or note is deleted - stray taps on New do not fill the list

### Set row

| Part | Tap | Other |
| --- | --- | --- |
| Handle | | Drag (see Gestures) |
| Set label | Toggles warm-up | Spelled out - "Warm up", then "Set 1", "Set 2" for working sets without the warm-ups. "Warm up" is smaller (11px) so it takes about the room of "Set 1" |
| Weight | Decimal keypad (`inputmode="decimal"`) | |
| Reps | Number keypad (`inputmode="numeric"`) | |
| ✓ (column "done?") | Toggles done | The tick pops in, filled with the exercise's colour |

- The row fits a 360 px wide screen
- Each field holds only its number, centred. Its unit ("kg", "reps") sits just outside it, to
  the right
- A done set shows its weight and reps as text in place of the fields, laid out the same so
  nothing moves. A double-click or double tap makes them fields again - Enter
  or leaving the row puts the text back. The set stays done throughout
- Only the "simple gains" text mark is lower case, as in Dumb Tasks. Everything else is in
  normal case
- Text is 14px across the app. Only the "simple gains" text mark and the workout's date and
  time are larger. A done set's numbers are not bold
- No column headings - the units in the fields say what each one is
- The fields have a faint grey fill, so a card full of them stays quiet
- Each exercise has its own tick colour from the fluoro range of the Dumb Tasks icon circles -
  the same in every workout, moved along when it is too close to the card above
- The unit beside a weight field ("kg", dotted) is a switch. A tap switches every set of the
  exercise between kg and lb - the numbers stay as typed
- Built-in exercises marked `assisted` label the weight field "assist" and store the typed number
  as negative - the iOS decimal keypad has no minus key
- Every change writes on input - leaving the app mid-edit loses nothing

### Adding sets and exercises

- The + in a circle at the top right of the card adds a set. It copies the last set's weight,
  unit, reps and warm-up and starts not done
- A new exercise gets one set copied from the first working set of last time - a blank set
  when there is no last time
- The exercise name at the top of the card is a field. A new name saves on Enter or when the
  field is left and changes the exercise for that item only - past workouts keep theirs. A blank
  name puts the old one back. From build step 3 a new name goes through the picker
- Exercise note - a text field under the card's name, always there. It shows "Add note" in grey
  while empty. Typed text is in ink
- A small bin at the bottom right of the card deletes the exercise and its sets. No confirm -
  undo brings it back
- The caret at the top right folds a card down to its name and a count such as "2/3 done". The
  fold lasts while the workout is open
- Finish sets `finishedAt` and goes to the list

### Last time

The hint under each card shows the latest earlier workout with the same `exerciseId` - the name
typed there does not matter.

- Counts done working sets - warm-ups and sets never ticked are left out
- Shows each set in its own unit

| Sets last time | Hint |
| --- | --- |
| 60×8, 60×8, 60×8 | Last time: 3×8 @ 60 kg |
| 60×8, 60×8, 60×6 | Last time: 60 kg × 8, 8, 6 |
| 60×8, 62.5×6, 62.5×5 | Last time: 60×8, 62.5×6, 62.5×5 kg |
| −20×8, −20×8 | Last time: 2×8 @ −20 kg |
| None | No hint |

### Gestures

| Gesture | On | Does |
| --- | --- | --- |
| Press and move on the handle | Set row, card header | Drag - picks up at once with no hold |
| Swipe left | Set row | Delete - undo brings it back |
| Tap | Fields, ✓, set number | Edit, done, warm-up |
| Mouse | × on a set row on hover (windows 420px and wider), bin on a card | Delete |

- Long press is not used - it would clash with text selection in the number fields and with
  the browser's own menus
- The handle has `touch-action: none` so a finger on it drags and does not scroll
- A swipe that starts within 20 px of either screen edge is ignored - the edges belong to the
  browser's back and forward gestures
- A move of more than 10 px that is more sideways than up or down becomes a swipe. Anything
  else scrolls the page
- Released past 40% of the row width - deletes. Less - the row snaps back

### Undo and redo

```
src/lib/workouts/undo.svelte.ts      the steps and writing them back
src/components/HistoryButtons.svelte undo and redo in the header, as in Dumb Tasks
```

- Every change to the open workout is a step - edits, ticks, adds, deletes and moves
- A step reads the whole workout before and after the change. Undo and redo write back only the
  fields that changed - a change made since to another field stays
- The key presses of one visit to a field are one step
- Deletes come back with the same ids and positions. No confirm dialog anywhere
- The history covers the workout on screen and is cleared on leaving it
- ⌘Z and ⇧⌘Z (Ctrl+Z and Ctrl+Y) outside text fields - inside one the browser's own text undo
  applies
- Up to 100 steps

## Drag and drop

```
src/lib/ui/drag-and-drop.ts   sortable action, press to drop
src/lib/ui/drag-layout.ts     where the row lands and the rows parting
src/lib/ui/drag-preview.ts    the copy under the pointer
src/lib/ui/drag-scroll.ts     scrolling near the top and bottom of the screen
```

Custom code for mouse and touch - the browser's drag and drop is unreliable on touch and cannot
show the rows parting.

- One Svelte action `sortable` for any list - the exercise list and the set list in each
  card use the same code
- Each list is its own `ul` and a row moves only within its own list
- A set cannot move to another exercise - deleting it and adding it there is quicker than
  aiming at another card
- Rows are only the direct `li` children of a list - a card's set list does not count as rows
  of the exercise list
- A drop calls back with the moved id and the id it lands before. The caller writes the new
  position

### Changes from the Dumb Tasks code

The drag files start as copies of [`src/lib/ui/drag-*.ts`](https://github.com/echus/dumb-tasks/tree/main/src/lib/ui) in Dumb Tasks.

| Dumb Tasks | Simple Gains |
| --- | --- |
| Long press anywhere on the row picks up | Press on the handle picks up at once |
| Tasks, buckets and tabs in the code | Any list given to the action |
| Moves between lists and onto tabs | No moves between lists |
| One row height | Exercise drag collapses the cards first |

### Dragging an exercise

A card with many sets can be taller than the screen. So an exercise drag goes like this:

```
press on the card's handle
  |
  v
every card collapses to its header
  |
  v
row heights are measured on the collapsed cards
  |
  v
drag as in any list
  |
  v
drop - the cards expand again
```

## Exercise naming

```
src/lib/exercises/built-in.json       built-in exercises
src/lib/exercises/normalise.ts        name to alias key
src/lib/exercises/match.ts            alias lookup and fuzzy scores
src/lib/exercises/aliases.ts          saves aliases and custom exercises
scripts/build-exercise-list.ts        writes built-in.json
scripts/exercise-picks.ts             picked exercises, ids, hand-added attributes, aliases
tests/lib/exercises/name-examples.ts  typed names with the exercise they must match
```

### Built-in exercises

The exercises that ship with the app. Any other exercise is a custom one that the user creates
from the picker.


- About 100 common lifts picked from free-exercise-db (Unlicense - no attribution required)
- From the dataset: `equipment` and `primaryMuscles`
- Hand-added in `exercise-picks.ts`: id, display name, `movement`, `grip`, `angle`, `assisted`
  and built-in aliases - the dataset has none of these
- `movement` is one of squat, hinge, lunge, horizontal push, vertical push, horizontal pull,
  vertical pull, carry, isolation or core
- Built-in ids are kept forever and never removed - exported CSV files hold them
- Built-in aliases cover only names with one clear meaning, e.g. "RDL" or "OHP"
- Names that mean different lifts in different gyms get no built-in alias, e.g. "French press" -
  the user picks once and the alias is saved

### Normalising

`normalise` turns a name into an alias key. The steps run in this order.

| Step | Example |
| --- | --- |
| Lower case and single spaces | "  Bench  Press" → "bench press" |
| Punctuation and hyphens to spaces | "T-bar row" → "t bar row" |
| Equipment shorthand expanded | "DB curl" → "dumbbell curl", "BB" → "barbell", "KB" → "kettlebell" |
| Plurals to singular | "curls" → "curl". Words that end in "ss" keep it - "press" |
| Filler words dropped | "row with dumbbells" → "row dumbbell" |

Lift names such as "RDL" are aliases and not shorthand - they stay out of `normalise`.

### Matching

Matching runs only for a name with no alias.

```
typed name
  |
  v
normalise               alias key
  |
  v
alias lookup            exact match - the exercise is first in the picker and Enter adds it
  |
  v
fuzzy score             against every alias and display name, best score for each exercise
  |
  v
picker list             top 8 candidates and "Create '<typed name>'" at the end
```

Fuzzy score:

- Two words of 5 letters or more match when they are one slip apart - a letter missing, a letter
  added or two letters swapped
- A changed letter is not a slip - "abduction" is not "adduction" and "pushdown" is not
  "pulldown"
- The last typed word also matches as a prefix - "bench pr" finds bench press while typing
- Score = 2 × matched words / (typed words + candidate words) - word order does not count

Starting thresholds, tuned against `name-examples.ts`:

| Score | Picker | Import |
| --- | --- | --- |
| 0.85 or more and 0.15 ahead of the next exercise | First and highlighted | Matched with no review |
| 0.5 to 0.85 | Listed | Review with the best one picked |
| Below 0.5 | Listed only if nothing scores higher | Review with nothing picked |

- `name-examples.ts` pairs typed names with the right exercise id or "ask"
- No example may match the wrong exercise with no review - those sets would go under the wrong
  lift unseen
- The right exercise must be in the top 3 for at least 95% of the examples
- Names one changed letter apart are in the examples, e.g. hip abduction and hip adduction
- Wrong match found in use - add the name to `name-examples.ts`

### Aliases

- Picking a candidate or creating an exercise saves the typed name's key as an alias - next
  time it is an exact match
- One alias points to one exercise. A later pick of another exercise for the same name moves
  the alias. Past workouts keep their `exerciseId`
- `WorkoutItem.nameAsTyped` keeps the name as typed - the card, the history and the export show
  it
- A created exercise has only a name - its attributes stay empty

## History

```
src/screens/WorkoutList.svelte       workouts newest first
src/screens/ExerciseHistory.svelte   sessions of one exercise and the chart
src/components/Chart.svelte          SVG line chart
src/lib/workouts/history.ts          sessions of one exercise, best set and e1RM
```

- Workout list - newest first with the date, name and exercise names of each
- A past workout opens in the same screen as logging - editing it works the same
- Exercise history opens from the exercise card. It lists every workout with that
  `exerciseId` newest first with the date, typed name and sets of each
- Warm-ups and sets never ticked show in grey

### Chart

- One line over time - best set weight or estimated 1RM, switched by a toggle above it
- Custom SVG - one line chart does not need a library
- Counts done working sets only
- Estimated 1RM by Epley - weight × (1 + reps / 30). A set of 1 rep counts as its weight
- Sets in lb are converted to the default unit (1 lb = 0.45359237 kg)
- Assisted exercises show best set only - less assistance shows as a rising line and 1RM means
  nothing for a negative weight
- Fewer than 2 sessions - no chart

## CSV

```
src/lib/csv/columns.ts   column names, defaults and checks
src/lib/csv/export.ts    all workouts to one file
src/lib/csv/parse.ts     Papa Parse and grouping into workouts
src/lib/csv/plan.ts      matching and duplicates before anything is written
src/lib/csv/commit.ts    writes the import in one transaction
src/screens/Import.svelte   review and summary
```

### Columns

One row per set.

```csv
date,workout,exercise,canonical_id,set,weight,unit,reps,is_warmup,notes,done,workout_notes
2026-11-20T18:05,Upper A,Bench press,barbell_bench_press,1,60,kg,8,false,,true,Felt strong
2026-11-20T18:05,Upper A,Bench press,barbell_bench_press,2,60,kg,8,false,,true,
2026-11-20T18:05,Upper A,Lat pulldown,lat_pulldown,1,45,kg,10,false,wide grip,true,
```

| Column | Required | Default | Note |
| --- | --- | --- | --- |
| `date` | Yes | | `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM` |
| `workout` | No | Blank | Workout name |
| `exercise` | Yes | | Name as written |
| `canonical_id` | No | Matched by name | Exercise id |
| `set` | No | Row order in the exercise | Order of the set with warm-ups included |
| `weight` | Yes | | Per hand for dumbbells. Negative for assistance |
| `unit` | No | `kg` | `kg` or `lb` |
| `reps` | Yes | | |
| `is_warmup` | No | `false` | `true` or `false` |
| `notes` | No | Blank | Exercise note |
| `done` | No | `true` | Added - a set never ticked |
| `workout_notes` | No | Blank | Added - workout note |

### Grouping

| Rows | Become |
| --- | --- |
| Same `date` (with its time) and `workout` | One workout |
| Same `exercise` in one workout | One item, in order of first row |
| A `set` that does not rise for that exercise | A new item - the exercise was added twice |
| Sets of one item | Ordered by `set` - by row order when `set` is blank |
| `notes` on several rows of an item | Joined in row order with repeats dropped |
| `workout_notes` on several rows of a workout | Joined the same way |

Two workouts with the same name started in the same minute come back as one. This is the only
loss in a round trip.

### Export

- One tap in the list menu exports every workout - `simple-gains-<date>.csv`
- UTF-8 with a header row and comma separators
- Rows in order of date, item position and set position
- `canonical_id` and `set` are always written. `notes` and `workout_notes` go on the first row
  of their item and workout only
- The Web Share API with the file where the browser has it - a download in an installed iOS app
  is unreliable. A plain download elsewhere

### Import

- Papa Parse detects a comma or semicolon separator. A decimal comma is accepted in numbers
- Column names are matched without case. Unknown columns are ignored
- Imported workouts count as finished - the app never opens into one

| Problem | Result |
| --- | --- |
| A required column is missing | File refused and the message names the column |
| Bad date, weight or reps | Row skipped and listed in the summary with its line number |
| Unit other than kg or lb | Row skipped and listed |
| `canonical_id` of a built-in or custom exercise on this device | Used. The name's alias points to it and the last row in the file wins |
| `canonical_id` starting `custom_` that this device does not have | Custom exercise created with that id and the row's name |
| Any other unknown `canonical_id` | Ignored and the name is matched |

### Review

- Lists only the names that need a pick (see Matching) with the row count of each
- One tap on a name opens the picker. Its best candidate is picked already when there is one
- Summary before the import - "42 sets across 6 workouts" and the counts of skipped duplicates
  and rows with errors
- Nothing is written before Import. A failure part way writes nothing

### Duplicates

- A workout in the file joins an existing workout with the same date, name and time - time
  counts only when both have one
- Its sets that already exist are skipped - same `exerciseId` and same set number
- Its other sets are added to the existing workout
- So the same file imported twice adds nothing the second time

## Browsers

```
src/lib/startup.ts      persistent storage request
src/lib/csv/export.ts   Web Share or download
```

The latest Chrome, Edge, Firefox and Safari on phones and computers.

| Browser | Install |
| --- | --- |
| Chrome and Edge on a computer | Install button in the address bar |
| Chrome and Edge on Android | Install prompt |
| Firefox on Android | Add to Home screen |
| Firefox on a computer | None - runs in a tab |
| Safari on a Mac | File > Add to Dock |
| Any browser on iPhone and iPad | Add to Home Screen from the share sheet |

- Every feature works in a normal tab - install is never required
- Every browser on iPhone and iPad is WebKit - Chrome, Edge and Firefox there behave as Safari
- iOS clears site data after 7 days without a visit unless the app is on the home screen
- Touch and mouse both work in every browser - a laptop with a touch screen gets swipe and
  drag by finger
- A computer screen shows one centred column - the app is a list and wider rows would not help
- Keyboard - Tab moves through weight and reps in row order. Enter in the picker adds the
  highlighted exercise

Features that some browsers lack are detected and have a fallback.

| Feature | Missing in | Fallback |
| --- | --- | --- |
| Web Share with a file | Firefox on a computer and some others | Download |
| Vibration on drag pickup | Safari | None |
| `inputmode` keypads | Computers | Plain text field that accepts numbers |
| No zoom into a field under 16px | Safari on iPhone and iPad zooms in | `maximum-scale=1` on iOS only - iOS still allows pinch zoom, Android would not |

## PWA and hosting

```
vite.config.ts       manifest and service worker (vite-plugin-pwa)
src/lib/startup.ts   persistent storage
wrangler.jsonc       Cloudflare Workers with static assets
```

- The service worker caches the whole app - it works with no network after the first visit
- A new version waits and takes over the next time the app opens - a reload mid-set would close
  the keypad
- Static assets only. The Worker is attached to one host and other hosts redirect to it

## Tests

```
tests/lib/       Vitest with fake-indexeddb
tests/browser/   Playwright on the production build
```

- Browser tests run in Chromium, Firefox and WebKit - Chromium covers Chrome and Edge
- Each engine runs at a phone size with touch and at a computer size with a mouse
- Touch drag and swipe are also checked by hand on a real iPhone and Android phone - emulated
  touch misses scrolling and the screen edge gestures

| Test | Checks |
| --- | --- |
| `name-examples.ts` | Matching thresholds (see Matching) |
| CSV round trip | Export and import into an empty database gives the same rows. Import again adds nothing |
| CSV samples | A file with only the required columns and a converted 1FIT file import |
| Last time | Each case in the Last time table |
| Browser drag | Exercises and sets by mouse and by touch on a 360 px wide phone screen |
| Browser swipe | Delete and undo. Swipes from a screen edge are ignored |
| Browser offline | The app loads and saves with the network off |

## Plans

### Build order

1. Data model, IndexedDB and the workout screen with exercises by name only and sets
2. Swipe to delete, drag to reorder, last time
3. Built-in exercise list, normalising, matching and aliases
4. CSV export and import with the review - import needs the matcher
5. Workout list, exercise history and the chart
6. PWA install and a couple of weeks of use in real sessions

### AI name matching

- An extra step between the fuzzy score and the picker list, behind a setting that is off by
  default
- A small Worker in the same deploy holds the API key - the key never reaches the page
- Sends the typed name and the top candidates with their ids and display names - nothing else
  from the log
- Returns the best id with a confidence. A name with two meanings gets one question in its place,
  e.g. "French press: lying or overhead?"
- The user confirms once and the alias is saved - that name never goes to the AI again
- The app works the same offline and with the setting off

### Sync

```
src/lib/sync/engine.ts        pull, merge, push
src/lib/sync/merge.ts         merge for each field
src/lib/sync/data-file.ts     the sync and backup file
src/lib/sync/drive.ts         Google Drive backend
src/lib/sync/google-auth.ts   Google sign-in
src/lib/sync/webdav.ts        WebDAV backend
worker/index.ts               sign-in Worker
```

Optional sync with the same design as the [sync in Dumb Tasks](https://github.com/echus/dumb-tasks/blob/main/SPEC.md#sync).

- One JSON file for each device in the user's Google Drive or WebDAV server - a device writes
  only its own file and merges in the files of the others
- The file holds every table except `settings` - CSV cannot carry aliases or deletes
- Last write wins for each field. Rows get a time for each field and a `deletedAt` tombstone -
  deletes stop being hard deletes
- Tombstones are removed after 90 days
- Two devices that move rows to the same spot get equal positions. The next move spaces them
  out
- The same custom exercise made on two devices gets the same `custom_<slug>` id and becomes
  one exercise
- An alias changed on two devices - the later change wins

| | Google Drive | WebDAV |
| --- | --- | --- |
| Files are in | Hidden app folder (`drive.appdata`) | `simple-gains` folder on the server |
| Sign-in | Google popup and the sign-in Worker | Basic auth from the browser |
| Server setup | None | CORS for the app's origin |

- The sign-in Worker keeps the Google refresh token in an HttpOnly cookie. Workouts never pass
  through it
- No proxy for WebDAV - it would see passwords and workouts
- The AI Worker and the sign-in Worker are one Worker

### Later

- Merge one exercise into another, for a custom exercise made by mistake for a built-in lift
- Rename a custom exercise
- Import from screenshots of another tracker such as 1FIT - an AI model reads the image into
  CSV rows and they go through the same review as a CSV import. Behind the AI setting

### Non-goals

- Accounts in the app - sync uses the user's own Google Drive or WebDAV server
- Sharing or social features
- Programs and progression schemes
- Rest timers, plate calculators, body measurements, nutrition and wearables
- A native app
