# Prisma Connection Configuration Guide

This guide explains how Prisma connections are configured in the Wallace Collection app and provides best practices for optimal performance.

## Overview

The app uses a singleton Prisma client instance to manage database connections efficiently. The configuration is located in `src/lib/prisma.ts`.

## Key Features

### 1. Singleton Pattern

- Prevents multiple Prisma client instances in development
- Reuses connections efficiently
- Reduces connection overhead

### 2. Environment-Based Configuration

- Development: Detailed logging and query timing
- Production: Minimal logging for performance

### 3. Connection Pool Management

- Automatic connection pooling via Prisma
- Configurable via DATABASE_URL parameters
- Health monitoring endpoints

### 4. Graceful Shutdown

- Properly closes connections on app shutdown
- Handles SIGINT, SIGTERM signals
- Prevents connection leaks

## Database URL Configuration

Configure your `DATABASE_URL` in `.env` with connection pool parameters:

```bash
# Basic format
DATABASE_URL="postgresql://user:password@host:port/database"

# With connection pool settings (recommended for production)
DATABASE_URL="postgresql://user:password@host:port/database?connection_limit=20&pool_timeout=30&connect_timeout=30"
```

### Recommended Connection Pool Settings

| Parameter                             | Development | Production | Description                              |
| ------------------------------------- | ----------- | ---------- | ---------------------------------------- |
| `connection_limit`                    | 5-10        | 20-30      | Maximum connections in pool              |
| `pool_timeout`                        | 10          | 30         | Seconds to wait for available connection |
| `connect_timeout`                     | 10          | 30         | Seconds to wait for initial connection   |
| `statement_timeout`                   | 0           | 30000      | Query timeout in milliseconds            |
| `idle_in_transaction_session_timeout` | 0           | 60000      | Idle transaction timeout                 |

### Example Production Configuration

```bash
DATABASE_URL="postgresql://user:password@host:5432/mydb?connection_limit=25&pool_timeout=30&connect_timeout=30&statement_timeout=30000&idle_in_transaction_session_timeout=60000"
```

## Monitoring Endpoints

### 1. Health Check

```bash
GET /api/health
```

Returns overall system health including database connectivity.

### 2. Connection Pool Status

```bash
GET /api/admin/connection-pool-status
```

Returns detailed connection pool metrics and utilization.

## Best Practices

### 1. Connection Limits

- Set `connection_limit` based on your database plan
- Most managed databases have connection limits (e.g., 100 for basic plans)
- Leave headroom for other services/tools

### 2. Query Optimization

- Use Prisma's query optimization features
- Implement pagination for large datasets
- Use `select` to fetch only needed fields

### 3. Error Handling

- Always handle Prisma errors gracefully
- Implement retry logic for transient failures
- Log errors for debugging

### 4. Development vs Production

- Enable query logging in development only
- Use connection pool monitoring sparingly
- Configure appropriate timeouts

## Troubleshooting

### Common Issues

1. **"Too many connections" error**

   - Reduce `connection_limit` in DATABASE_URL
   - Check for connection leaks
   - Monitor with `/api/admin/connection-pool-status`

2. **Slow queries**

   - Enable query logging in development
   - Check query execution plans
   - Add appropriate indexes

3. **Connection timeouts**
   - Increase `connect_timeout` and `pool_timeout`
   - Check network connectivity
   - Verify database server status

### Debug Mode

Enable detailed logging in development:

```bash
# In .env
ENABLE_POOL_MONITORING=true
```

This will log connection pool metrics every minute.

## Prisma Schema Configuration

To enable Prisma metrics (optional):

```prisma
generator client {
  provider = "prisma-client-js"
  previewFeatures = ["metrics"]
}
```

## Security Considerations

1. **Never commit `.env` files**
2. **Use environment variables for sensitive data**
3. **Implement proper authentication for monitoring endpoints**
4. **Use SSL connections in production**

## Performance Tips

1. **Connection Pooling**: Always use connection pooling in production
2. **Query Batching**: Use Prisma's transaction API for multiple operations
3. **Caching**: Implement caching for frequently accessed data
4. **Indexes**: Ensure proper database indexes exist

## Migration Commands

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Create a new migration
npx prisma migrate dev --name migration_name

# Reset database (development only)
npx prisma migrate reset
```

## Environment Variables

Required environment variables:

```bash
# Database connection
DATABASE_URL="postgresql://..."

# Optional monitoring
ENABLE_POOL_MONITORING="true"  # Development only
NODE_ENV="development|production"
```

## Additional Resources

- [Prisma Connection Management](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
- [PostgreSQL Connection Pooling](https://www.postgresql.org/docs/current/runtime-config-connection.html)
- [Prisma Error Reference](https://www.prisma.io/docs/reference/api-reference/error-reference)
