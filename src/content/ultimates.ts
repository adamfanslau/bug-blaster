export type UltimateFlavor = "wipe" | "shrink" | "rewind";

export interface Ultimate {
  name: string;
  tagline: string;
  color: string;
  flavor: UltimateFlavor;
}

const SUDO_NAME = "sudo !!";

const ULTIMATES: readonly Ultimate[] = [
  { name: "git push --force", tagline: "History rewritten. Those bugs never existed.", color: "#ff3b5c", flavor: "wipe" },
  { name: "rm -rf node_modules", tagline: "1.2 GB freed. Bugs included.", color: "#ff9d3b", flavor: "shrink" },
  { name: SUDO_NAME, tagline: "With great power comes zero code review.", color: "#c17bff", flavor: "wipe" },
  { name: "Ctrl+Z x1000", tagline: "Undo. Undo. UNDO.", color: "#58a6ff", flavor: "rewind" },
  { name: "kill -9", tagline: "No graceful shutdown for you.", color: "#ff5c5c", flavor: "wipe" },
  { name: "DROP TABLE bugs;", tagline: "Little Bobby Tables sends his regards.", color: "#3fe37c", flavor: "wipe" },
];

let last: Ultimate | null = null;

/**
 * Picks an ultimate that differs from the previous one. `sudo !!` re-runs the
 * previous command with privilege: it borrows the last flavor and shows its name.
 */
export function pickUltimate(): Ultimate {
  const candidates = ULTIMATES.filter((u) => u !== last && (u.name !== SUDO_NAME || last !== null));
  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  let result: Ultimate = chosen;
  if (chosen.name === SUDO_NAME && last) {
    result = { ...chosen, name: `sudo ${last.name}`, flavor: last.flavor };
  }
  last = chosen;
  return result;
}
