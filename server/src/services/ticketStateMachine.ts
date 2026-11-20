import { TicketStatus, RoleName } from '@prisma/client';

export interface TransitionRule {
  from: TicketStatus;
  to: TicketStatus;
  allowedRoles: RoleName[];
}

export const VALID_TRANSITIONS: TransitionRule[] = [
  { from: TicketStatus.NEW, to: TicketStatus.TRIAGED, allowedRoles: [RoleName.ORGANISATION_ADMIN] },
  { from: TicketStatus.TRIAGED, to: TicketStatus.ASSIGNED, allowedRoles: [RoleName.ORGANISATION_ADMIN] },
  { from: TicketStatus.ASSIGNED, to: TicketStatus.IN_PROGRESS, allowedRoles: [RoleName.ORGANISATION_ADMIN, RoleName.TECHNICIAN] },
  { from: TicketStatus.IN_PROGRESS, to: TicketStatus.ON_HOLD, allowedRoles: [RoleName.ORGANISATION_ADMIN, RoleName.TECHNICIAN] },
  { from: TicketStatus.ON_HOLD, to: TicketStatus.IN_PROGRESS, allowedRoles: [RoleName.ORGANISATION_ADMIN, RoleName.TECHNICIAN] },
  { from: TicketStatus.IN_PROGRESS, to: TicketStatus.RESOLVED, allowedRoles: [RoleName.ORGANISATION_ADMIN, RoleName.TECHNICIAN] },
  { from: TicketStatus.RESOLVED, to: TicketStatus.CLOSED, allowedRoles: [RoleName.ORGANISATION_ADMIN, RoleName.RESIDENT] },
  { from: TicketStatus.RESOLVED, to: TicketStatus.IN_PROGRESS, allowedRoles: [RoleName.ORGANISATION_ADMIN, RoleName.RESIDENT] },
];

export class TicketStateMachine {
  static validateTransition(
    currentStatus: TicketStatus,
    targetStatus: TicketStatus,
    userRole: RoleName,
    resolvedAt?: Date | null,
    reopenWindowHours: number = 24
  ): void {
    const rule = VALID_TRANSITIONS.find(
      (t) => t.from === currentStatus && t.to === targetStatus
    );

    if (!rule) {
      throw new Error(
        `ERR_ILLEGAL_STATE_TRANSITION: Cannot transition ticket from status '${currentStatus}' to '${targetStatus}'.`
      );
    }

    if (!rule.allowedRoles.includes(userRole)) {
      throw new Error(
        `ERR_ILLEGAL_STATE_TRANSITION: Role '${userRole}' is not authorized to transition ticket from '${currentStatus}' to '${targetStatus}'.`
      );
    }

    // Check reopen window if reopening from RESOLVED to IN_PROGRESS
    if (currentStatus === TicketStatus.RESOLVED && targetStatus === TicketStatus.IN_PROGRESS) {
      if (resolvedAt) {
        const hoursSinceResolution = (Date.now() - new Date(resolvedAt).getTime()) / (1000 * 60 * 60);
        if (hoursSinceResolution > reopenWindowHours) {
          throw new Error(
            `ERR_ILLEGAL_STATE_TRANSITION: Reopen window has expired (${hoursSinceResolution.toFixed(1)}h elapsed; maximum allowed: ${reopenWindowHours}h).`
          );
        }
      }
    }
  }
}
