import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Erreur interne du serveur';
    let details: string | object | null = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as Record<string, unknown>;
        message = (responseObj.message as string) || 'Erreur de validation';
        details = typeof responseObj.message === 'string' || typeof responseObj.message === 'object' 
          ? responseObj.message as string | object 
          : null;
      }
    }

    // Logger les erreurs avec plus de détails
    const errorLog = {
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      statusCode: status,
      message: message,
      userAgent: request.get('User-Agent'),
      ip: request.ip,
      ...(status >= 500 && { stack: exception instanceof Error ? exception.stack : undefined }),
    };

    if (status >= 500) {
      this.logger.error('Erreur serveur', JSON.stringify(errorLog));
    } else {
      this.logger.warn('Erreur client', JSON.stringify(errorLog));
    }

    // Réponse formatée pour le client
    const errorResponse = {
      success: false,
      statusCode: status,
      message: message,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(process.env.NODE_ENV === 'development' && details && { details }),
    };

    response.status(status).json(errorResponse);
  }
}
