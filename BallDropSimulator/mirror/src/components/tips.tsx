import type { ReactNode } from 'react';

const b = (s: string) => <b className="font-semibold text-ink">{s}</b>;

export const TIPS: Record<string, ReactNode> = {
  gamma: <>{b('Lorentz factor γ = 1/√(1 − v²/c²).')} 1 at rest, growing without limit as v approaches c. It sets how much moving clocks run slow and moving lengths shrink, as measured from another frame.</>,
  frame: <>{b('Inertial reference frame:')} a non-accelerating point of view with its own rulers and synchronized clocks. The train and the track each define one, and the laws of physics are the same in both.</>,
  c: <>{b('Speed of light, c = 299,792,458 m/s.')} Every inertial observer measures the same value, whatever their own speed or the speed of the source.</>,
  properTime: <>{b('Train time t′')} is measured by clocks at rest in the train. Between departure and return the photon starts and ends at the passenger's eye, so t′ is his proper time.</>,
  contraction: <>{b('Length contraction:')} a length L₀ along the motion, measured in the frame where it moves, is L₀/γ. Heights and widths across the motion do not change.</>,
  simultaneity: <>{b('Relativity of simultaneity:')} the frames disagree about which distant events happen "at the same time". That is why the reflection happens at a different moment in each view while departure and return line up.</>,
  principle: <>{b('Principle of relativity:')} no experiment done entirely inside a smoothly moving train can reveal its constant velocity. The mirror behaves exactly as it does at rest.</>,
};
