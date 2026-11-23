import React, { useEffect, useState } from 'react';
import { api, setAuthToken } from './services/api.service';
import {
  AnalyticsSummary,
  CommentVisibility,
  NotificationItem,
  Property,
  TechnicianSummary,
  Ticket,
  TicketComment,
  TicketPriority,
  TicketStatus,
  UserSession,
} from './types';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSummary | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState<boolean>(false);
  const [showAnalyticsPanel, setShowAnalyticsPanel] = useState<boolean>(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [showNotificationsMenu, setShowNotificationsMenu] = useState<boolean>(false);

  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showTriageModal, setShowTriageModal] = useState<Ticket | null>(null);
  const [showAssignModal, setShowAssignModal] = useState<Ticket | null>(null);
  const [showResolveModal, setShowResolveModal] = useState<Ticket | null>(null);
  const [showTimelineModal, setShowTimelineModal] = useState<Ticket | null>(null);

  const [commentsModalTicket, setCommentsModalTicket] = useState<Ticket | null>(null);
  const [ticketComments, setTicketComments] = useState<TicketComment[]>([]);
  const [commentText, setCommentText] = useState<string>('');
  const [commentVisibility, setCommentVisibility] = useState<CommentVisibility>('PUBLIC');
  const [commentsLoading, setCommentsLoading] = useState<boolean>(false);

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

  const syncNotifications = async () => {
    try {
      const res = await api.getNotifications();
      setNotifications(res.items);
      setUnreadCount(res.unreadCount);
    } catch {
      // Ignore transient notification fetch errors on initial load
    }
  };

  const syncAnalytics = async (role?: UserSession['role']) => {
    if (role !== 'ORGANISATION_ADMIN' && role !== 'TECHNICIAN') {
      setAnalyticsSummary(null);
      return;
    }
    setAnalyticsLoading(true);
    try {
      const data = await api.getAnalyticsSummary();
      setAnalyticsSummary(data);
    } catch {
      setAnalyticsSummary(null);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const loginAs = async (email: string) => {
    setLoading(true);
    setError(null);
    setShowNotificationsMenu(false);
    try {
      const data = await api.login(email, 'Password123!');
      setCurrentUser(data.user);
      await refreshData(data.user);
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
    setAnalyticsSummary(null);
    setNotifications([]);
    setUnreadCount(0);
    setShowNotificationsMenu(false);
  };

  const refreshData = async (activeUser?: UserSession | null) => {
    const targetUser = activeUser ?? currentUser;
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

      if (targetUser?.role === 'ORGANISATION_ADMIN') {
        try {
          const techs = await api.getTechnicians();
          setTechnicians(techs);
          if (techs.length > 0) setSelectedTechId((prev) => prev || techs[0].id);
        } catch {
          // Not admin
        }
      }

      await Promise.all([
        syncAnalytics(targetUser?.role),
        syncNotifications(),
      ]);
    } catch (err) {
      console.error('Failed to refresh data', err);
    }
  };

  useEffect(() => {
    loginAs('admin@greenfield.com');
  }, []);

  const handleNotificationClick = async (item: NotificationItem) => {
    if (item.isRead) return;
    try {
      await api.markAsRead(item.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark notification as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark all as read');
    }
  };

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

  const openCommentsModal = async (ticket: Ticket) => {
    setError(null);
    setCommentsModalTicket(ticket);
    setCommentText('');
    setCommentVisibility('PUBLIC');
    setCommentsLoading(true);
    try {
      const list = await api.getTicketComments(ticket.id);
      setTicketComments(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load comments');
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentsModalTicket || !commentText.trim()) return;
    setCommentsLoading(true);
    setError(null);
    try {
      const effectiveVisibility: CommentVisibility =
        currentUser?.role === 'RESIDENT' ? 'PUBLIC' : commentVisibility;
      await api.createTicketComment(commentsModalTicket.id, {
        content: commentText.trim(),
        visibility: effectiveVisibility,
      });
      setCommentText('');
      const updatedList = await api.getTicketComments(commentsModalTicket.id);
      setTicketComments(updatedList);
      await syncNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post comment');
    } finally {
      setCommentsLoading(false);
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
      <span
        style={{
          backgroundColor: s.bg,
          color: s.color,
          padding: '0.25rem 0.6rem',
          borderRadius: '9999px',
          fontSize: '0.75rem',
          fontWeight: 600,
          textTransform: 'uppercase',
        }}
      >
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

  const canViewAnalytics =
    currentUser?.role === 'ORGANISATION_ADMIN' || currentUser?.role === 'TECHNICIAN';

  return (
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        backgroundColor: '#f8fafc',
        minHeight: '100vh',
        color: '#0f172a',
      }}
    >
      <header
        style={{
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '1rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
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
            }}
          >
            D
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.02em' }}>
              DeskOps
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Greenfield Facilities &bull; Batch 2
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>
            Switch Persona:
          </span>
          <button
            onClick={() => loginAs('admin@greenfield.com')}
            style={{
              padding: '0.4rem 0.7rem',
              borderRadius: '6px',
              border: currentUser?.email === 'admin@greenfield.com' ? '2px solid #2563eb' : '1px solid #cbd5e1',
              backgroundColor: currentUser?.email === 'admin@greenfield.com' ? '#eff6ff' : '#ffffff',
              color: '#1e293b',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.75rem',
            }}
          >
            Alice Admin
          </button>
          <button
            onClick={() => loginAs('tech@greenfield.com')}
            style={{
              padding: '0.4rem 0.7rem',
              borderRadius: '6px',
              border: currentUser?.email === 'tech@greenfield.com' ? '2px solid #2563eb' : '1px solid #cbd5e1',
              backgroundColor: currentUser?.email === 'tech@greenfield.com' ? '#eff6ff' : '#ffffff',
              color: '#1e293b',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.75rem',
            }}
          >
            Bob Technician
          </button>
          <button
            onClick={() => loginAs('resident@greenfield.com')}
            style={{
              padding: '0.4rem 0.7rem',
              borderRadius: '6px',
              border: currentUser?.email === 'resident@greenfield.com' ? '2px solid #2563eb' : '1px solid #cbd5e1',
              backgroundColor: currentUser?.email === 'resident@greenfield.com' ? '#eff6ff' : '#ffffff',
              color: '#1e293b',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.75rem',
            }}
          >
            Rachel Resident
          </button>

          {currentUser && (
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                aria-label="Notifications"
                onClick={() => setShowNotificationsMenu((prev) => !prev)}
                style={{
                  position: 'relative',
                  padding: '0.4rem 0.65rem',
                  borderRadius: '6px',
                  border: showNotificationsMenu ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  backgroundColor: showNotificationsMenu ? '#eff6ff' : '#ffffff',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <span>🔔</span>
                {unreadCount > 0 && (
                  <span
                    style={{
                      backgroundColor: '#dc2626',
                      color: '#ffffff',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '0.05rem 0.4rem',
                      borderRadius: '9999px',
                      lineHeight: 1.2,
                    }}
                  >
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotificationsMenu && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 0.5rem)',
                    width: '360px',
                    maxHeight: '420px',
                    overflowY: 'auto',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.15)',
                    zIndex: 500,
                    padding: '0.75rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingBottom: '0.5rem',
                      marginBottom: '0.5rem',
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    <strong style={{ fontSize: '0.85rem' }}>
                      Notifications ({unreadCount} unread)
                    </strong>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#2563eb',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <div style={{ padding: '1.25rem 0.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>
                      No notifications yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          style={{
                            padding: '0.6rem 0.7rem',
                            borderRadius: '7px',
                            border: '1px solid #e2e8f0',
                            backgroundColor: n.isRead ? '#ffffff' : '#eff6ff',
                            cursor: n.isRead ? 'default' : 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: n.isRead ? 500 : 700, color: '#0f172a' }}>
                              {n.title ? `${n.title}: ` : ''}
                              {n.message}
                            </span>
                            {!n.isRead && (
                              <span
                                style={{
                                  backgroundColor: '#2563eb',
                                  color: '#ffffff',
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  padding: '0.1rem 0.4rem',
                                  borderRadius: '9999px',
                                  flexShrink: 0,
                                }}
                              >
                                Unread
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem' }}>
                            {new Date(n.createdAt).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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

      <main style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1.5rem' }}>
        {error && (
          <div
            style={{
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
            }}
          >
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
            >
              &times;
            </button>
          </div>
        )}

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
            {canViewAnalytics && (
              <button
                type="button"
                onClick={() => setShowAnalyticsPanel((prev) => !prev)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: showAnalyticsPanel ? '#eff6ff' : '#ffffff',
                  border: showAnalyticsPanel ? '1px solid #2563eb' : '1px solid #cbd5e1',
                  color: showAnalyticsPanel ? '#1d4ed8' : '#334155',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                }}
              >
                {showAnalyticsPanel ? 'Hide Analytics' : 'Analytics Summary'}
              </button>
            )}
            <button
              onClick={() => refreshData()}
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
              Refresh
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

        {canViewAnalytics && showAnalyticsPanel && (
          <AnalyticsDashboard
            summary={analyticsSummary}
            userRole={currentUser?.role}
            loading={analyticsLoading}
          />
        )}

        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
            overflow: 'hidden',
          }}
        >
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
                        <span style={{ fontWeight: 500 }}>{t.assignedTechnician.name}</span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Unassigned</span>
                      )}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
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

                        <button
                          onClick={() => openCommentsModal(t)}
                          style={{
                            padding: '0.3rem 0.6rem',
                            borderRadius: '4px',
                            border: '1px solid #2563eb',
                            backgroundColor: '#eff6ff',
                            color: '#1d4ed8',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Comments
                        </button>

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
                          Timeline
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
                  <div
                    style={{
                      position: 'absolute',
                      left: '-6px',
                      top: '2px',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: '#2563eb',
                    }}
                  />
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {new Date(ev.createdAt).toLocaleString()} &bull; <strong>{ev.actor.name}</strong>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', marginTop: '0.2rem' }}>
                    {ev.eventType}
                    {ev.fromStatus && ev.toStatus && ` (${ev.fromStatus} -> ${ev.toStatus})`}
                  </div>
                  {ev.metadata && (
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: '#475569',
                        marginTop: '0.25rem',
                        backgroundColor: '#f1f5f9',
                        padding: '0.4rem',
                        borderRadius: '4px',
                      }}
                    >
                      {JSON.stringify(ev.metadata)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {commentsModalTicket && (
        <div style={modalBackdropStyle}>
          <div style={{ ...modalContentStyle, maxWidth: '560px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>
                Comments &bull; {commentsModalTicket.ticketNumber}
              </h3>
              <button
                onClick={() => {
                  setCommentsModalTicket(null);
                  setTicketComments([]);
                  setCommentText('');
                }}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <div style={{ maxHeight: '280px', overflowY: 'auto', marginBottom: '1.25rem', paddingRight: '0.25rem' }}>
              {commentsLoading && ticketComments.length === 0 ? (
                <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Loading comments...</div>
              ) : ticketComments.length === 0 ? (
                <div style={{ color: '#64748b', fontSize: '0.875rem', padding: '0.75rem 0' }}>
                  No comments yet on this ticket.
                </div>
              ) : (
                ticketComments.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: c.visibility === 'INTERNAL' ? '#fffbeb' : '#f8fafc',
                      marginBottom: '0.65rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#64748b' }}>
                      <span>
                        <strong style={{ color: '#0f172a' }}>{c.author.name}</strong>
                        {c.author.role?.name ? ` (${c.author.role.name})` : ''}
                      </span>
                      <span>{new Date(c.createdAt).toLocaleString()}</span>
                    </div>
                    <div style={{ marginTop: '0.4rem', fontSize: '0.875rem', color: '#1e293b', whiteSpace: 'pre-wrap' }}>
                      {c.content}
                    </div>
                    {c.visibility === 'INTERNAL' && (
                      <span
                        style={{
                          display: 'inline-block',
                          marginTop: '0.35rem',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          color: '#b45309',
                          backgroundColor: '#fef3c7',
                          padding: '0.1rem 0.45rem',
                          borderRadius: '4px',
                        }}
                      >
                        INTERNAL NOTE
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddComment}>
              {currentUser?.role !== 'RESIDENT' && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={labelStyle}>Visibility</label>
                  <select
                    value={commentVisibility}
                    onChange={(e) => setCommentVisibility(e.target.value as CommentVisibility)}
                    style={inputStyle}
                  >
                    <option value="PUBLIC">PUBLIC (Visible to resident)</option>
                    <option value="INTERNAL">INTERNAL (Staff only)</option>
                  </select>
                </div>
              )}

              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Add Comment</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Write a comment or update..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setCommentsModalTicket(null);
                    setTicketComments([]);
                    setCommentText('');
                  }}
                  style={secondaryBtnStyle}
                >
                  Close
                </button>
                <button type="submit" disabled={commentsLoading} style={primaryBtnStyle}>
                  Post Comment
                </button>
              </div>
            </form>
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
