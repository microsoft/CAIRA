import { context, propagation } from '@opentelemetry/api';
import { shutdownMicrosoftOpenTelemetry, useMicrosoftOpenTelemetry } from '@microsoft/opentelemetry';

let telemetryInitialised = false;

export function setupTelemetry(serviceName: string, connectionString?: string | undefined): void {
  if (telemetryInitialised) {
    return;
  }

  if (!connectionString) {
    return;
  }

  useMicrosoftOpenTelemetry({
    azureMonitor: {
      enabled: true,
      azureMonitorExporterOptions: {
        connectionString
      },
      enableLiveMetrics: false
    },
    instrumentationOptions: {
      http: { enabled: true }
    },
    samplingRatio: 1
  });

  telemetryInitialised = true;
  void serviceName;
}

export async function shutdownTelemetry(): Promise<void> {
  if (!telemetryInitialised) {
    return;
  }
  await shutdownMicrosoftOpenTelemetry();
  telemetryInitialised = false;
}

export function injectTraceContext(headers: Record<string, string>): Record<string, string> {
  propagation.inject(context.active(), headers);
  return headers;
}
