'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ResponsiveTabItem {
  value: string;
  label: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
}

interface ResponsiveTabsProps {
  items: ResponsiveTabItem[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  mobileBreakpoint?: 'sm' | 'md' | 'lg';
}

/**
 * Composant Tabs responsive :
 * - Desktop/Tablet : Affichage en onglets classiques
 * - Mobile : Affichage en Select dropdown pour économiser l'espace
 */
export function ResponsiveTabs({
  items,
  defaultValue,
  value,
  onValueChange,
  className,
  mobileBreakpoint = 'lg'
}: ResponsiveTabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue || items[0]?.value || '');
  const currentValue = value || internalValue;
  
  const handleValueChange = (newValue: string) => {
    if (!value) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
  };

  const currentItem = items.find(item => item.value === currentValue);
  const mobileHiddenClass = mobileBreakpoint === 'sm' ? 'sm:block' : 
                           mobileBreakpoint === 'md' ? 'md:block' : 'lg:block';
  const mobileVisibleClass = mobileBreakpoint === 'sm' ? 'sm:hidden' : 
                            mobileBreakpoint === 'md' ? 'md:hidden' : 'lg:hidden';

  return (
    <div className={cn("w-full", className)}>
      {/* Version Mobile : Select dropdown */}
      <div className={cn("block", mobileVisibleClass, "mb-4")}>
        <Select value={currentValue} onValueChange={handleValueChange}>
          <SelectTrigger className="w-full">
            <SelectValue>
              <div className="flex items-center gap-2">
                {currentItem?.icon}
                <span>{currentItem?.label}</span>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                <div className="flex items-center gap-2">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Version Desktop/Tablet : Tabs classiques */}
      <Tabs 
        value={currentValue} 
        onValueChange={handleValueChange}
        className={cn("w-full", "hidden", mobileHiddenClass)}
      >
        <TabsList className="grid w-full h-auto" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
          {items.map((item) => (
            <TabsTrigger 
              key={item.value} 
              value={item.value} 
              className="gap-1 lg:gap-2 text-xs lg:text-sm"
            >
              {item.icon}
              <span className="hidden sm:inline">{item.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Contenu des onglets (partagé entre mobile et desktop) */}
      <div className="mt-4">
        {items.map((item) => (
          <div
            key={item.value}
            className={cn(
              "space-y-4",
              currentValue === item.value ? "block" : "hidden"
            )}
          >
            {item.content}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Version avec TabsContent pour compatibilité avec l'API Tabs existante
 */
export function ResponsiveTabsWithContent({
  items,
  defaultValue,
  value,
  onValueChange,
  className,
  mobileBreakpoint = 'lg',
  children
}: ResponsiveTabsProps & { children?: React.ReactNode }) {
  const [internalValue, setInternalValue] = useState(defaultValue || items[0]?.value || '');
  const currentValue = value || internalValue;
  
  const handleValueChange = (newValue: string) => {
    if (!value) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
  };

  const currentItem = items.find(item => item.value === currentValue);
  const mobileHiddenClass = mobileBreakpoint === 'sm' ? 'sm:block' : 
                           mobileBreakpoint === 'md' ? 'md:block' : 'lg:block';
  const mobileVisibleClass = mobileBreakpoint === 'sm' ? 'sm:hidden' : 
                            mobileBreakpoint === 'md' ? 'md:hidden' : 'lg:hidden';

  return (
    <div className={cn("w-full", className)}>
      {/* Version Mobile : Select dropdown */}
      <div className={cn("block", mobileVisibleClass, "mb-4")}>
        <Select value={currentValue} onValueChange={handleValueChange}>
          <SelectTrigger className="w-full">
            <SelectValue>
              <div className="flex items-center gap-2">
                {currentItem?.icon}
                <span>{currentItem?.label}</span>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                <div className="flex items-center gap-2">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Version Desktop/Tablet : Tabs classiques */}
      <Tabs 
        value={currentValue} 
        onValueChange={handleValueChange}
        className={cn("w-full", "hidden", mobileHiddenClass)}
      >
        <TabsList className="grid w-full h-auto" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
          {items.map((item) => (
            <TabsTrigger 
              key={item.value} 
              value={item.value} 
              className="gap-1 lg:gap-2 text-xs lg:text-sm"
            >
              {item.icon}
              <span className="hidden sm:inline">{item.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Utilise les enfants comme TabsContent */}
        {children}
      </Tabs>

      {/* Version mobile utilise aussi les TabsContent */}
      <div className={cn("block", mobileVisibleClass)}>
        <Tabs value={currentValue} onValueChange={handleValueChange} className="w-full">
          {children}
        </Tabs>
      </div>
    </div>
  );
}
