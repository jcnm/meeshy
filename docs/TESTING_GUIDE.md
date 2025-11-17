# Meeshy Testing Guide

Guide complet pour les tests dans le projet Meeshy.

## Vue d'ensemble

Le projet Meeshy utilise une approche de test complète couvrant:

- **Tests unitaires**: Tests isolés de fonctions/classes individuelles
- **Tests d'intégration**: Tests d'interaction entre composants
- **Tests e2e**: Tests du flux complet end-to-end

## Architecture de test

```
meeshy/
├── gateway/
│   ├── src/__tests__/
│   │   ├── unit/           # Tests unitaires Gateway (TypeScript)
│   │   ├── integration/    # Tests d'intégration Gateway
│   │   ├── helpers/        # Helpers et mocks
│   │   └── setup/          # Configuration de test
│   ├── jest.config.json
│   └── jest.setup.js
├── translator/
│   ├── tests/
│   │   ├── unit/           # Tests unitaires Translator (Python)
│   │   ├── integration/    # Tests d'intégration Translator
│   │   └── e2e/            # Tests end-to-end
│   ├── pytest.ini
│   └── conftest.py
├── frontend/
│   ├── __tests__/
│   │   ├── components/     # Tests de composants React
│   │   ├── api/            # Tests des services API
│   │   └── integration/    # Tests d'intégration Frontend
│   └── jest.config.js
└── shared/
    └── tests/
        └── data-consistency.test.ts  # Tests de cohérence des types

```

## Gateway (TypeScript/Jest)

### Installation

```bash
cd gateway
pnpm install
```

### Exécution

```bash
# Tous les tests
pnpm test

# Mode watch
pnpm test:watch

# Avec couverture
pnpm test:coverage
```

### Écrire un test unitaire Gateway

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { MyService } from '../services/MyService';

describe('MyService', () => {
  let service: MyService;

  beforeEach(() => {
    service = new MyService();
  });

  it('should do something', () => {
    const result = service.doSomething();
    expect(result).toBe(expected);
  });
});
```

## Translator (Python/Pytest)

### Installation

```bash
cd translator
pip install -r requirements.txt
```

### Exécution

```bash
# Tous les tests
pytest

# Tests unitaires
pytest tests/unit/

# Avec couverture
pytest --cov=src --cov-report=html
```

### Écrire un test unitaire Translator

```python
import pytest
from services.my_service import MyService

class TestMyService:
    @pytest.mark.unit
    def test_something(self):
        service = MyService()
        result = service.do_something()
        assert result == expected
```

## Frontend (React/Jest)

### Installation

```bash
cd frontend
pnpm install
```

### Exécution

```bash
# Tous les tests
pnpm test

# Avec couverture
pnpm test:coverage
```

### Écrire un test de composant

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

## Tests d'intégration

### Gateway-Translator Integration

Les tests d'intégration Gateway-Translator testent la communication ZMQ:

```bash
# Démarrer le translator
cd translator
python src/main.py &

# Exécuter les tests
cd gateway
pnpm test integration/gateway-translator
```

### Prisma Integration

Les tests Prisma utilisent MongoDB Memory Server:

```bash
cd gateway
pnpm test integration/prisma-integration
```

## Tests end-to-end

Les tests e2e testent le flux complet:

```bash
# Démarrer tous les services
docker-compose up -d

# Exécuter les tests e2e
cd translator
pytest tests/e2e/ -v
```

## Mocks et Fixtures

### Gateway Mocks

Les mocks Gateway sont dans `gateway/src/__tests__/helpers/`:

- `prisma-mock.ts`: Mock de Prisma Client
- `service-mocks.ts`: Mocks des services

### Translator Fixtures

Les fixtures Translator sont dans `translator/conftest.py`:

- `mock_translation_ml_service`: Mock du service ML
- `mock_database_service`: Mock de la base de données
- `zmq_push_socket`, `zmq_sub_socket`: Sockets ZMQ de test

## Couverture de code

### Objectifs de couverture

- **Gateway**: > 80%
- **Translator**: > 80%
- **Frontend**: > 70%
- **Shared**: > 90%

### Vérifier la couverture

```bash
# Gateway
cd gateway && pnpm test:coverage

# Translator
cd translator && pytest --cov=src --cov-report=html

# Frontend
cd frontend && pnpm test:coverage
```

Les rapports HTML sont générés dans:
- Gateway: `gateway/coverage/`
- Translator: `translator/coverage_html/`
- Frontend: `frontend/coverage/`

## CI/CD

### GitHub Actions

Les tests s'exécutent automatiquement sur chaque PR:

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test-gateway:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install dependencies
        run: cd gateway && pnpm install
      - name: Run tests
        run: cd gateway && pnpm test:coverage

  test-translator:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install dependencies
        run: cd translator && pip install -r requirements.txt
      - name: Run tests
        run: cd translator && pytest --cov=src
```

## Bonnes pratiques

### 1. Tests isolés

Chaque test doit être indépendant et ne pas dépendre d'autres tests.

### 2. Utiliser des mocks

Mockez les dépendances externes (DB, API, ML models) pour des tests rapides.

### 3. Tests descriptifs

Utilisez des noms de test descriptifs:

```typescript
// ✅ Bon
it('should return error when user is not found', ...)

// ❌ Mauvais
it('test 1', ...)
```

### 4. AAA Pattern

Arrangez vos tests avec le pattern Arrange-Act-Assert:

```typescript
it('should calculate total', () => {
  // Arrange
  const items = [1, 2, 3];

  // Act
  const total = calculateTotal(items);

  // Assert
  expect(total).toBe(6);
});
```

### 5. Cleanup

Nettoyez après chaque test:

```typescript
afterEach(async () => {
  await cleanupDatabase();
});
```

## Debugging

### Gateway (Node.js)

```bash
# Avec debugger
node --inspect-brk node_modules/.bin/jest

# Ou dans VSCode
# Ajouter breakpoint et F5
```

### Translator (Python)

```bash
# Avec debugger
python -m pdb -m pytest tests/unit/test_something.py

# Ou dans VSCode
# Ajouter breakpoint et F5
```

### Logs détaillés

```bash
# Gateway
DEBUG=* pnpm test

# Translator
pytest -v -s --log-cli-level=DEBUG
```

## Troubleshooting

### Problème: Tests timeout

**Solution**: Augmentez le timeout dans la configuration de test.

```typescript
// Jest
jest.setTimeout(30000);

// Pytest
@pytest.mark.timeout(30)
```

### Problème: Ports déjà utilisés

**Solution**: Utilisez des ports différents pour les tests.

```bash
# Vérifier les ports utilisés
lsof -i :5555
lsof -i :5558

# Tuer le processus
kill -9 <PID>
```

### Problème: Mocks ne fonctionnent pas

**Solution**: Vérifiez l'ordre des imports et patches.

```python
# ✅ Correct
with patch('module.Class'):
    from service import my_function

# ❌ Incorrect
from service import my_function
with patch('module.Class'):
```

## Ressources

- [Jest Documentation](https://jestjs.io/)
- [Pytest Documentation](https://docs.pytest.org/)
- [React Testing Library](https://testing-library.com/react)
- [ZeroMQ Testing Guide](https://zeromq.org/documentation/)

## Support

Pour toute question sur les tests, contactez l'équipe de développement ou ouvrez une issue sur GitHub.
