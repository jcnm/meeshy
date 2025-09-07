#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const translations = {
  de: {
    "createConversationLink": "Gesprächslink erstellen",
    "needBigbossRights": "BIGBOSS-Rechte erforderlich, um Freigabelinks für globale Gespräche zu erstellen",
    "noRightsToCreate": "Sie haben keine Rechte, Freigabelinks für dieses Gespräch zu erstellen",
    "linkCreatedAndCopied": "Gesprächslink erstellt und kopiert",
    "linkCreated": "Gesprächslink erstellt",
    "copyManually": "Manuell kopieren",
    "copiedToClipboard": "In die Zwischenablage kopiert",
    "copyFailed": "Kopieren fehlgeschlagen",
    "errorCreatingLink": "Fehler beim Erstellen des Links",
    "createLinkButton": "Link-Erstellungsbutton"
  },
  it: {
    "createConversationLink": "Crea link conversazione",
    "needBigbossRights": "Diritti BIGBOSS richiesti per creare link di condivisione per conversazioni globali",
    "noRightsToCreate": "Non hai i diritti per creare link di condivisione per questa conversazione",
    "linkCreatedAndCopied": "Link conversazione creato e copiato",
    "linkCreated": "Link conversazione creato",
    "copyManually": "Copia manualmente",
    "copiedToClipboard": "Copiato negli appunti",
    "copyFailed": "Copia fallita",
    "errorCreatingLink": "Errore nella creazione del link",
    "createLinkButton": "Pulsante crea link"
  },
  pt: {
    "createConversationLink": "Criar link de conversa",
    "needBigbossRights": "Direitos BIGBOSS necessários para criar links de compartilhamento para conversas globais",
    "noRightsToCreate": "Você não tem direitos para criar links de compartilhamento para esta conversa",
    "linkCreatedAndCopied": "Link de conversa criado e copiado",
    "linkCreated": "Link de conversa criado",
    "copyManually": "Copiar manualmente",
    "copiedToClipboard": "Copiado para a área de transferência",
    "copyFailed": "Falha na cópia",
    "errorCreatingLink": "Erro ao criar link",
    "createLinkButton": "Botão criar link"
  },
  ru: {
    "createConversationLink": "Создать ссылку на разговор",
    "needBigbossRights": "Требуются права BIGBOSS для создания ссылок для общих разговоров",
    "noRightsToCreate": "У вас нет прав для создания ссылок для этого разговора",
    "linkCreatedAndCopied": "Ссылка на разговор создана и скопирована",
    "linkCreated": "Ссылка на разговор создана",
    "copyManually": "Копировать вручную",
    "copiedToClipboard": "Скопировано в буфер обмена",
    "copyFailed": "Ошибка копирования",
    "errorCreatingLink": "Ошибка создания ссылки",
    "createLinkButton": "Кнопка создания ссылки"
  },
  ar: {
    "createConversationLink": "إنشاء رابط المحادثة",
    "needBigbossRights": "مطلوب صلاحيات BIGBOSS لإنشاء روابط مشاركة للمحادثات العامة",
    "noRightsToCreate": "ليس لديك صلاحيات لإنشاء روابط مشاركة لهذه المحادثة",
    "linkCreatedAndCopied": "تم إنشاء رابط المحادثة ونسخه",
    "linkCreated": "تم إنشاء رابط المحادثة",
    "copyManually": "نسخ يدوياً",
    "copiedToClipboard": "تم النسخ إلى الحافظة",
    "copyFailed": "فشل النسخ",
    "errorCreatingLink": "خطأ في إنشاء الرابط",
    "createLinkButton": "زر إنشاء الرابط"
  },
  ja: {
    "createConversationLink": "会話リンクを作成",
    "needBigbossRights": "グローバル会話の共有リンクを作成するにはBIGBOSS権限が必要です",
    "noRightsToCreate": "この会話の共有リンクを作成する権限がありません",
    "linkCreatedAndCopied": "会話リンクが作成され、コピーされました",
    "linkCreated": "会話リンクが作成されました",
    "copyManually": "手動でコピー",
    "copiedToClipboard": "クリップボードにコピーされました",
    "copyFailed": "コピーに失敗しました",
    "errorCreatingLink": "リンク作成エラー",
    "createLinkButton": "リンク作成ボタン"
  },
  zh: {
    "createConversationLink": "创建对话链接",
    "needBigbossRights": "创建全局对话的分享链接需要BIGBOSS权限",
    "noRightsToCreate": "您没有为此对话创建分享链接的权限",
    "linkCreatedAndCopied": "对话链接已创建并复制",
    "linkCreated": "对话链接已创建",
    "copyManually": "手动复制",
    "copiedToClipboard": "已复制到剪贴板",
    "copyFailed": "复制失败",
    "errorCreatingLink": "创建链接错误",
    "createLinkButton": "创建链接按钮"
  }
};

const localesDir = path.join(__dirname, '../locales');

Object.entries(translations).forEach(([lang, translations]) => {
  const filePath = path.join(localesDir, `${lang}.json`);
  
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      
      // Ajouter la section createLinkButton si elle n'existe pas
      if (!data.createLinkButton) {
        data.createLinkButton = translations;
        
        // Réécrire le fichier avec l'indentation correcte
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
        console.log(`✅ Added createLinkButton translations to ${lang}.json`);
      } else {
        console.log(`⚠️  createLinkButton already exists in ${lang}.json`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${lang}.json:`, error.message);
    }
  } else {
    console.log(`⚠️  File ${lang}.json not found`);
  }
});

console.log('🎉 Translation update completed!');
