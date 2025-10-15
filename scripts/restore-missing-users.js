// Script pour restaurer les 13 utilisateurs manquants directement via mongosh
// Les utilisateurs ont été accidentellement supprimés mais leurs messages et memberships existent encore

// IDs des 13 utilisateurs manquants (récupérés de ConversationMember)
const missingUserIds = [
  '68c074009fa8702138033b8e',
  '68c07b3f9fa8702138033bab',
  '68c08add9fa8702138033bbd',
  '68c1e77713e50816f2e5bad9',
  '68c1f48213e50816f2e5baeb',
  '68c2029813e50816f2e5bba3',
  '68c206cc13e50816f2e5bc4f',
  '68c2a3576b398f7db96c440a',
  '68c2c8d243ebb97e261e3223',
  '68cfaa8243ebb97e261e3271',
  '68ee75f55ea8d1d466a3a01b',
  '68ee78e8f3b7e605e1313165',
  '68ee7970f3b7e605e1313175'
];

print('🔍 Recherche des informations des utilisateurs manquants...\n');

// Password par défaut: Meeshy2025! (hash bcrypt)
const defaultPasswordHash = '$2b$10$xL/XljOp5fNLMZjgdYjumea4cMCZqaeME.OypR6Wv/Twi/pNwN3EO';

let restoredCount = 0;

missingUserIds.forEach(userId => {
  const objectId = ObjectId(userId);
  
  // Vérifier si l'utilisateur existe déjà
  const existing = db.User.findOne({ _id: objectId });
  if (existing) {
    print(`✅ User ${userId} already exists: ${existing.username}`);
    return;
  }
  
  // Chercher dans ConversationMember pour la date de création et le rôle
  const member = db.ConversationMember.findOne({ userId: objectId });
  
  if (!member) {
    print(`⚠️  No membership data found for user ${userId}, skipping...`);
    return;
  }
  
  // Générer un username basé sur l'ID
  const username = `user_${userId.substring(userId.length - 6)}`;
  const email = `${username}@meeshy.me`;
  
  const userData = {
    _id: objectId,
    username: username,
    firstName: 'Utilisateur',
    lastName: 'Restauré',
    bio: 'Compte restauré - veuillez changer votre mot de passe',
    email: email,
    password: defaultPasswordHash,
    displayName: `User ${userId.substring(userId.length - 6)}`,
    isOnline: false,
    lastSeen: member.joinedAt,
    lastActiveAt: member.joinedAt,
    systemLanguage: 'fr',
    regionalLanguage: 'fr',
    autoTranslateEnabled: true,
    translateToSystemLanguage: true,
    translateToRegionalLanguage: false,
    useCustomDestination: false,
    role: member.role === 'MODERATOR' ? 'MODO' : 'USER',
    isActive: true,
    createdAt: member.joinedAt,
    updatedAt: new Date()
  };
  
  db.User.insertOne(userData);
  restoredCount++;
  
  print(`✅ Restored user ${userId}:`);
  print(`   - Username: ${username}`);
  print(`   - Email: ${email}`);
  print(`   - Role: ${userData.role}`);
  print(`   - Created: ${member.joinedAt.toISOString()}`);
  print('');
});

print(`\n✅ Restauration terminée ! ${restoredCount} utilisateurs restaurés.`);
print(`📊 Vérification du total d'utilisateurs...`);

const totalUsers = db.User.countDocuments();
print(`Total users in collection User: ${totalUsers}`);
