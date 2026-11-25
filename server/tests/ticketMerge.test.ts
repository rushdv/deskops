import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { TicketStatus, TicketPriority, TicketEventType } from '@prisma/client';

describe('CR-1 & AC-1.4: Duplicate Ticket Merge', () => {
  let adminToken: string;
  let techToken: string;
  let primaryTicketId: string;
  let duplicateTicketId: string;
  let commentOnDuplicateId: string;
  let orgId: string;

  beforeAll(async () => {
    // 1. Authenticate Admin and Technician
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@greenfield.com', password: 'Password123!' });
    expect(adminLogin.status).toBe(200);
    adminToken = adminLogin.body.data.accessToken;

    const techLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'tech@greenfield.com', password: 'Password123!' });
    expect(techLogin.status).toBe(200);
    techToken = techLogin.body.data.accessToken;

    // 2. Fetch seed data
    const org = await prisma.organisation.findFirstOrThrow({ where: { slug: 'greenfield-facilities' } });
    orgId = org.id;

    const property = await prisma.property.findFirstOrThrow({ where: { organisationId: orgId } });
    const unit = await prisma.unit.findFirstOrThrow({ where: { propertyId: property.id } });
    const resident = await prisma.user.findFirstOrThrow({ where: { email: 'resident@greenfield.com' } });

    // 3. Create Primary Ticket
    const primary = await prisma.ticket.create({
      data: {
        organisationId: orgId,
        ticketNumber: `PRIMARY-${Date.now()}`,
        propertyId: property.id,
        unitId: unit.id,
        createdById: resident.id,
        title: 'Primary Maintenance Ticket: Hallway Water Leak',
        description: 'First reported water leak in 2nd floor corridor.',
        category: 'Plumbing',
        priority: TicketPriority.HIGH,
        status: TicketStatus.TRIAGED,
      },
    });
    primaryTicketId = primary.id;

    // 4. Create Duplicate Ticket
    const duplicate = await prisma.ticket.create({
      data: {
        organisationId: orgId,
        ticketNumber: `DUP-${Date.now()}`,
        propertyId: property.id,
        unitId: unit.id,
        createdById: resident.id,
        title: 'Duplicate Water Dripping from Ceiling',
        description: 'Second resident reporting the identical ceiling leak.',
        category: 'Plumbing',
        priority: TicketPriority.MEDIUM,
        status: TicketStatus.NEW,
      },
    });
    duplicateTicketId = duplicate.id;

    // 5. Add a comment and a watcher to Duplicate Ticket
    const comment = await prisma.comment.create({
      data: {
        organisationId: orgId,
        ticketId: duplicateTicketId,
        authorId: resident.id,
        content: 'I noticed the drip is getting heavier near apartment 204.',
      },
    });
    commentOnDuplicateId = comment.id;

    await prisma.watcher.create({
      data: {
        organisationId: orgId,
        ticketId: duplicateTicketId,
        userId: resident.id,
      },
    });
  });

  afterAll(async () => {
    // Cleanup created test tickets and events
    for (const tid of [primaryTicketId, duplicateTicketId]) {
      if (tid) {
        await prisma.comment.deleteMany({ where: { ticketId: tid } });
        await prisma.watcher.deleteMany({ where: { ticketId: tid } });
        await prisma.ticketEvent.deleteMany({ where: { ticketId: tid } });
        await prisma.ticket.deleteMany({ where: { id: tid } });
      }
    }
  });

  it('AC-1.4: Admin successfully merges duplicate ticket into primary ticket', async () => {
    const res = await request(app)
      .post(`/api/v1/tickets/${primaryTicketId}/merge`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        duplicateTicketId,
        reason: 'Duplicate report of hallway ceiling drip.',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { primaryTicket, duplicateTicket } = res.body.data;

    // Duplicate ticket must be closed
    expect(duplicateTicket.status).toBe(TicketStatus.CLOSED);

    // Comments must now belong to the primary ticket
    const movedComment = await prisma.comment.findUniqueOrThrow({
      where: { id: commentOnDuplicateId },
    });
    expect(movedComment.ticketId).toBe(primaryTicketId);

    // Watchers must now belong to primary ticket
    const primaryWatchers = await prisma.watcher.findMany({
      where: { ticketId: primaryTicketId },
    });
    expect(primaryWatchers.length).toBeGreaterThanOrEqual(1);

    // Audit events must be recorded on both tickets
    const primaryEvents = await prisma.ticketEvent.findMany({
      where: { ticketId: primaryTicketId, eventType: TicketEventType.TICKET_MERGED },
    });
    expect(primaryEvents.length).toBe(1);

    const duplicateEvents = await prisma.ticketEvent.findMany({
      where: { ticketId: duplicateTicketId, eventType: TicketEventType.TICKET_MERGED },
    });
    expect(duplicateEvents.length).toBe(1);
    expect(duplicateEvents[0].toStatus).toBe(TicketStatus.CLOSED);
  });

  it('Rejects merge when non-admin attempts to merge tickets', async () => {
    const res = await request(app)
      .post(`/api/v1/tickets/${primaryTicketId}/merge`)
      .set('Authorization', `Bearer ${techToken}`)
      .send({ duplicateTicketId });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('Rejects merge when attempting to merge a ticket into itself', async () => {
    const res = await request(app)
      .post(`/api/v1/tickets/${primaryTicketId}/merge`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ duplicateTicketId: primaryTicketId });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ERR_VALIDATION_FAILED');
  });

  it('Rejects merge if duplicate ticket is already CLOSED', async () => {
    // Attempting to merge again now that duplicate is CLOSED
    const res = await request(app)
      .post(`/api/v1/tickets/${primaryTicketId}/merge`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ duplicateTicketId });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ERR_ILLEGAL_STATE_TRANSITION');
  });
});
