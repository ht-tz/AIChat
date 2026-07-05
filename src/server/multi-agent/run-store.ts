const runStore: Map<string, any> = new Map();

export function storeRun(run: any): void {
  runStore.set(run.id, run);
}

export function getRun(id: string): any | undefined {
  return runStore.get(id);
}

export function getAllRuns(): any[] {
  return Array.from(runStore.values());
}
