import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('avatar') as File;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Aucun fichier fourni' },
        { status: 400 }
      );
    }

    // Validation du fichier
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Format d\'image non supporté' },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'La taille de l\'image ne doit pas dépasser 5MB' },
        { status: 400 }
      );
    }

    // Générer le chemin de sauvegarde
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const extension = file.name.split('.').pop() || 'jpg';
    const filename = `avatar_${timestamp}_${random}.${extension}`;
    
    const folderPath = join(process.cwd(), 'public', 'i', 'p', year, month);
    const filePath = join(folderPath, filename);

    // Créer le dossier s'il n'existe pas
    if (!existsSync(folderPath)) {
      await mkdir(folderPath, { recursive: true });
    }

    // Convertir le fichier en buffer et le sauvegarder
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    await writeFile(filePath, buffer);

    // Générer l'URL de l'image
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;
    const imageUrl = `${baseUrl}/i/p/${year}/${month}/${filename}`;

    return NextResponse.json({
      success: true,
      data: {
        url: imageUrl,
        filename,
        path: `/i/p/${year}/${month}/${filename}`
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'upload de l\'avatar:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
