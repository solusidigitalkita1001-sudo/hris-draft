import fs from 'fs/promises';
import path from 'path';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import type { FaceVector } from './face-recognition';
import { normalizeVector } from './face-recognition';
import { logger } from '@/shared/logger/WinstonLogger';

export const FACE_MODEL_VERSION = 'human-3.3.6/faceres-feats-256';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 16_000_000;
const MIN_IMAGE_SIDE = 160;
const MIN_FACE_CONFIDENCE = 0.75;

export type FaceExtractionErrorCode =
  | 'INVALID_IMAGE'
  | 'IMAGE_TOO_LARGE'
  | 'MODEL_UNAVAILABLE'
  | 'FACE_NOT_FOUND'
  | 'MULTIPLE_FACES'
  | 'LOW_CONFIDENCE'
  | 'EMBEDDING_UNAVAILABLE';

export class FaceExtractionError extends Error {
  constructor(
    public readonly code: FaceExtractionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'FaceExtractionError';
  }
}

export interface FaceExtractionResult {
  vector: FaceVector;
  pixelVariance: number;
  estimatedWidth: number;
  estimatedHeight: number;
  fileSizeBytes: number;
  faceConfidence: number;
  modelVersion: string;
  isFallbackHeuristic: false;
}

type DecodedImage = {
  pixels: Uint8Array;
  width: number;
  height: number;
  mimeType: 'image/jpeg' | 'image/png';
};

let humanInstance: any = null;
let humanLoadPromise: Promise<any> | null = null;

function resolveHumanPackageRoot(): string {
  return path.resolve(path.dirname(require.resolve('@vladmandic/human')), '..');
}

function registerLocalModelLoader(tf: any, modelsRoot: string): void {
  const safeRoot = `${path.resolve(modelsRoot)}${path.sep}`;
  tf.io.registerLoadRouter((url: string | string[]) => {
    const rawUrl = Array.isArray(url) ? url[0] : url;
    if (typeof rawUrl !== 'string' || !rawUrl.startsWith('file://')) return null;

    return {
      load: async () => {
        const modelPath = path.resolve(decodeURIComponent(new URL(rawUrl).pathname));
        if (!modelPath.startsWith(safeRoot)) {
          throw new Error('Face model path is outside the trusted model directory');
        }

        const manifest = JSON.parse(await fs.readFile(modelPath, 'utf8')) as {
          modelTopology: unknown;
          format?: string;
          generatedBy?: string;
          convertedBy?: string;
          weightsManifest?: Array<{ paths: string[]; weights: unknown[] }>;
        };
        const modelDirectory = path.dirname(modelPath);
        const weightSpecs: unknown[] = [];
        const weightBuffers: Buffer[] = [];

        for (const group of manifest.weightsManifest ?? []) {
          weightSpecs.push(...group.weights);
          for (const relativeWeightPath of group.paths) {
            const weightPath = path.resolve(modelDirectory, relativeWeightPath);
            if (!weightPath.startsWith(safeRoot)) {
              throw new Error('Face model weight path is outside the trusted model directory');
            }
            weightBuffers.push(await fs.readFile(weightPath));
          }
        }

        const combined = Buffer.concat(weightBuffers);
        return {
          modelTopology: manifest.modelTopology,
          format: manifest.format,
          generatedBy: manifest.generatedBy,
          convertedBy: manifest.convertedBy,
          weightSpecs,
          weightData: combined.buffer.slice(
            combined.byteOffset,
            combined.byteOffset + combined.byteLength,
          ),
        };
      },
    };
  });
}

