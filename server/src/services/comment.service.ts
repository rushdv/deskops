import { CommentVisibility, RoleName, TicketEventType } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { TenantContext, UserSessionPayload } from '../types/auth.js';

export interface CreateCommentDTO {
  content: string;
  visibility?: CommentVisibility;
}

export class CommentService {
  private static async verifyTicketAccess(
    tenant: TenantContext,
    user: UserSessionPayload,
    ticketId: string
  ) {
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        organisationId: tenant.organisationId,
      },
    });

    if (!ticket) {
      return null;
    }

    // Resident can only access tickets they created
    if (user.role === RoleName.RESIDENT && ticket.createdById !== user.userId) {
      return null;
    }

    // Technician can only access tickets assigned to them
    if (user.role === RoleName.TECHNICIAN && ticket.assignedTechnicianId !== user.userId) {
      return null;
    }

    return ticket;
  }

  static async listComments(
    tenant: TenantContext,
    user: UserSessionPayload,
    ticketId: string
  ) {
    const ticket = await this.verifyTicketAccess(tenant, user, ticketId);
    if (!ticket) {
      return null;
    }

    return prisma.comment.findMany({
      where: {
        ticketId: ticket.id,
        organisationId: tenant.organisationId,
        ...(user.role === RoleName.RESIDENT ? { visibility: CommentVisibility.PUBLIC } : {}),
      },
      orderBy: { createdAt: 'asc' },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            role: { select: { name: true } },
          },
        },
      },
    });
  }

  static async createComment(
    tenant: TenantContext,
    user: UserSessionPayload,
    ticketId: string,
    dto: CreateCommentDTO
  ) {
    const ticket = await this.verifyTicketAccess(tenant, user, ticketId);
    if (!ticket) {
      return null;
    }

    const visibility = dto.visibility ?? CommentVisibility.PUBLIC;

    if (user.role === RoleName.RESIDENT && visibility === CommentVisibility.INTERNAL) {
      throw new Error('ERR_FORBIDDEN_VISIBILITY: Residents cannot post internal comments.');
    }

    return prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: {
          organisationId: tenant.organisationId,
          ticketId: ticket.id,
          authorId: user.userId,
          content: dto.content.trim(),
          visibility,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              role: { select: { name: true } },
            },
          },
        },
      });

      await tx.ticketEvent.create({
        data: {
          organisationId: tenant.organisationId,
          ticketId: ticket.id,
          actorId: user.userId,
          eventType: TicketEventType.COMMENT_ADDED,
          metadata: {
            commentId: comment.id,
            visibility: comment.visibility,
          },
        },
      });

      return comment;
    });
  }
}
