import { useSyncExternalStore } from "react";
import { HERO_CASE_ID } from "./demoConfig";
import { createDemoSeedData, type Case, type DemoSeedData, type ModelJob, type Person, type TimelineEvent } from "./seed";

type DemoDB = {
  persons: Record<string, Person>;
  cases: Record<string, Case>;
  jobs: Record<string, ModelJob>;
  timeline: TimelineEvent[];
  initializedAt: string;
};

const STORAGE_KEY = "neuro-shield:demo-db:v5";

const listeners = new Set<() => void>();
let version = 0;
let db: DemoDB | null = null;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function fromSeed(seed: DemoSeedData): DemoDB {
  const persons: Record<string, Person> = {};
  const cases: Record<string, Case> = {};
  const jobs: Record<string, ModelJob> = {};
  for (const person of seed.persons) persons[person.personId] = clone(person);
  for (const item of seed.cases) cases[item.caseId] = clone(item);
  for (const job of seed.jobs) jobs[job.jobId] = clone(job);

  return {
    persons,
    cases,
    jobs,
    timeline: clone(seed.timeline),
    initializedAt: new Date().toISOString(),
  };
}

function parsePersisted(raw: string): DemoDB | null {
  try {
    const parsed = JSON.parse(raw) as DemoDB;
    if (!parsed || !parsed.cases || !parsed.persons || !parsed.jobs || !Array.isArray(parsed.timeline)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistStore(state: DemoDB) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // no-op in private mode / storage full
  }
}

function loadStore() {
  if (db) return db;

  if (typeof window !== "undefined") {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = parsePersisted(raw);
      if (parsed) {
        db = parsed;
        return db;
      }
    }
  }

  db = fromSeed(createDemoSeedData());
  persistStore(db);
  return db;
}

function emit() {
  const state = loadStore();
  version += 1;
  persistStore(state);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getVersionSnapshot() {
  return version;
}

function touchCase(caseId: string) {
  const state = loadStore();
  const item = state.cases[caseId];
  if (!item) return;
  item.updatedAt = new Date().toISOString();
}

export function useDemoStoreVersion() {
  return useSyncExternalStore(subscribe, getVersionSnapshot, getVersionSnapshot);
}

export function ensureDemoSeed() {
  const state = loadStore();
  if (Object.keys(state.cases).length > 0 && Object.keys(state.persons).length > 0) return;
  db = fromSeed(createDemoSeedData());
  emit();
}

export function resetDemoSeed() {
  db = fromSeed(createDemoSeedData());
  emit();
}

export function getHeroCaseId() {
  return HERO_CASE_ID;
}

export function listPersons() {
  return Object.values(loadStore().persons).map(clone);
}

export function getPerson(personId: string) {
  const person = loadStore().persons[personId];
  return person ? clone(person) : null;
}

export function listCases(stage?: Case["currentStage"]) {
  const entries = Object.values(loadStore().cases);
  const filtered = stage ? entries.filter((item) => item.currentStage === stage) : entries;
  return filtered
    .slice()
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
    .map(clone);
}

export function getCase(caseId: string) {
  const item = loadStore().cases[caseId];
  return item ? clone(item) : null;
}

export function updateCase(caseId: string, updater: (previous: Case) => Case) {
  const state = loadStore();
  const previous = state.cases[caseId];
  if (!previous) throw new Error(`Case not found: ${caseId}`);
  const next = updater(clone(previous));
  next.updatedAt = new Date().toISOString();
  state.cases[caseId] = next;
  emit();
  return clone(next);
}

export function replaceCase(nextCase: Case) {
  const state = loadStore();
  state.cases[nextCase.caseId] = clone(nextCase);
  touchCase(nextCase.caseId);
  emit();
}

export function listJobs(caseId?: string) {
  const entries = Object.values(loadStore().jobs);
  const filtered = caseId ? entries.filter((job) => job.caseId === caseId) : entries;
  return filtered.slice().sort((a, b) => (a.startedAt ?? "").localeCompare(b.startedAt ?? "")).map(clone);
}

export function getJob(jobId: string) {
  const job = loadStore().jobs[jobId];
  return job ? clone(job) : null;
}

export function getLatestJobByCase(caseId: string, stage?: ModelJob["stage"]) {
  const filtered = listJobs(caseId).filter((job) => (stage ? job.stage === stage : true));
  if (filtered.length === 0) return null;
  return filtered
    .slice()
    .sort((a, b) => {
      const aTs = a.startedAt ? +new Date(a.startedAt) : 0;
      const bTs = b.startedAt ? +new Date(b.startedAt) : 0;
      return bTs - aTs;
    })[0] ?? null;
}

export function upsertJob(job: ModelJob) {
  const state = loadStore();
  state.jobs[job.jobId] = clone(job);
  touchCase(job.caseId);
  emit();
  return clone(job);
}

export function updateJob(jobId: string, updater: (previous: ModelJob) => ModelJob) {
  const state = loadStore();
  const previous = state.jobs[jobId];
  if (!previous) throw new Error(`Job not found: ${jobId}`);
  const next = updater(clone(previous));
  state.jobs[jobId] = next;
  touchCase(next.caseId);
  emit();
  return clone(next);
}

export function appendTimeline(event: TimelineEvent) {
  const state = loadStore();
  state.timeline.unshift(clone(event));
  touchCase(event.caseId);
  emit();
}

export function listTimeline(caseId?: string) {
  const state = loadStore();
  const items = caseId ? state.timeline.filter((event) => event.caseId === caseId) : state.timeline;
  return items
    .slice()
    .sort((a, b) => +new Date(b.ts) - +new Date(a.ts))
    .map(clone);
}

export function clearCaseJobs(caseId: string, emitChange = true) {
  const state = loadStore();
  for (const [jobId, job] of Object.entries(state.jobs)) {
    if (job.caseId === caseId) {
      delete state.jobs[jobId];
    }
  }
  if (emitChange) emit();
}

export function resetHeroCaseState() {
  const seeded = createDemoSeedData();
  const hero = seeded.cases.find((item) => item.caseId === HERO_CASE_ID);
  const heroTimeline = seeded.timeline.filter((item) => item.caseId === HERO_CASE_ID);
  if (!hero) return;

  const state = loadStore();
  state.cases[HERO_CASE_ID] = clone(hero);
  state.timeline = state.timeline.filter((item) => item.caseId !== HERO_CASE_ID);
  state.timeline.unshift(...heroTimeline.map(clone));
  clearCaseJobs(HERO_CASE_ID, false);
  emit();
}
