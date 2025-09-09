'use client';


import { useTranslations } from '@/hooks/useTranslations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Printer, FileText } from 'lucide-react';
import Link from 'next/link';


export default function TermsPage() {
  const { t, tArray } = useTranslations('terms');

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
              <FileText className="h-8 w-8 text-blue-600" />
              <CardTitle className="text-3xl font-bold">{t('title')}</CardTitle>
            </div>
            <p className="text-gray-600">{t('lastUpdated')}</p>
          </CardHeader>
          
          <CardContent className="prose prose-lg max-w-none p-8">
            {/* 1. Acceptance */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">{t('acceptance.title')}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t('acceptance.content')}
              </p>
            </section>

            {/* 2. Service Description */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">{t('service.title')}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t('service.content')}
              </p>
            </section>

            {/* 3. User Account */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">{t('account.title')}</h2>
              <div className="text-gray-700 leading-relaxed">
                <p className="mb-4">{t('account.intro')}</p>
                <ul className="list-disc pl-6 space-y-2">
                  {tArray('account.responsibilities').map((item: string, index: number) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            </section>

            {/* 4. Acceptable Use */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">{t('usage.title')}</h2>
              <div className="text-gray-700 leading-relaxed">
                <p className="mb-4">{t('usage.intro')}</p>
                <ul className="list-disc pl-6 space-y-2">
                  {tArray('usage.prohibited').map((item: string, index: number) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            </section>

            {/* 5. User Content */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">{t('content.title')}</h2>
              <div className="text-gray-700 leading-relaxed space-y-4">
                <p>{t('content.ownership')}</p>
                <p>{t('content.license')}</p>
                <p>{t('content.responsibility')}</p>
              </div>
            </section>

            {/* 6. Privacy */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">{t('title')}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t('content')}
              </p>
            </section>

            {/* 7. Termination */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">{t('termination.title')}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t('termination.content')}
              </p>
            </section>

            {/* 8. Limitation of Liability */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">{t('limitation.title')}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t('limitation.content')}
              </p>
            </section>

            {/* 9. Changes to Terms */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">{t('changes.title')}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t('changes.content')}
              </p>
            </section>

            {/* 10. Governing Law */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">{t('governing.title')}</h2>
              <p className="text-gray-700 leading-relaxed">
                {t('governing.content')}
              </p>
            </section>

            {/* 11. Contact */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900">{t('title')}</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                {t('intro')}
              </p>
              <div className="bg-gray-50 p-6 rounded-lg">
                <p className="text-gray-700 mb-2">
                  <strong>{t('email')}</strong>
                </p>
                <p className="text-gray-700">
                  <strong>{t('address')}</strong>
                </p>
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
            <Link href="/privacy">
              <Button variant="outline" size="lg">
                {t('footer.privacy')}
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
