import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import { supabase } from '@/integrations/supabase/client';
import { Map as MapIcon, X, User, Navigation, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { nearestNeighborSort } from '@/utils/routeOptimizer';
import { ServiceOrder } from '@/types';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet markers not showing
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface TechnicianLocation {
    id: string;
    full_name: string;
    email: string;
    latitude: number;
    longitude: number;
    last_location_update: string;
}

// Helper component to handle map view updates
function MapUpdater({ locations, defaultCenter }: { locations: TechnicianLocation[], defaultCenter: [number, number] }) {
    const map = useMap();

    useEffect(() => {
        if (locations.length > 0) {
            const bounds = L.latLngBounds(locations.map(l => [l.latitude, l.longitude]));
            map.fitBounds(bounds, { padding: [50, 50] });
        } else {
            map.setView(defaultCenter, 12);
        }
    }, [locations, map, defaultCenter]);

    return null;
}

export function AdminMap() {
    const [isOpen, setIsOpen] = useState(false);
    const [technicians, setTechnicians] = useState<TechnicianLocation[]>([]);
    const [selectedRoute, setSelectedRoute] = useState<ServiceOrder[]>([]);
    const [isLoadingRoute, setIsLoadingRoute] = useState(false);
    const defaultCenter: [number, number] = [-26.9046, -48.6612]; // Itajaí/SC

    const fetchLocations = async () => {
        const { data } = await supabase
            .from('profiles')
            .select('id, full_name, email, latitude, longitude, last_location_update')
            .not('latitude', 'is', null)
            .not('longitude', 'is', null);

        if (data) {
            setTechnicians(data as any);
        }
    };

    const fetchTechnicianRoute = async (techId: string) => {
        setIsLoadingRoute(true);
        try {
            // Fetch orders that have coordinates and are active (or completed today, but let's stick to active workflow for now)
            // You might want to filter by date here if 'scheduled_date' is reliable
            const { data } = await supabase
                .from('service_orders')
                .select('*')
                .eq('assigned_to', techId)
                .not('client_lat', 'is', null)
                .not('client_long', 'is', null)
                .order('scheduled_date', { ascending: true }); // Initial sort by schedule

            if (data) {
                // Use the optimizer to sort for a visually logical path
                // We cast to any because nearestNeighborSort expects OrderWithCoords but ServiceOrder is close enough for this visual
                const sortedRoute = nearestNeighborSort(data as any) as unknown as ServiceOrder[];
                setSelectedRoute(sortedRoute);
            }
        } catch (error) {
            console.error("Error fetching route:", error);
        } finally {
            setIsLoadingRoute(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchLocations();
            const interval = setInterval(fetchLocations, 30000);
            return () => clearInterval(interval);
        }
    }, [isOpen]);

    return (
        <Card className="w-full shadow-card border-0 overflow-hidden">
            <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
                <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                <Navigation className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-foreground">Mapa de Técnicos</h3>
                                <p className="text-sm text-muted-foreground">
                                    {technicians.length > 0
                                        ? `${technicians.length} técnicos online`
                                        : "Visualizar localização em tempo real"}
                                </p>
                            </div>
                        </div>
                        <Button variant="ghost" size="sm" className="w-9 p-0">
                            <ChevronsUpDown className="h-4 w-4" />
                            <span className="sr-only">Toggle</span>
                        </Button>
                    </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <div className="h-[500px] w-full relative border-t z-0">
                        {isOpen && typeof window !== 'undefined' && (
                            <MapContainer
                                center={defaultCenter}
                                zoom={12}
                                style={{ height: '100%', width: '100%' }}
                            >
                                <TileLayer
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />

                                <MapUpdater locations={technicians} defaultCenter={defaultCenter} />

                                {selectedRoute.length > 0 && (
                                    <>
                                        <Polyline
                                            positions={selectedRoute.map(order => [order.client_lat!, order.client_long!])}
                                            color="#3b82f6"
                                            weight={4}
                                            opacity={0.6}
                                            dashArray="10, 10"
                                        />
                                        {selectedRoute.map((order, index) => (
                                            <Marker
                                                key={order.id}
                                                position={[order.client_lat!, order.client_long!]}
                                                icon={L.divIcon({
                                                    className: 'bg-blue-500 rounded-full border-2 border-white shadow-sm',
                                                    iconSize: [12, 12],
                                                })}
                                            >
                                                <Popup>
                                                    <div className="text-xs p-1">
                                                        <strong>#{index + 1}</strong> {order.service_type}
                                                        <br />
                                                        <span className="text-muted-foreground">{order.address}, {order.number}</span>
                                                    </div>
                                                </Popup>
                                            </Marker>
                                        ))}
                                    </>
                                )}

                                {technicians.map((tech) => (
                                    <Marker
                                        key={tech.id}
                                        position={[tech.latitude, tech.longitude]}
                                    >
                                        <Popup>
                                            <div className="p-1 min-w-[150px]">
                                                <div className="font-bold flex items-center gap-2 mb-2">
                                                    <User className="h-3 w-3" />
                                                    {tech.full_name || tech.email}
                                                </div>
                                                <div className="text-xs text-muted-foreground mb-3">
                                                    Última atualização: {new Date(tech.last_location_update).toLocaleTimeString()}
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="w-full text-xs h-7"
                                                    onClick={() => fetchTechnicianRoute(tech.id)}
                                                    disabled={isLoadingRoute}
                                                >
                                                    {isLoadingRoute ? 'Carregando...' : 'Ver Rota do Dia'}
                                                </Button>
                                            </div>
                                        </Popup>
                                    </Marker>
                                ))}
                            </MapContainer>
                        )}
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </Card>
    );
}