async function getHumanInstance(): Promise<any> {
  if (humanInstance) return humanInstance;
  if (humanLoadPromise) return humanLoadPromise;

  humanLoadPromise = (async () => {
    try {
      const humanRoot = resolveHumanPackageRoot();
      const HumanModule = require(path.join(humanRoot, 'dist', 'human.node-wasm.js'));
      const Human = HumanModule.default ?? HumanModule.Human ?? HumanModule;
      const wasmRoot = path.dirname(require.resolve('@tensorflow/tfjs-backend-wasm'));
      const modelsRoot = path.join(humanRoot, 'models');
      const instance = new Human({
        backend: 'wasm',
        wasmPath: `${wasmRoot}${path.sep}`,
        modelBasePath: `file://${modelsRoot}${path.sep}`,
        debug: false,
        async: false,
        warmup: 'none',
        cacheModels: false,
        face: {
          enabled: true,
          detector: {
            enabled: true,
            modelPath: 'blazeface.json',
            rotation: true,
            maxDetected: 2,
            return: true,
          },
          mesh: { enabled: true, modelPath: 'facemesh.json' },
          iris: { enabled: false },
          description: { enabled: true, modelPath: 'faceres.json' },
          emotion: { enabled: false },
          antispoof: { enabled: false },
          liveness: { enabled: false },
        },
        body: { enabled: false },
        hand: { enabled: false },
        object: { enabled: false },
        segmentation: { enabled: false },
        gesture: { enabled: false },
      });

      registerLocalModelLoader(instance.tf, modelsRoot);
      await instance.load();
      humanInstance = instance;
      logger.info('[FaceExtractor] Human Node-WASM models loaded', {
        backend: instance.tf.getBackend(),
        modelVersion: FACE_MODEL_VERSION,
      });
      return instance;
    } catch (error) {
      humanLoadPromise = null;
      logger.error('[FaceExtractor] Failed to initialize face recognition model', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new FaceExtractionError(
        'MODEL_UNAVAILABLE',
        'Model face recognition server tidak tersedia',
      );
    }
  })();

  return humanLoadPromise;
}

export async function extractFaceVectorFromImage(
  imageInput: string | Buffer,
): Promise<FaceExtractionResult> {
  const buffer = decodeImageInput(imageInput);
  const decoded = decodeImage(buffer);
  const pixelVariance = computePixelVariance(decoded.pixels);
  const human = await getHumanInstance();
  const tensor = human.tf.tensor3d(
    decoded.pixels,
    [decoded.height, decoded.width, 3],
    'int32',
  );

  try {
    const result = await human.detect(tensor);
    const faces = Array.isArray(result?.face) ? result.face : [];
    try {
      if (faces.length === 0) {
        throw new FaceExtractionError(
          'FACE_NOT_FOUND',
          'Wajah tidak terdeteksi. Gunakan foto yang terang dan menghadap kamera.',
        );
      }
      if (faces.length !== 1) {
        throw new FaceExtractionError(
          'MULTIPLE_FACES',
          'Foto harus berisi tepat satu wajah.',
        );
      }

      const face = faces[0];
      const confidence = Number(face.faceScore ?? face.boxScore ?? 0);
      if (!Number.isFinite(confidence) || confidence < MIN_FACE_CONFIDENCE) {
        throw new FaceExtractionError(
          'LOW_CONFIDENCE',
          'Wajah terdeteksi kurang jelas. Ambil ulang foto dengan pencahayaan yang lebih baik.',
        );
      }

      const embedding = await extractDescriptor(human, face);
      if (
        embedding.length < 128 ||
        embedding.length > 2048 ||
        embedding.some((value: unknown) => !Number.isFinite(Number(value)))
      ) {
        throw new FaceExtractionError(
          'EMBEDDING_UNAVAILABLE',
          'Model tidak dapat mengekstrak ciri wajah dari foto.',
        );
      }

      return {
        vector: normalizeVector(embedding.map(Number)),
        pixelVariance,
        estimatedWidth: decoded.width,
        estimatedHeight: decoded.height,
        fileSizeBytes: buffer.length,
        faceConfidence: confidence,
        modelVersion: FACE_MODEL_VERSION,
        isFallbackHeuristic: false,
      };
    } finally {
      for (const face of faces) {
        if (face?.tensor) human.tf.dispose(face.tensor);
      }
    }
  } finally {
    tensor.dispose();
  }
}

async function extractDescriptor(human: any, face: any): Promise<number[]> {
  if (Array.isArray(face?.embedding) && face.embedding.length >= 128) {
    return face.embedding.map(Number);
  }
  if (!face?.tensor) return [];

  const model = human.models?.models?.faceres;
  const inputShape = model?.inputs?.[0]?.shape;
  if (!model?.execute || !Array.isArray(inputShape) || !inputShape[1] || !inputShape[2]) {
    return [];
  }

  const createdBatch = face.tensor.shape.length === 3;
  const batch = createdBatch ? human.tf.expandDims(face.tensor, 0) : face.tensor;
  const resized = human.tf.image.resizeBilinear(
    batch,
    [inputShape[1], inputShape[2]],
    false,
  );
  const normalizedForModel = human.tf.mul(resized, 255);
  let outputs: any[] = [];
  try {
    const rawOutput = model.execute(normalizedForModel, ['feats/Relu']);
    outputs = Array.isArray(rawOutput) ? rawOutput : [rawOutput];
    const descriptorTensor = outputs.find(
      (output) => Array.isArray(output?.shape) && output.shape[1] >= 128,
    );
    if (!descriptorTensor) return [];
    return Array.from(await descriptorTensor.data(), Number);
  } finally {
    human.tf.dispose([
      ...(createdBatch ? [batch] : []),
      resized,
      normalizedForModel,
      ...outputs,
    ]);
  }
}

function decodeImageInput(input: string | Buffer): Buffer {
  if (Buffer.isBuffer(input)) {
    if (input.length === 0) {
      throw new FaceExtractionError('INVALID_IMAGE', 'File foto kosong.');
    }
    if (input.length > MAX_IMAGE_BYTES) {
      throw new FaceExtractionError('IMAGE_TOO_LARGE', 'Ukuran foto maksimal 5 MB.');
    }
    return input;
  }

  const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=\s]+)$/i.exec(input);
  if (!match) {
    throw new FaceExtractionError(
      'INVALID_IMAGE',
      'selfieImage harus berupa data URL JPEG atau PNG.',
    );
  }
  const encoded = match[2].replace(/\s/g, '');
  if (encoded.length === 0 || encoded.length % 4 !== 0) {
    throw new FaceExtractionError('INVALID_IMAGE', 'Data foto base64 tidak valid.');
  }
  const buffer = Buffer.from(encoded, 'base64');
  if (buffer.length === 0) {
    throw new FaceExtractionError('INVALID_IMAGE', 'Data foto kosong.');
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new FaceExtractionError('IMAGE_TOO_LARGE', 'Ukuran foto maksimal 5 MB.');
  }
  if (
    buffer.toString('base64').replace(/=+$/, '') !==
    encoded.replace(/=+$/, '')
  ) {
    throw new FaceExtractionError('INVALID_IMAGE', 'Data foto base64 tidak valid.');
  }
  return buffer;
}

