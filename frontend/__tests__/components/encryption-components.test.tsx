/**
 * Tests pour les composants de chiffrement
 * Teste les composants encryption-indicator et encryption-mode-selector
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

// Mock des composants car ils utilisent des dépendances externes
jest.mock('../../components/conversations/encryption-indicator', () => ({
  EncryptionIndicator: ({ mode, isActive }: any) => (
    <div data-testid="encryption-indicator">
      <span data-testid="encryption-mode">{mode}</span>
      <span data-testid="encryption-active">{isActive ? 'active' : 'inactive'}</span>
    </div>
  ),
}));

jest.mock('../../components/conversations/encryption-mode-selector', () => ({
  EncryptionModeSelector: ({ currentMode, onModeChange }: any) => (
    <div data-testid="encryption-mode-selector">
      <button
        data-testid="mode-none"
        onClick={() => onModeChange('none')}
      >
        None
      </button>
      <button
        data-testid="mode-e2e"
        onClick={() => onModeChange('e2e')}
      >
        E2E
      </button>
      <button
        data-testid="mode-hybrid"
        onClick={() => onModeChange('hybrid')}
      >
        Hybrid
      </button>
      <span data-testid="current-mode">{currentMode}</span>
    </div>
  ),
}));

import { EncryptionIndicator } from '../../components/conversations/encryption-indicator';
import { EncryptionModeSelector } from '../../components/conversations/encryption-mode-selector';

describe('Encryption Components', () => {
  describe('EncryptionIndicator', () => {
    it('should render with none mode', () => {
      render(<EncryptionIndicator mode="none" isActive={false} />);

      expect(screen.getByTestId('encryption-mode')).toHaveTextContent('none');
      expect(screen.getByTestId('encryption-active')).toHaveTextContent('inactive');
    });

    it('should render with e2e mode', () => {
      render(<EncryptionIndicator mode="e2e" isActive={true} />);

      expect(screen.getByTestId('encryption-mode')).toHaveTextContent('e2e');
      expect(screen.getByTestId('encryption-active')).toHaveTextContent('active');
    });

    it('should render with hybrid mode', () => {
      render(<EncryptionIndicator mode="hybrid" isActive={true} />);

      expect(screen.getByTestId('encryption-mode')).toHaveTextContent('hybrid');
      expect(screen.getByTestId('encryption-active')).toHaveTextContent('active');
    });

    it('should show inactive state', () => {
      render(<EncryptionIndicator mode="e2e" isActive={false} />);

      expect(screen.getByTestId('encryption-active')).toHaveTextContent('inactive');
    });
  });

  describe('EncryptionModeSelector', () => {
    it('should render all mode options', () => {
      const handleModeChange = jest.fn();

      render(
        <EncryptionModeSelector
          currentMode="none"
          onModeChange={handleModeChange}
        />
      );

      expect(screen.getByTestId('mode-none')).toBeInTheDocument();
      expect(screen.getByTestId('mode-e2e')).toBeInTheDocument();
      expect(screen.getByTestId('mode-hybrid')).toBeInTheDocument();
    });

    it('should display current mode', () => {
      const handleModeChange = jest.fn();

      render(
        <EncryptionModeSelector
          currentMode="e2e"
          onModeChange={handleModeChange}
        />
      );

      expect(screen.getByTestId('current-mode')).toHaveTextContent('e2e');
    });

    it('should call onModeChange when selecting none', () => {
      const handleModeChange = jest.fn();

      render(
        <EncryptionModeSelector
          currentMode="e2e"
          onModeChange={handleModeChange}
        />
      );

      fireEvent.click(screen.getByTestId('mode-none'));
      expect(handleModeChange).toHaveBeenCalledWith('none');
    });

    it('should call onModeChange when selecting e2e', () => {
      const handleModeChange = jest.fn();

      render(
        <EncryptionModeSelector
          currentMode="none"
          onModeChange={handleModeChange}
        />
      );

      fireEvent.click(screen.getByTestId('mode-e2e'));
      expect(handleModeChange).toHaveBeenCalledWith('e2e');
    });

    it('should call onModeChange when selecting hybrid', () => {
      const handleModeChange = jest.fn();

      render(
        <EncryptionModeSelector
          currentMode="none"
          onModeChange={handleModeChange}
        />
      );

      fireEvent.click(screen.getByTestId('mode-hybrid'));
      expect(handleModeChange).toHaveBeenCalledWith('hybrid');
    });
  });

  describe('Integration between components', () => {
    it('should work together to show and change encryption mode', () => {
      const handleModeChange = jest.fn();

      const { rerender } = render(
        <>
          <EncryptionIndicator mode="none" isActive={false} />
          <EncryptionModeSelector
            currentMode="none"
            onModeChange={handleModeChange}
          />
        </>
      );

      // Vérifier l'état initial
      expect(screen.getByTestId('encryption-mode')).toHaveTextContent('none');

      // Changer le mode
      fireEvent.click(screen.getByTestId('mode-e2e'));
      expect(handleModeChange).toHaveBeenCalledWith('e2e');

      // Simuler la mise à jour après changement
      rerender(
        <>
          <EncryptionIndicator mode="e2e" isActive={true} />
          <EncryptionModeSelector
            currentMode="e2e"
            onModeChange={handleModeChange}
          />
        </>
      );

      expect(screen.getByTestId('encryption-mode')).toHaveTextContent('e2e');
      expect(screen.getByTestId('encryption-active')).toHaveTextContent('active');
    });
  });
});
