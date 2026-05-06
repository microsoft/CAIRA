using Azure.Monitor.OpenTelemetry.AspNetCore;
using OpenTelemetry.Trace;
using System.Diagnostics;

namespace CairaApi;

internal static class TelemetryExtensions
{
    public static void AddCairaTelemetry(this WebApplicationBuilder builder, string serviceName, string? connectionString)
    {
        builder.Services.AddSingleton(_ => new ActivitySource(serviceName));

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
                .AddAspNetCoreInstrumentation()
                .AddHttpClientInstrumentation());
    }
}
