export const UNITS = ['kg', 'lb'] as const;
export type Unit = (typeof UNITS)[number];

export const MOVEMENTS = [
  'squat',
  'hinge',
  'lunge',
  'horizontal push',
  'vertical push',
  'horizontal pull',
  'vertical pull',
  'carry',
  'isolation',
  'core',
] as const;
export type Movement = (typeof MOVEMENTS)[number];

/** A lift. Built-in ones ship in the code; only custom ones are stored. */
export interface Exercise {
  id: string; // built-in: snake case such as barbell_bench_press. Custom: custom_<snake name>
  displayName: string;
  movement: Movement | null;
  equipment: string | null;
  grip: string | null;
  angle: string | null;
  primaryMuscles: string[];
  assisted: boolean; // the weight is assistance, stored as a negative number
  isCustom: boolean;
}

/** A typed name that points to an exercise. */
export interface Alias {
  name: string; // the normalised name, unique
  exerciseId: string;
}

export interface Workout {
  id: string; // ULID
  date: string; // YYYY-MM-DD in local time
  time: string | null; // HH:MM. Imported workouts can have none
  name: string;
  notes: string;
  finishedAt: string | null; // ISO timestamps throughout
  createdAt: string;
  updatedAt: string;
}

/** One exercise in one workout. */
export interface WorkoutItem {
  id: string; // ULID
  workoutId: string;
  exerciseId: string;
  nameAsTyped: string;
  position: string; // fractional index within the workout
  notes: string;
}

/** `Set` in the spec. Named apart from JavaScript's own Set. */
export interface WorkoutSet {
  id: string; // ULID
  itemId: string;
  position: string; // fractional index within the item
  weight: number | null; // as typed in `unit`. Per hand for dumbbells. Negative for assistance. Null until typed
  unit: Unit;
  reps: number | null; // null until typed
  isWarmup: boolean;
  done: boolean;
}

export interface Setting {
  key: string;
  value: string;
}
