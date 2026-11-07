// Componentes del sistema de diseño Yield Control (portados de components/bundle.js).
import { useState, type KeyboardEvent, type ButtonHTMLAttributes, type FormEvent, type ReactNode } from 'react';

const cx = (...c: unknown[]) => c.filter(Boolean).join(' ');

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary: una vez por vista. secondary: por defecto. quiet: acciones de fila. */
  variant?: 'primary' | 'secondary' | 'quiet';
}
export function Button({ variant = 'secondary', className, ...rest }: ButtonProps) {
  return <button type="button" {...rest} className={cx('yc-btn', `yc-btn-${variant}`, className)} />;
}

export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'neutral';
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`yc-badge yc-badge-${tone}`}>{children}</span>;
}

export interface SelectOption { value: string; label: string }
export function Select({ label, options, value, onChange, disabled, name }: {
  label?: string; options: (string | SelectOption)[]; value?: string;
  onChange?: (v: string) => void; disabled?: boolean; name?: string;
}) {
  const opts = options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }));
  return (
    <label className="yc-field">
      {label}
      <select className="yc-input yc-select" name={name} value={value} disabled={disabled} onChange={(e) => onChange?.(e.target.value)}>
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export const STEPS = ['Carga de datos', 'Comparación', 'Validación', 'Match', 'Muestra'];
export function PipelineNav({ steps = STEPS, current = 0, done, extra = ['Gráficos', 'Historial'], active, title = 'Yield Control', onSelect, children }: {
  steps?: string[]; current?: number; extra?: string[]; active?: string | null; title?: string;
  /** Qué pasos están hechos de verdad (✓). Sin esto, se marcan los anteriores a `current`. */
  done?: boolean[];
  onSelect?: (target: number | string) => void; children?: ReactNode;
}) {
  return (
    <nav className="yc-nav" aria-label="Menú principal">
      <button type="button" className="yc-nav-mark" onClick={() => onSelect?.(-1)}>{title}</button>
      <ol className="yc-steps">
        {steps.map((s, i) => {
          const st = i === current ? 'current' : (done ? done[i] : i < current) ? 'done' : 'todo';
          return (
            <li key={s} className={`yc-step yc-step-${st}`}>
              <button type="button" aria-current={st === 'current' ? 'step' : undefined} onClick={() => onSelect?.(i)}>
                <span className="yc-step-n" aria-hidden>{st === 'done' ? '✓' : i + 1}</span>{s}
              </button>
            </li>
          );
        })}
      </ol>
      <div className="yc-nav-extra">
        {extra.map((x) => (
          <button key={x} type="button" className={cx('yc-nav-link', active === x && 'is-active')} aria-current={active === x ? 'page' : undefined} onClick={() => onSelect?.(x)}>{x}</button>
        ))}
        {children}
      </div>
    </nav>
  );
}

export type Period = 'dia' | 'semana' | 'mes';
export interface PeriodOption { id: Period; label: string; hint?: string }
const PERIODS: PeriodOption[] = [
  { id: 'dia', label: 'Día', hint: 'Qué cambió y cómo influye' },
  { id: 'semana', label: 'Semana', hint: 'Por tipo de archivo' },
  { id: 'mes', label: 'Mes', hint: 'Corrida completa / rango ampliado' },
];
export function PeriodTabs({ options = PERIODS, value, defaultValue = 'semana', onChange }: {
  options?: PeriodOption[]; value?: Period; defaultValue?: Period; onChange?: (v: Period) => void;
}) {
  const [own, setOwn] = useState(defaultValue);
  const val = value ?? own;
  return (
    <div className="yc-period" role="radiogroup" aria-label="Periodo">
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={o.id === val} className={cx('yc-period-opt', o.id === val && 'is-on')}
          onClick={() => { setOwn(o.id); onChange?.(o.id); }}>
          <span className="yc-period-label">{o.label}</span>
          <span className="yc-period-hint">{o.hint}</span>
        </button>
      ))}
    </div>
  );
}

