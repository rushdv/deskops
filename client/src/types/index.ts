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

export interface BackendHealth {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  environment: string;
}