function decodeImage(buffer: Buffer): DecodedImage {
  if (isJpeg(buffer)) return decodeJpeg(buffer);
  if (isPng(buffer)) return decodePng(buffer);
  throw new FaceExtractionError(
    'INVALID_IMAGE',
    'Format foto tidak valid. Gunakan file JPEG atau PNG asli.',
  );
}

function isJpeg(buffer: Buffer): boolean {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

function isPng(buffer: Buffer): boolean {
  return buffer.length >= 24 && buffer.subarray(0, 8).equals(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
}

function assertSafeDimensions(width: number, height: number): void {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < MIN_IMAGE_SIDE ||
    height < MIN_IMAGE_SIDE ||
    width * height > MAX_IMAGE_PIXELS
  ) {
    throw new FaceExtractionError(
      'INVALID_IMAGE',
      `Resolusi foto minimal ${MIN_IMAGE_SIDE}x${MIN_IMAGE_SIDE} dan maksimal 16 megapixel.`,
    );
  }
}

function readJpegDimensions(buffer: Buffer): { width: number; height: number } {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > buffer.length) break;
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) break;
    if (marker >= 0xc0 && marker <= 0xc3 && segmentLength >= 7) {
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      };
    }
    offset += segmentLength;
  }
  throw new FaceExtractionError('INVALID_IMAGE', 'Header JPEG tidak valid.');
}

function decodeJpeg(buffer: Buffer): DecodedImage {
  const dimensions = readJpegDimensions(buffer);
  assertSafeDimensions(dimensions.width, dimensions.height);
  try {
    const decoded = jpeg.decode(buffer, { useTArray: true, formatAsRGBA: false });
    if (decoded.width !== dimensions.width || decoded.height !== dimensions.height) {
      throw new Error('JPEG dimensions changed during decode');
    }
    return {
      pixels: decoded.data,
      width: decoded.width,
      height: decoded.height,
      mimeType: 'image/jpeg',
    };
  } catch (error) {
    if (error instanceof FaceExtractionError) throw error;
    throw new FaceExtractionError('INVALID_IMAGE', 'File JPEG rusak atau tidak dapat dibaca.');
  }
}

function decodePng(buffer: Buffer): DecodedImage {
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  assertSafeDimensions(width, height);
  try {
    const decoded = PNG.sync.read(buffer, { skipRescale: false });
    if (decoded.width !== width || decoded.height !== height) {
      throw new Error('PNG dimensions changed during decode');
    }
    const rgb = new Uint8Array(decoded.width * decoded.height * 3);
    for (let source = 0, target = 0; source < decoded.data.length; source += 4) {
      rgb[target++] = decoded.data[source];
      rgb[target++] = decoded.data[source + 1];
      rgb[target++] = decoded.data[source + 2];
    }
    return { pixels: rgb, width, height, mimeType: 'image/png' };
  } catch (error) {
    if (error instanceof FaceExtractionError) throw error;
    throw new FaceExtractionError('INVALID_IMAGE', 'File PNG rusak atau tidak dapat dibaca.');
  }
}

function computePixelVariance(pixels: Uint8Array): number {
  const totalPixels = Math.floor(pixels.length / 3);
  const step = Math.max(1, Math.floor(totalPixels / 4096));
  let sum = 0;
  let sumSquared = 0;
  let count = 0;
  for (let pixel = 0; pixel < totalPixels; pixel += step) {
    const offset = pixel * 3;
    const luminance =
      0.299 * pixels[offset] +
      0.587 * pixels[offset + 1] +
      0.114 * pixels[offset + 2];
    sum += luminance;
    sumSquared += luminance * luminance;
    count += 1;
  }
  if (count === 0) return 0;
  const mean = sum / count;
  return Math.max(0, sumSquared / count - mean * mean);
}
