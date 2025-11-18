/**
 * WhatsApp DMA Schema Extensions
 *
 * Defines Prisma schema extensions needed for WhatsApp DMA integration
 * Add these fields to the existing Prisma schema in /shared/schema.prisma
 */

/*
 * ADD THESE FIELDS TO THE User MODEL:
 *
 * // WhatsApp DMA Integration
 * whatsAppId                String?                  // WhatsApp user ID (wa_id)
 * whatsAppPhoneNumber       String?                  @unique // WhatsApp phone number
 * protocol                  String?                  // 'whatsapp-dma', 'imessage', 'signal', etc.
 * whatsAppConnectedAt       DateTime?                // When WhatsApp connection was established
 * whatsAppMetadata          Json?                    // WhatsApp-specific metadata
 */

/*
 * ADD THESE FIELDS TO THE Message MODEL:
 *
 * // Protocol Integration
 * protocol                  String?                  // 'whatsapp-dma', 'imessage', 'signal', etc.
 * protocolMessageId         String?                  // External protocol message ID
 * externalMessageId         String?                  // WhatsApp message ID (wamid)
 * status                    String                   @default("pending")  // pending, sent, delivered, read, failed
 * isSignalEncrypted         Boolean                  @default(false)      // Signal Protocol encryption
 * encryptionType            String?                  // 'signal-protocol', 'whatsapp-e2ee', etc.
 * protocolMetadata          Json?                    // Protocol-specific metadata
 */

/*
 * ADD THESE FIELDS TO THE Conversation MODEL:
 *
 * // Protocol Integration
 * protocol                  String?                  // 'whatsapp-dma', 'imessage', 'signal', etc.
 * isPrivate                 Boolean                  @default(false)    // DM conversations
 * metadata                  Json?                    // Protocol-specific metadata
 */

/*
 * CREATE NEW MODEL FOR PROTOCOL MESSAGE MAPPINGS:
 *
 * model ProtocolMessageMapping {
 *   id                    String   @id @default(auto()) @map("_id") @db.ObjectId
 *   internalMessageId     String   @unique @db.ObjectId  // Meeshy message ID
 *   externalMessageId     String                          // Protocol-specific ID (e.g., wamid)
 *   protocol              String                          // 'whatsapp-dma', etc.
 *   protocolMetadata      Json?                           // Additional protocol data
 *   createdAt             DateTime @default(now())
 *
 *   @@index([externalMessageId])
 *   @@index([protocol])
 * }
 */

/*
 * CREATE NEW MODEL FOR WHATSAPP WEBHOOKS:
 *
 * model WhatsAppWebhookLog {
 *   id                    String   @id @default(auto()) @map("_id") @db.ObjectId
 *   webhookEventType      String                          // 'message', 'status', 'read'
 *   externalMessageId     String?                         // WhatsApp message ID
 *   phoneNumberId         String                          // WhatsApp phone number ID
 *   userId                String?  @db.ObjectId          // Linked Meeshy user
 *   payload               Json                            // Raw webhook payload
 *   processed             Boolean  @default(false)
 *   processedAt           DateTime?
 *   error                 String?                         // Error message if processing failed
 *   metadata              Json?
 *   createdAt             DateTime @default(now())
 *
 *   @@index([phoneNumberId])
 *   @@index([externalMessageId])
 *   @@index([processed])
 * }
 */

/*
 * CREATE NEW MODEL FOR PROTOCOL ADAPTER CONFIGURATION:
 *
 * model ProtocolAdapterConfig {
 *   id                    String   @id @default(auto()) @map("_id") @db.ObjectId
 *   protocol              String   @unique              // 'whatsapp-dma', 'imessage', etc.
 *   enabled               Boolean  @default(true)
 *   apiKey                String                         // Encrypted in production
 *   apiSecret             String?                        // Encrypted in production
 *   apiVersion            String?                        // API version being used
 *   webhookUrl            String?                        // Webhook endpoint
 *   webhookSecret         String?                        // Encrypted in production
 *   phoneNumberId         String?                        // WhatsApp-specific
 *   businessAccountId     String?                        // WhatsApp-specific
 *   additionalConfig      Json?                          // Protocol-specific config
 *   lastVerifiedAt        DateTime?                      // Last successful connection test
 *   errorMessage          String?                        // Last error (if any)
 *   createdAt             DateTime @default(now())
 *   updatedAt             DateTime @updatedAt
 * }
 */

export interface WhatsAppSchemaExtension {
  // User fields
  whatsAppId?: string;
  whatsAppPhoneNumber?: string;
  protocol?: string;
  whatsAppConnectedAt?: Date;
  whatsAppMetadata?: Record<string, any>;

  // Message fields
  protocolMessageId?: string;
  externalMessageId?: string;
  messageStatus?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  isSignalEncrypted?: boolean;
  encryptionType?: string;
  protocolMetadata?: Record<string, any>;

  // Conversation fields
  conversationProtocol?: string;
  isPrivate?: boolean;
  conversationMetadata?: Record<string, any>;
}

export interface ProtocolMessageMapping {
  internalMessageId: string;
  externalMessageId: string;
  protocol: string;
  protocolMetadata?: Record<string, any>;
  createdAt: Date;
}

export interface WhatsAppWebhookLog {
  webhookEventType: string;
  externalMessageId?: string;
  phoneNumberId: string;
  userId?: string;
  payload: Record<string, any>;
  processed: boolean;
  processedAt?: Date;
  error?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface ProtocolAdapterConfigData {
  protocol: string;
  enabled: boolean;
  apiKey: string;
  apiSecret?: string;
  apiVersion?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  phoneNumberId?: string;
  businessAccountId?: string;
  additionalConfig?: Record<string, any>;
  lastVerifiedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}
