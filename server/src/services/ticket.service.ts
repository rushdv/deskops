import { TicketStatus, TicketPriority, TicketEventType, RoleName, Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { UserSessionPayload, TenantContext } from '../types/auth.js';
import { TicketStateMachine } from './ticketStateMachine.js';

export interface CreateTicketDTO {
  propertyId: string;
  unitId: string;
  title: string;
  description: string;
  category: string;
  priority?: TicketPriority;
}

export interface TriageTicketDTO {
  category: string;
  priority: TicketPriority;
}

export class TicketService {
  // Generate ticket number format e.g. TICK-10026
  private static async generateTicketNumber(organisationId: string): Promise<string> {
    const count = await prisma.ticket.count({
      where: { organisationId },
    });
    return `TICK-${10000 + count + 1}`;
  }

  static async createTicket(
    tenant: TenantContext,
    user: UserSessionPayload,
    dto: CreateTicketDTO
  ) {
    // If resident, verify unit belongs to them or property is in the organisation
    const unit = await prisma.unit.findFirst({
      where: {
        id: dto.unitId,
        organisationId: tenant.organisationId,
        propertyId: dto.propertyId,
      },
    });

    if (!unit) {
      throw new Error('Selected property or unit not found in your organisation.');
    }

    const ticketNumber = await this.generateTicketNumber(tenant.organisationId);

    return prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.create({
        data: {
          organisationId: tenant.organisationId,
          ticketNumber,
          propertyId: dto.propertyId,
          unitId: dto.unitId,
          createdById: user.userId,
          title: dto.title,
          description: dto.description,
          category: dto.category,
          priority: dto.priority || TicketPriority.MEDIUM,
          status: TicketStatus.NEW,
        },
        include: {
          property: true,
          unit: true,
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });

      // Audit event
      await tx.ticketEvent.create({
        data: {
          organisationId: tenant.organisationId,
          ticketId: ticket.id,
          actorId: user.userId,
          eventType: TicketEventType.STATUS_CHANGE,
          fromStatus: null,
          toStatus: TicketStatus.NEW,
          metadata: {
            reason: 'Ticket created',
            initialPriority: ticket.priority,
          },
        },
      });

      return ticket;
    });
  }

  static async listTickets(tenant: TenantContext, user: UserSessionPayload) {
    const where: Prisma.TicketWhereInput = {
      organisationId: tenant.organisationId,
    };

    // Role-based visibility
    if (user.role === RoleName.RESIDENT) {
      where.createdById = user.userId;
    } else if (user.role === RoleName.TECHNICIAN) {
      where.assignedTechnicianId = user.userId;
    }

    return prisma.ticket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        property: { select: { id: true, name: true, code: true } },
        unit: { select: { id: true, unitNumber: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTechnician: { select: { id: true, name: true, email: true } },
      },
    });
  }

  static async getTicketById(tenant: TenantContext, user: UserSessionPayload, ticketId: string) {
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        organisationId: tenant.organisationId,
      },
      include: {
        property: true,
        unit: true,
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTechnician: { select: { id: true, name: true, email: true } },
        events: {
          orderBy: { createdAt: 'asc' },
          include: {
            actor: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!ticket) {
      // Safe Cross-Tenant & Non-existent response: 404
      return null;
    }

    // Role-based check
    if (user.role === RoleName.RESIDENT && ticket.createdById !== user.userId) {
      return null;
    }

    return ticket;
  }

  static async triageTicket(
    tenant: TenantContext,
    user: UserSessionPayload,
    ticketId: string,
    dto: TriageTicketDTO
  ) {
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, organisationId: tenant.organisationId },
      include: { organisation: true },
    });

    if (!ticket) {
      return null;
    }

    TicketStateMachine.validateTransition(
      ticket.status,
      TicketStatus.TRIAGED,
      user.role,
      ticket.resolvedAt,
      ticket.organisation.reopenWindowHours
    );

    return prisma.$transaction(async (tx) => {
      const updated = await tx.ticket.update({
        where: { id: ticketId },
        data: {
          category: dto.category,
          priority: dto.priority,
          status: TicketStatus.TRIAGED,
        },
        include: { property: true, unit: true, assignedTechnician: true },
      });

      await tx.ticketEvent.create({
        data: {
          organisationId: tenant.organisationId,
          ticketId: ticket.id,
          actorId: user.userId,
          eventType: TicketEventType.STATUS_CHANGE,
          fromStatus: ticket.status,
          toStatus: TicketStatus.TRIAGED,
          metadata: {
            assignedCategory: dto.category,
            assignedPriority: dto.priority,
          },
        },
      });

      return updated;
    });
  }

  static async assignTicket(
    tenant: TenantContext,
    user: UserSessionPayload,
    ticketId: string,
    assignedTechnicianId: string
  ) {
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, organisationId: tenant.organisationId },
      include: { organisation: true },
    });

    if (!ticket) {
      return null;
    }

    TicketStateMachine.validateTransition(
      ticket.status,
      TicketStatus.ASSIGNED,
      user.role,
      ticket.resolvedAt,
      ticket.organisation.reopenWindowHours
    );

    // Verify technician exists and belongs to the organisation
    const technician = await prisma.user.findFirst({
      where: {
        id: assignedTechnicianId,
        organisationId: tenant.organisationId,
        isActive: true,
        role: { name: RoleName.TECHNICIAN },
      },
    });

    if (!technician) {
      throw new Error('Technician not found or does not belong to this organisation.');
    }

    return prisma.$transaction(async (tx) => {
      // Atomic conditional update to prevent race conditions (NFR-03, AC-1.2)
      // Only a ticket currently in TRIAGED status can transition to ASSIGNED
      const updateResult = await tx.ticket.updateMany({
        where: {
          id: ticketId,
          organisationId: tenant.organisationId,
          status: TicketStatus.TRIAGED,
        },
        data: {
          assignedTechnicianId,
          status: TicketStatus.ASSIGNED,
        },
      });

      if (updateResult.count === 0) {
        throw new Error(
          'ERR_ILLEGAL_STATE_TRANSITION: Ticket cannot be assigned. It is either already assigned, closed, or not in TRIAGED status.'
        );
      }

      const updated = await tx.ticket.findUniqueOrThrow({
        where: { id: ticketId },
        include: { property: true, unit: true, assignedTechnician: true },
      });

      await tx.ticketEvent.create({
        data: {
          organisationId: tenant.organisationId,
          ticketId: ticket.id,
          actorId: user.userId,
          eventType: TicketEventType.ASSIGNMENT,
          fromStatus: TicketStatus.TRIAGED,
          toStatus: TicketStatus.ASSIGNED,
          metadata: {
            assignedTechnicianId,
            assignedTechnicianName: technician.name,
          },
        },
      });

      return updated;
    });
  }

  static async updateTicketStatus(
    tenant: TenantContext,
    user: UserSessionPayload,
    ticketId: string,
    targetStatus: TicketStatus,
    reasonOrNotes?: string
  ) {
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, organisationId: tenant.organisationId },
      include: { organisation: true },
    });

    if (!ticket) {
      return null;
    }

    // Technician can only update their own assigned tickets
    if (user.role === RoleName.TECHNICIAN && ticket.assignedTechnicianId !== user.userId) {
      throw new Error('Technicians may only update tickets assigned directly to them.');
    }

    TicketStateMachine.validateTransition(
      ticket.status,
      targetStatus,
      user.role,
      ticket.resolvedAt,
      ticket.organisation.reopenWindowHours
    );

    const updateData: Prisma.TicketUpdateInput = {
      status: targetStatus,
    };

    if (targetStatus === TicketStatus.RESOLVED) {
      updateData.resolvedAt = new Date();
    } else if (targetStatus === TicketStatus.CLOSED) {
      updateData.closedAt = new Date();
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.ticket.update({
        where: { id: ticketId },
        data: updateData,
        include: { property: true, unit: true, assignedTechnician: true },
      });

      await tx.ticketEvent.create({
        data: {
          organisationId: tenant.organisationId,
          ticketId: ticket.id,
          actorId: user.userId,
          eventType: TicketEventType.STATUS_CHANGE,
          fromStatus: ticket.status,
          toStatus: targetStatus,
          metadata: {
            notes: reasonOrNotes || null,
          },
        },
      });

      return updated;
    });
  }
}
