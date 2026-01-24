/**
 * Conversion Script: Old .qeyloop → New .keypage + .keyloop
 * 
 * Converts old format (version 1) .qeyloop files to new format:
 * - Each old .qeyloop becomes a .keypage file
 * - All converted pages are bundled into one .keyloop project
 * 
 * Usage: node scripts/convert-to-new-format.js
 */

import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

// ============================================================================
// CONFIGURATION
// ============================================================================

const INPUT_DIR = '.experiments';
const OUTPUT_DIR = '.experiments/converted';
const PROJECT_NAME = 'converted-project';

// Default BPM and global settings for new format
const DEFAULT_BPM = 120;
const DEFAULT_MASTER_VOLUME = 1.0;
const DEFAULT_METRONOME = { enabled: false, volume: 0.5 };

// ============================================================================
// CONVERSION LOGIC
// ============================================================================

/**
 * Generate a UUID v4
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Convert old KeyMapping to new PadSettings
 */
function convertToPadSettings(keyMapping, soundFiles) {
  return {
    keyCode: keyMapping.keyCode,
    volume: keyMapping.volume,
    pitchSemitones: keyMapping.pitchSemitones,
    playbackMode: keyMapping.mode,
    modulationEnabled: keyMapping.modulationEnabled,
    overlapMode: keyMapping.overlapMode,
    overlapGroupId: keyMapping.groupId,
    pageJumpTarget: -1, // Old format didn't have page jumps
    soundFileName: keyMapping.soundName,
    soundIndex: keyMapping.soundIndex,
    hasSound: keyMapping.hasSound,
  };
}

/**
 * Convert old .qeyloop (version 1) to new .keypage format
 */
async function convertOldToKeypage(oldZipBuffer, pageName) {
  const oldZip = await JSZip.loadAsync(oldZipBuffer);
  
  // Read old manifest
  const manifestFile = oldZip.file('project.json');
  if (!manifestFile) {
    throw new Error('Invalid old .qeyloop file: missing manifest');
  }
  
  const manifestText = await manifestFile.async('text');
  const oldManifest = JSON.parse(manifestText);
  
  // Handle missing or empty keyMappings
  const keyMappings = oldManifest.keyMappings || [];
  const soundFiles = oldManifest.soundFiles || {};
  
  // Convert to new .keypage format
  const pads = keyMappings
    .filter(mapping => mapping && mapping.hasSound) // Only include pads with sounds
    .map(mapping => convertToPadSettings(mapping, soundFiles));
  
  const keyPageFile = {
    format: 'keypage',
    schemaVersion: 1,
    pageId: generateUUID(),
    pageName: pageName,
    modulationPreset: oldManifest.modulationPreset || 0,
    pads: pads,
    soundFiles: soundFiles,
  };
  
  // Create new .keypage ZIP
  const newZip = new JSZip();
  
  // Add manifest
  newZip.file('page.json', JSON.stringify(keyPageFile, null, 2));
  
  // Copy sound files
  const oldSoundsFolder = oldZip.folder('sounds');
  if (oldSoundsFolder) {
    const newSoundsFolder = newZip.folder('sounds');
    
    // Copy all sound files
    const soundPromises = [];
    oldSoundsFolder.forEach((relativePath, file) => {
      if (!file.dir) {
        soundPromises.push(
          file.async('arraybuffer').then(data => {
            newSoundsFolder.file(relativePath, data);
          })
        );
      }
    });
    
    await Promise.all(soundPromises);
  }
  
  return {
    zip: newZip,
    pageId: keyPageFile.pageId,
    pageName: keyPageFile.pageName,
  };
}

/**
 * Create .keyloop container from multiple .keypage files
 */
