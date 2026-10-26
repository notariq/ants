export interface Vec2 {
  x: number;
  y: number;
}

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface PointerState {
  x: number;
  y: number;
  active: boolean;
  down: boolean;
  lastPaint: Vec2 | null;
}

export interface Shockwave {
  x: number;
  y: number;
  born: number;
}
