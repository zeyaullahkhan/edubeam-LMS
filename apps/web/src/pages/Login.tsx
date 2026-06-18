import { useState } from 'react';
import { useAuth } from '../auth';
import { GLOBAL_STATS } from '../config/states';

export function Login() {
  const { login } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(false);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel — brand / hero ────────────────────────── */}
      <div
        className="hidden lg:flex flex-col w-[52%] relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #001240 0%, #003087 55%, #005BAA 100%)' }}
      >
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-sky-300/10 blur-3xl" />
        <div className="absolute bottom-0 -right-16 w-80 h-80 rounded-full bg-navy-600/40 blur-2xl" />
        <div className="absolute top-1/3 left-1/2 w-48 h-48 rounded-full bg-sky-400/8 blur-2xl" />

        <div className="relative z-10 flex flex-col h-full p-12">
          <div className="flex items-center gap-4">
            <div className="bg-white rounded-xl p-2 shadow-lg">
              <img src="/vepl-logo.png" alt="Edubeam" className="h-12 w-auto" />
            </div>
            <div>
              <div className="font-heading font-bold text-white text-2xl leading-none">Edubeam LMS</div>
              <div className="text-sky-300 text-xs uppercase tracking-widest mt-0.5">by Valuable Group</div>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center mt-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-sky-400/30 bg-sky-400/10 text-sky-300 text-xs font-semibold uppercase tracking-widest mb-6 self-start">
              <i className="fas fa-satellite-dish" />
              Government Schools Platform
            </div>
            <h1 className="font-heading font-bold text-white text-4xl leading-tight mb-4">
              Transforming Education<br />
              <span style={{ color: '#5BBCD8' }}>Through Technology</span>
            </h1>
            <p className="text-white/60 text-base leading-relaxed max-w-sm">
              Real-time monitoring and analytics for government schools across multiple states —
              Virtual Classrooms, ICT Labs, attendance, and board results in one platform.
            </p>

            <div className="grid grid-cols-2 gap-4 mt-10">
              {GLOBAL_STATS.map(({ value, label }) => (
                <div key={label} className="bg-white/8 rounded-xl p-4 border border-white/10 text-center">
                  <div className="font-heading font-bold text-white text-xl">{value}</div>
                  <div className="text-sky-300/80 text-xs mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between mt-auto pt-8 border-t border-white/10">
            <div className="flex items-center gap-3">
              <img src="/valuable-group-logo.png" alt="Valuable Group" className="h-8 w-auto bg-white rounded p-1" />
              <span className="text-white/40 text-xs">Valuable Group</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white/40 text-xs">Government Schools Platform</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel — login form ─────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 p-8">
        <div className="lg:hidden flex items-center gap-3 mb-10">
          <div className="bg-navy-600 rounded-xl p-2 shadow">
            <img src="/vepl-logo.png" alt="Edubeam" className="h-10 w-auto" />
          </div>
          <div>
            <div className="font-heading font-bold text-navy-700 text-xl">Edubeam LMS</div>
            <div className="text-slate-500 text-xs">by Valuable Group</div>
          </div>
        </div>

        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-brand-lg border border-slate-100 p-8">
            <div className="mb-7">
              <h2 className="font-heading font-bold text-navy-700 text-2xl">Sign in</h2>
              <p className="text-slate-500 text-sm mt-1">
                Access the Government Schools monitoring portal.
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-1.5">Email address</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <i className="fas fa-envelope text-xs" />
                  </span>
                  <input
                    type="email"
                    required
                    className="w-full border border-slate-200 rounded-lg pl-9 pr-4 py-2.5 text-sm
                               focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300
                               transition-colors bg-slate-50"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-1.5">Password</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <i className="fas fa-lock text-xs" />
                  </span>
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    className="w-full border border-slate-200 rounded-lg pl-9 pr-10 py-2.5 text-sm
                               focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300
                               transition-colors bg-slate-50"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                  >
                    <i className={`fas ${showPw ? 'fa-eye-slash' : 'fa-eye'} text-xs`} />
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2.5 rounded-lg">
                  <i className="fas fa-exclamation-circle" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="btn-primary w-full justify-center py-3 text-base mt-2"
              >
                {busy ? (
                  <><i className="fas fa-circle-notch fa-spin" />Signing in…</>
                ) : (
                  <><i className="fas fa-sign-in-alt" />Sign in to Dashboard</>
                )}
              </button>
            </form>

          </div>

          <p className="text-center text-xs text-slate-400 mt-6">
            © {new Date().getFullYear()} Valuable Edutainment Pvt. Ltd. · Edubeam LMS
          </p>
        </div>
      </div>
    </div>
  );
}
