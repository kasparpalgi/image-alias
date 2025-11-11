#!/usr/bin/env node

require('dotenv').config();
const Minio = require('minio');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT;
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY;
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY;
const MINIO_BUCKET = process.env.MINIO_BUCKET;

const IMAGES_FOLDER = path.join(__dirname, 'images');
const OUTPUT_FILE = path.join(__dirname, 'images.json');
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'];

if (!MINIO_ENDPOINT || !MINIO_ACCESS_KEY || !MINIO_SECRET_KEY || !MINIO_BUCKET) {
    console.error('Error: Missing required environment variables in .env file');
    console.error('Required: MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET');
    process.exit(1);
}

const endpointUrl = new URL(MINIO_ENDPOINT);
const useSSL = endpointUrl.protocol === 'https:';
const endpoint = endpointUrl.hostname;
const port = endpointUrl.port ? parseInt(endpointUrl.port) : (useSSL ? 443 : 80);

const minioClient = new Minio.Client({
    endPoint: endpoint,
    port: port,
    useSSL: useSSL,
    accessKey: MINIO_ACCESS_KEY,
    secretKey: MINIO_SECRET_KEY
});

function getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.bmp': 'image/bmp'
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

function getImageName(filename) {
    return path.parse(filename).name;
}

function createObjectName(originalFilename) {
    const fileExtension = path.extname(originalFilename);
    const baseName = path.parse(originalFilename).name;

    return `${randomUUID()}-${baseName}${fileExtension}`;
}

function loadExistingUrls() {
    try {
        if (fs.existsSync(OUTPUT_FILE)) {
            const data = fs.readFileSync(OUTPUT_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.warn('Warning: Could not load existing images.json:', err.message);
    }
    return {};
}

async function uploadFile(filePath, filename, existingUrls) {
    const imageName = getImageName(filename);

    if (existingUrls[imageName]) {
        console.log(`⊘ Skipping (already uploaded): ${filename}`);
        return { name: imageName, url: existingUrls[imageName], skipped: true };
    }

    const maxRetries = 3;
    let attempts = 0;
    let lastError;

    const fileBuffer = fs.readFileSync(filePath);
    const objectName = createObjectName(filename);
    const mimeType = getMimeType(filename);

    while (attempts < maxRetries) {
        try {
            console.log(`[${attempts + 1}/${maxRetries}] Uploading: ${filename} -> ${objectName}`);

            // Upload with min. metadata (avoid special chars)
            await minioClient.putObject(
                MINIO_BUCKET,
                objectName,
                fileBuffer,
                fileBuffer.length,
                {
                    'Content-Type': mimeType
                }
            );

            const fileUrl = `${MINIO_ENDPOINT}/${MINIO_BUCKET}/${encodeURIComponent(objectName)}`;
            console.log(`✓ Successfully uploaded: ${filename}`);

            return {
                name: imageName,
                url: fileUrl,
                originalFilename: filename,
                objectName: objectName
            };

        } catch (err) {
            attempts++;
            lastError = err;
            console.error(`✗ Upload error (attempt ${attempts}/${maxRetries}):`, err.message);

            if (attempts < maxRetries) {
                const delay = 1000 * Math.pow(2, attempts - 1);
                console.log(`  Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw new Error(`Failed to upload ${filename} after ${maxRetries} attempts: ${lastError.message}`);
}

async function main() {
    console.log('=== MinIO Image Uploader ===\n');

    if (!fs.existsSync(IMAGES_FOLDER)) {
        console.error(`Error: Images folder not found at ${IMAGES_FOLDER}`);
        console.log('Please create an /images folder and add your images.');
        process.exit(1);
    }

    const existingUrls = loadExistingUrls();
    const alreadyUploadedCount = Object.keys(existingUrls).length;

    if (alreadyUploadedCount > 0) {
        console.log(`Found ${alreadyUploadedCount} already uploaded image(s) in images.json\n`);
    }

    const files = fs.readdirSync(IMAGES_FOLDER);
    const imageFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return IMAGE_EXTENSIONS.includes(ext);
    });

    if (imageFiles.length === 0) {
        console.log('No image files found in /images folder.');
        process.exit(0);
    }

    // Filter out already uploaded
    const filesToUpload = imageFiles.filter(file => {
        const imageName = getImageName(file);
        return !existingUrls[imageName];
    });

    console.log(`Total images: ${imageFiles.length}`);
    console.log(`Already uploaded: ${imageFiles.length - filesToUpload.length}`);
    console.log(`To upload: ${filesToUpload.length}\n`);

    if (filesToUpload.length === 0) {
        console.log('All images are already uploaded!');
        process.exit(0);
    }

    console.log('Files to upload:');
    filesToUpload.forEach((file, i) => console.log(`  ${i + 1}. ${file}`));
    console.log('');

    const results = { ...existingUrls };
    const errors = [];
    let uploadedCount = 0;
    let skippedCount = 0;

    for (const file of filesToUpload) {
        try {
            const filePath = path.join(IMAGES_FOLDER, file);
            const result = await uploadFile(filePath, file, existingUrls);

            results[result.name] = result.url;

            if (result.skipped) {
                skippedCount++;
            } else {
                uploadedCount++;
            }
        } catch (err) {
            console.error(`✗ Failed to upload ${file}:`, err.message);
            errors.push({ file, error: err.message });
        }
    }

    try {
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf8');
        console.log(`\n✓ URLs saved to ${OUTPUT_FILE}`);
    } catch (err) {
        console.error(`\n✗ Failed to save images.json:`, err.message);
    }

    console.log('\n=== Upload Summary ===');
    console.log(`Total images: ${imageFiles.length}`);
    console.log(`Successfully uploaded: ${uploadedCount}`);
    console.log(`Already uploaded (skipped): ${alreadyUploadedCount}`);
    console.log(`Failed: ${errors.length}`);

    if (errors.length > 0) {
        console.log('\nFailed uploads:');
        errors.forEach(({ file, error }) => {
            console.log(`  - ${file}: ${error}`);
        });
        console.log('\nTo retry failed uploads, simply run the script again.');
    }

    console.log('\nDone!');
}

main().catch(err => {
    console.error('\nFatal error:', err);
    process.exit(1);
});