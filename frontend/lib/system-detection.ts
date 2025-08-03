/**
 * Service de détection des capacités système
 * Analyse les performances de l'appareil pour recommander les modèles optimaux
 */

export interface SystemSpecs {
  deviceType: 'mobile' | 'tablet' | 'desktop';
  platform: string;
  userAgent: string;
  memoryGB: number;
  cores: number;
  connectionSpeed: {
    downloadMbps: number;
    uploadMbps: number;
    latency: number;
  };
  hasGPU: boolean;
  gpuInfo?: string;
  performanceScore: number; // Score de 1-10
}

export interface ModelRecommendation {
  mt5Model: string;
  nllbModel: string;
  reasoning: string;
  confidence: number;
}

export class SystemDetectionService {
  private static instance: SystemDetectionService;

  static getInstance(): SystemDetectionService {
    if (!SystemDetectionService.instance) {
      SystemDetectionService.instance = new SystemDetectionService();
    }
    return SystemDetectionService.instance;
  }

  /**
   * Analyse complète du système
   */
  async analyzeSystem(): Promise<SystemSpecs> {
    const specs: SystemSpecs = {
      deviceType: this.detectDeviceType(),
      platform: this.detectPlatform(),
      userAgent: navigator.userAgent,
      memoryGB: await this.detectMemory(),
      cores: this.detectCores(),
      connectionSpeed: await this.testConnectionSpeed(),
      hasGPU: await this.detectGPU(),
      gpuInfo: await this.getGPUInfo(),
      performanceScore: 0
    };

    specs.performanceScore = this.calculatePerformanceScore(specs);
    return specs;
  }

