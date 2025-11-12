/**
 * Structured Logger for ToggleStore Application
 * Works on both client and server side
 * Integrates with LaunchDarkly observability
 */

type LogLevel = "error" | "warn" | "info" | "debug"

interface LogContext {
  [key: string]: unknown
}

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  context?: LogContext
  error?: {
    name: string
    message: string
    stack?: string
    code?: string
    statusCode?: number
  }
}

class Logger {
  private isServer: boolean
  private serviceName: string
  private environment: string

  constructor() {
    this.isServer = typeof window === "undefined"
    this.serviceName = "togglestore"
    this.environment = process.env.NODE_ENV || "development"
  }

  private formatLog(level: LogLevel, message: string, context?: LogContext, error?: Error): LogEntry {
    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: {
        service: this.serviceName,
        environment: this.environment,
        ...context,
      },
    }

    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as Error & { code?: string })?.code,
        statusCode: (error as Error & { statusCode?: number })?.statusCode,
      }
    }

    return logEntry
  }

  private output(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    const logEntry = this.formatLog(level, message, context, error)

    // Format for console output (human-readable)
    const consoleMessage = `[${logEntry.timestamp}] [${level.toUpperCase()}] ${message}`
    const consoleContext = {
      ...logEntry.context,
      ...(logEntry.error && { error: logEntry.error }),
    }

    // Output to console with appropriate method
    switch (level) {
      case "error":
        console.error(consoleMessage, consoleContext)
        break
      case "warn":
        console.warn(consoleMessage, consoleContext)
        break
      case "info":
        console.log(consoleMessage, consoleContext)
        break
      case "debug":
        if (this.environment === "development") {
          console.debug(consoleMessage, consoleContext)
        }
        break
    }

    // In production, you could send logs to LaunchDarkly observability or other services
    // LaunchDarkly observability automatically tracks errors thrown in the backend
    // For frontend, you could use LaunchDarkly's browser telemetry
    if (this.isServer && level === "error" && error) {
      // LaunchDarkly observability will automatically track thrown errors
      // This logger provides structured context for better observability
    }
  }

  /**
   * Log an error
   */
  error(message: string, error?: Error, context?: LogContext): void {
    this.output("error", message, context, error)
  }

  /**
   * Log a warning
   */
  warn(message: string, context?: LogContext): void {
    this.output("warn", message, context)
  }

  /**
   * Log an info message
   */
  info(message: string, context?: LogContext): void {
    this.output("info", message, context)
  }

  /**
   * Log a debug message (only in development)
   */
  debug(message: string, context?: LogContext): void {
    this.output("debug", message, context)
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    const childLogger = new Logger()
    const originalOutput = childLogger.output.bind(childLogger)
    
    childLogger.output = (level: LogLevel, message: string, childContext?: LogContext, error?: Error) => {
      originalOutput(level, message, { ...context, ...childContext }, error)
    }
    
    return childLogger
  }
}

// Export singleton instance
export const logger = new Logger()

// Export Logger class for creating custom instances
export { Logger }

// Export types
export type { LogLevel, LogContext, LogEntry }

