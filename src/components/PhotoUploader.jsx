import { useRef, useState } from "react";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { useToast } from "./Toast";
import { uploadEvidencePhoto } from "../lib/supabase";

/** photos: [{ id, url, isUploading? }] — object URLs or Supabase public URLs */
export default function PhotoUploader({ photos, setPhotos, max = 3 }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const toast = useToast();

  const addFiles = (fileList) => {
    const files = Array.from(fileList || []).filter((f) =>
      f.type.startsWith("image/")
    );
    if (!files.length) return;
    const room = max - photos.length;
    if (files.length > room) {
      toast(`You can add up to ${max} photos`, "error");
    }
    const selectedFiles = files.slice(0, room);
    const newItems = selectedFiles.map((f) => ({
      id: `${Date.now()}-${f.name}-${Math.random().toString(36).slice(2, 7)}`,
      url: URL.createObjectURL(f),
      file: f,
      isUploading: true,
    }));

    if (newItems.length) {
      setPhotos((prev) => [...prev, ...newItems]);

      // Upload to Supabase Storage asynchronously
      newItems.forEach(async (item) => {
        try {
          const publicUrl = await uploadEvidencePhoto(item.file);
          if (publicUrl) {
            setPhotos((current) =>
              current.map((p) =>
                p.id === item.id ? { ...p, url: publicUrl, isUploading: false } : p
              )
            );
          } else {
            setPhotos((current) =>
              current.map((p) =>
                p.id === item.id ? { ...p, isUploading: false } : p
              )
            );
          }
        } catch (err) {
          setPhotos((current) =>
            current.map((p) =>
              p.id === item.id ? { ...p, isUploading: false } : p
            )
          );
        }
      });
    }
  };

  const remove = (id) => {
    const p = photos.find((x) => x.id === id);
    if (p && p.url.startsWith("blob:")) URL.revokeObjectURL(p.url);
    setPhotos((prev) => prev.filter((x) => x.id !== id));
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
          dragging
            ? "border-green-500 bg-green-50/60"
            : "border-slate-300 bg-slate-50/60 hover:border-slate-400 hover:bg-slate-50"
        }`}
      >
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-white text-green-600 shadow-sm">
          <ImagePlus className="size-5" />
        </span>
        <span className="mt-3 text-sm font-medium text-slate-800">
          Drag &amp; drop photos here, or <span className="text-green-700 underline underline-offset-2">browse</span>
        </span>
        <span className="mt-1 text-xs text-slate-500">
          Up to {max} photos · JPG or PNG
        </span>
      </button>

      {photos.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {photos.map((p) => (
            <div
              key={p.id}
              className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
            >
              <img
                src={p.url}
                alt="Report evidence"
                className="h-full w-full object-cover"
              />
              {p.isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/25 backdrop-blur-[1px]">
                  <Loader2 className="size-5 animate-spin text-white drop-shadow" />
                </div>
              )}
              <button
                type="button"
                onClick={() => remove(p.id)}
                aria-label="Remove photo"
                className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-slate-900/70 text-white opacity-100 transition hover:bg-slate-900 sm:opacity-0 sm:group-hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
