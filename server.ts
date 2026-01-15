import express, { Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import os from 'os';
import path from 'path';
import ColorDetector from './color-detector';
import logger from './logger';

const app = express();
const colorDetector = new ColorDetector();

// Configure multer for file uploads with preserved file extensions
const storage = multer.diskStorage({
  destination: os.tmpdir(),
  filename: (req, file, cb) => {
    // Preserve the original file extension so get-pixels can detect the format
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `upload-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

// Middleware to parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the nodejs directory
app.use(express.static(path.join(__dirname)));

// Serve index.html at root endpoint
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Helper function to clean up temporary files
const cleanupFile = (filePath: string) => {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      logger.debug(`Cleaned up temporary file: ${filePath}`);
    } catch (error) {
      logger.error(`Error cleaning up file ${filePath}:`, error);
    }
  }
};

// POST /upload endpoint
app.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  const file = req.file;
  const url = req.body?.url || req.query?.url;
  let tempFilePath: string | null = null;

  try {
    // Validate that at least one input method is provided
    if (!file && !url) {
      return res.status(400).json({
        success: false,
        error: "Either 'file' or 'url' must be provided",
      });
    }

    // If both are provided, prioritize URL
    if (file && url) {
      // Clean up the uploaded file since we're using URL
      cleanupFile(file.path);
    }

    let imageSource: string;

    if (url) {
      // Pass URL directly to get-pixels (it accepts HTTP URLs)
      imageSource = url;
      logger.info(`Processing image from URL: ${url}`);
    } else if (file) {
      // Use file path - get-pixels accepts file paths
      imageSource = file.path;
      tempFilePath = file.path;
      logger.info(`Processing image from file: ${file.originalname}`);
    } else {
      return res.status(400).json({
        success: false,
        error: "Either 'file' or 'url' must be provided",
      });
    }

    // Process the image using ColorDetector
    const result = await colorDetector.parseColors(imageSource);

    // Clean up temporary file if it was uploaded
    if (tempFilePath) {
      cleanupFile(tempFilePath);
    }

    // Return the result
    return res.json(result);
  } catch (error: any) {
    logger.error('Error processing upload:', error);

    // Clean up temporary file on error
    if (tempFilePath) {
      cleanupFile(tempFilePath);
    }

    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Start server
const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

export default app;
