import { Response } from 'express';
import { CommentVisibility } from '@prisma/client';
import { AuthenticatedRequest } from '../types/auth.js';
import { CommentService } from '../services/comment.service.js';

export const listTicketComments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const comments = await CommentService.listComments(req.tenant!, req.user!, req.params.id);

    if (!comments) {
      res.status(404).json({
        success: false,
        error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found' },
      });
      return;
    }

    res.status(200).json({ success: true, data: comments });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: err instanceof Error ? err.message : 'Failed to list comments',
      },
    });
  }
};

export const createTicketComment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { content, visibility } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'ERR_VALIDATION_FAILED', message: 'Comment content is required' },
      });
      return;
    }

    if (visibility !== undefined && !Object.values(CommentVisibility).includes(visibility)) {
      res.status(400).json({
        success: false,
        error: { code: 'ERR_VALIDATION_FAILED', message: 'Visibility must be PUBLIC or INTERNAL' },
      });
      return;
    }

    const comment = await CommentService.createComment(req.tenant!, req.user!, req.params.id, {
      content,
      visibility,
    });

    if (!comment) {
      res.status(404).json({
        success: false,
        error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found' },
      });
      return;
    }

    res.status(201).json({ success: true, data: comment });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to add comment';
    const isForbidden = message.includes('ERR_FORBIDDEN_VISIBILITY');
    res.status(isForbidden ? 403 : 400).json({
      success: false,
      error: {
        code: isForbidden ? 'ERR_FORBIDDEN_VISIBILITY' : 'ERR_COMMENT_CREATION_FAILED',
        message,
      },
    });
  }
};
