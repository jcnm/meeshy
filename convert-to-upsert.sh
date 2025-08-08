#!/bin/bash

# Script pour convertir tous les user.create en user.upsert dans le fichier seed.ts

SEED_FILE="/Users/smpceo/Downloads/Meeshy/meeshy/shared/prisma/seed.ts"

# Fonction pour remplacer user.create par user.upsert
convert_user_create() {
    local email=$1
    local username=$2
    
    # Utiliser sed pour remplacer le pattern
    sed -i '' -E "s/await prisma\.user\.create\(\{([[:space:]]*data: \{[[:space:]]*username: '$username',)/await prisma.user.upsert({\
    where: { email: '$email' },\
    update: {},\
    create: {\
      username: '$username',/g" "$SEED_FILE"
}

echo "🔄 Conversion de tous les user.create en user.upsert..."

# Liste des utilisateurs avec leurs emails et usernames
declare -A users=(
    ["french@example.com"]="french_user"
    ["chinese@example.com"]="chinese_user"
    ["american@example.com"]="american_user"
    ["spanish@example.com"]="spanish_user"
    ["alice@example.com"]="alice"
    ["bob@example.com"]="bob"
    ["alice.martin@email.com"]="alice.martin"
    ["bob.johnson@email.com"]="bob.johnson"
    ["carlos.rodriguez@email.com"]="carlos.rodriguez"
    ["takeshi.nakamura@email.com"]="takeshi.nakamura"
    ["yuki.sato@email.com"]="yuki.sato"
    ["li.wei@email.com"]="li.wei"
    ["mei.chen@email.com"]="mei.chen"
    ["pedro.silva@email.com"]="pedro.silva"
    ["maria.santos@email.com"]="maria.santos"
    ["paul.ngassa@email.com"]="paul.ngassa"
    ["grace.nkomo@email.com"]="grace.nkomo"
    ["pierre.gagnon@email.com"]="pierre.gagnon"
    ["sarah.taylor@email.com"]="sarah.taylor"
    ["hans.schmidt@email.com"]="hans.schmidt"
    ["amina.hassan@email.com"]="amina.hassan"
)

# Traiter chaque utilisateur
for email in "${!users[@]}"; do
    username="${users[$email]}"
    echo "Converting $username ($email)..."
    convert_user_create "$email" "$username"
done

echo "✅ Conversion terminée!"
