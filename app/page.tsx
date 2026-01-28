"use client";

import { useState, useRef, useCallback } from "react";
import {
  convertImage,
  downloadBlob,
  getErrorMessage,
  type ConversionError,
} from "@/lib/imageConverter";

type Status = "idle" | "processing" | "success" | "error";

export default function Home() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<ConversionError | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setSelectedFileName(file.name);
        setStatus("idle");
        setError(null);

        // プレビュー生成
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        setSelectedFileName(null);
        setPreviewUrl(null);
      }
    },
    [previewUrl]
  );

  const handleConvert = useCallback(async () => {
    const file = fileInputRef.current?.files?.[0] ?? null;

    setStatus("processing");
    setError(null);

    const result = await convertImage(file);

    if (result.success) {
      downloadBlob(result.blob, result.filename);
      setStatus("success");
    } else {
      setError(result.error);
      setStatus("error");
    }
  }, []);

  const handleReset = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setSelectedFileName(null);
    setStatus("idle");
    setError(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [previewUrl]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* タイトル */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
            Story 変換
          </h1>
          <p className="text-slate-400 text-sm">
            画像を 1080×1920 に変換
          </p>
        </div>

        {/* メインカード */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6 shadow-2xl">
          {/* ファイル選択エリア */}
          <div className="mb-6">
            <label
              htmlFor="file-input"
              className="block w-full cursor-pointer"
            >
              <div
                className={`
                  border-2 border-dashed rounded-xl p-8 text-center transition-all
                  ${
                    selectedFileName
                      ? "border-purple-500/50 bg-purple-500/10"
                      : "border-slate-600 hover:border-slate-500 hover:bg-slate-700/30"
                  }
                `}
              >
                {previewUrl ? (
                  <div className="space-y-4">
                    <div className="relative w-32 h-32 mx-auto overflow-hidden rounded-lg bg-slate-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt="プレビュー"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-slate-300 text-sm truncate px-4">
                      {selectedFileName}
                    </p>
                    <p className="text-slate-500 text-xs">
                      タップして画像を変更
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-16 h-16 mx-auto rounded-full bg-slate-700/50 flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-slate-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <p className="text-slate-300">タップして画像を選択</p>
                    <p className="text-slate-500 text-xs">
                      JPEG / PNG（最大10MB）
                    </p>
                  </div>
                )}
              </div>
            </label>
            <input
              ref={fileInputRef}
              id="file-input"
              type="file"
              accept="image/jpeg,image/png"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* エラーメッセージ */}
          {status === "error" && error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
              <p className="text-red-400 text-sm text-center">
                {getErrorMessage(error)}
              </p>
            </div>
          )}

          {/* 成功メッセージ */}
          {status === "success" && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <p className="text-emerald-400 text-sm text-center">
                ダウンロードを開始しました
              </p>
            </div>
          )}

          {/* 変換ボタン */}
          <button
            onClick={handleConvert}
            disabled={!selectedFileName || status === "processing"}
            className={`
              w-full py-4 rounded-xl font-semibold text-white transition-all
              ${
                !selectedFileName || status === "processing"
                  ? "bg-slate-700 cursor-not-allowed opacity-50"
                  : "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 active:scale-[0.98] shadow-lg shadow-purple-500/25"
              }
            `}
          >
            {status === "processing" ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-5 w-5"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                処理中...
              </span>
            ) : (
              "変換してダウンロード"
            )}
          </button>

          {/* リセットボタン */}
          {(selectedFileName || status !== "idle") && (
            <button
              onClick={handleReset}
              className="w-full mt-3 py-3 rounded-xl text-slate-400 hover:text-slate-300 hover:bg-slate-700/30 transition-all text-sm"
            >
              リセット
            </button>
          )}
        </div>

        {/* フッター */}
        <p className="text-center text-slate-600 text-xs mt-6">
          画像はサーバーに送信されません
        </p>
      </div>
    </main>
  );
}
