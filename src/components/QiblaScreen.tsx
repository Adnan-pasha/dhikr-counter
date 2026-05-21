import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Compass, MapPin, Sparkles, Navigation, Info, HelpCircle } from 'lucide-react';
import { AppTheme } from '../types';

interface QiblaScreenProps {
  theme: AppTheme;
}

interface CityPreset {
  name: string;
  lat: number;
  lng: number;
  direction: number; // precalculated bearing
}

// Major cities worldwide and their calculated bearing direction towards Kaaba
const CITY_PRESETS: CityPreset[] = [
  { name: 'Mecca (Haram)', lat: 21.4225, lng: 39.8262, direction: 0 },
  { name: 'London, UK', lat: 51.5074, lng: -0.1278, direction: 119 },
  { name: 'New York, US', lat: 40.7128, lng: -74.0060, direction: 58 },
  { name: 'Jakarta, ID', lat: -6.2088, lng: 106.8456, direction: 295 },
  { name: 'Kuala Lumpur, MY', lat: 3.1390, lng: 101.6869, direction: 292 },
  { name: 'Cairo, EG', lat: 30.0444, lng: 31.2357, direction: 136 },
  { name: 'Istanbul, TR', lat: 41.0082, lng: 28.9784, direction: 152 },
  { name: 'Singapore, SG', lat: 1.3521, lng: 103.8198, direction: 293 },
  { name: 'Dubai, AE', lat: 25.2048, lng: 55.2708, direction: 251 },
  { name: 'Sydney, AU', lat: -33.8688, lng: 151.2093, direction: 277 },
  { name: 'Mumbai, IN', lat: 19.0760, lng: 72.8777, direction: 272 },
  { name: 'Toronto, CA', lat: 43.6532, lng: -79.3832, direction: 53 },
];

