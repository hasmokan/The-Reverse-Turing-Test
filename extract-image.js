#!/usr/bin/env node
/**
 * Extract base64 image from Vertex AI response JSON
 * Usage: node extract-image.js <input.json> [output.png]
 */

const fs = require('fs');
const path = require('path');

function extractImage(inputFile, outputFile) {
  // Read JSON file
  const rawData = fs.readFileSync(inputFile, 'utf8');
  const data = JSON.parse(rawData);

  // Handle array format (n8n output) or direct object
  const response = Array.isArray(data) ? (data[0]?.json || data[0]) : data;

  // Navigate Vertex AI response structure
  const candidates = response?.candidates || [];

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts || [];

    for (const part of parts) {
      if (part?.inlineData?.data) {
        const base64Data = part.inlineData.data;
        const mimeType = part.inlineData.mimeType || 'image/png';
        const ext = mimeType.includes('png') ? 'png' : 'jpg';

        // Determine output filename
        const output = outputFile || `extracted_${Date.now()}.${ext}`;

        // Decode and save
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(output, buffer);

        console.log(`✅ Image saved: ${output}`);
        console.log(`📦 Size: ${(buffer.length / 1024).toFixed(1)} KB`);
        console.log(`📄 MIME: ${mimeType}`);
        return output;
      }
    }
  }

  console.error('❌ No image data found in JSON');
  process.exit(1);
}

// CLI entry
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node extract-image.js <input.json> [output.png]');
  console.log('Example: node extract-image.js mimicGenertate.json result.png');
  process.exit(0);
}

extractImage(args[0], args[1]);
