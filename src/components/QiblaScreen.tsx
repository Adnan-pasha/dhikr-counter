import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Compass, MapPin, Sparkles, Navigation, Info, HelpCircle,
  Search, Globe, ChevronDown, Check, X, Sliders
} from 'lucide-react';
import { AppTheme } from '../types';
import { CITY_PRESETS, qiblaBearing, readPrayerLocation, writePrayerLocation, type CityPreset } from '../places';

interface QiblaScreenProps {
  theme: AppTheme;
}


const NO_LOCATION_LABEL = 'Choose your location';

const deviceTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export default function QiblaScreen({ theme }: QiblaScreenProps) {
  // Coordinates and global timezone references
  // The place is remembered between visits. Until one is chosen there is no default: guessing a city would show wrong prayer times.
  const [savedPlace] = useState(() => readPrayerLocation());
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(savedPlace ? { lat: savedPlace.lat, lng: savedPlace.lng } : null);
  const [qiblaAngle, setQiblaAngle] = useState<number>(savedPlace ? qiblaBearing(savedPlace.lat, savedPlace.lng) : 0);
  const [locationName, setLocationName] = useState<string>(savedPlace?.label ?? NO_LOCATION_LABEL);
  const hasLocation = coords !== null;
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isUnsecureContext, setIsUnsecureContext] = useState<boolean>(false);
  
  // Search state & dropdown autocompletion states
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Live Location Fetcher via GPS. A newer choice (another request, or a picked city) makes a pending fix stale.
  const gpsRequestId = useRef(0);
  const requestGPSLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setGpsLoading(true);
    setGpsError(null);
    const requestId = ++gpsRequestId.current;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (requestId !== gpsRequestId.current) return;
        const { latitude, longitude } = position.coords;
        const saved = writePrayerLocation({ lat: latitude, lng: longitude, timeZone: deviceTimeZone(), label: 'My location' }, 'gps');
        setCoords({ lat: latitude, lng: longitude });
        setQiblaAngle(qiblaBearing(latitude, longitude));
        setLocationName(saved?.label ?? 'My location');
        setGpsLoading(false);
      },
      (err) => {
        if (requestId !== gpsRequestId.current) return;
        console.warn('Geolocation error:', err);
        setGpsError(
          err.code === 1 
            ? 'Permission denied. Please grant GPS access in your browser or select a city below.'
            : 'Unstable location signal. Please select a traditional city below.'
        );
        setGpsLoading(false);
      },
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 600000 }
    );
  };

  // Auto trigger GPS on load
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setIsUnsecureContext(true);
    }
    // A city the user picked on purpose is not overridden by GPS on every visit.
    if (!savedPlace || savedPlace.source === 'gps') requestGPSLocation();
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
    gpsRequestId.current += 1;
    setGpsLoading(false);
    writePrayerLocation({ lat: city.lat, lng: city.lng, timeZone: city.timeZone, label: city.name }, 'city');
    setCoords({ lat: city.lat, lng: city.lng });
    setQiblaAngle(city.direction);
    setLocationName(city.name);
    setGpsError(null);
  };

  // Angle math helper to check if aligned (within 4 degrees)
  const relativeQiblaAngle = (qiblaAngle - heading + 360) % 360;
  const isAligned = hasLocation && (relativeQiblaAngle <= 4 || relativeQiblaAngle >= 356);

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
    <div id="qibla_finder_container" className="flex flex-col h-full bg-[var(--color-bg-base)] text-slate-100 overflow-hidden">
      
      {/* Primary Container Header */}
      <div className="px-6 pt-5 pb-3 border-b border-slate-800/80 flex justify-between items-center bg-slate-900/50 backdrop-blur-md shrink-0">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-50 flex items-center gap-1.5 leading-none select-none">
            <Compass className="w-5 h-5 text-brand-400 animate-spin-slow" />
            Qibla
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium select-none">Find the direction of the Kaaba</p>
        </div>
        <div className="flex items-center gap-1.5">
          {iosNeedsPermission && (
            <button
              id="btn_request_compass_permission"
              onClick={requestCompassPermission}
              className="min-h-11 px-3 py-1.5 rounded-full cursor-pointer bg-brand-500/15 hover:bg-brand-500/25 border border-brand-500/40 text-2xs font-bold text-brand-400 flex items-center gap-1 transition-all"
            >
              <Navigation className="w-3 h-3 text-brand-400" />
              Calibrate
            </button>
          )}
          <button
            id="btn_gps_location_request"
            onClick={requestGPSLocation}
            className={`px-3 py-1.5 rounded-full cursor-pointer bg-slate-800 hover:bg-slate-700 border border-slate-700 text-2xs font-bold text-brand-400 flex items-center gap-1 transition-all ${gpsLoading ? 'animate-pulse' : ''}`}
            disabled={gpsLoading}
          >
            <MapPin className="w-3.5 h-3.5" />
            {gpsLoading ? 'Locating...' : 'Use GPS'}
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
              className="w-full min-h-11 px-3 py-2 bg-slate-950/80 border border-slate-850 text-2xs font-bold text-slate-200 rounded-lg focus:outline-none focus:border-brand-500/60 flex items-center justify-between cursor-pointer transition-all hover:border-slate-800"
            >
              <div className="flex items-center gap-1.5 bg-transparent truncate">
                <Globe className="w-3 h-3 text-brand-400 shrink-0" />
                <span className="truncate">{locationName}</span>
              </div>
              <div className="flex items-center gap-1.5 ml-1 bg-transparent select-none shrink-0">
                <span className="text-2xs font-black tracking-wider px-1 rounded-sm bg-slate-900 text-slate-400 border border-slate-800">
                  {hasLocation ? `${qiblaAngle}° QIBLA` : 'NO LOCATION'}
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
                      aria-label="Search cities"
                      placeholder={`Search ${CITY_PRESETS.length} cities...`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-7 pr-7 py-1.5 bg-slate-900 border border-slate-850 text-2xs text-slate-100 rounded-lg focus:outline-none focus:border-brand-500/80 placeholder-slate-500 font-medium"
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
                        { name: 'Mecca', query: 'Mecca' },
                        { name: 'Medina', query: 'Medina' },
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
                                ? 'bg-brand-500/10 border border-brand-500/20 text-brand-450 font-black shadow-sm'
                                : 'hover:bg-slate-900 border border-transparent text-slate-350 hover:text-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 bg-transparent truncate">
                              {isSelected ? (
                                <Check className="w-2.5 h-2.5 text-brand-400 shrink-0" />
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

      {/* COMPASS */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col items-center justify-between gap-4">
          
          {/* Alignment Glow Announcement */}
          <div role="status" className="text-center w-full max-w-xs shrink-0 select-none">
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
            <div className={`absolute w-60 h-60 bg-brand-500/2 rounded-full blur-3xl opacity-50 z-0 pointer-events-none ${isAligned ? 'bg-emerald-500/5' : ''}`} />

            <div
              id="compass_rotator_dial"
              aria-hidden="true"
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

              <span className="absolute top-7 font-bold text-sm tracking-wider text-red-500 font-mono">N</span>
              <span className="absolute bottom-7 font-bold text-sm tracking-wider text-slate-300 font-mono">S</span>
              <span className="absolute left-7 font-bold text-sm tracking-wider text-slate-300 font-mono">W</span>
              <span className="absolute right-7 font-bold text-sm tracking-wider text-slate-300 font-mono">E</span>

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
                <div className="absolute top-10 bottom-1/2 w-0.5 bg-gradient-to-t from-transparent to-brand-400" />
                
                <div className="absolute top-[42px] flex flex-col items-center">
                  <div className="relative w-8 h-8 rounded-full bg-brand-500/10 border border-brand-500 text-brand-400 flex items-center justify-center shadow-md shadow-brand-950/40 animate-pulse">
                    <div className="w-3.5 h-3 bg-brand-400 rounded-xs flex flex-col justify-between border-b border-brand-600">
                      <div className="w-full h-0.5 bg-brand-950" style={{ transform: 'translateY(1px)' }} />
                    </div>
                  </div>
                  <span className="text-[8px] font-bold text-brand-400 mt-1 font-mono uppercase tracking-widest">Qibla</span>
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
                <div className={`w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[18px] transition-colors duration-300 ${isAligned ? 'border-b-emerald-400' : 'border-b-brand-500'}`} />
                <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[18px] border-t-slate-600" />
              </div>
            </div>

            <div className="absolute top-0 bottom-1/2 w-0.5 bg-gradient-to-t from-transparent via-brand-500/5 to-red-500/80 pointer-events-none z-20" />
            <div className="absolute -top-3 w-4 h-4 rounded-full bg-red-500 border-2 border-[var(--color-bg-base)] shadow-md pointer-events-none z-20" />

          </div>

          {/* Location metrics readings */}
          <div id="qibla_location_details" className="text-center space-y-1 shrink-0 select-none w-full max-w-xs">
            <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest flex items-center justify-center gap-1 leading-none">
              <MapPin className="w-2.5 h-2.5 text-brand-400" /> Positioned Location
            </p>
            <p className="text-sm font-black text-slate-100 leading-none">
              {locationName}
            </p>
            <div className="flex items-center justify-center gap-3 text-2xs font-bold text-slate-400 pt-0.5">
              <span>Qibla Angle: <b className="font-mono text-slate-100">{qiblaAngle}°</b></span>
              <span className="w-1 h-1 rounded-full bg-slate-800" />
              <span>Compass Alignment: <b className="font-mono text-slate-100">{Math.round(relativeQiblaAngle)}°</b></span>
            </div>

            {!hasLocation && (
              <p id="qibla_needs_location" className="text-2xs font-bold text-brand-300 bg-brand-500/10 border border-brand-500/20 p-2.5 rounded-lg mt-1 text-center select-none">
                Choose your location, or allow GPS, to point the compass at the Kaaba.
              </p>
            )}

            {gpsError && (
              <motion.div
                role="alert"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs font-bold text-brand-400 bg-brand-500/5 border border-brand-500/10 p-2 rounded-lg mt-1 select-none"
              >
                {gpsError}
              </motion.div>
            )}

            {isUnsecureContext && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-3xs leading-relaxed text-brand-300 bg-brand-500/10 border border-brand-500/20 p-2.5 rounded-lg mt-2 text-center"
              >
                <HelpCircle className="w-3.5 h-3.5 text-brand-400 mx-auto mb-1 animate-pulse" />
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
                  <Sliders className="w-3.5 h-3.5 text-brand-400" /> Align Simulator
                </span>
                <button
                  type="button"
                  onClick={() => {
                    // Smoothly auto-spin compass dial to align perfectly to the Kaaba direction
                    targetHeading.current = qiblaAngle;
                  }}
                  className="min-h-11 px-3 py-1 rounded bg-gradient-to-tr from-brand-500 to-brand-600 hover:brightness-110 active:scale-95 transition-all text-on-brand text-4xs font-black uppercase tracking-wider flex items-center gap-1 shadow-sm shadow-brand-950/20 cursor-pointer"
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
                  aria-label="Rotate dial"
                  aria-valuetext={`${Math.round(heading)} degrees`}
                  min="0"
                  max="359"
                  value={Math.round(heading)}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    targetHeading.current = val;
                    currentHeading.current = val;
                    setHeading(val);
                  }}
                  className="w-full accent-brand-500 h-1 bg-slate-950 rounded-lg cursor-pointer"
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
            <Info className="w-3.5 h-3.5 text-brand-400 shrink-0 mt-0.5" />
            <p>
              Position your phone flat and frame the compass straight. Match <b>0° Alignment</b> to find Kaaba's exact direction. Live dragging is simulated for desktop.
            </p>
          </div>

        </div>

    </div>
  );
}
