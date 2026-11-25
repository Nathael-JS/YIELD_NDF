// Items de Pallets (uno por DN). shortcut: viven en este navegador mientras el backend de Pallets está en pausa;
// se borran al cerrar sesión. Pasan a la base en F9 (PALLETS.md).
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Item } from '../../lib/sfc.ts';

interface Items {
  items: Item[];
  /** Crea o actualiza por DN: lo del SFC se reemplaza y lo escrito a mano se conserva. */
  upsert: (xs: Item[]) => void;
  update: (dn: string, patch: Partial<Item>) => void;
  clear: () => void;
}

export const usePallets = create<Items>()(persist((set) => ({
  items: [],
  upsert: (xs) => set((s) => {
    const nuevos = new Map(xs.map((x) => [x.dn, x]));
    const viejos = s.items.map((v) => { const n = nuevos.get(v.dn); if (!n) return v; nuevos.delete(v.dn); return { ...v, po: n.po, to: n.to, pnSfc: n.pnSfc, piezas: n.piezas, archivo: n.archivo, editado: n.creado }; });
    return { items: [...nuevos.values(), ...viejos] };
  }),
  update: (dn, patch) => set((s) => ({ items: s.items.map((x) => (x.dn === dn ? { ...x, ...patch } : x)) })),
  clear: () => set({ items: [] }),
}), { name: 'yc-pallets' }));
