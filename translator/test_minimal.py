#!/usr/bin/env python3
"""
Service de test minimal
"""

import http.server
import socketserver
import json
from urllib.parse import urlparse
import os

class SimpleHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {"message": "Meeshy Translation Service is running!", "version": "0.1.0"}
            self.wfile.write(json.dumps(response).encode())
            
        elif parsed_path.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {"status": "healthy", "service": "translation"}
            self.wfile.write(json.dumps(response).encode())
            
        elif parsed_path.path == '/ready':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {"status": "ready", "dependencies": "loaded"}
            self.wfile.write(json.dumps(response).encode())
            
        else:
            self.send_response(404)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {"error": "Not found"}
            self.wfile.write(json.dumps(response).encode())

if __name__ == "__main__":
    port = int(os.getenv("FASTAPI_PORT", "8000"))
    with socketserver.TCPServer(("", port), SimpleHandler) as httpd:
        print(f"🚀 Meeshy Translation Service running on http://localhost:{port}")
        print("Press Ctrl+C to stop")
        httpd.serve_forever()
