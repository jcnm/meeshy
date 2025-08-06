import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env
dotenv.config({
  path: path.resolve(process.cwd(), '.env')
});
