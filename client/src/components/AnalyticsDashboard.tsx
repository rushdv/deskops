import React from 'react';
import { AnalyticsSummary, RoleName, TicketPriority, TicketStatus } from '../types';

interface AnalyticsDashboardProps {
  summary: AnalyticsSummary | null;
  userRole?: RoleName;
  loading?: boolean;
}

const STATUS_ORDER: TicketStatus[] = [
  'NEW',
  'TRIAGED',
  'ASSIGNED',
  'IN_PROGRESS',
  'ON_HOLD',
  'RESOLVED',
  'CLOSED',
];

const PRIORITY_ORDER: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const PRIORITY_COLORS: Record<TicketPriority, { bar: string; text: string; bg: string }> = {
  LOW: { bar: '#64748b', text: '#334155', bg: '#f1f5f9' },
  MEDIUM: { bar: '#2563eb', text: '#1d4ed8', bg: '#eff6ff' },
  HIGH: { bar: '#ea580c', text: '#c2410c', bg: '#fff7ed' },
  URGENT: { bar: '#dc2626', text: '#b91c1c', bg: '#fef2f2' },
};

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  summary,
  userRole,
  loading = false,
}) => {
  if (loading && !summary) {
    return (
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          color: '#64748b',
          fontSize: '0.875rem',
        }}
      >
        Loading analytics summary...
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  const totalForBars = Math.max(summary.totals.totalTickets, 1);

  return (
    <section
      aria-label="Analytics Summary Dashboard"
      style={{
        marginBottom: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '1rem',
        }}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '1.1rem 1.25rem',
          }}
        >
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b' }}>
            Total Tickets
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', marginTop: '0.25rem' }}>
            {summary.totals.totalTickets}
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '1.1rem 1.25rem',
          }}
        >
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1d4ed8' }}>
            Active Work in Progress
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#2563eb', marginTop: '0.25rem' }}>
            {summary.totals.activeWorkInProgress}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' }}>
            Assigned &amp; In Progress
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '1.1rem 1.25rem',
          }}
        >
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#15803d' }}>
            Resolved / Closed
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#16a34a', marginTop: '0.25rem' }}>
            {summary.totals.resolvedOrClosed}
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '1.1rem 1.25rem',
          }}
        >
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#b45309' }}>
            Pending Triage
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#d97706', marginTop: '0.25rem' }}>
            {summary.totals.pendingTriage}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' }}>
            New &amp; Triaged queue
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1rem',
        }}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '1.15rem 1.25rem',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: '0.85rem', color: '#0f172a' }}>
            Tickets by Status
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            {STATUS_ORDER.map((status) => {
              const count = summary.byStatus[status] ?? 0;
              const pct = Math.round((count / totalForBars) * 100);
              return (
                <div key={status}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.78rem',
                      marginBottom: '0.2rem',
                    }}
                  >
                    <span style={{ fontWeight: 600, color: '#334155' }}>
                      {status.replace('_', ' ')}
                    </span>
                    <span style={{ color: '#475569', fontWeight: 600 }}>
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div
                    style={{
                      height: '7px',
                      backgroundColor: '#f1f5f9',
                      borderRadius: '9999px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        backgroundColor: '#2563eb',
                        borderRadius: '9999px',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '1.15rem 1.25rem',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: '0.85rem', color: '#0f172a' }}>
            Tickets by Priority
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            {PRIORITY_ORDER.map((priority) => {
              const count = summary.byPriority[priority] ?? 0;
              const pct = Math.round((count / totalForBars) * 100);
              const palette = PRIORITY_COLORS[priority];
              return (
                <div key={priority}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.78rem',
                      marginBottom: '0.25rem',
                    }}
                  >
                    <span
                      style={{
                        backgroundColor: palette.bg,
                        color: palette.text,
                        padding: '0.15rem 0.55rem',
                        borderRadius: '9999px',
                        fontWeight: 700,
                        fontSize: '0.72rem',
                      }}
                    >
                      {priority}
                    </span>
                    <span style={{ color: '#475569', fontWeight: 600 }}>
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div
                    style={{
                      height: '8px',
                      backgroundColor: '#f1f5f9',
                      borderRadius: '9999px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        backgroundColor: palette.bar,
                        borderRadius: '9999px',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {userRole === 'ORGANISATION_ADMIN' && (
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '1.15rem 1.25rem',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: '0.75rem', color: '#0f172a' }}>
            Technician Active Workload
          </div>
          {summary.technicianWorkload.length === 0 ? (
            <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
              No active assigned or in-progress tickets right now.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '0.5rem 0.6rem' }}>Technician</th>
                  <th style={{ padding: '0.5rem 0.6rem' }}>Email</th>
                  <th style={{ padding: '0.5rem 0.6rem', textAlign: 'right' }}>Active Tickets</th>
                </tr>
              </thead>
              <tbody>
                {summary.technicianWorkload.map((row) => (
                  <tr key={row.technicianId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.55rem 0.6rem', fontWeight: 600, color: '#0f172a' }}>
                      {row.technicianName}
                    </td>
                    <td style={{ padding: '0.55rem 0.6rem', color: '#64748b' }}>
                      {row.technicianEmail}
                    </td>
                    <td style={{ padding: '0.55rem 0.6rem', textAlign: 'right' }}>
                      <span
                        style={{
                          backgroundColor: '#eff6ff',
                          color: '#1d4ed8',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '9999px',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                        }}
                      >
                        {row.activeCount}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
};
