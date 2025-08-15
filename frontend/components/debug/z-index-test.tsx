'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Z_CLASSES } from '@/lib/z-index';

export function ZIndexTestComponent() {
  const [isVisible, setIsVisible] = useState(false);

  if (!isVisible) {
    return (
      <div className="fixed bottom-20 right-4">
        <Button onClick={() => setIsVisible(true)} variant="outline" size="sm">
          🧪 Test Z-Index
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="fixed bottom-20 right-4 space-y-2">
        <Card className="w-80 bg-white/95 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Test des Z-Index</CardTitle>
              <Button 
                onClick={() => setIsVisible(false)}
                variant="ghost" 
                size="sm"
                className="h-6 w-6 p-0"
              >
                ✕
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            
            {/* Test Popover */}
            <div className="flex items-center justify-between">
              <span className="text-sm">Popover (z-70):</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    Ouvrir Popover
                  </Button>
                </PopoverTrigger>
                <PopoverContent className={`w-64 ${Z_CLASSES.POPOVER}`}>
                  <div className="space-y-2">
                    <h4 className="font-medium">Test Popover</h4>
                    <p className="text-sm text-gray-600">
                      Ce popover devrait s'afficher au-dessus de tous les autres éléments.
                    </p>
                    <Button size="sm" className="w-full">
                      Action test
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Test DropdownMenu */}
            <div className="flex items-center justify-between">
              <span className="text-sm">Dropdown (z-65):</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Ouvrir Menu
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className={Z_CLASSES.DROPDOWN_MENU}>
                  <DropdownMenuItem>Option 1</DropdownMenuItem>
                  <DropdownMenuItem>Option 2</DropdownMenuItem>
                  <DropdownMenuItem>Option 3</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Test Tooltip */}
            <div className="flex items-center justify-between">
              <span className="text-sm">Tooltip (z-60):</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm">
                    Survoler
                  </Button>
                </TooltipTrigger>
                <TooltipContent className={Z_CLASSES.TOOLTIP}>
                  <p>Test tooltip avec z-index correct</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Simulation d'un élément avec z-index élevé pour test */}
            <div className="relative">
              <div 
                className="absolute inset-0 bg-red-500/20 border-2 border-red-500 rounded"
                style={{ zIndex: 60 }}
              >
                <div className="p-2 text-xs text-red-700">
                  Élément test z-60
                </div>
              </div>
              <div className="h-16 w-full bg-transparent"></div>
            </div>

            <div className="text-xs text-gray-500 pt-2 border-t">
              <p>• Popover devrait être au-dessus de tout</p>
              <p>• Dropdown au-dessus des tooltips</p>
              <p>• Tooltip au niveau de l'élément rouge</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
