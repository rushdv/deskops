import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.js';
import { StorageService } from '../services/storage.service.js';

export const requestPresignedUrl = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { ticketId, fileName, fileSize, mimeType } = req.body;

    if (!ticketId || !fileName || !fileSize || !mimeType) {
      res.status(400).json({
        success: false,
        error: {
          code: 'ERR_VALIDATION_FAILED',
          message: 'ticketId, fileName, fileSize, and mimeType are required fields.',
        },
      });
      return;
    }

    const data = await StorageService.generatePresignedUploadUrl(
      req.tenant!,
      req.user!,
      ticketId,
      { fileName, fileSize: Number(fileSize), mimeType }
    );

    res.status(201).json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate presigned upload URL';
    res.status(400).json({
      success: false,
      error: { code: 'ERR_UPLOAD_URL_FAILED', message },
    });
  }
};

export const confirmUpload = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: { code: 'ERR_VALIDATION_FAILED', message: 'Attachment ID is required' },
      });
      return;
    }

    const attachment = await StorageService.confirmUpload(
      req.tenant!,
      req.user!,
      id
    );

    res.status(200).json({ success: true, data: attachment });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to confirm attachment upload';
    res.status(400).json({
      success: false,
      error: { code: 'ERR_CONFIRMATION_FAILED', message },
    });
  }
};

export const listTicketAttachments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { ticketId } = req.params;

    if (!ticketId) {
      res.status(400).json({
        success: false,
        error: { code: 'ERR_VALIDATION_FAILED', message: 'ticketId parameter is required' },
      });
      return;
    }

    const attachments = await StorageService.listTicketAttachments(
      req.tenant!,
      ticketId
    );

    res.status(200).json({ success: true, data: attachments });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list attachments';
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message },
    });
  }
};
