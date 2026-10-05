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
    let subDir = 'others';

    if (file.mimetype.startsWith('image/')) {
      subDir = 'images';
    } else if (file.mimetype === 'application/pdf' || file.mimetype.includes('word')) {
      subDir = 'documents';
    }

    const fullPath = path.join(baseUploadDir, subDir);
    createFolderIfNotExists(fullPath);
    cb(null, fullPath);
  },

  filename: function (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) {
    const ext = path.extname(file.originalname);
    const safeBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${Date.now()}-${safeBase}${ext}`);
  },
});

// Filter file types
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedTypes = [
    'application/pdf',
    'application/json',
    'text/json',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ];
  const ext = file.originalname.toLowerCase().split('.').pop();
  if (allowedTypes.includes(file.mimetype) || ['pdf', 'json', 'jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only standard images and documents are allowed.'));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

export { upload };
