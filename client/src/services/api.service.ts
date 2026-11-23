import {
  AnalyticsSummary,
  CommentVisibility,
  NotificationItem,
  Property,
  TechnicianSummary,
  Ticket,
  TicketComment,
  UserSession,
} from '../types';

let authToken: string | null = localStorage.getItem('deskops_token');

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) {
    localStorage.setItem('deskops_token', token);
  } else {
    localStorage.removeItem('deskops_token');
  }
};

export const getAuthToken = () => authToken;

const authHeaders = () => ({
  'Content-Type': 'application/json',
  ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
});

export const api = {
  async login(email: string, password: string): Promise<{ accessToken: string; user: UserSession }> {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Login failed');
    setAuthToken(json.data.accessToken);
    return json.data;
  },

  async getCurrentUser(): Promise<any> {
    const res = await fetch('/api/v1/auth/me', { headers: authHeaders() });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Failed to fetch user');
    return json.data;
  },

  async getTickets(): Promise<Ticket[]> {
    const res = await fetch('/api/v1/tickets', { headers: authHeaders() });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Failed to fetch tickets');
    return json.data;
  },

  async getTicketDetail(id: string): Promise<Ticket> {
    const res = await fetch(`/api/v1/tickets/${id}`, { headers: authHeaders() });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Failed to fetch ticket detail');
    return json.data;
  },

  async createTicket(payload: {
    propertyId: string;
    unitId: string;
    title: string;
    description: string;
    category: string;
    priority?: string;
  }): Promise<Ticket> {
    const res = await fetch('/api/v1/tickets', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Failed to create ticket');
    return json.data;
  },

  async triageTicket(id: string, payload: { category: string; priority: string }): Promise<Ticket> {
    const res = await fetch(`/api/v1/tickets/${id}/triage`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Failed to triage ticket');
    return json.data;
  },

  async assignTicket(id: string, assignedTechnicianId: string): Promise<Ticket> {
    const res = await fetch(`/api/v1/tickets/${id}/assign`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ assignedTechnicianId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Failed to assign technician');
    return json.data;
  },

  async updateTicketStatus(id: string, status: string, notes?: string): Promise<Ticket> {
    const res = await fetch(`/api/v1/tickets/${id}/status`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status, notes }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Failed to update ticket status');
    return json.data;
  },

  async getTicketComments(ticketId: string): Promise<TicketComment[]> {
    const res = await fetch(`/api/v1/tickets/${ticketId}/comments`, { headers: authHeaders() });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Failed to fetch comments');
    return json.data;
  },

  async createTicketComment(
    ticketId: string,
    payload: { content: string; visibility?: CommentVisibility }
  ): Promise<TicketComment> {
    const res = await fetch(`/api/v1/tickets/${ticketId}/comments`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Failed to add comment');
    return json.data;
  },

  async getProperties(): Promise<Property[]> {
    const res = await fetch('/api/v1/properties', { headers: authHeaders() });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Failed to fetch properties');
    return json.data;
  },

  async getTechnicians(): Promise<TechnicianSummary[]> {
    const res = await fetch('/api/v1/properties/technicians', { headers: authHeaders() });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Failed to fetch technicians');
    return json.data;
  },

  async getAnalyticsSummary(): Promise<AnalyticsSummary> {
    const res = await fetch('/api/v1/analytics/summary', { headers: authHeaders() });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Failed to fetch analytics summary');
    return json.data;
  },

  async getNotifications(): Promise<{ items: NotificationItem[]; unreadCount: number }> {
    const res = await fetch('/api/v1/notifications', { headers: authHeaders() });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Failed to fetch notifications');
    const items: NotificationItem[] = Array.isArray(json.data) ? json.data : [];
    const unreadCount =
      typeof json.unreadCount === 'number'
        ? json.unreadCount
        : items.filter((n) => !n.isRead).length;
    return { items, unreadCount };
  },

  async markAsRead(id: string): Promise<NotificationItem> {
    const res = await fetch(`/api/v1/notifications/${id}/read`, {
      method: 'PATCH',
      headers: authHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Failed to mark notification as read');
    return json.data;
  },

  async markAllAsRead(): Promise<{ updatedCount: number }> {
    const res = await fetch('/api/v1/notifications/read-all', {
      method: 'PATCH',
      headers: authHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || 'Failed to mark all notifications as read');
    return json.data;
  },
};
