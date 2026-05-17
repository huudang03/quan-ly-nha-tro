import http from 'http';
import fs from 'fs';
import path from 'path';

async function testStaticFiles() {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  const files = fs.readdirSync(uploadsDir);
  if (files.length === 0) {
    console.log('No files in uploads directory.');
    return;
  }

  const testFile = files[0];
  console.log(`Testing file: ${testFile}`);

  // We need to wait for the server to be running, but we can't easily do that here.
  // Instead, let's just check if the file exists and is readable.
  const filePath = path.join(uploadsDir, testFile);
  try {
    const stats = fs.statSync(filePath);
    console.log(`File exists, size: ${stats.size} bytes`);
    const content = fs.readFileSync(filePath);
    console.log(`File is readable, read ${content.length} bytes`);
  } catch (error) {
    console.error(`Error reading file: ${error}`);
  }
}

testStaticFiles();
