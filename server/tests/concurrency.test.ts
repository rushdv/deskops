import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { TicketStatus, TicketPriority, TicketEventType } from '@prisma/client';

describe('NFR-03 & AC-1.2: Ticket Assignment Concurrency & Race Condition Defense', () => {
  let adminToken: string;
  let technicianId: string;
  let testTicketId: string;
  let testOrganisationId: string;

  beforeAll(async () => {
    // 1. Authenticate as Organisation Admin to get valid JWT
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@greenfield.com',
        password: 'Password123!',
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    adminToken = loginRes.body.data.accessToken;

    // 2. Fetch seeded organisation, technician, property, and unit
    const org = await prisma.organisation.findFirstOrThrow({
      where: { slug: 'greenfield-facilities' },
    });
    testOrganisationId = org.id;

    const tech = await prisma.user.findFirstOrThrow({
      where: { email: 'tech@greenfield.com' },
    });
    technicianId = tech.id;

    const resident = await prisma.user.findFirstOrThrow({
      where: { email: 'resident@greenfield.com' },
    });

    const property = await prisma.property.findFirstOrThrow({
      where: { organisationId: org.id },
    });

    const unit = await prisma.unit.findFirstOrThrow({
      where: { propertyId: property.id },
    });

    // 3. Create a clean test ticket in TRIAGED status ready for concurrent assignment
    const ticket = await prisma.ticket.create({
      data: {
        organisationId: org.id,
        ticketNumber: `RACE-${Date.now()}`,
        propertyId: property.id,
        unitId: unit.id,
        createdById: resident.id,
        title: 'AC-1.2 Concurrency Test: Burst Pipe Race Condition',
        description: 'Testing 20 simultaneous technician assignment requests at the exact same millisecond.',
        category: 'Plumbing',
        priority: TicketPriority.URGENT,
        status: TicketStatus.TRIAGED,
      },
    });

    testTicketId = ticket.id;
  });

  afterAll(async () => {
    // Clean up test ticket and its events
    if (testTicketId) {
      await prisma.ticketEvent.deleteMany({ where: { ticketId: testTicketId } });
      await prisma.ticket.deleteMany({ where: { id: testTicketId } });
    }
  });

  it('AC-1.2: 20 parallel assignment requests produce exactly 1 success and 19 clean conflict responses', async () => {
    // Fire exactly 20 parallel requests at the exact same millisecond using Promise.all
    const PARALLEL_REQUEST_COUNT = 20;

    const assignmentPromises = Array.from({ length: PARALLEL_REQUEST_COUNT }).map(() =>
      request(app)
        .patch(`/api/v1/tickets/${testTicketId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ assignedTechnicianId: technicianId })
    );

    const responses = await Promise.all(assignmentPromises);

    // Filter responses by status
    const successfulResponses = responses.filter((r) => r.status === 200);
    const conflictResponses = responses.filter((r) => r.status === 422 || r.status === 400);

    // AC-1.2 Verification: Exactly 1 succeeds, exactly 19 fail
    expect(successfulResponses.length).toBe(1);
    expect(conflictResponses.length).toBe(19);

    // Verify successful response payload
    const successBody = successfulResponses[0].body;
    expect(successBody.success).toBe(true);
    expect(successBody.data.status).toBe(TicketStatus.ASSIGNED);
    expect(successBody.data.assignedTechnicianId).toBe(technicianId);

    // Verify all 19 conflict responses returned ERR_ILLEGAL_STATE_TRANSITION
    for (const conflict of conflictResponses) {
      expect(conflict.body.success).toBe(false);
      expect(conflict.body.error.code).toBe('ERR_ILLEGAL_STATE_TRANSITION');
      expect(conflict.body.error.message).toContain('ERR_ILLEGAL_STATE_TRANSITION');
    }

    // Verify Database State Integrity
    const ticketInDb = await prisma.ticket.findUniqueOrThrow({
      where: { id: testTicketId },
    });
    expect(ticketInDb.status).toBe(TicketStatus.ASSIGNED);
    expect(ticketInDb.assignedTechnicianId).toBe(technicianId);

    // Verify Audit Trail Integrity: Exactly 1 ASSIGNMENT event recorded
    const assignmentEvents = await prisma.ticketEvent.findMany({
      where: {
        ticketId: testTicketId,
        eventType: TicketEventType.ASSIGNMENT,
      },
    });
    expect(assignmentEvents.length).toBe(1);
  });
});
