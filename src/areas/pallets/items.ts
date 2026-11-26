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
  /** Crea o actualiza por DN: lo del SFC se reemplaza y lo escrito a mano se conserva. */
  upsert: (xs: Item[]) => void;
  update: (dn: string, patch: Partial<Item>) => void;
  clear: () => void;
  /** Trae los de la base; se queda la versión más reciente de cada DN y sube lo que solo estaba aquí. */
  sync: () => Promise<void>;
  /** Sube estos DN a la base. */
  push: (dns: string[]) => Promise<void>;
}

const cuando = (x: Item) => x.editado ?? x.creado;
const orden = (xs: Item[]) => xs.sort((a, b) => b.creado.localeCompare(a.creado) || a.dn.localeCompare(b.dn)); // lo más nuevo primero

export const usePallets = create<Items>()(persist((set, get) => ({
  items: [],
  upsert: (xs) => set((s) => {
    const nuevos = new Map(xs.map((x) => [x.dn, x]));
    const viejos = s.items.map((v) => { const n = nuevos.get(v.dn); if (!n) return v; nuevos.delete(v.dn); return { ...v, po: n.po, to: n.to, pnSfc: n.pnSfc, piezas: n.piezas, archivo: n.archivo, editado: n.creado }; });
    return { items: orden([...nuevos.values(), ...viejos]) };
  }),
  update: (dn, patch) => set((s) => ({ items: s.items.map((x) => (x.dn === dn ? { ...x, ...patch } : x)) })),
  clear: () => set({ items: [], db: undefined }),
  sync: async () => {
    let base: Omit<Item, 'price'>[];
    try { base = await loadItems(); } catch (e) { set({ db: ['warn', `Sin conexión con la base (${(e as Error).message}): se muestran los items de este equipo.`] }); return; }
    const loc = new Map(get().items.map((x) => [x.dn, x])), subir: string[] = [];
    const items = base.map((b): Item => {
      const l = loc.get(b.dn); loc.delete(b.dn);
      if (l && cuando(l) > cuando({ ...b, price: '' })) { subir.push(l.dn); return l; } // editado aquí después (sin conexión)
      return { ...b, price: l?.price ?? '' };
    });
    subir.push(...loc.keys());
    set({ items: orden([...items, ...loc.values()]), db: undefined });
    if (subir.length) await get().push(subir);
  },
  push: (dns) => saveItems(get().items.filter((x) => dns.includes(x.dn)))
    .then(() => { set({ db: undefined }); }, (e) => { set({ db: ['warn', `No se guardó en la base (${(e as Error).message}); quedó en este equipo y se sube al volver a abrir Pallets.`] }); }),
}), { name: 'yc-pallets', partialize: (s) => ({ items: s.items }) }));