async function createKeyloopContainer(keyPages) {
  const containerZip = new JSZip();
  
  // Create page entries
  const pageEntries = keyPages.map((page, index) => ({
    pageId: page.pageId,
    filename: `page_${index}.keypage`,
    orderIndex: index,
  }));
  
  // Add each .keypage as a folder in the container
  for (let i = 0; i < keyPages.length; i++) {
    const keyPage = keyPages[i];
    const pageFolder = containerZip.folder(`page_${i}.keypage`);
    
    // Get the .keypage ZIP content
    const pageZipContent = await keyPage.zip.generateAsync({ type: 'arraybuffer' });
    const pageZip = await JSZip.loadAsync(pageZipContent);
    
    // Copy all files from .keypage into the folder
    const copyPromises = [];
    pageZip.forEach((relativePath, file) => {
      if (!file.dir) {
        copyPromises.push(
          file.async('arraybuffer').then(data => {
            pageFolder.file(relativePath, data);
          })
        );
      }
    });
    
    await Promise.all(copyPromises);
  }
  
  // Create project manifest
  const keyLoopFile = {
    format: 'keyloop',
    schemaVersion: 1,
    bpm: DEFAULT_BPM,
    masterVolume: DEFAULT_MASTER_VOLUME,
    metronome: DEFAULT_METRONOME,
    activePageIndex: 0,
    pageCount: keyPages.length,
    pages: pageEntries,
  };
  
  // Add project manifest
  containerZip.file('project.json', JSON.stringify(keyLoopFile, null, 2));
  
  return containerZip;
}

/**
 * Main conversion function
 */
async function convertFiles() {
  console.log('🔄 Starting conversion...\n');
  
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  // Find all .qeyloop files in input directory
  const files = fs.readdirSync(INPUT_DIR)
    .filter(file => file.endsWith('.qeyloop'))
    .sort();
  
  if (files.length === 0) {
    console.error('❌ No .qeyloop files found in', INPUT_DIR);
    process.exit(1);
  }
  
  console.log(`📁 Found ${files.length} old .qeyloop files:\n`);
  files.forEach(file => console.log(`   - ${file}`));
  console.log();
  
  // Convert each file
  const convertedPages = [];
  
  for (let i = 0; i < files.length; i++) {
    const fileName = files[i];
    const filePath = path.join(INPUT_DIR, fileName);
    const pageName = path.basename(fileName, '.qeyloop');
    
    console.log(`📄 Converting ${fileName}...`);
    
    try {
      // Read old file
      const oldZipBuffer = fs.readFileSync(filePath);
      
      // Convert to .keypage
      const converted = await convertOldToKeypage(oldZipBuffer, pageName);
      
      // Save individual .keypage file
      const keyPageBuffer = await converted.zip.generateAsync({ type: 'nodebuffer' });
      const outputFileName = `${pageName}.keypage`;
      const outputPath = path.join(OUTPUT_DIR, outputFileName);
      fs.writeFileSync(outputPath, keyPageBuffer);
      
      console.log(`   ✅ Saved as ${outputFileName}`);
      
      // Store for container
      convertedPages.push(converted);
      
    } catch (error) {
      console.error(`   ❌ Error converting ${fileName}:`, error.message);
      process.exit(1);
    }
  }
  
  console.log();
  console.log(`📦 Creating .keyloop container...`);
  
  try {
    // Create .keyloop container with all pages
    const containerZip = await createKeyloopContainer(convertedPages);
    
    // Save .keyloop file
    const containerBuffer = await containerZip.generateAsync({ type: 'nodebuffer' });
    const containerPath = path.join(OUTPUT_DIR, `${PROJECT_NAME}.keyloop`);
    fs.writeFileSync(containerPath, containerBuffer);
    
    console.log(`   ✅ Saved as ${PROJECT_NAME}.keyloop`);
    
  } catch (error) {
    console.error(`   ❌ Error creating container:`, error.message);
    process.exit(1);
  }
  
  console.log();
  console.log('✨ Conversion complete!');
  console.log(`\n📂 Output location: ${OUTPUT_DIR}/`);
  console.log(`   - ${convertedPages.length} .keypage files`);
  console.log(`   - 1 .keyloop project file`);
}

// ============================================================================
// RUN
// ============================================================================

convertFiles().catch(error => {
  console.error('❌ Conversion failed:', error);
  process.exit(1);
});
