/**
 * Composant pour afficher la liste des fichiers attachés avant l'envoi
 */

'use client';

import React from 'react';
import { X, File, Image, FileText, Video, Music } from 'lucide-react';
import { formatFileSize, getAttachmentType } from '../../shared/types/attachment';
import { Button } from '../ui/button';

interface AttachmentListProps {
  files: File[];
  onRemove: (index: number) => void;
  uploadProgress?: { [key: number]: number };
}

export function AttachmentList({ files, onRemove, uploadProgress = {} }: AttachmentListProps) {
  if (files.length === 0) return null;

  const getFileIcon = (file: File) => {
    const type = getAttachmentType(file.type);
    
    switch (type) {
      case 'image':
        return <Image className="w-8 h-8 text-blue-500" />;
      case 'video':
        return <Video className="w-8 h-8 text-purple-500" />;
      case 'audio':
        return <Music className="w-8 h-8 text-green-500" />;
      case 'text':
        return <FileText className="w-8 h-8 text-gray-500" />;
      default:
        return <File className="w-8 h-8 text-gray-500" />;
    }
  };

  const getFilePreview = (file: File) => {
    const type = getAttachmentType(file.type);
    
    if (type === 'image') {
      const url = URL.createObjectURL(file);
      return (
        <img
          src={url}
          alt={file.name}
          className="w-12 h-12 object-cover rounded"
          onLoad={() => URL.revokeObjectURL(url)}
        />
      );
    }
    
    return (
      <div className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded">
        {getFileIcon(file)}
      </div>
    );
  };

  return (
    <div className="border-t border-gray-200 bg-gray-50 p-2 space-y-2">
      <div className="text-xs text-gray-500 font-medium px-2">
        {files.length} fichier{files.length > 1 ? 's' : ''} attaché{files.length > 1 ? 's' : ''}
      </div>
      
      {files.map((file, index) => {
        const progress = uploadProgress[index];
        const isUploading = progress !== undefined && progress < 100;
        
        return (
          <div
            key={`${file.name}-${index}`}
            className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-2 hover:border-gray-300 transition-colors"
          >
            {/* Preview / Icon */}
            {getFilePreview(file)}
            
            {/* File info */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {file.name}
              </div>
              <div className="text-xs text-gray-500">
                {formatFileSize(file.size)}
                {isUploading && ` • Upload en cours ${progress}%`}
              </div>
              
              {/* Progress bar */}
              {isUploading && (
                <div className="mt-1 w-full bg-gray-200 rounded-full h-1">
                  <div
                    className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
            
            {/* Remove button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(index)}
              disabled={isUploading}
              className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}

