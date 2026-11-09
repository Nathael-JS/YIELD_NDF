// Estado de la app. Sesión e historial en localStorage; el último archivo de cada tipo en IndexedDB (lib/saved.ts).
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Period, Tone } from './components/ui.tsx';
import { useMemo } from 'react';
import type { ParsedFile } from './lib/files.ts';
import { apiLogout, apiMe, loadModelos, setOnExpired, type Modelos, type Sesion } from './lib/db.ts';
import { dropAll, dropFile, loadFiles, saveFile } from './lib/saved.ts';
import { modelKey, readTcqs } from './lib/tcqs.ts';

// Los modelos de Juliet (BOM) viven en la base (`modelos`); DATA ANALYSIS y QM: pendientes.
export const FILE_TYPES = ['TCQS'] as const;
export type FileType = (typeof FILE_TYPES)[number];

export interface LoadedFile extends ParsedFile { name: string; loadedAt: string }


interface State {
  user: string | null;
  period: Period;
  /** Una por inicio de sesión: agrupa las cargas del historial en Neon. */
  session: string;
  /** Última carga ya guardada en Neon (archivo + hora), para no guardarla dos veces. */
  savedKey: string;
  db: [Tone, string] | null;
  files: Partial<Record<FileType, LoadedFile>>;
  errors: Partial<Record<FileType, string>>;
  /** Modelos del proyecto guardados en la base; null = sin lista (se usan todos los modelos del TCQS). */
  modelos: Modelos | null;
  reloadModelos: () => Promise<void>;
  /** Con la respuesta del servidor (POST /api/login). */
  login: (s: Sesion) => void;
  /** Solo deciden qué se muestra; los permisos los revisa el servidor en cada llamada. */
  admin: boolean;
  cuenta: Pick<Sesion, 'principal' | 'mfa' | 'debeCambiar' | 'mfaPendiente'>;
  logout: () => void;
  setPeriod: (p: Period) => void;
  setFile: (t: FileType, f: LoadedFile) => void;
  setError: (t: FileType, msg: string) => void;
  setDb: (db: [Tone, string] | null, savedKey?: string) => void;
}

export const shortDate = (d: Date) =>
  d.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', '');

const NADA = { principal: false, mfa: false, debeCambiar: false, mfaPendiente: false };

export const useApp = create<State>()(
  persist(
    (set) => ({
      user: null,
      period: 'semana',
      session: '',
      savedKey: '',
      db: null,
      files: {},
      errors: {},
      admin: false,
      cuenta: NADA,
      modelos: null,
      reloadModelos: () => loadModelos().then((m) => { set({ modelos: m.modelos.length ? m : null }); }),
      login: (s) => { set({ user: s.nombre, session: s.sesion, admin: s.admin, cuenta: s, db: null }); useApp.getState().reloadModelos().catch(() => {}); },
      // al salir se borran también los archivos guardados: el equipo puede ser compartido
      logout: () => { apiLogout().catch(() => {}); dropAll().catch(() => {}); set({ user: null, admin: false, cuenta: NADA, files: {}, errors: {}, savedKey: '', modelos: null }); },
      setPeriod: (period) => set({ period }),
      setFile: (t, f) => { saveFile(t, f).catch(() => {}); set((s) => ({
        files: { ...s.files, [t]: f },
        errors: { ...s.errors, [t]: undefined },
      })); },
      // un archivo con error reemplaza al anterior: no comparar con datos viejos sin avisar
      setDb: (db, savedKey) => set((s) => ({ db, savedKey: savedKey ?? s.savedKey })),
      setError: (t, msg) => { dropFile(t).catch(() => {}); set((s) => ({ errors: { ...s.errors, [t]: msg }, files: { ...s.files, [t]: undefined } })); },
    }),
    { name: 'yield-control', partialize: ({ user, admin, cuenta, period, session, savedKey }) => ({ user, admin, cuenta, period, session, savedKey }) },
  ),
);

// La sesión de verdad la tiene el servidor: si venció (o la cookie no está), se vuelve al login.
setOnExpired(() => { if (useApp.getState().user) useApp.getState().logout(); });
if (useApp.getState().user) apiMe().then((s) => useApp.getState().login(s)).catch(() => {});

// Recupera los archivos guardados al abrir la app (sin pisar uno que se haya cargado mientras tanto).
// Fallar aquí solo significa volver a cargarlos.
if (typeof indexedDB !== 'undefined') {
  loadFiles().then((saved) => {
    if (useApp.getState().user) useApp.setState((s) => ({ files: { ...(saved.TCQS && { TCQS: saved.TCQS }), ...s.files } }));
  }).catch(() => {});
}

/** Filas del TCQS ya filtradas a los modelos del proyecto (si hay lista en la base). */
export function useData() {
  const TCQS = useApp((s) => s.files.TCQS), MODELOS = useApp((s) => s.modelos);
  return useMemo(() => {
    const read = TCQS ? readTcqs(TCQS) : null;
    const bom = MODELOS?.modelos ?? [];
    const models = MODELOS ? new Set(bom.map(modelKey)) : null;
    const all = read?.records ?? [];
    const records = models ? all.filter((r) => models.has(modelKey(r.model))) : all;
    const dates = records.map((r) => r.date).sort();
    return { read, bom, models, all, records, from: dates[0], to: dates.at(-1) };
  }, [TCQS, MODELOS]);
}