export type FileStatus = 'empty' | 'loaded' | 'comparing' | 'error';
const FILE_STATUS: Record<FileStatus, [string, Tone]> = {
  empty: ['Sin cargar', 'neutral'], loaded: ['Cargado', 'ok'], comparing: ['En comparación', 'info'], error: ['Error', 'bad'],
};
/** Con onFile es la zona de carga (clic o arrastrar y soltar). Sin onFile solo muestra el estado. */
export function FileChip({ type, status = 'empty', meta, onFile, accept }: {
  type: string; status?: FileStatus; meta?: string; onFile?: (file: File) => void; accept?: string;
}) {
  const [over, setOver] = useState(false);
  const [text, tone] = FILE_STATUS[status];
  const chip = (
    <div className={cx('yc-file', `yc-file-${status}`, onFile && 'yc-file-drop', over && 'is-over')}>
      <span className="yc-file-type">{type}</span>
      <Badge tone={tone}>{text}</Badge>
      <span className="yc-file-meta">{meta || 'Arrastra el archivo o haz clic para cargar'}</span>
    </div>
  );
  if (!onFile) return chip;
  const take = (list: FileList | null) => { if (list?.[0]) onFile(list[0]); };
  return (
    <label className="yc-file-label" onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}>
      <input type="file" className="yc-sr-only" accept={accept} aria-label={`Cargar ${type}`} onChange={(e) => { take(e.target.files); e.target.value = ''; }} />
      {chip}
    </label>
  );
}

export function KpiTile({ label, value, unit, delta, deltaUnit = '', good = true }: {
  label: string; value: ReactNode; unit?: string; delta?: number; deltaUnit?: string; good?: boolean;
}) {
  return (
    <div className="yc-kpi">
      <span className="yc-kpi-label">{label}</span>
      <span className="yc-kpi-value">{value}{unit && <span className="yc-kpi-unit">{unit}</span>}</span>
      {delta != null && (
        <span className={cx('yc-kpi-delta', good ? 'is-good' : 'is-bad')}>
          {(delta > 0 ? '▲ ' : delta < 0 ? '▼ ' : '') + Math.abs(delta) + deltaUnit} vs. periodo anterior
        </span>
      )}
    </div>
  );
}

export interface CarouselSlide { kind: string; title: string; content: ReactNode }
export function ChartCarousel({ slides, label = 'Gráficas' }: { slides: CarouselSlide[]; label?: string }) {
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState<'next' | 'prev'>('next'); // de qué lado entra la gráfica nueva
  const n = slides.length;
  if (!n) return null;
  const i = Math.min(idx, n - 1);
  const go = (k: number) => { setDir(k < i ? 'prev' : 'next'); setIdx((k + n) % n); };
  const keys = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') go(i + 1); if (e.key === 'ArrowLeft') go(i - 1); };
  return (
    <section className="yc-carousel" aria-roledescription="carrusel" aria-label={label} onKeyDown={keys}>
      <header className="yc-carousel-head">
        <div>
          <span className="yc-carousel-kind">{slides[i].kind}</span>
          <h3 className="yc-carousel-title">{slides[i].title}</h3>
        </div>
        <div className="yc-carousel-ctrl">
          <button type="button" className="yc-icon-btn" aria-label="Gráfica anterior" onClick={() => go(i - 1)}>‹</button>
          <span className="yc-carousel-count" aria-live="polite">{i + 1} / {n}</span>
          <button type="button" className="yc-icon-btn" aria-label="Gráfica siguiente" onClick={() => go(i + 1)}>›</button>
        </div>
      </header>
      <div key={i} className={`yc-carousel-body is-${dir}`}>{slides[i].content}</div>
      <div className="yc-carousel-dots">
        {slides.map((s, k) => (
          <button key={k} type="button" aria-label={s.title} aria-current={k === i ? 'true' : undefined} className={cx('yc-dot', k === i && 'is-on')} onClick={() => go(k)} />
        ))}
      </div>
    </section>
  );
}

