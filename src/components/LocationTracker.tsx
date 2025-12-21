import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const UPDATE_INTERVAL = 60000; // 1 minute

export function LocationTracker() {
    const { user } = useAuth();
    const { toast } = useToast();

    const [error, setError] = useState<string | null>(null);
    const [isTracking, setIsTracking] = useState(false);

    useEffect(() => {
        if (!user) return;

        const updateLocation = () => {
            if (!navigator.geolocation) {
                setError('Geolocalização não suportada.');
                return;
            }

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    setError(null);
                    setIsTracking(true);
                    const { latitude, longitude } = position.coords;

                    try {
                        const { error } = await supabase
                            .from('profiles')
                            .update({
                                latitude,
                                longitude,
                                last_location_update: new Date().toISOString(),
                            } as any)
                            .eq('id', user.id);

                        if (error) {
                            console.error('Supabase update error:', error);
                        } else {
                            console.log('Location updated:', { latitude, longitude });
                        }
                    } catch (err) {
                        console.error('Unexpected error updating location:', err);
                    }
                },
                (err) => {
                    console.error('Error getting location:', err);
                    setIsTracking(false);
                    if (err.code === err.PERMISSION_DENIED) {
                        setError('Permissão de localização negada.');
                    } else if (err.code === err.POSITION_UNAVAILABLE) {
                        setError('Localização indisponível.');
                    } else if (err.code === err.TIMEOUT) {
                        setError('Tempo limite ao obter localização.');
                    } else {
                        setError('Erro ao obter localização.');
                    }
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        };

        // Initial update
        updateLocation();

        // Schedule periodic updates
        const intervalId = setInterval(updateLocation, UPDATE_INTERVAL);

        return () => clearInterval(intervalId);
    }, [user]);

    if (error) {
        return (
            <div className="fixed bottom-4 left-4 z-50 bg-destructive text-destructive-foreground px-4 py-2 rounded-lg shadow-lg text-xs max-w-[200px]">
                <p className="font-bold">Erro de Rastreamento</p>
                <p>{error}</p>
            </div>
        );
    }

    if (isTracking) {
        return (
            <div className="fixed bottom-4 left-4 z-50 bg-green-500/90 text-white px-3 py-1.5 rounded-full shadow-lg text-[10px] flex items-center gap-2 pointer-events-none">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                GPS Ativo
            </div>
        );
    }

    return null;
}
