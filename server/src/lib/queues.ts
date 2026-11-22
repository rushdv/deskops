import { Queue, JobsOptions } from 'bullmq';
import { getRedisClient } from './redis.js';

// Default job options with exponential backoff and DLQ preservation (NFR-06)
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: {
    count: 100, // Retain last 100 completed jobs for audit
  },
  removeOnFail: {
    // Preserve failed jobs in Dead-Letter Queue (DLQ) for inspection
    count: 1000,
  },
};

// 1. Thumbnail generation queue (FR-1.04)
export const thumbnailQueue = new Queue('thumbnailQueue', {
  connection: getRedisClient(),
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

// 2. Email notification & inbound parsing queue (FR-1.05)
export const emailQueue = new Queue('emailQueue', {
  connection: getRedisClient(),
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

/**
 * Safely enqueue a thumbnail generation job
 */
export const enqueueThumbnailJob = async (data: {
  attachmentId: string;
  storageKey: string;
  mimeType: string;
  ticketId: string;
  organisationId: string;
}): Promise<string | null> => {
  try {
    const job = await thumbnailQueue.add('generate-thumbnail', data);
    return job.id || null;
  } catch (err) {
    console.warn('[Queue] Failed to enqueue thumbnail job (broker offline?):', (err as Error).message);
    return null;
  }
};

/**
 * Safely enqueue an email dispatch job
 */
export const enqueueEmailJob = async (data: {
  to: string;
  subject: string;
  template: string;
  context: Record<string, unknown>;
}): Promise<string | null> => {
  try {
    const job = await emailQueue.add('send-email', data);
    return job.id || null;
  } catch (err) {
    console.warn('[Queue] Failed to enqueue email job (broker offline?):', (err as Error).message);
    return null;
  }
};
