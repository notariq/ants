/** A 2D position or vector. */
export interface Vec2 {
  x: number;
  y: number;
}

/** A screen-space rectangle used as an avoidance area. */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Current pointer position and interaction flags. */
export interface PointerState {
  x: number;
  y: number;
  active: boolean;
  down: boolean;
}
