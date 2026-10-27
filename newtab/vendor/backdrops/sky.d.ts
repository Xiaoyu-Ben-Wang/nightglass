export interface SkyOptions {
  aurora?: boolean;
  stars?: boolean;
  chart?: boolean;
  meteors?: boolean;
  clouds?: boolean;
  mountains?: boolean;
  koi?: boolean;
  pole?: [number, number];
  fish?: number;
  skyTurnSeconds?: number;
  transparent?: boolean;
}

export interface Backdrop {
  set(next: SkyOptions): void;
  redraw(): void;
  restart(): void;
  stop(): void;
}

export default function mount(canvas: HTMLCanvasElement, opts?: SkyOptions): Backdrop;