export interface HistoryItem { type: string; name: string; period: string; date: string }
export function HistoryList({ items, title = 'Historial de la sesión', onBackup, onCompare }: {
  items: HistoryItem[]; title?: string; onBackup?: () => void; onCompare?: (it: HistoryItem) => void;
}) {
  return (
    <section className="yc-history">
      <header className="yc-history-head">
        <h3>{title}</h3>
        <Button onClick={onBackup} disabled={!items.length}>Generar respaldo</Button>
      </header>
      {items.length ? (
        <ul className="yc-history-list">
          {items.map((it, k) => (
            <li key={k} className="yc-history-row">
              <span className="yc-history-type">{it.type}</span>
              <span className="yc-history-name" title={it.name}>{it.name}</span>
              <span className="yc-history-meta">{it.period} · {it.date}</span>
              <Button variant="quiet" onClick={() => onCompare?.(it)}>Comparar</Button>
            </li>
          ))}
        </ul>
      ) : <p className="yc-empty">Aún no hay archivos cargados en esta sesión.</p>}
    </section>
  );
}

export type LoginMode = 'login' | 'signup' | 'code';
export function LoginPanel({ defaultOpen = false, defaultMode = 'login', signup = true, error, title = 'Yield Control', onSubmit, children, backdrop }: {
  defaultOpen?: boolean; defaultMode?: LoginMode; signup?: boolean; error?: string; title?: string;
  onSubmit?: (mode: LoginMode, data: FormData) => void;
  /** Avisos debajo del formulario, en `.yc-login-hint`. */
  children?: ReactNode;
  /** Ilustración decorativa detrás del formulario (oculta a lectores de pantalla). */
  backdrop?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [mode, setMode] = useState<LoginMode>(defaultMode);
  const login = mode !== 'signup', code = mode === 'code';
  const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); onSubmit?.(mode, new FormData(e.currentTarget)); };
  return (
    <div className={cx('yc-login', open && 'is-open')}>
      {backdrop && <div className="yc-login-backdrop" aria-hidden>{backdrop}</div>}
      <aside className="yc-login-panel" id="yc-login-about" aria-hidden={!open}>
        <span className="yc-nav-mark">{title}</span>
        <h2>Qué hace la aplicación</h2>
        <ul>
          <li>Carga TCQS, DATA ANALYSIS y QM por día, semana o mes.</li>
          <li>Compara, valida y hace match entre los archivos.</li>
          <li>Pareto de 1er y 2do nivel, histogramas y dispersión.</li>
          <li>Historial de la sesión con respaldo.</li>
        </ul>
      </aside>
      <button type="button" className="yc-login-toggle" aria-expanded={open} aria-controls="yc-login-about" onClick={() => setOpen(!open)}>
        {open ? '‹ Ocultar' : '¿Qué es Yield Control? ›'}
      </button>
      <div className="yc-login-main">
        <form className="yc-login-form" onSubmit={submit}>
          <h2>{code ? 'Código de verificación' : login ? 'Iniciar sesión' : 'Crear cuenta'}</h2>
          {code ? (
            <label>Código de 6 dígitos de tu app autenticadora
              <input className="yc-input yc-code" name="code" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" autoFocus />
            </label>
          ) : (
            <>
              <label>Usuario o correo<input className="yc-input" name="user" required autoComplete="username" /></label>
              <label>Contraseña<input className="yc-input" name="password" type="password" required autoComplete={login ? 'current-password' : 'new-password'} /></label>
            </>
          )}
          {error && <p className="yc-login-note" role="alert"><Badge tone="bad">Error</Badge>{error}</p>}
          {mode === 'signup' && <p className="yc-login-note"><Badge tone="info">Pendiente</Badge>El encargado de la aplicación valida cada cuenta nueva antes de dar acceso.</p>}
          <Button variant="primary" type="submit">{code ? 'Verificar' : login ? 'Entrar' : 'Solicitar cuenta'}</Button>
          {!code && signup && (
            <button type="button" className="yc-link" onClick={() => setMode(login ? 'signup' : 'login')}>
              {login ? 'Crear nueva cuenta' : 'Ya tengo cuenta'}
            </button>
          )}
        </form>
        {children}
      </div>
    </div>
  );
}
