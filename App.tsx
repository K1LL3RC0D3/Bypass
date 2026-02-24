import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Download, Play, Pause, Settings, Video, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import './App.css';

interface ProcessingState {
  isProcessing: boolean;
  progress: number;
  fps: number;
  processedFrames: number;
  totalFrames: number;
  estimatedTimeRemaining: number;
}

export default function App() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [processedVideoUrl, setProcessedVideoUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Line settings
  const [showVertical, setShowVertical] = useState(true);
  const [showHorizontal, setShowHorizontal] = useState(false);
  const [showRotating, setShowRotating] = useState(false);
  const [lineThickness, setLineThickness] = useState(2);
  const [lineOpacity, setLineOpacity] = useState(70);
  
  // Processing state
  const [processing, setProcessing] = useState<ProcessingState>({
    isProcessing: false,
    progress: 0,
    fps: 0,
    processedFrames: 0,
    totalFrames: 0,
    estimatedTimeRemaining: 0,
  });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Draw lines on canvas
  const drawLines = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, progress: number) => {
    const thickness = lineThickness;
    const opacity = lineOpacity / 100;
    
    ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
    ctx.lineWidth = thickness;
    
    // Vertical line - bounces left to right
    if (showVertical) {
      const x = Math.abs(Math.sin(progress * Math.PI * 2)) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    // Horizontal line - bounces top to bottom
    if (showHorizontal) {
      const y = Math.abs(Math.sin(progress * Math.PI * 2)) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    // Rotating line - spins in center
    if (showRotating) {
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.4;
      const angle = progress * Math.PI * 2;
      
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(
        centerX + Math.cos(angle) * radius,
        centerY + Math.sin(angle) * radius
      );
      ctx.stroke();
    }
  }, [showVertical, showHorizontal, showRotating, lineThickness, lineOpacity]);

  // Handle file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setProcessedVideoUrl(null);
      setProcessing(prev => ({ ...prev, progress: 0, processedFrames: 0 }));
    }
  }, []);

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  // Preview animation loop
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !videoUrl) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderFrame = () => {
      if (video.videoWidth && video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const progress = video.currentTime / (video.duration || 1);
        drawLines(ctx, canvas.width, canvas.height, progress);
      }
      
      if (!video.paused && !video.ended) {
        animationRef.current = requestAnimationFrame(renderFrame);
      }
    };

    const handlePlay = () => {
      animationRef.current = requestAnimationFrame(renderFrame);
    };

    video.addEventListener('play', handlePlay);
    return () => {
      video.removeEventListener('play', handlePlay);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [videoUrl, drawLines]);

  // Process video at normal speed to preserve timing and audio
  const processVideo = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !videoUrl) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Get video info
    const duration = video.duration;
    const fps = 30; // Target FPS
    
    setProcessing({
      isProcessing: true,
      progress: 0,
      fps: 0,
      processedFrames: 0,
      totalFrames: Math.ceil(duration),
      estimatedTimeRemaining: Math.ceil(duration),
    });

    // Create a stream from canvas (video only)
    const canvasStream = canvas.captureStream(fps);
    
    // Create an audio element to capture audio
    const audioElement = new Audio(videoUrl);
    audioElement.crossOrigin = 'anonymous';
    audioElementRef.current = audioElement;
    
    // Wait for audio to be ready
    await new Promise<void>((resolve, reject) => {
      audioElement.oncanplaythrough = () => resolve();
      audioElement.onerror = () => reject();
      // Timeout fallback
      setTimeout(resolve, 1000);
    });
    
    // Create audio context and connect audio
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    audioContextRef.current = audioContext;
    const audioSource = audioContext.createMediaElementSource(audioElement);
    const audioDestination = audioContext.createMediaStreamDestination();
    audioSource.connect(audioDestination);
    // Don't connect to destination to avoid double audio (we'll hear it through the video preview)
    
    // Combine canvas video stream with audio stream
    const combinedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioDestination.stream.getAudioTracks()
    ]);
    streamRef.current = combinedStream;
    
    // Setup MediaRecorder with optimal settings
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : 'video/webm';
    
    const mediaRecorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: 8000000, // 8 Mbps for good quality
      audioBitsPerSecond: 128000,  // 128 kbps for audio
    });
    
    mediaRecorderRef.current = mediaRecorder;
    recordedChunksRef.current = [];
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setProcessedVideoUrl(url);
      setProcessing(prev => ({ ...prev, isProcessing: false, progress: 100 }));
      // Clean up audio context
      audioContext.close();
    };

    // Create a temporary video element for processing (muted, for frames only)
    const tempVideo = document.createElement('video');
    tempVideo.src = videoUrl;
    tempVideo.muted = true;
    tempVideo.playsInline = true;
    tempVideo.playbackRate = 1; // Normal speed
    
    await new Promise<void>((resolve) => {
      tempVideo.onloadedmetadata = () => resolve();
    });

    // Start recording
    mediaRecorder.start(100);
    
    // Start both video and audio playback simultaneously
    await Promise.all([
      tempVideo.play(),
      audioElement.play()
    ]);
    
    const startTime = performance.now();
    
    // Animation loop to draw frames at video's natural pace
    const renderFrame = () => {
      if (!tempVideo.paused && !tempVideo.ended) {
        // Draw the current video frame
        ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
        
        // Draw overlay lines based on current progress
        const progress = tempVideo.currentTime / (tempVideo.duration || 1);
        drawLines(ctx, canvas.width, canvas.height, progress);
        
        // Update progress
        const elapsed = (performance.now() - startTime) / 1000;
        const remaining = Math.max(0, duration - tempVideo.currentTime);
        
        setProcessing({
          isProcessing: true,
          progress: (tempVideo.currentTime / duration) * 100,
          fps: Math.round((tempVideo.currentTime / elapsed) * 10) / 10,
          processedFrames: Math.floor(tempVideo.currentTime * fps),
          totalFrames: Math.ceil(duration),
          estimatedTimeRemaining: Math.round(remaining),
        });
        
        animationRef.current = requestAnimationFrame(renderFrame);
      } else if (tempVideo.ended) {
        // Video finished, stop recording
        mediaRecorder.stop();
        tempVideo.remove();
        
        // Stop audio
        audioElement.pause();
        audioElementRef.current = null;
        
        // Close audio context
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      }
    };
    
    // Start the render loop
    animationRef.current = requestAnimationFrame(renderFrame);
  }, [videoUrl, drawLines]);

  // Cancel processing
  const cancelProcessing = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    // Stop audio
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
    }
    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setProcessing(prev => ({ ...prev, isProcessing: false }));
  }, []);

  // Format time remaining
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent mb-2">
            Video Pixel Shifter Pro
          </h1>
          <p className="text-slate-400">Add animated lines to make videos unique — Now with faster processing!</p>
        </header>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Video Preview */}
          <Card className="lg:col-span-2 bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Video className="w-5 h-5 text-cyan-400" />
                Video Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!videoUrl ? (
                <label className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-cyan-400 transition-colors">
                  <Upload className="w-12 h-12 text-slate-400 mb-4" />
                  <span className="text-slate-300 font-medium">Upload your video</span>
                  <span className="text-slate-500 text-sm mt-1">Drag & drop or click to browse</span>
                  <span className="text-slate-600 text-xs mt-2">Supports MP4, WebM, MOV</span>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="relative">
                  <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      className="absolute inset-0 w-full h-full object-contain"
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={() => setIsPlaying(false)}
                      playsInline
                    />
                    <canvas
                      ref={canvasRef}
                      className="absolute inset-0 w-full h-full pointer-events-none"
                    />
                  </div>
                  
                  {/* Playback controls */}
                  <div className="flex items-center justify-center gap-4 mt-4">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={togglePlay}
                      disabled={processing.isProcessing}
                      className="border-slate-600 hover:bg-slate-700"
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </Button>
                    
                    {!processing.isProcessing && !processedVideoUrl && (
                      <Button
                        onClick={processVideo}
                        className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Process Video
                      </Button>
                    )}
                    
                    {processing.isProcessing && (
                      <Button
                        variant="destructive"
                        onClick={cancelProcessing}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Processing Progress */}
              {processing.isProcessing && (
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">Processing video...</span>
                    <span className="text-cyan-400 font-mono">{processing.progress.toFixed(1)}%</span>
                  </div>
                  <Progress value={processing.progress} className="h-2" />
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Frames: {processing.processedFrames} / {processing.totalFrames}</span>
                    <span>Speed: {processing.fps} fps</span>
                    <span>ETA: {formatTime(processing.estimatedTimeRemaining)}</span>
                  </div>
                </div>
              )}

              {/* Download section */}
              {processedVideoUrl && !processing.isProcessing && (
                <Alert className="mt-6 bg-green-900/30 border-green-700">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <AlertDescription className="flex items-center justify-between">
                    <span className="text-green-200">Video processed successfully!</span>
                    <a
                      href={processedVideoUrl}
                      download="processed-video.webm"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md text-white text-sm font-medium transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </a>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Controls */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Settings className="w-5 h-5 text-cyan-400" />
                Line Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Line toggles */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-slate-200">Vertical Line</Label>
                    <p className="text-xs text-slate-500">Bounces left ↔ right</p>
                  </div>
                  <Switch
                    checked={showVertical}
                    onCheckedChange={setShowVertical}
                    disabled={processing.isProcessing}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-slate-200">Horizontal Line</Label>
                    <p className="text-xs text-slate-500">Bounces top ↔ bottom</p>
                  </div>
                  <Switch
                    checked={showHorizontal}
                    onCheckedChange={setShowHorizontal}
                    disabled={processing.isProcessing}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-slate-200">Rotating Line</Label>
                    <p className="text-xs text-slate-500">Spins in center clockwise</p>
                  </div>
                  <Switch
                    checked={showRotating}
                    onCheckedChange={setShowRotating}
                    disabled={processing.isProcessing}
                  />
                </div>
              </div>

              <div className="h-px bg-slate-700" />

              {/* Sliders */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-200">Line Thickness</Label>
                    <span className="text-sm text-slate-400 font-mono">{lineThickness}px</span>
                  </div>
                  <Slider
                    value={[lineThickness]}
                    onValueChange={([v]) => setLineThickness(v)}
                    min={1}
                    max={10}
                    step={1}
                    disabled={processing.isProcessing}
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-200">Line Opacity</Label>
                    <span className="text-sm text-slate-400 font-mono">{lineOpacity}%</span>
                  </div>
                  <Slider
                    value={[lineOpacity]}
                    onValueChange={([v]) => setLineOpacity(v)}
                    min={10}
                    max={100}
                    step={5}
                    disabled={processing.isProcessing}
                  />
                </div>
              </div>

              {/* Info */}
              <div className="p-4 bg-slate-900/50 rounded-lg">
                <p className="text-xs text-slate-400">
                  The animated lines move based on video duration:
                </p>
                <ul className="text-xs text-slate-500 mt-2 space-y-1">
                  <li>• Vertical: Bounces left ↔ right</li>
                  <li>• Horizontal: Bounces top ↔ bottom</li>
                  <li>• Rotating: 360° clockwise</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <footer className="text-center mt-8 text-slate-500 text-sm">
          <a 
            href="https://www.kimi.com/agent" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-cyan-400 transition-colors"
          >
            Kimi Agent
          </a>
        </footer>
      </div>
    </div>
  );
}
