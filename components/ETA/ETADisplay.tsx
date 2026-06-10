import React from 'react';
import { etaService } from '../../services/etaService';

interface ETADisplayProps {
    washerLocation: { lat: number; lng: number } | null;
    clientLocation: { lat: number; lng: number };
    washerName?: string;
    showRoute?: boolean;
}

export const ETADisplay: React.FC<ETADisplayProps> = ({
    washerLocation,
    clientLocation,
    washerName = 'Washer',
    showRoute = false
}) => {
    const [eta, setETA] = React.useState<any>(null);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        if (!washerLocation) {
            setETA(null);
            setIsLoading(false);
            return;
        }

        const updateETA = async () => {
            try {
                const result = await etaService.calculateETA(washerLocation, clientLocation);
                if (result) {
                    setETA(result);
                } else {
                    // Fallback
                    const simpleETA = etaService.calculateSimpleETA(washerLocation, clientLocation);
                    setETA(simpleETA);
                }
            } catch (error) {
                console.error('Error calculating ETA:', error);
                const simpleETA = etaService.calculateSimpleETA(washerLocation, clientLocation);
                setETA(simpleETA);
            } finally {
                setIsLoading(false);
            }
        };

        updateETA();

        // Update every 10 seconds
        const interval = setInterval(updateETA, 10000);

        return () => clearInterval(interval);
    }, [washerLocation, clientLocation]);

    if (!washerLocation || !eta) {
        return null;
    }

    const minutes = Math.floor(eta.durationValue / 60);
    const color = etaService.getETAColor(minutes);

    return (
        <div className="bg-black/70 backdrop-blur-xl rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.4)] px-4 py-2 border border-white/10 flex items-center justify-between gap-3 max-w-[95%] sm:max-w-[450px] mx-auto w-full">
            {/* Left: Washer Info */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 shrink-0">
                    <span className="material-symbols-outlined text-primary text-xl">directions_car</span>
                </div>
                <div className="min-w-0">
                    <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest leading-none mb-0.5">Washer</p>
                    <p className="font-bold text-xs sm:text-sm text-white truncate">{washerName}</p>
                </div>
            </div>

            {/* Middle: ETA Pillar */}
            <div className="flex flex-col items-center justify-center px-3 py-1 bg-white/5 rounded-full border border-white/5 shrink-0">
                <span className="text-[10px] font-black text-white leading-none mb-0.5">
                    {isLoading ? '...' : eta.duration}
                </span>
                <div className="flex items-center gap-1">
                    <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter">Live</span>
                </div>
            </div>

            {/* Vertical Divider */}
            <div className="h-6 w-px bg-white/10 shrink-0 mx-1"></div>

            {/* Right: Distance Info */}
            <div className="flex flex-col items-end shrink-0 min-w-[60px]">
                <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest leading-none mb-0.5">Distance</p>
                <p className="text-xs sm:text-sm font-black text-primary leading-none">{eta.distance}</p>
            </div>
        </div>
    );
};
