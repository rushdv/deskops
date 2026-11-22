import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { RoleName, TicketStatus, TicketPriority } from '@prisma/client';

describe('NFR-01 & AC-1.1: Strict Multi-Tenant Isolation & Zero Leaks', () => {
  let tenantAToken: string;
  let tenantBToken: string;
  let tenantAOrgId: string;
  let tenantBOrgId: string;
  let tenantATicketId: string;
  let tenantBUserId: string;

  beforeAll(async () => {
    // 1. Fetch Tenant A (Greenfield Facilities) & Admin Token
    const tenantA = await prisma.organisation.findFirstOrThrow({
      where: { slug: 'greenfield-facilities' },
    });
    tenantAOrgId = tenantA.id;

    const loginResA = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@greenfield.com', password: 'Password123!' });
    expect(loginResA.status).toBe(200);
    tenantAToken = loginResA.body.data.accessToken;

    // 2. Fetch seeded property and unit for Tenant A
    const propA = await prisma.property.findFirstOrThrow({ where: { organisationId: tenantAOrgId } });
    const unitA = await prisma.unit.findFirstOrThrow({ where: { propertyId: propA.id } });
    const residentA = await prisma.user.findFirstOrThrow({ where: { email: 'resident@greenfield.com' } });

    // 3. Create Tenant A Test Ticket
    const ticketA = await prisma.ticket.create({
      data: {
        organisationId: tenantAOrgId,
        ticketNumber: `TENANT-A-${Date.now()}`,
        propertyId: propA.id,
        unitId: unitA.id,
        createdById: residentA.id,
        title: 'Tenant A Confidential Maintenance Issue',
        description: 'Under no circumstances should Tenant B be able to inspect or mutate this ticket.',
        category: 'Electrical',
        priority: TicketPriority.HIGH,
        status: TicketStatus.TRIAGED,
      },
    });
    tenantATicketId = ticketA.id;

    // 4. Create an isolated second tenant (Tenant B: Apex Property Group)
    const adminRole = await prisma.role.findFirstOrThrow({ where: { name: RoleName.ORGANISATION_ADMIN } });
    const passwordHash = await bcrypt.hash('Password123!', 10);

    const tenantB = await prisma.organisation.upsert({
      where: { slug: 'apex-property-group' },
      update: {},
      create: {
        name: 'Apex Property Group',
        slug: 'apex-property-group',
        reopenWindowHours: 48,
      },
    });
    tenantBOrgId = tenantB.id;

    const userB = await prisma.user.upsert({
      where: {
        organisationId_email: {
          organisationId: tenantBOrgId,
          email: 'admin@apex-property.com',
        },
      },
      update: {},
      create: {
        organisationId: tenantBOrgId,
        email: 'admin@apex-property.com',
        name: 'Bob Apex Admin',
        passwordHash,
        roleId: adminRole.id,
        isActive: true,
      },
    });
    tenantBUserId = userB.id;

    // 5. Authenticate as Tenant B Admin
    const loginResB = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@apex-property.com', password: 'Password123!' });
    expect(loginResB.status).toBe(200);
    tenantBToken = loginResB.body.data.accessToken;
  });

  afterAll(async () => {
    // Cleanup test records
    if (tenantATicketId) {
      await prisma.ticketEvent.deleteMany({ where: { ticketId: tenantATicketId } });
      await prisma.ticket.deleteMany({ where: { id: tenantATicketId } });
    }
    if (tenantBUserId) {
      await prisma.user.deleteMany({ where: { id: tenantBUserId } });
    }
    if (tenantBOrgId) {
      await prisma.organisation.deleteMany({ where: { id: tenantBOrgId } });
    }
  });

  it('AC-1.1: Fetching Tenant A ticket using Tenant B JWT returns 404 Not Found', async () => {
    const res = await request(app)
      .get(`/api/v1/tickets/${tenantATicketId}`)
      .set('Authorization', `Bearer ${tenantBToken}`);

    // Must return 404 Not Found rather than leaking data or showing 403 Forbidden
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('TICKET_NOT_FOUND');
  });

  it('AC-1.1: Triaging Tenant A ticket using Tenant B JWT returns 404 Not Found', async () => {
    const res = await request(app)
      .patch(`/api/v1/tickets/${tenantATicketId}/triage`)
      .set('Authorization', `Bearer ${tenantBToken}`)
      .send({ category: 'Plumbing', priority: 'LOW' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('TICKET_NOT_FOUND');
  });

  it('AC-1.1: Listing tickets as Tenant B does not return Tenant A tickets', async () => {
    const res = await request(app)
      .get('/api/v1/tickets')
      .set('Authorization', `Bearer ${tenantBToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const tickets = res.body.data;
    const leakedTicket = tickets.find((t: { id: string }) => t.id === tenantATicketId);
    expect(leakedTicket).toBeUndefined();
  });

  it('AC-1.1: Requesting S3 presigned upload URL for Tenant A ticket with Tenant B JWT is rejected', async () => {
    const res = await request(app)
      .post('/api/v1/attachments/presigned-url')
      .set('Authorization', `Bearer ${tenantBToken}`)
      .send({
        ticketId: tenantATicketId,
        fileName: 'tenant_b_attempt.png',
        fileSize: 1024,
        mimeType: 'image/png',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('Ticket not found in your organisation');
  });
});
