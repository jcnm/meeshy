# Support Guide

## Getting Help

We're here to help! Here are the best ways to get support for Meeshy:

## 🆘 Quick Support Channels

### 📧 Email Support
- **General Questions**: [support@meeshy.com](mailto:support@meeshy.com)
- **Technical Issues**: [tech@meeshy.com](mailto:tech@meeshy.com)
- **Security Issues**: [security@meeshy.com](mailto:security@meeshy.com)

### 💬 Community Support
- **GitHub Discussions**: [Community Q&A](https://github.com/jcnm/meeshy/discussions)
- **GitHub Issues**: [Bug Reports & Feature Requests](https://github.com/jcnm/meeshy/issues)
- **Discord Server**: [Coming Soon] - Join our community chat

### 📚 Documentation
- **Full Documentation**: [docs.meeshy.com](https://docs.meeshy.com) *(coming soon)*
- **API Reference**: [api.meeshy.com](https://api.meeshy.com) *(coming soon)*
- **Deployment Guide**: [deploy.meeshy.com](https://deploy.meeshy.com) *(coming soon)*

## 🐛 Reporting Issues

### Before Reporting

1. **Check existing issues** to avoid duplicates
2. **Search documentation** for solutions
3. **Try the troubleshooting guide** below
4. **Gather relevant information** (logs, screenshots, etc.)

### Issue Templates

We provide templates for different types of issues:

- **🐛 Bug Report**: For software bugs and errors
- **💡 Feature Request**: For new features and improvements
- **📖 Documentation**: For documentation issues
- **🔧 Installation**: For setup and installation problems
- **🚀 Performance**: For performance-related issues

### What to Include

When reporting an issue, please include:

- **Environment details** (OS, Node.js version, Python version, etc.)
- **Steps to reproduce** the issue
- **Expected vs actual behavior**
- **Error messages and logs**
- **Screenshots or videos** (if applicable)
- **Relevant configuration** (environment variables, etc.)

## 🔧 Troubleshooting Guide

### Common Issues

#### 1. Docker Compose Issues

**Problem**: Services won't start
```bash
# Check if ports are already in use
sudo lsof -i :3000,3100,8000,5432,6379

# Restart Docker services
docker-compose down
docker-compose up -d

# Check logs
docker-compose logs -f
```

**Problem**: Database connection errors
```bash
# Check database status
docker-compose exec postgres pg_isready

# Reset database
docker-compose down -v
docker-compose up -d
```

#### 2. Translation Service Issues

**Problem**: ML models not loading
```bash
# Check model download
docker-compose exec translator ls -la /app/models

# Restart translator service
docker-compose restart translator

# Check memory usage
docker stats translator
```

**Problem**: Translation timeouts
```bash
# Increase timeout settings
export TRANSLATION_TIMEOUT=120
export ML_BATCH_SIZE=2

# Restart services
docker-compose restart
```

#### 3. WebSocket Connection Issues

**Problem**: WebSocket connection fails
```bash
# Check CORS settings
echo $CORS_ORIGINS
echo $ALLOWED_ORIGINS

# Test WebSocket endpoint
curl -I http://localhost:3000/ws
```

**Problem**: High memory usage
```bash
# Check memory usage
docker stats

# Optimize settings
export WS_MAX_CONNECTIONS=10000
export ML_BATCH_SIZE=1
```

#### 4. Frontend Issues

**Problem**: Frontend won't load
```bash
# Check Next.js build
docker-compose exec frontend npm run build

# Check environment variables
docker-compose exec frontend env | grep NEXT_PUBLIC
```

**Problem**: API calls failing
```bash
# Check API endpoints
curl http://localhost:3000/health
curl http://localhost:8000/health

# Check network connectivity
docker network ls
docker network inspect meeshy_meeshy-network
```

### Performance Issues

#### High Memory Usage
```bash
# Monitor memory usage
docker stats

# Optimize ML settings
export ML_BATCH_SIZE=1
export DEVICE=cpu
export QUANTIZATION_LEVEL=float16

# Restart services
docker-compose restart
```

#### Slow Translation
```bash
# Check translation workers
docker-compose exec translator ps aux | grep python

# Increase workers
export TRANSLATION_WORKERS=10
export CONCURRENT_TRANSLATIONS=20

# Restart translator
docker-compose restart translator
```

#### Database Performance
```bash
# Check database connections
docker-compose exec postgres psql -U meeshy -d meeshy -c "SELECT count(*) FROM pg_stat_activity;"

# Optimize pool size
export PRISMA_POOL_SIZE=20

# Restart services
docker-compose restart
```

## 📋 Environment Variables Reference

### Required Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | - | Yes |
| `REDIS_URL` | Redis connection string | - | Yes |
| `JWT_SECRET` | JWT signing secret | - | Yes |

### Optional Variables

| Variable | Description | Default | Used By |
|----------|-------------|---------|---------|
| `NODE_ENV` | Node.js environment | `development` | All |
| `DEBUG` | Enable debug logging | `false` | All |
| `LOG_LEVEL` | Logging level | `info` | All |

See [Environment Variables](README.md#environment-variables) for complete list.

## 🚀 Deployment Support

### Production Deployment

1. **Environment Setup**
   ```bash
   # Copy environment template
   cp .env.example .env.production
   
   # Configure production settings
   nano .env.production
   ```

2. **Database Migration**
   ```bash
   # Run migrations
   docker-compose exec gateway npx prisma migrate deploy
   
   # Generate Prisma client
   docker-compose exec gateway npx prisma generate
   ```

3. **SSL/HTTPS Setup**
   ```bash
   # Configure Nginx with SSL
   # See docker/nginx/ for examples
   ```

### Cloud Deployment

#### Docker Swarm
```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml meeshy
```

#### Kubernetes
```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/

# Check deployment
kubectl get pods -n meeshy
```

## 📊 Monitoring & Logs

### Health Checks
```bash
# Check all services
curl http://localhost:3000/health
curl http://localhost:8000/health
curl http://localhost:3100/api/health

# Check database
docker-compose exec postgres pg_isready -U meeshy

# Check Redis
docker-compose exec redis redis-cli ping
```

### Logs
```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f gateway
docker-compose logs -f translator
docker-compose logs -f frontend

# Search logs
docker-compose logs | grep ERROR
```

### Metrics
```bash
# Check resource usage
docker stats

# Check disk usage
docker system df

# Clean up unused resources
docker system prune -a
```

## 🔄 Updates & Maintenance

### Updating Meeshy
```bash
# Pull latest changes
git pull origin main

# Update Docker images
docker-compose pull

# Restart services
docker-compose up -d

# Run migrations
docker-compose exec gateway npx prisma migrate deploy
```

### Backup & Recovery
```bash
# Backup database
docker-compose exec postgres pg_dump -U meeshy meeshy > backup.sql

# Backup Redis
docker-compose exec redis redis-cli BGSAVE

# Restore database
docker-compose exec -T postgres psql -U meeshy meeshy < backup.sql
```

## 🎯 Getting Started Support

### First-Time Setup
1. **Prerequisites**: Ensure Docker and Docker Compose are installed
2. **Clone Repository**: `git clone https://github.com/jcnm/meeshy.git`
3. **Environment Setup**: Copy and configure `.env.example`
4. **Start Services**: `docker-compose up -d`
5. **Access Application**: Open http://localhost:3100

### Development Setup
1. **Install Dependencies**: `pnpm install`
2. **Environment Files**: Copy `.env.example` files to each service
3. **Database Setup**: `pnpm db:setup`
4. **Start Development**: `pnpm dev`

## 📞 Contact Information

### Support Team
- **Lead Maintainer**: [@jcnm](https://github.com/jcnm)
- **Technical Lead**: [@jcnm](https://github.com/jcnm)
- **Community Manager**: [@jcnm](https://github.com/jcnm)

### Response Times
- **Critical Issues**: Within 4 hours
- **High Priority**: Within 24 hours
- **Normal Issues**: Within 3 business days
- **Feature Requests**: Within 1 week

### Office Hours
- **Monday - Friday**: 9:00 AM - 6:00 PM UTC
- **Weekend**: Limited support for critical issues

## 🤝 Contributing to Support

### Community Support
- **Answer questions** in GitHub Discussions
- **Help with documentation** improvements
- **Share solutions** and workarounds
- **Report bugs** and suggest improvements

### Recognition
- **Support Contributors** are recognized in our [CONTRIBUTORS.md](CONTRIBUTORS.md)
- **Top Contributors** get special badges and recognition
- **Community Heroes** are featured in our documentation

---

**We're here to help you succeed with Meeshy!** 🚀✨

For urgent issues, please use the appropriate channels above. For general questions, [GitHub Discussions](https://github.com/jcnm/meeshy/discussions) is the best place to start.
