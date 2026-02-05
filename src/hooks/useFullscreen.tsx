 import { useState, useCallback, useEffect } from 'react';
 
 export function useFullscreen() {
   const [isFullscreen, setIsFullscreen] = useState(false);
 
   const toggleFullscreen = useCallback(() => {
     setIsFullscreen(prev => !prev);
   }, []);
 
   const exitFullscreen = useCallback(() => {
     setIsFullscreen(false);
   }, []);
 
   // Handle Escape key to exit fullscreen
   useEffect(() => {
     const handleKeyDown = (e: KeyboardEvent) => {
       if (e.key === 'Escape' && isFullscreen) {
         setIsFullscreen(false);
       }
     };
 
     window.addEventListener('keydown', handleKeyDown);
     return () => window.removeEventListener('keydown', handleKeyDown);
   }, [isFullscreen]);
 
   return { isFullscreen, toggleFullscreen, exitFullscreen };
 }