#!/usr/bin/env python3
"""
Script de test simple pour vérifier les imports
"""

import sys
import os

print("=== Test des imports ===")
print(f"Python path: {sys.path}")
print(f"Current directory: {os.getcwd()}")

try:
    import zmq
    print("✅ ZMQ importé avec succès")
except ImportError as e:
    print(f"❌ Erreur import ZMQ: {e}")

try:
    import torch
    print("✅ Torch importé avec succès")
except ImportError as e:
    print(f"❌ Erreur import Torch: {e}")

try:
    import transformers
    print("✅ Transformers importé avec succès")
except ImportError as e:
    print(f"❌ Erreur import Transformers: {e}")

print("=== Test terminé ===")
