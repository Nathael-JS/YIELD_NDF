// Items de Pallets (uno por DN): en la base (sin precio) y una copia en este navegador, que se borra al cerrar sesión.
// shortcut: gana la última escritura por DN; dos personas editando el mismo DN a la vez se pisan. Bloqueo por DN si pasa en piso.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Tone } from '../../components/ui.tsx';
import { loadItems, saveItems } from '../../lib/db.ts';
import type { Item } from '../../lib/sfc.ts';

interface Items {
  items: Item[];
  /** Aviso de la base (sin conexión, no se guardó…); undefined = todo en orden. */
  db?: [Tone, string];
  /** DN que no se pudieron subir: se reintentan al abrir Pallets y al cerrar sesión. */
  pend: string[];
  /** Crea o actualiza por DN: lo del SFC se reemplaza y lo escrito a mano se conserva. */
  upsert: (xs: Item[]) => void;
  update: (dn: string, patch: Partial<Item>) => void;
  /** Mueve una pieza a otro DN; si no existe, lo crea con los datos del SFC del original (los campos a mano van vacíos). */
  mover: (de: string, serial: string, a: string) => void;
  clear: () => void;
  /** Trae los de la base; se queda la versión más reciente de cada DN y sube lo que solo estaba aquí. */
  sync: () => Promise<void>;
  /** Sube estos DN a la base. */
  push: (dns: string[]) => Promise<void>;
}

// hora local «2026-11-26 10:15:00» como local() de lib/wip.ts, sin cargar ese módulo en el inicio de la app
const ahoraLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 19).replace('T', ' ');
const cuando = (x: Item) => x.editado || x.creado; // la base guarda '' si nunca se editó
const orden = (xs: Item[]) => xs.sort((a, b) => b.creado.localeCompare(a.creado) || a.dn.localeCompare(b.dn)); // lo más nuevo primero

export const usePallets = create<Items>()(persist((set, get) => ({
  items: [],
  pend: [],
  upsert: (xs) => set((s) => {
    const nuevos = new Map(xs.map((x) => [x.dn, x]));
    const viejos = s.items.map((v) => { const n = nuevos.get(v.dn); if (!n) return v; nuevos.delete(v.dn); return { ...v, po: n.po, to: n.to, pnSfc: n.pnSfc, piezas: n.piezas, archivo: n.archivo, editado: n.creado }; });
    return { items: orden([...nuevos.values(), ...viejos]) };
  }),
  update: (dn, patch) => set((s) => ({ items: s.items.map((x) => (x.dn === dn ? { ...x, ...patch } : x)) })),
  mover: (de, serial, a) => set((s) => {
    const src = s.items.find((x) => x.dn === de), p = src?.piezas.find((x) => x.serial === serial);
    if (!src || !p || de === a) return {};
    const ahora = ahoraLocal(), pieza = { ...p, manual: true };
    const items = s.items.map((x) => (x.dn === de ? { ...x, piezas: x.piezas.filter((y) => y.serial !== serial), editado: ahora }
      : x.dn === a ? { ...x, piezas: [...x.piezas.filter((y) => y.serial !== serial), pieza], editado: ahora } : x));
    if (!s.items.some((x) => x.dn === a)) items.unshift({ ...src, dn: a, piezas: [pieza], so: '', shipped: '', custPo: '', custDn: '', creado: ahora, editado: undefined, edito: undefined, liberados: [], piso: undefined });
    return { items };
  }),
  clear: () => set({ items: [], pend: [], db: undefined }),
  sync: async () => {
    let base: Omit<Item, 'price'>[];
    try { base = await loadItems(); } catch (e) { set({ db: ['warn', `Sin conexión con la base (${(e as Error).message}): se muestran los items de este equipo.`] }); return; }
    const loc = new Map(get().items.map((x) => [x.dn, x])), subir: string[] = [];
    const items = base.map((b): Item => {
      const l = loc.get(b.dn); loc.delete(b.dn);
      if (l && cuando(l) > cuando({ ...b, price: '' })) { subir.push(l.dn); return l; } // editado aquí después (sin conexión)
      return { ...b, price: l?.price ?? '' };
    });
    subir.push(...loc.keys(), ...get().pend.filter((d) => !subir.includes(d) && !loc.has(d)));
    set({ items: orden([...items, ...loc.values()]), db: undefined });
    if (subir.length) await get().push(subir);
  },
  push: (dns) => {
    const xs = get().items.filter((x) => dns.includes(x.dn));
    if (!xs.length) return Promise.resolve();
    return saveItems(xs).then(() => { set((s) => ({ db: undefined, pend: s.pend.filter((d) => !dns.includes(d)) })); },
      (e) => { set((s) => ({ db: ['warn', `No se guardó en la base (${(e as Error).message}); quedó en este equipo y se sube al volver a abrir Pallets.`], pend: [...new Set([...s.pend, ...dns])] })); });
  },
}), { name: 'yc-pallets', partialize: (s) => ({ items: s.items, pend: s.pend }) }));
