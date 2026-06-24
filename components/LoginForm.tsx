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
    <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center">
      <div className="w-full max-w-sm border border-[#141414] bg-white/60 p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 border border-[#141414] mb-4">
            <Lock size={20} />
          </div>
          <h1 className="text-xl font-bold uppercase tracking-tighter italic font-serif">
            MRS Result System
          </h1>
          <p className="text-[10px] uppercase tracking-widest opacity-40 mt-1">
            Master Racing Series • Acceso Admin
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-transparent border border-[#141414] p-3 text-sm focus:outline-none"
            autoFocus
          />
          {error && (
            <p className="text-red-600 text-xs uppercase tracking-widest">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-[#141414] text-[#E4E3E0] py-3 text-xs uppercase tracking-widest font-bold hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
