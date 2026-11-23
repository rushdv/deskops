import { TicketPriority, TicketStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

const ALL_STATUSES: TicketStatus[] = [
  'NEW',
  'TRIAGED',
  'ASSIGNED',
  'IN_PROGRESS',
  'ON_HOLD',
  'RESOLVED',
  'CLOSED',
];

const ALL_PRIORITIES: TicketPriority[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
];

const ACTIVE_WORKLOAD_STATUSES: TicketStatus[] = ['ASSIGNED', 'IN_PROGRESS'];

export interface AnalyticsSummaryData {
  totals: {
    totalTickets: number;
    activeWorkInProgress: number;
    resolvedOrClosed: number;
    pendingTriage: number;
  };
  byStatus: Record<TicketStatus, number>;
  byPriority: Record<TicketPriority, number>;
  technicianWorkload: Array<{
    technicianId: string;
    technicianName: string;
    technicianEmail: string;
    activeCount: number;
  }>;
}

export const AnalyticsService = {
  async getSummary(tenantId: string, _userRole?: string): Promise<AnalyticsSummaryData> {
    const tenantWhere = { organisationId: tenantId };

    const [totalTickets, statusGroups, priorityGroups, activeTickets] = await Promise.all([
      prisma.ticket.count({ where: tenantWhere }),
      prisma.ticket.groupBy({
        by: ['status'],
        where: tenantWhere,
        _count: { _all: true },
      }),
      prisma.ticket.groupBy({
        by: ['priority'],
        where: tenantWhere,
        _count: { _all: true },
      }),
      prisma.ticket.findMany({
        where: {
          organisationId: tenantId,
          status: { in: ACTIVE_WORKLOAD_STATUSES },
          assignedTechnicianId: { not: null },
        },
        select: {
          assignedTechnicianId: true,
          assignedTechnician: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
    ]);

    const byStatus = ALL_STATUSES.reduce((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {} as Record<TicketStatus, number>);

    for (const row of statusGroups) {
      byStatus[row.status as TicketStatus] = row._count._all;
    }

    const byPriority = ALL_PRIORITIES.reduce((acc, priority) => {
      acc[priority] = 0;
      return acc;
    }, {} as Record<TicketPriority, number>);

    for (const row of priorityGroups) {
      byPriority[row.priority as TicketPriority] = row._count._all;
    }

    const workloadMap = new Map<
      string,
      { technicianId: string; technicianName: string; technicianEmail: string; activeCount: number }
    >();

    for (const ticket of activeTickets) {
      if (!ticket.assignedTechnicianId || !ticket.assignedTechnician) continue;
      const techId = ticket.assignedTechnicianId;
      const existing = workloadMap.get(techId);
      if (existing) {
        existing.activeCount += 1;
      } else {
        workloadMap.set(techId, {
          technicianId: techId,
          technicianName: ticket.assignedTechnician.name,
          technicianEmail: ticket.assignedTechnician.email,
          activeCount: 1,
        });
      }
    }

    const technicianWorkload = Array.from(workloadMap.values()).sort(
      (a, b) => b.activeCount - a.activeCount
    );

    const activeWorkInProgress =
      (byStatus.ASSIGNED ?? 0) + (byStatus.IN_PROGRESS ?? 0);
    const resolvedOrClosed =
      (byStatus.RESOLVED ?? 0) + (byStatus.CLOSED ?? 0);
    const pendingTriage =
      (byStatus.NEW ?? 0) + (byStatus.TRIAGED ?? 0);

    return {
      totals: {
        totalTickets,
        activeWorkInProgress,
        resolvedOrClosed,
        pendingTriage,
      },
      byStatus,
      byPriority,
      technicianWorkload,
    };
  },
};
