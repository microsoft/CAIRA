output "connection" {
  value       = azurerm_subnet.connection
  description = "The subnet used for the connection"
}

output "agent" {
  value       = azurerm_subnet.agent
  description = "The subnet used for the agent"
}
