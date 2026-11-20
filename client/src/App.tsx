import React, { useEffect, useState } from 'react';
import { api, setAuthToken } from './services/api.service';
import { Ticket, Property, TechnicianSummary, UserSession, TicketStatus, TicketPriority } from './types';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Modals & form state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showTriageModal, setShowTriageModal] = useState<Ticket | null>(null);
  const [showAssignModal, setShowAssignModal] = useState<Ticket | null>(null);
  const [showResolveModal, setShowResolveModal] = useState<Ticket | null>(null);
  const [showTimelineModal, setShowTimelineModal] = useState<Ticket | null>(null);

  // Form inputs
  const [newTicket, setNewTicket] = useState({
    propertyId: '',
    unitId: '',
    title: '',
    description: '',
    category: 'Plumbing',
    priority: 'MEDIUM',
  });
  const [triageData, setTriageData] = useState({ category: 'Plumbing', priority: 'HIGH' });
  const [selectedTechId, setSelectedTechId] = useState<string>('');
  const [resolutionNotes, setResolutionNotes] = useState<string>('');

  const loginAs = async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.login(email, 'Password123!');
      setCurrentUser(data.user);
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setAuthToken(null);
    setCurrentUser(null);
    setTickets([]);
  };

  const refreshData = async () => {
    try {
      const [ticketsData, propsData] = await Promise.all([
        api.getTickets(),
        api.getProperties(),
      ]);
      setTickets(ticketsData);
      setProperties(propsData);

      if (propsData.length > 0 && propsData[0].units.length > 0) {
        setNewTicket((prev) => ({
          ...prev,
          propertyId: prev.propertyId || propsData[0].id,
          unitId: prev.unitId || propsData[0].units[0].id,
        }));
      }

      // If admin, load technicians too
      try {
        const techs = await api.getTechnicians();
        setTechnicians(techs);
        if (techs.length > 0) setSelectedTechId(techs[0].id);
      } catch {
        // Not admin
      }
    } catch (err) {
      console.error('Failed to refresh data', err);
    }
  };

  // Initial check or default login
  useEffect(() => {
    loginAs('admin@greenfield.com');
  }, []);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.createTicket(newTicket);
      setShowCreateModal(false);
      setNewTicket({ ...newTicket, title: '', description: '' });
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create ticket failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTriageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showTriageModal) return;
    try {
      setLoading(true);
      await api.triageTicket(showTriageModal.id, triageData);
      setShowTriageModal(null);
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Triage failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAssignModal) return;
    try {
      setLoading(true);
      await api.assignTicket(showAssignModal.id, selectedTechId);
      setShowAssignModal(null);
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assignment failed');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (ticketId: string, status: TicketStatus, notes?: string) => {
    try {
      setLoading(true);
      await api.updateTicketStatus(ticketId, status, notes);
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed');
    } finally {
      setLoading(false);
    }
  };

  const viewTimeline = async (ticket: Ticket) => {
    try {
      const detail = await api.getTicketDetail(ticket.id);
      setShowTimelineModal(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to view timeline');
    }
  };

  const getStatusBadge = (status: TicketStatus) => {
    const styles: Record<TicketStatus, { bg: string; color: string }> = {
      NEW: { bg: '#e0f2fe', color: '#0369a1' },
      TRIAGED: { bg: '#fef3c7', color: '#b45309' },
      ASSIGNED: { bg: '#ede9fe', color: '#6d28d9' },
      IN_PROGRESS: { bg: '#dbeafe', color: '#1d4ed8' },
      ON_HOLD: { bg: '#ffedd5', color: '#c2410c' },
      RESOLVED: { bg: '#dcfce7', color: '#15803d' },
      CLOSED: { bg: '#f1f5f9', color: '#475569' },
    };
    const s = styles[status] || { bg: '#f1f5f9', color: '#334155' };
    return (
      <span style={{
        backgroundColor: s.bg,
        color: s.color,
        padding: '0.25rem 0.6rem',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: 600,
        textTransform: 'uppercase',
      }}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  const getPriorityBadge = (priority: TicketPriority) => {
    const colors: Record<TicketPriority, string> = {
      LOW: '#64748b',
      MEDIUM: '#2563eb',
      HIGH: '#ea580c',
      URGENT: '#dc2626',
    };
    return (
      <span style={{ color: colors[priority] || '#64748b', fontWeight: 600, fontSize: '0.8rem' }}>
        &bull; {priority}
      </span>
    );
  };

  return (
    <div style={{
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      backgroundColor: '#f8fafc',
      minHeight: '100vh',
      color: '#0f172a',
    }}>
      {/* Top Navbar */}
      <header style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            backgroundColor: '#2563eb',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '1.2rem',
          }}>
            D
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.02em' }}>
              DeskOps
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Greenfield Facilities &bull; Phase 1 Core
            </div>
          </div>
        </div>

        {/* Demo Role Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>
            Switch Persona:
          </span>
          <button
            onClick={() => loginAs('admin@greenfield.com')}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: '6px',
              border: currentUser?.email === 'admin@greenfield.com' ? '2px solid #2563eb' : '1px solid #cbd5e1',
              backgroundColor: currentUser?.email === 'admin@greenfield.com' ? '#eff6ff' : '#ffffff',
              color: '#1e293b',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.75rem',
            }}
          >
            👤 Alice Admin
          </button>
          <button
            onClick={() => loginAs('tech@greenfield.com')}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: '6px',
              border: currentUser?.email === 'tech@greenfield.com' ? '2px solid #2563eb' : '1px solid #cbd5e1',
              backgroundColor: currentUser?.email === 'tech@greenfield.com' ? '#eff6ff' : '#ffffff',
              color: '#1e293b',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.75rem',
            }}
          >
            🛠️ Bob Technician
          </button>
          <button
            onClick={() => loginAs('resident@greenfield.com')}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: '6px',
              border: currentUser?.email === 'resident@greenfield.com' ? '2px solid #2563eb' : '1px solid #cbd5e1',
              backgroundColor: currentUser?.email === 'resident@greenfield.com' ? '#eff6ff' : '#ffffff',
              color: '#1e293b',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.75rem',
            }}
          >
            🏠 Rachel Resident
          </button>
          {currentUser && (
            <button
              onClick={logout}
              style={{
                padding: '0.4rem 0.6rem',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
                color: '#64748b',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.75rem',
              }}
            >
              Sign Out
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1.5rem' }}>
        {error && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            fontSize: '0.875rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span>{error}</span>
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>&times;</button>
          </div>
        )}

        {/* Header Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>
              {currentUser?.role === 'ORGANISATION_ADMIN' && 'Admin Service Desk & Triage'}
              {currentUser?.role === 'TECHNICIAN' && 'Technician Workbench'}
              {currentUser?.role === 'RESIDENT' && 'Resident Maintenance Portal'}
            </h2>
            <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.875rem' }}>
              Logged in as <strong>{currentUser?.name}</strong> ({currentUser?.role}) &bull; Tenant: Greenfield Facilities
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={refreshData}
              disabled={loading}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            >
              🔄 Refresh
            </button>
            {(currentUser?.role === 'RESIDENT' || currentUser?.role === 'ORGANISATION_ADMIN') && (
              <button
                onClick={() => setShowCreateModal(true)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                }}
              >
                + New Request
              </button>
            )}
          </div>
        </div>

        {/* Tickets Table / Cards */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
          overflow: 'hidden',
        }}>
          {tickets.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              No tickets found for this persona.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '0.875rem 1rem' }}>Ticket</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Title & Description</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Location</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.875rem 1rem' }}>Assignee</th>
                  <th style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '1rem', fontWeight: 600, color: '#2563eb' }}>
                      {t.ticketNumber}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{t.title}</div>
                      <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                        Category: <strong>{t.category}</strong> {getPriorityBadge(t.priority)}
                      </div>
                      <div style={{ color: '#475569', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                        {t.description}
                      </div>
                    </td>
                    <td style={{ padding: '1rem', color: '#334155' }}>
                      <div>{t.property.name}</div>
                      <div style={{ color: '#64748b', fontSize: '0.8rem' }}>{t.unit.unitNumber}</div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {getStatusBadge(t.status)}
                    </td>
                    <td style={{ padding: '1rem', color: '#334155' }}>
                      {t.assignedTechnician ? (
                        <span style={{ fontWeight: 500 }}>🛠️ {t.assignedTechnician.name}</span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Unassigned</span>
                      )}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                        {/* Admin Action 1: Triage */}
                        {currentUser?.role === 'ORGANISATION_ADMIN' && t.status === 'NEW' && (
                          <button
                            onClick={() => {
                              setShowTriageModal(t);
                              setTriageData({ category: t.category, priority: t.priority });
                            }}
                            style={{
                              padding: '0.3rem 0.6rem',
                              borderRadius: '4px',
                              border: '1px solid #b45309',
                              backgroundColor: '#fef3c7',
                              color: '#92400e',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Triage
                          </button>
                        )}

                        {/* Admin Action 2: Assign */}
                        {currentUser?.role === 'ORGANISATION_ADMIN' && t.status === 'TRIAGED' && (
                          <button
                            onClick={() => setShowAssignModal(t)}
                            style={{
                              padding: '0.3rem 0.6rem',
                              borderRadius: '4px',
                              border: '1px solid #6d28d9',
                              backgroundColor: '#ede9fe',
                              color: '#5b21b6',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Assign Tech
                          </button>
                        )}

                        {/* Technician Action 1: Start Work */}
                        {currentUser?.role === 'TECHNICIAN' && t.status === 'ASSIGNED' && (
                          <button
                            onClick={() => handleStatusChange(t.id, 'IN_PROGRESS')}
                            style={{
                              padding: '0.3rem 0.6rem',
                              borderRadius: '4px',
                              backgroundColor: '#2563eb',
                              color: '#ffffff',
                              border: 'none',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Start Work
                          </button>
                        )}

                        {/* Technician Action 2: Put on Hold */}
                        {currentUser?.role === 'TECHNICIAN' && t.status === 'IN_PROGRESS' && (
                          <button
                            onClick={() => handleStatusChange(t.id, 'ON_HOLD', 'Waiting on replacement parts')}
                            style={{
                              padding: '0.3rem 0.6rem',
                              borderRadius: '4px',
                              border: '1px solid #c2410c',
                              backgroundColor: '#ffedd5',
                              color: '#9a3412',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Hold
                          </button>
                        )}

                        {/* Technician Action 3: Resume Work */}
                        {currentUser?.role === 'TECHNICIAN' && t.status === 'ON_HOLD' && (
                          <button
                            onClick={() => handleStatusChange(t.id, 'IN_PROGRESS', 'Parts arrived; work resumed')}
                            style={{
                              padding: '0.3rem 0.6rem',
                              borderRadius: '4px',
                              backgroundColor: '#2563eb',
                              color: '#ffffff',
                              border: 'none',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Resume
                          </button>
                        )}

                        {/* Technician Action 4: Resolve */}
                        {currentUser?.role === 'TECHNICIAN' && t.status === 'IN_PROGRESS' && (
                          <button
                            onClick={() => {
                              setShowResolveModal(t);
                              setResolutionNotes('Work verified and resolved.');
                            }}
                            style={{
                              padding: '0.3rem 0.6rem',
                              borderRadius: '4px',
                              backgroundColor: '#16a34a',
                              color: '#ffffff',
                              border: 'none',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Resolve
                          </button>
                        )}

                        {/* Resident Action: Close or Reopen */}
                        {currentUser?.role === 'RESIDENT' && t.status === 'RESOLVED' && (
                          <>
                            <button
                              onClick={() => handleStatusChange(t.id, 'CLOSED', 'Resident approved resolution')}
                              style={{
                                padding: '0.3rem 0.6rem',
                                borderRadius: '4px',
                                backgroundColor: '#16a34a',
                                color: '#ffffff',
                                border: 'none',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Approve & Close
                            </button>
                            <button
                              onClick={() => handleStatusChange(t.id, 'IN_PROGRESS', 'Resident requested reopen')}
                              style={{
                                padding: '0.3rem 0.6rem',
                                borderRadius: '4px',
                                border: '1px solid #dc2626',
                                backgroundColor: '#fef2f2',
                                color: '#b91c1c',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Reopen
                            </button>
                          </>
                        )}

                        {/* Timeline Audit Viewer */}
                        <button
                          onClick={() => viewTimeline(t)}
                          style={{
                            padding: '0.3rem 0.6rem',
                            borderRadius: '4px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#ffffff',
                            color: '#475569',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          📜 Timeline
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* --- MODAL 1: Create Ticket --- */}
      {showCreateModal && (
        <div style={modalBackdropStyle}>
          <div style={modalContentStyle}>
            <h3 style={{ margin: '0 0 1rem 0' }}>Submit New Maintenance Request</h3>
            <form onSubmit={handleCreateTicket}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Property</label>
                <select
                  value={newTicket.propertyId}
                  onChange={(e) => {
                    const prop = properties.find((p) => p.id === e.target.value);
                    setNewTicket({
                      ...newTicket,
                      propertyId: e.target.value,
                      unitId: prop?.units[0]?.id || '',
                    });
                  }}
                  style={inputStyle}
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Unit Number</label>
                <select
                  value={newTicket.unitId}
                  onChange={(e) => setNewTicket({ ...newTicket, unitId: e.target.value })}
                  style={inputStyle}
                >
                  {properties.find((p) => p.id === newTicket.propertyId)?.units.map((u) => (
                    <option key={u.id} value={u.id}>{u.unitNumber}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Category</label>
                <select
                  value={newTicket.category}
                  onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}
                  style={inputStyle}
                >
                  <option value="Plumbing">Plumbing</option>
                  <option value="Electrical">Electrical</option>
                  <option value="HVAC">HVAC</option>
                  <option value="Carpentry">Carpentry</option>
                  <option value="General">General Maintenance</option>
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Request Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Water leak under bathroom sink"
                  value={newTicket.title}
                  onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>Description</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Please provide details of the issue..."
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={secondaryBtnStyle}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={primaryBtnStyle}
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: Triage Ticket --- */}
      {showTriageModal && (
        <div style={modalBackdropStyle}>
          <div style={modalContentStyle}>
            <h3 style={{ margin: '0 0 1rem 0' }}>Triage Ticket: {showTriageModal.ticketNumber}</h3>
            <form onSubmit={handleTriageSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Assigned Category</label>
                <select
                  value={triageData.category}
                  onChange={(e) => setTriageData({ ...triageData, category: e.target.value })}
                  style={inputStyle}
                >
                  <option value="Plumbing">Plumbing</option>
                  <option value="Electrical">Electrical</option>
                  <option value="HVAC">HVAC</option>
                  <option value="Carpentry">Carpentry</option>
                  <option value="General">General Maintenance</option>
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>Priority Level</label>
                <select
                  value={triageData.priority}
                  onChange={(e) => setTriageData({ ...triageData, priority: e.target.value })}
                  style={inputStyle}
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="URGENT">URGENT</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowTriageModal(null)}
                  style={secondaryBtnStyle}
                >
                  Cancel
                </button>
                <button type="submit" disabled={loading} style={primaryBtnStyle}>
                  Confirm Triage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 3: Assign Technician --- */}
      {showAssignModal && (
        <div style={modalBackdropStyle}>
          <div style={modalContentStyle}>
            <h3 style={{ margin: '0 0 1rem 0' }}>Assign Technician: {showAssignModal.ticketNumber}</h3>
            <form onSubmit={handleAssignSubmit}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>Select Field Technician</label>
                <select
                  value={selectedTechId}
                  onChange={(e) => setSelectedTechId(e.target.value)}
                  style={inputStyle}
                >
                  {technicians.map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      {tech.name} ({tech.email}) &bull; Skills: {tech.technicianProfile?.skills.map((s) => s.skill).join(', ') || 'General'}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAssignModal(null)}
                  style={secondaryBtnStyle}
                >
                  Cancel
                </button>
                <button type="submit" disabled={loading} style={primaryBtnStyle}>
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 4: Resolve Notes --- */}
      {showResolveModal && (
        <div style={modalBackdropStyle}>
          <div style={modalContentStyle}>
            <h3 style={{ margin: '0 0 1rem 0' }}>Resolve Ticket: {showResolveModal.ticketNumber}</h3>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={labelStyle}>Resolution Notes</label>
              <textarea
                rows={3}
                required
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setShowResolveModal(null)}
                style={secondaryBtnStyle}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleStatusChange(showResolveModal.id, 'RESOLVED', resolutionNotes);
                  setShowResolveModal(null);
                }}
                disabled={loading}
                style={{ ...primaryBtnStyle, backgroundColor: '#16a34a' }}
              >
                Mark as Resolved
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 5: Audit Event Timeline --- */}
      {showTimelineModal && (
        <div style={modalBackdropStyle}>
          <div style={{ ...modalContentStyle, maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>
                Timeline: {showTimelineModal.ticketNumber}
              </h3>
              <button
                onClick={() => setShowTimelineModal(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>
            <div style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              {showTimelineModal.title} &bull; Property: <strong>{showTimelineModal.property.name}</strong>
            </div>

            <div style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '0.5rem' }}>
              {showTimelineModal.events?.map((ev, idx) => (
                <div
                  key={ev.id}
                  style={{
                    position: 'relative',
                    paddingLeft: '1.5rem',
                    paddingBottom: '1.25rem',
                    borderLeft: idx === (showTimelineModal.events?.length || 0) - 1 ? 'none' : '2px solid #e2e8f0',
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    left: '-6px',
                    top: '2px',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: '#2563eb',
                  }} />
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {new Date(ev.createdAt).toLocaleString()} &bull; <strong>{ev.actor.name}</strong>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', marginTop: '0.2rem' }}>
                    {ev.eventType}
                    {ev.fromStatus && ev.toStatus && ` (${ev.fromStatus} → ${ev.toStatus})`}
                  </div>
                  {ev.metadata && (
                    <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.25rem', backgroundColor: '#f1f5f9', padding: '0.4rem', borderRadius: '4px' }}>
                      {JSON.stringify(ev.metadata)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const modalBackdropStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '1rem',
};

const modalContentStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  padding: '2rem',
  width: '100%',
  maxWidth: '480px',
  boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: '#334155',
  marginBottom: '0.4rem',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  borderRadius: '6px',
  border: '1px solid #cbd5e1',
  fontSize: '0.875rem',
  boxSizing: 'border-box',
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  backgroundColor: '#2563eb',
  color: '#ffffff',
  border: 'none',
  borderRadius: '6px',
  fontWeight: 600,
  fontSize: '0.875rem',
  cursor: 'pointer',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  backgroundColor: '#ffffff',
  color: '#475569',
  border: '1px solid #cbd5e1',
  borderRadius: '6px',
  fontWeight: 600,
  fontSize: '0.875rem',
  cursor: 'pointer',
};

export default App;
