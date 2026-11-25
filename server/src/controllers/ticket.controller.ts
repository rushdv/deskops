import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.js';
import { TicketService } from '../services/ticket.service.js';
import { TicketStatus } from '@prisma/client';

export const listTickets = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tickets = await TicketService.listTickets(req.tenant!, req.user!);
    res.status(200).json({ success: true, data: tickets });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Failed to list tickets' },
    });
  }
};

export const getTicketById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const ticket = await TicketService.getTicketById(req.tenant!, req.user!, req.params.id);
    if (!ticket) {
      res.status(404).json({
        success: false,
        error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found' },
      });
      return;
    }
    res.status(200).json({ success: true, data: ticket });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Failed to retrieve ticket' },
    });
  }
};

export const createTicket = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { propertyId, unitId, title, description, category, priority } = req.body;

    if (!propertyId || !unitId || !title || !description || !category) {
      res.status(400).json({
        success: false,
        error: { code: 'ERR_VALIDATION_FAILED', message: 'propertyId, unitId, title, description, and category are required' },
      });
      return;
    }

    const ticket = await TicketService.createTicket(req.tenant!, req.user!, {
      propertyId,
      unitId,
      title,
      description,
      category,
      priority,
    });

    res.status(201).json({ success: true, data: ticket });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: { code: 'ERR_TICKET_CREATION_FAILED', message: err instanceof Error ? err.message : 'Failed to create ticket' },
    });
  }
};

export const triageTicket = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { category, priority } = req.body;

    if (!category || !priority) {
      res.status(400).json({
        success: false,
        error: { code: 'ERR_VALIDATION_FAILED', message: 'category and priority are required' },
      });
      return;
    }

    const ticket = await TicketService.triageTicket(req.tenant!, req.user!, req.params.id, {
      category,
      priority,
    });

    if (!ticket) {
      res.status(404).json({
        success: false,
        error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found' },
      });
      return;
    }

    res.status(200).json({ success: true, data: ticket });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Triage failed';
    const isStateError = message.includes('ERR_ILLEGAL_STATE_TRANSITION');
    res.status(isStateError ? 422 : 400).json({
      success: false,
      error: { code: isStateError ? 'ERR_ILLEGAL_STATE_TRANSITION' : 'ERR_TRIAGE_FAILED', message },
    });
  }
};

export const assignTicket = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { assignedTechnicianId } = req.body;

    if (!assignedTechnicianId) {
      res.status(400).json({
        success: false,
        error: { code: 'ERR_VALIDATION_FAILED', message: 'assignedTechnicianId is required' },
      });
      return;
    }

    const ticket = await TicketService.assignTicket(
      req.tenant!,
      req.user!,
      req.params.id,
      assignedTechnicianId
    );

    if (!ticket) {
      res.status(404).json({
        success: false,
        error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found' },
      });
      return;
    }

    res.status(200).json({ success: true, data: ticket });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Assignment failed';
    const isStateError = message.includes('ERR_ILLEGAL_STATE_TRANSITION');
    res.status(isStateError ? 422 : 400).json({
      success: false,
      error: { code: isStateError ? 'ERR_ILLEGAL_STATE_TRANSITION' : 'ERR_ASSIGNMENT_FAILED', message },
    });
  }
};

export const updateTicketStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { status, reason, notes } = req.body;

    if (!status || !Object.values(TicketStatus).includes(status)) {
      res.status(400).json({
        success: false,
        error: { code: 'ERR_VALIDATION_FAILED', message: 'Valid status is required' },
      });
      return;
    }

    const ticket = await TicketService.updateTicketStatus(
      req.tenant!,
      req.user!,
      req.params.id,
      status,
      reason || notes
    );

    if (!ticket) {
      res.status(404).json({
        success: false,
        error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found' },
      });
      return;
    }

    res.status(200).json({ success: true, data: ticket });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Status update failed';
    const isStateError = message.includes('ERR_ILLEGAL_STATE_TRANSITION');
    res.status(isStateError ? 422 : 400).json({
      success: false,
      error: { code: isStateError ? 'ERR_ILLEGAL_STATE_TRANSITION' : 'ERR_STATUS_UPDATE_FAILED', message },
    });
  }
};

export const mergeTickets = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const primaryTicketId = req.params.id;
    const { duplicateTicketId, reason } = req.body;

    if (!duplicateTicketId) {
      res.status(400).json({
        success: false,
        error: { code: 'ERR_VALIDATION_FAILED', message: 'duplicateTicketId in request body is required' },
      });
      return;
    }

    const result = await TicketService.mergeTickets(
      req.tenant!,
      req.user!,
      primaryTicketId,
      duplicateTicketId,
      reason
    );

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ticket merge failed';
    const isStateError = message.includes('ERR_ILLEGAL_STATE_TRANSITION');
    const isValidationError = message.includes('ERR_VALIDATION_FAILED');
    const code = isStateError
      ? 'ERR_ILLEGAL_STATE_TRANSITION'
      : isValidationError
      ? 'ERR_VALIDATION_FAILED'
      : 'ERR_MERGE_FAILED';

    res.status(isStateError ? 422 : 400).json({
      success: false,
      error: { code, message },
    });
  }
};
