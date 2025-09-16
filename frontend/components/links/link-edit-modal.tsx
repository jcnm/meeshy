'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Link2, 
  Calendar as CalendarIcon,
  MessageSquare,
  Image,
  FileText,
  Eye,
  Users,
  Mail,
  Hash
} from 'lucide-react';
import { ConversationLink } from '@/types';
import { useTranslations } from '@/hooks/useTranslations';
import { toast } from 'sonner';
import { buildApiUrl } from '@/lib/config';
import { cn } from '@/lib/utils';

interface LinkEditModalProps {
  link: ConversationLink;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function LinkEditModal({ link, isOpen, onClose, onUpdate }: LinkEditModalProps) {
  const { t } = useTranslations('links');
  const [isLoading, setIsLoading] = useState(false);
  
  // États du formulaire
  const [formData, setFormData] = useState({
    name: link.name || '',
    description: link.description || '',
    maxUses: link.maxUses || undefined,
    expiresAt: link.expiresAt ? new Date(link.expiresAt) : undefined,
    allowAnonymousMessages: link.allowAnonymousMessages,
    allowAnonymousImages: link.allowAnonymousImages,
    allowAnonymousFiles: link.allowAnonymousFiles,
    allowViewHistory: link.allowViewHistory,
    requireNickname: link.requireNickname,
    requireEmail: link.requireEmail
  });

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(buildApiUrl(`/api/links/${link.linkId}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          expiresAt: formData.expiresAt?.toISOString()
        })
      });

      if (response.ok) {
        toast.success(t('success.linkUpdated'));
        onUpdate();
      } else {
        const error = await response.json();
        toast.error(error.message || t('errors.updateFailed'));
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      toast.error(t('errors.updateFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto sm:max-w-2xl sm:w-[90vw] sm:max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            {t('edit.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informations de base */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">{t('edit.linkName')}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('edit.linkNamePlaceholder')}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="description">{t('edit.description')}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('edit.descriptionPlaceholder')}
                className="mt-1"
                rows={3}
              />
            </div>
          </div>

          {/* Limites d'utilisation */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center space-x-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <Label htmlFor="maxUses">{t('edit.maxUses')}</Label>
                  <p className="text-sm text-muted-foreground">{t('edit.maxUsesDescription')}</p>
                </div>
                <Input
                  id="maxUses"
                  type="number"
                  value={formData.maxUses || ''}
                  onChange={(e) => setFormData({ ...formData, maxUses: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="∞"
                  className="w-24"
                  min="1"
                />
              </div>

              <div className="flex items-center space-x-3">
                <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <Label>{t('edit.expiresAt')}</Label>
                  <p className="text-sm text-muted-foreground">{t('edit.expiresAtDescription')}</p>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[240px] justify-start text-left font-normal",
                        !formData.expiresAt && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.expiresAt ? (
                        formData.expiresAt.toLocaleDateString('fr-FR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      ) : (
                        <span>{t('edit.selectDate')}</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <div className="p-3">
                      <Input
                        type="datetime-local"
                        value={formData.expiresAt ? formData.expiresAt.toISOString().slice(0, 16) : ''}
                        onChange={(e) => {
                          const date = e.target.value ? new Date(e.target.value) : null;
                          setFormData({ ...formData, expiresAt: date });
                        }}
                        min={new Date().toISOString().slice(0, 16)}
                        className="w-full"
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </CardContent>
          </Card>

          {/* Permissions */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="font-medium mb-4">{t('edit.permissions')}</h3>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="allowMessages">{t('permissions.messages')}</Label>
                    <p className="text-sm text-muted-foreground">{t('permissions.messagesDescription')}</p>
                  </div>
                </div>
                <Switch
                  id="allowMessages"
                  checked={formData.allowAnonymousMessages}
                  onCheckedChange={(checked) => setFormData({ ...formData, allowAnonymousMessages: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Image className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="allowImages">{t('permissions.images')}</Label>
                    <p className="text-sm text-muted-foreground">{t('permissions.imagesDescription')}</p>
                  </div>
                </div>
                <Switch
                  id="allowImages"
                  checked={formData.allowAnonymousImages}
                  onCheckedChange={(checked) => setFormData({ ...formData, allowAnonymousImages: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="allowFiles">{t('permissions.files')}</Label>
                    <p className="text-sm text-muted-foreground">{t('permissions.filesDescription')}</p>
                  </div>
                </div>
                <Switch
                  id="allowFiles"
                  checked={formData.allowAnonymousFiles}
                  onCheckedChange={(checked) => setFormData({ ...formData, allowAnonymousFiles: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Eye className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="allowHistory">{t('permissions.viewHistory')}</Label>
                    <p className="text-sm text-muted-foreground">{t('permissions.viewHistoryDescription')}</p>
                  </div>
                </div>
                <Switch
                  id="allowHistory"
                  checked={formData.allowViewHistory}
                  onCheckedChange={(checked) => setFormData({ ...formData, allowViewHistory: checked })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Exigences */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="font-medium mb-4">{t('edit.requirements')}</h3>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Hash className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="requireNickname">{t('requirements.nickname')}</Label>
                    <p className="text-sm text-muted-foreground">{t('requirements.nicknameDescription')}</p>
                  </div>
                </div>
                <Switch
                  id="requireNickname"
                  checked={formData.requireNickname}
                  onCheckedChange={(checked) => setFormData({ ...formData, requireNickname: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="requireEmail">{t('requirements.email')}</Label>
                    <p className="text-sm text-muted-foreground">{t('requirements.emailDescription')}</p>
                  </div>
                </div>
                <Switch
                  id="requireEmail"
                  checked={formData.requireEmail}
                  onCheckedChange={(checked) => setFormData({ ...formData, requireEmail: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            {t('actions.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? t('actions.saving') : t('actions.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
