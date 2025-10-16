/**
 * Composant pour afficher un aperçu d'attachment dans un message
 */

'use client';

import React from 'react';
import { Download, File, FileText, Music, Video, Eye } from 'lucide-react';
import { Attachment, formatFileSize, getAttachmentType } from '../../shared/types/attachment';
import { AttachmentService } from '../../services/attachmentService';

interface AttachmentPreviewProps {
  attachment: Attachment;
  onClick?: () => void;
  showDownload?: boolean;
}

export function AttachmentPreview({ 
  attachment, 
  onClick,
  showDownload = true 
}: AttachmentPreviewProps) {
  const type = getAttachmentType(attachment.mimeType);
  
  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(attachment.fileUrl, '_blank');
  };

  // Image preview
  if (type === 'image') {
    return (
      <div 
        className="relative group cursor-pointer rounded-lg overflow-hidden bg-gray-100 hover:opacity-90 transition-opacity"
        onClick={onClick}
      >
        <img
          src={attachment.thumbnailUrl || attachment.fileUrl}
          alt={attachment.originalName}
          className="w-full h-48 object-cover"
          loading="lazy"
        />
        
        {/* Overlay avec info */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
          <Eye className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        
        {/* Badge taille */}
        <div className="absolute bottom-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
          {formatFileSize(attachment.fileSize)}
        </div>

        {showDownload && (
          <button
            onClick={handleDownload}
            className="absolute top-2 right-2 bg-white bg-opacity-90 hover:bg-opacity-100 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Download className="w-4 h-4 text-gray-700" />
          </button>
        )}
      </div>
    );
  }

  // Audio preview
  if (type === 'audio') {
    return (
      <div className="border border-gray-200 rounded-lg p-3 bg-white">
        <div className="flex items-center gap-3 mb-2">
          <Music className="w-6 h-6 text-green-500" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">
              {attachment.originalName}
            </div>
            <div className="text-xs text-gray-500">
              {formatFileSize(attachment.fileSize)}
            </div>
          </div>
          {showDownload && (
            <button
              onClick={handleDownload}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <Download className="w-4 h-4 text-gray-600" />
            </button>
          )}
        </div>
        <audio 
          controls 
          className="w-full" 
          src={attachment.fileUrl}
          preload="metadata"
        />
      </div>
    );
  }

  // Video preview
  if (type === 'video') {
    return (
      <div 
        className="relative border border-gray-200 rounded-lg overflow-hidden bg-black cursor-pointer group"
        onClick={onClick}
      >
        <video
          src={attachment.fileUrl}
          className="w-full h-48 object-contain"
          preload="metadata"
        />
        
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 group-hover:bg-opacity-50 transition-all">
          <div className="w-16 h-16 bg-white bg-opacity-90 rounded-full flex items-center justify-center">
            <div className="w-0 h-0 border-t-8 border-t-transparent border-l-12 border-l-gray-800 border-b-8 border-b-transparent ml-1" />
          </div>
        </div>

        {showDownload && (
          <button
            onClick={handleDownload}
            className="absolute top-2 right-2 bg-white bg-opacity-90 hover:bg-opacity-100 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Download className="w-4 h-4 text-gray-700" />
          </button>
        )}
      </div>
    );
  }

  // Document/Text preview (generic)
  const getIcon = () => {
    if (type === 'text') return <FileText className="w-8 h-8 text-blue-500" />;
    return <File className="w-8 h-8 text-gray-500" />;
  };

  return (
    <div 
      className="border border-gray-200 rounded-lg p-4 bg-white hover:bg-gray-50 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">
            {attachment.originalName}
          </div>
          <div className="text-xs text-gray-500">
            {formatFileSize(attachment.fileSize)}
          </div>
        </div>

        {showDownload && (
          <button
            onClick={handleDownload}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
          >
            <Download className="w-4 h-4 text-gray-600" />
          </button>
        )}
      </div>
    </div>
  );
}

