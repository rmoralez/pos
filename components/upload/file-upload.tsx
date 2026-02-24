"use client"

import { useState, useRef, ChangeEvent } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Upload, X, FileText, Image as ImageIcon, Loader2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface FileUploadProps {
  label: string
  description?: string
  onFileUploaded: (filePath: string) => void
  currentFilePath?: string | null
  recordType: "purchase-order" | "supplier-invoice"
  recordId: string
  documentType?: "invoice" | "remito"
  disabled?: boolean
}

export function FileUpload({
  label,
  description,
  onFileUploaded,
  currentFilePath,
  recordType,
  recordId,
  documentType = "invoice",
  disabled = false,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg"]
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Tipo de archivo no válido",
        description: "Solo se permiten archivos PDF, PNG y JPEG",
        variant: "destructive",
      })
      return
    }

    // Validate file size (10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      toast({
        title: "Archivo demasiado grande",
        description: "El tamaño máximo permitido es 10MB",
        variant: "destructive",
      })
      return
    }

    // Generate preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string)
      }
      reader.readAsDataURL(file)
    } else {
      setPreviewUrl(null)
    }

    // Upload file
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch(
        `/api/upload?type=${recordType}&id=${recordId}&documentType=${documentType}`,
        {
          method: "POST",
          body: formData,
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to upload file")
      }

      const data = await response.json()
      onFileUploaded(data.filePath)

      toast({
        title: "Archivo subido",
        description: "El archivo se ha subido correctamente",
      })
    } catch (error: any) {
      console.error("Upload error:", error)
      toast({
        title: "Error al subir archivo",
        description: error.message || "No se pudo subir el archivo",
        variant: "destructive",
      })
      setPreviewUrl(null)
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = () => {
    setPreviewUrl(null)
    onFileUploaded("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleButtonClick = () => {
    fileInputRef.current?.click()
  }

  const getFileIcon = () => {
    if (currentFilePath?.endsWith(".pdf")) {
      return <FileText className="h-12 w-12 text-red-500" />
    }
    return <ImageIcon className="h-12 w-12 text-blue-500" />
  }

  const getFileName = () => {
    if (currentFilePath) {
      return currentFilePath.split("/").pop() || "archivo"
    }
    return null
  }

  const isImage = (path: string) => {
    return path.match(/\.(png|jpg|jpeg)$/i)
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`file-${documentType}`}>{label}</Label>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}

      <input
        ref={fileInputRef}
        id={`file-${documentType}`}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || uploading}
      />

      {/* File Preview or Upload Button */}
      {currentFilePath || previewUrl ? (
        <Card className="p-4">
          <div className="flex items-start gap-4">
            {/* Preview */}
            <div className="flex-shrink-0">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="h-20 w-20 rounded object-cover"
                />
              ) : currentFilePath && isImage(currentFilePath) ? (
                <img
                  src={`/api/upload/${getFileName()}`}
                  alt="Document"
                  className="h-20 w-20 rounded object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded bg-muted">
                  {getFileIcon()}
                </div>
              )}
            </div>

            {/* File Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {getFileName()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {currentFilePath?.endsWith(".pdf") ? "Documento PDF" : "Imagen"}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {currentFilePath && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const filename = getFileName()
                    if (filename) {
                      window.open(`/api/upload/${filename}`, "_blank")
                    }
                  }}
                  disabled={disabled}
                >
                  Ver
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleButtonClick}
                disabled={disabled || uploading}
              >
                Cambiar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                disabled={disabled || uploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={handleButtonClick}
          disabled={disabled || uploading}
          className="w-full h-24 border-dashed"
        >
          {uploading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Subiendo...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-6 w-6" />
              <span className="text-sm">
                Haz clic para subir o arrastra un archivo
              </span>
              <span className="text-xs text-muted-foreground">
                PDF, PNG o JPEG (máx. 10MB)
              </span>
            </div>
          )}
        </Button>
      )}
    </div>
  )
}
