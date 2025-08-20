# Contributing to Meeshy

We love your input! We want to make contributing to Meeshy as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## 🚀 Quick Start for Contributors

### 1. Prerequisites

- **Node.js** 18+ and **pnpm** for JavaScript/TypeScript services
- **Python** 3.12+ for the translator service
- **Docker** and **Docker Compose** for containerized development
- **Git** for version control

### 2. Setting Up Development Environment

```bash
# Fork and clone the repository
git clone https://github.com/jcnm/meeshy.git
cd meeshy

# Install all dependencies
pnpm install

# Copy environment files
cp .env.example .env
cp gateway/.env.example gateway/.env
cp translator/.env.example translator/.env

# Start the development environment
pnpm dev
```

### 3. Project Structure

```
meeshy/
├── frontend/          # Next.js frontend application
├── gateway/           # Fastify API gateway service
├── translator/        # FastAPI translation service
├── shared/           # Shared types and Prisma schema
├── docs/             # Documentation
├── scripts/          # Development and deployment scripts
└── .github/          # GitHub workflows and templates
```

## 🔧 Development Workflow

### Branch Naming Convention

- `feat/feature-name` - New features
- `fix/bug-description` - Bug fixes
- `docs/update-readme` - Documentation updates
- `refactor/component-name` - Code refactoring
- `test/add-unit-tests` - Adding tests

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

feat(gateway): add WebSocket rate limiting
fix(translator): resolve memory leak in ML models
docs(api): update authentication endpoints
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Code Standards

#### TypeScript/JavaScript (Frontend & Gateway)
- Use **ESLint** and **Prettier** for formatting
- Follow **TypeScript strict mode**
- Use **Prisma generated types** wherever possible
- Write **JSDoc comments** for public APIs

#### Python (Translator Service)
- Use **Black** for code formatting (line length 100)
- Use **Ruff** for linting
- Follow **PEP 8** style guide
- Type hints required for all function signatures

### Testing Requirements

- **Unit tests** for all new functions/methods
- **Integration tests** for API endpoints
- **E2E tests** for critical user flows
- Minimum **80% code coverage** for new code

```bash
# Run all tests
pnpm test

# Run specific service tests
pnpm test:frontend
pnpm test:gateway
pnpm test:translator
```

## 🐛 Reporting Bugs

Use our GitHub Issues with the bug report template. Include:

- **Environment details** (OS, Node.js version, etc.)
- **Steps to reproduce** the issue
- **Expected vs actual behavior**
- **Screenshots/logs** if applicable

## 💡 Proposing Features

1. **Check existing issues** to avoid duplicates
2. **Open a feature request** using our template
3. **Discuss the proposal** with maintainers
4. **Submit a PR** once approved

## 📝 Pull Request Process

### Before Submitting

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Tests added/updated and passing
- [ ] Documentation updated
- [ ] No console.log or debug prints
- [ ] Prisma schema changes include migration

### PR Checklist

- [ ] **Clear title** describing the change
- [ ] **Linked issue** (fixes #123)
- [ ] **Description** of changes made
- [ ] **Testing instructions** for reviewers
- [ ] **Screenshots** for UI changes
- [ ] **Breaking changes** documented

### Review Process

1. **Automated checks** must pass (CI/CD)
2. **Code review** by at least one maintainer
3. **Manual testing** if required
4. **Squash and merge** after approval

## 🏗️ Architecture Guidelines

### Service Boundaries

- **Gateway**: REST API, WebSocket, authentication, message routing/caching
- **Translator**: ML inference, translation caching, message processing
- **Frontend**: SSR, UI components, user interactions, real-time updates

### Database Access Patterns

- **Gateway**: Full CRUD on Users, Conversations, Message, read-only on MessageTranslations
- **Translator**: Full CRUD on Messages and MessageTranslations
- **Shared Schema**: Single source of truth in `/shared/schema.prisma` and `/shared/types`

### Communication Protocols

- **Frontend ↔ Gateway**: WebSocket + REST API
- **Gateway ↔ Translator**: ZMQ + gRPC + Protocol Buffers
- **Caching**: Memory for computing cache, Redis for hot data, PostgreSQL for persistence

## 🔍 Code Review Guidelines

### What We Look For

- **Correctness**: Does it solve the problem?
- **Performance**: Does it handle the expected load?
- **Security**: Are there any vulnerabilities?
- **Maintainability**: Is it readable and well-structured?
- **Type Safety**: Proper TypeScript/Python typing

### Review Checklist

- [ ] Business logic is sound
- [ ] Error handling is comprehensive
- [ ] Security considerations addressed
- [ ] Performance implications considered
- [ ] Documentation is clear and complete

## 🚀 Release Process

- **Semantic Versioning**: MAJOR.MINOR.PATCH
- **Automated releases** via GitHub Actions
- **Release notes** generated automatically
- **Docker images** published to registry

## 📞 Getting Help

- **GitHub Discussions** for questions and ideas
- **GitHub Issues** for bugs and feature requests
- **Discord Community** (coming soon)
- **Documentation** in `/docs` folder

## 🏆 Recognition

Contributors are recognized in our [CONTRIBUTORS.md](CONTRIBUTORS.md) file and release notes.

## 📜 Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

---

Thank you for contributing to Meeshy! 🎉
