 import { useState, useCallback, useEffect } from 'react';
 
 export type FullscreenMode = 'normal' | 'fullscreen' | 'kiosk';
 
 export function useFullscreen() {
   const [mode, setMode] = useState<FullscreenMode>('normal');
 
   const isFullscreen = mode !== 'normal';
   const isKiosk = mode === 'kiosk';
 
   const toggleFullscreen = useCallback((kioskMode = false) => {
     setMode(prev => {
       if (prev === 'normal') {
         return kioskMode ? 'kiosk' : 'fullscreen';
       }
       return 'normal';
     });
   }, []);
 
   const enterKiosk = useCallback(() => {
     setMode('kiosk');
   }, []);
 
   const enterFullscreen = useCallback(() => {
     setMode('fullscreen');
   }, []);
 
   const exitFullscreen = useCallback(() => {
     setMode('normal');
   }, []);
 
   // Handle Escape key to exit fullscreen
   useEffect(() => {
     const handleKeyDown = (e: KeyboardEvent) => {
       if (e.key === 'Escape' && mode !== 'normal') {
         setMode('normal');
       }
     };
 
     window.addEventListener('keydown', handleKeyDown);
     return () => window.removeEventListener('keydown', handleKeyDown);
   }, [mode]);
 
   return { 
     mode,
     isFullscreen, 
     isKiosk,
     toggleFullscreen, 
     enterKiosk,
     enterFullscreen,
     exitFullscreen 
   };
 }