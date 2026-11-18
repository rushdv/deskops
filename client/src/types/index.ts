export interface BackendHealth {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  environment: string;
}
