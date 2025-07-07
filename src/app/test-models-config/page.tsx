'use client';

import { getAllActiveModels, ACTIVE_MODELS } from '@/lib/simple-model-config';

export default function TestModelsPage() {
  const activeModels = getAllActiveModels();

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Test Configuration Modèles</h1>
      
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Configuration Active (.env)</h2>
        <div className="bg-gray-100 p-4 rounded">
          <p><strong>Basic Model:</strong> {ACTIVE_MODELS.basicModel}</p>
          <p><strong>High Model:</strong> {ACTIVE_MODELS.highModel}</p>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Modèles Disponibles ({activeModels.length})</h2>
        <div className="space-y-2">
          {activeModels.map(({ type, config }) => (
            <div key={type} className="border p-3 rounded">
              <div className="flex items-center gap-2 mb-1">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: config.color }}
                />
                <span className="font-medium">{config.displayName}</span>
                <span className="text-sm text-gray-500">({type})</span>
              </div>
              <div className="text-sm text-gray-600">
                <p>Nom: {config.name}</p>
                <p>Paramètres: {config.parameters}</p>
                <p>Famille: {config.family}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
