export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'DeskOps Multi-Tenant Service Desk API',
    version: '1.0.0',
    description:
      'Enterprise multi-tenant service desk and maintenance ticketing core platform for property and facilities management operations (Phase 1).',
    contact: {
      name: 'DeskOps Engineering Team',
      url: 'https://github.com/rushdv/deskops',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1 Base Endpoint',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide verified JWT access token (Bearer <token>)',
      },
    },
    schemas: {
      StandardError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'ERR_VALIDATION_FAILED' },
              message: { type: 'string', example: 'Detailed error explanation' },
            },
          },
        },
      },
      Ticket: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          ticketNumber: { type: 'string', example: 'TICK-10026' },
          title: { type: 'string', example: 'Corridor Water Leak' },
          description: { type: 'string', example: 'Water dripping from 2nd floor ceiling' },
          category: { type: 'string', example: 'Plumbing' },
          priority: {
            type: 'string',
            enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
            example: 'HIGH',
          },
          status: {
            type: 'string',
            enum: ['NEW', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED'],
            example: 'IN_PROGRESS',
          },
          propertyId: { type: 'string', format: 'uuid' },
          unitId: { type: 'string', format: 'uuid' },
          createdById: { type: 'string', format: 'uuid' },
          assignedTechnicianId: { type: 'string', format: 'uuid', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Comment: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          ticketId: { type: 'string', format: 'uuid' },
          authorId: { type: 'string', format: 'uuid' },
          content: { type: 'string', example: 'Parts ordered from plumbing supplier.' },
          visibility: { type: 'string', enum: ['PUBLIC', 'INTERNAL'], example: 'PUBLIC' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  security: [{ BearerAuth: [] }],
  paths: {
    '/health': {
      get: {
        summary: 'Service Health Check',
        tags: ['System'],
        security: [],
        responses: {
          '200': {
            description: 'API service is healthy and operational',
          },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Authenticate User & Resolve Tenant Session',
        tags: ['Authentication'],
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'admin@greenfield.com' },
                  password: { type: 'string', example: 'Password123!' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Authenticated successfully with JWT access and refresh tokens' },
          '401': { description: 'Invalid credentials' },
        },
      },
    },
    '/tickets': {
      get: {
        summary: 'List Tenant Tickets (Scoped by User Role)',
        tags: ['Tickets'],
        responses: {
          '200': {
            description: 'List of tickets visible to current role',
          },
        },
      },
      post: {
        summary: 'Submit New Maintenance Ticket (Resident / Admin)',
        tags: ['Tickets'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['propertyId', 'unitId', 'title', 'description', 'category'],
                properties: {
                  propertyId: { type: 'string' },
                  unitId: { type: 'string' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  category: { type: 'string', example: 'Plumbing' },
                  priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Ticket created successfully with audit event' },
        },
      },
    },
    '/tickets/{id}': {
      get: {
        summary: 'Get Ticket Details & Audit Timeline',
        tags: ['Tickets'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Ticket details retrieved' },
          '404': { description: 'Ticket not found or cross-tenant access denied' },
        },
      },
    },
    '/tickets/{id}/triage': {
      patch: {
        summary: 'Triage Ticket (Admin Only)',
        tags: ['Tickets'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['category', 'priority'],
                properties: {
                  category: { type: 'string', example: 'Electrical' },
                  priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Ticket triaged successfully' },
        },
      },
    },
    '/tickets/{id}/assign': {
      patch: {
        summary: 'Assign Technician with Concurrency Locking (Admin Only - AC-1.2)',
        tags: ['Tickets'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['assignedTechnicianId'],
                properties: {
                  assignedTechnicianId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Technician assigned successfully' },
          '422': { description: 'ERR_ILLEGAL_STATE_TRANSITION: Race condition conflict or illegal status' },
        },
      },
    },
    '/tickets/{id}/status': {
      patch: {
        summary: 'Update Ticket State Machine Status',
        tags: ['Tickets'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: {
                    type: 'string',
                    enum: ['IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED'],
                  },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Status updated successfully' },
        },
      },
    },
    '/tickets/{id}/merge': {
      post: {
        summary: 'CR-1: Merge Duplicate Ticket into Primary Ticket (Admin Only - AC-1.4)',
        tags: ['Tickets'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['duplicateTicketId'],
                properties: {
                  duplicateTicketId: { type: 'string' },
                  reason: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Tickets merged, comments moved, duplicate closed, events logged' },
        },
      },
    },
    '/tickets/{id}/comments': {
      get: {
        summary: 'List Ticket Comments (Role-Filtered: Residents only see PUBLIC)',
        tags: ['Comments'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Filtered comments list' },
        },
      },
      post: {
        summary: 'Post New Comment / Staff Note (FR-1.07)',
        tags: ['Comments'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['content'],
                properties: {
                  content: { type: 'string' },
                  visibility: { type: 'string', enum: ['PUBLIC', 'INTERNAL'], default: 'PUBLIC' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Comment created and COMMENT_ADDED audit event logged' },
        },
      },
    },
    '/attachments/presigned-url': {
      post: {
        summary: 'Request S3/R2 Presigned PUT Upload URL (FR-1.04)',
        tags: ['Attachments'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['ticketId', 'fileName', 'fileSize', 'mimeType'],
                properties: {
                  ticketId: { type: 'string' },
                  fileName: { type: 'string', example: 'leak_photo.jpg' },
                  fileSize: { type: 'integer', example: 1048576 },
                  mimeType: { type: 'string', example: 'image/jpeg' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Presigned upload URL generated successfully' },
        },
      },
    },
    '/attachments/{id}/confirm': {
      post: {
        summary: 'Confirm S3 Upload & Enqueue Thumbnail Worker Job',
        tags: ['Attachments'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Attachment activated and queued for thumbnail generation' },
        },
      },
    },
    '/properties': {
      get: {
        summary: 'List Tenant Properties with Units',
        tags: ['Properties'],
        responses: {
          '200': { description: 'Properties and units list' },
        },
      },
    },
  },
};
