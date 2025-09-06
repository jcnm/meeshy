'use client';

import { useTranslations } from '@/hooks/useTranslations';
import { useDynamicSEO } from '@/hooks/useDynamicSEO';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Printer, Shield } from 'lucide-react';
import Link from 'next/link';

// Désactiver le pré-rendu statique pour cette page client
export const dynamic = 'force-dynamic';

export default function PrivacyPage() {
  // SEO dynamique pour la page Privacy
  useDynamicSEO({ page: 'privacy' });

  const t = useTranslations('privacy');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2 text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-5 w-5" />
              <span>{t('backHome')}</span>
            </Link>
            <Button onClick={handlePrint} variant="outline" className="flex items-center space-x-2">
              <Printer className="h-4 w-4" />
              <span>{t('print')}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="shadow-lg">
          <CardHeader className="text-center border-b">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <Shield className="h-8 w-8 text-blue-600" />
              <CardTitle className="text-3xl font-bold">{t('title')}</CardTitle>
            </div>
            <p className="text-gray-600">{t('lastUpdated')}</p>
          </CardHeader>
          
          <CardContent className="prose prose-lg max-w-none p-8">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">{t('introduction.title')}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t('introduction.content')}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">{t('dataCollection.title')}</h2>
              <div className="text-gray-700 leading-relaxed">
                <h3 className="text-lg font-medium mb-2">{t('dataCollection.personal.title')}</h3>
                <ul className="list-disc pl-6 space-y-1 mb-4">
                  {Array.isArray(t('dataCollection.personal.items')) ? 
                    ((t('dataCollection.personal.items') as unknown) as string[]).map((item: string, index: number) => (
                      <li key={index}>{item}</li>
                    )) : 
                    <li>{t('dataCollection.personal.items')}</li>
                  }
                </ul>
                
                <h3 className="text-lg font-medium mb-2">{t('dataCollection.translation.title')}</h3>
                <ul className="list-disc pl-6 space-y-1 mb-4">
                  {Array.isArray(t('dataCollection.translation.items')) ? 
                    ((t('dataCollection.translation.items') as unknown) as string[]).map((item: string, index: number) => (
                      <li key={index}>{item}</li>
                    )) : 
                    <li>{t('dataCollection.translation.items')}</li>
                  }
                </ul>
                
                <h3 className="text-lg font-medium mb-2">{t('dataCollection.technical.title')}</h3>
                <ul className="list-disc pl-6 space-y-1">
                  {Array.isArray(t('dataCollection.technical.items')) ? 
                    ((t('dataCollection.technical.items') as unknown) as string[]).map((item: string, index: number) => (
                      <li key={index}>{item}</li>
                    )) : 
                    <li>{t('dataCollection.technical.items')}</li>
                  }
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">{t('usage.title')}</h2>
              <div className="text-gray-700 leading-relaxed">
                <ul className="list-disc pl-6 space-y-2">
                  {Array.isArray(t('usage.items')) ? 
                    ((t('usage.items') as unknown) as any[]).map((item: any, index: number) => (
                      <li key={index}><strong>{item.title}</strong> {item.description}</li>
                    )) : 
                    <li>{t('usage.items')}</li>
                  }
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">{t('protection.title')}</h2>
              <div className="text-gray-700 leading-relaxed">
                <h3 className="text-lg font-medium mb-2">{t('protection.local.title')}</h3>
                <p className="mb-4">
                  {t('protection.local.content')}
                </p>
                
                <h3 className="text-lg font-medium mb-2">{t('protection.encryption.title')}</h3>
                <p className="mb-4">
                  {t('protection.encryption.content')}
                </p>
                
                <h3 className="text-lg font-medium mb-2">{t('protection.storage.title')}</h3>
                <p>
                  {t('protection.storage.content')}
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">{t('sharing.title')}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t('sharing.intro')}
              </p>
              <ul className="list-disc pl-6 space-y-1 mt-4">
                {Array.isArray(t('sharing.cases')) ? 
                  ((t('sharing.cases') as unknown) as string[]).map((case_: string, index: number) => (
                    <li key={index}>{case_}</li>
                  )) : 
                  <li>{t('sharing.cases')}</li>
                }
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">{t('rights.title')}</h2>
              <div className="text-gray-700 leading-relaxed">
                <p className="mb-4">{t('rights.intro')}</p>
                <ul className="list-disc pl-6 space-y-1">
                  {Array.isArray(t('rights.list')) ? 
                    ((t('rights.list') as unknown) as string[]).map((right: string, index: number) => (
                      <li key={index}>{right}</li>
                    )) : 
                    <li>{t('rights.list')}</li>
                  }
                </ul>
                <p className="mt-4">
                  {t('rights.contact')}
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">{t('cookies.title')}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t('cookies.content')}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">{t('changes.title')}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t('changes.content')}
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">{t('contact.title')}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t('contact.intro')}
              </p>
              <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                <p><strong>{t('contact.email')}</strong></p>
                <p><strong>{t('contact.address')}</strong></p>
              </div>
            </section>
          </CardContent>
        </Card>

        {/* Navigation Links */}
        <div className="text-center mt-8">
          <p className="text-gray-600 mb-6">{t('footer.title')}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/about">
              <Button variant="outline" size="lg">
                {t('footer.about')}
              </Button>
            </Link>
            <Link href="/contact">
              <Button variant="outline" size="lg">
                {t('footer.contact')}
              </Button>
            </Link>
            <Link href="/partners">
              <Button variant="outline" size="lg">
                {t('footer.partners')}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
          .container {
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
