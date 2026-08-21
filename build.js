/* =============================================================
   EWU Portal Helper - Production Obfuscation & Build Script
   ============================================================= */

const fs = require('fs');
const path = require('path');

const PUBLISH_DIR = __dirname;
const TARGET_JS_FILES = ['content.js', 'popup.js', 'background.js', 'activation.js'];

async function build() {
  console.log('[Build] Starting EWU Portal Helper production build...');

  if (!fs.existsSync(PUBLISH_DIR)) {
    console.error('[Build Error] Publish directory does not exist!');
    process.exit(1);
  }

  let JavaScriptObfuscator;
  try {
    JavaScriptObfuscator = require('javascript-obfuscator');
  } catch (_) {
    console.log('[Build] `javascript-obfuscator` not yet installed. Running lightweight minifier fallback...');
  }

  const SRC_DIR = path.join(PUBLISH_DIR, 'src');

  for (const fileName of TARGET_JS_FILES) {
    const srcFilePath = path.join(SRC_DIR, fileName);
    const destFilePath = path.join(PUBLISH_DIR, fileName);
    if (!fs.existsSync(srcFilePath)) {
      console.warn(`[Build Warning] Source file ${fileName} not found in src/ directory.`);
      continue;
    }

    const code = fs.readFileSync(srcFilePath, 'utf8');
    let processedCode = code;

    if (JavaScriptObfuscator) {
      console.log(`[Build] Obfuscating ${fileName}...`);
      const isLargeFile = fileName === 'content.js' || fileName === 'popup.js';
      
      const obfuscationResult = JavaScriptObfuscator.obfuscate(code, {
        compact: true,
        controlFlowFlattening: !isLargeFile,
        controlFlowFlatteningThreshold: 0.5,
        deadCodeInjection: !isLargeFile,
        deadCodeInjectionThreshold: 0.4,
        debugProtection: true,
        debugProtectionInterval: 4000,
        disableConsoleOutput: true,
        identifierNamesGenerator: 'hexadecimal',
        log: false,
        numbersToExpressions: true,
        renameGlobals: true,
        selfDefending: true,
        simplify: true,
        splitStrings: true,
        splitStringsChunkLength: 5,
        stringArray: true,
        stringArrayCallsTransform: true,
        stringArrayEncoding: ['base64', 'rc4'],
        stringArrayIndexShift: true,
        stringArrayRotate: true,
        stringArrayShuffle: true,
        stringArrayThreshold: 0.8,
        target: 'browser'
      });
      processedCode = obfuscationResult.getObfuscatedCode();
    } else {
      console.log(`[Build] Minifying ${fileName}...`);
      // Basic fallback minification
      processedCode = code
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*/g, '')
        .replace(/^\s+|\s+$/gm, '')
        .replace(/\n{2,}/g, '\n');
    }

    fs.writeFileSync(destFilePath, processedCode, 'utf8');
    console.log(`[Build] Successfully processed ${fileName} (${(processedCode.length / 1024).toFixed(1)} KB)`);
  }

  console.log('[Build Complete] Production build in `/publish` is ready!');
}

build();
