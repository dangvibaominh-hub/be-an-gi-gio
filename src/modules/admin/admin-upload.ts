import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import type { Request, RequestHandler } from "express";

import { asyncHandler } from "../../shared/http/async-handler.js";
import { AppError } from "../../shared/http/app-error.js";

const maxImageBytes = 5 * 1024 * 1024;
const maxMultipartBytes = maxImageBytes + 1024 * 1024;

interface MultipartFile {
  content: Buffer;
  filename: string;
}

interface MultipartForm {
  fields: Map<string, string[]>;
  files: Map<string, MultipartFile[]>;
}

interface ImageType {
  extension: string;
  mimeType: string;
}

export interface RecipeImageFile {
  content: Buffer;
  extension: string;
  filename: string;
  mimeType: string;
}

export interface UploadedRecipeImage {
  contentType: string;
  image: string;
  originalFilename: string;
  size: number;
  storagePath: string;
}

export interface RecipeImageStorage {
  uploadRecipeImage(file: RecipeImageFile): Promise<UploadedRecipeImage>;
}

export interface SupabaseRecipeImageStorageOptions {
  bucket: string;
  folder: string;
  serviceRoleKey?: string;
  supabaseUrl?: string;
}

export class SupabaseRecipeImageStorage implements RecipeImageStorage {
  private readonly client: ReturnType<typeof createClient>;
  private readonly folder: string;

  constructor(
    private readonly options: Required<
      Pick<SupabaseRecipeImageStorageOptions, "bucket" | "serviceRoleKey" | "supabaseUrl">
    > &
      Pick<SupabaseRecipeImageStorageOptions, "folder">,
  ) {
    this.client = createClient(options.supabaseUrl, options.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
    this.folder = normalizeStorageFolder(options.folder);
  }

  async uploadRecipeImage(file: RecipeImageFile) {
    const filename = `${randomUUID()}.${file.extension}`;
    const storagePath =
      this.folder.length === 0 ? filename : `${this.folder}/${filename}`;
    const { error } = await this.client.storage
      .from(this.options.bucket)
      .upload(storagePath, file.content, {
        cacheControl: "31536000",
        contentType: file.mimeType,
        upsert: false,
      });

    if (error !== null) {
      throw new AppError(
        502,
        "IMAGE_UPLOAD_FAILED",
        "Khong the upload anh cong thuc len Supabase Storage.",
        { message: error.message },
      );
    }

    const { data } = this.client.storage
      .from(this.options.bucket)
      .getPublicUrl(storagePath);

    return {
      image: data.publicUrl,
      contentType: file.mimeType,
      size: file.content.length,
      originalFilename: file.filename,
      storagePath,
    };
  }
}

export class DisabledRecipeImageStorage implements RecipeImageStorage {
  uploadRecipeImage(): Promise<UploadedRecipeImage> {
    throw new AppError(
      503,
      "SUPABASE_STORAGE_NOT_CONFIGURED",
      "Chua cau hinh Supabase Storage cho upload anh cong thuc.",
      {
        requiredEnv: [
          "SUPABASE_URL",
          "SUPABASE_SERVICE_ROLE_KEY",
          "SUPABASE_STORAGE_BUCKET",
        ],
      },
    );
  }
}

export function createRecipeImageStorage(
  options: SupabaseRecipeImageStorageOptions,
): RecipeImageStorage {
  if (
    options.supabaseUrl === undefined ||
    options.serviceRoleKey === undefined ||
    options.serviceRoleKey.length === 0
  ) {
    return new DisabledRecipeImageStorage();
  }

  return new SupabaseRecipeImageStorage({
    bucket: options.bucket,
    folder: options.folder,
    serviceRoleKey: options.serviceRoleKey,
    supabaseUrl: options.supabaseUrl,
  });
}

export function createRecipeMultipartBodyParser(
  storage: RecipeImageStorage,
  options: { requireImage?: boolean } = {},
): RequestHandler {
  return asyncHandler(async (request, response, next) => {
    void response;
    if (!isMultipartFormData(request.header("content-type") ?? "")) {
      next();
      return;
    }

    const form = await parseMultipartRequest(request);
    const body = await buildRecipeBodyFromMultipart(form, storage, {
      requireImage: options.requireImage ?? false,
    });
    request.body = body;
    next();
  });
}

export const requireMultipartRecipeImageUpload: RequestHandler = (
  request,
  _response,
  next,
) => {
  if (isMultipartFormData(request.header("content-type") ?? "")) {
    next();
    return;
  }

  next(
    new AppError(
      415,
      "RECIPE_IMAGE_UPLOAD_REQUIRED",
      "Tao cong thuc admin phai upload anh bang multipart/form-data.",
    ),
  );
};

export const rejectJsonRecipeImageUrl: RequestHandler = (
  request,
  _response,
  next,
) => {
  if (isMultipartFormData(request.header("content-type") ?? "")) {
    next();
    return;
  }

  if (
    typeof request.body === "object" &&
    request.body !== null &&
    "image" in request.body
  ) {
    next(
      new AppError(
        400,
        "RECIPE_IMAGE_UPLOAD_REQUIRED",
        "Anh cong thuc chi duoc cap nhat bang file upload, khong nhap URL.",
      ),
    );
    return;
  }

  next();
};

async function buildRecipeBodyFromMultipart(
  form: MultipartForm,
  storage: RecipeImageStorage,
  options: { requireImage: boolean },
) {
  const recipeJson = getSingleField(form, "recipe");
  const body =
    recipeJson === undefined
      ? {}
      : parseJsonObject(recipeJson, "recipe") as Record<string, unknown>;

  if (body.image !== undefined || getSingleField(form, "image") !== undefined) {
    throw new AppError(
      400,
      "RECIPE_IMAGE_UPLOAD_REQUIRED",
      "Anh cong thuc chi duoc gui bang file upload, khong nhap URL.",
    );
  }

  delete body.image;
  copyStringField(form, body, "slug");
  copyStringField(form, body, "title");
  copyStringField(form, body, "description");
  copyStringField(form, body, "imageAlt");
  copyStringField(form, body, "difficulty");
  copyStringField(form, body, "categorySlug");
  copyStringField(form, body, "status");
  copyIntegerField(form, body, "cookTimeMinutes");
  copyIntegerField(form, body, "baseServings");
  copyJsonField(form, body, "ingredients");
  copyJsonField(form, body, "steps");

  const imageFile = getSingleFile(form, "image");
  if (imageFile === null) {
    if (options.requireImage) {
      throw new AppError(
        400,
        "IMAGE_REQUIRED",
        "Vui long upload anh cong thuc bang field image.",
      );
    }

    return body;
  }

  const uploaded = await storage.uploadRecipeImage(validateRecipeImage(imageFile));
  body.image = uploaded.image;

  return body;
}

function isMultipartFormData(contentType: string) {
  return contentType
    .split(";")[0]
    ?.trim()
    .toLowerCase() === "multipart/form-data";
}

async function parseMultipartRequest(request: Request): Promise<MultipartForm> {
  const boundary = getMultipartBoundary(request.header("content-type") ?? "");
  const body = await readRequestBody(request);

  return parseMultipartBody(body, boundary);
}

function getMultipartBoundary(contentType: string) {
  const [mediaType, ...parameters] = contentType
    .split(";")
    .map((part) => part.trim());

  if (mediaType?.toLowerCase() !== "multipart/form-data") {
    throw new AppError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Endpoint upload anh chi nhan multipart/form-data.",
    );
  }

