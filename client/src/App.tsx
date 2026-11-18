import React, { useEffect, useState } from 'react';
import { checkBackendHealth } from './services/health.service';
import { BackendHealth } from './types';

export const App: React.FC = () => {
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkBackendHealth()
      .then((data) => {
        setHealth(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to reach backend');
        setLoading(false);
      });
  }, []);

  return (
    <div style={{
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#f8fafc',
      color: '#0f172a',
      padding: '2rem',
    }}>
      <div style={{
        maxWidth: '560px',
        width: '100%',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '2.5rem',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        border: '1px solid #e2e8f0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            backgroundColor: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '1.25rem',
          }}>
            D
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>DeskOps</h1>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
              Phase 1: Ticketing Core &mdash; Initial Scaffolding
            </p>
          </div>
        </div>

        <p style={{ color: '#334155', lineHeight: '1.6', marginBottom: '1.5rem' }}>
          The project foundation has been initialized with React, Vite, TypeScript, and Express.
        </p>

        <div style={{
          backgroundColor: '#f1f5f9',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem',
          fontSize: '0.875rem',
        }}>
          <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: '#1e293b' }}>
            Backend Connection Status:
          </div>
          {loading && <div style={{ color: '#64748b' }}>Checking /health endpoint...</div>}
          {error && (
            <div style={{ color: '#dc2626' }}>
              &#x2717; {error} (Ensure backend server is running on port 5000)
            </div>
          )}
          {health && (
            <div style={{ color: '#16a34a' }}>
              &#x2713; Status: <strong>{health.status}</strong> | Environment: <strong>{health.environment}</strong>
            </div>
          )}
        </div>

        <div style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center' }}>
          DeskOps Engineering Foundation &bull; LogicVeda Internship Programme
        </div>
      </div>
    </div>
  );
};

export default App;