  /**
   * Détecte le type d'appareil
   */
  private detectDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (/mobile|android|iphone|ipod|blackberry|windows phone/.test(userAgent)) {
      return 'mobile';
    } else if (/tablet|ipad/.test(userAgent)) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  }

  /**
   * Détecte la plateforme
   */
  private detectPlatform(): string {
    const platform = navigator.platform || 'Unknown';
    const userAgent = navigator.userAgent;

    if (/Mac/.test(platform)) return 'macOS';
    if (/Win/.test(platform)) return 'Windows';
    if (/Linux/.test(platform)) return 'Linux';
    if (/iPhone|iPad/.test(userAgent)) return 'iOS';
    if (/Android/.test(userAgent)) return 'Android';
    
    return platform;
  }

  /**
   * Estime la mémoire disponible
   */
  private async detectMemory(): Promise<number> {
    // Tenter d'utiliser l'API Device Memory (Chrome/Edge)
    if ('deviceMemory' in navigator) {
      return (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 4;
    }

    // Tenter d'utiliser l'API Performance Memory
    if ('memory' in performance) {
      const memInfo = (performance as Performance & { 
        memory?: { jsHeapSizeLimit: number } 
      }).memory;
      if (memInfo) {
        const totalMemoryMB = memInfo.jsHeapSizeLimit / (1024 * 1024);
        return Math.round(totalMemoryMB / 1024); // Convertir en GB
      }
    }

    // Estimation basée sur d'autres indices
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (/mobile/.test(userAgent)) {
      return Math.random() < 0.5 ? 4 : 6; // 4-6 GB pour mobile moderne
    } else if (/tablet/.test(userAgent)) {
      return Math.random() < 0.5 ? 6 : 8; // 6-8 GB pour tablette
    } else {
      return Math.random() < 0.3 ? 8 : Math.random() < 0.7 ? 16 : 32; // 8-32 GB pour desktop
    }
  }

  /**
   * Détecte le nombre de cœurs CPU
   */
  private detectCores(): number {
    if ('hardwareConcurrency' in navigator) {
      return navigator.hardwareConcurrency || 4;
    }
    return 4; // Valeur par défaut
  }

  /**
   * Test de vitesse de connexion
   */
  private async testConnectionSpeed(): Promise<{downloadMbps: number, uploadMbps: number, latency: number}> {
    try {
      // Utiliser l'API Network Information si disponible
      if ('connection' in navigator) {
        const connection = (navigator as Navigator & { 
          connection?: { downlink?: number; rtt?: number } 
        }).connection;
        if (connection) {
          return {
            downloadMbps: connection.downlink || 10,
            uploadMbps: connection.downlink ? connection.downlink * 0.8 : 8, // Estimation upload
            latency: connection.rtt || 50
          };
        }
      }

      // Test simple de vitesse de téléchargement
      const startTime = performance.now();
      const response = await fetch('https://httpbin.org/bytes/100000', { 
        cache: 'no-cache' 
      });
      const endTime = performance.now();
      
      if (response.ok) {
        const duration = (endTime - startTime) / 1000; // en secondes
        const sizeBytes = 100000;
        const speedMbps = (sizeBytes * 8) / (duration * 1000000); // Convertir en Mbps
        
        return {
          downloadMbps: Math.max(1, Math.min(100, speedMbps)),
          uploadMbps: Math.max(0.5, Math.min(50, speedMbps * 0.8)),
          latency: Math.max(10, Math.min(200, duration * 1000))
        };
      }
    } catch (error) {
      console.warn('Impossible de tester la connexion:', error);
    }

    // Valeurs par défaut
    return {
      downloadMbps: 25,
      uploadMbps: 10,
      latency: 50
    };
  }

  /**
   * Détecte la présence d'un GPU
   */
  private async detectGPU(): Promise<boolean> {
    try {
      // Test WebGL pour détecter le GPU
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
      
      if (!gl) return false;

      // Test basique de performance GPU
      const extension = gl.getExtension('WEBGL_debug_renderer_info');
      if (extension) {
        const renderer = gl.getParameter(extension.UNMASKED_RENDERER_WEBGL);
        return renderer && !renderer.toLowerCase().includes('software');
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Obtient les informations GPU
   */
  private async getGPUInfo(): Promise<string | undefined> {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
      
      if (!gl) return undefined;

      const extension = gl.getExtension('WEBGL_debug_renderer_info');
      if (extension) {
        const renderer = gl.getParameter(extension.UNMASKED_RENDERER_WEBGL);
        const vendor = gl.getParameter(extension.UNMASKED_VENDOR_WEBGL);
        return `${vendor} ${renderer}`;
      }

      return 'GPU détecté (informations limitées)';
    } catch {
      return undefined;
    }
  }

  /**
   * Calcule un score de performance global
   */
  private calculatePerformanceScore(specs: SystemSpecs): number {
    let score = 0;

    // Score mémoire (30%)
    if (specs.memoryGB >= 32) score += 3;
    else if (specs.memoryGB >= 16) score += 2.5;
    else if (specs.memoryGB >= 8) score += 2;
    else if (specs.memoryGB >= 4) score += 1.5;
    else score += 1;

    // Score CPU (25%)
    if (specs.cores >= 12) score += 2.5;
    else if (specs.cores >= 8) score += 2;
    else if (specs.cores >= 4) score += 1.5;
    else score += 1;

    // Score type d'appareil (20%)
    if (specs.deviceType === 'desktop') score += 2;
    else if (specs.deviceType === 'tablet') score += 1.5;
    else score += 1;

    // Score GPU (15%)
    if (specs.hasGPU) score += 1.5;
    else score += 0.5;

    // Score connexion (10%)
    if (specs.connectionSpeed.downloadMbps >= 50) score += 1;
    else if (specs.connectionSpeed.downloadMbps >= 25) score += 0.8;
    else if (specs.connectionSpeed.downloadMbps >= 10) score += 0.6;
    else score += 0.4;

    return Math.min(10, Math.max(1, score));
  }

  /**
   * Recommande les modèles optimaux
   */
  recommendModels(specs: SystemSpecs): ModelRecommendation {
    const score = specs.performanceScore;

    let mt5Model: string;
    let nllbModel: string;
    let reasoning: string;
    let confidence: number;

    if (score >= 8) {
      // Système puissant
      mt5Model = 'MT5_XL';
      nllbModel = 'NLLB_1_3B';
      reasoning = 'Système puissant - Modèles haute performance recommandés';
      confidence = 0.9;
    } else if (score >= 6) {
      // Système moyen-haut
      mt5Model = 'MT5_LARGE';
      nllbModel = 'NLLB_DISTILLED_600M';
      reasoning = 'Système performant - Bon équilibre qualité/performance';
      confidence = 0.85;
    } else if (score >= 4) {
      // Système moyen
      mt5Model = 'MT5_BASE';
      nllbModel = 'NLLB_200M';
      reasoning = 'Système standard - Modèles optimisés pour la fluidité';
      confidence = 0.8;
    } else {
      // Système faible
      mt5Model = 'MT5_SMALL';
      nllbModel = 'NLLB_200M';
      reasoning = 'Système limité - Modèles légers recommandés';
      confidence = 0.75;
    }

    // Ajustements selon le type d'appareil
    if (specs.deviceType === 'mobile') {
      mt5Model = score >= 6 ? 'MT5_BASE' : 'MT5_SMALL';
      nllbModel = 'NLLB_200M';
      reasoning += ' (Optimisé mobile)';
    }

    return {
      mt5Model,
      nllbModel,
      reasoning,
      confidence
    };
  }

  /**
   * Formate les spécifications pour l'affichage
   */
  formatSpecs(specs: SystemSpecs): Record<string, string> {
    return {
      'Type d\'appareil': specs.deviceType,
      'Plateforme': specs.platform,
      'Mémoire': `${specs.memoryGB} GB`,
      'Processeur': `${specs.cores} cœurs`,
      'Connexion': `↓${specs.connectionSpeed.downloadMbps.toFixed(1)} Mbps / ↑${specs.connectionSpeed.uploadMbps.toFixed(1)} Mbps`,
      'Latence': `${specs.connectionSpeed.latency.toFixed(0)} ms`,
      'GPU': specs.hasGPU ? (specs.gpuInfo || 'Oui') : 'Non détecté',
      'Score Performance': `${specs.performanceScore.toFixed(1)}/10`
    };
  }
}

export const systemDetection = SystemDetectionService.getInstance();
