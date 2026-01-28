/**
 * Instagram Story用画像変換ライブラリ
 * 完全にクライアントサイドで動作
 */

// 出力サイズ定数
const OUTPUT_WIDTH = 1080;
const OUTPUT_HEIGHT = 1920;
const JPEG_QUALITY = 0.9;
const BLUR_AMOUNT = 30; // 背景ぼかし量（px）

// バリデーション定数
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_PIXEL_DIMENSION = 4096;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png"];

export type ConversionError =
  | { type: "NO_FILE" }
  | { type: "FILE_TOO_LARGE"; maxSize: number; actualSize: number }
  | { type: "INVALID_MIME_TYPE"; allowed: string[]; actual: string }
  | { type: "PIXEL_EXCEEDED"; maxDimension: number; width: number; height: number }
  | { type: "DECODE_FAILED"; message: string }
  | { type: "CONVERSION_FAILED"; message: string };

export type ConversionResult =
  | { success: true; blob: Blob; filename: string }
  | { success: false; error: ConversionError };

/**
 * エラーメッセージを取得
 */
export function getErrorMessage(error: ConversionError): string {
  switch (error.type) {
    case "NO_FILE":
      return "ファイルを選択してください";
    case "FILE_TOO_LARGE":
      return `ファイルサイズは${Math.floor(error.maxSize / 1024 / 1024)}MB以下にしてください`;
    case "INVALID_MIME_TYPE":
      return "JPEG/PNG形式のみ対応しています";
    case "PIXEL_EXCEEDED":
      return `画像サイズは${error.maxDimension}px以下にしてください`;
    case "DECODE_FAILED":
      return "画像の読み込みに失敗しました";
    case "CONVERSION_FAILED":
      return "画像の処理に失敗しました";
  }
}

/**
 * ファイルバリデーション
 */
function validateFile(file: File): ConversionError | null {
  // ファイルサイズチェック
  if (file.size > MAX_FILE_SIZE) {
    return {
      type: "FILE_TOO_LARGE",
      maxSize: MAX_FILE_SIZE,
      actualSize: file.size,
    };
  }

  // MIMEタイプチェック
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      type: "INVALID_MIME_TYPE",
      allowed: ALLOWED_MIME_TYPES,
      actual: file.type,
    };
  }

  return null;
}

/**
 * 画像をロードしてImageBitmapを取得
 * createImageBitmapでEXIF Orientationを自動補正
 */
async function loadImage(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file, {
    imageOrientation: "from-image", // EXIF Orientationを反映
  });
}

/**
 * ピクセル数バリデーション
 */
function validateDimensions(
  width: number,
  height: number
): ConversionError | null {
  if (width > MAX_PIXEL_DIMENSION || height > MAX_PIXEL_DIMENSION) {
    return {
      type: "PIXEL_EXCEEDED",
      maxDimension: MAX_PIXEL_DIMENSION,
      width,
      height,
    };
  }
  return null;
}

/**
 * 画像を1080x1920に変換（背景ぼかし + 全体表示）
 */
function convertToStorySize(bitmap: ImageBitmap): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_WIDTH;
  canvas.height = OUTPUT_HEIGHT;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context not available");
  }

  const sourceWidth = bitmap.width;
  const sourceHeight = bitmap.height;

  // 出力アスペクト比: 9:16 (1080/1920 = 0.5625)
  const outputAspect = OUTPUT_WIDTH / OUTPUT_HEIGHT;
  // 入力アスペクト比
  const inputAspect = sourceWidth / sourceHeight;

  // === 背景レイヤー（ぼかし） ===
  // 短辺基準でスケールし、1080x1920を完全に覆う
  let bgSrcX: number, bgSrcY: number, bgSrcWidth: number, bgSrcHeight: number;

  if (inputAspect > outputAspect) {
    // 入力が横長 → 高さ基準、左右トリム
    bgSrcHeight = sourceHeight;
    bgSrcWidth = sourceHeight * outputAspect;
    bgSrcX = (sourceWidth - bgSrcWidth) / 2;
    bgSrcY = 0;
  } else {
    // 入力が縦長 → 幅基準、上下トリム
    bgSrcWidth = sourceWidth;
    bgSrcHeight = sourceWidth / outputAspect;
    bgSrcX = 0;
    bgSrcY = (sourceHeight - bgSrcHeight) / 2;
  }

  // ぼかしフィルター適用して背景描画
  ctx.filter = `blur(${BLUR_AMOUNT}px)`;
  ctx.drawImage(
    bitmap,
    bgSrcX,
    bgSrcY,
    bgSrcWidth,
    bgSrcHeight,
    -BLUR_AMOUNT, // ぼかしによる端の透明部分を補うためにはみ出し描画
    -BLUR_AMOUNT,
    OUTPUT_WIDTH + BLUR_AMOUNT * 2,
    OUTPUT_HEIGHT + BLUR_AMOUNT * 2
  );
  ctx.filter = "none";

  // === 前景レイヤー（全体表示） ===
  // 長辺基準でスケールし、画像全体が1080x1920内に収まるように
  let fgDestWidth: number, fgDestHeight: number;

  if (inputAspect > outputAspect) {
    // 入力が横長 → 幅基準でフィット
    fgDestWidth = OUTPUT_WIDTH;
    fgDestHeight = OUTPUT_WIDTH / inputAspect;
  } else {
    // 入力が縦長 → 高さ基準でフィット
    fgDestHeight = OUTPUT_HEIGHT;
    fgDestWidth = OUTPUT_HEIGHT * inputAspect;
  }

  // 中央配置
  const fgDestX = (OUTPUT_WIDTH - fgDestWidth) / 2;
  const fgDestY = (OUTPUT_HEIGHT - fgDestHeight) / 2;

  ctx.drawImage(
    bitmap,
    0,
    0,
    sourceWidth,
    sourceHeight,
    fgDestX,
    fgDestY,
    fgDestWidth,
    fgDestHeight
  );

  return canvas;
}

/**
 * CanvasをJPEG Blobに変換
 */
function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to create blob"));
        }
      },
      "image/jpeg",
      JPEG_QUALITY
    );
  });
}

/**
 * ファイル名を生成（story_yyyyMMdd_HHmmss.jpg）
 */
function generateFilename(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `story_${dateStr}_${timeStr}.jpg`;
}

/**
 * メイン変換関数
 */
export async function convertImage(file: File | null): Promise<ConversionResult> {
  // ファイル存在チェック
  if (!file) {
    return { success: false, error: { type: "NO_FILE" } };
  }

  // ファイルバリデーション
  const fileError = validateFile(file);
  if (fileError) {
    return { success: false, error: fileError };
  }

  // 画像ロード
  let bitmap: ImageBitmap;
  try {
    bitmap = await loadImage(file);
  } catch (e) {
    return {
      success: false,
      error: {
        type: "DECODE_FAILED",
        message: e instanceof Error ? e.message : "Unknown error",
      },
    };
  }

  // ピクセル数バリデーション
  const dimensionError = validateDimensions(bitmap.width, bitmap.height);
  if (dimensionError) {
    bitmap.close();
    return { success: false, error: dimensionError };
  }

  // 変換処理
  try {
    const canvas = convertToStorySize(bitmap);
    bitmap.close();

    const blob = await canvasToJpegBlob(canvas);
    const filename = generateFilename();

    return { success: true, blob, filename };
  } catch (e) {
    return {
      success: false,
      error: {
        type: "CONVERSION_FAILED",
        message: e instanceof Error ? e.message : "Unknown error",
      },
    };
  }
}

/**
 * Blobをダウンロード
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
