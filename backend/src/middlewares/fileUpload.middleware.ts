import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

const baseUploadDir = 'uploads';

const createFolderIfNotExists = (folderPath: string) => {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
};

// Configure storage
const storage = multer.diskStorage({
  destination: function (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) {
    let subDir = 'files';

    if (file.mimetype.startsWith('image/')) {
      subDir = 'images';
    } else if (
      file.mimetype === 'application/pdf' ||
      file.mimetype.includes('word') ||
      file.mimetype.includes('officedocument') ||
      file.mimetype.includes('excel') ||
      file.mimetype.includes('powerpoint')
    ) {
      subDir = 'documents';
    }

    const fullPath = path.join(baseUploadDir, subDir);
    createFolderIfNotExists(fullPath);
    cb(null, fullPath);
  },

  filename: function (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) {
    const ext = path.extname(file.originalname);
    const safeBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, '_');
    cb(null, `${Date.now()}-${safeBase}${ext}`);
  },
});

// Dangerous executable extensions to block
const BLOCKED_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'ps1', 'msi', 'com', 'scr', 'vbs', 'vbe', 'wsf', 'wsh', 'reg', 'pif', 'dll'
]);

// Filter file types
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const ext = file.originalname.toLowerCase().split('.').pop() || '';
  if (BLOCKED_EXTENSIONS.has(ext)) {
    cb(new Error('Executable and potentially unsafe files are not allowed.'));
    return;
  }
  cb(null, true);
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

export { upload };
