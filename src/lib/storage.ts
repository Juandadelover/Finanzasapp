import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from "@/lib/defaults";
import {
  STORAGE_KEY,
  STORAGE_VERSION,
  type FinanceState,
  type PersistedState,
} from "@/types/finance";

export function getInitialState(): FinanceState {
  return {
    transactions: [],
    categories: DEFAULT_CATEGORIES,
    settings: DEFAULT_SETTINGS,
  };
}

export function loadState(): FinanceState {
  if (typeof window === "undefined") return getInitialState();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getInitialState();

    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed || parsed.version !== STORAGE_VERSION) {
      return getInitialState();
    }

    return {
      transactions: parsed.transactions ?? [],
      categories: parsed.categories?.length ? parsed.categories : DEFAULT_CATEGORIES,
      settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
    };
  } catch (error) {
    console.error("No se pudo leer el estado guardado", error);
    return getInitialState();
  }
}

export function saveState(state: FinanceState): void {
  if (typeof window === "undefined") return;

  try {
    const payload: PersistedState = { ...state, version: STORAGE_VERSION };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error("No se pudo guardar el estado", error);
  }
}

export function clearState(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