  const boundaryParameter = parameters.find((parameter) =>
    parameter.toLowerCase().startsWith("boundary="),
  );
  const boundary = boundaryParameter?.slice("boundary=".length).replace(/^"|"$/g, "");

  if (boundary === undefined || boundary.length === 0) {
    throw new AppError(
      400,
      "MULTIPART_BOUNDARY_REQUIRED",
      "Thieu multipart boundary trong Content-Type.",
    );
  }

  return boundary;
}

function readRequestBody(request: Request) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let exceededLimit = false;

    request.on("data", (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.length;

      if (totalBytes > maxMultipartBytes) {
        exceededLimit = true;
        return;
      }

      chunks.push(buffer);
    });
    request.on("end", () => {
      if (exceededLimit) {
        reject(
          new AppError(
            413,
            "IMAGE_TOO_LARGE",
            "Anh cong thuc khong duoc vuot qua 5MB.",
          ),
        );
        return;
      }

      resolve(Buffer.concat(chunks, totalBytes));
    });
    request.on("error", reject);
  });
}

function parseMultipartBody(body: Buffer, boundary: string): MultipartForm {
  const form: MultipartForm = {
    fields: new Map(),
    files: new Map(),
  };
  const delimiter = Buffer.from(`--${boundary}`);
  let delimiterIndex = body.indexOf(delimiter);

  while (delimiterIndex !== -1) {
    let partStart = delimiterIndex + delimiter.length;
    const marker = body.subarray(partStart, partStart + 2).toString("latin1");

    if (marker === "--") {
      break;
    }

    if (marker === "\r\n") {
      partStart += 2;
    }

    const nextDelimiterIndex = body.indexOf(delimiter, partStart);
    if (nextDelimiterIndex === -1) {
      break;
    }

    let part = body.subarray(partStart, nextDelimiterIndex);
    if (part.subarray(part.length - 2).toString("latin1") === "\r\n") {
      part = part.subarray(0, part.length - 2);
    }

    parseMultipartPart(form, part);
    delimiterIndex = nextDelimiterIndex;
  }

  return form;
}

