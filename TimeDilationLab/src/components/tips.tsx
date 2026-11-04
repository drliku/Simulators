import type { ReactNode } from 'react';

const b = (s: string) => <b className="font-semibold text-ink">{s}</b>;

export const TIPS: Record<string, ReactNode> = {
  gamma: <>{b('Lorentz factor γ = 1/√(1 − v²/c²).')} It is 1 at rest and grows without limit as v approaches c. A clock moving at v, compared against a frame's synchronized clocks, accumulates 1/γ as much time.</>,
  beta: <>{b('β = v/c,')} the velocity as a fraction of the speed of light (c = 299,792,458 m/s). Using β keeps the numbers dimensionless and well-behaved.</>,
  properTime: <>{b('Proper time Δτ')} is the time a clock measures along its own path between two events. Here it is the ship clock's reading between departure and the ship's current event.</>,
  earthTime: <>{b('Earth-frame time Δt')} is the time between the same two events according to Earth's inertial frame, read from clocks at rest in that frame and synchronized with Earth's clock.</>,
  frame: <>{b('Inertial reference frame:')} a non-accelerating viewpoint with its own rulers and synchronized clocks. Earth and the coasting ship each define one. Neither is the "real" one.</>,
  simultaneity: <>{b('Relativity of simultaneity:')} two events that are simultaneous in one frame need not be simultaneous in another. Each frame picks a different Earth event as "now" for the ship, which is why both can see the other's clock run slow.</>,
  lightYear: <>{b('Light-year:')} the distance light travels in one Julian year (365.25 days), about 9.46 × 10¹² km.</>,
  contraction: <>{b('Length contraction:')} an object moving at v is shorter by 1/γ along its direction of motion, measured in the frame where it moves. Lengths perpendicular to the motion do not change.</>,
  lightClock: <>{b('Light clock:')} a photon bouncing between two mirrors a distance L apart. Each round trip is one tick. Because light always travels at c, a longer path means a longer tick.</>,
  difference: <>{b('Δt − Δτ:')} how much more time Earth's frame assigns between the two events than the ship clock records. It is computed directly as Δt·(1 − 1/γ) so tiny values are not lost to rounding.</>,
};
