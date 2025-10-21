import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, Upload, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  onImageSelect: (file: File) => void;
  isAnalyzing?: boolean;
  selectedImage?: File | null;
  onClear?: () => void;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  onImageSelect,
  isAnalyzing = false,
  selectedImage,
  onClear
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      onImageSelect(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onImageSelect(files[0]);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const openCameraDialog = () => {
    cameraInputRef.current?.click();
  };

  if (selectedImage) {
    return (
      <Card className="nutrition-card animate-scale-in">
        <div className="relative">
          <img
            src={URL.createObjectURL(selectedImage)}
            alt="Selected meal"
            className="w-full h-48 sm:h-56 md:h-64 lg:h-72 object-cover rounded-lg"
          />
          {!isAnalyzing && onClear && (
            <Button
              variant="secondary"
              size="sm"
              className="absolute top-2 right-2 shadow-medium"
              onClick={onClear}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          {isAnalyzing && (
            <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
              <div className="text-center text-white px-4">
                <Loader2 className="h-8 w-8 sm:h-10 sm:w-10 animate-spin mx-auto mb-2" />
                <p className="text-sm sm:text-base font-medium">Analyzing nutrition...</p>
              </div>
            </div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card 
      className={cn(
        "upload-area animate-fade-in",
        isDragOver && "drag-over"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="text-center space-y-4 sm:space-y-6 px-4">
        <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 rounded-full hero-gradient flex items-center justify-center">
          <Camera className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-lg sm:text-xl font-semibold text-foreground">
            Upload Your Meal Photo
          </h3>
          <p className="text-sm sm:text-base text-muted-foreground">
            Take a photo or upload an image to get instant nutrition analysis
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={openCameraDialog}
            variant="default"
            className="w-full sm:w-auto bg-primary hover:bg-primary-hover shadow-medium"
          >
            <Camera className="mr-2 h-4 w-4" />
            Take Photo
          </Button>
          
          <Button
            onClick={openFileDialog}
            variant="outline"
            className="w-full sm:w-auto shadow-soft"
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload Image
          </Button>
        </div>

        <p className="text-xs sm:text-sm text-muted-foreground">
          Supports JPG, PNG, WebP • Max 10MB
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />
    </Card>
  );
};