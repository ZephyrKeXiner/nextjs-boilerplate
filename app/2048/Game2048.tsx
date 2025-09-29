"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type Direction = "up" | "down" | "left" | "right";

type Tile = {
  id: number;
  row: number; // 0..3
  col: number; // 0..3
  value: number; // 2,4,8,...
  spawned: boolean; // for pop-in animation
  merged: boolean; // for bump animation
};

type GameState = {
  tiles: Tile[];
  score: number;
  best: number;
  won: boolean;
  over: boolean;
};

const SIZE = 4;

const GameContext = createContext<{
  state: GameState;
  move: (dir: Direction) => void;
  newGame: () => void;
}>({
  state: { tiles: [], score: 0, best: 0, won: false, over: false },
  move: () => {},
  newGame: () => {},
});

let idSeq = 1;

function emptyCells(tiles: Tile[]) {
  const occupied = new Set(tiles.map((t) => `${t.row},${t.col}`));
  const cells: Array<{ row: number; col: number }> = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const key = `${r},${c}`;
      if (!occupied.has(key)) cells.push({ row: r, col: c });
    }
  }
  return cells;
}

function randomSpawn(tiles: Tile[]): Tile[] {
  const empties = emptyCells(tiles);
  if (empties.length === 0) return tiles;
  const { row, col } = empties[Math.floor(Math.random() * empties.length)];
  const value = Math.random() < 0.1 ? 4 : 2;
  return [
    ...tiles,
    { id: idSeq++, row, col, value, spawned: true, merged: false },
  ];
}

function canAnyMove(tiles: Tile[]) {
  // If any empty cell, can move
  if (emptyCells(tiles).length > 0) return true;
  // Check adjacent merges
  const grid: (Tile | undefined)[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(undefined));
  tiles.forEach((t) => (grid[t.row][t.col] = t));
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const t = grid[r][c];
      if (!t) continue;
      if (r + 1 < SIZE && grid[r + 1][c]?.value === t.value) return true;
      if (c + 1 < SIZE && grid[r][c + 1]?.value === t.value) return true;
    }
  }
  return false;
}

