// Estado de la app. Sesión e historial se guardan en localStorage; las filas de los archivos solo en memoria.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HistoryItem, Period } from './components/ui.tsx';
import type { ParsedFile } from './lib/files.ts';

export const FILE_TYPES = ['TCQS', 'DATA ANALYSIS', 'QM'] as const;
export type FileType = (typeof FILE_TYPES)[number];

export interface LoadedFile extends ParsedFile { name: string; loadedAt: string }

// shortcut: usuario de prueba fijo y sin backend; cambiar por la autenticación real cuando exista servidor.
export const TEST_USER = { user: 'demo', password: 'yield2026', name: 'Usuario de prueba' };

interface State {
  user: string | null;
  period: Period;
  history: HistoryItem[];
  requests: string[];
  files: Partial<Record<FileType, LoadedFile>>;
  errors: Partial<Record<FileType, string>>;
  login: (user: string, password: string) => boolean;
  logout: () => void;
  requestAccount: (user: string) => void;
  setPeriod: (p: Period) => void;
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
      setFile: (t, f) => set((s) => ({
        files: { ...s.files, [t]: f },
        errors: { ...s.errors, [t]: undefined },
        history: [{ type: t, name: f.name, period: PERIOD_LABEL[s.period], date: f.loadedAt }, ...s.history],
      })),
      // un archivo con error reemplaza al anterior: no comparar con datos viejos sin avisar
      setError: (t, msg) => set((s) => ({ errors: { ...s.errors, [t]: msg }, files: { ...s.files, [t]: undefined } })),
    }),
    { name: 'yield-control', partialize: ({ user, period, history, requests }) => ({ user, period, history, requests }) },
  ),
);
