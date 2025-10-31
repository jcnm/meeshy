'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  User,
  Shield,
  Mail,
  Phone,
  Calendar,
  Edit2,
  Save,
  X,
  Trash2,
  Key,
  CheckCircle,
  XCircle,
  AlertCircle,
  MessageSquare,
  Users as UsersIcon,
  Activity
} from 'lucide-react';
import { apiService } from '@/services/api.service';
import { adminService } from '@/services/admin.service';
import type { User } from '@/services/admin.service';
import { toast } from 'sonner';

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    displayName: '',
    bio: '',
    systemLanguage: 'fr',
    regionalLanguage: 'fr'
  });

  const [roleEdit, setRoleEdit] = useState({
    editing: false,
    role: '',
    reason: ''
  });

  const [passwordReset, setPasswordReset] = useState({
    open: false,
    newPassword: '',
    confirmPassword: '',
    reason: ''
  });

  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    loadUserData();
  }, [userId]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const response = await apiService.get(`/admin/user-management/${userId}`);

      if (response.data?.success && response.data?.data) {
        const userData = response.data.data;
        setUser(userData);
        setFormData({
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          displayName: userData.displayName || '',
          bio: userData.bio || '',
          systemLanguage: userData.systemLanguage || 'fr',
          regionalLanguage: userData.regionalLanguage || 'fr'
        });
        setRoleEdit(prev => ({ ...prev, role: userData.role }));
      }
    } catch (error) {
      console.error('Erreur chargement utilisateur:', error);
      toast.error('Erreur lors du chargement de l\'utilisateur');
      router.push('/admin/users');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      setSaving(true);
      const response = await apiService.patch(`/admin/user-management/${userId}`, formData);

      if (response.data?.success) {
        toast.success('Profil mis à jour avec succès');
        setEditMode(false);
        loadUserData();
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!roleEdit.reason || roleEdit.reason.length < 10) {
      toast.error('Veuillez fournir une raison (min 10 caractères)');
      return;
    }

    try {
      setSaving(true);
      const response = await adminService.updateUserRole(userId, roleEdit.role);

      if (response.data?.success) {
        toast.success('Rôle mis à jour avec succès');
        setRoleEdit({ editing: false, role: roleEdit.role, reason: '' });
        loadUserData();
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la mise à jour du rôle');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!user) return;

    try {
      const newStatus = !user.isActive;
      const response = await adminService.toggleUserStatus(userId, newStatus);

      if (response.data?.success) {
        toast.success(newStatus ? 'Utilisateur activé' : 'Utilisateur désactivé');
        loadUserData();
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du changement de statut');
    }
  };

  const handleResetPassword = async () => {
    if (passwordReset.newPassword !== passwordReset.confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    try {
      setSaving(true);
      const response = await apiService.post(`/admin/user-management/${userId}/reset-password`, {
        newPassword: passwordReset.newPassword,
        reason: passwordReset.reason
      });

      if (response.data?.success) {
        toast.success('Mot de passe réinitialisé avec succès');
        setPasswordReset({ open: false, newPassword: '', confirmPassword: '', reason: '' });
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la réinitialisation du mot de passe');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    try {
      setSaving(true);
      const response = await adminService.deleteUser(userId);

      if (response.data?.success) {
        toast.success('Utilisateur supprimé avec succès');
        router.push('/admin/users');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la suppression');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (date: Date | string) => {
    try {
      return new Date(date).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'N/A';
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'BIGBOSS': 'destructive',
      'ADMIN': 'default',
      'MODO': 'secondary',
      'AUDIT': 'outline',
      'ANALYST': 'outline',
      'USER': 'secondary'
    };
    return variants[role] || 'secondary';
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      'BIGBOSS': 'Super Admin',
      'ADMIN': 'Administrateur',
      'MODO': 'Modérateur',
      'AUDIT': 'Auditeur',
      'ANALYST': 'Analyste',
      'USER': 'Utilisateur'
    };
    return labels[role] || role;
  };

  if (loading) {
    return (
      <AdminLayout currentPage="/admin/users">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-lg">Chargement...</span>
        </div>
      </AdminLayout>
    );
  }

  if (!user) {
    return (
      <AdminLayout currentPage="/admin/users">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Utilisateur introuvable</h3>
          <Button onClick={() => router.push('/admin/users')}>Retour à la liste</Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout currentPage="/admin/users">
      <div className="space-y-6 pb-16">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={() => router.push('/admin/users')}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Retour</span>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{user.displayName || user.username}</h1>
              <p className="text-sm text-gray-600">@{user.username}</p>
            </div>
          </div>
          <Badge variant={user.isActive ? 'default' : 'secondary'}>
            {user.isActive ? (
              <>
                <CheckCircle className="h-4 w-4 mr-1" />
                Actif
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 mr-1" />
                Inactif
              </>
            )}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Colonne gauche - Informations principales */}
          <div className="lg:col-span-2 space-y-6">
            {/* Informations du profil */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <User className="h-5 w-5" />
                  <span>Informations du profil</span>
                </CardTitle>
                {!editMode ? (
                  <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
                    <Edit2 className="h-4 w-4 mr-1" />
                    Modifier
                  </Button>
                ) : (
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => {
                      setEditMode(false);
                      setFormData({
                        firstName: user.firstName || '',
                        lastName: user.lastName || '',
                        displayName: user.displayName || '',
                        bio: user.bio || '',
                        systemLanguage: user.systemLanguage || 'fr',
                        regionalLanguage: user.regionalLanguage || 'fr'
                      });
                    }}>
                      <X className="h-4 w-4 mr-1" />
                      Annuler
                    </Button>
                    <Button size="sm" onClick={handleUpdateProfile} disabled={saving}>
                      <Save className="h-4 w-4 mr-1" />
                      Sauvegarder
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {editMode ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Prénom</label>
                        <Input
                          value={formData.firstName}
                          onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Nom</label>
                        <Input
                          value={formData.lastName}
                          onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Nom d'affichage</label>
                      <Input
                        value={formData.displayName}
                        onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Biographie</label>
                      <textarea
                        className="w-full p-2 border rounded-md text-sm min-h-[80px]"
                        value={formData.bio}
                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                        maxLength={500}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Langue système</label>
                        <select
                          className="w-full p-2 border rounded-md text-sm bg-white"
                          value={formData.systemLanguage}
                          onChange={(e) => setFormData({ ...formData, systemLanguage: e.target.value })}
                        >
                          <option value="en">Anglais</option>
                          <option value="fr">Français</option>
                          <option value="pt">Portugais</option>
                          <option value="es">Espagnol</option>
                          <option value="de">Allemand</option>
                          <option value="it">Italien</option>
                          <option value="zh">Chinois</option>
                          <option value="ja">Japonais</option>
                          <option value="ar">Arabe</option>
                          <option value="ru">Russe</option>
                          <option value="ko">Coréen</option>
                          <option value="hi">Hindi</option>
                          <option value="tr">Turc</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Langue régionale</label>
                        <select
                          className="w-full p-2 border rounded-md text-sm bg-white"
                          value={formData.regionalLanguage}
                          onChange={(e) => setFormData({ ...formData, regionalLanguage: e.target.value })}
                        >
                          <option value="en">Anglais</option>
                          <option value="fr">Français</option>
                          <option value="pt">Portugais</option>
                          <option value="es">Espagnol</option>
                          <option value="de">Allemand</option>
                          <option value="it">Italien</option>
                          <option value="zh">Chinois</option>
                          <option value="ja">Japonais</option>
                          <option value="ar">Arabe</option>
                          <option value="ru">Russe</option>
                          <option value="ko">Coréen</option>
                          <option value="hi">Hindi</option>
                          <option value="tr">Turc</option>
                        </select>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center text-sm">
                      <span className="w-32 text-gray-600">Nom complet:</span>
                      <span className="font-medium">{user.firstName} {user.lastName}</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <span className="w-32 text-gray-600">Email:</span>
                      <span className="font-medium flex items-center">
                        <Mail className="h-4 w-4 mr-2 text-gray-400" />
                        {user.email}
                      </span>
                    </div>
                    {user.phoneNumber && (
                      <div className="flex items-center text-sm">
                        <span className="w-32 text-gray-600">Téléphone:</span>
                        <span className="font-medium flex items-center">
                          <Phone className="h-4 w-4 mr-2 text-gray-400" />
                          {user.phoneNumber}
                        </span>
                      </div>
                    )}
                    {user.bio && (
                      <div className="text-sm">
                        <span className="text-gray-600 block mb-1">Biographie:</span>
                        <p className="text-gray-900">{user.bio}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="text-sm">
                        <span className="text-gray-600 block">Langue système:</span>
                        <span className="font-medium">{user.systemLanguage}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-600 block">Langue régionale:</span>
                        <span className="font-medium">{user.regionalLanguage}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Gestion du rôle */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5" />
                  <span>Rôle et permissions</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!roleEdit.editing ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm text-gray-600">Rôle actuel:</span>
                      <Badge variant={getRoleBadgeVariant(user.role)}>
                        {getRoleLabel(user.role)}
                      </Badge>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setRoleEdit({ ...roleEdit, editing: true })}>
                      <Edit2 className="h-4 w-4 mr-1" />
                      Modifier
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Nouveau rôle</label>
                      <select
                        className="w-full p-2 border rounded-md text-sm bg-white"
                        value={roleEdit.role}
                        onChange={(e) => setRoleEdit({ ...roleEdit, role: e.target.value })}
                      >
                        <option value="USER">Utilisateur</option>
                        <option value="ADMIN">Administrateur</option>
                        <option value="MODO">Modérateur</option>
                        <option value="AUDIT">Auditeur</option>
                        <option value="ANALYST">Analyste</option>
                        <option value="BIGBOSS">Super Admin</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Raison du changement (requis)</label>
                      <textarea
                        className="w-full p-2 border rounded-md text-sm min-h-[60px]"
                        placeholder="Expliquez pourquoi vous changez ce rôle..."
                        value={roleEdit.reason}
                        onChange={(e) => setRoleEdit({ ...roleEdit, reason: e.target.value })}
                      />
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" onClick={() => setRoleEdit({ editing: false, role: user.role, reason: '' })}>
                        Annuler
                      </Button>
                      <Button size="sm" onClick={handleUpdateRole} disabled={saving}>
                        Enregistrer
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sécurité */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Key className="h-5 w-5" />
                  <span>Sécurité</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!passwordReset.open ? (
                  <Button variant="outline" onClick={() => setPasswordReset({ ...passwordReset, open: true })}>
                    <Key className="h-4 w-4 mr-2" />
                    Réinitialiser le mot de passe
                  </Button>
                ) : (
                  <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Nouveau mot de passe</label>
                      <Input
                        type="password"
                        value={passwordReset.newPassword}
                        onChange={(e) => setPasswordReset({ ...passwordReset, newPassword: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Confirmer le mot de passe</label>
                      <Input
                        type="password"
                        value={passwordReset.confirmPassword}
                        onChange={(e) => setPasswordReset({ ...passwordReset, confirmPassword: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Raison</label>
                      <textarea
                        className="w-full p-2 border rounded-md text-sm min-h-[60px]"
                        value={passwordReset.reason}
                        onChange={(e) => setPasswordReset({ ...passwordReset, reason: e.target.value })}
                      />
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" onClick={() => setPasswordReset({ open: false, newPassword: '', confirmPassword: '', reason: '' })}>
                        Annuler
                      </Button>
                      <Button size="sm" onClick={handleResetPassword} disabled={saving}>
                        Réinitialiser
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Colonne droite - Statistiques et actions */}
          <div className="space-y-6">
            {/* Statistiques */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5" />
                  <span>Statistiques</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 flex items-center">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Messages
                  </span>
                  <span className="font-medium">{user._count?.sentMessages || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 flex items-center">
                    <UsersIcon className="h-4 w-4 mr-2" />
                    Conversations
                  </span>
                  <span className="font-medium">{user._count?.conversations || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm pt-2 border-t">
                  <span className="text-gray-600 flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    Membre depuis
                  </span>
                  <span className="font-medium text-xs">{formatDate(user.createdAt)}</span>
                </div>
                {user.lastActiveAt && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Dernière activité</span>
                    <span className="font-medium text-xs">{formatDate(user.lastActiveAt)}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions rapides</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleToggleStatus}
                >
                  {user.isActive ? (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      Désactiver le compte
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Activer le compte
                    </>
                  )}
                </Button>

                {!deleteConfirm ? (
                  <Button
                    variant="outline"
                    className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => setDeleteConfirm(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer l'utilisateur
                  </Button>
                ) : (
                  <div className="p-4 border border-red-200 rounded-lg bg-red-50 space-y-3">
                    <p className="text-sm text-red-800 font-medium">
                      ⚠️ Cette action est irréversible !
                    </p>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setDeleteConfirm(false)}
                      >
                        Annuler
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-red-600 hover:bg-red-700"
                        onClick={handleDeleteUser}
                        disabled={saving}
                      >
                        Confirmer
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Informations de sécurité */}
            <Card>
              <CardHeader>
                <CardTitle>Sécurité du compte</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Email vérifié</span>
                  {user.emailVerified ? (
                    <Badge variant="default" className="text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Oui
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      <XCircle className="h-3 w-3 mr-1" />
                      Non
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">2FA activé</span>
                  {user.twoFactorEnabled ? (
                    <Badge variant="default" className="text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Oui
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      <XCircle className="h-3 w-3 mr-1" />
                      Non
                    </Badge>
                  )}
                </div>
                {user.profileCompletionRate !== null && (
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-gray-600">Complétion du profil</span>
                      <span className="font-medium">{user.profileCompletionRate}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${user.profileCompletionRate}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
