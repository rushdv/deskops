import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service.js';
import { AuthenticatedRequest } from '../types/auth.js';
import prisma from '../lib/prisma.js';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: {
          code: 'ERR_VALIDATION_FAILED',
          message: 'Both email and password are required',
        },
      });
      return;
    }

    const result = await AuthService.login(email, password);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    res.status(401).json({
      success: false,
      error: {
        code: 'ERR_AUTHENTICATION_FAILED',
        message: err instanceof Error ? err.message : 'Authentication failed',
      },
    });
  }
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        success: false,
        error: {
          code: 'ERR_VALIDATION_FAILED',
          message: 'Refresh token is required',
        },
      });
      return;
    }

    const tokens = await AuthService.refreshTokens(refreshToken);
    res.status(200).json({
      success: true,
      data: tokens,
    });
  } catch (err) {
    res.status(401).json({
      success: false,
      error: {
        code: 'ERR_REFRESH_FAILED',
        message: err instanceof Error ? err.message : 'Refresh failed',
      },
    });
  }
};

export const getCurrentUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        name: true,
        organisationId: true,
        role: { select: { name: true } },
        residentProfile: { select: { unitId: true, unit: { select: { unitNumber: true, property: { select: { name: true } } } } } },
        technicianProfile: { select: { phone: true, skills: true, coverages: true } },
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User record not found' },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: err instanceof Error ? err.message : 'Failed to retrieve profile',
      },
    });
  }
};
