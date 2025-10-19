import { ImageResponse } from 'next/og';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'default';
    const title = searchParams.get('title') || 'Meeshy';
    const subtitle = searchParams.get('subtitle') || 'Messagerie Multilingue';

    // Configuration des couleurs selon le type
    const colors = {
      default: ['#3B82F6', '#8B5CF6'],
      affiliate: ['#10B981', '#3B82F6'],
      conversation: ['#F59E0B', '#EF4444'],
      join: ['#8B5CF6', '#EC4899'],
      signin: ['#06B6D4', '#3B82F6']
    };

    const [color1, color2] = colors[type as keyof typeof colors] || colors.default;
    const emoji = {
      default: '💬',
      affiliate: '👋',
      conversation: '💬',
      join: '👥',
      signin: '📝'
    }[type] || '💬';

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
          }}
        >
          <div style={{ fontSize: 120, marginBottom: 20 }}>{emoji}</div>
          <div style={{ fontSize: 48, marginBottom: 10, textAlign: 'center' }}>{title}</div>
          <div style={{ fontSize: 28, fontWeight: 400, textAlign: 'center' }}>{subtitle}</div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    console.error('Erreur génération image OG:', error);
    return new Response('Erreur génération image', { status: 500 });
  }
}
