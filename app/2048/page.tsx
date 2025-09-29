import type { Metadata } from "next";
import { Provider as GameProvider, Score, Best, NewGameButton, Board } from "./Game2048";

export const metadata: Metadata = {
  title: "2048 | Next.js Boilerplate",
  description: "Play a smooth and beautiful 2048 game.",
};

export default function Page() {
  return (
    <GameProvider>
      <div className="min-h-screen bg-gradient-to-br from-amber-100 via-orange-100 to-rose-100 dark:from-neutral-900 dark:via-neutral-950 dark:to-black text-neutral-900 dark:text-neutral-100">
        <div className="mx-auto max-w-[900px] px-6 py-10">
          <header className="flex items-end justify-between gap-6 mb-8">
            <div>
              <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-transparent bg-clip-text drop-shadow-sm">
                2048
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                合并数字方块，达成 2048！
              </p>
            </div>
            <div className="flex gap-3 items-stretch">
              <div className="rounded-xl px-4 py-2 text-center backdrop-blur bg-white/70 dark:bg-white/10 shadow-sm border border-white/50 dark:border-white/10">
                <div className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Score
                </div>
                <Score />
              </div>
              <div className="rounded-xl px-4 py-2 text-center backdrop-blur bg-white/70 dark:bg-white/10 shadow-sm border border-white/50 dark:border-white/10">
                <div className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Best
                </div>
                <Best />
              </div>
              <NewGameButton />
            </div>
          </header>

          <Board />
        </div>
      </div>
    </GameProvider>
  );
}
