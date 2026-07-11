'use client';

import { useState } from 'react';
import { Loader2, Lock } from 'lucide-react';

interface LoginFormProps {
  onLogin: () => void;
}

export default function LoginForm({ onLogin }: LoginFormProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Error al iniciar sesión');
      } else {
        onLogin();
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="h-1 bg-accent" />
        <div className="border border-ink border-t-0 bg-paper-raised p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 border border-ink mb-4">
              <Lock size={20} />
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tight italic">
              MRS Result System
            </h1>
            <p className="text-[11px] uppercase tracking-[0.25em] opacity-50 mt-1">
              Master Racing Series
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              placeholder="Contraseña de administrador"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent border border-ink p-3 text-sm focus:outline-none focus:border-accent transition-colors"
              autoFocus
            />
            {error && (
              <p className="text-accent text-sm font-semibold">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-ink text-paper py-3 text-sm uppercase tracking-[0.2em] font-bold hover:bg-accent disabled:opacity-40 disabled:hover:bg-ink transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
