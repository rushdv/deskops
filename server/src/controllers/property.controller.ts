import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.js';
import prisma from '../lib/prisma.js';
import { RoleName } from '@prisma/client';

export const listPropertiesAndUnits = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const properties = await prisma.property.findMany({
      where: { organisationId: req.tenant!.organisationId },
      include: {
        units: {
          select: { id: true, unitNumber: true, floor: true },
        },
      },
    });

    res.status(200).json({ success: true, data: properties });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Failed to list properties' },
    });
  }
};

export const listTechnicians = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const technicians = await prisma.user.findMany({
      where: {
        organisationId: req.tenant!.organisationId,
        isActive: true,
        role: { name: RoleName.TECHNICIAN },
      },
      select: {
        id: true,
        name: true,
        email: true,
        technicianProfile: {
          select: {
            phone: true,
            maxActiveTickets: true,
            skills: { select: { skill: true } },
            coverages: { select: { propertyId: true } },
          },
        },
      },
    });

    res.status(200).json({ success: true, data: technicians });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Failed to list technicians' },
    });
  }
};
