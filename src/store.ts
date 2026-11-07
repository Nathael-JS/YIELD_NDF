// Estado de la app. Sesión e historial se guardan en localStorage; las filas de los archivos solo en memoria.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HistoryItem, Period } from './components/ui.tsx';
import { commonColumns, type ParsedFile } from './lib/files.ts';

export const FILE_TYPES = ['TCQS', 'DATA ANALYSIS', 'QM'] as const;
export type FileType = (typeof FILE_TYPES)[number];

export interface LoadedFile extends ParsedFile { name: string; loadedAt: string }

// shortcut: usuario de prueba fijo y sin backend; cambiar por la autenticación real cuando exista servidor.
export const TEST_USER = { user: 'demo', password: 'yield2026', name: 'Usuario de prueba' };

interface State {
  user: string | null;
  period: Period;
  /** Columna llave para validar y hacer match (p. ej. serial). */
  key: string;
  history: HistoryItem[];
  requests: string[];
  files: Partial<Record<FileType, LoadedFile>>;
  errors: Partial<Record<FileType, string>>;
  login: (user: string, password: string) => boolean;
  logout: () => void;
  requestAccount: (user: string) => void;
  setPeriod: (p: Period) => void;
  setKey: (k: string) => void;
  setFile: (t: FileType, f: LoadedFile) => void;
  setError: (t: FileType, msg: string) => void;
}

export const PERIOD_LABEL: Record<Period, string> = { dia: 'Día', semana: 'Semana', mes: 'Mes' };
export const shortDate = (d: Date) =>
  d.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', '');

export const useApp = create<State>()(
  persist(
    (set, get) => ({
      user: null,
      period: 'semana',
      key: '',
      history: [],
      requests: [],
      files: {},
      errors: {},
      login: (user, password) => {
        const ok = user.trim().toLowerCase() === TEST_USER.user && password === TEST_USER.password;
        if (ok) set({ user: TEST_USER.name });
        return ok;
      },
      logout: () => set({ user: null, files: {}, errors: {} }),
      requestAccount: (user) => set({ requests: [...get().requests, user.trim()] }),
      setPeriod: (period) => set({ period }),
      setKey: (key) => set({ key }),
      setFile: (t, f) => set((s) => ({
        files: { ...s.files, [t]: f },
        errors: { ...s.errors, [t]: undefined },
        history: [{ type: t, name: f.name, period: PERIOD_LABEL[s.period], date: f.loadedAt }, ...s.history],
      })),
      // un archivo con error reemplaza al anterior: no comparar con datos viejos sin avisar
      setError: (t, msg) => set((s) => ({ errors: { ...s.errors, [t]: msg }, files: { ...s.files, [t]: undefined } })),
    }),
    { name: 'yield-control', partialize: ({ user, period, key, history, requests }) => ({ user, period, key, history, requests }) },
  ),
);

/** Archivos cargados, columnas en común y la llave vigente (la guardada si sigue en común, si no la primera). */
export function useLoaded() {
  const { files, key } = useApp();
  const loaded = Object.fromEntries(FILE_TYPES.filter((t) => files[t]).map((t) => [t, files[t]!])) as Record<FileType, LoadedFile>;
  const common = commonColumns(Object.values(loaded).map((f) => f.headers));
  const current = common.find((c) => c.toLowerCase() === key.toLowerCase()) ?? common[0] ?? '';
  return { loaded, count: Object.keys(loaded).length, common, key: current };
}
