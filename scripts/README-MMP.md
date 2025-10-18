# MMP - Meeshy Message Publisher

## Usage rapide

```bash
# Configuration
export MEESHY_PASSWORD="votre_mot_de_passe"

# Publication simple depuis le fichier POST par défaut
./mmp.sh

# Publication depuis un fichier spécifique
./mmp.sh -f mon-annonce.txt

# Publication d'un message en ligne
./mmp.sh "Nouveau message sur Meeshy!"

# Publication dans une conversation spécifique
./mmp.sh -c nom-conversation -f message.txt

# Mode non-interactif (pas de confirmation)
./mmp.sh -y -f message.txt

# Mode verbeux pour débogage
./mmp.sh -v -f message.txt
```

## Caractéristiques principales

✅ **Vérification automatique des permissions**  
✅ **Support de plusieurs modes de saisie** (fichier, ligne de commande, stdin)  
✅ **Sauvegarde automatique des messages**  
✅ **Interface colorée et claire**  
✅ **Mode verbeux pour débogage**  
✅ **Gestion d'erreurs robuste**

## Options importantes

| Option | Description |
|--------|-------------|
| `-c, --conversation ID` | Spécifier la conversation cible |
| `-a, --api-url URL` | Spécifier l'URL de l'API |
| `-f, --file FILE` | Fichier contenant le message |
| `-l, --language LANG` | Langue du message (en, fr, etc.) |
| `-y, --yes` | Sauter la confirmation |
| `-v, --verbose` | Afficher les détails de débogage |
| `--no-cleanup` | Conserver le fichier POST après publication |
| `--skip-permissions` | Sauter la vérification des permissions (déconseillé) |

## Documentation complète

Voir [docs/MMP_MEESHY_MESSAGE_PUBLISHER.md](../docs/MMP_MEESHY_MESSAGE_PUBLISHER.md)

## Anciens scripts

Ce script remplace et améliore:
- `announcement.sh`
- `publish-announcement.sh`

Ces anciens scripts continuent de fonctionner mais il est recommandé d'utiliser `mmp.sh` pour les nouvelles publications.

