import {
  FaceDetector,
  FilesetResolver,
} from '@mediapipe/tasks-vision';

let faceDetector: FaceDetector | null = null;

async function getFaceDetector(): Promise<FaceDetector> {
  if (faceDetector) {
    return faceDetector;
  }

  const vision = await FilesetResolver.forVisionTasks(
    '/wasm'
  );

  faceDetector = await FaceDetector.createFromOptions(
    vision,
    {
      baseOptions: {
        modelAssetPath: '/models/face_detector.tflite',
      },
      runningMode: 'IMAGE',
      minDetectionConfidence: 0.5,
    }
  );

  return faceDetector;
}

export interface FaceValidationResult {
  faceCount: number;
  facesTooSmall: boolean;
  rejectionReasons: string[];
}

export async function validateFaces(
  imageFile: File
): Promise<FaceValidationResult> {
  const detector = await getFaceDetector();

  const imageUrl = URL.createObjectURL(imageFile);
  const image = new Image();

  try {
    image.src = imageUrl;

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(
        new Error('Unable to load image for face detection')
      );
    });

    const result = detector.detect(image);
    const detections = result.detections ?? [];

    const rejectionReasons: string[] = [];

    if (detections.length > 1) {
      rejectionReasons.push('Multiple faces detected');
    }

    const imageArea = image.naturalWidth * image.naturalHeight;

    const facesTooSmall = detections.some(detection => {
    const box = detection.boundingBox;

    if (!box || imageArea === 0) {
      console.log('Face size validation skipped: missing bounding box');
      return false;
    }

    const faceArea = box.width * box.height;
    const faceRatio = faceArea / imageArea;

    console.log('Face size validation:', {
      imageWidth: image.naturalWidth,
      imageHeight: image.naturalHeight,
      faceWidth: box.width,
      faceHeight: box.height,
      faceRatio: `${(faceRatio * 100).toFixed(2)}%`,
    });

    return faceRatio < 0.05;
  });

    if (facesTooSmall) {
      rejectionReasons.push('Detected face is too small');
    }

    return {
      faceCount: detections.length,
      facesTooSmall,
      rejectionReasons,
    };
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}
