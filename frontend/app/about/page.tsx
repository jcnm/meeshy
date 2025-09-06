'use client';

import { useTranslations } from '@/hooks/useTranslations';
import { useDynamicSEO } from '@/hooks/useDynamicSEO';
import RichSnippets from '@/components/RichSnippets';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Users, Globe, Heart, Target, Lightbulb } from 'lucide-react';
import Link from 'next/link';

export default function AboutPage() {
  // SEO dynamique pour la page About
  useDynamicSEO({ page: 'about' });

  const t = useTranslations('about');

  return (
    <>
      <RichSnippets type="aboutPage" />
      <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2 text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-5 w-5" />
              <span>{t('backHome')}</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">{t('title')}</h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              {t('subtitle')}
            </p>
          </div>

          {/* Mission */}
          <Card className="mb-8 shadow-lg">
            <CardHeader className="text-center">
              <div className="flex items-center justify-center space-x-2 mb-4">
                <Target className="h-8 w-8 text-blue-600" />
                <CardTitle className="text-2xl">{t('mission.title')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-lg text-gray-700 leading-relaxed">
                {t('mission.description')}
              </p>
            </CardContent>
          </Card>

          {/* Values */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <Card className="text-center shadow-lg">
              <CardContent className="pt-6">
                <div className="flex items-center justify-center mb-4">
                  <Globe className="h-12 w-12 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{t('values.globalAccess.title')}</h3>
                <p className="text-gray-600">
                  {t('values.globalAccess.description')}
                </p>
              </CardContent>
            </Card>

            <Card className="text-center shadow-lg">
              <CardContent className="pt-6">
                <div className="flex items-center justify-center mb-4">
                  <Lightbulb className="h-12 w-12 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{t('values.innovation.title')}</h3>
                <p className="text-gray-600">
                  {t('values.innovation.description')}
                </p>
              </CardContent>
            </Card>

            <Card className="text-center shadow-lg">
              <CardContent className="pt-6">
                <div className="flex items-center justify-center mb-4">
                  <Heart className="h-12 w-12 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{t('values.privacy.title')}</h3>
                <p className="text-gray-600">
                  {t('values.privacy.description')}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Team */}
          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <div className="flex items-center justify-center space-x-2 mb-4">
                <Users className="h-8 w-8 text-blue-600" />
                <CardTitle className="text-2xl">{t('team.title')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-lg text-gray-700 leading-relaxed mb-6">
                {t('team.description')}
              </p>
              <div className="bg-blue-50 rounded-lg p-6">
                <p className="text-gray-700">
                  {t('team.details')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Contact CTA */}
          <div className="text-center mt-8">
            <p className="text-gray-600 mb-4">{t('cta.title')}</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contact">
                <Button variant="outline" size="lg">
                  {t('cta.contact')}
                </Button>
              </Link>
              <Link href="/terms">
                <Button variant="outline" size="lg">
                  {t('cta.terms')}
                </Button>
              </Link>
              <Link href="/privacy">
                <Button variant="outline" size="lg">
                  {t('cta.privacy')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
