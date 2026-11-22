import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AttachmentStatus, TicketEventType } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { config } from '../config/index.js';
import { TenantContext, UserSessionPayload } from '../types/auth.js';
import { enqueueThumbnailJob } from '../lib/queues.js';

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB maximum file size (FR-1.04)

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
];

export const s3Client = new S3Client({
  endpoint: config.s3Endpoint,
  region: config.s3Region,
  forcePathStyle: true, // Required for MinIO / LocalStack / R2 path addressing
  credentials: {
    accessKeyId: config.s3AccessKey,
    secretAccessKey: config.s3SecretKey,
  },
});

export interface PresignedUploadRequestDTO {
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export class StorageService {
  /**
   * Generate direct-to-cloud presigned PUT URL and register PENDING_UPLOAD attachment
   */
  static async generatePresignedUploadUrl(
    tenant: TenantContext,
    user: UserSessionPayload,
    ticketId: string,
    dto: PresignedUploadRequestDTO
  ) {
    // 1. File size validation (max 10MB)
    if (!dto.fileSize || dto.fileSize > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum permitted limit of 10MB (${(dto.fileSize / (1024 * 1024)).toFixed(1)}MB provided).`);
    }

    // 2. MIME type whitelist validation
    if (!dto.mimeType || !ALLOWED_MIME_TYPES.includes(dto.mimeType)) {
      throw new Error(`Unsupported MIME type: '${dto.mimeType}'. Allowed: images (JPEG, PNG, WEBP, GIF) and PDF documents.`);
    }

    // 3. Verify ticket exists and belongs to the active tenant
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, organisationId: tenant.organisationId },
    });

    if (!ticket) {
      throw new Error('Ticket not found in your organisation.');
    }

    // 4. Generate deterministic, tenant-isolated S3 storage key
    const sanitizedFileName = dto.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `tenants/${tenant.organisationId}/tickets/${ticketId}/${Date.now()}-${sanitizedFileName}`;

    // 5. Generate S3 presigned PUT URL (valid for 15 minutes)
    const command = new PutObjectCommand({
      Bucket: config.s3Bucket,
      Key: storageKey,
      ContentType: dto.mimeType,
      Metadata: {
        organisationId: tenant.organisationId,
        ticketId,
        uploaderId: user.userId,
      },
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    // 6. Record attachment in database as PENDING_UPLOAD
    const attachment = await prisma.attachment.create({
      data: {
        organisationId: tenant.organisationId,
        ticketId,
        uploaderId: user.userId,
        fileName: dto.fileName,
        fileSize: dto.fileSize,
        mimeType: dto.mimeType,
        storageKey,
        status: AttachmentStatus.PENDING_UPLOAD,
      },
    });

    return {
      attachmentId: attachment.id,
      uploadUrl,
      storageKey,
      expiresIn: 900,
    };
  }

  /**
   * Confirm upload success, activate attachment, log audit event, and dispatch thumbnail job
   */
  static async confirmUpload(
    tenant: TenantContext,
    user: UserSessionPayload,
    attachmentId: string
  ) {
    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, organisationId: tenant.organisationId },
      include: { ticket: true },
    });

    if (!attachment) {
      throw new Error('Attachment not found in your organisation.');
    }

    return prisma.$transaction(async (tx) => {
      // 1. Activate attachment status
      const updated = await tx.attachment.update({
        where: { id: attachmentId },
        data: { status: AttachmentStatus.ACTIVE },
      });

      // 2. Append immutable audit event
      await tx.ticketEvent.create({
        data: {
          organisationId: tenant.organisationId,
          ticketId: attachment.ticketId,
          actorId: user.userId,
          eventType: TicketEventType.ATTACHMENT_ADDED,
          metadata: {
            attachmentId: updated.id,
            fileName: updated.fileName,
            fileSize: updated.fileSize,
            mimeType: updated.mimeType,
          },
        },
      });

      // 3. Dispatch thumbnail generation job to BullMQ queue if image
      if (updated.mimeType.startsWith('image/')) {
        await enqueueThumbnailJob({
          attachmentId: updated.id,
          storageKey: updated.storageKey,
          mimeType: updated.mimeType,
          ticketId: attachment.ticketId,
          organisationId: tenant.organisationId,
        });
      }

      return updated;
    });
  }

  /**
   * List all active attachments for a ticket with secure presigned GET download URLs
   */
  static async listTicketAttachments(
    tenant: TenantContext,
    ticketId: string
  ) {
    const attachments = await prisma.attachment.findMany({
      where: {
        ticketId,
        organisationId: tenant.organisationId,
        status: AttachmentStatus.ACTIVE,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        uploader: { select: { id: true, name: true, email: true } },
      },
    });

    // Append signed GET URLs for client consumption
    return Promise.all(
      attachments.map(async (att) => {
        const getCommand = new GetObjectCommand({
          Bucket: config.s3Bucket,
          Key: att.storageKey,
        });
        const downloadUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });
        return {
          ...att,
          downloadUrl,
        };
      })
    );
  }
}
