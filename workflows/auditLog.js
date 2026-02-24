/**
 * Audit Log Workflow
 * Log important actions for security
 * Hebrew: יומן ביקורת
 */

// In a real implementation, this would be a database entity
// For now, we'll use console logging

/**
 * Log an audit event
 */
export async function logAuditEvent(userId, action, details = {}) {
  const auditEntry = {
    userId,
    action,
    details,
    timestamp: new Date().toISOString(),
    ip: details.ip || 'unknown'
  };

  // In production, save to Audit_Log entity
  console.log('AUDIT:', JSON.stringify(auditEntry));

  return auditEntry;
}

/**
 * Log user action
 */
export async function logUserAction(userId, action, resource, resourceId) {
  return await logAuditEvent(userId, action, {
    resource,
    resourceId
  });
}
