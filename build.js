const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const { minify: htmlMinify } = require('html-minifier-terser');
const CleanCSS = require('clean-css');

const srcDir = path.join(__dirname, 'src');
const rootDir = __dirname; // Output directly to root to avoid confusion

async function build() {
    console.log('Building and obfuscating for production...');

    // 1. Minify CSS
    const cssCode = fs.readFileSync(path.join(srcDir, 'style.css'), 'utf8');
    const minifiedCss = new CleanCSS({}).minify(cssCode).styles;
    fs.writeFileSync(path.join(rootDir, 'style.css'), minifiedCss);
    console.log('CSS Minified and saved to root');

    // 2. Obfuscate JS
    const jsCode = fs.readFileSync(path.join(srcDir, 'script.js'), 'utf8');
    const obfuscationResult = JavaScriptObfuscator.obfuscate(jsCode, {
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.75,
        deadCodeInjection: true,
        deadCodeInjectionThreshold: 0.4,
        stringArray: true,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 0.75,
        transformObjectKeys: true,
        unicodeEscapeSequence: false
    });
    fs.writeFileSync(path.join(rootDir, 'script.js'), obfuscationResult.getObfuscatedCode());
    console.log('JS Obfuscated and saved to root');

    // 3. Minify HTML
    const htmlCode = fs.readFileSync(path.join(srcDir, 'index.html'), 'utf8');
    const minifiedHtml = await htmlMinify(htmlCode, {
        collapseWhitespace: true,
        removeComments: true,
        minifyJS: true,
        minifyCSS: true
    });
    fs.writeFileSync(path.join(rootDir, 'index.html'), minifiedHtml);
    console.log('HTML Minified and saved to root');

    console.log('Build complete! Application is ready in the root folder.');
}

build();
