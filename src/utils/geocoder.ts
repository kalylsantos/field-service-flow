import { ServiceOrder } from '@/types';

export interface GeocodingResult {
  lat: number;
  lon: number;
}

export interface GeocodingProgress {
  current: number;
  total: number;
  currentAddress: string;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const RATE_LIMIT_DELAY = 1500; // 1.5 seconds between requests

/**
 * Delays execution for specified milliseconds
 */
const delay = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Builds a query string from order address components
 */
export function buildAddressQuery(order: ServiceOrder): string {
  const parts = [
    order.address,
    order.number,
    order.neighborhood,
    order.municipality,
    'Brasil'
  ].filter(Boolean);
  
  return parts.join(', ');
}

/**
 * Geocodes a single address using Nominatim API
 */
export async function geocodeAddress(query: string): Promise<GeocodingResult | null> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `${NOMINATIM_URL}?q=${encodedQuery}&format=json&limit=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'FieldServiceManagement/1.0 (lovable.dev)',
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error(`Nominatim error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
      };
    }
    
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

/**
 * Geocodes multiple orders with rate limiting
 * Returns orders with updated coordinates
 */
export async function geocodeOrders(
  orders: ServiceOrder[],
  onProgress?: (progress: GeocodingProgress) => void
): Promise<Map<string, GeocodingResult>> {
  const results = new Map<string, GeocodingResult>();
  
  // Filter orders that need geocoding (no coordinates or invalid ones)
  const ordersToGeocode = orders.filter(
    order => !order.client_lat || !order.client_long || 
             order.client_lat === 0 || order.client_long === 0
  );
  
  console.log(`Geocoding ${ordersToGeocode.length} orders of ${orders.length} total`);
  
  for (let i = 0; i < ordersToGeocode.length; i++) {
    const order = ordersToGeocode[i];
    const query = buildAddressQuery(order);
    
    // Report progress
    if (onProgress) {
      onProgress({
        current: i + 1,
        total: ordersToGeocode.length,
        currentAddress: query,
      });
    }
    
    // Apply rate limiting delay (except for first request)
    if (i > 0) {
      await delay(RATE_LIMIT_DELAY);
    }
    
    const result = await geocodeAddress(query);
    
    if (result) {
      results.set(order.id, result);
      console.log(`Geocoded ${order.id}: ${result.lat}, ${result.lon}`);
    } else {
      console.warn(`Failed to geocode order ${order.id}: ${query}`);
    }
  }
  
  return results;
}

/**
 * Checks if an order has valid coordinates
 */
export function hasValidCoordinates(order: ServiceOrder): boolean {
  return !!(
    order.client_lat && 
    order.client_long && 
    order.client_lat !== 0 && 
    order.client_long !== 0
  );
}