function parseMultipartPart(form: MultipartForm, part: Buffer) {
  const headerSeparator = Buffer.from("\r\n\r\n");
  const headerEnd = part.indexOf(headerSeparator);

  if (headerEnd === -1) {
    return;
  }

  const headers = parsePartHeaders(part.subarray(0, headerEnd).toString("latin1"));
  const disposition = headers.get("content-disposition");

  if (disposition === undefined) {
    return;
  }

  const name = getDispositionParameter(disposition, "name");
  if (name === undefined || name.length === 0) {
    return;
  }

  const filename = getDispositionParameter(disposition, "filename");
  const content = part.subarray(headerEnd + headerSeparator.length);

  if (filename === undefined || filename.length === 0) {
    appendMapValue(form.fields, name, content.toString("utf8"));
    return;
  }

  appendMapValue(form.files, name, {
    content,
    filename,
  });
}

function parsePartHeaders(headerText: string) {
  const headers = new Map<string, string>();

  for (const line of headerText.split("\r\n")) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }

    const name = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    headers.set(name, value);
  }

  return headers;
}

function getDispositionParameter(disposition: string, parameterName: string) {
  const quotedMatch = new RegExp(`${parameterName}="([^"]*)"`, "i").exec(
    disposition,
  );
  if (quotedMatch?.[1] !== undefined) {
    return quotedMatch[1];
  }

  const bareMatch = new RegExp(`${parameterName}=([^;]+)`, "i").exec(
    disposition,
  );
  return bareMatch?.[1]?.trim();
}

function appendMapValue<T>(map: Map<string, T[]>, key: string, value: T) {
  const existing = map.get(key);

  if (existing === undefined) {
    map.set(key, [value]);
    return;
  }

  existing.push(value);
}

function getSingleField(form: MultipartForm, name: string) {
  return form.fields.get(name)?.at(-1);
}

function getSingleFile(form: MultipartForm, name: string) {
  return form.files.get(name)?.at(-1) ?? null;
}

function copyStringField(
  form: MultipartForm,
  body: Record<string, unknown>,
  name: string,
) {
  const value = getSingleField(form, name);
  if (value !== undefined) {
    body[name] = value;
  }
}

function copyIntegerField(
  form: MultipartForm,
  body: Record<string, unknown>,
  name: string,
) {
  const value = getSingleField(form, name);
  if (value === undefined) {
    return;
  }

  body[name] = Number(value);
}

function copyJsonField(
  form: MultipartForm,
  body: Record<string, unknown>,
  name: string,
) {
  const value = getSingleField(form, name);
  if (value !== undefined) {
    body[name] = parseJsonValue(value, name);
  }
}

function parseJsonObject(value: string, fieldName: string) {
  const parsed = parseJsonValue(value, fieldName);

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new AppError(
      400,
      "INVALID_MULTIPART_FIELD",
      `Field ${fieldName} phai la JSON object hop le.`,
    );
  }

  return parsed;
}

function parseJsonValue(value: string, fieldName: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new AppError(
      400,
      "INVALID_MULTIPART_FIELD",
      `Field ${fieldName} phai la JSON hop le.`,
    );
  }
}

function validateRecipeImage(file: MultipartFile): RecipeImageFile {
  if (file.content.length === 0) {
    throw new AppError(400, "IMAGE_REQUIRED", "Anh upload khong duoc rong.");
  }

  if (file.content.length > maxImageBytes) {
    throw new AppError(
      413,
      "IMAGE_TOO_LARGE",
      "Anh cong thuc khong duoc vuot qua 5MB.",
    );
  }

  const imageType = detectImageType(file.content);
  if (imageType === null) {
    throw new AppError(
      400,
      "UNSUPPORTED_IMAGE_TYPE",
      "Chi ho tro anh JPEG, PNG, WebP hoac GIF.",
    );
  }

  return {
    content: file.content,
    extension: imageType.extension,
    filename: file.filename,
    mimeType: imageType.mimeType,
  };
}

function detectImageType(content: Buffer): ImageType | null {
  if (content.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) {
    return { extension: "png", mimeType: "image/png" };
  }

  if (content.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return { extension: "jpg", mimeType: "image/jpeg" };
  }

  if (
    content.subarray(0, 4).toString("ascii") === "RIFF" &&
    content.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { extension: "webp", mimeType: "image/webp" };
  }

  const gifSignature = content.subarray(0, 6).toString("ascii");
  if (gifSignature === "GIF87a" || gifSignature === "GIF89a") {
    return { extension: "gif", mimeType: "image/gif" };
  }

  return null;
}

function normalizeStorageFolder(folder: string) {
  return folder
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");
}
