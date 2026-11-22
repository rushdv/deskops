import { describe, it, expect } from 'vitest';
import { TicketStateMachine } from '../src/services/ticketStateMachine.js';
import { TicketStatus, RoleName } from '@prisma/client';

describe('Ticket State Machine & Reopen Window Hardening (FR-1.02, FR-1.03)', () => {
  describe('Valid Lifecycle Transitions', () => {
    it('Admin can transition NEW -> TRIAGED', () => {
      expect(() => {
        TicketStateMachine.validateTransition(
          TicketStatus.NEW,
          TicketStatus.TRIAGED,
          RoleName.ORGANISATION_ADMIN
        );
      }).not.toThrow();
    });

    it('Admin can transition TRIAGED -> ASSIGNED', () => {
      expect(() => {
        TicketStateMachine.validateTransition(
          TicketStatus.TRIAGED,
          TicketStatus.ASSIGNED,
          RoleName.ORGANISATION_ADMIN
        );
      }).not.toThrow();
    });

    it('Technician can transition ASSIGNED -> IN_PROGRESS', () => {
      expect(() => {
        TicketStateMachine.validateTransition(
          TicketStatus.ASSIGNED,
          TicketStatus.IN_PROGRESS,
          RoleName.TECHNICIAN
        );
      }).not.toThrow();
    });

    it('Technician can toggle IN_PROGRESS <-> ON_HOLD', () => {
      expect(() => {
        TicketStateMachine.validateTransition(
          TicketStatus.IN_PROGRESS,
          TicketStatus.ON_HOLD,
          RoleName.TECHNICIAN
        );
      }).not.toThrow();

      expect(() => {
        TicketStateMachine.validateTransition(
          TicketStatus.ON_HOLD,
          TicketStatus.IN_PROGRESS,
          RoleName.TECHNICIAN
        );
      }).not.toThrow();
    });

    it('Technician can transition IN_PROGRESS -> RESOLVED', () => {
      expect(() => {
        TicketStateMachine.validateTransition(
          TicketStatus.IN_PROGRESS,
          TicketStatus.RESOLVED,
          RoleName.TECHNICIAN
        );
      }).not.toThrow();
    });

    it('Resident can close a RESOLVED ticket (RESOLVED -> CLOSED)', () => {
      expect(() => {
        TicketStateMachine.validateTransition(
          TicketStatus.RESOLVED,
          TicketStatus.CLOSED,
          RoleName.RESIDENT
        );
      }).not.toThrow();
    });
  });

  describe('Reopen Window Validation (FR-1.03)', () => {
    it('Resident can reopen RESOLVED -> IN_PROGRESS within the 24-hour reopen window', () => {
      const resolved2HoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      expect(() => {
        TicketStateMachine.validateTransition(
          TicketStatus.RESOLVED,
          TicketStatus.IN_PROGRESS,
          RoleName.RESIDENT,
          resolved2HoursAgo,
          24 // reopenWindowHours
        );
      }).not.toThrow();
    });

    it('Throws ERR_ILLEGAL_STATE_TRANSITION when reopening outside the reopen window', () => {
      const resolved26HoursAgo = new Date(Date.now() - 26 * 60 * 60 * 1000);
      expect(() => {
        TicketStateMachine.validateTransition(
          TicketStatus.RESOLVED,
          TicketStatus.IN_PROGRESS,
          RoleName.RESIDENT,
          resolved26HoursAgo,
          24 // reopenWindowHours
        );
      }).toThrow(/Reopen window has expired/);
    });

    it('Respects tenant-customized reopen window (e.g. 12 hours)', () => {
      const resolved14HoursAgo = new Date(Date.now() - 14 * 60 * 60 * 1000);
      expect(() => {
        TicketStateMachine.validateTransition(
          TicketStatus.RESOLVED,
          TicketStatus.IN_PROGRESS,
          RoleName.RESIDENT,
          resolved14HoursAgo,
          12 // 12-hour limit
        );
      }).toThrow(/Reopen window has expired/);
    });
  });

  describe('Role Violations & Illegal Transitions', () => {
    it('Resident cannot triage a ticket (NEW -> TRIAGED)', () => {
      expect(() => {
        TicketStateMachine.validateTransition(
          TicketStatus.NEW,
          TicketStatus.TRIAGED,
          RoleName.RESIDENT
        );
      }).toThrow(/Role 'RESIDENT' is not authorized/);
    });

    it('Technician cannot assign tickets (TRIAGED -> ASSIGNED)', () => {
      expect(() => {
        TicketStateMachine.validateTransition(
          TicketStatus.TRIAGED,
          TicketStatus.ASSIGNED,
          RoleName.TECHNICIAN
        );
      }).toThrow(/Role 'TECHNICIAN' is not authorized/);
    });

    it('Cannot jump directly from NEW -> CLOSED', () => {
      expect(() => {
        TicketStateMachine.validateTransition(
          TicketStatus.NEW,
          TicketStatus.CLOSED,
          RoleName.ORGANISATION_ADMIN
        );
      }).toThrow(/Cannot transition ticket from status 'NEW' to 'CLOSED'/);
    });

    it('Cannot jump directly from NEW -> IN_PROGRESS without triage and assignment', () => {
      expect(() => {
        TicketStateMachine.validateTransition(
          TicketStatus.NEW,
          TicketStatus.IN_PROGRESS,
          RoleName.ORGANISATION_ADMIN
        );
      }).toThrow(/Cannot transition ticket from status 'NEW' to 'IN_PROGRESS'/);
    });
  });
});
