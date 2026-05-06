using Azure.Monitor.OpenTelemetry.AspNetCore;
using OpenTelemetry.Trace;

namespace CairaAgent;

internal static class TelemetryExtensions
{
    public static void AddCairaTelemetry(this WebApplicationBuilder builder, string serviceName, string? connectionString)
    {
        builder.Services.AddSingleton(_ => new System.Diagnostics.ActivitySource(serviceName));

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return;
        }

        builder.Services.AddOpenTelemetry()
            .UseAzureMonitor(options =>
            {
                options.ConnectionString = connectionString;
                options.EnableLiveMetrics = false;
            })
            .WithTracing(tracing => tracing
                .AddHttpClientInstrumentation()
                .AddAspNetCoreInstrumentation());
    }
}
