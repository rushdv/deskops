import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.js';
import { NotificationService } from '../services/notification.service.js';

export const getNotifications = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const tenantId = req.tenant?.organisationId;
    const userId = req.user?.userId;

    if (!tenantId || !userId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication and tenant context are required' },
      });
      return;
    }

    const notifications = await NotificationService.listNotifications(tenantId, userId);
    const unreadCount = notifications.filter((n: { isRead: boolean }) => !n.isRead).length;

    res.status(200).json({
      success: true,
      data: notifications,
      unreadCount,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: {
        code: 'NOTIFICATIONS_FETCH_FAILED',
        message: err instanceof Error ? err.message : 'Failed to fetch notifications',
      },
    });
  }
};

export const markNotificationAsRead = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const tenantId = req.tenant?.organisationId;
    const userId = req.user?.userId;

    if (!tenantId || !userId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication and tenant context are required' },
      });
      return;
    }

    const updated = await NotificationService.markAsRead(tenantId, userId, req.params.id);

    if (!updated) {
      res.status(404).json({
        success: false,
        error: { code: 'NOTIFICATION_NOT_FOUND', message: 'Notification not found' },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: {
        code: 'NOTIFICATION_UPDATE_FAILED',
        message: err instanceof Error ? err.message : 'Failed to mark notification as read',
      },
    });
  }
};

export const markAllNotificationsAsRead = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const tenantId = req.tenant?.organisationId;
    const userId = req.user?.userId;

    if (!tenantId || !userId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication and tenant context are required' },
      });
      return;
    }

    const result = await NotificationService.markAllAsRead(tenantId, userId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: {
        code: 'NOTIFICATIONS_BULK_UPDATE_FAILED',
        message: err instanceof Error ? err.message : 'Failed to mark all notifications as read',
      },
    });
  }
};