export default function QiblaScreen({ theme }: QiblaScreenProps) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [qiblaAngle, setQiblaAngle] = useState<number>(119); // Default to London's direction
  const [locationName, setLocationName] = useState<string>('London, UK (Default)');
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  
  // Simulated compass alignment rotation (for testing and manual alignment)
  // Users can drag or use sliders to rotate their direction to orient towards Mecca
  const [heading, setHeading] = useState<number>(0); // 0 = facing north
  const [isLiveSensors, setIsLiveSensors] = useState<boolean>(false);
  const [iosNeedsPermission, setIosNeedsPermission] = useState<boolean>(false);
  
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
    requestGPSLocation();
  }, []);

  // Check if iOS permissions are required for compass
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.DeviceOrientationEvent &&
      typeof (window.DeviceOrientationEvent as any).requestPermission === 'function'
    ) {
      setIosNeedsPermission(true);
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
          const handleOrientation = (e: DeviceOrientationEvent) => {
            if ('webkitCompassHeading' in e) {
              setHeading(e.webkitCompassHeading as number);
              setIsLiveSensors(true);
            }
          };
          window.addEventListener('deviceorientation', handleOrientation);
          setIsLiveSensors(true);
        } else {
          setGpsError('Compass orientation permission was denied.');
        }
      }
    } catch (e) {
      console.error('Compass activation failed:', e);
      setGpsError('Compass sensor calibration requires a secure secure context or user permission.');
    }
  };

  // Connect Device Orientation Compass Sensors (Android & general fallback)
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      // iOS specific webkitCompassHeading
      if ('webkitCompassHeading' in e) {
        setHeading(e.webkitCompassHeading as number);
        setIsLiveSensors(true);
      } else if (e.alpha !== null) {
        // Android alpha sensor orientation
        setHeading(360 - e.alpha);
        setIsLiveSensors(true);
      }
    };

    // Listen only on mounting if interactive request isn't active
    if (window.DeviceOrientationEvent && typeof (window.DeviceOrientationEvent as any).requestPermission !== 'function') {
      window.addEventListener('deviceorientation', handleOrientation);
      window.addEventListener('deviceorientationabsolute', handleOrientation);
    }

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      window.removeEventListener('deviceorientationabsolute', handleOrientation);
    };
  }, []);

  // When city preset selected
  const handleSelectCity = (city: CityPreset) => {
    setCoords({ lat: city.lat, lng: city.lng });
    setQiblaAngle(city.direction);
    setLocationName(city.name);
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
    setHeading((startHeading.current - diff + 360) % 360);
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

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const currentAngle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX) * 180 / Math.PI;
      const diffAngle = currentAngle - dragStartAngle.current;
      setHeading((startHeading.current - diffAngle + 360) % 360);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div id="qibla_finder_container" className="flex flex-col h-full bg-[#0f172a] text-slate-100">
      
      {/* Search Header */}
      <div className="px-6 pt-5 pb-3 border-b border-slate-800/80 flex justify-between items-center bg-slate-900/50 backdrop-blur-md shrink-0">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-50 flex items-center gap-1.5 leading-none select-none">
            <Compass className="w-5 h-5 text-amber-500 animate-spin-slow" />
            Qibla Finder
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium select-none">Locate the sacred direction to Kaaba</p>
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

        {/* HIGH GRAPHIC SCI-FI MINIMAL COMPASS DOME */}
        <div className="relative flex items-center justify-center my-2 shrink-0 select-none">
          
          {/* Ambient matching halo light back-glow */}
          <div className={`absolute w-64 h-64 bg-slate-900 rounded-full blur-2xl opacity-40 z-0 pointer-events-none`} />
          <div className={`absolute w-60 h-60 bg-amber-500/2 rounded-full blur-3xl opacity-50 z-0 pointer-events-none ${isAligned ? 'bg-emerald-500/5' : ''}`} />

          {/* Compass Dial Face with touch event mapping */}
          <div
            id="compass_rotator_dial"
            ref={dialRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onMouseDown={handleMouseDown}
            className={`relative w-64 h-64 md:w-72 md:h-72 rounded-full border border-slate-850 bg-slate-950/80 flex items-center justify-center cursor-grab active:cursor-grabbing shadow-[inset_0_4px_30px_rgba(0,0,0,0.8),0_15px_35px_rgba(0,0,0,0.4)] transition-shadow duration-300 z-10 ${isAligned ? 'border-emerald-500/25 ring-8 ring-emerald-500/5 shadow-[0_0_40px_rgba(16,185,129,0.1),inset_0_4px_30px_rgba(0,0,0,0.8)]' : ''}`}
            style={{ 
              transform: `rotate(${-heading}deg)`, 
              transition: isDragging ? 'none' : 'transform 0.25s ease-out'
            }}
          >
            {/* Compass Inner Subdivisions Lines */}
            <div className="absolute inset-4 rounded-full border border-dashed border-slate-850/40" />

            {/* Direct Dial Markers (NESW Letters) */}
            <span className="absolute top-3 font-semibold text-xs tracking-wider text-red-500 font-mono">N</span>
            <span className="absolute bottom-3 font-semibold text-xs tracking-wider text-slate-500 font-mono">S</span>
            <span className="absolute left-3 font-semibold text-xs tracking-wider text-slate-500 font-mono">W</span>
            <span className="absolute right-3 font-semibold text-xs tracking-wider text-slate-500 font-mono">E</span>

            {/* Dial Tick-mark rings */}
            {[...Array(12)].map((_, i) => (
              <div 
                key={i} 
                className="absolute w-1 h-3 bg-slate-800" 
                style={{ transform: `rotate(${i * 30}deg) translateY(-118px)` }}
              />
            ))}

            {/* STATIC MECCA POINTER IN THE ROTATING FRAME */}
            {/* Drawn relative to north direction. It correctly spins together with NESW when phone revolves. */}
            <div 
              id="kaaba_pointer_indicator"
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{ transform: `rotate(${qiblaAngle}deg)` }}
            >
              {/* Mecca Compass Heading Ray */}
              <div className="absolute top-10 bottom-1/2 w-0.5 bg-gradient-to-t from-transparent to-amber-400" />
              
              {/* Custom Elegant Mecca Icon Peak marker (The Kaaba silhouette dome) */}
              <div className="absolute top-[42px] flex flex-col items-center">
                <div className="relative w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500 text-amber-400 flex items-center justify-center shadow-md shadow-amber-950/40 animate-pulse">
                  {/* Miniature Kaaba symbol inside pointer */}
                  <div className="w-3.5 h-3 bg-amber-400 rounded-xs flex flex-col justify-between border-b border-amber-600">
                    <div className="w-full h-0.5 bg-amber-950" style={{ transform: 'translateY(1px)' }} />
                  </div>
                </div>
                {/* Micro chevron arrow */}
                <span className="text-[8px] font-bold text-amber-500 mt-1 font-mono uppercase tracking-widest">Qibla</span>
              </div>
            </div>

            {/* Golden Core Dial Center */}
            <div className={`w-12 h-12 rounded-full bg-slate-900 border border-slate-800 shadow-md flex items-center justify-center z-10 transition-colors ${isAligned ? 'border-emerald-500' : ''}`}>
              <Navigation className={`w-5 h-5 text-slate-400 shrink-0 select-none ${isAligned ? 'text-emerald-400 fill-emerald-500/20' : ''}`} style={{ transform: `rotate(${relativeQiblaAngle}deg)` }} />
            </div>

          </div>

          {/* FIXED VERTICAL TARGETING POINTER (Stays vertical on screen to show phone orientation alignment) */}
          <div className="absolute top-0 bottom-1/2 w-0.5 bg-gradient-to-t from-transparent via-[#f59e0b]/5 to-red-500/80 pointer-events-none z-20" />
          <div className="absolute -top-3 w-4 h-4 rounded-full bg-red-500 border-2 border-[#0f172a] shadow-md pointer-events-none z-20" />

        </div>

        {/* Location metrics readings */}
        <div id="qibla_location_details" className="text-center space-y-1.5 shrink-0 select-none w-full max-w-xs">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest flex items-center justify-center gap-1 leading-none">
            <MapPin className="w-3 h-3 text-amber-500" /> Current Location
          </p>
          <p className="text-base font-black text-slate-100 leading-none">
            {locationName}
          </p>
          <div className="flex items-center justify-center gap-3 text-xs font-semibold text-slate-400 pt-1">
            <span>Angle: <b className="font-mono text-slate-100">{qiblaAngle}°</b></span>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-800" />
            <span>Alignment: <b className="font-mono text-slate-100">{Math.round(relativeQiblaAngle)}°</b></span>
          </div>

          {/* Alert GPS error message when permissions are denied */}
          {gpsError && (
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[10px] font-semibold text-amber-400 bg-amber-500/5 border border-amber-500/10 p-2 rounded-xl mt-2 select-none"
            >
              {gpsError}
            </motion.div>
          )}

          {/* Real Live compass message if device sensors connected */}
          {isLiveSensors && (
            <div className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest flex items-center justify-center gap-1 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Live Device Gyro Active
            </div>
          )}
        </div>

        {/* MANUAL CITY CHANCE DROPDOWN (Great for fallback) */}
        <div className="w-full max-w-sm mt-1 z-20 shrink-0">
          <label htmlFor="select_manual_city" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 select-none text-center">
            Or manually test direction via major capitals:
          </label>
          <div className="relative">
            <select
              id="select_manual_city"
              onChange={(e) => {
                const index = Number(e.target.value);
                handleSelectCity(CITY_PRESETS[index]);
              }}
              defaultValue="1" // Default London index 1
              className="w-full px-4 py-2 bg-slate-900 border border-slate-800 text-xs font-bold text-slate-200 rounded-xl focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 cursor-pointer appearance-none bg-[right_16px_center]"
              style={{
                backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2394a3b8' viewBox='0 0 24 24'><path d='M7 10l5 5 5-5z'/></svg>")`,
                backgroundRepeat: 'no-repeat',
                backgroundSize: '16px 16px',
              }}
            >
              {CITY_PRESETS.map((city, idx) => (
                <option key={city.name} value={idx}>
                  {city.name} (Qibla: {city.direction}°)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Informative description tip overlay bottom */}
        <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-850 opacity-90 text-[10px] leading-relaxed text-slate-400 max-w-xs flex items-start gap-1.5 select-none shrink-0">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p>
            Aim your device matching <b>0° Alignment</b> to position your prayer rug towards Mecca's Holy Mosque. Drag/swipe compass to simulate rotative alignment on desktop.
          </p>
        </div>

      </div>
    </div>
  );
}
