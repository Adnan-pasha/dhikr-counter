import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Compass, MapPin, Sparkles, Navigation, Info, HelpCircle, 
  Search, Globe, ChevronDown, Check, X, Bell, BellOff, 
  Play, Pause, Volume2, VolumeX, Clock, Sliders, Calendar, AlertCircle
} from 'lucide-react';
import { Coordinates, CalculationMethod, PrayerTimes, Madhab } from 'adhan';
import { AppTheme } from '../types';
import { safeParseJSON, sanitizeAzanSettings } from '../domain';

interface QiblaScreenProps {
  theme: AppTheme;
}

interface CityPreset {
  name: string;
  lat: number;
  lng: number;
  direction: number; // precalculated bearing
  timezone?: string; // Target IANA Timezone string for offset matching
}

const RAW_CITY_PRESETS = [
  { name: 'Mecca (Haram), Saudi Arabia', lat: 21.4225, lng: 39.8262, timezone: 'Asia/Riyadh' },
  { name: 'Medina, Saudi Arabia', lat: 24.4672, lng: 39.6111, timezone: 'Asia/Riyadh' },
  { name: 'Riyadh, Saudi Arabia', lat: 24.7136, lng: 46.6753, timezone: 'Asia/Riyadh' },
  { name: 'London, United Kingdom', lat: 51.5074, lng: -0.1278, timezone: 'Europe/London' },
  { name: 'New York, United States', lat: 40.7128, lng: -74.0060, timezone: 'America/New_York' },
  { name: 'Jakarta, Indonesia', lat: -6.2088, lng: 106.8456, timezone: 'Asia/Jakarta' },
  { name: 'Kuala Lumpur, Malaysia', lat: 3.1390, lng: 101.6869, timezone: 'Asia/Kuala_Lumpur' },
  { name: 'Cairo, Egypt', lat: 30.0444, lng: 31.2357, timezone: 'Africa/Cairo' },
  { name: 'Istanbul, Turkey', lat: 41.0082, lng: 28.9784, timezone: 'Europe/Istanbul' },
  { name: 'Singapore, Singapore', lat: 1.3521, lng: 103.8198, timezone: 'Asia/Singapore' },
  { name: 'Dubai, United Arab Emirates', lat: 25.2048, lng: 55.2708, timezone: 'Asia/Dubai' },
  { name: 'Sydney, Australia', lat: -33.8688, lng: 151.2093, timezone: 'Australia/Sydney' },
  { name: 'Mumbai, India', lat: 19.0760, lng: 72.8777, timezone: 'Asia/Kolkata' },
  { name: 'Karachi, Pakistan', lat: 24.8607, lng: 67.0011, timezone: 'Asia/Karachi' },
  { name: 'Dhaka, Bangladesh', lat: 23.8103, lng: 90.4125, timezone: 'Asia/Dhaka' },
  { name: 'Sarajevo, Bosnia & Herzegovina', lat: 43.8563, lng: 18.4131, timezone: 'Europe/Sarajevo' },
  { name: 'Casablanca, Morocco', lat: 33.5731, lng: -7.5898, timezone: 'Africa/Casablanca' },
  { name: 'Cape Town, South Africa', lat: -33.9249, lng: 18.4241, timezone: 'Africa/Johannesburg' },
  { name: 'Baghdad, Iraq', lat: 33.3152, lng: 44.3661, timezone: 'Asia/Baghdad' },
  { name: 'Tehran, Iran', lat: 35.6892, lng: 51.3890, timezone: 'Asia/Tehran' },
  { name: 'Samarkand, Uzbekistan', lat: 39.6542, lng: 66.9597, timezone: 'Asia/Samarkand' },
  { name: 'Toronto, Canada', lat: 43.6532, lng: -79.3832, timezone: 'America/Toronto' },
  { name: 'Paris, France', lat: 48.8566, lng: 2.3522, timezone: 'Europe/Paris' },
  { name: 'Chicago, United States', lat: 41.8781, lng: -87.6298, timezone: 'America/Chicago' },
  { name: 'Los Angeles, United States', lat: 34.0522, lng: -118.2437, timezone: 'America/Los_Angeles' },
  { name: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503, timezone: 'Asia/Tokyo' },
  { name: 'Tashkent, Uzbekistan', lat: 41.2995, lng: 69.2401, timezone: 'Asia/Tashkent' },
  { name: 'Berlin, Germany', lat: 52.5200, lng: 13.4050, timezone: 'Europe/Berlin' },
  { name: 'Moscow, Russia', lat: 55.7558, lng: 37.6173, timezone: 'Europe/Moscow' },
  { name: 'Jerusalem, Palestine', lat: 31.7683, lng: 35.2137, timezone: 'Asia/Gaza' },
  { name: 'Amman, Jordan', lat: 31.9522, lng: 35.9106, timezone: 'Asia/Amman' },
  { name: 'Damascus, Syria', lat: 33.5138, lng: 36.2765, timezone: 'Asia/Damascus' },
  { name: 'Seville, Spain', lat: 37.3891, lng: -5.9845, timezone: 'Europe/Madrid' },
  { name: 'Prague, Czech Republic', lat: 50.0755, lng: 14.4378, timezone: 'Europe/Prague' },
  { name: 'Reykjavik, Iceland', lat: 64.1466, lng: -21.9426, timezone: 'Atlantic/Reykjavik' },
  { name: 'Lagos, Nigeria', lat: 6.5244, lng: 3.3792, timezone: 'Africa/Lagos' },
  { name: 'Bucharest, Romania', lat: 44.4268, lng: 26.1025, timezone: 'Europe/Bucharest' },
];

const calculateQiblaStatic = (lat: number, lng: number) => {
  const meccaLat = 21.4225 * Math.PI / 180;
  const meccaLng = 39.8262 * Math.PI / 180;
  const uLat = lat * Math.PI / 180;
  const uLng = lng * Math.PI / 180;

  const dLng = meccaLng - uLng;
  const y = Math.sin(dLng);
  const x = Math.cos(uLat) * Math.tan(meccaLat) - Math.sin(uLat) * Math.cos(dLng);
  
  let bearing = Math.atan2(y, x);
  let bearingDeg = (bearing * 180 / Math.PI + 360) % 360;
  return Math.round(bearingDeg);
};

// Major cities worldwide and their calculated bearing direction towards Kaaba
const CITY_PRESETS: CityPreset[] = RAW_CITY_PRESETS.map(city => ({
  ...city,
  direction: calculateQiblaStatic(city.lat, city.lng)
}));

