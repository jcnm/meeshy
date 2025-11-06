# Diagrammes d'Architecture Meeshy

Ce document contient une série de diagrammes Mermaid expliquant le fonctionnement de la plateforme Meeshy.

## Table des matières

1. [Architecture Globale (C4 Context)](#1-architecture-globale-c4-context)
2. [Structure des Composants](#2-structure-des-composants)
3. [Diagramme de Déploiement](#3-diagramme-de-déploiement)
4. [Séquence d'Authentification](#4-séquence-dauthentification)
5. [Séquence d'Envoi de Messages](#5-séquence-denvoi-de-messages)
6. [Séquence de Traduction](#6-séquence-de-traduction)
7. [Séquence d'Upload d'Attachements](#7-séquence-dupload-dattachements)
8. [Flux de Données en Temps Réel](#8-flux-de-données-en-temps-réel)
9. [Modèle de Base de Données (ERD)](#9-modèle-de-base-de-données-erd)
10. [Infrastructure Réseau](#10-infrastructure-réseau)
11. [États des Connexions WebSocket](#11-états-des-connexions-websocket)
12. [Séquence d'Appel Vidéo WebRTC](#12-séquence-dappel-vidéo-webrtc)

---

## 1. Architecture Globale (C4 Context)

Ce diagramme montre le contexte global de Meeshy et ses interactions avec les utilisateurs et systèmes externes.

```mermaid
graph TB
    subgraph "Utilisateurs"
        User[👤 Utilisateur Authentifié]
        Anonymous[👥 Utilisateur Anonyme]
        Admin[👨‍💼 Administrateur]
    end

    subgraph "Plateforme Meeshy"
        Frontend[🌐 Frontend<br/>Next.js 15]
        Gateway[⚡ Gateway<br/>Fastify API]
        Translator[🤖 Translator<br/>FastAPI + ML]
        Database[(🗄️ MongoDB)]
        Cache[(⚡ Redis)]
    end

    subgraph "Services Externes"
        ML[🧠 Hugging Face Models<br/>NLLB-200, T5]
    end

    User -->|HTTPS/WebSocket| Frontend
    Anonymous -->|HTTPS via Share Link| Frontend
    Admin -->|HTTPS| Frontend

    Frontend -->|REST API<br/>Socket.IO| Gateway
    Gateway -->|ZMQ Push/Sub<br/>Port 5555/5558| Translator
    Gateway -->|Prisma ORM| Database
    Gateway -->|Session/Cache| Cache

    Translator -->|Prisma ORM| Database
    Translator -->|Cache| Cache
    Translator -.->|Load Models| ML

    style User fill:#4CAF50
    style Anonymous fill:#FF9800
    style Admin fill:#2196F3
    style Frontend fill:#61DAFB
    style Gateway fill:#68A063
    style Translator fill:#009688
    style Database fill:#47A248
    style Cache fill:#DC382D
```

---

## 2. Structure des Composants

Architecture détaillée des composants internes de chaque service.

```mermaid
graph TB
    subgraph "Frontend (Next.js)"
        Pages[📄 Pages/Routes<br/>app/]
        Components[🧩 Components<br/>UI/Chat/Call]
        Stores[📦 Stores<br/>Zustand]
        Hooks[🎣 Hooks<br/>useSocket/useAuth]
        Services[🔧 Services<br/>API Clients]

        Pages --> Components
        Components --> Hooks
        Hooks --> Stores
        Hooks --> Services
    end

    subgraph "Gateway (Fastify)"
        Routes[🛣️ Routes<br/>REST Endpoints]
        Middleware[🛡️ Middleware<br/>Auth/CORS]
        SocketIO[🔌 Socket.IO Manager<br/>Real-time Events]
        GatewayServices[⚙️ Services<br/>Business Logic]
        ZMQClient[📡 ZMQ Client<br/>Translator Comm]

        Routes --> Middleware
        Routes --> GatewayServices
        SocketIO --> GatewayServices
        GatewayServices --> ZMQClient
    end

    subgraph "Translator (FastAPI)"
        API[🌐 FastAPI Routes]
        ZMQServer[📡 ZMQ Server<br/>PUB/SUB + REQ/REP]
        MLService[🤖 ML Service<br/>Translation Engine]
        ModelManager[📚 Model Manager<br/>NLLB/T5 Models]
        DBService[💾 Database Service<br/>Cache Management]

        API --> MLService
        ZMQServer --> MLService
        MLService --> ModelManager
        MLService --> DBService
    end

    Services -.->|HTTP/WS| Routes
    Services -.->|Socket.IO| SocketIO
    ZMQClient -.->|ZMQ| ZMQServer

    style Frontend fill:#61DAFB20
    style Gateway fill:#68A06320
    style Translator fill:#00968820
```

---

## 3. Diagramme de Déploiement

Infrastructure de déploiement avec Docker et Traefik.

```mermaid
graph TB
    subgraph "Internet"
        Users[👥 Utilisateurs]
    end

    subgraph "Traefik Reverse Proxy"
        Traefik[🔀 Traefik v3.3<br/>SSL/TLS + Let's Encrypt<br/>Port 80/443]
    end

    subgraph "Docker Network: meeshy-network"
        subgraph "Frontend Container"
            FrontendApp[Next.js App<br/>Port 3100<br/>frontend.meeshy.me]
        end

        subgraph "Gateway Container"
            GatewayApp[Fastify Server<br/>Port 3000<br/>gate.meeshy.me]
        end

        subgraph "Translator Container"
            TranslatorApp[FastAPI Server<br/>Port 8000<br/>ml.meeshy.me<br/>ZMQ: 5555, 5558]
        end

        subgraph "Database Container"
            MongoDB[MongoDB 8.0<br/>Port 27017<br/>Replica Set: rs0]
            MongoUI[NoSQLClient<br/>Port 3001<br/>mongo.meeshy.me]
        end

        subgraph "Cache Container"
            RedisDB[Redis 8 Alpine<br/>Port 6379]
            RedisUI[P3X Redis UI<br/>Port 7843<br/>redis.meeshy.me]
        end
    end

    subgraph "Volumes"
        DBData[(database_data)]
        RedisData[(redis_data)]
        Uploads[(uploads)]
        Models[(ml_models)]
    end

    Users -->|HTTPS| Traefik

    Traefik -->|Route: /| FrontendApp
    Traefik -->|Route: /api/*| GatewayApp
    Traefik -->|Route: /ml/*| TranslatorApp
    Traefik -->|Route: /mongo/*| MongoUI
    Traefik -->|Route: /redis/*| RedisUI

    FrontendApp -->|HTTP/WS| GatewayApp
    GatewayApp -->|TCP| MongoDB
    GatewayApp -->|TCP| RedisDB
    GatewayApp -->|ZMQ| TranslatorApp
    TranslatorApp -->|TCP| MongoDB
    TranslatorApp -->|TCP| RedisDB

    MongoDB -.-> DBData
    RedisDB -.-> RedisData
    GatewayApp -.-> Uploads
    TranslatorApp -.-> Models

    style Traefik fill:#37ABC8
    style FrontendApp fill:#61DAFB
    style GatewayApp fill:#68A063
    style TranslatorApp fill:#009688
    style MongoDB fill:#47A248
    style RedisDB fill:#DC382D
```

---

## 4. Séquence d'Authentification

Processus d'authentification JWT pour les utilisateurs enregistrés.

```mermaid
sequenceDiagram
    actor User as 👤 Utilisateur
    participant FE as Frontend
    participant GW as Gateway
    participant DB as MongoDB
    participant Cache as Redis

    User->>FE: Saisit username/password
    FE->>GW: POST /login<br/>{username, password}

    GW->>DB: Recherche utilisateur<br/>par username
    DB-->>GW: Retourne User

    GW->>GW: Vérifie password<br/>(bcrypt.compare)

    alt Mot de passe incorrect
        GW->>DB: Incrémente<br/>failedLoginAttempts
        GW-->>FE: 401 Unauthorized
        FE-->>User: ❌ Erreur de connexion
    end

    GW->>GW: Génère JWT token<br/>(userId, role, exp: 24h)

    GW->>DB: Met à jour<br/>lastActiveAt, isOnline

    GW->>Cache: Stocke session<br/>Key: session:{userId}

    GW-->>FE: 200 OK<br/>{user, token, expiresIn}

    FE->>FE: Stocke token<br/>localStorage

    FE->>FE: Initialise Zustand<br/>authStore

    FE-->>User: ✅ Connexion réussie

    FE->>GW: Socket.IO Connect<br/>auth: {token}
    GW->>GW: Valide JWT token
    GW-->>FE: Socket authenticated

    Note over FE,GW: Toutes les requêtes suivantes<br/>incluent: Authorization: Bearer {token}
```

---

## 5. Séquence d'Envoi de Messages

Flux complet d'envoi et de distribution d'un message avec traduction automatique.

```mermaid
sequenceDiagram
    actor User as 👤 Utilisateur
    participant FE as Frontend
    participant Socket as Socket.IO
    participant GW as Gateway
    participant MS as MessagingService
    participant TS as TranslationService
    participant ZMQ as ZMQ Client
    participant Trans as Translator
    participant DB as MongoDB

    User->>FE: Tape message + Envoie
    FE->>FE: Optimistic UI Update

    FE->>Socket: emit('message:send')<br/>{conversationId, content}

    Socket->>GW: Reçoit événement
    GW->>MS: handleMessage()

    MS->>MS: Valide message<br/>(longueur, contenu)

    MS->>DB: Détecte langue source<br/>(API ou langdetect)
    DB-->>MS: originalLanguage: 'fr'

    MS->>DB: Sauvegarde message<br/>CREATE Message
    DB-->>MS: message.id

    MS-->>Socket: Callback<br/>{success, messageId}
    Socket-->>FE: Confirmation immédiate
    FE->>FE: Met à jour messageId local

    GW->>Socket: Broadcast à room<br/>emit('message:received')
    Socket-->>FE: Message reçu
    FE-->>User: 📨 Message affiché

    par Traduction Asynchrone
        MS->>TS: Demande traductions<br/>getTargetLanguages()
        TS->>DB: Récupère langues<br/>des membres
        DB-->>TS: ['en', 'es', 'ar']

        loop Pour chaque langue cible
            TS->>ZMQ: PUSH translation request<br/>{messageId, source, target, content}
            ZMQ->>Trans: ZMQ REQ/REP
            Trans->>Trans: ML Translation<br/>(NLLB-200 model)
            Trans-->>ZMQ: Translated content
            ZMQ-->>TS: Translation result

            TS->>DB: CREATE MessageTranslation<br/>{messageId, targetLanguage}

            TS->>Socket: emit('translation:received')<br/>{messageId, translations}
            Socket-->>FE: Translation reçue
            FE-->>User: 🌍 Traduction affichée
        end
    end

    Note over Trans,DB: Mise en cache Redis<br/>pour traductions fréquentes
```

---

## 6. Séquence de Traduction

Communication ZMQ entre Gateway et Translator pour la traduction.

```mermaid
sequenceDiagram
    participant GW as Gateway<br/>TranslationService
    participant PUSH as ZMQ PUSH<br/>Port 5555
    participant REP as ZMQ REP<br/>Port 5556
    participant Trans as Translator<br/>ZMQ Server
    participant ML as ML Service<br/>NLLB Model
    participant Cache as Redis
    participant SUB as ZMQ SUB<br/>Port 5558
    participant PUB as ZMQ PUB<br/>Translator

    GW->>GW: requestTranslation()<br/>{messageId, source, target, text}

    GW->>PUSH: PUSH message<br/>JSON payload
    PUSH->>Trans: Reçoit sur PULL socket

    Trans->>Cache: Vérifie cache<br/>Key: translation:{hash}

    alt Cache HIT
        Cache-->>Trans: Traduction en cache
        Trans->>Trans: Return cached result
    else Cache MISS
        Trans->>ML: Translate text<br/>source: fr → target: en

        ML->>ML: Load model if needed<br/>nllb-200-distilled-600M
        ML->>ML: Tokenize + Inference
        ML-->>Trans: Translated text

        Trans->>Cache: Store in cache<br/>TTL: 7 days
    end

    Trans->>PUB: PUBLISH result<br/>{messageId, translation}
    PUB->>SUB: Broadcast via ZMQ PUB/SUB
    SUB->>GW: Reçoit translation

    GW->>GW: Process translation result

    par Alternative: REQ/REP Pattern
        GW->>REP: SEND request<br/>(synchronous)
        REP->>Trans: Process
        Trans-->>REP: Response
        REP-->>GW: Translation result
    end

    Note over PUSH,SUB: PUSH/PULL: Fire-and-forget (async)<br/>REQ/REP: Synchronous request<br/>PUB/SUB: Broadcast to all
```

---

## 7. Séquence d'Upload d'Attachements

Processus d'upload de fichiers avec traitement d'images et métadonnées.

```mermaid
sequenceDiagram
    actor User as 👤 Utilisateur
    participant FE as Frontend
    participant GW as Gateway<br/>AttachmentRoute
    participant AS as AttachmentService
    participant Sharp as Sharp<br/>Image Processing
    participant FS as FileSystem
    participant DB as MongoDB

    User->>FE: Sélectionne fichier(s)
    FE->>FE: Valide fichiers<br/>(type, taille)

    FE->>GW: POST /attachments/upload<br/>multipart/form-data<br/>files[] + metadata[]

    GW->>AS: uploadMultiple()<br/>(files, userId)

    loop Pour chaque fichier
        AS->>AS: Génère unique filename<br/>UUID + timestamp

        AS->>AS: Détermine upload path<br/>attachments/YYYY/MM/userId/

        AS->>FS: Crée répertoires<br/>mkdir -p

        alt Fichier = Image
            AS->>Sharp: Load image buffer

            Sharp->>Sharp: Resize (max 2048x2048)<br/>preserveAspectRatio
            Sharp->>FS: Save image

            Sharp->>Sharp: Create thumbnail<br/>200x200 crop
            Sharp->>FS: Save thumbnail

            Sharp->>Sharp: Extract metadata<br/>(width, height, format)
            Sharp-->>AS: Image metadata

        else Fichier = Audio/Video
            AS->>AS: Extract metadata<br/>(duration, bitrate, codec)
            AS->>FS: Save file as-is

        else Autre fichier
            AS->>FS: Save file directly
        end

        AS->>DB: CREATE MessageAttachment<br/>{fileName, mimeType, size, ...}
        DB-->>AS: attachment.id

        AS->>AS: Generate public URL<br/>/attachments/{id}
    end

    AS-->>GW: Array<ProcessedAttachment>
    GW-->>FE: 200 OK<br/>[{id, url, metadata}]

    FE->>FE: Update message UI<br/>with attachments
    FE-->>User: ✅ Fichiers uploadés

    opt Message envoyé avec attachments
        FE->>GW: POST /messages<br/>{content, attachmentIds[]}
        GW->>DB: Link attachments<br/>to message
    end

    Note over FS: Structure:<br/>uploads/attachments/2025/01/{userId}/<br/>  ├─ file.jpg<br/>  └─ thumbnails/file_thumb.jpg
```

---

## 8. Flux de Données en Temps Réel

Architecture Socket.IO pour la communication en temps réel.

```mermaid
graph TB
    subgraph "Clients"
        User1[👤 User 1<br/>Socket ID: abc123]
        User2[👤 User 2<br/>Socket ID: def456]
        User3[👥 Anonymous<br/>Socket ID: ghi789]
    end

    subgraph "Gateway - Socket.IO Server"
        SocketManager[🔌 MeeshySocketIOManager]

        subgraph "Rooms"
            ConvRoom1[conversation:conv_001]
            ConvRoom2[conversation:conv_002]
            UserRoom1[user:userId_1]
            UserRoom2[user:userId_2]
        end

        subgraph "Event Handlers"
            MessageHandler[💬 Message Handler]
            TypingHandler[⌨️ Typing Handler]
            CallHandler[📞 Call Handler]
            StatusHandler[🟢 Status Handler]
        end
    end

    subgraph "Backend Services"
        MessagingService[📨 Messaging Service]
        TranslationService[🌍 Translation Service]
        CallService[📞 Call Service]
    end

    User1 -->|Socket.IO Connect<br/>auth: {token}| SocketManager
    User2 -->|Socket.IO Connect<br/>auth: {token}| SocketManager
    User3 -->|Socket.IO Connect<br/>auth: {sessionToken}| SocketManager

    SocketManager -->|join rooms| ConvRoom1
    SocketManager -->|join rooms| ConvRoom2
    SocketManager -->|join rooms| UserRoom1
    SocketManager -->|join rooms| UserRoom2

    User1 -.->|emit('message:send')| MessageHandler
    MessageHandler --> MessagingService
    MessagingService -.->|emit('message:received')| ConvRoom1

    User2 -.->|emit('user:typing')| TypingHandler
    TypingHandler -.->|broadcast| ConvRoom1

    MessagingService --> TranslationService
    TranslationService -.->|emit('translation:received')| ConvRoom1

    User1 -.->|emit('call:initiate')| CallHandler
    CallHandler --> CallService
    CallService -.->|emit('call:ringing')| UserRoom2

    ConvRoom1 -.->|message:received| User1
    ConvRoom1 -.->|message:received| User2
    ConvRoom1 -.->|translation:received| User1
    ConvRoom1 -.->|user:typing| User1

    StatusHandler -.->|emit('user:status')| SocketManager
    SocketManager -.->|broadcast| User1
    SocketManager -.->|broadcast| User2

    style User1 fill:#4CAF50
    style User2 fill:#2196F3
    style User3 fill:#FF9800
    style SocketManager fill:#FFC107
    style ConvRoom1 fill:#E91E63
    style ConvRoom2 fill:#9C27B0
```

---

## 9. Modèle de Base de Données (ERD)

Relations entre les principales entités MongoDB.

```mermaid
erDiagram
    User ||--o{ ConversationMember : "member of"
    User ||--o{ Message : "sends"
    User ||--o{ Reaction : "reacts"
    User ||--o{ FriendRequest : "sends/receives"
    User ||--|| UserStats : "has"
    User ||--o{ UserPreference : "has"
    User ||--o{ CallParticipant : "participates"

    Conversation ||--o{ ConversationMember : "has"
    Conversation ||--o{ Message : "contains"
    Conversation ||--o{ ConversationShareLink : "has"
    Conversation ||--o{ TypingIndicator : "has"
    Conversation ||--o{ CallSession : "has"

    Community ||--o{ CommunityMember : "has"
    Community ||--o{ Conversation : "contains"

    Message ||--o{ MessageStatus : "has"
    Message ||--o{ MessageTranslation : "has"
    Message ||--o{ MessageAttachment : "has"
    Message ||--o{ Reaction : "receives"
    Message ||--o{ Message : "replies to"

    ConversationShareLink ||--o{ AnonymousParticipant : "creates"

    AnonymousParticipant ||--o{ Message : "sends"
    AnonymousParticipant ||--o{ Reaction : "reacts"

    CallSession ||--o{ CallParticipant : "has"
    CallSession ||--o{ Transcription : "has"

    User {
        ObjectId id PK
        string username UK
        string email UK
        string password
        string systemLanguage
        string regionalLanguage
        string role
        boolean isOnline
        datetime lastSeen
    }

    Conversation {
        ObjectId id PK
        string identifier UK
        string type
        string title
        boolean isActive
        datetime lastMessageAt
    }

    Message {
        ObjectId id PK
        ObjectId conversationId FK
        ObjectId senderId FK
        ObjectId anonymousSenderId FK
        string content
        string originalLanguage
        string messageType
        boolean isEdited
        boolean isDeleted
        ObjectId replyToId FK
    }

    MessageTranslation {
        ObjectId id PK
        ObjectId messageId FK
        string sourceLanguage
        string targetLanguage
        string translatedContent
        string translationModel
        string cacheKey UK
        float confidenceScore
    }

    MessageAttachment {
        ObjectId id PK
        ObjectId messageId FK
        string fileName
        string originalName
        string mimeType
        int fileSize
        string filePath
        string fileUrl
        int width
        int height
        int duration
    }

    ConversationShareLink {
        ObjectId id PK
        string linkId UK
        string identifier UK
        ObjectId conversationId FK
        int maxUses
        int currentUses
        boolean allowAnonymousMessages
        boolean requireNickname
    }

    AnonymousParticipant {
        ObjectId id PK
        ObjectId conversationId FK
        ObjectId shareLinkId FK
        string sessionToken UK
        string username
        string email
        boolean isActive
        boolean canSendMessages
    }

    CallSession {
        ObjectId id PK
        ObjectId conversationId FK
        ObjectId initiatorId FK
        string mode
        string status
        datetime startedAt
        datetime endedAt
        int duration
    }
```

---

## 10. Infrastructure Réseau

Architecture réseau et flux de communication entre services.

```mermaid
graph TB
    subgraph "External Network"
        Internet([🌐 Internet])
    end

    subgraph "DMZ - Port 80/443"
        Traefik[🔀 Traefik Reverse Proxy<br/>SSL Termination<br/>Load Balancing]
    end

    subgraph "Application Layer"
        subgraph "Frontend Tier"
            FE[Next.js Frontend<br/>:3100<br/>Static + SSR]
        end

        subgraph "API Tier"
            GW1[Gateway Instance 1<br/>:3000]
            GW2[Gateway Instance 2<br/>:3000]
            GW3[Gateway Instance N<br/>:3000]
        end

        subgraph "Service Tier"
            Trans1[Translator Instance 1<br/>HTTP: 8000<br/>ZMQ: 5555, 5558]
            Trans2[Translator Instance 2<br/>HTTP: 8001<br/>ZMQ: 5565, 5568]
        end
    end

    subgraph "Data Layer"
        subgraph "Database Cluster"
            MongoPrimary[(MongoDB Primary<br/>:27017)]
            MongoSecondary1[(MongoDB Secondary<br/>:27018)]
            MongoSecondary2[(MongoDB Secondary<br/>:27019)]
        end

        subgraph "Cache Cluster"
            RedisMaster[(Redis Master<br/>:6379)]
            RedisSlave[(Redis Slave<br/>:6380)]
        end

        subgraph "Storage"
            NFS[Shared Storage<br/>NFS/S3<br/>Attachments]
        end
    end

    Internet -->|HTTPS| Traefik

    Traefik -->|HTTP| FE
    Traefik -->|HTTP + WS| GW1
    Traefik -->|HTTP + WS| GW2
    Traefik -->|HTTP + WS| GW3

    FE -->|REST + Socket.IO| GW1
    FE -->|REST + Socket.IO| GW2

    GW1 -->|ZMQ| Trans1
    GW1 -->|ZMQ| Trans2
    GW2 -->|ZMQ| Trans1
    GW2 -->|ZMQ| Trans2
    GW3 -->|ZMQ| Trans1

    GW1 -->|Prisma| MongoPrimary
    GW2 -->|Prisma| MongoPrimary
    GW3 -->|Prisma| MongoPrimary

    Trans1 -->|Prisma| MongoPrimary
    Trans2 -->|Prisma| MongoPrimary

    GW1 -->|Read/Write| RedisMaster
    GW2 -->|Read/Write| RedisMaster
    GW3 -->|Read/Write| RedisMaster

    Trans1 -->|Read/Write| RedisMaster
    Trans2 -->|Read/Write| RedisMaster

    MongoPrimary -->|Replication| MongoSecondary1
    MongoPrimary -->|Replication| MongoSecondary2

    RedisMaster -->|Replication| RedisSlave

    GW1 -.->|File I/O| NFS
    GW2 -.->|File I/O| NFS
    GW3 -.->|File I/O| NFS

    style Internet fill:#E3F2FD
    style Traefik fill:#37ABC8
    style FE fill:#61DAFB
    style GW1 fill:#68A063
    style GW2 fill:#68A063
    style GW3 fill:#68A063
    style Trans1 fill:#009688
    style Trans2 fill:#009688
    style MongoPrimary fill:#47A248
    style RedisMaster fill:#DC382D
```

---

## 11. États des Connexions WebSocket

Diagramme d'états pour les connexions Socket.IO.

```mermaid
stateDiagram-v2
    [*] --> Disconnected

    Disconnected --> Connecting : Client connects
    Connecting --> Authenticating : Connection established

    Authenticating --> Authenticated : Valid JWT/Session token
    Authenticating --> Disconnected : Invalid token
    Authenticating --> Disconnected : Timeout (45s)

    Authenticated --> JoiningRooms : Authentication success
    JoiningRooms --> Active : Rooms joined

    state Active {
        [*] --> Idle
        Idle --> SendingMessage : User sends message
        SendingMessage --> Idle : Message sent

        Idle --> Typing : User typing
        Typing --> Idle : Stopped typing (3s)

        Idle --> InCall : Initiates/Joins call
        InCall --> Idle : Call ended

        Idle --> ReceivingData : Message/Translation received
        ReceivingData --> Idle : Data processed
    }

    Active --> Reconnecting : Connection lost
    Reconnecting --> Authenticating : Reconnection attempt
    Reconnecting --> Disconnected : Max retries exceeded

    Active --> Disconnected : User logout
    Active --> Disconnected : Client closes connection

    Disconnected --> [*]

    note right of Authenticating
        Validates:
        - JWT token
        - Session token
        - User exists
        - User active
    end note

    note right of Active
        Client can:
        - Send messages
        - Join conversations
        - Make calls
        - Receive updates
    end note

    note right of Reconnecting
        Auto-reconnect:
        - Exponential backoff
        - Max 5 attempts
        - Preserve state
    end note
```

---

## 12. Séquence d'Appel Vidéo WebRTC

Processus de signaling pour établir une connexion WebRTC P2P.

```mermaid
sequenceDiagram
    actor UserA as 👤 Alice
    participant FE_A as Frontend A
    participant Socket_A as Socket.IO A
    participant GW as Gateway
    participant Socket_B as Socket.IO B
    participant FE_B as Frontend B
    actor UserB as 👤 Bob
    participant TURN as TURN/STUN<br/>Servers

    UserA->>FE_A: Clique "Appeler Bob"
    FE_A->>Socket_A: emit('call:initiate')<br/>{conversationId, recipientId}

    Socket_A->>GW: Initiate call
    GW->>GW: CREATE CallSession<br/>{mode: 'p2p', status: 'initiated'}

    GW->>Socket_B: emit('call:initiated')<br/>to room user:Bob
    Socket_B->>FE_B: Call notification
    FE_B-->>UserB: 📞 Appel entrant d'Alice

    UserB->>FE_B: Accepte l'appel
    FE_B->>Socket_B: emit('call:answer')<br/>{callId}

    Socket_B->>GW: Answer call
    GW->>GW: UPDATE CallSession<br/>{status: 'ringing'}

    GW->>Socket_A: emit('call:ringing')
    Socket_A->>FE_A: Call ringing

    par WebRTC Setup - Alice (Caller)
        FE_A->>FE_A: Create RTCPeerConnection
        FE_A->>TURN: Get ICE servers<br/>(STUN/TURN)
        TURN-->>FE_A: Server list

        FE_A->>FE_A: getUserMedia()<br/>(camera + microphone)
        FE_A->>FE_A: Add local stream to PC

        FE_A->>FE_A: Create offer<br/>pc.createOffer()
        FE_A->>FE_A: Set local description

        FE_A->>Socket_A: emit('call:signal')<br/>{type: 'offer', sdp}
        Socket_A->>GW: Forward signal
        GW->>Socket_B: emit('call:signal')
        Socket_B->>FE_B: Receive offer
    end

    par WebRTC Setup - Bob (Callee)
        FE_B->>FE_B: Create RTCPeerConnection
        FE_B->>TURN: Get ICE servers
        TURN-->>FE_B: Server list

        FE_B->>FE_B: getUserMedia()<br/>(camera + microphone)
        FE_B->>FE_B: Add local stream to PC

        FE_B->>FE_B: Set remote description<br/>(Alice's offer)
        FE_B->>FE_B: Create answer<br/>pc.createAnswer()
        FE_B->>FE_B: Set local description

        FE_B->>Socket_B: emit('call:signal')<br/>{type: 'answer', sdp}
        Socket_B->>GW: Forward signal
        GW->>Socket_A: emit('call:signal')
        Socket_A->>FE_A: Receive answer

        FE_A->>FE_A: Set remote description<br/>(Bob's answer)
    end

    loop ICE Candidate Exchange
        FE_A->>Socket_A: emit('call:signal')<br/>{type: 'ice-candidate'}
        Socket_A->>GW: Forward
        GW->>Socket_B: Forward
        Socket_B->>FE_B: Add ICE candidate

        FE_B->>Socket_B: emit('call:signal')<br/>{type: 'ice-candidate'}
        Socket_B->>GW: Forward
        GW->>Socket_A: Forward
        Socket_A->>FE_A: Add ICE candidate
    end

    FE_A->>FE_A: ICE Connection<br/>State: connected
    FE_B->>FE_B: ICE Connection<br/>State: connected

    FE_A->>Socket_A: emit('call:connected')
    Socket_A->>GW: Update call status
    GW->>GW: UPDATE CallSession<br/>{status: 'active', answeredAt}

    Note over FE_A,FE_B: ✅ P2P Connection établie<br/>Audio/Video streaming directement<br/>entre Alice et Bob

    FE_A-->>UserA: 📹 Appel en cours
    FE_B-->>UserB: 📹 Appel en cours

    UserA->>FE_A: Termine l'appel
    FE_A->>FE_A: Close RTCPeerConnection
    FE_A->>Socket_A: emit('call:end')<br/>{callId}

    Socket_A->>GW: End call
    GW->>GW: UPDATE CallSession<br/>{status: 'ended', endedAt, duration}

    GW->>Socket_B: emit('call:ended')
    Socket_B->>FE_B: Call ended
    FE_B->>FE_B: Close RTCPeerConnection

    FE_B-->>UserB: 📵 Appel terminé
```

---

## Utilisation des Diagrammes

### Rendu des Diagrammes Mermaid

Ces diagrammes peuvent être rendus dans :

1. **GitHub** - Affichage natif dans les fichiers Markdown
2. **Mermaid Live Editor** - https://mermaid.live
3. **VS Code** - Extensions Mermaid Preview
4. **Documentation Sites** - Docusaurus, MkDocs, etc.

### Personnalisation

Vous pouvez modifier les diagrammes en ajustant :
- Les styles avec `style NodeName fill:#COLOR`
- Les légendes avec `Note over/right of/left of`
- Les formes des nœuds (rectangles, cercles, bases de données)
- Les types de flèches (solides, pointillées, directionnelles)

### Mise à Jour

Pour maintenir ces diagrammes à jour :
1. Mettre à jour après chaque changement architectural majeur
2. Versionner avec le code source
3. Inclure dans la documentation technique
4. Réviser lors des code reviews

---

**Version:** 1.0
**Dernière mise à jour:** 2025-11-06
**Maintenu par:** Équipe Meeshy
