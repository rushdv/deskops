import { PrismaClient, RoleName, TicketPriority, TicketStatus, TicketEventType, TechTradeSkill } from '@prisma/client';

const prisma = new PrismaClient();
// Bcrypt hash for 'Password123!' (cost factor 10)
const DEFAULT_PASSWORD_HASH = '$2b$10$S6BJXy0U0te6T5zB4qd2pO2TtZu/PvZ9MZRh99qfb8gPdGWdJ9c36';

async function main() {
  console.log('[Seed] Starting database seeding for DeskOps...');

  // 1. Roles
  console.log('[Seed] Seeding Roles...');
  const adminRole = await prisma.role.upsert({
    where: { name: RoleName.ORGANISATION_ADMIN },
    update: {},
    create: {
      name: RoleName.ORGANISATION_ADMIN,
      description: 'Organisation Administrator with full tenant access',
    },
  });

  const techRole = await prisma.role.upsert({
    where: { name: RoleName.TECHNICIAN },
    update: {},
    create: {
      name: RoleName.TECHNICIAN,
      description: 'Field service engineer servicing assigned properties and tickets',
    },
  });

  const residentRole = await prisma.role.upsert({
    where: { name: RoleName.RESIDENT },
    update: {},
    create: {
      name: RoleName.RESIDENT,
      description: 'Resident occupant submitting and tracking requests for their unit',
    },
  });

  // 2. Base Organisation (Greenfield Facilities)
  console.log('[Seed] Seeding Greenfield Facilities Organisation...');
  const org = await prisma.organisation.upsert({
    where: { slug: 'greenfield-facilities' },
    update: {},
    create: {
      name: 'Greenfield Facilities',
      slug: 'greenfield-facilities',
      reopenWindowHours: 24,
    },
  });

  // 3. Properties
  console.log('[Seed] Seeding Properties...');
  const propertyA = await prisma.property.upsert({
    where: {
      organisationId_code: {
        organisationId: org.id,
        code: 'GF-HGHTS',
      },
    },
    update: {},
    create: {
      organisationId: org.id,
      name: 'Greenfield Heights',
      code: 'GF-HGHTS',
      address: '100 Maple Avenue, Greenfield, CA',
    },
  });

  const propertyB = await prisma.property.upsert({
    where: {
      organisationId_code: {
        organisationId: org.id,
        code: 'GF-CORP',
      },
    },
    update: {},
    create: {
      organisationId: org.id,
      name: 'Greenfield Corporate Tower',
      code: 'GF-CORP',
      address: '250 Enterprise Boulevard, Greenfield, CA',
    },
  });

  // 4. Units
  console.log('[Seed] Seeding Units...');
  const unit4B = await prisma.unit.upsert({
    where: {
      propertyId_unitNumber: {
        propertyId: propertyA.id,
        unitNumber: 'Apt 4B',
      },
    },
    update: {},
    create: {
      organisationId: org.id,
      propertyId: propertyA.id,
      unitNumber: 'Apt 4B',
      floor: '4',
    },
  });

  const unit101 = await prisma.unit.upsert({
    where: {
      propertyId_unitNumber: {
        propertyId: propertyA.id,
        unitNumber: 'Apt 101',
      },
    },
    update: {},
    create: {
      organisationId: org.id,
      propertyId: propertyA.id,
      unitNumber: 'Apt 101',
      floor: '1',
    },
  });

  const suite200 = await prisma.unit.upsert({
    where: {
      propertyId_unitNumber: {
        propertyId: propertyB.id,
        unitNumber: 'Suite 200',
      },
    },
    update: {},
    create: {
      organisationId: org.id,
      propertyId: propertyB.id,
      unitNumber: 'Suite 200',
      floor: '2',
    },
  });

  // 5. Users (One per role per D-1.2 specification)
  console.log('[Seed] Seeding Users...');
  const defaultPassword = DEFAULT_PASSWORD_HASH;

  // Admin User
  const adminUser = await prisma.user.upsert({
    where: {
      organisationId_email: {
        organisationId: org.id,
        email: 'admin@greenfield.com',
      },
    },
    update: {},
    create: {
      organisationId: org.id,
      email: 'admin@greenfield.com',
      passwordHash: defaultPassword,
      name: 'Alice Admin',
      roleId: adminRole.id,
      isActive: true,
    },
  });

  // Technician User
  const techUser = await prisma.user.upsert({
    where: {
      organisationId_email: {
        organisationId: org.id,
        email: 'tech@greenfield.com',
      },
    },
    update: {},
    create: {
      organisationId: org.id,
      email: 'tech@greenfield.com',
      passwordHash: defaultPassword,
      name: 'Bob Technician',
      roleId: techRole.id,
      isActive: true,
    },
  });

  // Resident User
  const residentUser = await prisma.user.upsert({
    where: {
      organisationId_email: {
        organisationId: org.id,
        email: 'resident@greenfield.com',
      },
    },
    update: {},
    create: {
      organisationId: org.id,
      email: 'resident@greenfield.com',
      passwordHash: defaultPassword,
      name: 'Rachel Resident',
      roleId: residentRole.id,
      isActive: true,
    },
  });

  // 6. Profiles & Coverages
  console.log('[Seed] Seeding Profiles & Technician Coverages...');
  await prisma.residentProfile.upsert({
    where: { userId: residentUser.id },
    update: {},
    create: {
      organisationId: org.id,
      userId: residentUser.id,
      unitId: unit4B.id,
      emergencyContact: '+1-555-0199',
    },
  });

  const techProfile = await prisma.technicianProfile.upsert({
    where: { userId: techUser.id },
    update: {},
    create: {
      organisationId: org.id,
      userId: techUser.id,
      phone: '+1-555-0234',
      maxActiveTickets: 5,
    },
  });

  // Skills
  await prisma.technicianSkill.upsert({
    where: {
      technicianId_skill: {
        technicianId: techProfile.id,
        skill: TechTradeSkill.PLUMBING,
      },
    },
    update: {},
    create: {
      technicianId: techProfile.id,
      skill: TechTradeSkill.PLUMBING,
    },
  });

  await prisma.technicianSkill.upsert({
    where: {
      technicianId_skill: {
        technicianId: techProfile.id,
        skill: TechTradeSkill.HVAC,
      },
    },
    update: {},
    create: {
      technicianId: techProfile.id,
      skill: TechTradeSkill.HVAC,
    },
  });

  // Coverage
  await prisma.propertyTechnicianCoverage.upsert({
    where: {
      technicianId_propertyId: {
        technicianId: techProfile.id,
        propertyId: propertyA.id,
      },
    },
    update: {},
    create: {
      technicianId: techProfile.id,
      propertyId: propertyA.id,
    },
  });

  await prisma.propertyTechnicianCoverage.upsert({
    where: {
      technicianId_propertyId: {
        technicianId: techProfile.id,
        propertyId: propertyB.id,
      },
    },
    update: {},
    create: {
      technicianId: techProfile.id,
      propertyId: propertyB.id,
    },
  });

  // 7. Seed Demonstration Tickets & Event Audits
  console.log('[Seed] Seeding Demonstration Tickets...');
  const ticket1 = await prisma.ticket.upsert({
    where: {
      organisationId_ticketNumber: {
        organisationId: org.id,
        ticketNumber: 'TICK-10024',
      },
    },
    update: {},
    create: {
      organisationId: org.id,
      ticketNumber: 'TICK-10024',
      propertyId: propertyA.id,
      unitId: unit4B.id,
      createdById: residentUser.id,
      title: 'Water leak under kitchen sink',
      description: 'Persistent water leaking beneath the main pipe fitting in the kitchen cabinet.',
      category: 'Plumbing',
      priority: TicketPriority.MEDIUM,
      status: TicketStatus.NEW,
    },
  });

  await prisma.ticketEvent.create({
    data: {
      organisationId: org.id,
      ticketId: ticket1.id,
      actorId: residentUser.id,
      eventType: TicketEventType.STATUS_CHANGE,
      fromStatus: null,
      toStatus: TicketStatus.NEW,
      metadata: { reason: 'Resident initial submission via request portal' },
    },
  });

  const ticket2 = await prisma.ticket.upsert({
    where: {
      organisationId_ticketNumber: {
        organisationId: org.id,
        ticketNumber: 'TICK-10025',
      },
    },
    update: {},
    create: {
      organisationId: org.id,
      ticketNumber: 'TICK-10025',
      propertyId: propertyB.id,
      unitId: suite200.id,
      createdById: adminUser.id,
      assignedTechnicianId: techUser.id,
      title: 'HVAC unit blowing warm air',
      description: 'The second-floor server room temperature is elevating; HVAC compressor not kicking in.',
      category: 'HVAC',
      priority: TicketPriority.HIGH,
      status: TicketStatus.ASSIGNED,
    },
  });

  await prisma.ticketEvent.create({
    data: {
      organisationId: org.id,
      ticketId: ticket2.id,
      actorId: adminUser.id,
      eventType: TicketEventType.ASSIGNMENT,
      fromStatus: TicketStatus.TRIAGED,
      toStatus: TicketStatus.ASSIGNED,
      metadata: {
        assignedTechnicianId: techUser.id,
        assignedTechnicianName: techUser.name,
      },
    },
  });

  console.log('[Seed] Seeding completed successfully!');
  console.log('[Seed] Credentials for Demonstration:');
  console.log('   Admin:      admin@greenfield.com     / Password123!');
  console.log('   Technician: tech@greenfield.com      / Password123!');
  console.log('   Resident:   resident@greenfield.com  / Password123!');
}

main()
  .catch((e) => {
    console.error('[Seed Error]:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
