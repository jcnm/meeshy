import { ImageResponse } from 'next/og';

interface DynamicImageParams {
  type: 'affiliate' | 'conversation' | 'join' | 'default';
  title?: string;
  subtitle?: string;
  userAvatar?: string;
  userName?: string;
  userFirstName?: string;
  userLastName?: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'default';
    const title = searchParams.get('title') || 'Meeshy';
    const subtitle = searchParams.get('subtitle') || 'Messagerie Multilingue';
    const userAvatar = searchParams.get('userAvatar');
    const userName = searchParams.get('userName');
    const userFirstName = searchParams.get('userFirstName');
    const userLastName = searchParams.get('userLastName');

    // Configuration des couleurs selon le type
    const colors = {
      default: ['#3B82F6', '#8B5CF6'],
      affiliate: ['#10B981', '#3B82F6'],
      conversation: ['#F59E0B', '#EF4444'],
      join: ['#8B5CF6', '#EC4899'],
      signin: ['#06B6D4', '#3B82F6']
    };

    const [color1, color2] = colors[type as keyof typeof colors] || colors.default;
    
    // Emojis et icônes selon le type
    const icons = {
      default: '💬',
      affiliate: '👋',
      conversation: '💬',
      join: '👥',
      signin: '📝'
    };

    const icon = icons[type as keyof typeof icons] || '💬';

    // Construire le nom d'utilisateur
    const displayName = userFirstName && userLastName 
      ? `${userFirstName} ${userLastName}`
      : userName || 'Utilisateur';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`,
            fontSize: 60,
            fontWeight: 700,
            color: 'white',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Avatar de l'utilisateur si disponible */}
          {userAvatar && (
            <div
              style={{
                position: 'absolute',
                top: 40,
                right: 40,
                width: 120,
                height: 120,
                borderRadius: '50%',
                border: '4px solid white',
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              }}
            >
              <img
                src={userAvatar}
                alt={displayName}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </div>
          )}

          {/* Contenu principal */}
          <div style={{ textAlign: 'center', zIndex: 1 }}>
            {/* Icône principale */}
            <div style={{ fontSize: 120, marginBottom: 20 }}>{icon}</div>
            
            {/* Titre principal */}
            <div style={{ fontSize: 48, marginBottom: 10, textAlign: 'center' }}>
              {title}
            </div>
            
            {/* Sous-titre */}
            <div style={{ fontSize: 28, fontWeight: 400, textAlign: 'center' }}>
              {subtitle}
            </div>

            {/* Nom d'utilisateur si c'est une invitation */}
            {type === 'affiliate' && displayName && (
              <div style={{ 
                fontSize: 24, 
                fontWeight: 500, 
                marginTop: 20,
                backgroundColor: 'rgba(255,255,255,0.2)',
                padding: '8px 24px',
                borderRadius: '20px',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.3)'
              }}>
                avec {displayName}
              </div>
            )}

            {/* Logo Meeshy en bas */}
            <div style={{
              position: 'absolute',
              bottom: 40,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: 20,
              fontWeight: 600,
              opacity: 0.9,
              backgroundColor: 'rgba(255,255,255,0.1)',
              padding: '8px 16px',
              borderRadius: '12px',
              backdropFilter: 'blur(10px)'
            }}>
              Meeshy
            </div>
          </div>

          {/* Motifs décoratifs */}
          <div style={{
            position: 'absolute',
            top: -50,
            left: -50,
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
            filter: 'blur(40px)'
          }} />
          <div style={{
            position: 'absolute',
            bottom: -80,
            right: -80,
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
            filter: 'blur(60px)'
          }} />
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    console.error('Erreur génération image OG dynamique:', error);
    return new Response('Erreur génération image', { status: 500 });
  }
}
