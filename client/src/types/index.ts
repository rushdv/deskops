export type RoleName = 'ORGANISATION_ADMIN' | 'TECHNICIAN' | 'RESIDENT';

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type TicketStatus =
  | 'NEW'
  | 'TRIAGED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'RESOLVED'
  | 'CLOSED';

export type CommentVisibility = 'PUBLIC' | 'INTERNAL';

export interface TicketComment {
  id: string;
  ticketId: string;
  organisationId: string;
  authorId: string;
  visibility: CommentVisibility;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string;
    email: string;
    role?: { name: RoleName };
  };
}

export interface UserSession {
  userId: string;
  email: string;
  name: string;
  role: RoleName;
  organisationId: string;
}

export interface Unit {
  id: string;
  unitNumber: string;
  floor?: string;
}

export interface Property {
  id: string;
  name: string;
  code: string;
  address: string;
  units: Unit[];
}

export interface TechnicianSummary {
  id: string;
  name: string;
  email: string;
  technicianProfile?: {
    phone?: string;
    maxActiveTickets: number;
    skills: { skill: string }[];
  };
}

export interface TicketEvent {
  id: string;
  eventType: string;
  fromStatus?: TicketStatus | null;
  toStatus?: TicketStatus | null;
  metadata?: Record<string, any>;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    email: string;
  };
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  property: { id: string; name: string; code: string };
  unit: { id: string; unitNumber: string };
  createdBy: { id: string; name: string; email: string };
  assignedTechnician?: { id: string; name: string; email: string } | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  events?: TicketEvent[];
}

export interface TechnicianWorkloadItem {
  technicianId: string;
  technicianName: string;
  technicianEmail: string;
  activeCount: number;
}

export interface AnalyticsSummary {
  totals: {
    totalTickets: number;
    activeWorkInProgress: number;
    resolvedOrClosed: number;
    pendingTriage: number;
  };
  byStatus: Record<TicketStatus, number>;
  byPriority: Record<TicketPriority, number>;
  technicianWorkload: TechnicianWorkloadItem[];
}

export interface NotificationItem {
  id: string;
  organisationId: string;
  recipientId: string;
  ticketId?: string | null;
  title?: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface BackendHealth {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  environment: string;
}
