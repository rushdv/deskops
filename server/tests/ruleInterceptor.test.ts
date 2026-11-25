import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import prisma from '../src/lib/prisma.js';
import { RuleInterceptor } from '../src/services/ruleInterceptor.js';
import { TicketPriority, TicketEventType } from '@prisma/client';

describe('FR-1.08 & AC-1.5: Client-Specific Business Rule Interceptor', () => {
  let residentToken: string;
  let propertyId: string;
  let unitId: string;
  let createdTicketId: string;

  beforeAll(async () => {
    // 1. Authenticate Resident
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'resident@greenfield.com', password: 'Password123!' });
    expect(loginRes.status).toBe(200);
    residentToken = loginRes.body.data.accessToken;

    const org = await prisma.organisation.findFirstOrThrow({ where: { slug: 'greenfield-facilities' } });
    const property = await prisma.property.findFirstOrThrow({ where: { organisationId: org.id } });
    const unit = await prisma.unit.findFirstOrThrow({ where: { propertyId: property.id } });

    propertyId = property.id;
    unitId = unit.id;
  });

  afterAll(async () => {
    if (createdTicketId) {
      await prisma.ticketEvent.deleteMany({ where: { ticketId: createdTicketId } });
      await prisma.ticket.deleteMany({ where: { id: createdTicketId } });
    }
  });

  describe('RuleInterceptor Unit Evaluation', () => {
    it('Elevates safety hazards (gas leak, electrical fire, sparking) to URGENT priority', () => {
      const evaluation = RuleInterceptor.applyCreationRules({
        title: 'Apparent gas leak in corridor',
        description: 'Strong gas smell coming from meter box.',
        category: 'Maintenance',
        priority: TicketPriority.LOW,
      });

      expect(evaluation.isEscalated).toBe(true);
      expect(evaluation.modifiedPriority).toBe(TicketPriority.URGENT);
      expect(evaluation.appliedRules[0]).toContain('RULE_SAFETY_HAZARD_ELEVATION');
    });

    it('Preserves original priority when no safety hazard keywords are present', () => {
      const evaluation = RuleInterceptor.applyCreationRules({
        title: 'Loose cupboard door hinge',
        description: 'The kitchen cabinet hinge is wobbly.',
        category: 'Carpentry',
        priority: TicketPriority.LOW,
      });

      expect(evaluation.isEscalated).toBe(false);
      expect(evaluation.modifiedPriority).toBe(TicketPriority.LOW);
      expect(evaluation.appliedRules.length).toBe(0);
    });

    it('Applies water damage floor rule elevating plumbing water leaks to at least HIGH', () => {
      const evaluation = RuleInterceptor.applyCreationRules({
        title: 'Bathroom water leak',
        description: 'Noticeable water leak under the bathroom basin.',
        category: 'Plumbing',
        priority: TicketPriority.LOW,
      });

      expect(evaluation.modifiedPriority).toBe(TicketPriority.HIGH);
      expect(evaluation.appliedRules).toContain('RULE_WATER_DAMAGE_FLOOR: Minimum priority elevated to HIGH');
    });
  });

  describe('Integration with Ticket Creation API (AC-1.5)', () => {
    it('AC-1.5: Submitting a safety hazard ticket automatically elevates priority and logs rule audit metadata', async () => {
      const res = await request(app)
        .post('/api/v1/tickets')
        .set('Authorization', `Bearer ${residentToken}`)
        .send({
          propertyId,
          unitId,
          title: 'Exposed wire sparking near elevator',
          description: 'Dangerous exposed wire sparking when residents walk past.',
          category: 'Electrical',
          priority: TicketPriority.LOW, // Resident sent LOW, but rule should elevate to URGENT
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const ticket = res.body.data;
      createdTicketId = ticket.id;

      // Assert rule intercepted and elevated priority
      expect(ticket.priority).toBe(TicketPriority.URGENT);

      // Verify audit event contains rule evaluation metadata
      const creationEvent = await prisma.ticketEvent.findFirstOrThrow({
        where: {
          ticketId: createdTicketId,
          eventType: TicketEventType.STATUS_CHANGE,
        },
      });

      const metadata = creationEvent.metadata as Record<string, unknown>;
      expect(metadata.initialPriority).toBe(TicketPriority.LOW);
      expect(metadata.evaluatedPriority).toBe(TicketPriority.URGENT);
      expect(Array.isArray(metadata.appliedRules)).toBe(true);
    });
  });
});
