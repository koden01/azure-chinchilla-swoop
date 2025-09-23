import { execSync } from 'child_process';
import fs from 'fs';

console.log('Generating self-signed SSL certificate for development...');

try {
  // Generate private key
  execSync('openssl genrsa -out localhost-key.pem 2048');
  
  // Generate certificate signing request
  execSync('openssl req -new -key localhost-key.pem -out localhost.csr -subj "/C=US/ST=State/L=City/O=Organization/OU=Organization Unit/CN=localhost"');
  
  // Generate certificate
  execSync('openssl x509 -req -in localhost.csr -signkey localhost-key.pem -out localhost.pem -days 3650');
  
  // Clean up CSR file
  fs.unlinkSync('localhost.csr');
  
  console.log('SSL certificate generated successfully!');
  console.log('Key: localhost-key.pem');
  console.log('Cert: localhost.pem');
} catch (error) {
  console.error('Error generating SSL certificate:', error.message);
  console.log('Please install OpenSSL or use alternative method');
}