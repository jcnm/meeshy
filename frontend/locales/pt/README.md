# Estrutura das Traduções em Português

Este diretório contém as traduções em português organizadas por funcionalidade e tipo de componente.

## Organização dos Arquivos

### Arquivos Principais
- **`common.json`** - Traduções comuns usadas em toda a aplicação (botões, erros, validação, nomes de idiomas, navegação)
- **`auth.json`** - Traduções relacionadas à autenticação (login, registro, entrar em conversa)
- **`landing.json`** - Traduções da página inicial (hero, recursos, missão, CTA)

### Arquivos Específicos de Páginas
- **`dashboard.json`** - Traduções da página do painel (estatísticas, ações, ações rápidas)
- **`conversations.json`** - Gerenciamento de conversas e comunidades
- **`settings.json`** - Traduções da página de configurações (perfil, configurações de tradução, tema)
- **`pages.json`** - Páginas estáticas (sobre, contato, parceiros, página não encontrada)

### Arquivos de Componentes
- **`components.json`** - Componentes de UI (afiliado, cabeçalho, seletor de idioma, layout, toasts, fluxo de bolhas)
- **`modals.json`** - Diálogos modais (modal de criação de link, resumo de link, chat anônimo)
- **`features.json`** - Recursos especializados (página de chat, manipuladores de erro, pesquisa, gerenciamento de conversa)

### Arquivos Legais
- **`legal.json`** - Documentos legais (política de privacidade, termos de uso)

## Uso

### Importar Arquivos Individuais
```typescript
import { common } from './locales/pt/common.json';
import { auth } from './locales/pt/auth.json';
```

### Importar Todas as Traduções
```typescript
import translations from './locales/pt';
// ou
import { common, auth, landing } from './locales/pt';
```

## Estrutura das Chaves de Tradução

Cada arquivo mantém a estrutura aninhada original do arquivo principal `pt.json`. Por exemplo:

```json
// common.json
{
  "common": {
    "loading": "Carregando...",
    "save": "Salvar"
  },
  "languageNames": {
    "en": "Inglês",
    "pt": "Português"
  }
}
```

## Vantagens desta Estrutura

1. **Modularidade** - Carregar apenas as traduções necessárias
2. **Manutenibilidade** - Mais fácil encontrar e atualizar traduções específicas
3. **Colaboração em equipe** - Diferentes membros da equipe podem trabalhar em arquivos diferentes
4. **Performance** - Tamanhos de bundle menores ao usar code splitting
5. **Organização** - Separação clara de responsabilidades

## Tamanhos dos Arquivos

- `common.json` - Traduções principais usadas em todos os lugares
- `auth.json` - Fluxos de autenticação
- `landing.json` - Conteúdo de marketing e página inicial
- `dashboard.json` - Interface do painel
- `conversations.json` - Gerenciamento de chat e conversas
- `settings.json` - Preferências do usuário e configuração
- `pages.json` - Páginas informativas estáticas
- `components.json` - Componentes de UI reutilizáveis
- `modals.json` - Conteúdo de diálogos e modais
- `features.json` - Recursos avançados e tratamento de erros
- `legal.json` - Política de privacidade e termos de uso

## Notas de Migração

Esta estrutura substitui o arquivo único `pt.json` mantendo todas as chaves e valores de tradução originais. O arquivo `index.ts` fornece compatibilidade retroativa exportando todas as traduções como um único objeto.

## Parâmetros Preservados

Todos os parâmetros de mensagens dinâmicas foram preservados, incluindo:
- `{name}` - Para nomes de usuário
- `{count}` - Para contadores
- `{time}` - Para timestamps
- `{message}` - Para mensagens de erro
- `{sender}` - Para remetentes de mensagem
- E muitos outros...
