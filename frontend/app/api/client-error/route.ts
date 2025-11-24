/**
 * API endpoint pour logger les erreurs client
 * Permet de capturer les erreurs qui se produisent sur les appareils mobiles
 * Les erreurs sont loggées dans un fichier pour analyse ultérieure
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Chemin du fichier de log (dans le dossier logs à la racine du projet frontend)
const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'client-errors.log');

/**
 * Écrit une erreur dans le fichier de log
 */
async function logToFile(errorData: any) {
  try {
    // Créer le dossier logs s'il n'existe pas
    await fs.mkdir(LOG_DIR, { recursive: true });

    // Formater l'entrée de log
    const logEntry = {
      timestamp: errorData.timestamp || new Date().toISOString(),
      url: errorData.url,
      message: errorData.message,
      stack: errorData.stack,
      userAgent: errorData.userAgent,
      digest: errorData.digest,
    };

    // Écrire dans le fichier (append mode)
    const logLine = JSON.stringify(logEntry) + '\n';
    await fs.appendFile(LOG_FILE, logLine, 'utf-8');

    console.info(`[Client Error] Logged to file: ${LOG_FILE}`);
  } catch (fileError) {
    console.error('[Client Error] Failed to write to log file:', fileError);
    // Continue même si l'écriture échoue
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const errorData = {
      timestamp: body.timestamp || new Date().toISOString(),
      url: body.url,
      message: body.message,
      stack: body.stack,
      userAgent: body.userAgent,
      digest: body.digest,
    };

    // Logger dans la console pour debugging immédiat
    console.error('[Client Error]', errorData);

    // Logger dans le fichier pour analyse ultérieure
    await logToFile(errorData);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[Client Error API] Failed to log error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to log error' },
      { status: 500 }
    );
  }
}