export default function QiblaScreen({ theme }: QiblaScreenProps) {
  // Navigation sub-tab inside Qibla Finder: Compass vs. PrayTimes
  const [subTab, setSubTab] = useState<'qibla' | 'namaz'>('qibla');

  // Coordinates and global timezone references
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [qiblaAngle, setQiblaAngle] = useState<number>(119); // Default to London's direction
  const [locationName, setLocationName] = useState<string>('London, United Kingdom');
  const [locationTimezone, setLocationTimezone] = useState<string>('Europe/London');
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isUnsecureContext, setIsUnsecureContext] = useState<boolean>(false);
  
  // Fiqh & Calculation Methods
  const [fiqh, setFiqh] = useState<'Hanafi' | 'Shafi'>('Hanafi'); // Defaults to Hanafi!
  const [calcMethod, setCalcMethod] = useState<'Karachi' | 'MWL' | 'UmmAlQura' | 'ISNA' | 'Egypt'>('Karachi');

  // Search state & dropdown autocompletion states
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Azan Alarm & Audio system state with reliable fallback CDN mirrors
  // Use globally accelerated, CORS & Range-header compatible jsDelivr CDN mirrors first
  // to guarantee instant mobile and desktop playback with no browser security errors.
  const MECCA_AZAN_URLS = [
    'https://cdn.jsdelivr.net/gh/farafarizul/myazan@master/assets/audio/azan2.mp3',
    'https://cdn.jsdelivr.net/gh/farafarizul/myazan@master/assets/audio/azan5.mp3',
    'https://cdn.jsdelivr.net/gh/farafarizul/myazan@master/assets/audio/azan4.mp3',
    'https://raw.githubusercontent.com/farafarizul/myazan/master/assets/audio/azan2.mp3',
    'https://www.islamcan.com/audio/adhan/mecca.mp3',
    'https://archive.org/download/AdhanMakkah/Adhan-Makkah.mp3',
    // Hot backup pool: if Mecca mirrors are blocked on a region/network, fall back
    // to the same CDN family used by Medina so users still hear a real adhan stream.
    'https://cdn.jsdelivr.net/gh/farafarizul/myazan@master/assets/audio/azan3.mp3',
    'https://raw.githubusercontent.com/farafarizul/myazan/master/assets/audio/azan3.mp3',
    'https://www.islamcan.com/audio/adhan/azan1.mp3',
    'https://archive.org/download/AdhanMedina/Adhan-Medina.mp3'
  ];
  const MEDINA_AZAN_URLS = [
    'https://cdn.jsdelivr.net/gh/farafarizul/myazan@master/assets/audio/azan3.mp3',
    'https://cdn.jsdelivr.net/gh/farafarizul/myazan@master/assets/audio/subuh.mp3',
    'https://cdn.jsdelivr.net/gh/farafarizul/myazan@master/assets/audio/azan1.mp3',
    'https://raw.githubusercontent.com/farafarizul/myazan/master/assets/audio/azan3.mp3',
    'https://www.islamcan.com/audio/adhan/azan1.mp3',
    'https://archive.org/download/AdhanMedina/Adhan-Medina.mp3'
  ];
  
  const [selectedAzanSound, setSelectedAzanSound] = useState<'mecca' | 'medina'>('mecca');
  const [activeAudio, setActiveAudio] = useState<HTMLAudioElement | null>(null);
  const [syntheticCtx, setSyntheticCtx] = useState<any>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const [playingAlarmName, setPlayingAlarmName] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [currentUrlTrying, setCurrentUrlTrying] = useState<string | null>(null);
  
  const [azanSettings, setAzanSettings] = useState<Record<string, boolean>>(() => {
    return sanitizeAzanSettings(safeParseJSON(localStorage.getItem('tasbih_azan_settings'), null));
  });

  const handleToggleAzanSetting = (id: string) => {
    const updated = { ...azanSettings, [id]: !azanSettings[id] };
    setAzanSettings(updated);
    localStorage.setItem('tasbih_azan_settings', JSON.stringify(updated));
  };

  // Peaceful synthesized chimes fallback for offline / blocked environments
  const playSyntheticChime = (alarmLabel: string) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('AudioContext not supported');
      }
      const ctx = new AudioContextClass();
      setSyntheticCtx(ctx);
      setPlayingAlarmName(`${alarmLabel} (Backup Chime)`);
      setIsAudioPlaying(true);
      setLoadingAudio(false);
      setAudioError('All broadcast servers are currently slow or blocked. Loaded local peaceful Backup Chimes instead.');
      setCurrentUrlTrying('peaceful-chime-generator');

      const now = ctx.currentTime;
      
      const playTone = (freq: number, start: number, duration: number, vol: number = 0.2) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(vol, start + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freq * 1.5, start);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(start);
        osc.stop(start + duration);
      };

      // Peaceful and harmonic chord progression (Makkah sunrise style)
      // Chime Arpeggio 1 (F3 Major Pentatonic)
      playTone(174.61, now, 5.0, 0.35);       // F3
      playTone(261.63, now + 0.2, 4.8, 0.25); // C4
      playTone(349.23, now + 0.4, 4.6, 0.25); // F4
      playTone(440.00, now + 0.6, 4.4, 0.2);  // A4
      playTone(523.25, now + 0.8, 4.2, 0.15); // C5
      
      // Chime Arpeggio 2 (Turnaround chords)
      playTone(196.00, now + 2.0, 4.5, 0.35); // G3
      playTone(293.66, now + 2.2, 4.3, 0.25); // D4
      playTone(392.00, now + 2.4, 4.1, 0.2);  // G4
      playTone(440.00, now + 2.6, 3.9, 0.2);  // A4
      playTone(587.33, now + 2.8, 3.7, 0.1);  // D5

      // Chime Arpeggio 3 (Deep resolution)
      playTone(174.61, now + 4.0, 6.0, 0.35); // F3
      playTone(261.63, now + 4.2, 5.8, 0.25); // C4
      playTone(349.23, now + 4.4, 5.6, 0.25); // F4
      playTone(523.25, now + 4.6, 5.4, 0.2);  // C5
      playTone(698.46, now + 4.8, 5.2, 0.15); // F5

    } catch (err) {
      console.error('Synthetic chime failed', err);
      setIsAudioPlaying(false);
      setPlayingAlarmName(null);
      setAudioError('Failed to play sound. Please confirm browser sound permission is authorized.');
    }
  };

  // Play test or current Azan audio safely with automatic progressive mirror fallbacks
  const playAzan = (urls: string[], alarmLabel: string) => {
    if (activeAudio) {
      activeAudio.pause();
    }
    if (syntheticCtx && syntheticCtx.state !== 'closed') {
      try {
        syntheticCtx.close().catch(() => {});
      } catch {}
      setSyntheticCtx(null);
    }
    
    setPlayingAlarmName(alarmLabel);
    setIsAudioPlaying(true);
    setLoadingAudio(true);
    setAudioError(null);

    const playWithIndex = (index: number) => {
      // If we depleted all streams, instead of showing a static error and playing silence, 
      // trigger the offline synthesized chime fallback. It sounds beautiful, peaceful and guarantees audio alerts are raised.
      if (index >= urls.length) {
        console.warn('[Adhan Player] All network broadcast routes offline. Triggering offline synthesized chime fallback...');
        playSyntheticChime(alarmLabel);
        return;
      }

      const activeUrl = urls[index];
      setCurrentUrlTrying(activeUrl);
      console.log(`[Adhan Player] Attempting broadcast route #${index + 1}: ${activeUrl}`);

      const audio = new Audio(activeUrl);
      audio.volume = 0.8;
      audio.preload = 'auto';
      setActiveAudio(audio);

      let isCleanedUp = false;
      let timeoutId: any = null;

      const cleanupAndPause = () => {
        if (isCleanedUp) return;
        isCleanedUp = true;
        if (timeoutId) clearTimeout(timeoutId);
        audio.oncanplaythrough = null;
        audio.onplay = null;
        audio.onended = null;
        audio.onerror = null;
        try {
          audio.pause();
        } catch (e) {
          console.error(e);
        }
      };

      // 8-second timeout for first-line raw github raw paths; 6-second timeout for auxiliary mirrors
      const timeoutLimit = index < 2 ? 8000 : 6000;
      timeoutId = setTimeout(() => {
        if (isCleanedUp) return;
        console.warn(`[Adhan Player] Broadcast route #${index + 1} takes too long. Trying backup server...`);
        cleanupAndPause();
        playWithIndex(index + 1);
      }, timeoutLimit);

      audio.oncanplaythrough = () => {
        if (isCleanedUp) return;
        clearTimeout(timeoutId);
        setLoadingAudio(false);
        setAudioError(null);
      };

      audio.onplay = () => {
        if (isCleanedUp) return;
        clearTimeout(timeoutId);
        setLoadingAudio(false);
        setAudioError(null);
      };

      audio.play().then(() => {
        if (isCleanedUp) return;
        clearTimeout(timeoutId);
        setLoadingAudio(false);
        setAudioError(null);
      }).catch(err => {
        if (isCleanedUp) return;
        console.warn(`[Adhan Player] Playback failed for route #${index + 1}:`, err);
        if (err.name === 'NotAllowedError') {
          cleanupAndPause();
          setIsAudioPlaying(false);
          setPlayingAlarmName(null);
          setActiveAudio(null);
          setLoadingAudio(false);
          setAudioError('Playback blocked by browser autoplay policy. Please touch/click the screen to allow audio.');
        } else {
          cleanupAndPause();
          playWithIndex(index + 1);
        }
      });

      audio.onended = () => {
        cleanupAndPause();
        setIsAudioPlaying(false);
        setPlayingAlarmName(null);
        setActiveAudio(null);
        setLoadingAudio(false);
        setCurrentUrlTrying(null);
      };

      audio.onerror = () => {
        if (isCleanedUp) return;
        console.warn(`[Adhan Player] Error loading route #${index + 1}. Transitioning to secondary mirror...`);
        cleanupAndPause();
        playWithIndex(index + 1);
      };
    };

    playWithIndex(0);
  };

  const stopAzan = () => {
    if (activeAudio) {
      activeAudio.pause();
    }
    if (syntheticCtx && syntheticCtx.state !== 'closed') {
      try {
        syntheticCtx.close().catch(() => {});
      } catch (e) {
        console.error(e);
      }
      setSyntheticCtx(null);
    }
    setIsAudioPlaying(false);
    setPlayingAlarmName(null);
    setActiveAudio(null);
  };

  // Clean up playing audio on screen exit
  useEffect(() => {
    return () => {
      if (activeAudio) {
        activeAudio.pause();
      }
      if (syntheticCtx && syntheticCtx.state !== 'closed') {
        try {
          syntheticCtx.close().catch(() => {});
        } catch {}
      }
    };
  }, [activeAudio, syntheticCtx]);

  // Click outside listener to collapse search results dynamically
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);
  
  // Simulated compass alignment rotation (for testing and manual alignment)
  // Users can drag or use sliders to rotate their direction to orient towards Mecca
  const [heading, setHeading] = useState<number>(0); // 0 = facing north
  const [isLiveSensors, setIsLiveSensors] = useState<boolean>(false);
  const [iosNeedsPermission, setIosNeedsPermission] = useState<boolean>(false);
  
  const targetHeading = useRef<number>(0);
  const currentHeading = useRef<number>(0);

  // Smooth lerp updating loop using requestAnimationFrame (Shortest angular path interpolation)
  useEffect(() => {
    let animId: number;
    const update = () => {
      const target = targetHeading.current;
      const current = currentHeading.current;
      
      let diff = target - current;
      while (diff < -180) diff += 360;
      while (diff > 180) diff -= 360;
      
      if (Math.abs(diff) < 0.05) {
        if (current !== target) {
          currentHeading.current = target;
          setHeading(target);
        }
      } else {
        // Highly reactive but buttery-smooth physics damping (0.12 coefficient is ideal)
        const next = (current + diff * 0.12 + 360) % 360;
        currentHeading.current = next;
        setHeading(next);
      }
      animId = requestAnimationFrame(update);
    };
    
    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, []);

  const dialRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartAngle = useRef<number>(0);
  const startHeading = useRef<number>(0);

  // Bearing calculation engine
  const calculateQibla = (lat: number, lng: number) => {
    const meccaLat = 21.4225 * Math.PI / 180;
    const meccaLng = 39.8262 * Math.PI / 180;
    const uLat = lat * Math.PI / 180;
    const uLng = lng * Math.PI / 180;

    const dLng = meccaLng - uLng;
    const y = Math.sin(dLng);
    const x = Math.cos(uLat) * Math.tan(meccaLat) - Math.sin(uLat) * Math.cos(dLng);
    
    let bearing = Math.atan2(y, x);
    let bearingDeg = (bearing * 180 / Math.PI + 360) % 360;
    return Math.round(bearingDeg);
  };

  // Live Location Fetcher via GPS
  const requestGPSLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCoords({ lat: latitude, lng: longitude });
        
        const angle = calculateQibla(latitude, longitude);
        setQiblaAngle(angle);
        setLocationName(`My Compass (${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°)`);
        
        // Reset timezone to browser's standard live local zone
        try {
          const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          setLocationTimezone(userTz || 'Europe/London');
        } catch (e) {
          setLocationTimezone('Europe/London');
        }
        
        setGpsLoading(false);
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setGpsError(
          err.code === 1 
            ? 'Permission denied. Please grant GPS access in your browser or select a city below.'
            : 'Unstable location signal. Please select a traditional city below.'
        );
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Auto trigger GPS on load
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setIsUnsecureContext(true);
    }
    requestGPSLocation();
  }, []);

  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);

  // Check if iOS permissions are required for compass
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.DeviceOrientationEvent &&
      typeof (window.DeviceOrientationEvent as any).requestPermission === 'function'
    ) {
      setIosNeedsPermission(true);
      setPermissionGranted(false);
    } else {
      setIosNeedsPermission(false);
      setPermissionGranted(true);
    }
  }, []);

  // Request Compass sensor permission for iOS
  const requestCompassPermission = async () => {
    try {
      const DeviceOrientationEventAny = DeviceOrientationEvent as any;
      if (typeof DeviceOrientationEventAny.requestPermission === 'function') {
        const response = await DeviceOrientationEventAny.requestPermission();
        if (response === 'granted') {
          setIosNeedsPermission(false);
          setPermissionGranted(true);
          setIsLiveSensors(true);
        } else {
          setGpsError('Compass orientation permission was denied.');
        }
      }
    } catch (e) {
      console.error('Compass activation failed:', e);
      setGpsError('Compass sensor calibration requires a secure context or user permission.');
    }
  };

  // Connect Device Orientation Compass Sensors (iOS, Android, & browser fallbacks)
  useEffect(() => {
    if (!permissionGranted) return;

    let absoluteActive = false;

    const handleAbsoluteOrientation = (e: Event) => {
      const de = e as DeviceOrientationEvent;
      if (de.alpha !== null) {
        // Alignment relative to absolute Magnetic North on Android/Chrome
        targetHeading.current = 360 - de.alpha;
        setIsLiveSensors(true);
        absoluteActive = true;
      }
    };

    const handleStandardOrientation = (e: DeviceOrientationEvent) => {
      // iOS specific webkitCompassHeading
      if ('webkitCompassHeading' in e) {
        targetHeading.current = e.webkitCompassHeading as number;
        setIsLiveSensors(true);
      } else if (!absoluteActive && e.alpha !== null) {
        // Fallback for Android/General if the absolute event didn't trigger
        targetHeading.current = 360 - e.alpha;
        setIsLiveSensors(true);
      }
    };

    window.addEventListener('deviceorientationabsolute', handleAbsoluteOrientation);
    window.addEventListener('deviceorientation', handleStandardOrientation);

    return () => {
      window.removeEventListener('deviceorientationabsolute', handleAbsoluteOrientation);
      window.removeEventListener('deviceorientation', handleStandardOrientation);
    };
  }, [permissionGranted]);

  // When city preset selected
  const handleSelectCity = (city: CityPreset) => {
    setCoords({ lat: city.lat, lng: city.lng });
    setQiblaAngle(city.direction);
    setLocationName(city.name);
    setLocationTimezone(city.timezone || 'Europe/London');
    setGpsError(null);
  };

  // Angle math helper to check if aligned (within 4 degrees)
  const relativeQiblaAngle = (qiblaAngle - heading + 360) % 360;
  const isAligned = relativeQiblaAngle <= 4 || relativeQiblaAngle >= 356;

  // Manual Drag Rotation logic for seamless offline desktop simulation
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isLiveSensors) return; // ignore manual dial drag if GPS compass is active
    if (!dialRef.current) return;
    setIsDragging(true);

    const rect = dialRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const clientX = e.touches[0].clientX;
    const clientY = e.touches[0].clientY;

    const startAngle = Math.atan2(clientY - centerY, clientX - centerX) * 180 / Math.PI;
    dragStartAngle.current = startAngle;
    startHeading.current = heading;
    targetHeading.current = heading;
    currentHeading.current = heading;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !dialRef.current) return;
    const rect = dialRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const clientX = e.touches[0].clientX;
    const clientY = e.touches[0].clientY;

    const currentAngle = Math.atan2(clientY - centerY, clientX - centerX) * 180 / Math.PI;
    const diff = currentAngle - dragStartAngle.current;
    
    // adjust heading by difference
    const val = (startHeading.current - diff + 360) % 360;
    targetHeading.current = val;
    currentHeading.current = val;
    setHeading(val);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isLiveSensors) return;
    if (!dialRef.current) return;
    setIsDragging(true);

    const rect = dialRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
    dragStartAngle.current = startAngle;
    startHeading.current = heading;
    targetHeading.current = heading;
    currentHeading.current = heading;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const currentAngle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX) * 180 / Math.PI;
      const diffAngle = currentAngle - dragStartAngle.current;
      const val = (startHeading.current - diffAngle + 360) % 360;
      targetHeading.current = val;
      currentHeading.current = val;
      setHeading(val);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // ==========================================
  // NAMAZ & AZAN TIME PRESET CALCULATION
  // ==========================================
  const activeLat = coords?.lat ?? 51.5074;
  const activeLng = coords?.lng ?? -0.1278;
  const activeTz = locationTimezone || 'Europe/London';

  const coordinates = new Coordinates(activeLat, activeLng);
  // Default computation date (today)
  const [calculationDate, setCalculationDate] = useState<Date>(new Date());

  const getParams = () => {
    switch (calcMethod) {
      case 'MWL':
        return CalculationMethod.MuslimWorldLeague();
      case 'UmmAlQura':
        return CalculationMethod.UmmAlQura();
      case 'ISNA':
        return CalculationMethod.NorthAmerica();
      case 'Egypt':
        return CalculationMethod.Egyptian();
      case 'Karachi':
      default:
        return CalculationMethod.Karachi();
    }
  };

  const params = getParams();
  params.madhab = fiqh === 'Hanafi' ? Madhab.Hanafi : Madhab.Shafi;

  // Primary calculation
  const prayerTimes = new PrayerTimes(coordinates, calculationDate, params);

  // Time Formatter relative to destination city's timezone offset
  const formatPrayerTime = (pDate: Date) => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: activeTz
      }).format(pDate);
    } catch {
      return new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(pDate);
    }
  };

  // Ordered list of daily prayer events
  const prayersList = [
    { id: 'fajr', label: 'Fajr', subtitle: 'Dawn', time: prayerTimes.fajr, isAzan: true },
    { id: 'sunrise', label: 'Sunrise', subtitle: 'Ishraq', time: prayerTimes.sunrise, isAzan: false },
    { id: 'dhuhr', label: 'Dhuhr', subtitle: 'Noon', time: prayerTimes.dhuhr, isAzan: true },
    { id: 'asr', label: 'Asr', subtitle: 'Afternoon', time: prayerTimes.asr, isAzan: true },
    { id: 'maghrib', label: 'Maghrib', subtitle: 'Sunset', time: prayerTimes.maghrib, isAzan: true },
    { id: 'isha', label: 'Isha', subtitle: 'Night', time: prayerTimes.isha, isAzan: true },
  ];

  // Resolve current active vs next prayer
  const now = new Date();
  let currentPrayerIndex = -1;
  for (let i = 0; i < prayersList.length; i++) {
    if (now >= prayersList[i].time) {
      currentPrayerIndex = i;
    }
  }

  const activePrayer = currentPrayerIndex !== -1 ? prayersList[currentPrayerIndex] : prayersList[prayersList.length - 1];
  const nextPrayerIndex = (currentPrayerIndex + 1) % prayersList.length;
  const nextPrayer = prayersList[nextPrayerIndex];

  const getTomorrowFajr = () => {
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowPrayerTimes = new PrayerTimes(coordinates, tomorrow, params);
    return tomorrowPrayerTimes.fajr;
  };

  const nextPrayerTime = (nextPrayerIndex === 0 && now > prayersList[prayersList.length - 1].time)
    ? getTomorrowFajr()
    : nextPrayer.time;

  // Countdown timer string (hours, minutes, seconds)
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  useEffect(() => {
    const updateCountdown = () => {
      const diffMs = nextPrayerTime.getTime() - new Date().getTime();
      if (diffMs <= 0) {
        setTimeRemaining('Refreshing...');
        return;
      }
      const hrs = Math.floor(diffMs / (3600 * 1000));
      const mins = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));
      const secs = Math.floor((diffMs % (60 * 1000)) / 1000);
      
      setTimeRemaining(
        `${hrs.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`
      );
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [nextPrayerTime]);

  // Destination City Ticking Local Clock
  const [localCityTime, setLocalCityTime] = useState<string>('');
  useEffect(() => {
    const updateLocalClock = () => {
      try {
        const str = new Intl.DateTimeFormat('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
          timeZone: activeTz
        }).format(new Date());
        setLocalCityTime(str);
      } catch {
        const str = new Intl.DateTimeFormat('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }).format(new Date());
        setLocalCityTime(str);
      }
    };
    updateLocalClock();
    const interval = setInterval(updateLocalClock, 1000);
    return () => clearInterval(interval);
  }, [activeTz]);

  // Minute-wise Background Auto Alarm Watcher (Plays sound if enabled and app open!)
  const lastAlarmTriggerTime = useRef<string>('');
  useEffect(() => {
    const watchForPrayerTimes = () => {
      const nowClock = new Date();
      const currentMinKey = `${nowClock.getFullYear()}-${nowClock.getMonth()}-${nowClock.getDate()} ${nowClock.getHours()}:${nowClock.getMinutes()}`;
      
      if (lastAlarmTriggerTime.current === currentMinKey) return;

      prayersList.forEach(p => {
        if (!p.isAzan) return; // ignore non-sounding events like Sunrise
        if (!azanSettings[p.id]) return; // muted

        const pt = p.time;
        if (
          nowClock.getHours() === pt.getHours() &&
          nowClock.getMinutes() === pt.getMinutes()
        ) {
          lastAlarmTriggerTime.current = currentMinKey;
          // Trigger Azan automatically!
          playAzan(selectedAzanSound === 'mecca' ? MECCA_AZAN_URLS : MEDINA_AZAN_URLS, `${p.label} Prayer`);
        }
      });
    };

    const interval = setInterval(watchForPrayerTimes, 30000); // scan twice a minute
    return () => clearInterval(interval);
  }, [prayerTimes, azanSettings, selectedAzanSound]);

  // Theme support mapper
  const getThemePalette = (currentTheme: AppTheme) => {
    switch (currentTheme) {
      case 'emerald':
        return {
          cardBg: 'bg-emerald-500/5',
          cardBorder: 'border-emerald-500/20',
          textAccent: 'text-emerald-400',
          badgeBg: 'bg-emerald-500/15',
          btnBg: 'bg-emerald-500 hover:bg-emerald-600',
          buttonBorder: 'border-emerald-500/30',
          lightGlow: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]',
          gradient: 'from-emerald-500/20 to-teal-500/10'
        };
      case 'amber':
        return {
          cardBg: 'bg-amber-500/5',
          cardBorder: 'border-amber-500/20',
          textAccent: 'text-amber-400',
          badgeBg: 'bg-amber-500/15',
          btnBg: 'bg-amber-500 hover:bg-amber-600',
          buttonBorder: 'border-amber-500/30',
          lightGlow: 'shadow-[0_0_20px_rgba(245,158,11,0.15)]',
          gradient: 'from-amber-500/20 to-yellow-500/10'
        };
      case 'indigo':
        return {
          cardBg: 'bg-indigo-500/5',
          cardBorder: 'border-indigo-500/20',
          textAccent: 'text-indigo-400',
          badgeBg: 'bg-indigo-500/15',
          btnBg: 'bg-indigo-500 hover:bg-indigo-600',
          buttonBorder: 'border-indigo-500/30',
          lightGlow: 'shadow-[0_0_20px_rgba(99,102,241,0.15)]',
          gradient: 'from-indigo-500/20 to-purple-500/10'
        };
      case 'midnight':
        return {
          cardBg: 'bg-blue-500/5',
          cardBorder: 'border-blue-500/20',
          textAccent: 'text-blue-400',
          badgeBg: 'bg-blue-500/15',
          btnBg: 'bg-blue-600 hover:bg-blue-700',
          buttonBorder: 'border-blue-500/30',
          lightGlow: 'shadow-[0_0_20px_rgba(37,99,235,0.15)]',
          gradient: 'from-blue-600/20 to-indigo-500/10'
        };
      case 'slate':
      default:
        return {
          cardBg: 'bg-slate-500/5',
          cardBorder: 'border-slate-800',
          textAccent: 'text-slate-350',
          badgeBg: 'bg-slate-800',
          btnBg: 'bg-slate-700 hover:bg-slate-600',
          buttonBorder: 'border-slate-700',
          lightGlow: 'shadow-lg',
          gradient: 'from-slate-800/20 to-slate-900/10'
        };
    }
  };

  const palette = getThemePalette(theme);

  return (
    <div id="qibla_finder_container" className="flex flex-col h-full bg-[#0f172a] text-slate-100 overflow-hidden">
      
      {/* Dynamic Azan Broadcast Alert Bar Banner */}
      <AnimatePresence>
        {isAudioPlaying && (
          <motion.div
            id="azan_broadcast_playing_alert"
            initial={{ opacity: 0, y: -45 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -45 }}
            className="bg-amber-500 text-slate-950 font-bold px-4 py-2 text-xs flex items-center justify-between gap-2.5 shadow-lg shrink-0 z-50 selection:bg-slate-900 selection:text-white"
          >
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-950"></span>
              </span>
              <p className="line-clamp-1">
                🕌 Now Broadcasting: <span className="font-extrabold">{playingAlarmName || 'Adhan'}</span> ({selectedAzanSound === 'mecca' ? 'Mecca Al-Haram' : 'Medina Al-Nabawi'})
              </p>
            </div>
            <button
              id="btn_dismiss_azan_alarm_banner"
              onClick={stopAzan}
              type="button"
              className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-900 text-amber-400 text-2xs uppercase tracking-wider font-extrabold cursor-pointer transition-colors shrink-0"
            >
              Stop
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Primary Container Header */}
      <div className="px-6 pt-5 pb-3 border-b border-slate-800/80 flex justify-between items-center bg-slate-900/50 backdrop-blur-md shrink-0">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-50 flex items-center gap-1.5 leading-none select-none">
            <Compass className="w-5 h-5 text-amber-500 animate-spin-slow" />
            Qibla & Namaz
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium select-none">Locate sacred direction & prayer timings</p>
        </div>
        <div className="flex items-center gap-1.5">
          {iosNeedsPermission && (
            <button
              id="btn_request_compass_permission"
              onClick={requestCompassPermission}
              className="px-2.5 py-1.5 rounded-full cursor-pointer bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-2xs font-bold text-amber-400 flex items-center gap-1 transition-all"
            >
              <Navigation className="w-3 h-3 text-amber-500" />
              Calibrate
            </button>
          )}
          <button
            id="btn_gps_location_request"
            onClick={requestGPSLocation}
            className={`px-3 py-1.5 rounded-full cursor-pointer bg-slate-800 hover:bg-slate-700 border border-slate-700 text-2xs font-bold text-amber-400 flex items-center gap-1 transition-all ${gpsLoading ? 'animate-pulse' : ''}`}
            disabled={gpsLoading}
          >
            <MapPin className="w-3.5 h-3.5" />
            {gpsLoading ? 'Locating...' : 'Use GPS'}
          </button>
        </div>
      </div>

      {/* Subtab Segmented Toggler */}
      <div id="qibla_subtab_segmented_control" className="px-6 py-2 bg-slate-900/10 border-b border-slate-850 shrink-0">
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-850">
          <button
            id="btn_subtab_qibla"
            type="button"
            onClick={() => setSubTab('qibla')}
            className={`flex-1 py-1.5 text-3xs font-black tracking-wider uppercase rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              subTab === 'qibla'
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-3 h-3" />
            Kaaba Compass
          </button>
          <button
            id="btn_subtab_namaz"
            type="button"
            onClick={() => setSubTab('namaz')}
            className={`flex-1 py-1.5 text-3xs font-black tracking-wider uppercase rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              subTab === 'namaz'
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="text-xs shrink-0 leading-none">🕌</span>
            Namaz & Azan
          </button>
        </div>
      </div>

      {/* SHARED LOCATION PRESET LOOKUP (Renders globally below header) */}
      <div className="px-6 pt-3 pb-1 shrink-0 bg-transparent z-45 relative">
        <div id="manual_city_search_wrapper" className="w-full relative" ref={dropdownRef}>
          <div className="relative">
            {/* Custom Dropdown Trigger Button */}
            <button
              id="city_dropdown_trigger_btn"
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full px-3 py-2 bg-slate-950/80 border border-slate-850 text-2xs font-bold text-slate-200 rounded-lg focus:outline-none focus:border-amber-500/60 flex items-center justify-between cursor-pointer transition-all hover:border-slate-800"
            >
              <div className="flex items-center gap-1.5 bg-transparent truncate">
                <Globe className="w-3 h-3 text-amber-500 shrink-0" />
                <span className="truncate">{locationName}</span>
              </div>
              <div className="flex items-center gap-1.5 ml-1 bg-transparent select-none shrink-0">
                <span className="text-[8px] font-black tracking-wider px-1 rounded-sm bg-slate-900 text-slate-400 border border-slate-800">
                  {qiblaAngle}° QIBLA
                </span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-300 ${dropdownOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {/* Float Dropdown Autocomplete Panel */}
            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  id="city_autocomplete_floating_panel"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.1 }}
                  className="absolute left-0 right-0 top-full mt-1.5 bg-slate-950 border border-slate-850 rounded-xl shadow-2xl z-50 p-2.5 flex flex-col gap-2 max-h-60 overflow-hidden"
                >
                  {/* Search input inside float panel */}
                  <div className="relative shrink-0">
                    <Search className="absolute left-2.5 top-2 w-3 h-3 text-slate-500" />
                    <input
                      id="city_search_text_input"
                      type="text"
                      autoFocus
                      placeholder="Search 35+ global directories..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-7 pr-7 py-1.5 bg-slate-900 border border-slate-850 text-2xs text-slate-100 rounded-lg focus:outline-none focus:border-amber-500/80 placeholder-slate-500 font-medium"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1.5 w-4 h-4 rounded-full flex items-center justify-center hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>

                  {/* Quick select chips row */}
                  {searchQuery === '' && (
                    <div className="flex flex-wrap gap-1 items-center pb-1 border-b border-slate-900 bg-transparent shrink-0">
                      {[
                        { name: 'Mecca 🕋', query: 'Mecca' },
                        { name: 'Medina 🕌', query: 'Medina' },
                        { name: 'London 🇬🇧', query: 'London' },
                        { name: 'Jakarta 🇮🇩', query: 'Jakarta' },
                        { name: 'Cairo 🇪🇬', query: 'Cairo' },
                      ].map((chip) => (
                        <button
                          key={chip.name}
                          type="button"
                          onClick={() => setSearchQuery(chip.query)}
                          className="px-1 py-0.5 rounded bg-slate-900 hover:bg-slate-850 border border-slate-800/80 text-[7px] font-black tracking-wide text-slate-400 cursor-pointer transition-colors"
                        >
                          {chip.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Scrollable listing of matches */}
                  <div className="flex-1 overflow-y-auto space-y-0.5 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                    {CITY_PRESETS.filter(city => 
                      city.name.toLowerCase().includes(searchQuery.toLowerCase())
                    ).length === 0 ? (
                      <div className="text-center py-4 text-slate-600 text-[9px] font-extrabold select-none">
                        No matches found for "{searchQuery}"
                      </div>
                    ) : (
                      CITY_PRESETS.filter(city => 
                        city.name.toLowerCase().includes(searchQuery.toLowerCase())
                      ).map((city) => {
                        const isSelected = locationName === city.name;
                        return (
                          <button
                            key={city.name}
                            type="button"
                            onClick={() => {
                              handleSelectCity(city);
                              setDropdownOpen(false);
                              setSearchQuery('');
                            }}
                            className={`w-full text-left px-2 py-1 rounded-md text-3xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500/10 border border-amber-500/20 text-amber-450 font-black shadow-sm'
                                : 'hover:bg-slate-900 border border-transparent text-slate-350 hover:text-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 bg-transparent truncate">
                              {isSelected ? (
                                <Check className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                              ) : (
                                <MapPin className="w-2.5 h-2.5 text-slate-700 shrink-0" />
                              )}
                              <span className="truncate">{city.name}</span>
                            </div>
                            <span className="text-[8px] text-slate-500 font-mono font-bold shrink-0 ml-1">
                              {city.direction}°
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* RENDER DUAL VIEWS */}
      {subTab === 'qibla' ? (
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col items-center justify-between gap-4">
          
          {/* Alignment Glow Announcement */}
          <div className="text-center w-full max-w-xs shrink-0 select-none">
            <AnimatePresence mode="wait">
              {isAligned ? (
                <motion.div
                  key="aligned"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full px-4 py-1.5 text-xs font-bold tracking-widest uppercase flex items-center justify-center gap-1.5 mx-auto shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  Qibla Aligned
                </motion.div>
              ) : (
                <motion.div
                  key="not-aligned"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-slate-900/40 border border-slate-800/80 text-slate-400 rounded-full px-4 py-1.5 text-xs font-semibold tracking-wider mx-auto"
                >
                  Rotate to orient indicator vertically top
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* HIGH GRAPHIC SCI-FI COMPASS DOME */}
          <div className="relative flex items-center justify-center my-2 shrink-0 select-none">
            
            <div className="absolute w-64 h-64 bg-slate-900 rounded-full blur-2xl opacity-40 z-0 pointer-events-none" />
            <div className={`absolute w-60 h-60 bg-amber-500/2 rounded-full blur-3xl opacity-50 z-0 pointer-events-none ${isAligned ? 'bg-emerald-500/5' : ''}`} />

            <div
              id="compass_rotator_dial"
              ref={dialRef}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              onMouseDown={handleMouseDown}
              className={`relative w-64 h-64 md:w-72 md:h-72 rounded-full border border-slate-850 bg-slate-950/80 flex items-center justify-center cursor-grab active:cursor-grabbing shadow-[inset_0_4px_30px_rgba(0,0,0,0.8),0_15px_35px_rgba(0,0,0,0.4)] transition-shadow duration-300 z-10 ${isAligned ? 'border-emerald-500/25 ring-8 ring-emerald-500/5 shadow-[0_0_40px_rgba(16,185,129,0.1),inset_0_4px_30px_rgba(0,0,0,0.8)]' : ''}`}
              style={{ 
                transform: `rotate(${-heading}deg)`, 
                transition: isDragging ? 'none' : 'transform 0.25s ease-out'
              }}
            >
              <div className="absolute inset-4 rounded-full border border-dashed border-slate-850/40" />

              <span className="absolute top-3 font-semibold text-xs tracking-wider text-red-500 font-mono">N</span>
              <span className="absolute bottom-3 font-semibold text-xs tracking-wider text-slate-500 font-mono">S</span>
              <span className="absolute left-3 font-semibold text-xs tracking-wider text-slate-500 font-mono">W</span>
              <span className="absolute right-3 font-semibold text-xs tracking-wider text-slate-500 font-mono">E</span>

              {[...Array(12)].map((_, i) => (
                <div 
                  key={i} 
                  className="absolute w-1 h-3 bg-slate-800" 
                  style={{ transform: `rotate(${i * 30}deg) translateY(-118px)` }}
                />
              ))}

              <div 
                id="kaaba_pointer_indicator"
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{ transform: `rotate(${qiblaAngle}deg)` }}
              >
                <div className="absolute top-10 bottom-1/2 w-0.5 bg-gradient-to-t from-transparent to-amber-400" />
                
                <div className="absolute top-[42px] flex flex-col items-center">
                  <div className="relative w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500 text-amber-400 flex items-center justify-center shadow-md shadow-amber-950/40 animate-pulse">
                    <div className="w-3.5 h-3 bg-amber-400 rounded-xs flex flex-col justify-between border-b border-amber-600">
                      <div className="w-full h-0.5 bg-amber-950" style={{ transform: 'translateY(1px)' }} />
                    </div>
                  </div>
                  <span className="text-[8px] font-bold text-amber-500 mt-1 font-mono uppercase tracking-widest">Qibla</span>
                </div>
              </div>

              <div className={`w-12 h-12 rounded-full bg-slate-900 border border-slate-800 shadow-md flex items-center justify-center z-10 transition-colors ${isAligned ? 'border-emerald-500' : ''}`}>
                <div className={`w-2.5 h-2.5 rounded-full ${isAligned ? 'bg-emerald-400' : 'bg-slate-700'}`} />
              </div>

            </div>

            <div 
              id="center_qibla_compass_needle"
              className={`absolute w-12 h-12 rounded-full bg-slate-900/95 border shadow-lg flex items-center justify-center z-20 pointer-events-none transition-all duration-300 ${isAligned ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-slate-800 ring-4 ring-slate-800/10'}`}
              style={{ 
                transform: `rotate(${relativeQiblaAngle}deg)`, 
                transition: isDragging ? 'none' : 'transform 0.25s ease-out'
              }}
            >
              <div className="relative w-1.5 h-10 flex flex-col items-center justify-center">
                <div className={`w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[18px] transition-colors duration-300 ${isAligned ? 'border-b-emerald-400' : 'border-b-amber-500'}`} />
                <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[18px] border-t-slate-600" />
              </div>
            </div>

            <div className="absolute top-0 bottom-1/2 w-0.5 bg-gradient-to-t from-transparent via-[#f59e0b]/5 to-red-500/80 pointer-events-none z-20" />
            <div className="absolute -top-3 w-4 h-4 rounded-full bg-red-500 border-2 border-[#0f172a] shadow-md pointer-events-none z-20" />

          </div>

          {/* Location metrics readings */}
          <div id="qibla_location_details" className="text-center space-y-1 shrink-0 select-none w-full max-w-xs">
            <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest flex items-center justify-center gap-1 leading-none">
              <MapPin className="w-2.5 h-2.5 text-amber-500" /> Positioned Location
            </p>
            <p className="text-sm font-black text-slate-100 leading-none">
              {locationName}
            </p>
            <div className="flex items-center justify-center gap-3 text-2xs font-bold text-slate-400 pt-0.5">
              <span>Qibla Angle: <b className="font-mono text-slate-100">{qiblaAngle}°</b></span>
              <span className="w-1 h-1 rounded-full bg-slate-800" />
              <span>Compass Alignment: <b className="font-mono text-slate-100">{Math.round(relativeQiblaAngle)}°</b></span>
            </div>

            {gpsError && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[9px] font-bold text-amber-400 bg-amber-500/5 border border-amber-500/10 p-2 rounded-lg mt-1 select-none"
              >
                {gpsError}
              </motion.div>
            )}

            {isUnsecureContext && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-3xs leading-relaxed text-amber-300 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg mt-2 text-center"
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-400 mx-auto mb-1 animate-pulse" />
                <p className="font-bold">Insecure Connection (HTTP)</p>
                <p className="mt-0.5 text-slate-300 leading-normal font-medium">
                  Browsers block coordinates over HTTP. Access over <b>HTTPS</b> to activate compass sensors automatically.
                </p>
              </motion.div>
            )}

            {isLiveSensors && (
              <div className="text-[8px] font-black text-emerald-400 uppercase tracking-widest flex items-center justify-center gap-1 mt-0.5">
                <span className="w-1 inline-block h-1 rounded-full bg-emerald-400 animate-pulse" />
                Live Compass Gyro Active
              </div>
            )}
          </div>

          {/* Desktop Preview / Simulator precision calibration dashboard */}
          {!isLiveSensors && (
            <div className="w-full max-w-xs bg-slate-900/30 border border-slate-850/70 rounded-2xl p-3 flex flex-col gap-2.5 shrink-0 select-none">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5 text-amber-500" /> Align Simulator
                </span>
                <button
                  type="button"
                  onClick={() => {
                    // Smoothly auto-spin compass dial to align perfectly to the Kaaba direction
                    targetHeading.current = qiblaAngle;
                  }}
                  className="px-2.5 py-1 rounded bg-gradient-to-tr from-amber-500 to-amber-600 hover:brightness-110 active:scale-95 transition-all text-slate-950 text-4xs font-black uppercase tracking-wider flex items-center gap-1 shadow-sm shadow-amber-950/20 cursor-pointer"
                >
                  <Sparkles className="w-2.5 h-2.5" /> Auto-Align
                </button>
              </div>

              {/* Slider Controller */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-4xs font-bold text-slate-400">
                  <span>Rotate Dial</span>
                  <span className="font-mono text-slate-200 font-extrabold">{Math.round(heading)}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="359"
                  value={Math.round(heading)}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    targetHeading.current = val;
                    currentHeading.current = val;
                    setHeading(val);
                  }}
                  className="w-full accent-amber-500 h-1 bg-slate-950 rounded-lg cursor-pointer"
                />
              </div>

              {/* Stepper click precision adjusting */}
              <div className="grid grid-cols-4 gap-1.5 mt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    const next = (targetHeading.current - 5 + 360) % 360;
                    targetHeading.current = next;
                  }}
                  className="py-1 rounded bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 transition-colors text-slate-300 font-mono text-[10px] font-extrabold cursor-pointer"
                  title="Rotate Left 5 Degrees"
                >
                  -5°
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = (targetHeading.current - 1 + 360) % 360;
                    targetHeading.current = next;
                  }}
                  className="py-1 rounded bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 transition-colors text-slate-300 font-mono text-[10px] font-extrabold cursor-pointer"
                  title="Rotate Left 1 Degree"
                >
                  -1°
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = (targetHeading.current + 1) % 360;
                    targetHeading.current = next;
                  }}
                  className="py-1 rounded bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 transition-colors text-slate-300 font-mono text-[10px] font-extrabold cursor-pointer"
                  title="Rotate Right 1 Degree"
                >
                  +1°
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = (targetHeading.current + 5) % 360;
                    targetHeading.current = next;
                  }}
                  className="py-1 rounded bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 transition-colors text-slate-300 font-mono text-[10px] font-extrabold cursor-pointer"
                  title="Rotate Right 5 Degrees"
                >
                  +5°
                </button>
              </div>
            </div>
          )}

          {/* Informative description tip overlay bottom */}
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-850/60 text-[10px] leading-relaxed text-slate-400 max-w-xs flex items-start gap-1.5 select-none shrink-0">
            <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p>
              Position your phone flat and frame the compass straight. Match <b>0° Alignment</b> to find Kaaba's exact direction. Live dragging is simulated for desktop.
            </p>
          </div>

        </div>
      ) : (
        /* ==========================================
           BRAND NEW PRAYER TIMES & AZAN DISPLAY DECK
           ========================================== */
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4 w-full max-w-md mx-auto scrollbar-thin scrollbar-thumb-slate-800">
          
          {/* Main Visual Clock & Next Prayer countdown Hero box */}
          <div className={`p-5 rounded-2xl border ${palette.cardBorder} ${palette.cardBg} bg-gradient-to-br ${palette.gradient} ${palette.lightGlow} shrink-0 select-none flex flex-col gap-4 relative overflow-hidden`}>
            
            {/* Animated background mosque dome silhouette trace */}
            <div className="absolute right-2 -bottom-4 opacity-[0.03] select-none pointer-events-none">
              <span className="text-[120px]">🕌</span>
            </div>

            {/* Top row with location & state details */}
<div className="flex flex-col gap-2 z-10 bg-transparent w-full">
  <div className="flex items-center justify-between gap-2">
    <div className="flex items-center gap-1.5 min-w-0 flex-1">
      <MapPin className="w-3 h-3 text-amber-500 shrink-0" />
      <span className="text-4xs font-black uppercase tracking-widest text-slate-400 leading-none whitespace-nowrap">Selected Region</span>
    </div>
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="text-4xs font-black uppercase tracking-widest text-amber-500 leading-none whitespace-nowrap">Active Interval</span>
      <span className="px-2 py-0.5 rounded bg-slate-950 font-black text-3xs text-slate-100 border border-slate-800 whitespace-nowrap">
        {activePrayer.label}
      </span>
    </div>
  </div>
  <h3 className="text-sm font-black text-slate-100 truncate leading-tight">
    {locationName}
  </h3>
</div>

            {/* Centered centerpiece visual area */}
            <div className="py-4 border-t border-slate-800/40 flex flex-col justify-center items-center z-10 bg-transparent text-center">
              {/* Massive centered digital City clock */}
              <span className="text-3xl font-black font-mono tracking-tight text-slate-50 drop-shadow-[0_2px_8px_rgba(255,255,255,0.08)]">
                {localCityTime || '--:--:--'}
              </span>
              <span className="text-3xs font-bold tracking-widest uppercase text-slate-400 mt-1 block">
                Local City Time
              </span>

              {/* Countdown countdown timer inside container */}
              <div className="mt-5 flex flex-col items-center">
                <span className="text-3xs font-black tracking-widest text-[#f59e0b] uppercase">
                  Countdown to {nextPrayer.label}
                </span>
                <span className="text-2xl font-black font-mono tracking-tight text-amber-400 drop-shadow-[0_2px_8px_rgba(245,158,11,0.25)] mt-1.5">
                  {timeRemaining || 'Calculating...'}
                </span>
                <span className="text-4xs font-bold text-slate-400 mt-1.5 block uppercase tracking-wider">
                  Arrival Time: <b className="font-mono text-slate-350">{formatPrayerTime(nextPrayerTime)}</b>
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Prayer Times Grid Listing */}
          <div className="flex flex-col gap-1.5">
            <h4 className="text-4xs font-black uppercase tracking-widest text-[#f59e0b] px-1 pb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Daily Namaz Timeline
            </h4>
            
            <div className="space-y-1">
              {prayersList.map((p, index) => {
                const isActive = activePrayer.id === p.id;
                const isSelectedForSound = azanSettings[p.id];

                return (
                  <div
                    key={p.id}
                    className={`px-3 py-2.5 rounded-xl border flex items-center justify-between transition-all ${
                      isActive 
                        ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/5 shadow-md shadow-amber-950/10'
                        : 'bg-slate-950/60 border-slate-850 hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 bg-transparent">
                      {/* Prayer Number / Icon */}
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black font-mono ${isActive ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-400'}`}>
                        {p.id === 'sunrise' ? '☀️' : (index === 0 ? '➊' : index === 1 ? '➋' : index === 2 ? '➌' : index === 3 ? '➍' : index === 4 ? '➎' : '➏')}
                      </div>
                      
                      {/* Labels */}
                      <div className="bg-transparent select-none">
                        <div className="flex items-center gap-1.5 bg-transparent">
                          <span className={`text-xs font-black leading-none ${isActive ? 'text-amber-400' : 'text-slate-100'}`}>
                            {p.label}
                          </span>
                          {isActive && (
                            <span className="text-[8px] font-black tracking-widest uppercase px-1 py-0.2 rounded bg-emerald-500 text-slate-950 animate-pulse">
                              Active Now
                            </span>
                          )}
                        </div>
                        <span className="text-4xs text-slate-500 font-bold uppercase">{p.subtitle}</span>
                      </div>
                    </div>

                    {/* Time reading & Alarm switch button */}
                    <div className="flex items-center gap-3 bg-transparent">
                      {/* Formatted absolute time in timezone code */}
                      <span className={`text-xs font-black font-mono tracking-tight ${isActive ? 'text-amber-400' : 'text-slate-200'}`}>
                        {formatPrayerTime(p.time)}
                      </span>

                      {/* BELL ALARM TRIGGER ICON BUTTON */}
                      {p.isAzan ? (
                        <button
                          id={`btn_toggle_azan_alarm_${p.id}`}
                          type="button"
                          onClick={() => handleToggleAzanSetting(p.id)}
                          className={`w-6.5 h-6.5 rounded-full flex items-center justify-center transition-colors border select-none cursor-pointer ${
                            isSelectedForSound
                              ? 'bg-amber-500/15 text-amber-500 border-amber-500/30 hover:bg-amber-500/25'
                              : 'bg-slate-900 text-slate-600 border-slate-800 hover:text-slate-400'
                          }`}
                          title={isSelectedForSound ? `Azan for ${p.label} broadcast enabled` : `Azan for ${p.label} broadcast muted`}
                        >
                          {isSelectedForSound ? (
                            <Bell className="w-3.5 h-3.5 animate-bounce-gentle shrink-0" />
                          ) : (
                            <BellOff className="w-3.5 h-3.5 shrink-0" />
                          )}
                        </button>
                      ) : (
                        // Sunrise does not sound an Azan, show sun placeholder
                        <div className="w-6.5 h-6.5 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 select-none">
                          ☀️
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* FIQH & CONVENTION CONFIGURATION FORM CARDS */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-850 flex flex-col gap-3.5 select-none">
            <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1 border-b border-slate-900 pb-1.5 shrink-0">
              <Sliders className="w-3 h-3 text-amber-500" /> Calculation Juristic Deck
            </h5>

            <div className="flex flex-col gap-4 bg-transparent">
              {/* Juristic Hanafi vs Standard Selector */}
              <div className="bg-transparent flex flex-col gap-1.5 w-full">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Asr Juristic Method (Fiqh):
                </span>
                <div className="flex bg-slate-900 p-0.5 rounded-xl border border-slate-800 w-full">
                  <button
                    id="btn_select_fiqh_hanafi"
                    type="button"
                    onClick={() => setFiqh('Hanafi')}
                    className={`flex-1 py-1.5 text-xs font-black uppercase tracking-wide rounded-lg transition-all cursor-pointer ${
                      fiqh === 'Hanafi'
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-400 hover:text-zinc-200'
                    }`}
                  >
                    Hanafi (Default)
                  </button>
                  <button
                    id="btn_select_fiqh_shafi"
                    type="button"
                    onClick={() => setFiqh('Shafi')}
                    className={`flex-1 py-1.5 text-xs font-black uppercase tracking-wide rounded-lg transition-all cursor-pointer ${
                      fiqh === 'Shafi'
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-400 hover:text-zinc-200'
                    }`}
                  >
                    Shafi / Standard
                  </button>
                </div>
                <span className="text-[9px] leading-relaxed font-semibold text-slate-400 select-text">
                  Hanafi calculates Asr when shadows are 2x long. Standard (Shafi) uses 1x long.
                </span>
              </div>

              {/* Calculation Convention Selector */}
              <div className="bg-transparent flex flex-col gap-1.5 w-full">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Calculation Agency:
                </span>
                <select
                  id="select_calculation_agency"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-200 p-2 focus:outline-none focus:border-amber-500 cursor-pointer"
                  value={calcMethod}
                  onChange={(e) => setCalcMethod(e.target.value as any)}
                >
                  <option value="Karachi">Karachi Univ. (Hanafi Default)</option>
                  <option value="MWL">Muslim World League (MWL Global)</option>
                  <option value="UmmAlQura">Umm Al-Qura (Saudi Arabia)</option>
                  <option value="ISNA">ISNA (North America / UK)</option>
                  <option value="Egypt">Egyptian General Authority</option>
                </select>
                <span className="text-[9px] leading-relaxed font-semibold text-slate-400 select-text">
                  Configures local dawn & twilight angle variables for Fajr & Isha starts.
                </span>
              </div>
            </div>
          </div>

          {/* ADVANCED BROADCAST & TEST SOUND CONSOLE */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-850 flex flex-col gap-2.5 select-none">
            <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1 border-b border-slate-900 pb-1.5 shrink-0">
              <Volume2 className="w-3.5 h-3.5 text-amber-500" /> Azan Audio Console (Broadcast Test)
            </h5>

            <div className="flex flex-col gap-3.5 pt-1">
              {/* Select Mecca vs Medina Audio streams */}
              <div className="bg-transparent flex flex-col gap-1.5 w-full">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Select Adhan Feed</span>
                <div className="flex bg-slate-900 p-0.5 rounded-xl border border-slate-800 w-full">
                  <button
                    id="btn_select_sound_mecca"
                    type="button"
                    onClick={() => setSelectedAzanSound('mecca')}
                    className={`flex-1 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                      selectedAzanSound === 'mecca'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20 font-black'
                        : 'text-slate-500 hover:text-slate-350'
                    }`}
                  >
                    Mecca Haram
                  </button>
                  <button
                    id="btn_select_sound_medina"
                    type="button"
                    onClick={() => setSelectedAzanSound('medina')}
                    className={`flex-1 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                      selectedAzanSound === 'medina'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20 font-black'
                        : 'text-slate-500 hover:text-slate-350'
                    }`}
                  >
                    Medina Nabawi
                  </button>
                </div>
              </div>

              {/* Play / Stop Action button */}
              <div className="bg-transparent w-full shrink-0">
                {isAudioPlaying ? (
                  <button
                    id="btn_broadcast_pause_play"
                    onClick={stopAzan}
                    type="button"
                    className="w-full justify-center px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 font-black text-xs text-slate-100 uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                  >
                    <VolumeX className="w-3.5 h-3.5" /> Stop Azan
                  </button>
                ) : (
                  <button
                    id="btn_broadcast_preview_play"
                    onClick={() => playAzan(selectedAzanSound === 'mecca' ? MECCA_AZAN_URLS : MEDINA_AZAN_URLS, 'Broadcast Preview Adhan')}
                    type="button"
                    disabled={loadingAudio}
                    className="w-full justify-center px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 font-black text-xs text-slate-950 uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm disabled:opacity-50 disabled:cursor-wait"
                  >
                    {loadingAudio ? (
                      <>
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-950 border-t-transparent animate-spin"></div>
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5" /> Play Test Adhan
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Buffering Status/Route Feedback */}
              {isAudioPlaying && loadingAudio && currentUrlTrying && (
                <div id="adhan_buffering_box" className="text-amber-400 text-[10px] mt-2 bg-amber-500/5 border border-amber-500/15 rounded-lg p-2.5 flex items-center gap-2 animate-pulse justify-center">
                  <div className="w-2.5 h-2.5 rounded-full border border-amber-500 border-t-transparent animate-spin"></div>
                  <span className="font-semibold select-none">Buffering mosque stream route ...</span>
                </div>
              )}

              {/* Error log info */}
              {audioError && (
                <div id="adhan_error_box" className="text-rose-400 text-[10px] mt-2 bg-rose-500/5 border border-rose-500/15 rounded-lg p-2.5 flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Stream Connection Issue</span>
                    <span className="text-rose-300/80 leading-relaxed select-text font-medium block mt-0.5">{audioError}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Simulated sound spectrum animation when audio plays */}
            {isAudioPlaying && (
              <div className="flex justify-center items-end gap-1 px-4 py-2 bg-slate-900 border border-slate-850 rounded-lg mt-1 select-none pointer-events-none">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 mr-2">Broadcasting:</span>
                {[...Array(14)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-amber-500 rounded-full animate-pulse"
                    style={{
                      height: `${Math.floor(Math.random() * 20) + 6}px`,
                      animationDuration: `${0.3 + (i % 5) * 0.15}s`
                    }}
                  />
                ))}
              </div>
            )}

            <div className="flex items-start gap-1 pb-1 pt-1 opacity-80.">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[8px] leading-relaxed text-slate-400 font-medium select-text">
                When the application is open, the system tracks prayer times automatically in the background and will sound the Adhan when a prayer time arrives (for prayers with active bells).
              </p>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
