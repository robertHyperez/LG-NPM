import { build } from 'esbuild';
import JavaScriptObfuscator from 'javascript-obfuscator';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

// Step 1: esbuild로 번들링
await build({
  entryPoints: ['src/index.js'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/index.js',
  external: ['three', 'three/*', 'gsap'],
  target: 'es2020',
  minify: false, // 난독화 전에는 minify 하지 않음
});

// Step 2: 번들된 파일을 난독화
const bundled = readFileSync('dist/index.js', 'utf8');

const obfuscated = JavaScriptObfuscator.obfuscate(bundled, {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.2,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  selfDefending: false,
  stringArray: true,
  stringArrayThreshold: 0.5,
  stringArrayEncoding: ['base64'],
  transformObjectKeys: true,
  unicodeEscapeSequence: false,
  // export 이름은 유지
  reservedNames: [
    'ThreeViewer',
    'ModelManager',
    'HotspotManager',
    'CameraAnimator',
  ],
});

mkdirSync('dist', { recursive: true });
writeFileSync('dist/index.js', obfuscated.getObfuscatedCode());

console.log('Build + obfuscation complete → dist/index.js');
