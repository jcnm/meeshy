import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AttachmentService } from '../../services/AttachmentService';
import { createMockPrismaClient } from '../helpers/prisma-mock';
import * as fs from 'fs';
import * as path from 'path';

// Mock dependencies
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue(Buffer.from('test')),
    unlink: jest.fn().mockResolvedValue(undefined)
  }
}));
jest.mock('sharp');
jest.mock('music-metadata');
jest.mock('pdf-parse');
jest.mock('fluent-ffmpeg');

describe('AttachmentService', () => {
  let service: AttachmentService;
  let mockPrisma: ReturnType<typeof createMockPrismaClient>;

  beforeEach(() => {
    mockPrisma = createMockPrismaClient();
    service = new AttachmentService(mockPrisma as any);
    jest.clearAllMocks();
  });

  describe('validateFile', () => {
    it('should validate file within size limit', () => {
      const file = {
        buffer: Buffer.from('test'),
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        size: 1024 * 1024 // 1MB
      };

      const result = service.validateFile(file);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject file exceeding size limit', () => {
      const file = {
        buffer: Buffer.from('test'),
        filename: 'huge.mp4',
        mimeType: 'video/mp4',
        size: 3 * 1024 * 1024 * 1024 // 3GB (exceeds 2GB limit)
      };

      const result = service.validateFile(file);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('volumineux');
    });
  });

  describe('generateFilePath', () => {
    it('should generate structured file path', () => {
      const filePath = service.generateFilePath('user-123', 'test.jpg');

      expect(filePath).toMatch(/^\d{4}\/\d{2}\/user-123\//);
      expect(filePath).toContain('.jpg');
    });

    it('should sanitize filename', () => {
      const filePath = service.generateFilePath('user-123', 'test@#$%file.jpg');

      expect(filePath).toMatch(/test____file_[a-z0-9-]+\.jpg$/);
    });
  });

  describe('uploadFile', () => {
    it('should upload file successfully', async () => {
      const mockAttachment = {
        id: 'att-123',
        messageId: '000000000000000000000000',
        fileName: 'test.jpg',
        originalName: 'test.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1024,
        filePath: '2024/01/user-123/test.jpg',
        fileUrl: 'http://localhost:3000/api/attachments/file/2024%2F01%2Fuser-123%2Ftest.jpg',
        thumbnailPath: null,
        thumbnailUrl: null,
        width: null,
        height: null,
        duration: null,
        bitrate: null,
        sampleRate: null,
        codec: null,
        channels: null,
        fps: null,
        videoCodec: null,
        pageCount: null,
        lineCount: null,
        metadata: null,
        uploadedBy: 'user-123',
        isAnonymous: false,
        createdAt: new Date()
      };

      mockPrisma.messageAttachment.create = jest.fn().mockResolvedValue(mockAttachment);

      const file = {
        buffer: Buffer.from('test'),
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        size: 1024
      };

      const result = await service.uploadFile(file, 'user-123', false);

      expect(result).toBeDefined();
      expect(result.id).toBe('att-123');
      expect(result.fileName).toBe('test.jpg');
      expect(mockPrisma.messageAttachment.create).toHaveBeenCalled();
    });

    it('should reject invalid file', async () => {
      const file = {
        buffer: Buffer.from('test'),
        filename: 'huge.mp4',
        mimeType: 'video/mp4',
        size: 3 * 1024 * 1024 * 1024 // Too large
      };

      await expect(service.uploadFile(file, 'user-123')).rejects.toThrow();
    });

    it('should handle upload with metadata', async () => {
      const mockAttachment = {
        id: 'att-123',
        messageId: '000000000000000000000000',
        fileName: 'audio.webm',
        originalName: 'audio.webm',
        mimeType: 'audio/webm',
        fileSize: 1024,
        filePath: '2024/01/user-123/audio.webm',
        fileUrl: 'http://localhost:3000/api/attachments/file/audio.webm',
        thumbnailPath: null,
        thumbnailUrl: null,
        width: null,
        height: null,
        duration: 120,
        bitrate: 128000,
        sampleRate: 48000,
        codec: 'opus',
        channels: 2,
        fps: null,
        videoCodec: null,
        pageCount: null,
        lineCount: null,
        metadata: { audioEffectsTimeline: [] },
        uploadedBy: 'user-123',
        isAnonymous: false,
        createdAt: new Date()
      };

      mockPrisma.messageAttachment.create = jest.fn().mockResolvedValue(mockAttachment);

      const file = {
        buffer: Buffer.from('test'),
        filename: 'audio.webm',
        mimeType: 'audio/webm',
        size: 1024
      };

      const metadata = {
        duration: 120,
        bitrate: 128000,
        sampleRate: 48000,
        codec: 'opus',
        channels: 2,
        audioEffectsTimeline: []
      };

      const result = await service.uploadFile(file, 'user-123', false, undefined, metadata);

      expect(result).toBeDefined();
      expect(result.duration).toBe(120);
      expect(result.bitrate).toBe(128000);
    });
  });

  describe('uploadMultiple', () => {
    it('should upload multiple files', async () => {
      const mockAttachment = {
        id: 'att-123',
        messageId: '000000000000000000000000',
        fileName: 'test.jpg',
        originalName: 'test.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1024,
        filePath: '2024/01/user-123/test.jpg',
        fileUrl: 'http://localhost:3000/api/attachments/file/test.jpg',
        thumbnailPath: null,
        thumbnailUrl: null,
        width: null,
        height: null,
        duration: null,
        bitrate: null,
        sampleRate: null,
        codec: null,
        channels: null,
        fps: null,
        videoCodec: null,
        pageCount: null,
        lineCount: null,
        metadata: null,
        uploadedBy: 'user-123',
        isAnonymous: false,
        createdAt: new Date()
      };

      mockPrisma.messageAttachment.create = jest.fn().mockResolvedValue(mockAttachment);

      const files = [
        {
          buffer: Buffer.from('test1'),
          filename: 'test1.jpg',
          mimeType: 'image/jpeg',
          size: 1024
        },
        {
          buffer: Buffer.from('test2'),
          filename: 'test2.jpg',
          mimeType: 'image/jpeg',
          size: 1024
        }
      ];

      const results = await service.uploadMultiple(files, 'user-123');

      expect(results).toHaveLength(2);
      expect(mockPrisma.messageAttachment.create).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures', async () => {
      mockPrisma.messageAttachment.create = jest.fn()
        .mockResolvedValueOnce({
          id: 'att-1',
          messageId: '000000000000000000000000',
          fileName: 'test1.jpg',
          originalName: 'test1.jpg',
          mimeType: 'image/jpeg',
          fileSize: 1024,
          filePath: 'path1',
          fileUrl: 'url1',
          uploadedBy: 'user-123',
          isAnonymous: false,
          createdAt: new Date(),
          thumbnailPath: null,
          thumbnailUrl: null,
          width: null,
          height: null,
          duration: null,
          bitrate: null,
          sampleRate: null,
          codec: null,
          channels: null,
          fps: null,
          videoCodec: null,
          pageCount: null,
          lineCount: null,
          metadata: null
        })
        .mockRejectedValueOnce(new Error('Upload failed'));

      const files = [
        {
          buffer: Buffer.from('test1'),
          filename: 'test1.jpg',
          mimeType: 'image/jpeg',
          size: 1024
        },
        {
          buffer: Buffer.from('test2'),
          filename: 'huge.mp4',
          mimeType: 'video/mp4',
          size: 3 * 1024 * 1024 * 1024 // Invalid
        }
      ];

      const results = await service.uploadMultiple(files, 'user-123');

      expect(results).toHaveLength(1); // Only successful upload
    });
  });

  describe('associateAttachmentsToMessage', () => {
    it('should associate attachments to message', async () => {
      mockPrisma.messageAttachment.updateMany = jest.fn().mockResolvedValue({ count: 2 });

      await service.associateAttachmentsToMessage(['att-1', 'att-2'], 'msg-123');

      expect(mockPrisma.messageAttachment.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['att-1', 'att-2'] } },
        data: { messageId: 'msg-123' }
      });
    });
  });

  describe('getAttachment', () => {
    it('should return attachment by ID', async () => {
      const mockAttachment = {
        id: 'att-123',
        messageId: 'msg-123',
        fileName: 'test.jpg',
        originalName: 'test.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1024,
        filePath: 'path/to/file',
        fileUrl: 'http://example.com/file.jpg',
        thumbnailPath: null,
        thumbnailUrl: null,
        width: 800,
        height: 600,
        duration: null,
        bitrate: null,
        sampleRate: null,
        codec: null,
        channels: null,
        fps: null,
        videoCodec: null,
        pageCount: null,
        lineCount: null,
        metadata: null,
        uploadedBy: 'user-123',
        isAnonymous: false,
        createdAt: new Date()
      };

      mockPrisma.messageAttachment.findUnique = jest.fn().mockResolvedValue(mockAttachment);

      const result = await service.getAttachment('att-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('att-123');
      expect(result?.fileName).toBe('test.jpg');
    });

    it('should return null for non-existent attachment', async () => {
      mockPrisma.messageAttachment.findUnique = jest.fn().mockResolvedValue(null);

      const result = await service.getAttachment('invalid-id');

      expect(result).toBeNull();
    });
  });

  describe('deleteAttachment', () => {
    it('should delete attachment and files', async () => {
      const mockAttachment = {
        id: 'att-123',
        filePath: '2024/01/user-123/test.jpg',
        thumbnailPath: '2024/01/user-123/test_thumb.jpg'
      };

      mockPrisma.messageAttachment.findUnique = jest.fn().mockResolvedValue(mockAttachment);
      mockPrisma.messageAttachment.delete = jest.fn().mockResolvedValue(mockAttachment);

      await service.deleteAttachment('att-123');

      expect(mockPrisma.messageAttachment.delete).toHaveBeenCalledWith({
        where: { id: 'att-123' }
      });
    });

    it('should throw error for non-existent attachment', async () => {
      mockPrisma.messageAttachment.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.deleteAttachment('invalid-id')).rejects.toThrow('not found');
    });
  });

  describe('getConversationAttachments', () => {
    it('should return attachments for conversation', async () => {
      const mockAttachments = [
        {
          id: 'att-1',
          messageId: 'msg-1',
          fileName: 'file1.jpg',
          originalName: 'file1.jpg',
          mimeType: 'image/jpeg',
          fileSize: 1024,
          filePath: 'path1',
          fileUrl: 'url1',
          thumbnailPath: null,
          thumbnailUrl: null,
          width: null,
          height: null,
          duration: null,
          bitrate: null,
          sampleRate: null,
          codec: null,
          channels: null,
          fps: null,
          videoCodec: null,
          pageCount: null,
          lineCount: null,
          metadata: null,
          uploadedBy: 'user-123',
          isAnonymous: false,
          createdAt: new Date()
        }
      ];

      mockPrisma.messageAttachment.findMany = jest.fn().mockResolvedValue(mockAttachments);

      const results = await service.getConversationAttachments('conv-123');

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('att-1');
    });

    it('should filter by type', async () => {
      mockPrisma.messageAttachment.findMany = jest.fn().mockResolvedValue([]);

      await service.getConversationAttachments('conv-123', { type: 'image' });

      expect(mockPrisma.messageAttachment.findMany).toHaveBeenCalled();
      const callArgs = (mockPrisma.messageAttachment.findMany as jest.Mock).mock.calls[0][0];
      expect(callArgs.where.mimeType).toBeDefined();
    });
  });

  describe('createTextAttachment', () => {
    it('should create text attachment from string', async () => {
      const mockAttachment = {
        id: 'att-123',
        messageId: '000000000000000000000000',
        fileName: 'text.txt',
        originalName: 'text.txt',
        mimeType: 'text/plain',
        fileSize: 11,
        filePath: 'path',
        fileUrl: 'url',
        thumbnailPath: null,
        thumbnailUrl: null,
        width: null,
        height: null,
        duration: null,
        bitrate: null,
        sampleRate: null,
        codec: null,
        channels: null,
        fps: null,
        videoCodec: null,
        pageCount: null,
        lineCount: null,
        metadata: null,
        uploadedBy: 'user-123',
        isAnonymous: false,
        createdAt: new Date()
      };

      mockPrisma.messageAttachment.create = jest.fn().mockResolvedValue(mockAttachment);

      const result = await service.createTextAttachment('Test content', 'user-123');

      expect(result).toBeDefined();
      expect(result.mimeType).toBe('text/plain');
      expect(mockPrisma.messageAttachment.create).toHaveBeenCalled();
    });
  });
});