function useGameEngine() {
  const [state, setState] = useState<GameState>({ tiles: [], score: 0, best: 0, won: false, over: false });

  // load best from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("game-2048-best");
      if (saved) setState((s) => ({ ...s, best: Number(saved) || 0 }));
    } catch {}
  }, []);

  // write best
  useEffect(() => {
    try {
      localStorage.setItem("game-2048-best", String(state.best));
    } catch {}
  }, [state.best]);

  const newGame = useCallback(() => {
    idSeq = 1;
    let tiles: Tile[] = [];
    tiles = randomSpawn(tiles);
    tiles = randomSpawn(tiles);
    setState((s) => ({ ...s, tiles, score: 0, won: false, over: false }));
  }, []);

  // initialize on mount
  useEffect(() => {
    if (state.tiles.length === 0) newGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const move = useCallback((dir: Direction) => {
    setState((prev) => {
      const tiles = prev.tiles.map((t) => ({ ...t, merged: false, spawned: false }));

      // Build grid map
      const grid: (Tile | undefined)[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(undefined));
      tiles.forEach((t) => (grid[t.row][t.col] = t));

      const lines: Array<Array<{ r: number; c: number }>> = [];
      if (dir === "left" || dir === "right") {
        for (let r = 0; r < SIZE; r++) {
          const line = Array.from({ length: SIZE }, (_, i) => ({ r, c: i }));
          lines.push(dir === "left" ? line : line.reverse());
        }
      } else {
        for (let c = 0; c < SIZE; c++) {
          const line = Array.from({ length: SIZE }, (_, i) => ({ r: i, c }));
          lines.push(dir === "up" ? line : line.reverse());
        }
      }

      let moved = false;
      let scoreGain = 0;
      const toRemove = new Set<number>();

      for (const coords of lines) {
        // collect existing tiles along the line in order
        const lineTiles: Tile[] = [];
        for (const { r, c } of coords) {
          const t = grid[r][c];
          if (t) lineTiles.push(t);
        }
        if (lineTiles.length === 0) continue;

        // compress and merge
        let targetIndex = 0;
        for (let i = 0; i < lineTiles.length; i++) {
          const current = lineTiles[i];
          // find target cell for current
          let targetPos = coords[targetIndex];
          // if previous placed tile can merge with current
          if (targetIndex > 0) {
            const prevPos = coords[targetIndex - 1];
            const prevTile = grid[prevPos.r][prevPos.c];
            if (prevTile && prevTile.value === current.value && !prevTile.merged) {
              // merge into prevTile
              // remove current from its position in grid
              grid[current.row][current.col] = undefined;
              // move current onto prevTile and delete current (conceptually)
              moved = moved || current.row !== prevPos.r || current.col !== prevPos.c;
              // upgrade prev tile
              prevTile.value *= 2;
              prevTile.merged = true;
              scoreGain += prevTile.value;
              // clear current's old cell
              // nothing more to place for current, continue
              toRemove.add(current.id);
              continue;
            }
          }

          // otherwise move to next targetIndex
          const fromKey = `${current.row},${current.col}`;
          const toKey = `${targetPos.r},${targetPos.c}`;
          if (fromKey !== toKey) moved = true;

          // update grid occupancy
          grid[current.row][current.col] = undefined;
          // if destination occupied (shouldn't happen), advance
          while (grid[targetPos.r][targetPos.c]) {
            targetIndex++;
            targetPos = coords[targetIndex];
          }
          current.row = targetPos.r;
          current.col = targetPos.c;
          grid[current.row][current.col] = current;
          targetIndex++;
        }
      }

      // remove merged-away tiles
      let filtered = tiles.filter((t) => !toRemove.has(t.id));

      let won = prev.won || filtered.some((t) => t.value >= 2048);

      let nextTiles = filtered;
      if (moved) {
        nextTiles = randomSpawn(filtered);
      }

      const over = !won && !canAnyMove(nextTiles);
      const score = prev.score + scoreGain;
      const best = Math.max(prev.best, score);

      return { tiles: nextTiles, score, best, won, over };
    });
  }, []);

  return { state, move, newGame };
}

function useGame() {
  return useContext(GameContext);
}

function Provider({ children }: { children: React.ReactNode }) {
  const engine = useGameEngine();

  // keyboard controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      let dir: Direction | null = null;
      if (k === "ArrowUp" || k === "w" || k === "W") dir = "up";
      else if (k === "ArrowDown" || k === "s" || k === "S") dir = "down";
      else if (k === "ArrowLeft" || k === "a" || k === "A") dir = "left";
      else if (k === "ArrowRight" || k === "d" || k === "D") dir = "right";
      if (dir) {
        e.preventDefault();
        engine.move(dir);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [engine]);

  return <GameContext.Provider value={engine}>{children}</GameContext.Provider>;
}

function Score() {
  const { state } = useGame();
  return <div className="font-bold text-lg tabular-nums">{state.score}</div>;
}

function Best() {
  const { state } = useGame();
  return <div className="font-bold text-lg tabular-nums">{state.best}</div>;
}

function NewGameButton() {
  const { newGame } = useGame();
  return (
    <button
      onClick={newGame}
      className="rounded-xl px-4 py-2 font-medium bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow hover:shadow-md active:translate-y-[1px] transition-all border border-white/40 dark:border-white/10"
    >
      新游戏
    </button>
  );
}

function valueClasses(value: number) {
  // choose color based on value tiers
  const map: Record<number, string> = {
    2: "bg-amber-100 text-amber-900",
    4: "bg-amber-200 text-amber-900",
    8: "bg-orange-300 text-orange-950",
    16: "bg-orange-400 text-white",
    32: "bg-orange-500 text-white",
    64: "bg-orange-600 text-white",
    128: "bg-rose-400 text-white",
    256: "bg-rose-500 text-white",
    512: "bg-rose-600 text-white",
    1024: "bg-fuchsia-500 text-white",
    2048: "bg-fuchsia-600 text-white",
  };
  return (
    map[value] ||
    "bg-gradient-to-br from-fuchsia-600 to-pink-600 text-white shadow-lg"
  );
}

function TileView({ tile, cellSize, gap }: { tile: Tile; cellSize: number; gap: number }) {
  const translate = `translate(${tile.col * (cellSize + gap)}px, ${tile.row * (cellSize + gap)}px)`;
  const outerClass = [
    "absolute",
    "transition-transform duration-150 ease-out will-change-transform",
  ].join(" ");
  const innerClass = [
    "rounded-xl grid place-items-center font-extrabold select-none",
    "shadow-tile",
    valueClasses(tile.value),
    tile.spawned ? "animate-pop" : "",
    tile.merged ? "animate-merge" : "",
  ].join(" ");

  return (
    <div style={{ transform: translate }} className={outerClass}>
      <div style={{ width: cellSize, height: cellSize }} className={innerClass}>
        <span className={tile.value >= 1024 ? "text-2xl sm:text-3xl" : tile.value >= 128 ? "text-3xl sm:text-4xl" : "text-4xl sm:text-5xl"}>
          {tile.value}
        </span>
      </div>
    </div>
  );
}

function Board() {
  const { state, move } = useGame();
  const boardRef = useRef<HTMLDivElement>(null);

  // swipe controls
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    let startX = 0,
      startY = 0,
      active = false;
    const threshold = 24; // px
    const onDown = (e: PointerEvent) => {
      active = true;
      startX = e.clientX;
      startY = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      if (!active) return;
      active = false;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;
      if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? "right" : "left");
      else move(dy > 0 ? "down" : "up");
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
    };
  }, [move]);

  const sizePx = useResponsiveBoardSize();
  const gap = useResponsiveGap();
  const cellSize = Math.floor((sizePx - gap * (SIZE - 1)) / SIZE);

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        ref={boardRef}
        className="relative rounded-3xl p-3 sm:p-4 backdrop-blur bg-white/40 dark:bg-white/5 border border-white/50 dark:border-white/10 shadow-lg"
      >
        <div
          className="relative"
          style={{ width: sizePx, height: sizePx }}
        >
          {/* Grid background */}
          <div className="absolute inset-0 grid grid-cols-4 grid-rows-4" style={{ gap }}>
            {Array.from({ length: SIZE * SIZE }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl bg-white/60 dark:bg-white/[0.06] border border-white/50 dark:border-white/10"
              />
            ))}
          </div>

          {/* Tiles layer */}
          <div className="absolute inset-0" style={{ padding: 0 }}>
            {state.tiles.map((t) => (
              <TileView key={t.id} tile={t} cellSize={cellSize} gap={gap} />)
            )}
          </div>
        </div>

        {/* Overlay states */}
        {(state.over || state.won) && (
          <div className="absolute inset-3 sm:inset-4 rounded-2xl grid place-items-center bg-white/70 dark:bg-black/50 backdrop-blur-sm">
            <div className="text-center">
              <div className="text-3xl font-extrabold mb-2">
                {state.over ? "游戏结束" : "达成 2048！"}
              </div>
              <button
                onClick={() => move("up")}
                className="hidden"
                aria-hidden
              />
              <NewGameButton />
            </div>
          </div>
        )}
      </div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        使用方向键 / WASD 或滑动来移动方块
      </p>
    </div>
  );
}

function useResponsiveBoardSize() {
  const [size, setSize] = useState(360);
  useEffect(() => {
    const compute = () => {
      const w = Math.min(window.innerWidth, 900);
      const px = w < 400 ? 300 : w < 640 ? 340 : 460;
      setSize(px);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);
  return size;
}

function useResponsiveGap() {
  const [gap, setGap] = useState(12); // px
  useEffect(() => {
    const compute = () => setGap(window.innerWidth < 640 ? 12 : 16);
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);
  return gap;
}

export { Provider, Score, Best, NewGameButton, Board };
export default {
  Provider,
  Score,
  Best,
  NewGameButton,
  Board,
};
