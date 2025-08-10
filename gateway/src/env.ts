import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env
const conf = dotenv.config({
  path: path.resolve(process.cwd(), '.env')
});

export default conf;
