import type { Ecosystem } from './ecosystem';
import { NO_FAUNA, type Params, type Setup } from './params';

export interface Experiment {
  id: string;
  letter: string;
  title: string;
  summary: string;
  hypotheses: string[];
  measures: string[];
  /** Overrides applied to the initial conditions on start. */
  setup?: Partial<Setup>;
  params?: Partial<Params>;
  /** If true the experiment acts on the current run instead of restarting it. */
  inPlace?: boolean;
  onStart?: (sim: Ecosystem) => void;
}

export const EXPERIMENTS: Experiment[] = [
  {
    id: 'balanced', letter: 'A', title: 'Balanced ecosystem',
    summary: 'The full forest: deer, elk, moose, boar, hares and squirrels, hunted by wolf packs, cougars, lynx, foxes, eagles and bears, with ravens on every carcass. Does the web hold together?',
    hypotheses: ['Deer and wolves persist together for many years.', 'Wolf numbers lag behind deer numbers, producing offset oscillations.', 'Most of the other species persist too; specialists (lynx) are the most fragile.'],
    measures: ['Days both species coexist', 'Range of deer and wolf numbers', 'Lowest vegetation level'],
    setup: { initialDeer: 300, initialWolves: 24 },
    params: {},
  },
  {
    id: 'noWolves', letter: 'B', title: 'Remove all wolves',
    summary: 'Every wolf is removed from the current ecosystem at once. Without predation, deer are limited only by food, water and age.',
    hypotheses: ['Deer and elk increase until food runs short.', 'Grazing pressure depletes the meadows.', 'Cougars and bears take a larger share of the deer, but cannot replace the wolves.'],
    measures: ['Peak deer population', 'Lowest vegetation level', 'Deer starvation deaths'],
    inPlace: true,
    onStart: (sim) => sim.remove('wolf', 'all'),
  },
  {
    id: 'reintroduce', letter: 'C', title: 'Predator reintroduction',
    summary: 'A landscape with deer but no wolves. Let the herd grow, then reintroduce wolves with the population buttons and watch the response.',
    hypotheses: ['Deer numbers grow while wolves are absent.', 'Reintroduced wolves find abundant prey and breed.', 'Vegetation recovers once deer numbers fall.'],
    measures: ['Deer peak before reintroduction', 'Wolf growth after reintroduction', 'Vegetation recovery'],
    setup: { initialDeer: 400, initialWolves: 0 },
    params: {},
  },
  {
    id: 'drought', letter: 'D', title: 'Drought',
    summary: 'Rainfall drops and the streams shrink. Plants grow only near the remaining water and deer must travel further to drink.',
    hypotheses: ['Vegetation declines away from water.', 'Deer concentrate near water and lose condition.', 'Wolves decline after the deer do.'],
    measures: ['Lowest vegetation level', 'Deer dehydration and starvation deaths', 'Time lag between deer and wolf declines'],
    setup: { initialDeer: 300, initialWolves: 24 },
    params: { drought: 0.75, water: 0.35 },
  },
  {
    id: 'explosion', letter: 'E', title: 'Deer population explosion',
    summary: 'A very large deer herd and only a handful of wolves. Food competition and the landscape’s carrying capacity take over.',
    hypotheses: ['Deer quickly overgraze the meadows.', 'Average deer energy falls and starvation rises.', 'Deer numbers fall back toward what the plants can support.'],
    measures: ['Days until vegetation falls below 30%', 'Starvation deaths', 'Population a few months later'],
    setup: { initialDeer: 500, initialWolves: 8 },
    params: {},
  },
  {
    id: 'wolfGlut', letter: 'F', title: 'Predator overpopulation',
    summary: 'An unusually large wolf population hunts a normal deer herd. Can the predators sustain themselves?',
    hypotheses: ['Deer are depleted rapidly.', 'Wolves then starve and decline.', 'Either a smaller balance emerges or one species disappears.'],
    measures: ['Lowest deer population', 'Wolf starvation deaths', 'Whether either species goes extinct'],
    setup: { initialDeer: 300, initialWolves: 100 },
    params: {},
  },
  {
    id: 'lynxHare', letter: 'G', title: 'Lynx and hare',
    summary: 'Only snowshoe hares and their specialist hunter, the lynx, plus a few foxes. The textbook predator–prey cycle, played out animal by animal.',
    hypotheses: ['Hares boom while lynx are few.', 'Lynx numbers rise after the hare peak and fall after the hare crash.', 'The cycle repeats, or one species disappears.'],
    measures: ['Peak and trough of hares', 'Lag between hare and lynx peaks', 'Whether both persist'],
    setup: { initialDeer: 0, initialWolves: 0, fauna: { ...NO_FAUNA, hare: 160, lynx: 8, fox: 4 } },
    params: {},
  },
];
