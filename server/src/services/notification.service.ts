import { prisma } from '../lib/prisma.js';

export const NotificationService = {
  async listNotifications(tenantId: string, recipientId: string) {
    return prisma.notification.findMany({
      where: {
        organisationId: tenantId,
        recipientId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  },

  async markAsRead(tenantId: string, recipientId: string, notificationId: string) {
    const existing = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        organisationId: tenantId,
        recipientId,
      },
    });

    if (!existing) {
      return null;
    }

    return prisma.notification.update({
      where: { id: existing.id },
      data: { isRead: true },
    });
  },

  async markAllAsRead(tenantId: string, recipientId: string) {
    const result = await prisma.notification.updateMany({
      where: {
        organisationId: tenantId,
        recipientId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return { updatedCount: result.count };
  },
};
