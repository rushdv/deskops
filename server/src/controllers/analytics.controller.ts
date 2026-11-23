import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.js';
import { AnalyticsService } from '../services/analytics.service.js';

export const getAnalyticsSummary = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const tenantId = req.tenant?.organisationId;
    if (!tenantId) {
      res.status(400).json({
        success: false,
        error: { code: 'TENANT_REQUIRED', message: 'Tenant context is required' },
      });
      return;
    }

    const data = await AnalyticsService.getSummary(tenantId, req.user?.role);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: {
        code: 'ANALYTICS_FETCH_FAILED',
        message: err instanceof Error ? err.message : 'Failed to fetch analytics summary',
      },
    });
  }
};
